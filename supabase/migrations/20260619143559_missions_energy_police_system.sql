-- ============================================================
-- Missions, Energy & Police System
-- ============================================================

-- 1. Add energy regen + daily mission tracking columns to players
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='raid_energy_last_regen') THEN
    ALTER TABLE players ADD COLUMN raid_energy_last_regen timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='dark_job_energy_last_regen') THEN
    ALTER TABLE players ADD COLUMN dark_job_energy_last_regen timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='spy_energy_last_regen') THEN
    ALTER TABLE players ADD COLUMN spy_energy_last_regen timestamptz NOT NULL DEFAULT now();
  END IF;
  -- Max energies
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='max_raid_energy') THEN
    ALTER TABLE players ADD COLUMN max_raid_energy integer NOT NULL DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='max_dark_job_energy') THEN
    ALTER TABLE players ADD COLUMN max_dark_job_energy integer NOT NULL DEFAULT 5;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='max_spy_energy') THEN
    ALTER TABLE players ADD COLUMN max_spy_energy integer NOT NULL DEFAULT 3;
  END IF;
END $$;

-- 2. Add daily_claimed_date to user_missions for daily dedup
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_missions' AND column_name='daily_claimed_date') THEN
    ALTER TABLE user_missions ADD COLUMN daily_claimed_date date;
  END IF;
END $$;

-- 3. Add success_roll + police_raid_triggered to user_missions for audit
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_missions' AND column_name='success_roll') THEN
    ALTER TABLE user_missions ADD COLUMN success_roll integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_missions' AND column_name='police_raid_triggered') THEN
    ALTER TABLE user_missions ADD COLUMN police_raid_triggered boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- Helper: get_current_energy
