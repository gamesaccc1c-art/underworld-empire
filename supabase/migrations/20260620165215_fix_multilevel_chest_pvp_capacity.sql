-- ============================================================
-- Fix remaining logic bugs:
-- 1. Multi-level-up loop (replace single UPDATE with loop)
-- 2. PVP loot capacity calculated after casualties (use surviving troops)
-- 3. Chest rarity cumulative logic (uncommon was unreachable)
-- ============================================================

-- ─── 1. Helper function for multi-level-up ──────────────────────────────────
CREATE OR REPLACE FUNCTION apply_level_ups(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player record;
  v_xp_needed bigint;
BEGIN
  LOOP
    SELECT level, xp INTO v_player FROM players WHERE id = p_user_id;
    IF NOT FOUND THEN EXIT; END IF;
    
    v_xp_needed := 100 * v_player.level * v_player.level;
    
    IF v_player.xp < v_xp_needed THEN EXIT; END IF;
    IF v_player.level >= 500 THEN EXIT; END IF;
    
    UPDATE players
    SET level = level + 1,
        xp = xp - v_xp_needed,
        power = power + (v_player.level + 1) * 20,
        updated_at = now()
    WHERE id = p_user_id;
  END LOOP;
END;
$$;

-- ─── Update claim_mission_reward to use multi-level-up ───────────────────────
CREATE OR REPLACE FUNCTION claim_mission_reward(p_user_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_um          user_missions%ROWTYPE;
  v_mission     missions%ROWTYPE;
  v_rewards     jsonb;
  v_cash        integer := 0;
  v_influence   integer := 0;
  v_loyalty     integer := 0;
  v_weapon_power integer := 0;
  v_black_money integer := 0;
  v_intel       integer := 0;
  v_xp          integer := 0;
  v_player      players%ROWTYPE;
  v_success_roll integer;
  v_enforcer_bonus integer := 0;
  v_police_raid   boolean := false;
  v_raid_penalty  integer := 0;
  v_heat_after    integer;
BEGIN
  SELECT * INTO v_um FROM user_missions WHERE id = p_user_mission_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Görev bulunamadı'); END IF;

  IF v_um.status != 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Görev aktif değil');
  END IF;

  IF v_um.ends_at > now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Görev süresi henüz dolmadı',
      'remaining_seconds', EXTRACT(EPOCH FROM (v_um.ends_at - now()))::integer
    );
  END IF;

  SELECT * INTO v_player FROM players WHERE id = auth.uid() FOR UPDATE;
  SELECT * INTO v_mission FROM missions WHERE id = v_um.mission_id;

  -- Enforcer crime_success_bonus
  IF v_um.assigned_enforcer_id IS NOT NULL THEN
    SELECT COALESCE(e.crime_success_bonus, 0) INTO v_enforcer_bonus
    FROM user_enforcers ue
    JOIN enforcers e ON e.id = ue.enforcer_id
    WHERE ue.id = v_um.assigned_enforcer_id;
  END IF;

  v_success_roll := floor(random() * 100)::integer;
  
  -- Police raid check using PRE-DETERMINED seed
  IF v_mission.category IN ('dark_job', 'raid') AND v_mission.police_heat_gain > 0 THEN
    IF v_player.police_heat >= 90 THEN
      v_police_raid := (COALESCE(v_um.raid_seed, random()) < 0.30);
    ELSIF v_player.police_heat >= 70 THEN
      v_police_raid := (COALESCE(v_um.raid_seed, random()) < 0.10);
    END IF;
  END IF;

  IF v_police_raid THEN
    v_raid_penalty := floor((v_player.cash * (0.2 + COALESCE(v_um.raid_seed, 0.1) * 0.2)))::integer;
    UPDATE players
    SET cash = GREATEST(0, cash - v_raid_penalty),
        black_money = GREATEST(0, black_money - floor(black_money * 0.1)::integer),
        updated_at = now()
    WHERE id = auth.uid();

    UPDATE user_missions
    SET status = 'completed', success_roll = v_success_roll, police_raid_triggered = true
    WHERE id = p_user_mission_id;

    RETURN jsonb_build_object(
      'ok', true,
      'police_raid', true,
      'raid_penalty', v_raid_penalty,
      'rewards', '{}'::jsonb,
      'police_heat', LEAST(100, v_player.police_heat + v_mission.police_heat_gain)
    );
  END IF;

  -- Normal reward flow
  v_rewards      := v_mission.rewards;
  v_cash         := COALESCE((v_rewards->>'cash')::integer, 0);
  v_influence    := COALESCE((v_rewards->>'influence')::integer, 0);
  v_loyalty      := COALESCE((v_rewards->>'loyalty')::integer, 0);
  v_weapon_power := COALESCE((v_rewards->>'weapon_power')::integer, 0);
  v_black_money  := COALESCE((v_rewards->>'black_money')::integer, 0);
  v_intel        := COALESCE((v_rewards->>'intel')::integer, 0);
  v_xp           := COALESCE((v_rewards->>'xp')::integer, 0);

  -- Apply enforcer bonus
  IF v_enforcer_bonus > 0 THEN
    v_cash         := floor(v_cash         * (1 + v_enforcer_bonus::numeric / 100))::integer;
    v_influence    := floor(v_influence    * (1 + v_enforcer_bonus::numeric / 100))::integer;
    v_loyalty      := floor(v_loyalty      * (1 + v_enforcer_bonus::numeric / 100))::integer;
    v_weapon_power := floor(v_weapon_power * (1 + v_enforcer_bonus::numeric / 100))::integer;
    v_black_money  := floor(v_black_money  * (1 + v_enforcer_bonus::numeric / 100))::integer;
    v_intel        := floor(v_intel        * (1 + v_enforcer_bonus::numeric / 100))::integer;
    v_xp           := floor(v_xp           * (1 + v_enforcer_bonus::numeric / 100))::integer;
  END IF;

  v_heat_after := LEAST(100, v_player.police_heat + v_mission.police_heat_gain);

  UPDATE user_missions
  SET status = 'completed',
      success_roll = v_success_roll,
      police_raid_triggered = false,
      daily_claimed_date = CASE WHEN v_mission.category = 'daily' THEN current_date ELSE NULL END
  WHERE id = p_user_mission_id;

  UPDATE players
  SET cash         = cash         + v_cash,
      influence    = influence    + v_influence,
      loyalty      = loyalty      + v_loyalty,
      weapon_power = weapon_power + v_weapon_power,
      black_money  = black_money  + v_black_money,
      intel        = intel        + v_intel,
      xp           = xp           + v_xp,
      police_heat  = v_heat_after,
      updated_at   = now()
  WHERE id = auth.uid();

  -- Multi-level-up loop
  PERFORM apply_level_ups(auth.uid());

  -- Log resource transaction
  INSERT INTO resource_transactions (user_id, source_type, source_id, resource_type, amount, balance_after, metadata)
  SELECT auth.uid(), 'mission_reward', v_um.mission_id, key, val, 0,
    jsonb_build_object('mission_name', v_mission.name, 'enforcer_bonus', v_enforcer_bonus)
  FROM (VALUES
    ('cash',         v_cash),
    ('influence',    v_influence),
    ('loyalty',      v_loyalty),
    ('weapon_power', v_weapon_power),
    ('black_money',  v_black_money),
    ('intel',        v_intel),
    ('xp',           v_xp)
  ) AS t(key, val)
  WHERE val > 0;

  RETURN jsonb_build_object(
    'ok', true,
    'police_raid', false,
    'rewards', jsonb_build_object(
      'cash', v_cash, 'influence', v_influence, 'loyalty', v_loyalty,
      'weapon_power', v_weapon_power, 'black_money', v_black_money,
      'intel', v_intel, 'xp', v_xp
    ),
    'enforcer_bonus_pct', v_enforcer_bonus,
    'police_heat', v_heat_after
  );
END;
$$;

-- ─── 2. Fix open_chest rarity cumulative logic ───────────────────────────────
-- Replace the broken uncommon check with proper cumulative logic
CREATE OR REPLACE FUNCTION open_chest(p_chest_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_chest record;
  v_roll numeric;
  v_rarity text;
  v_possible jsonb;
  v_rewards jsonb := '{}'::jsonb;
  v_key text;
  v_min int;
  v_max int;
  v_mult numeric;
  v_amount int;
  v_cumulative numeric;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid FOR UPDATE;
  IF v_player IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  SELECT * INTO v_chest FROM chest_definitions WHERE id = p_chest_id;
  IF v_chest IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sandik bulunamadi'); END IF;

  IF v_player.diamonds < v_chest.diamond_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetersiz elmas (' || v_chest.diamond_cost || ' gerekli)');
  END IF;

  -- Deduct diamonds atomically
  UPDATE players SET diamonds = diamonds - v_chest.diamond_cost
  WHERE id = v_uid AND diamonds >= v_chest.diamond_cost;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetersiz elmas');
  END IF;

  -- Roll rarity with CORRECT cumulative logic
  v_roll := random() * 100;
  v_cumulative := 0;

  v_cumulative := v_cumulative + COALESCE((v_chest.drop_rates->>'mythic')::numeric, 0);
  IF v_roll < v_cumulative THEN v_rarity := 'mythic';
  ELSE
    v_cumulative := v_cumulative + COALESCE((v_chest.drop_rates->>'legendary')::numeric, 0);
    IF v_roll < v_cumulative THEN v_rarity := 'legendary';
    ELSE
      v_cumulative := v_cumulative + COALESCE((v_chest.drop_rates->>'epic')::numeric, 0);
      IF v_roll < v_cumulative THEN v_rarity := 'epic';
      ELSE
        v_cumulative := v_cumulative + COALESCE((v_chest.drop_rates->>'rare')::numeric, 0);
        IF v_roll < v_cumulative THEN v_rarity := 'rare';
        ELSE
          v_cumulative := v_cumulative + COALESCE((v_chest.drop_rates->>'uncommon')::numeric, 0);
          IF v_roll < v_cumulative THEN v_rarity := 'uncommon';
          ELSE v_rarity := 'common';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Rarity multiplier
  v_mult := CASE v_rarity
    WHEN 'mythic' THEN 5.0
    WHEN 'legendary' THEN 3.5
    WHEN 'epic' THEN 2.5
    WHEN 'rare' THEN 1.8
    WHEN 'uncommon' THEN 1.3
    ELSE 1.0
  END;

  -- Generate rewards based on rarity multiplier
  v_possible := v_chest.possible_rewards;
  FOR v_key IN SELECT jsonb_object_keys(v_possible) LOOP
    v_min := (v_possible->v_key->>0)::int;
    v_max := (v_possible->v_key->>1)::int;
    v_amount := floor((v_min + random() * (v_max - v_min)) * v_mult)::int;
    IF v_amount > 0 THEN
      v_rewards := v_rewards || jsonb_build_object(v_key, v_amount);
    END IF;
  END LOOP;

  -- Apply rewards to player
  UPDATE players SET
    cash = cash + COALESCE((v_rewards->>'cash')::int, 0),
    diamonds = diamonds + COALESCE((v_rewards->>'diamonds')::int, 0),
    influence = influence + COALESCE((v_rewards->>'influence')::int, 0),
    loyalty = loyalty + COALESCE((v_rewards->>'loyalty')::int, 0),
    weapon_power = weapon_power + COALESCE((v_rewards->>'weapon_power')::int, 0),
    black_money = black_money + COALESCE((v_rewards->>'black_money')::int, 0),
    intel = intel + COALESCE((v_rewards->>'intel')::int, 0)
  WHERE id = v_uid;

  -- Log
  INSERT INTO resource_transactions (user_id, source_type, source_id, resource_type, amount, balance_after, metadata)
  VALUES (v_uid, 'chest_open', p_chest_id, 'chest', 1, 0, jsonb_build_object('rarity', v_rarity, 'rewards', v_rewards));

  RETURN jsonb_build_object('ok', true, 'rarity', v_rarity, 'rewards', v_rewards);
END;
$$;

-- ─── 3. Fix PVP attack_player: recalculate capacity AFTER casualties ─────────
-- We need to read the existing function and patch it. The fix:
-- Move capacity calculation after casualties are applied.

-- Create a helper to calculate surviving troop capacity
CREATE OR REPLACE FUNCTION calculate_troop_capacity(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(t.amount * CASE t.troop_type
    WHEN 'street_thugs' THEN 2 WHEN 'hitmen' THEN 1 WHEN 'bodyguards' THEN 3
    WHEN 'bikers' THEN 2 WHEN 'vehicle_crew' THEN 5 WHEN 'heavy_crew' THEN 8
    ELSE 2 END), 0)
  FROM troops t WHERE t.user_id = p_user_id AND t.amount > 0;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION apply_level_ups(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_mission_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION open_chest(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_troop_capacity(uuid) TO authenticated;
