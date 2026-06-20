
-- ============================================================
-- Production Security Hardening
-- 1. Lock players table: only username + avatar_url directly updatable
-- 2. Block all client access to suspicious_activity
-- 3. Create _log_suspicious helper (SECURITY DEFINER)
-- 4. Create _log_tx helper if missing
-- ============================================================

-- ─── Step 1: Column-level security on players ───────────────────────────────
-- Revoke blanket UPDATE, then re-grant only the safe profile columns
REVOKE UPDATE ON players FROM authenticated;
GRANT UPDATE (username, avatar_url, updated_at) ON players TO authenticated;

-- Ensure the RLS policy is also in place (idempotent)
DROP POLICY IF EXISTS "update_own_player_safe_fields" ON players;
CREATE POLICY "update_own_player_safe_fields" ON players FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── Step 2: Lock suspicious_activity — no client reads/writes ──────────────
DROP POLICY IF EXISTS "no_client_select_suspicious" ON suspicious_activity;
DROP POLICY IF EXISTS "no_client_insert_suspicious" ON suspicious_activity;
DROP POLICY IF EXISTS "no_client_update_suspicious" ON suspicious_activity;
DROP POLICY IF EXISTS "no_client_delete_suspicious" ON suspicious_activity;

-- Block all access from authenticated users (service role can still write)
CREATE POLICY "no_client_select_suspicious" ON suspicious_activity FOR SELECT
  TO authenticated USING (false);
CREATE POLICY "no_client_insert_suspicious" ON suspicious_activity FOR INSERT
  TO authenticated WITH CHECK (false);
CREATE POLICY "no_client_update_suspicious" ON suspicious_activity FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no_client_delete_suspicious" ON suspicious_activity FOR DELETE
  TO authenticated USING (false);

