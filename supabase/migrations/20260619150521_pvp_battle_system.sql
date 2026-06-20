
-- ============================================================
-- PvP Battle System
-- scout, attack, heal wounded, NPC targets
-- ============================================================

-- ─── 1. npc_targets (static) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS npc_targets (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text    NOT NULL,
  description     text    NOT NULL DEFAULT '',
  level           integer NOT NULL DEFAULT 1,
  power           integer NOT NULL DEFAULT 100,
  defense_power   integer NOT NULL DEFAULT 50,
  loot            jsonb   NOT NULL DEFAULT '{}',
  required_level  integer NOT NULL DEFAULT 1,
  battle_type     text    NOT NULL DEFAULT 'npc_raid'
);

ALTER TABLE npc_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npc_select_auth" ON npc_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "npc_no_insert"   ON npc_targets FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "npc_no_update"   ON npc_targets FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "npc_no_delete"   ON npc_targets FOR DELETE TO authenticated USING (false);

-- Seed NPC targets
INSERT INTO npc_targets (name, description, level, power, defense_power, loot, required_level, battle_type) VALUES
('Sokak Çetesi',            'Küçük bir sokak çetesi. Yeni başlayanlar için.',       1,  50,   30,  '{"cash":500,"xp":50}',         1,  'npc_raid'),
('Yerel Tefeci',            'Yerel bir tefecinin dükkanı.',                         3,  150,  100, '{"cash":1500,"black_money":100,"xp":100}', 2,  'npc_raid'),
('Kaçak Depo',              'Yasadışı mal depolayan bir antrepo.',                  5,  300,  200, '{"cash":3000,"weapon_power":200,"xp":200}', 4,  'npc_raid'),
('Rakip Kumarhane',         'Küçük bir rakip kumarhane.',                           8,  600,  400, '{"cash":8000,"black_money":500,"xp":400}', 6,  'npc_raid'),
('Koruma Şirketi',          'Özel güvenlik şirketi. İyi korunan.',                 10,  1000, 700, '{"cash":12000,"intel":300,"xp":600}', 8,  'npc_raid'),
('Silah Kaçakçıları',       'Uluslararası silah kaçakçılığı örgütü.',             13,  1800, 1200,'{"cash":20000,"weapon_power":1000,"xp":900}', 10, 'npc_raid'),
('Kartel Üssü',             'Bir uyuşturucu kartelinin bölgesel üssü.',           16,  3000, 2000,'{"cash":40000,"black_money":3000,"xp":1500}', 13, 'npc_raid'),
('Federal Rezerv Konvoyu',  'Yüksek güvenlikli para transferi.',                  20,  5000, 3500,'{"cash":80000,"diamonds":20,"xp":3000}', 16, 'npc_raid');

-- ─── 2. scout_reports ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scout_reports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimated_cash       integer NOT NULL DEFAULT 0,
  estimated_resources  jsonb   NOT NULL DEFAULT '{}',
  estimated_defense    integer NOT NULL DEFAULT 0,
  hq_level             integer NOT NULL DEFAULT 0,
  has_shield           boolean NOT NULL DEFAULT false,
  family_name          text,
  risk_level           text    NOT NULL DEFAULT 'medium',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE scout_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr_select_own" ON scout_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sr_no_insert"  ON scout_reports FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "sr_no_update"  ON scout_reports FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "sr_no_delete"  ON scout_reports FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_scout_user ON scout_reports(user_id, created_at DESC);

