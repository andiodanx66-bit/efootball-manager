-- Migration: tambah kolom divisi, promosi, degradasi untuk sistem liga bertingkat
-- Jalankan di Supabase SQL Editor

-- 1. Tambah kolom ke tabel seasons untuk konfigurasi divisi
alter table seasons
  add column if not exists num_divisions int default 1,
  add column if not exists promotion_count int default 0,
  add column if not exists relegation_count int default 0;

-- 2. Tambah kolom division ke season_teams (1 = divisi tertinggi, 2 = kedua, 3 = ketiga)
alter table season_teams
  add column if not exists division int default 1;

-- 3. Perbarui view standings untuk memasukkan division
drop view if exists standings;
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