-- Calculates current energy with regen applied
-- ============================================================
CREATE OR REPLACE FUNCTION get_player_energy(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_dark_job_regen_mins  integer := 30; -- 1 energy per 30 min
  v_raid_regen_mins      integer := 60; -- 1 energy per 60 min
  v_spy_regen_mins       integer := 45; -- 1 energy per 45 min
  v_dark_job_gained integer;
  v_raid_gained     integer;
  v_spy_gained      integer;
  v_dark_job_current integer;
  v_raid_current    integer;
  v_spy_current     integer;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = p_user_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;

  -- Calculate regen
  v_dark_job_gained := LEAST(
    floor(EXTRACT(EPOCH FROM (now() - v_player.dark_job_energy_last_regen)) / (v_dark_job_regen_mins * 60))::integer,
    v_player.max_dark_job_energy - v_player.dark_job_energy
  );
  v_dark_job_gained := GREATEST(0, v_dark_job_gained);

  v_raid_gained := LEAST(
    floor(EXTRACT(EPOCH FROM (now() - v_player.raid_energy_last_regen)) / (v_raid_regen_mins * 60))::integer,
    v_player.max_raid_energy - v_player.raid_energy
  );
  v_raid_gained := GREATEST(0, v_raid_gained);

  v_spy_gained := LEAST(
    floor(EXTRACT(EPOCH FROM (now() - v_player.spy_energy_last_regen)) / (v_spy_regen_mins * 60))::integer,
    v_player.max_spy_energy - v_player.spy_energy
  );
  v_spy_gained := GREATEST(0, v_spy_gained);

  -- Apply regen if any
  IF v_dark_job_gained > 0 OR v_raid_gained > 0 OR v_spy_gained > 0 THEN
    UPDATE players SET
      dark_job_energy          = dark_job_energy + v_dark_job_gained,
      dark_job_energy_last_regen = CASE WHEN v_dark_job_gained > 0 THEN now() ELSE dark_job_energy_last_regen END,
      raid_energy              = raid_energy + v_raid_gained,
      raid_energy_last_regen   = CASE WHEN v_raid_gained > 0 THEN now() ELSE raid_energy_last_regen END,
      spy_energy               = spy_energy + v_spy_gained,
      spy_energy_last_regen    = CASE WHEN v_spy_gained > 0 THEN now() ELSE spy_energy_last_regen END,
      updated_at               = now()
    WHERE id = p_user_id;
  END IF;

  v_dark_job_current := v_player.dark_job_energy + v_dark_job_gained;
  v_raid_current     := v_player.raid_energy + v_raid_gained;
  v_spy_current      := v_player.spy_energy + v_spy_gained;

  RETURN jsonb_build_object(
    'ok', true,
    'dark_job_energy', v_dark_job_current,
    'raid_energy',     v_raid_current,
    'spy_energy',      v_spy_current,
    'max_dark_job',    v_player.max_dark_job_energy,
    'max_raid',        v_player.max_raid_energy,
    'max_spy',         v_player.max_spy_energy
  );
END;
$$;

-- ============================================================
-- RPC: start_mission (UPDATED)
-- Energy check, daily dedup, enforcer ownership, regen sync
-- ============================================================
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
BEGIN
  SELECT * INTO v_mission FROM missions WHERE id = p_mission_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Görev bulunamadı'); END IF;

  -- Apply energy regen before checking
  PERFORM get_player_energy(auth.uid());

  SELECT * INTO v_player FROM players WHERE id = auth.uid();
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

  -- Daily mission: one claim per day per mission
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

  -- Deduct energy
  IF v_energy_field IS NOT NULL THEN
    EXECUTE format('UPDATE players SET %I = %I - 1, updated_at = now() WHERE id = $1', v_energy_field, v_energy_field)
    USING auth.uid();
  END IF;

  v_ends_at := now() + (v_mission.duration || ' seconds')::interval;

  INSERT INTO user_missions (user_id, mission_id, status, assigned_enforcer_id, started_at, ends_at)
  VALUES (auth.uid(), p_mission_id, 'in_progress', p_enforcer_id, now(), v_ends_at);

  RETURN jsonb_build_object('ok', true, 'ends_at', v_ends_at, 'duration', v_mission.duration);
END;
$$;

-- ============================================================
-- RPC: claim_mission_reward (UPDATED)
-- Police raid system, daily dedup, resource_transactions, enforcer success bonus
-- ============================================================
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

  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  SELECT * INTO v_mission FROM missions WHERE id = v_um.mission_id;

  -- Enforcer crime_success_bonus
  IF v_um.assigned_enforcer_id IS NOT NULL THEN
    SELECT COALESCE(e.crime_success_bonus, 0) INTO v_enforcer_bonus
    FROM user_enforcers ue
    JOIN enforcers e ON e.id = ue.enforcer_id
    WHERE ue.id = v_um.assigned_enforcer_id;
  END IF;

  -- Success roll: 100 - risk + enforcer_bonus
  v_success_roll := floor(random() * 100)::integer;
  
  -- Police raid check for dark_jobs:
  -- If police_heat >= 90 AND dark_job: 30% base raid chance
  -- If police_heat >= 70 AND dark_job: 10% base raid chance
  IF v_mission.category IN ('dark_job', 'raid') AND v_mission.police_heat_gain > 0 THEN
    IF v_player.police_heat >= 90 THEN
      v_police_raid := (random() < 0.30);
    ELSIF v_player.police_heat >= 70 THEN
      v_police_raid := (random() < 0.10);
    END IF;
  END IF;

  -- Apply police raid penalty
  IF v_police_raid THEN
    -- Lose 20-40% of cash and black_money as raid penalty
    v_raid_penalty := floor((v_player.cash * (0.2 + random() * 0.2)))::integer;
    UPDATE players
    SET cash = GREATEST(0, cash - v_raid_penalty),
        black_money = GREATEST(0, black_money - floor(black_money * 0.1)::integer),
        updated_at = now()
    WHERE id = auth.uid();

    -- Mark mission
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

  -- Apply enforcer bonus: +crime_success_bonus% to all rewards
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

  -- Level-up check
  UPDATE players
  SET level = level + 1,
      xp = xp - (100 * level * level),
      power = power + level * 20,
      updated_at = now()
  WHERE id = auth.uid()
    AND xp >= (100 * level * level);

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

  -- Build final rewards object with bonuses applied
  v_rewards := jsonb_build_object(
    'cash',         v_cash,
    'influence',    v_influence,
    'loyalty',      v_loyalty,
    'weapon_power', v_weapon_power,
    'black_money',  v_black_money,
    'intel',        v_intel,
    'xp',           v_xp
  );

  RETURN jsonb_build_object(
    'ok', true,
    'rewards', v_rewards,
    'police_heat', v_heat_after,
    'police_raid', false,
    'enforcer_bonus', v_enforcer_bonus
  );
END;
$$;

-- ============================================================
-- RPC: reduce_police_heat_with_intel
-- Spend intel to reduce police heat
-- ============================================================
CREATE OR REPLACE FUNCTION reduce_police_heat_with_intel(p_intel_amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_heat_reduction integer;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadı'); END IF;

  IF v_player.intel < p_intel_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli istihbarat yok');
  END IF;

  -- 100 intel = 5 heat reduction
  v_heat_reduction := floor(p_intel_amount / 100.0 * 5)::integer;
  IF v_heat_reduction < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'En az 100 istihbarat gerekli');
  END IF;

  UPDATE players
  SET intel = intel - p_intel_amount,
      police_heat = GREATEST(0, police_heat - v_heat_reduction),
      updated_at = now()
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'ok', true,
    'heat_reduction', v_heat_reduction,
    'intel_spent', p_intel_amount
  );
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION start_mission(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_mission_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_player_energy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reduce_police_heat_with_intel(integer) TO authenticated;

-- Seed additional missions for all categories
INSERT INTO missions (category, name, description, required_level, duration, rewards, risk, police_heat_gain)
VALUES
  -- Story missions
  ('story', 'Şehre Geliş',          'Yeni bir şehre adım attınız. İlk adımı atın.',                  1,    60,  '{"cash":500,"xp":100}',                       0,  0),
  ('story', 'İlk Ortaklık',         'Güvenilir bir iş ortağı bulun.',                                 2,   180,  '{"cash":1000,"influence":100,"xp":150}',       5,  2),
  ('story', 'Mahalle Hakimiyeti',    'Mahallede söz sahibi olun.',                                     4,   600,  '{"influence":300,"loyalty":200,"xp":250}',    10,  3),
  ('story', 'Ailenizi Kurun',        'Kendi suç örgütünüzü oluşturun.',                                6,  1200,  '{"influence":500,"loyalty":500,"xp":400}',    15,  4),
  ('story', 'Şehrin Patronu',        'Şehrin tüm bölgelerini kontrol altına alın.',                   10,  3600,  '{"influence":2000,"cash":10000,"xp":1000}',   20,  5),
  -- Weekly missions
  ('weekly', 'Haftalık Tahsilat',    'Bu hafta 50.000 Nakit topla.',                                   1,      0, '{"cash":10000,"xp":200}',                      0,  0),
  ('weekly', 'Güç Gösterisi',        'Bu hafta 5 karanlık iş tamamla.',                                3,      0, '{"influence":500,"xp":300}',                   0,  0),
  ('weekly', 'Enforcer Geliştir',    'Bu hafta bir enforcer geliştir.',                                4,      0, '{"diamonds":50,"xp":250}',                     0,  0),
  -- Raid missions
  ('raid', 'Küçük Baskın',           'Rakip bir mekanı basın.',                                        3,   300,  '{"cash":1500,"weapon_power":300,"xp":150}',   40, 15),
  ('raid', 'Depo Operasyonu',        'Rakip depoyu ele geçirin.',                                      6,   600,  '{"cash":3000,"black_money":1000,"xp":250}',   55, 20),
  ('raid', 'Büyük Baskın',           'Rakip ailenin karargahını basın.',                              10,  1200,  '{"cash":8000,"weapon_power":2000,"xp":500}',  65, 30),
  -- Event missions  
  ('event', 'Şehir Festivali',       'Festival süresinde özel görevler tamamlayın.',                   1,      0, '{"cash":5000,"diamonds":20,"xp":300}',          0,  0),
  ('event', 'Özel Operasyon',        'Sınırlı süreli yüksek ödüllü operasyon.',                        5,   900,  '{"black_money":3000,"influence":1000,"xp":600}', 30, 10)
ON CONFLICT DO NOTHING;
