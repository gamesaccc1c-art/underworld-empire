-- Fix PVP: Use surviving troop capacity for loot calculation
-- The attack_player function calculates v_total_capacity at line 289 BEFORE
-- casualties. We patch the loot section to recalculate capacity after casualties.

CREATE OR REPLACE FUNCTION attack_player(p_target_id uuid, p_battle_type text DEFAULT 'raid')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attacker players%ROWTYPE;
  v_defender players%ROWTYPE;
  v_attacker_power integer := 0;
  v_defender_power integer := 0;
  v_attacker_troop_power integer := 0;
  v_defender_troop_power integer := 0;
  v_attacker_research integer := 0;
  v_defender_research integer := 0;
  v_attacker_vip integer := 0;
  v_defender_vip integer := 0;
  v_wall_bonus integer := 0;
  v_variance float;
  v_result text;
  v_power_ratio float;
  v_casualty_rate float;
  v_attacker_casualties jsonb := '{}';
  v_defender_casualties jsonb := '{}';
  v_attacker_wounded jsonb := '{}';
  v_defender_wounded jsonb := '{}';
  v_loot jsonb := '{}';
  v_total_capacity integer := 0;
  v_loot_cash integer := 0;
  v_loot_bm integer := 0;
  v_loot_wp integer := 0;
  v_protected_cash integer;
  v_protected_bm integer;
  v_protected_wp integer;
  v_hq_level integer := 0;
  v_battle_id uuid;
  v_report_id uuid;
  v_troop record;
