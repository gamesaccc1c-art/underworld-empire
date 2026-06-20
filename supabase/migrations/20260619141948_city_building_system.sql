-- ============================================================
-- City Building System: Definitions table + Production collect + Speedup
-- ============================================================

-- 1. building_definitions: static table, seeded data, read-only for clients
CREATE TABLE IF NOT EXISTS building_definitions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text UNIQUE NOT NULL,
  name          text NOT NULL,
  icon          text NOT NULL DEFAULT 'Castle',
  description   text NOT NULL DEFAULT '',
  max_level     integer NOT NULL DEFAULT 30,
  -- base cost (level 1). Formula: floor(base * 1.5^currentLevel) per client
  base_cash           integer NOT NULL DEFAULT 0,
  base_influence      integer NOT NULL DEFAULT 0,
  base_loyalty        integer NOT NULL DEFAULT 0,
  base_weapon_power   integer NOT NULL DEFAULT 0,
  base_black_money    integer NOT NULL DEFAULT 0,
  base_intel          integer NOT NULL DEFAULT 0,
  -- base upgrade duration in seconds (level 1). Formula: floor(base * 1.4^level)
  base_duration       integer NOT NULL DEFAULT 60,
  -- production
  production_type     text,           -- null = no production
  production_rate     integer NOT NULL DEFAULT 0,  -- per hour at level 1, scales +30%/level
  -- capacity: max accumulated production before collect required (in hours of base production)
  production_capacity_hours integer NOT NULL DEFAULT 8,
  -- requires HQ level >= this to build/upgrade beyond level 1
  required_hq_level integer NOT NULL DEFAULT 0
);

ALTER TABLE building_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_building_definitions" ON building_definitions;
CREATE POLICY "anyone_can_read_building_definitions" ON building_definitions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "no_insert_building_definitions" ON building_definitions;
CREATE POLICY "no_insert_building_definitions" ON building_definitions FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "no_update_building_definitions" ON building_definitions;
CREATE POLICY "no_update_building_definitions" ON building_definitions FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "no_delete_building_definitions" ON building_definitions;
CREATE POLICY "no_delete_building_definitions" ON building_definitions FOR DELETE
  TO authenticated USING (false);

-- 2. Add last_collected_at to buildings table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'buildings' AND column_name = 'last_collected_at'
  ) THEN
    ALTER TABLE buildings ADD COLUMN last_collected_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- 3. Seed building definitions
INSERT INTO building_definitions
  (type, name, icon, description, max_level,
   base_cash, base_influence, base_loyalty, base_weapon_power, base_black_money, base_intel,
   base_duration, production_type, production_rate, production_capacity_hours, required_hq_level)
VALUES
  ('headquarters',      'Karargah',                'Castle',  'Ana bina. Diger tum binalarin seviye limitini belirler.',         30, 1000, 0, 0, 0, 0, 0, 60,  null,           0,   0, 0),
  ('cash_vault',        'Nakit Kasasi',             'Vault',   'Nakit uretir. Seviye arttikca saatlik uretim artar.',            30,  500, 0, 0, 0, 0, 0, 30,  'cash',        100,  8, 1),
  ('black_market',      'Kara Borsa',               'Store',   'Kara Para uretir. Gizli anlasmalar acar.',                      30,  800, 100, 0, 0, 0, 0, 45, 'black_money',  50,  8, 2),
  ('weapon_depot',      'Silah Deposu',             'Swords',  'Silah Gucu uretir. Savas birimlerini guclendirir.',             30,  700, 0, 0, 0, 50, 0, 40,  'weapon_power', 80,  8, 2),
  ('recruitment_center','Adam Toplama Merkezi',     'Users',   'Yeni adamlar egitir. Egitim hizi bina seviyesiyle artar.',      30,  600, 50, 0, 0, 0, 0, 35,  null,           0,   0, 1),
  ('secret_office',     'Gizli Ofis',               'EyeOff',  'Istihbarat uretir. Casusluk gorevlerini acar.',                30,  900, 0, 0, 0, 100, 0, 50, 'intel',        40,  8, 3),
  ('nightclub',         'Gece Kulubu',              'Wine',    'Sadakat uretir. Lider itibari saglar.',                         30, 1200, 200, 0, 0, 0, 0, 55, 'loyalty',      60,  8, 3),
  ('casino',            'Kumarhane',                'Dice5',   'Yuksek nakit uretir. Rastgele bonus verir.',                    30, 1500, 300, 100, 0, 200, 0, 60,'cash',       200,  8, 5),
  ('garage',            'Tamirhane',                'Car',     'Aracli birlikleri acar. Baskin sonrasi toparlama hizini artirir.',30, 800, 0, 0, 100, 0, 0, 40, null,          0,   0, 2),
  ('defense_wall',      'Savunma Duvari',           'Shield',  'Rakip baskinlara karsi savunma verir.',                         30, 1000, 0, 0, 200, 0, 0, 45, null,          0,   0, 3),
  ('prison_contacts',   'Hapishane Baglantilari',   'Lock',    'Yakalanma riskini azaltir. Polis baskini sonrasi ceza suresini dusurur.', 30, 600, 150, 0, 0, 100, 50, 35, null, 0,  0, 4),
  ('leader_mansion',    'Lider Konagi',             'Crown',   'Enforcer sistemini acar. Ozel karakterler burada yonetilir.',  30, 2000, 500, 200, 0, 300, 0, 90, 'influence', 70, 8, 5)
