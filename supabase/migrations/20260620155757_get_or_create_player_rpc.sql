-- ============================================================
-- get_or_create_player RPC
-- Returns the player row for auth.uid(); creates it on first call.
-- Client can no longer INSERT into players directly for initial setup.
-- ============================================================

CREATE OR REPLACE FUNCTION get_or_create_player(
  p_email text,
  p_username text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_username text;
BEGIN
  -- Return existing player immediately
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF FOUND THEN
    RETURN to_jsonb(v_player);
  END IF;

  v_username := COALESCE(NULLIF(trim(p_username), ''), split_part(p_email, '@', 1), 'Oyuncu');

  INSERT INTO players (
    id, email, username,
    level, xp, vip_level, vip_points, power, title, reputation,
    diamonds, cash, influence, loyalty, weapon_power, black_money, intel,
    police_heat, raid_energy, dark_job_energy, spy_energy
  ) VALUES (
    auth.uid(), p_email, v_username,
    1, 0, 0, 0, 10, 'Sokak Serserisi', 0,
    100, 5000, 100, 50, 50, 0, 20,
    0, 10, 5, 3
  )
  RETURNING * INTO v_player;

  RETURN to_jsonb(v_player);
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_player(text, text) TO authenticated;
