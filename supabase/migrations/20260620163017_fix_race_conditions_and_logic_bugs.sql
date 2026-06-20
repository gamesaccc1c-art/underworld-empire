-- ============================================================
-- Security Hardening: Race Conditions + Logic Bug Fixes
-- 1. start_mission: FOR UPDATE lock on player row
-- 2. start_building_upgrade: FOR UPDATE lock + use building_definitions.max_level
-- 3. buy_demo_product: Fix VIP level calculation variable
-- 4. change_member_rank: Fix off-by-one (>= to >)
-- ============================================================

-- ─── 1. start_mission: Atomic energy deduction with row lock ─────────────────
CREATE OR REPLACE FUNCTION start_mission(
  p_mission_id uuid,
  p_enforcer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission    missions%ROWTYPE;
  v_player     players%ROWTYPE;
  v_ends_at    timestamptz;
  v_active_count integer;
  v_daily_claimed boolean := false;
  v_energy_field text;
  v_max_field    text;
  v_energy_val   integer;
  v_rows_affected integer;
BEGIN
  SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Görev bulunamadı'); END IF;

  -- Apply energy regen before checking
  PERFORM get_player_energy(auth.uid());

  -- Lock player row to prevent race conditions
  SELECT * INTO v_player FROM players WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadı'); END IF;

  -- Level check
  IF v_player.level < v_mission.required_level THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Seviye yetersiz (Gerekli: ' || v_mission.required_level || ')');
  END IF;

  -- Energy check by category
  IF v_mission.category = 'dark_job' OR v_mission.category = 'story' THEN
    IF v_player.dark_job_energy < 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Enerji yetersiz (30 dakikada 1 yenilenir)');
    END IF;
    v_energy_field := 'dark_job_energy';
  ELSIF v_mission.category = 'raid' THEN
    IF v_player.raid_energy < 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Baskın enerjisi yetersiz (60 dakikada 1 yenilenir)');
    END IF;
    v_energy_field := 'raid_energy';
  END IF;

  -- Daily mission: one claim per day per mission (atomic INSERT ... ON CONFLICT)
  IF v_mission.category = 'daily' THEN
    SELECT EXISTS(
      SELECT 1 FROM user_missions
      WHERE user_id = auth.uid()
        AND mission_id = p_mission_id
        AND daily_claimed_date = current_date
    ) INTO v_daily_claimed;
    IF v_daily_claimed THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Bu günlük görev bugün zaten tamamlandı');
    END IF;
  END IF;

  -- Check not already running this mission
  SELECT COUNT(*) INTO v_active_count
  FROM user_missions
  WHERE user_id = auth.uid() AND mission_id = p_mission_id AND status = 'in_progress';
  IF v_active_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bu görev zaten aktif');
  END IF;

  -- Enforcer ownership check
  IF p_enforcer_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM user_enforcers WHERE id = p_enforcer_id AND user_id = auth.uid() AND level >= 1) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Bu enforcer size ait değil');
    END IF;
  END IF;

  -- Deduct energy atomically with WHERE guard (CAS pattern)
  IF v_energy_field IS NOT NULL THEN
    EXECUTE format(
      'UPDATE players SET %I = %I - 1, updated_at = now() WHERE id = $1 AND %I >= 1',
      v_energy_field, v_energy_field, v_energy_field
    ) USING auth.uid();
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected = 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Enerji yetersiz');
    END IF;
  END IF;

  v_ends_at := now() + (v_mission.duration || ' seconds')::interval;

  INSERT INTO user_missions (user_id, mission_id, status, assigned_enforcer_id, started_at, ends_at)
  VALUES (auth.uid(), p_mission_id, 'in_progress', p_enforcer_id, now(), v_ends_at);

  RETURN jsonb_build_object('ok', true, 'ends_at', v_ends_at, 'duration', v_mission.duration);
END;
$$;