ON CONFLICT (type) DO UPDATE
  SET name = EXCLUDED.name,
      icon = EXCLUDED.icon,
      description = EXCLUDED.description,
      max_level = EXCLUDED.max_level,
      base_cash = EXCLUDED.base_cash,
      base_influence = EXCLUDED.base_influence,
      base_loyalty = EXCLUDED.base_loyalty,
      base_weapon_power = EXCLUDED.base_weapon_power,
      base_black_money = EXCLUDED.base_black_money,
      base_intel = EXCLUDED.base_intel,
      base_duration = EXCLUDED.base_duration,
      production_type = EXCLUDED.production_type,
      production_rate = EXCLUDED.production_rate,
      production_capacity_hours = EXCLUDED.production_capacity_hours,
      required_hq_level = EXCLUDED.required_hq_level;

-- ============================================================
-- RPC: start_building_upgrade (UPDATED)
-- Now reads costs from building_definitions + enforces HQ gate
-- ============================================================
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
  v_hq_level   integer := 0;
  v_multiplier numeric;
  v_cash_cost        bigint := 0;
  v_influence_cost   bigint := 0;
  v_loyalty_cost     bigint := 0;
  v_weapon_power_cost bigint := 0;
  v_black_money_cost bigint := 0;
  v_intel_cost       bigint := 0;
  v_duration   bigint;
  v_ends_at    timestamptz;
BEGIN
  -- Fetch player
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  -- Fetch building
  SELECT * INTO v_building FROM buildings WHERE id = p_building_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Bina bulunamadi'); END IF;

  IF v_building.is_upgrading THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bina zaten yukseltiliyor');
  END IF;

  IF v_building.level >= 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bina maksimum seviyede');
  END IF;

  -- Fetch definition
  SELECT * INTO v_def FROM building_definitions WHERE type = p_building_type;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Bina tanimi bulunamadi'); END IF;

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

    -- Non-HQ buildings cannot exceed HQ level
    IF p_current_level >= v_hq_level THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Bu bina Karargah seviyesini gecemez (Karargah: ' || v_hq_level || ')'
      );
    END IF;
  END IF;

  -- Cost: floor(base * 1.5^currentLevel)
  v_multiplier := power(1.5, p_current_level);
  v_cash_cost         := floor(v_def.base_cash         * v_multiplier);
  v_influence_cost    := floor(v_def.base_influence    * v_multiplier);
  v_loyalty_cost      := floor(v_def.base_loyalty      * v_multiplier);
  v_weapon_power_cost := floor(v_def.base_weapon_power * v_multiplier);
  v_black_money_cost  := floor(v_def.base_black_money  * v_multiplier);
  v_intel_cost        := floor(v_def.base_intel        * v_multiplier);

  -- Duration: floor(base * 1.4^currentLevel) seconds
  v_duration := floor(v_def.base_duration * power(1.4, p_current_level));

  -- Resource checks
  IF v_player.cash         < v_cash_cost        THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli nakit yok'); END IF;
  IF v_player.influence    < v_influence_cost   THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli etki yok'); END IF;
  IF v_player.loyalty      < v_loyalty_cost     THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli sadakat yok'); END IF;
  IF v_player.weapon_power < v_weapon_power_cost THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli silah gucu yok'); END IF;
  IF v_player.black_money  < v_black_money_cost THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli kara para yok'); END IF;
  IF v_player.intel        < v_intel_cost       THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli istihbarat yok'); END IF;

  -- Deduct resources atomically
  UPDATE players
  SET cash         = cash         - v_cash_cost,
      influence    = influence    - v_influence_cost,
      loyalty      = loyalty      - v_loyalty_cost,
      weapon_power = weapon_power - v_weapon_power_cost,
      black_money  = black_money  - v_black_money_cost,
      intel        = intel        - v_intel_cost,
      updated_at   = now()
  WHERE id = auth.uid();

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
      'cash', v_cash_cost,
      'influence', v_influence_cost,
      'weapon_power', v_weapon_power_cost,
      'black_money', v_black_money_cost,
      'intel', v_intel_cost
    )
  );
