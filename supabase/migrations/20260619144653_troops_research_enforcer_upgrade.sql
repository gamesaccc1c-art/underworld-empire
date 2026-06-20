
-- ============================================================
-- Troops: extend start_troop_training to deduct all costs
-- Research: no schema changes needed (RPCs already exist)
-- Enforcer: add upgrade_enforcer RPC
-- ============================================================

-- ─── Replace start_troop_training to deduct multi-resource costs ──────────────
CREATE OR REPLACE FUNCTION start_troop_training(
  p_troop_type text,
  p_tier integer DEFAULT 1,
  p_amount integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_cash_cost        integer;
  v_loyalty_cost     integer;
  v_black_money_cost integer;
  v_weapon_power_cost integer;
  v_duration         integer;
  v_ends_at          timestamptz;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  -- Per-unit costs by troop type
  v_cash_cost := CASE p_troop_type
    WHEN 'street_thugs'  THEN 200
    WHEN 'hitmen'        THEN 800
    WHEN 'bodyguards'    THEN 600
    WHEN 'bikers'        THEN 1000
    WHEN 'vehicle_crew'  THEN 2000
    WHEN 'heavy_crew'    THEN 5000
    ELSE 200
  END * p_amount;

  v_loyalty_cost := CASE p_troop_type
    WHEN 'street_thugs' THEN 10
    WHEN 'bodyguards'   THEN 30
    ELSE 0
  END * p_amount;

  v_black_money_cost := CASE p_troop_type
    WHEN 'hitmen'       THEN 50
    WHEN 'vehicle_crew' THEN 200
    WHEN 'heavy_crew'   THEN 300
    ELSE 0
  END * p_amount;

  v_weapon_power_cost := CASE p_troop_type
    WHEN 'bikers'       THEN 100
    WHEN 'heavy_crew'   THEN 500
    ELSE 0
  END * p_amount;

  v_duration := CASE p_troop_type
    WHEN 'street_thugs' THEN 30
    WHEN 'hitmen'       THEN 90
    WHEN 'bodyguards'   THEN 80
    WHEN 'bikers'       THEN 120
    WHEN 'vehicle_crew' THEN 180
    WHEN 'heavy_crew'   THEN 300
    ELSE 60
  END * p_amount;

  -- Resource checks
  IF v_player.cash < v_cash_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli nakit yok');
  END IF;
  IF v_loyalty_cost > 0 AND v_player.loyalty < v_loyalty_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli sadakat yok');
  END IF;
  IF v_black_money_cost > 0 AND v_player.black_money < v_black_money_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli kara para yok');
  END IF;
  IF v_weapon_power_cost > 0 AND v_player.weapon_power < v_weapon_power_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli silah gucu yok');
  END IF;

  -- Deduct resources atomically
  UPDATE players
  SET cash         = cash         - v_cash_cost,
      loyalty      = loyalty      - v_loyalty_cost,
      black_money  = black_money  - v_black_money_cost,
      weapon_power = weapon_power - v_weapon_power_cost,
      updated_at   = now()
  WHERE id = auth.uid();

  v_ends_at := now() + (v_duration || ' seconds')::interval;

  INSERT INTO troop_training_queue (user_id, troop_type, tier, amount, started_at, ends_at, status)
  VALUES (auth.uid(), p_troop_type, p_tier, p_amount, now(), v_ends_at, 'training');

  RETURN jsonb_build_object(
    'ok', true,
    'ends_at', v_ends_at,
    'duration', v_duration,
    'costs', jsonb_build_object(
      'cash', v_cash_cost,
      'loyalty', v_loyalty_cost,
      'black_money', v_black_money_cost,
      'weapon_power', v_weapon_power_cost
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION start_troop_training(text, integer, integer) TO authenticated;

-- ─── RPC: upgrade_enforcer ────────────────────────────────────────────────────
-- Costs 5 shards to upgrade; increments stars, grants bonuses
CREATE OR REPLACE FUNCTION upgrade_enforcer(p_enforcer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ue user_enforcers%ROWTYPE;
  SHARD_UPGRADE_COST constant integer := 5;
BEGIN
  SELECT * INTO v_ue FROM user_enforcers
  WHERE user_id = auth.uid() AND id = p_enforcer_id AND level >= 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enforcer bulunamadi veya kilidi acilmamis');
  END IF;

  IF v_ue.shards < SHARD_UPGRADE_COST THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli sard yok (5 gerekli)', 'shards', v_ue.shards);
  END IF;

  UPDATE user_enforcers
  SET shards = shards - SHARD_UPGRADE_COST,
      stars  = stars  + 1
  WHERE id = p_enforcer_id AND user_id = auth.uid();

  UPDATE players SET xp = xp + 100, updated_at = now() WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'new_stars', v_ue.stars + 1, 'shards_remaining', v_ue.shards - SHARD_UPGRADE_COST);
END;
$$;
GRANT EXECUTE ON FUNCTION upgrade_enforcer(uuid) TO authenticated;
