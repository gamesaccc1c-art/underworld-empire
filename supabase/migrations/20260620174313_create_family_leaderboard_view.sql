-- Create family leaderboard view and grant anon access to both leaderboard views

CREATE OR REPLACE VIEW public_family_leaderboard AS
SELECT
  f.id,
  f.name,
  f.tag,
  f.power,
  f.level,
  f.territory_count,
  COUNT(p.id)::integer AS member_count,
  f.created_at
FROM families f
LEFT JOIN players p ON p.family_id = f.id
GROUP BY f.id, f.name, f.tag, f.power, f.level, f.territory_count, f.created_at
ORDER BY f.power DESC
LIMIT 100;

GRANT SELECT ON public_player_leaderboard TO anon;
GRANT SELECT ON public_family_leaderboard TO anon;
GRANT SELECT ON public_family_leaderboard TO authenticated;