END;
$$;

-- ============================================================
-- RPC: finish_building_upgrade (UPDATED — writes resource_transaction)
-- ============================================================
CREATE OR REPLACE FUNCTION finish_building_upgrade(p_building_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_building   buildings%ROWTYPE;
  v_new_level  integer;
  v_xp_gain    integer;
  v_power_gain integer;
BEGIN
  SELECT * INTO v_building FROM buildings WHERE id = p_building_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Bina bulunamadi'); END IF;

  IF NOT v_building.is_upgrading THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bina yukseltilmiyor');
  END IF;

  IF v_building.upgrade_ends_at > now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Yukseltme suresi henuz dolmadi',
      'remaining_seconds', EXTRACT(EPOCH FROM (v_building.upgrade_ends_at - now()))::integer
    );
  END IF;

  v_new_level  := v_building.level + 1;
  v_xp_gain    := v_new_level * 50;
  v_power_gain := v_new_level * 10;

  UPDATE buildings
  SET level               = v_new_level,
      is_upgrading        = false,
      upgrade_started_at  = null,
      upgrade_ends_at     = null
  WHERE id = p_building_id AND user_id = auth.uid();

  UPDATE players
  SET xp = xp + v_xp_gain, power = power + v_power_gain, updated_at = now()
  WHERE id = auth.uid();

  -- Level-up check
  UPDATE players
  SET level = level + 1,
      xp    = xp - (100 * level * level),
      power = power + level * 20,
      updated_at = now()
  WHERE id = auth.uid() AND xp >= (100 * level * level);

  -- Log
  INSERT INTO resource_transactions (user_id, source_type, source_id, resource_type, amount, balance_after, metadata)
  VALUES
    (auth.uid(), 'building_upgrade_complete', p_building_id, 'xp',    v_xp_gain,    0, jsonb_build_object('new_level', v_new_level)),
    (auth.uid(), 'building_upgrade_complete', p_building_id, 'power', v_power_gain, 0, jsonb_build_object('new_level', v_new_level));

  RETURN jsonb_build_object('ok', true, 'new_level', v_new_level, 'xp_gain', v_xp_gain, 'power_gain', v_power_gain);
END;
$$;

