-- Fix standings view to include division column
CREATE OR REPLACE VIEW standings AS
WITH match_data AS (
  SELECT
    season_id,
    home_team_id AS team_id,
    home_score   AS gf,
    away_score   AS ga,
    CASE WHEN home_score > away_score THEN 3
         WHEN home_score = away_score THEN 1
         ELSE 0 END AS pts,
    CASE WHEN home_score > away_score THEN 1 ELSE 0 END AS won,
    CASE WHEN home_score = away_score THEN 1 ELSE 0 END AS drawn,
    CASE WHEN home_score < away_score THEN 1 ELSE 0 END AS lost
  FROM matches WHERE status = 'approved' AND home_score IS NOT NULL
  UNION ALL
  SELECT
    season_id,
    away_team_id AS team_id,
    away_score   AS gf,
    home_score   AS ga,
    CASE WHEN away_score > home_score THEN 3
         WHEN away_score = home_score THEN 1
         ELSE 0 END AS pts,
    CASE WHEN away_score > home_score THEN 1 ELSE 0 END AS won,
    CASE WHEN away_score = home_score THEN 1 ELSE 0 END AS drawn,
    CASE WHEN away_score < home_score THEN 1 ELSE 0 END AS lost
  FROM matches WHERE status = 'approved' AND away_score IS NOT NULL
)
SELECT
  md.season_id,
  md.team_id,
  t.name        AS team_name,
  t.logo_url,
  st.group_id,
  st.division,
  COUNT(*)      AS played,
  SUM(won)      AS won,
  SUM(drawn)    AS drawn,
  SUM(lost)     AS lost,
  SUM(gf)       AS gf,
  SUM(ga)       AS ga,
  SUM(gf)-SUM(ga) AS gd,
  SUM(pts)      AS pts
FROM match_data md
JOIN teams t ON t.id = md.team_id
LEFT JOIN season_teams st ON st.team_id = md.team_id AND st.season_id = md.season_id
GROUP BY md.season_id, md.team_id, t.name, t.logo_url, st.group_id, st.division
ORDER BY SUM(pts) DESC, (SUM(gf)-SUM(ga)) DESC, SUM(gf) DESC;
