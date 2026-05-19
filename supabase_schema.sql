-- ============================================================
-- eFootball Manager - Supabase Schema
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- PROFILES (extend auth.users)
create table if not exists profiles (
  id          uuid references auth.users on delete cascade primary key,
  username    text unique not null,
  full_name   text,
  avatar_url  text,
  role        text not null default 'player' check (role in ('admin','player')),
  created_at  timestamptz default now()
);
alter table profiles enable row level security;
create policy "Public profiles readable" on profiles for select using (true);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- Auto create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- SEASONS
create table if not exists seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('league','cup','champions')),
  status      text not null default 'draft' check (status in ('draft','active','finished')),
  start_date  date,
  end_date    date,
  created_by  uuid references profiles(id),
  created_at  timestamptz default now(),
  num_divisions int default 1,
  promotion_count int default 0,
  relegation_count int default 0
);
alter table seasons enable row level security;
create policy "Seasons readable by all" on seasons for select using (true);
create policy "Admin can manage seasons" on seasons for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- TEAMS
create table if not exists teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  logo_url    text,
  owner_id    uuid references profiles(id),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at  timestamptz default now()
);
alter table teams enable row level security;
create policy "Teams readable by all" on teams for select using (true);
create policy "Owner can insert team" on teams for insert with check (auth.uid() = owner_id);
create policy "Admin can update teams" on teams for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- PLAYERS
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid references teams(id) on delete cascade,
  profile_id  uuid references profiles(id),
  name        text not null,
  position    text,
  jersey_no   int,
  created_at  timestamptz default now()
);
alter table players enable row level security;
create policy "Players readable by all" on players for select using (true);
create policy "Team owner manages players" on players for all using (
  exists (select 1 from teams where id = team_id and owner_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- SEASON TEAMS (enrollment)
create table if not exists season_teams (
  id        uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id) on delete cascade,
  team_id   uuid references teams(id) on delete cascade,
  group_id  text, -- for group stage (A, B, C, D)
  division  int default 1, -- 1 = tertinggi, 2, 3
  unique(season_id, team_id)
);
alter table season_teams enable row level security;
create policy "Season teams readable" on season_teams for select using (true);
create policy "Admin manages season teams" on season_teams for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- MATCHES
create table if not exists matches (
  id              uuid primary key default gen_random_uuid(),
  season_id       uuid references seasons(id) on delete cascade,
  home_team_id    uuid references teams(id),
  away_team_id    uuid references teams(id),
  home_score      int,
  away_score      int,
  match_date      timestamptz,
  round           int,        -- for league / cup round
  stage           text,       -- 'group','r16','qf','sf','final'
  group_id        text,       -- group A/B/C/D for UCL
  status          text not null default 'scheduled' check (status in ('scheduled','pending_result','approved','cancelled')),
  reported_by     uuid references profiles(id),
  screenshot_url  text,
  notes           text,
  created_at      timestamptz default now()
);
alter table matches enable row level security;
create policy "Matches readable by all" on matches for select using (true);
create policy "Players can report result" on matches for update using (
  home_team_id in (select id from teams where owner_id = auth.uid())
  or away_team_id in (select id from teams where owner_id = auth.uid())
  or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Admin can insert matches" on matches for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- MATCH EVENTS (goals, cards)
create table if not exists match_events (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid references matches(id) on delete cascade,
  player_id  uuid references players(id),
  team_id    uuid references teams(id),
  type       text not null check (type in ('goal','yellow_card','red_card','assist','own_goal')),
  minute     int,
  created_at timestamptz default now()
);
alter table match_events enable row level security;
create policy "Match events readable" on match_events for select using (true);
create policy "Admin manages events" on match_events for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- STANDINGS VIEW (auto calculated)
create or replace view standings as
with match_data as (
  select
    season_id,
    home_team_id as team_id,
    home_score   as gf,
    away_score   as ga,
    case when home_score > away_score  then 3
         when home_score = away_score  then 1
         else 0 end as pts,
    case when home_score > away_score  then 1 else 0 end as won,
    case when home_score = away_score  then 1 else 0 end as drawn,
    case when home_score < away_score  then 1 else 0 end as lost
  from matches where status = 'approved' and home_score is not null
  union all
  select
    season_id,
    away_team_id as team_id,
    away_score   as gf,
    home_score   as ga,
    case when away_score > home_score  then 3
         when away_score = home_score  then 1
         else 0 end as pts,
    case when away_score > home_score  then 1 else 0 end as won,
    case when away_score < home_score  then 1 else 0 end as lost,
    case when away_score > home_score  then 1 else 0 end as drawn
  from matches where status = 'approved' and away_score is not null
)
select
  md.season_id,
  md.team_id,
  t.name        as team_name,
  t.logo_url,
  st.group_id,
  st.division,
  count(*)      as played,
  sum(won)      as won,
  sum(drawn)    as drawn,
  sum(lost)     as lost,
  sum(gf)       as gf,
  sum(ga)       as ga,
  sum(gf)-sum(ga) as gd,
  sum(pts)      as pts
from match_data md
join teams t on t.id = md.team_id
left join season_teams st on st.team_id = md.team_id and st.season_id = md.season_id
group by md.season_id, md.team_id, t.name, t.logo_url, st.group_id, st.division
order by st.division asc, sum(pts) desc, (sum(gf)-sum(ga)) desc, sum(gf) desc;

-- TOP SCORERS VIEW
create or replace view top_scorers as
select
  me.match_id,
  m.season_id,
  p.id     as player_id,
  p.name   as player_name,
  p.jersey_no,
  t.name   as team_name,
  count(*) as goals
from match_events me
join players p on p.id = me.player_id
join teams   t on t.id = me.team_id
join matches m on m.id = me.match_id
where me.type in ('goal') and m.status = 'approved'
group by me.match_id, m.season_id, p.id, p.name, p.jersey_no, t.name
order by goals desc;