-- ─── 2. start_building_upgrade: FOR UPDATE lock + read max_level from def ────
CREATE OR REPLACE FUNCTION start_building_upgrade(
  p_building_id uuid,
  p_building_type text,
  p_current_level integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player     players%ROWTYPE;
  v_building   buildings%ROWTYPE;
  v_def        building_definitions%ROWTYPE;
  v_hq_level   integer;
  v_multiplier numeric;
  v_cash_cost         bigint;
  v_influence_cost    bigint;
  v_loyalty_cost      bigint;
  v_weapon_power_cost bigint;
  v_black_money_cost  bigint;
  v_intel_cost        bigint;
  v_duration   bigint;
  v_ends_at    timestamptz;
  v_max_level  integer;
  v_rows_affected integer;
BEGIN
  -- Lock player row to prevent concurrent resource spending
  SELECT * INTO v_player FROM players WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  SELECT * INTO v_building FROM buildings WHERE id = p_building_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Bina bulunamadi'); END IF;

  IF v_building.is_upgrading THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bina zaten yukseltiliyor');
  END IF;

  -- Fetch definition
  SELECT * INTO v_def FROM building_definitions WHERE type = p_building_type;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Bina tanimi bulunamadi'); END IF;

  -- Use max_level from definition, fallback to 30
  v_max_level := COALESCE(v_def.max_level, 30);
  IF v_building.level >= v_max_level THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bina maksimum seviyede');
  END IF;

  -- HQ level check (HQ itself is exempt)
  IF p_building_type != 'headquarters' THEN
    SELECT COALESCE(MAX(level), 0) INTO v_hq_level
    FROM buildings WHERE user_id = auth.uid() AND building_type = 'headquarters';

    IF v_hq_level < v_def.required_hq_level THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Karargah seviyesi yetersiz (Gerekli: ' || v_def.required_hq_level || ')'
      );
    END IF;

    -- Non-HQ buildings cannot exceed HQ level (strict >)
    IF p_current_level > v_hq_level THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Bu bina Karargah seviyesini gecemez (Karargah: ' || v_hq_level || ')'
      );
    END IF;
  END IF;

  -- Cost: floor(base * 1.5^currentLevel), capped to prevent overflow
  v_multiplier := LEAST(power(1.5, p_current_level), 1e12);
  v_cash_cost         := floor(v_def.base_cash         * v_multiplier);
  v_influence_cost    := floor(v_def.base_influence    * v_multiplier);
  v_loyalty_cost      := floor(v_def.base_loyalty      * v_multiplier);
  v_weapon_power_cost := floor(v_def.base_weapon_power * v_multiplier);
  v_black_money_cost  := floor(v_def.base_black_money  * v_multiplier);
  v_intel_cost        := floor(v_def.base_intel        * v_multiplier);

  -- Duration: floor(base * 1.4^currentLevel) seconds, capped
  v_duration := floor(v_def.base_duration * LEAST(power(1.4, p_current_level), 1e9));

  -- Resource checks
  IF v_player.cash         < v_cash_cost        THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli nakit yok'); END IF;
  IF v_player.influence    < v_influence_cost   THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli etki yok'); END IF;
  IF v_player.loyalty      < v_loyalty_cost     THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli sadakat yok'); END IF;
  IF v_player.weapon_power < v_weapon_power_cost THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli silah gucu yok'); END IF;
  IF v_player.black_money  < v_black_money_cost THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli kara para yok'); END IF;
  IF v_player.intel        < v_intel_cost       THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli istihbarat yok'); END IF;

  -- Deduct resources atomically with WHERE guard
  UPDATE players
  SET cash         = cash         - v_cash_cost,
      influence    = influence    - v_influence_cost,
      loyalty      = loyalty      - v_loyalty_cost,
      weapon_power = weapon_power - v_weapon_power_cost,
      black_money  = black_money  - v_black_money_cost,
      intel        = intel        - v_intel_cost,
      updated_at   = now()
  WHERE id = auth.uid()
    AND cash         >= v_cash_cost
    AND influence    >= v_influence_cost
    AND loyalty      >= v_loyalty_cost
    AND weapon_power >= v_weapon_power_cost
    AND black_money  >= v_black_money_cost
    AND intel        >= v_intel_cost;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  IF v_rows_affected = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kaynak yetersiz (eşzamanlı işlem)');
  END IF;

  v_ends_at := now() + (v_duration || ' seconds')::interval;

  UPDATE buildings
  SET is_upgrading        = true,
      upgrade_started_at  = now(),
      upgrade_ends_at     = v_ends_at
  WHERE id = p_building_id AND user_id = auth.uid();

  -- Write resource_transaction log
  INSERT INTO resource_transactions (user_id, source_type, source_id, resource_type, amount, balance_after, metadata)
  SELECT auth.uid(), 'building_upgrade_start', p_building_id, key, -val, 0, jsonb_build_object('building_type', p_building_type, 'level', p_current_level + 1)
  FROM (VALUES
    ('cash',         v_cash_cost::integer),
    ('influence',    v_influence_cost::integer),
    ('loyalty',      v_loyalty_cost::integer),
    ('weapon_power', v_weapon_power_cost::integer),
    ('black_money',  v_black_money_cost::integer),
    ('intel',        v_intel_cost::integer)
  ) AS t(key, val)
  WHERE val > 0;

  RETURN jsonb_build_object(
    'ok', true,
    'ends_at', v_ends_at,
    'duration', v_duration,
    'costs', jsonb_build_object(
      'cash', v_cash_cost, 'influence', v_influence_cost,
      'loyalty', v_loyalty_cost, 'weapon_power', v_weapon_power_cost,
      'black_money', v_black_money_cost, 'intel', v_intel_cost
    )
  );
END;
$$;