-- ============================================================
-- RPC: speedup_building_upgrade
-- Spends diamonds to instantly finish, server validates timer
-- ============================================================
CREATE OR REPLACE FUNCTION speedup_building_upgrade(
  p_building_id uuid,
  p_diamond_cost integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player   players%ROWTYPE;
  v_building buildings%ROWTYPE;
  v_remaining_secs integer;
  v_expected_cost  integer;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  SELECT * INTO v_building FROM buildings WHERE id = p_building_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Bina bulunamadi'); END IF;

  IF NOT v_building.is_upgrading THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bina yukseltilmiyor');
  END IF;

  IF v_building.upgrade_ends_at <= now() THEN
    -- Already done — just finish it
    RETURN finish_building_upgrade(p_building_id);
  END IF;

  v_remaining_secs := EXTRACT(EPOCH FROM (v_building.upgrade_ends_at - now()))::integer;
  -- 1 diamond per minute, minimum 1
  v_expected_cost := GREATEST(1, ceil(v_remaining_secs::numeric / 60)::integer);

  IF p_diamond_cost < v_expected_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Elmas miktari yetersiz', 'required', v_expected_cost);
  END IF;

  IF v_player.diamonds < v_expected_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli elmas yok', 'required', v_expected_cost, 'have', v_player.diamonds);
  END IF;

  -- Deduct diamonds
  UPDATE players SET diamonds = diamonds - v_expected_cost, updated_at = now() WHERE id = auth.uid();

  -- Instant finish: set ends_at to past
  UPDATE buildings SET upgrade_ends_at = now() - interval '1 second' WHERE id = p_building_id AND user_id = auth.uid();

  -- Now finish normally
  RETURN finish_building_upgrade(p_building_id);
END;
$$;

-- ============================================================
-- RPC: collect_building_production
-- Calculates offline production, applies capacity cap, credits player
-- ============================================================
CREATE OR REPLACE FUNCTION collect_building_production(p_building_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_building  buildings%ROWTYPE;
  v_def       building_definitions%ROWTYPE;
  v_elapsed_hours  numeric;
  v_rate_per_hour  numeric;
  v_capacity       numeric;
  v_amount         integer;
  v_resource_type  text;
BEGIN
  SELECT * INTO v_building FROM buildings WHERE id = p_building_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Bina bulunamadi'); END IF;

  IF v_building.is_upgrading THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bina yukseltme sirasinda uretim yapamiyor');
  END IF;

  SELECT * INTO v_def FROM building_definitions WHERE type = v_building.building_type;
  IF NOT FOUND OR v_def.production_type IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bu bina uretim yapmiyor');
  END IF;

  v_resource_type := v_def.production_type;

  -- Rate at current level: base * (1 + (level-1) * 0.3)
  v_rate_per_hour := v_def.production_rate * (1 + (v_building.level - 1) * 0.3);

  -- Elapsed hours since last collect
  v_elapsed_hours := EXTRACT(EPOCH FROM (now() - v_building.last_collected_at)) / 3600.0;

  -- Capacity = base_rate * level * capacity_hours
  v_capacity := v_rate_per_hour * v_def.production_capacity_hours;

  -- Clamp to capacity
  v_amount := floor(LEAST(v_elapsed_hours * v_rate_per_hour, v_capacity))::integer;

  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Toplanacak uretim yok', 'pending', 0);
  END IF;

  -- Update last_collected_at
  UPDATE buildings SET last_collected_at = now() WHERE id = p_building_id AND user_id = auth.uid();

  -- Credit resource
  EXECUTE format(
    'UPDATE players SET %I = %I + $1, updated_at = now() WHERE id = $2',
    v_resource_type, v_resource_type
  ) USING v_amount, auth.uid();

  -- Log transaction
  INSERT INTO resource_transactions (user_id, source_type, source_id, resource_type, amount, balance_after, metadata)
  VALUES (
    auth.uid(), 'building_production', p_building_id,
    v_resource_type, v_amount, 0,
    jsonb_build_object('building_type', v_building.building_type, 'hours', round(v_elapsed_hours::numeric, 2))
  );

  RETURN jsonb_build_object(
    'ok', true,
    'resource', v_resource_type,
    'amount', v_amount,
    'hours', round(v_elapsed_hours::numeric, 2)
  );
END;
$$;

-- ============================================================
-- RPC: build_new_building (replaces direct DB insert)
-- Validates HQ requirement, deducts base costs, creates building
-- ============================================================
CREATE OR REPLACE FUNCTION build_new_building(p_building_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player   players%ROWTYPE;
  v_def      building_definitions%ROWTYPE;
  v_hq_level integer := 0;
  v_exists   boolean := false;
  v_new_id   uuid;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  SELECT * INTO v_def FROM building_definitions WHERE type = p_building_type;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Bina tanimi bulunamadi'); END IF;

  -- Check not already built
  SELECT EXISTS(SELECT 1 FROM buildings WHERE user_id = auth.uid() AND building_type = p_building_type) INTO v_exists;
  IF v_exists THEN RETURN jsonb_build_object('ok', false, 'error', 'Bu bina zaten kurulu'); END IF;

  -- HQ requirement (HQ itself is exempt)
  IF p_building_type != 'headquarters' THEN
    SELECT COALESCE(MAX(level), 0) INTO v_hq_level
    FROM buildings WHERE user_id = auth.uid() AND building_type = 'headquarters';

    IF v_hq_level < v_def.required_hq_level THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Karargah seviyesi yetersiz (Gerekli: ' || v_def.required_hq_level || ')'
      );
    END IF;
  END IF;

  -- Check base costs (level 0 → 1 cost)
  IF v_player.cash         < v_def.base_cash         THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli nakit yok'); END IF;
  IF v_player.influence    < v_def.base_influence    THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli etki yok'); END IF;
  IF v_player.loyalty      < v_def.base_loyalty      THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli sadakat yok'); END IF;
  IF v_player.weapon_power < v_def.base_weapon_power THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli silah gucu yok'); END IF;
  IF v_player.black_money  < v_def.base_black_money  THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli kara para yok'); END IF;
  IF v_player.intel        < v_def.base_intel        THEN RETURN jsonb_build_object('ok', false, 'error', 'Yeterli istihbarat yok'); END IF;

  -- Deduct
  UPDATE players
  SET cash         = cash         - v_def.base_cash,
      influence    = influence    - v_def.base_influence,
      loyalty      = loyalty      - v_def.base_loyalty,
      weapon_power = weapon_power - v_def.base_weapon_power,
      black_money  = black_money  - v_def.base_black_money,
      intel        = intel        - v_def.base_intel,
      power        = power + 50,
      updated_at   = now()
  WHERE id = auth.uid();

  -- Create building
  INSERT INTO buildings (user_id, building_type, level, last_collected_at)
  VALUES (auth.uid(), p_building_type, 1, now())
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('ok', true, 'building_id', v_new_id);
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION start_building_upgrade(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION finish_building_upgrade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION speedup_building_upgrade(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION collect_building_production(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION build_new_building(text) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_building_definitions_type ON building_definitions(type);
CREATE INDEX IF NOT EXISTS idx_buildings_user_type ON buildings(user_id, building_type);
