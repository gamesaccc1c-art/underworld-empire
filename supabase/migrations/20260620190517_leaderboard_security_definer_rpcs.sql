-- Leaderboard RPCs that bypass RLS via SECURITY DEFINER

CREATE OR REPLACE FUNCTION get_player_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, username text, level int, power int,
  title text, vip_level int, reputation int,
  family_id uuid, family_name text, family_tag text, created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.username, p.level, p.power,
    p.title, p.vip_level, p.reputation,
    p.family_id, f.name AS family_name, f.tag AS family_tag, p.created_at
  FROM players p
  LEFT JOIN families f ON f.id = p.family_id
  ORDER BY p.power DESC
  LIMIT LEAST(p_limit, 100);
$$;

CREATE OR REPLACE FUNCTION get_family_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (
  id uuid, name text, tag text, power int, level int,
  territory_count int, member_count int, created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id, f.name, f.tag, f.power, f.level,
    f.territory_count,
    COUNT(p.id)::int AS member_count,
    f.created_at
  FROM families f
  LEFT JOIN players p ON p.family_id = f.id
  GROUP BY f.id, f.name, f.tag, f.power, f.level, f.territory_count, f.created_at
  ORDER BY f.power DESC
  LIMIT LEAST(p_limit, 100);
$$;

GRANT EXECUTE ON FUNCTION get_player_leaderboard(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_family_leaderboard(int) TO anon, authenticated;