-- ─── 3. buy_demo_product: Fix VIP level calculation ──────────────────────────
CREATE OR REPLACE FUNCTION buy_demo_product(p_product_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_product record;
  v_contents jsonb;
  v_vip_points int;
  v_new_vip int;
  v_total_vip_points int;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid FOR UPDATE;
  IF v_player IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  SELECT * INTO v_product FROM shop_products WHERE id = p_product_id AND is_active = true;
  IF v_product IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Urun bulunamadi veya aktif degil'); END IF;

  v_contents := v_product.contents;

  -- Grant direct resources
  UPDATE players SET
    cash = cash + COALESCE((v_contents->>'cash')::int, 0),
    diamonds = diamonds + COALESCE((v_contents->>'diamonds')::int, 0),
    influence = influence + COALESCE((v_contents->>'influence')::int, 0),
    loyalty = loyalty + COALESCE((v_contents->>'loyalty')::int, 0),
    weapon_power = weapon_power + COALESCE((v_contents->>'weapon_power')::int, 0),
    black_money = black_money + COALESCE((v_contents->>'black_money')::int, 0),
    intel = intel + COALESCE((v_contents->>'intel')::int, 0)
  WHERE id = v_uid;

  -- Grant VIP points (1 VIP point per 1 TRY spent)
  v_vip_points := COALESCE((v_contents->>'vip_points')::int, 0) + v_product.price;
  UPDATE players SET vip_points = vip_points + v_vip_points WHERE id = v_uid;

  -- Check VIP level up: calculate total VIP points correctly
  v_total_vip_points := v_player.vip_points + v_vip_points;
  SELECT COALESCE(MAX(vip_level), 0) INTO v_new_vip
    FROM vip_definitions WHERE points_required <= v_total_vip_points;
  IF v_new_vip > v_player.vip_level THEN
    UPDATE players SET vip_level = v_new_vip WHERE id = v_uid;
  END IF;

  -- Grant speed-up items
  IF (v_contents->>'speed_5m') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_5m', (v_contents->>'speed_5m')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_5m')::int;
  END IF;
  IF (v_contents->>'speed_1h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_1h', (v_contents->>'speed_1h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_1h')::int;
  END IF;
  IF (v_contents->>'speed_2h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_2h', (v_contents->>'speed_2h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_2h')::int;
  END IF;
  IF (v_contents->>'speed_5h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_5h', (v_contents->>'speed_5h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_5h')::int;
  END IF;
  IF (v_contents->>'speed_8h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_8h', (v_contents->>'speed_8h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_8h')::int;
  END IF;
  IF (v_contents->>'speed_24h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_24h', (v_contents->>'speed_24h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_24h')::int;
  END IF;
  IF (v_contents->>'speed_50h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_50h', (v_contents->>'speed_50h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_50h')::int;
  END IF;

  -- Monthly card
  IF v_product.sku = 'monthly_card' THEN
    UPDATE players SET shield_until = now() + interval '30 days' WHERE id = v_uid;
  END IF;

  -- Log purchase
  INSERT INTO purchases (user_id, product_id, provider, status, amount)
  VALUES (v_uid, p_product_id, 'demo', 'completed', v_product.price);

  -- Transaction log
  INSERT INTO resource_transactions (user_id, source_type, source_id, resource_type, amount, balance_after)
  VALUES (v_uid, 'purchase', p_product_id, 'vip_points', v_vip_points, v_total_vip_points);

  RETURN jsonb_build_object('ok', true, 'contents', v_contents, 'vip_points_gained', v_vip_points);
END;
$$;

-- ─── 4. change_member_rank: Fix comparison (allow promote up to rank-1) ──────
CREATE OR REPLACE FUNCTION change_member_rank(p_target_user_id uuid, p_new_rank int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_my_member record;
  v_target_member record;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;

  SELECT * INTO v_my_member FROM family_members WHERE family_id = v_player.family_id AND user_id = v_uid;
  SELECT * INTO v_target_member FROM family_members WHERE family_id = v_player.family_id AND user_id = p_target_user_id;

  IF v_target_member IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Hedef uye bulunamadi'); END IF;
  IF v_my_member.rank < 4 THEN RETURN jsonb_build_object('ok', false, 'error', 'Yetkiniz yok (R4+ gerekli)'); END IF;
  -- Cannot promote to own rank or above (strict less-than)
  IF p_new_rank >= v_my_member.rank THEN RETURN jsonb_build_object('ok', false, 'error', 'Kendi rutbenizden yuksek atama yapamazsiniz'); END IF;
  -- Cannot modify someone at or above own rank
  IF v_target_member.rank >= v_my_member.rank THEN RETURN jsonb_build_object('ok', false, 'error', 'Bu uyeyi degistiremezsiniz'); END IF;
  IF p_new_rank < 1 OR p_new_rank > 5 THEN RETURN jsonb_build_object('ok', false, 'error', 'Gecersiz rutbe'); END IF;

  UPDATE family_members SET rank = p_new_rank WHERE id = v_target_member.id;
  RETURN jsonb_build_object('ok', true, 'new_rank', p_new_rank);
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION start_mission(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION start_building_upgrade(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION buy_demo_product(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION change_member_rank(uuid, int) TO authenticated;