BEGIN
  -- Validate
  SELECT * INTO v_attacker FROM players WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  IF p_target_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kendine saldiramazsin');
  END IF;

  SELECT * INTO v_defender FROM players WHERE id = p_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Hedef bulunamadi'); END IF;

  IF v_defender.shield_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hedef kalkan altinda');
  END IF;

  -- Check attacker has troops
  IF NOT EXISTS (SELECT 1 FROM troops WHERE user_id = auth.uid() AND amount > 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Asker yok');
  END IF;

  -- Cooldown check (5 min between attacks on same target)
  IF EXISTS (
    SELECT 1 FROM battles
    WHERE attacker_id = auth.uid() AND defender_id = p_target_id
      AND created_at > now() - interval '5 minutes'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bu hedefe tekrar saldirmak icin bekleyin');
  END IF;

  -- ─── Calculate attacker power ─────────────────────────────────────────────
  SELECT COALESCE(SUM(t.amount * CASE t.troop_type
    WHEN 'street_thugs' THEN 5 WHEN 'hitmen' THEN 10 WHEN 'bodyguards' THEN 40
    WHEN 'bikers' THEN 15 WHEN 'vehicle_crew' THEN 30 WHEN 'heavy_crew' THEN 50
    ELSE 10 END), 0) INTO v_attacker_troop_power
  FROM troops t WHERE t.user_id = auth.uid() AND t.amount > 0;

  -- Attacker research bonus
  SELECT COALESCE(SUM(
    CASE rd.key WHEN 'attack' THEN ur.level * rd.effect_value WHEN 'strategy' THEN ur.level * rd.effect_value ELSE 0 END
  ), 0) INTO v_attacker_research
  FROM user_research ur
  JOIN research_definitions rd ON rd.id = ur.research_id
  WHERE ur.user_id = auth.uid() AND ur.level > 0;

  -- Attacker VIP bonus
  v_attacker_vip := CASE
    WHEN v_attacker.vip_level >= 8 THEN 10
    WHEN v_attacker.vip_level >= 5 THEN 5
    ELSE 0
  END;

  v_attacker_power := v_attacker_troop_power + FLOOR(v_attacker_troop_power * (v_attacker_research + v_attacker_vip) / 100.0);

  -- ─── Calculate defender power ─────────────────────────────────────────────
  SELECT COALESCE(SUM(t.amount * CASE t.troop_type
    WHEN 'street_thugs' THEN 5 WHEN 'hitmen' THEN 10 WHEN 'bodyguards' THEN 40
    WHEN 'bikers' THEN 15 WHEN 'vehicle_crew' THEN 30 WHEN 'heavy_crew' THEN 50
    ELSE 10 END), 0) INTO v_defender_troop_power
  FROM troops t WHERE t.user_id = p_target_id AND t.amount > 0;

  -- Defense wall bonus
  SELECT COALESCE(level * 50, 0) INTO v_wall_bonus
  FROM buildings WHERE user_id = p_target_id AND building_type = 'defense_wall';

  -- Defender research bonus
  SELECT COALESCE(SUM(
    CASE rd.key WHEN 'defense' THEN ur.level * rd.effect_value WHEN 'spy_resist' THEN ur.level * rd.effect_value ELSE 0 END
  ), 0) INTO v_defender_research
  FROM user_research ur
  JOIN research_definitions rd ON rd.id = ur.research_id
  WHERE ur.user_id = p_target_id AND ur.level > 0;

  -- Defender VIP bonus
  v_defender_vip := CASE
    WHEN v_defender.vip_level >= 5 THEN 5
    ELSE 0
  END;

  v_defender_power := v_defender_troop_power + v_wall_bonus + FLOOR(v_defender_troop_power * (v_defender_research + v_defender_vip) / 100.0);

  -- ─── Apply 5% random variance ─────────────────────────────────────────────
  v_variance := 0.95 + (random() * 0.1);
  v_attacker_power := FLOOR(v_attacker_power * v_variance);
  v_variance := 0.95 + (random() * 0.1);
  v_defender_power := FLOOR(v_defender_power * v_variance);

  -- ─── Determine result ─────────────────────────────────────────────────────
  IF v_attacker_power > v_defender_power THEN
    v_result := 'victory';
  ELSIF v_attacker_power = v_defender_power THEN
    v_result := 'draw';
  ELSE
    v_result := 'defeat';
  END IF;

  -- ─── Calculate casualties ──────────────────────────────────────────────────
  IF v_result = 'victory' THEN
    v_casualty_rate := GREATEST(0.05, LEAST(0.3, (v_defender_power::float / GREATEST(v_attacker_power, 1)) * 0.2));
  ELSIF v_result = 'defeat' THEN
    v_casualty_rate := GREATEST(0.1, LEAST(0.5, (v_attacker_power::float / GREATEST(v_defender_power, 1)) * 0.3));
  ELSE
    v_casualty_rate := 0.15;
  END IF;

  -- Apply casualties to attacker troops (killed = 40%, wounded = 60%)
  FOR v_troop IN SELECT * FROM troops WHERE user_id = auth.uid() AND amount > 0
  LOOP
    DECLARE
      v_lost integer;
      v_killed integer;
      v_wounded_add integer;
    BEGIN
      IF v_result = 'defeat' THEN
        v_lost := CEIL(v_troop.amount * v_casualty_rate);
      ELSE
        v_lost := CEIL(v_troop.amount * v_casualty_rate * 0.5);
      END IF;
      v_killed := CEIL(v_lost * 0.4);
      v_wounded_add := v_lost - v_killed;

      IF v_lost > 0 THEN
        UPDATE troops SET amount = GREATEST(0, amount - v_lost), wounded_amount = wounded_amount + v_wounded_add, updated_at = now()
        WHERE id = v_troop.id;
        v_attacker_casualties := v_attacker_casualties || jsonb_build_object(v_troop.troop_type, v_killed);
        v_attacker_wounded := v_attacker_wounded || jsonb_build_object(v_troop.troop_type, v_wounded_add);
      END IF;
    END;
  END LOOP;

  -- Apply casualties to defender troops
  FOR v_troop IN SELECT * FROM troops WHERE user_id = p_target_id AND amount > 0
  LOOP
    DECLARE
      v_lost integer;
      v_killed integer;
      v_wounded_add integer;
    BEGIN
      IF v_result = 'victory' THEN
        v_lost := CEIL(v_troop.amount * v_casualty_rate);
      ELSE
        v_lost := CEIL(v_troop.amount * v_casualty_rate * 0.5);
      END IF;
      v_killed := CEIL(v_lost * 0.4);
      v_wounded_add := v_lost - v_killed;

      IF v_lost > 0 THEN
        UPDATE troops SET amount = GREATEST(0, amount - v_lost), wounded_amount = wounded_amount + v_wounded_add, updated_at = now()
        WHERE id = v_troop.id;
        v_defender_casualties := v_defender_casualties || jsonb_build_object(v_troop.troop_type, v_killed);
        v_defender_wounded := v_defender_wounded || jsonb_build_object(v_troop.troop_type, v_wounded_add);
      END IF;
    END;
  END LOOP;

  -- ─── Loot calculation (only on victory) ────────────────────────────────────
  IF v_result = 'victory' THEN
    -- FIXED: Calculate capacity AFTER casualties using SURVIVING troops
    v_total_capacity := calculate_troop_capacity(auth.uid())::integer;

    -- Protected resources based on HQ level
    SELECT COALESCE(level, 1) INTO v_hq_level FROM buildings WHERE user_id = p_target_id AND building_type = 'headquarters';
    v_protected_cash := v_hq_level * 2000;
    v_protected_bm   := v_hq_level * 500;
    v_protected_wp   := v_hq_level * 300;

    -- Lootable = (total - protected) / 4, capped by surviving capacity
    v_loot_cash := LEAST(v_total_capacity * 100, GREATEST(0, v_defender.cash - v_protected_cash) / 4);
    v_loot_bm   := LEAST(v_total_capacity * 50,  GREATEST(0, v_defender.black_money - v_protected_bm) / 4);
    v_loot_wp   := LEAST(v_total_capacity * 30,  GREATEST(0, v_defender.weapon_power - v_protected_wp) / 4);

    -- Transfer resources
    IF v_loot_cash > 0 THEN
      UPDATE players SET cash = cash - v_loot_cash WHERE id = p_target_id;
      UPDATE players SET cash = cash + v_loot_cash WHERE id = auth.uid();
    END IF;
    IF v_loot_bm > 0 THEN
      UPDATE players SET black_money = black_money - v_loot_bm WHERE id = p_target_id;
      UPDATE players SET black_money = black_money + v_loot_bm WHERE id = auth.uid();
    END IF;
    IF v_loot_wp > 0 THEN
      UPDATE players SET weapon_power = weapon_power - v_loot_wp WHERE id = p_target_id;
      UPDATE players SET weapon_power = weapon_power + v_loot_wp WHERE id = auth.uid();
    END IF;

    v_loot := jsonb_build_object('cash', v_loot_cash, 'black_money', v_loot_bm, 'weapon_power', v_loot_wp);

    -- XP for attacker
    UPDATE players SET xp = xp + 200, power = power + 50, updated_at = now() WHERE id = auth.uid();
    PERFORM apply_level_ups(auth.uid());
  ELSIF v_result = 'defeat' THEN
    UPDATE players SET xp = xp + 50, updated_at = now() WHERE id = auth.uid();
    PERFORM apply_level_ups(auth.uid());
  END IF;

  -- ─── Save battle + report ──────────────────────────────────────────────────
  INSERT INTO battles (attacker_id, defender_id, attacker_family_id, defender_family_id, battle_type, attacker_power, defender_power, result, loot, casualties)
  VALUES (auth.uid(), p_target_id, v_attacker.family_id, v_defender.family_id, p_battle_type, v_attacker_power, v_defender_power, v_result, v_loot,
    jsonb_build_object('attacker', v_attacker_casualties, 'defender', v_defender_casualties))
  RETURNING id INTO v_battle_id;

  INSERT INTO battle_reports (battle_id, attacker_id, defender_id, result, attacker_power, defender_power, loot, casualties, wounded)
  VALUES (v_battle_id, auth.uid(), p_target_id, v_result, v_attacker_power, v_defender_power, v_loot,
    jsonb_build_object('attacker', v_attacker_casualties, 'defender', v_defender_casualties),
    jsonb_build_object('attacker', v_attacker_wounded, 'defender', v_defender_wounded))
  RETURNING id INTO v_report_id;

  RETURN jsonb_build_object(
    'ok', true,
    'result', v_result,
    'attacker_power', v_attacker_power,
    'defender_power', v_defender_power,
    'casualties', jsonb_build_object('attacker', v_attacker_casualties, 'defender', v_defender_casualties),
    'wounded', jsonb_build_object('attacker', v_attacker_wounded, 'defender', v_defender_wounded),
    'loot', v_loot,
    'battle_id', v_battle_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION attack_player(uuid, text) TO authenticated;