-- ─── Step 3: _log_suspicious helper ─────────────────────────────────────────
-- Uses activity_type (matches actual column name in suspicious_activity table)
CREATE OR REPLACE FUNCTION _log_suspicious(
  p_activity_type text,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO suspicious_activity (user_id, activity_type, severity, description, payload)
  VALUES (
    auth.uid(),
    p_activity_type,
    COALESCE(p_details->>'severity', 'medium'),
    COALESCE(p_details->>'description', p_activity_type),
    p_details
  );
EXCEPTION WHEN OTHERS THEN
  -- Never let logging failure break the calling function
  NULL;
END;
$$;

-- ─── Step 4: Ensure resource_transactions table exists (idempotent) ──────────
-- Already created in city_building_system migration; this is a no-op if it exists
CREATE TABLE IF NOT EXISTS resource_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_id uuid,
  resource_type text NOT NULL,
  amount integer NOT NULL,
  balance_after integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resource_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON resource_transactions;
CREATE POLICY "select_own_transactions" ON resource_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "no_insert_transactions" ON resource_transactions;
CREATE POLICY "no_insert_transactions" ON resource_transactions FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "no_update_transactions" ON resource_transactions;
CREATE POLICY "no_update_transactions" ON resource_transactions FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "no_delete_transactions" ON resource_transactions;
CREATE POLICY "no_delete_transactions" ON resource_transactions FOR DELETE
  TO authenticated USING (false);

-- ─── Step 5: Add suspicious logging to key RPCs ──────────────────────────────

-- Hardened open_chest: logs invalid chest type + insufficient diamonds
CREATE OR REPLACE FUNCTION open_chest(p_chest_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_cost integer;
  v_roll float;
  v_rarity text;
  v_enforcer_key text;
  v_enforcer_id uuid;
  v_shard_gain integer := 1;
  v_current_shards integer := 0;
  v_new_shards integer;
  v_unlocked boolean := false;
  v_existing_unlock uuid;
  SHARD_UNLOCK_COST constant integer := 20;
BEGIN
  v_cost := CASE p_chest_type
    WHEN 'bronze' THEN 50
    WHEN 'silver' THEN 150
    WHEN 'gold'   THEN 400
    ELSE NULL
  END;

  IF v_cost IS NULL THEN
    PERFORM _log_suspicious('invalid_chest_type', jsonb_build_object(
      'severity', 'high',
      'description', 'Invalid chest type attempted',
      'chest_type', p_chest_type
    ));
    RETURN jsonb_build_object('ok', false, 'error', 'Gecersiz sandik tipi');
  END IF;

  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  IF v_player.diamonds < v_cost THEN
    PERFORM _log_suspicious('insufficient_diamonds_chest', jsonb_build_object(
      'severity', 'low',
      'description', 'Chest open attempted with insufficient diamonds',
      'chest_type', p_chest_type,
      'required', v_cost,
      'have', v_player.diamonds
    ));
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli elmas yok');
  END IF;

  UPDATE players SET diamonds = diamonds - v_cost, updated_at = now() WHERE id = auth.uid();

  INSERT INTO resource_transactions (user_id, source_type, source_id, resource_type, amount, balance_after)
  VALUES (auth.uid(), 'chest_open', NULL, 'diamonds', -v_cost, v_player.diamonds - v_cost);

  v_roll := random() * 100;
  v_rarity := CASE p_chest_type
    WHEN 'bronze' THEN
      CASE
        WHEN v_roll < 0.5  THEN 'mythic'
        WHEN v_roll < 1.5  THEN 'legendary'
        WHEN v_roll < 6.5  THEN 'rare'
        WHEN v_roll < 31.5 THEN 'uncommon'
        ELSE 'common'
      END
    WHEN 'silver' THEN
      CASE
        WHEN v_roll < 0.5  THEN 'mythic'
        WHEN v_roll < 1.5  THEN 'legendary'
        WHEN v_roll < 10.5 THEN 'epic'
        WHEN v_roll < 40.5 THEN 'rare'
        WHEN v_roll < 80.5 THEN 'uncommon'
        ELSE 'common'
      END
    WHEN 'gold' THEN
      CASE
        WHEN v_roll < 2    THEN 'mythic'
        WHEN v_roll < 20   THEN 'legendary'
        WHEN v_roll < 60   THEN 'epic'
        WHEN v_roll < 90   THEN 'rare'
        ELSE 'uncommon'
      END
    ELSE 'common'
  END;

  SELECT id, key INTO v_enforcer_id, v_enforcer_key
  FROM enforcers WHERE rarity = v_rarity ORDER BY random() LIMIT 1;

  IF v_enforcer_id IS NULL THEN
    SELECT id, key INTO v_enforcer_id, v_enforcer_key FROM enforcers WHERE rarity = 'common' ORDER BY random() LIMIT 1;
  END IF;

  SELECT id INTO v_existing_unlock FROM user_enforcers WHERE user_id = auth.uid() AND enforcer_id = v_enforcer_id;

  IF v_existing_unlock IS NOT NULL THEN
    v_shard_gain := 5;
    v_new_shards := v_shard_gain;
    UPDATE user_enforcers SET shards = shards + v_shard_gain WHERE id = v_existing_unlock;
  ELSE
    INSERT INTO user_enforcers (user_id, enforcer_id, level, stars, shards)
    VALUES (auth.uid(), v_enforcer_id, 0, 0, 1)
    ON CONFLICT DO NOTHING;

    SELECT shards INTO v_current_shards FROM user_enforcers
    WHERE user_id = auth.uid() AND enforcer_id = v_enforcer_id;
    IF v_current_shards IS NULL THEN v_current_shards := 0; END IF;
    v_new_shards := v_current_shards + 1;

    IF v_new_shards >= SHARD_UNLOCK_COST THEN
      UPDATE user_enforcers
      SET level = 1, stars = 1, shards = v_new_shards - SHARD_UNLOCK_COST
      WHERE user_id = auth.uid() AND enforcer_id = v_enforcer_id;
      v_unlocked := true;
      UPDATE players SET xp = xp + 500, updated_at = now() WHERE id = auth.uid();
    ELSE
      UPDATE user_enforcers SET shards = v_new_shards
      WHERE user_id = auth.uid() AND enforcer_id = v_enforcer_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'enforcer_key', v_enforcer_key,
    'rarity', v_rarity,
    'unlocked', v_unlocked,
    'shards', v_new_shards,
    'shard_gain', v_shard_gain
  );
END;
$$;

-- Hardened claim_mission_reward: logs early claim attempts
CREATE OR REPLACE FUNCTION claim_mission_reward(p_user_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_um user_missions%ROWTYPE;
  v_mission missions%ROWTYPE;
  v_rewards jsonb;
  v_cash integer := 0;
  v_influence integer := 0;
  v_loyalty integer := 0;
  v_weapon_power integer := 0;
  v_black_money integer := 0;
  v_intel integer := 0;
  v_xp integer := 0;
BEGIN
  SELECT * INTO v_um FROM user_missions WHERE id = p_user_mission_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    PERFORM _log_suspicious('unauthorized_mission_claim', jsonb_build_object(
      'severity', 'high',
      'description', 'Mission claim attempted for foreign or nonexistent mission',
      'user_mission_id', p_user_mission_id
    ));
    RETURN jsonb_build_object('ok', false, 'error', 'Gorev bulunamadi');
  END IF;

  IF v_um.status != 'in_progress' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Gorev aktif degil');
  END IF;

  IF v_um.ends_at > now() THEN
    PERFORM _log_suspicious('early_mission_claim', jsonb_build_object(
      'severity', 'medium',
      'description', 'Early mission claim attempt before timer elapsed',
      'user_mission_id', p_user_mission_id,
      'ends_at', v_um.ends_at,
      'seconds_remaining', EXTRACT(EPOCH FROM (v_um.ends_at - now()))::integer
    ));
    RETURN jsonb_build_object('ok', false, 'error', 'Gorev suresi dolmadi', 'ends_at', v_um.ends_at);
  END IF;

  SELECT * INTO v_mission FROM missions WHERE id = v_um.mission_id;

  v_rewards      := v_mission.rewards;
  v_cash         := COALESCE((v_rewards->>'cash')::integer, 0);
  v_influence    := COALESCE((v_rewards->>'influence')::integer, 0);
  v_loyalty      := COALESCE((v_rewards->>'loyalty')::integer, 0);
  v_weapon_power := COALESCE((v_rewards->>'weapon_power')::integer, 0);
  v_black_money  := COALESCE((v_rewards->>'black_money')::integer, 0);
  v_intel        := COALESCE((v_rewards->>'intel')::integer, 0);
  v_xp           := COALESCE((v_rewards->>'xp')::integer, 0);

  UPDATE user_missions SET status = 'completed' WHERE id = p_user_mission_id;

  UPDATE players
  SET cash         = cash         + v_cash,
      influence    = influence    + v_influence,
      loyalty      = loyalty      + v_loyalty,
      weapon_power = weapon_power + v_weapon_power,
      black_money  = black_money  + v_black_money,
      intel        = intel        + v_intel,
      xp           = xp           + v_xp,
      police_heat  = LEAST(100, police_heat + v_mission.police_heat_gain),
      updated_at   = now()
  WHERE id = auth.uid();

  UPDATE players
  SET level = level + 1, xp = xp - (100 * level * level), power = power + level * 20, updated_at = now()
  WHERE id = auth.uid() AND xp >= (100 * level * level);

  INSERT INTO resource_transactions (user_id, source_type, source_id, resource_type, amount, balance_after)
  SELECT auth.uid(), 'mission_reward', p_user_mission_id, key, val, 0
  FROM (VALUES
    ('cash', v_cash), ('influence', v_influence), ('loyalty', v_loyalty),
    ('weapon_power', v_weapon_power), ('black_money', v_black_money),
    ('intel', v_intel), ('xp', v_xp)
  ) AS t(key, val)
  WHERE val > 0;

  RETURN jsonb_build_object('ok', true, 'rewards', v_rewards);
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION _log_suspicious(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION open_chest(text) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_mission_reward(uuid) TO authenticated;
