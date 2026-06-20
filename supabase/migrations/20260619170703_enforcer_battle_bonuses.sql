-- Add enforcer attack/defense bonuses to PvP and NPC battle RPCs

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
  v_attacker_enforcer integer := 0;
  v_defender_enforcer integer := 0;
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
  SELECT * INTO v_attacker FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  IF p_target_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kendine saldiramazsin');
  END IF;

  SELECT * INTO v_defender FROM players WHERE id = p_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Hedef bulunamadi'); END IF;

  IF v_defender.shield_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hedef kalkan altinda');
  END IF;

  IF v_defender.created_at > now() - interval '3 days' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hedef yeni oyuncu korumasinda');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM troops WHERE user_id = auth.uid() AND amount > 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldiri icin birlik gerekli');
  END IF;

  IF v_attacker.raid_energy <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Baskin enerjisi yok');
  END IF;

  UPDATE players SET raid_energy = raid_energy - 1, updated_at = now() WHERE id = auth.uid();

  -- ── Attacker troop power ──────────────────────────────────────────────────
  SELECT COALESCE(SUM(t.amount * CASE t.troop_type
    WHEN 'street_thugs' THEN 10 WHEN 'hitmen' THEN 35 WHEN 'bodyguards' THEN 10
    WHEN 'bikers' THEN 25 WHEN 'vehicle_crew' THEN 40 WHEN 'heavy_crew' THEN 60
    ELSE 10 END), 0) INTO v_attacker_troop_power
  FROM troops t WHERE t.user_id = auth.uid() AND t.amount > 0;

  -- Research bonus (attack)
  SELECT COALESCE(SUM(
    CASE rd.key WHEN 'attack' THEN ur.level * rd.effect_value
                WHEN 'raid_damage' THEN ur.level * rd.effect_value ELSE 0 END
  ), 0) INTO v_attacker_research
  FROM user_research ur JOIN research_definitions rd ON rd.id = ur.research_id
  WHERE ur.user_id = auth.uid() AND ur.level > 0;

  -- Enforcer attack bonus (sum of all unlocked enforcers)
  SELECT COALESCE(SUM(e.attack_bonus * ue.stars), 0) INTO v_attacker_enforcer
  FROM user_enforcers ue JOIN enforcers e ON e.id = ue.enforcer_id
  WHERE ue.user_id = auth.uid() AND ue.stars > 0;

  -- VIP bonus
  v_attacker_vip := CASE WHEN v_attacker.vip_level >= 3 THEN 3 ELSE 0 END;

  -- Loot capacity
  SELECT COALESCE(SUM(t.amount * CASE t.troop_type
    WHEN 'street_thugs' THEN 2 WHEN 'hitmen' THEN 1 WHEN 'bodyguards' THEN 3
    WHEN 'bikers' THEN 2 WHEN 'vehicle_crew' THEN 5 WHEN 'heavy_crew' THEN 8
    ELSE 2 END), 0) INTO v_total_capacity
  FROM troops t WHERE t.user_id = auth.uid() AND t.amount > 0;

  v_attacker_power := v_attacker_troop_power + FLOOR(v_attacker_troop_power * (v_attacker_research + v_attacker_vip + v_attacker_enforcer) / 100.0);

  -- ── Defender troop power ──────────────────────────────────────────────────
  SELECT COALESCE(SUM(t.amount * CASE t.troop_type
    WHEN 'street_thugs' THEN 5 WHEN 'hitmen' THEN 10 WHEN 'bodyguards' THEN 40
    WHEN 'bikers' THEN 15 WHEN 'vehicle_crew' THEN 30 WHEN 'heavy_crew' THEN 50
    ELSE 10 END), 0) INTO v_defender_troop_power
  FROM troops t WHERE t.user_id = p_target_id AND t.amount > 0;

  SELECT COALESCE(level * 50, 0) INTO v_wall_bonus
  FROM buildings WHERE user_id = p_target_id AND building_type = 'defense_wall';

  SELECT COALESCE(SUM(
    CASE rd.key WHEN 'defense' THEN ur.level * rd.effect_value
                WHEN 'spy_resist' THEN ur.level * rd.effect_value ELSE 0 END
  ), 0) INTO v_defender_research
  FROM user_research ur JOIN research_definitions rd ON rd.id = ur.research_id
  WHERE ur.user_id = p_target_id AND ur.level > 0;

  -- Defender enforcer defense bonus
  SELECT COALESCE(SUM(e.defense_bonus * ue.stars), 0) INTO v_defender_enforcer
  FROM user_enforcers ue JOIN enforcers e ON e.id = ue.enforcer_id
  WHERE ue.user_id = p_target_id AND ue.stars > 0;

  v_defender_vip := CASE WHEN v_defender.vip_level >= 5 THEN 5 ELSE 0 END;

  v_defender_power := v_defender_troop_power + v_wall_bonus
    + FLOOR(v_defender_troop_power * (v_defender_research + v_defender_vip + v_defender_enforcer) / 100.0);

  -- Variance ±5%
  v_variance := 0.95 + (random() * 0.1);
  v_attacker_power := FLOOR(v_attacker_power * v_variance);
  v_variance := 0.95 + (random() * 0.1);
  v_defender_power := FLOOR(v_defender_power * v_variance);

  -- Result
  IF v_attacker_power > v_defender_power THEN
    v_result := 'victory';
  ELSIF v_attacker_power = v_defender_power THEN
    v_result := 'draw';
  ELSE
    v_result := 'defeat';
  END IF;

  -- Casualties
  IF v_result = 'victory' THEN
    v_casualty_rate := GREATEST(0.05, LEAST(0.3, (v_defender_power::float / GREATEST(v_attacker_power, 1)) * 0.2));
  ELSIF v_result = 'defeat' THEN
    v_casualty_rate := GREATEST(0.1, LEAST(0.5, (v_attacker_power::float / GREATEST(v_defender_power, 1)) * 0.3));
  ELSE
    v_casualty_rate := 0.15;
  END IF;

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

  -- Loot on victory
  IF v_result = 'victory' THEN
    SELECT COALESCE(level, 1) INTO v_hq_level FROM buildings WHERE user_id = p_target_id AND building_type = 'headquarters';
    v_protected_cash := v_hq_level * 2000;
    v_protected_bm   := v_hq_level * 500;
    v_protected_wp   := v_hq_level * 300;

    v_loot_cash := LEAST(v_total_capacity * 100, GREATEST(0, v_defender.cash - v_protected_cash) / 4);
    v_loot_bm   := LEAST(v_total_capacity * 50,  GREATEST(0, v_defender.black_money - v_protected_bm) / 4);
    v_loot_wp   := LEAST(v_total_capacity * 30,  GREATEST(0, v_defender.weapon_power - v_protected_wp) / 4);

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
    UPDATE players SET xp = xp + 200, power = power + 50, updated_at = now() WHERE id = auth.uid();
  ELSIF v_result = 'defeat' THEN
    UPDATE players SET xp = xp + 50, updated_at = now() WHERE id = auth.uid();
  END IF;

  INSERT INTO battles (attacker_id, defender_id, attacker_family_id, defender_family_id, battle_type, attacker_power, defender_power, result, loot, casualties)
  VALUES (auth.uid(), p_target_id, v_attacker.family_id, v_defender.family_id, p_battle_type, v_attacker_power, v_defender_power, v_result, v_loot,
    jsonb_build_object('attacker', v_attacker_casualties, 'defender', v_defender_casualties))
  RETURNING id INTO v_battle_id;

  INSERT INTO battle_reports (battle_id, attacker_id, defender_id, result, attacker_power, defender_power, casualties, wounded, loot, report_data)
  VALUES (v_battle_id, auth.uid(), p_target_id, v_result, v_attacker_power, v_defender_power,
    jsonb_build_object('attacker', v_attacker_casualties, 'defender', v_defender_casualties),
    jsonb_build_object('attacker', v_attacker_wounded, 'defender', v_defender_wounded),
    v_loot,
    jsonb_build_object(
      'attacker_research_bonus', v_attacker_research,
      'attacker_enforcer_bonus', v_attacker_enforcer,
      'defender_research_bonus', v_defender_research,
      'defender_enforcer_bonus', v_defender_enforcer,
      'attacker_vip_bonus', v_attacker_vip,
      'defender_vip_bonus', v_defender_vip,
      'wall_bonus', v_wall_bonus,
      'capacity', v_total_capacity
    )
  ) RETURNING id INTO v_report_id;

  IF v_result = 'victory' AND v_loot_cash > 0 THEN
    INSERT INTO resource_transactions (user_id, source_type, source_id, resource_type, amount, balance_after, metadata)
    SELECT auth.uid(), 'battle', v_battle_id, 'cash', v_loot_cash, p.cash, jsonb_build_object('battle_type', p_battle_type)
    FROM players p WHERE p.id = auth.uid();
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'result', v_result,
    'attacker_power', v_attacker_power,
    'defender_power', v_defender_power,
    'casualties', jsonb_build_object('attacker', v_attacker_casualties, 'defender', v_defender_casualties),
    'wounded', jsonb_build_object('attacker', v_attacker_wounded, 'defender', v_defender_wounded),
    'loot', v_loot,
    'report_id', v_report_id,
    'bonuses', jsonb_build_object(
      'research', v_attacker_research,
      'enforcer', v_attacker_enforcer,
      'vip', v_attacker_vip,
      'wall', v_wall_bonus
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION attack_player(uuid, text) TO authenticated;

-- Also add enforcer bonus to NPC attack
CREATE OR REPLACE FUNCTION attack_npc(p_npc_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_npc npc_targets%ROWTYPE;
  v_attacker_power integer := 0;
  v_attacker_troop_power integer := 0;
  v_attacker_research integer := 0;
  v_attacker_enforcer integer := 0;
  v_variance float;
  v_result text;
  v_casualty_rate float;
  v_casualties jsonb := '{}';
  v_wounded_total jsonb := '{}';
  v_loot jsonb;
  v_troop record;
  v_battle_id uuid;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  SELECT * INTO v_npc FROM npc_targets WHERE id = p_npc_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Hedef bulunamadi'); END IF;

  IF v_player.level < v_npc.required_level THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli seviye yok (Lv.' || v_npc.required_level || ' gerekli)');
  END IF;

  IF v_player.raid_energy <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Baskin enerjisi yok');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM troops WHERE user_id = auth.uid() AND amount > 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldiri icin birlik gerekli');
  END IF;

  UPDATE players SET raid_energy = raid_energy - 1, updated_at = now() WHERE id = auth.uid();

  SELECT COALESCE(SUM(t.amount * CASE t.troop_type
    WHEN 'street_thugs' THEN 10 WHEN 'hitmen' THEN 35 WHEN 'bodyguards' THEN 10
    WHEN 'bikers' THEN 25 WHEN 'vehicle_crew' THEN 40 WHEN 'heavy_crew' THEN 60
    ELSE 10 END), 0) INTO v_attacker_troop_power
  FROM troops t WHERE t.user_id = auth.uid() AND t.amount > 0;

  SELECT COALESCE(SUM(CASE rd.key
    WHEN 'attack' THEN ur.level * rd.effect_value
    WHEN 'raid_damage' THEN ur.level * rd.effect_value ELSE 0 END), 0)
  INTO v_attacker_research
  FROM user_research ur JOIN research_definitions rd ON rd.id = ur.research_id
  WHERE ur.user_id = auth.uid() AND ur.level > 0;

  -- Enforcer attack bonus
  SELECT COALESCE(SUM(e.attack_bonus * ue.stars), 0) INTO v_attacker_enforcer
  FROM user_enforcers ue JOIN enforcers e ON e.id = ue.enforcer_id
  WHERE ue.user_id = auth.uid() AND ue.stars > 0;

  v_attacker_power := v_attacker_troop_power
    + FLOOR(v_attacker_troop_power * (v_attacker_research + v_attacker_enforcer) / 100.0);

  v_variance := 0.95 + (random() * 0.1);
  v_attacker_power := FLOOR(v_attacker_power * v_variance);

  IF v_attacker_power > v_npc.defense_power THEN
    v_result := 'victory';
    v_casualty_rate := GREATEST(0.02, (v_npc.defense_power::float / GREATEST(v_attacker_power, 1)) * 0.15);
  ELSE
    v_result := 'defeat';
    v_casualty_rate := GREATEST(0.1, LEAST(0.4, 0.25));
  END IF;

  FOR v_troop IN SELECT * FROM troops WHERE user_id = auth.uid() AND amount > 0
  LOOP
    DECLARE v_lost integer; v_killed integer; v_w integer;
    BEGIN
      v_lost := CEIL(v_troop.amount * v_casualty_rate);
      v_killed := CEIL(v_lost * 0.3);
      v_w := v_lost - v_killed;
      IF v_lost > 0 THEN
        UPDATE troops SET amount = GREATEST(0, amount - v_lost), wounded_amount = wounded_amount + v_w, updated_at = now() WHERE id = v_troop.id;
        v_casualties := v_casualties || jsonb_build_object(v_troop.troop_type, v_killed);
        v_wounded_total := v_wounded_total || jsonb_build_object(v_troop.troop_type, v_w);
      END IF;
    END;
  END LOOP;

  v_loot := '{}'::jsonb;
  IF v_result = 'victory' THEN
    v_loot := v_npc.loot;
    IF (v_loot->>'cash') IS NOT NULL THEN UPDATE players SET cash = cash + (v_loot->>'cash')::integer WHERE id = auth.uid(); END IF;
    IF (v_loot->>'black_money') IS NOT NULL THEN UPDATE players SET black_money = black_money + (v_loot->>'black_money')::integer WHERE id = auth.uid(); END IF;
    IF (v_loot->>'weapon_power') IS NOT NULL THEN UPDATE players SET weapon_power = weapon_power + (v_loot->>'weapon_power')::integer WHERE id = auth.uid(); END IF;
    IF (v_loot->>'intel') IS NOT NULL THEN UPDATE players SET intel = intel + (v_loot->>'intel')::integer WHERE id = auth.uid(); END IF;
    IF (v_loot->>'diamonds') IS NOT NULL THEN UPDATE players SET diamonds = diamonds + (v_loot->>'diamonds')::integer WHERE id = auth.uid(); END IF;
    IF (v_loot->>'xp') IS NOT NULL THEN UPDATE players SET xp = xp + (v_loot->>'xp')::integer WHERE id = auth.uid(); END IF;
    UPDATE players SET power = power + 20, updated_at = now() WHERE id = auth.uid();
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'result', v_result,
    'attacker_power', v_attacker_power,
    'defender_power', v_npc.defense_power,
    'casualties', v_casualties,
    'wounded', v_wounded_total,
    'loot', v_loot,
    'npc_name', v_npc.name,
    'bonuses', jsonb_build_object('research', v_attacker_research, 'enforcer', v_attacker_enforcer)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION attack_npc(uuid) TO authenticated;
