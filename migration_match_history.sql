-- ============================================================
-- Migration: match_history
-- Tabel snapshot hasil pertandingan yang sudah approved.
-- Data tidak ikut terhapus saat matches/seasons dihapus.
-- Jalankan di Supabase SQL Editor.
-- ============================================================

-- 1. Buat tabel match_history
create table if not exists match_history (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid unique,                          -- referensi ke matches (nullable saat match dihapus)
  season_id       uuid,                                 -- disimpan as-is, tidak cascade
  season_name     text,
  season_type     text,
  home_team_id    uuid,
  home_team_name  text,
  away_team_id    uuid,
  away_team_name  text,
  home_score      int,
  away_score      int,
  round           int,
  stage           text,
  group_id        text,
  screenshot_url  text,
  approved_at     timestamptz,
  created_at      timestamptz default now()
);

alter table match_history enable row level security;

drop policy if exists "Match history readable by all" on match_history;
drop policy if exists "Service role manages match history" on match_history;

create policy "Match history readable by all" on match_history
  for select using (true);

-- Hanya service role / trigger yang boleh insert/update/delete
create policy "Service role manages match history" on match_history
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- 2. Fungsi trigger: upsert ke match_history saat match approved
-- ============================================================
create or replace function sync_match_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season_name text;
  v_season_type text;
  v_home_name   text;
  v_away_name   text;
begin
  -- Hanya proses jika status berubah menjadi 'approved'
  -- atau jika sudah approved dan ada update skor/screenshot
  if (TG_OP = 'UPDATE') then
    -- Jika status baru bukan approved, skip
    if NEW.status <> 'approved' then
      return NEW;
    end if;
  end if;

  -- Ambil nama season dan tim
  select name, type into v_season_name, v_season_type
    from seasons where id = NEW.season_id;

  select name into v_home_name
    from teams where id = NEW.home_team_id;

  select name into v_away_name
    from teams where id = NEW.away_team_id;

  -- Upsert berdasarkan match_id
  insert into match_history (
    match_id,
    season_id,
    season_name,
    season_type,
    home_team_id,
    home_team_name,
    away_team_id,
    away_team_name,
    home_score,
    away_score,
    round,
    stage,
    group_id,
    screenshot_url,
    approved_at
  ) values (
    NEW.id,
    NEW.season_id,
    v_season_name,
    v_season_type,
    NEW.home_team_id,
    v_home_name,
    NEW.away_team_id,
    v_away_name,
    NEW.home_score,
    NEW.away_score,
    NEW.round,
    NEW.stage,
    NEW.group_id,
    NEW.screenshot_url,
    coalesce(NEW.approved_at, now())
  )
  on conflict (match_id) do update set
    season_name    = excluded.season_name,
    season_type    = excluded.season_type,
    home_team_name = excluded.home_team_name,
    away_team_name = excluded.away_team_name,
    home_score     = excluded.home_score,
    away_score     = excluded.away_score,
    round          = excluded.round,
    stage          = excluded.stage,
    group_id       = excluded.group_id,
    screenshot_url = excluded.screenshot_url,
    approved_at    = excluded.approved_at;

  return NEW;
end;
$$;

-- ============================================================
-- 3. Pasang trigger di tabel matches
-- ============================================================
drop trigger if exists trg_sync_match_history on matches;

create trigger trg_sync_match_history
  after insert or update on matches
  for each row
  execute procedure sync_match_history();

-- ============================================================
-- 4. Backfill: copy semua match yang sudah approved saat ini
-- ============================================================
insert into match_history (
  match_id,
  season_id,
  season_name,
  season_type,
  home_team_id,
  home_team_name,
  away_team_id,
  away_team_name,
  home_score,
  away_score,
  round,
  stage,
  group_id,
  screenshot_url,
  approved_at
)
select
  m.id,
  m.season_id,
  s.name,
  s.type,
  m.home_team_id,
  ht.name,
  m.away_team_id,
  at.name,
  m.home_score,
  m.away_score,
  m.round,
  m.stage,
  m.group_id,
  m.screenshot_url,
  coalesce(m.approved_at, m.created_at)
from matches m
left join seasons s  on s.id  = m.season_id
left join teams   ht on ht.id = m.home_team_id
left join teams   at on at.id = m.away_team_id
where m.status = 'approved'
  and m.home_score is not null
on conflict (match_id) do nothing;