-- ─── 3. RPC: get_attack_targets ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_attack_targets()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_targets jsonb;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  SELECT jsonb_agg(row_to_json(t))
  INTO v_targets
  FROM (
    SELECT
      p.id,
      p.username,
      p.level,
      p.power,
      p.title,
      p.family_id,
      f.name AS family_name,
      f.tag AS family_tag,
      CASE WHEN p.shield_until > now() THEN true ELSE false END AS has_shield,
      CASE WHEN p.created_at > now() - interval '3 days' THEN true ELSE false END AS is_new_player
    FROM players p
    LEFT JOIN families f ON f.id = p.family_id
    WHERE p.id != auth.uid()
      AND p.level >= GREATEST(1, v_player.level - 5)
      AND p.level <= v_player.level + 10
      AND (p.shield_until IS NULL OR p.shield_until <= now())
      AND p.created_at <= now() - interval '3 days'
    ORDER BY random()
    LIMIT 20
  ) t;

  RETURN jsonb_build_object('ok', true, 'targets', COALESCE(v_targets, '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION get_attack_targets() TO authenticated;

-- ─── 4. RPC: scout_player ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION scout_player(p_target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_target players%ROWTYPE;
  v_intel_cost integer := 50;
  v_hq_level integer := 0;
  v_defense integer := 0;
  v_family_name text;
  v_risk text;
  v_resources jsonb;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  IF v_player.intel < v_intel_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli istihbarat yok (50 gerekli)');
  END IF;

  SELECT * INTO v_target FROM players WHERE id = p_target_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Hedef bulunamadi'); END IF;

  IF v_target.shield_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Hedef kalkan altinda');
  END IF;

  -- Deduct intel
  UPDATE players SET intel = intel - v_intel_cost, updated_at = now() WHERE id = auth.uid();

  -- Calculate estimated defense
  SELECT COALESCE(SUM(t.amount * CASE t.troop_type
    WHEN 'bodyguards' THEN 40 WHEN 'heavy_crew' THEN 50 WHEN 'vehicle_crew' THEN 30
    WHEN 'bikers' THEN 15 WHEN 'hitmen' THEN 10 WHEN 'street_thugs' THEN 5
    ELSE 10 END), 0) INTO v_defense
  FROM troops t WHERE t.user_id = p_target_id;

  -- Get HQ level
  SELECT COALESCE(level, 0) INTO v_hq_level
  FROM buildings WHERE user_id = p_target_id AND building_type = 'headquarters';

  -- Add defense wall bonus
  v_defense := v_defense + COALESCE(
    (SELECT level * 50 FROM buildings WHERE user_id = p_target_id AND building_type = 'defense_wall'), 0
  );

  -- Estimate resources (±20% noise)
  v_resources := jsonb_build_object(
    'cash', FLOOR(v_target.cash * (0.8 + random() * 0.4)),
    'black_money', FLOOR(v_target.black_money * (0.8 + random() * 0.4)),
    'weapon_power', FLOOR(v_target.weapon_power * (0.8 + random() * 0.4))
  );

  -- Family name
  SELECT name INTO v_family_name FROM families WHERE id = v_target.family_id;

  -- Risk level
  v_risk := CASE
    WHEN v_defense > v_player.power * 1.5 THEN 'very_high'
    WHEN v_defense > v_player.power THEN 'high'
    WHEN v_defense > v_player.power * 0.5 THEN 'medium'
    ELSE 'low'
  END;

  -- Save report
  INSERT INTO scout_reports (user_id, target_id, estimated_cash, estimated_resources, estimated_defense, hq_level, has_shield, family_name, risk_level)
  VALUES (auth.uid(), p_target_id,
    FLOOR(v_target.cash * (0.8 + random() * 0.4)),
    v_resources, v_defense, v_hq_level,
    COALESCE(v_target.shield_until > now(), false),
    v_family_name, v_risk
  );

  RETURN jsonb_build_object(
    'ok', true,
    'estimated_cash', (v_resources->>'cash')::integer,
    'estimated_resources', v_resources,
    'estimated_defense', v_defense,
    'hq_level', v_hq_level,
    'has_shield', COALESCE(v_target.shield_until > now(), false),
    'family_name', v_family_name,
    'risk_level', v_risk
  );
END;
$$;
GRANT EXECUTE ON FUNCTION scout_player(uuid) TO authenticated;

-- ─── 5. RPC: attack_player (PvP) ─────────────────────────────────────────────
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

  -- Check attacker has troops
  IF NOT EXISTS (SELECT 1 FROM troops WHERE user_id = auth.uid() AND amount > 0) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Saldiri icin birlik gerekli');
  END IF;

  -- Check raid energy
  IF v_attacker.raid_energy <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Baskin enerjisi yok');
  END IF;

  -- Deduct raid energy
  UPDATE players SET raid_energy = raid_energy - 1, updated_at = now() WHERE id = auth.uid();

  -- ─── Calculate attacker power ─────────────────────────────────────────────
  SELECT COALESCE(SUM(t.amount * CASE t.troop_type
    WHEN 'street_thugs' THEN 10 WHEN 'hitmen' THEN 35 WHEN 'bodyguards' THEN 10
    WHEN 'bikers' THEN 25 WHEN 'vehicle_crew' THEN 40 WHEN 'heavy_crew' THEN 60
    ELSE 10 END), 0) INTO v_attacker_troop_power
  FROM troops t WHERE t.user_id = auth.uid() AND t.amount > 0;

  -- Attacker research bonus (attack category)
  SELECT COALESCE(SUM(
    CASE rd.key WHEN 'attack' THEN ur.level * rd.effect_value WHEN 'raid_damage' THEN ur.level * rd.effect_value ELSE 0 END
  ), 0) INTO v_attacker_research
  FROM user_research ur
  JOIN research_definitions rd ON rd.id = ur.research_id
  WHERE ur.user_id = auth.uid() AND ur.level > 0;

  -- Attacker VIP bonus
  v_attacker_vip := CASE
    WHEN v_attacker.vip_level >= 3 THEN 3
    ELSE 0
  END;

  -- Total attacker capacity for loot
  SELECT COALESCE(SUM(t.amount * CASE t.troop_type
    WHEN 'street_thugs' THEN 2 WHEN 'hitmen' THEN 1 WHEN 'bodyguards' THEN 3
    WHEN 'bikers' THEN 2 WHEN 'vehicle_crew' THEN 5 WHEN 'heavy_crew' THEN 8
    ELSE 2 END), 0) INTO v_total_capacity
  FROM troops t WHERE t.user_id = auth.uid() AND t.amount > 0;

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

  -- Apply casualties to attacker troops (killed = 40% of losses, wounded = 60%)
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
    -- Protected resources based on HQ level
    SELECT COALESCE(level, 1) INTO v_hq_level FROM buildings WHERE user_id = p_target_id AND building_type = 'headquarters';
    v_protected_cash := v_hq_level * 2000;
    v_protected_bm   := v_hq_level * 500;
    v_protected_wp   := v_hq_level * 300;

    -- Lootable = total - protected, capped by capacity
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
  ELSIF v_result = 'defeat' THEN
    UPDATE players SET xp = xp + 50, updated_at = now() WHERE id = auth.uid();
  END IF;

  -- ─── Save battle + report ──────────────────────────────────────────────────
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
      'defender_research_bonus', v_defender_research,
      'attacker_vip_bonus', v_attacker_vip,
      'defender_vip_bonus', v_defender_vip,
      'wall_bonus', v_wall_bonus,
      'capacity', v_total_capacity
    )
  ) RETURNING id INTO v_report_id;

  -- Log resource transactions
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
    'bonuses', jsonb_build_object('research', v_attacker_research, 'vip', v_attacker_vip, 'wall', v_wall_bonus)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION attack_player(uuid, text) TO authenticated;

-- ─── 6. RPC: attack_npc ──────────────────────────────────────────────────────
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

  -- Attacker power
  SELECT COALESCE(SUM(t.amount * CASE t.troop_type
    WHEN 'street_thugs' THEN 10 WHEN 'hitmen' THEN 35 WHEN 'bodyguards' THEN 10
    WHEN 'bikers' THEN 25 WHEN 'vehicle_crew' THEN 40 WHEN 'heavy_crew' THEN 60
    ELSE 10 END), 0) INTO v_attacker_troop_power
  FROM troops t WHERE t.user_id = auth.uid() AND t.amount > 0;

  SELECT COALESCE(SUM(CASE rd.key WHEN 'attack' THEN ur.level * rd.effect_value WHEN 'raid_damage' THEN ur.level * rd.effect_value ELSE 0 END), 0)
  INTO v_attacker_research
  FROM user_research ur JOIN research_definitions rd ON rd.id = ur.research_id
  WHERE ur.user_id = auth.uid() AND ur.level > 0;

  v_attacker_power := v_attacker_troop_power + FLOOR(v_attacker_troop_power * v_attacker_research / 100.0);

  -- Variance
  v_variance := 0.95 + (random() * 0.1);
  v_attacker_power := FLOOR(v_attacker_power * v_variance);

  -- Result
  IF v_attacker_power > v_npc.defense_power THEN
    v_result := 'victory';
    v_casualty_rate := GREATEST(0.02, (v_npc.defense_power::float / GREATEST(v_attacker_power, 1)) * 0.15);
  ELSE
    v_result := 'defeat';
    v_casualty_rate := GREATEST(0.1, LEAST(0.4, 0.25));
  END IF;

  -- Casualties
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

  -- Loot on victory
  v_loot := '{}'::jsonb;
  IF v_result = 'victory' THEN
    v_loot := v_npc.loot;
    -- Grant loot
    IF (v_loot->>'cash') IS NOT NULL THEN
      UPDATE players SET cash = cash + (v_loot->>'cash')::integer WHERE id = auth.uid();
    END IF;
    IF (v_loot->>'black_money') IS NOT NULL THEN
      UPDATE players SET black_money = black_money + (v_loot->>'black_money')::integer WHERE id = auth.uid();
    END IF;
    IF (v_loot->>'weapon_power') IS NOT NULL THEN
      UPDATE players SET weapon_power = weapon_power + (v_loot->>'weapon_power')::integer WHERE id = auth.uid();
    END IF;
    IF (v_loot->>'intel') IS NOT NULL THEN
      UPDATE players SET intel = intel + (v_loot->>'intel')::integer WHERE id = auth.uid();
    END IF;
    IF (v_loot->>'diamonds') IS NOT NULL THEN
      UPDATE players SET diamonds = diamonds + (v_loot->>'diamonds')::integer WHERE id = auth.uid();
    END IF;
    IF (v_loot->>'xp') IS NOT NULL THEN
      UPDATE players SET xp = xp + (v_loot->>'xp')::integer WHERE id = auth.uid();
    END IF;
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
    'npc_name', v_npc.name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION attack_npc(uuid) TO authenticated;

-- ─── 7. RPC: heal_wounded_troops ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION heal_wounded_troops(p_troop_type text, p_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_troop troops%ROWTYPE;
  v_cash_cost integer;
  v_heal_amount integer;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  SELECT * INTO v_troop FROM troops WHERE user_id = auth.uid() AND troop_type = p_troop_type AND tier = 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Birlik bulunamadi'); END IF;

  v_heal_amount := LEAST(p_amount, v_troop.wounded_amount);
  IF v_heal_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Iyilestirilecek yarali yok');
  END IF;

  -- Cost: 50% of training cost
  v_cash_cost := CASE p_troop_type
    WHEN 'street_thugs' THEN 100 WHEN 'hitmen' THEN 400 WHEN 'bodyguards' THEN 300
    WHEN 'bikers' THEN 500 WHEN 'vehicle_crew' THEN 1000 WHEN 'heavy_crew' THEN 2500
    ELSE 100
  END * v_heal_amount;

  IF v_player.cash < v_cash_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli nakit yok (' || v_cash_cost || ' gerekli)');
  END IF;

  UPDATE players SET cash = cash - v_cash_cost, updated_at = now() WHERE id = auth.uid();
  UPDATE troops SET wounded_amount = wounded_amount - v_heal_amount, amount = amount + v_heal_amount, updated_at = now()
  WHERE id = v_troop.id;

  RETURN jsonb_build_object('ok', true, 'healed', v_heal_amount, 'cost', v_cash_cost, 'troop_type', p_troop_type);
END;
$$;
GRANT EXECUTE ON FUNCTION heal_wounded_troops(text, integer) TO authenticated;
