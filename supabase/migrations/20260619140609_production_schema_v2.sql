
-- ============================================================
-- Underworld Empire: Production Schema v2
-- New tables, public leaderboard views, tightened RLS
-- ============================================================

-- ─── 1. resource_transactions ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resource_transactions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type  text        NOT NULL, -- 'mission', 'building', 'shop', 'daily_reward', 'chest', 'admin', 'battle', 'research'
  source_id    uuid,
  resource_type text       NOT NULL,
  amount       bigint      NOT NULL, -- positive = gain, negative = spend
  balance_after bigint     NOT NULL DEFAULT 0,
  metadata     jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE resource_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rt_select_own" ON resource_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rt_no_insert"  ON resource_transactions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "rt_no_update"  ON resource_transactions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "rt_no_delete"  ON resource_transactions FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_resource_tx_user      ON resource_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_tx_source    ON resource_transactions(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_resource_tx_created   ON resource_transactions(created_at DESC);

-- ─── 2. suspicious_activity ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suspicious_activity (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text        NOT NULL,
  severity      text        NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  description   text        NOT NULL DEFAULT '',
  payload       jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suspicious_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_no_select" ON suspicious_activity FOR SELECT TO authenticated USING (false);
CREATE POLICY "sa_no_insert" ON suspicious_activity FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "sa_no_update" ON suspicious_activity FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "sa_no_delete" ON suspicious_activity FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_suspicious_user     ON suspicious_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_severity ON suspicious_activity(severity);
CREATE INDEX IF NOT EXISTS idx_suspicious_created  ON suspicious_activity(created_at DESC);

-- ─── 3. research_definitions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS research_definitions (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  category      text  NOT NULL, -- 'economy', 'combat', 'defense', 'intelligence', 'family'
  key           text  UNIQUE NOT NULL,
  name          text  NOT NULL,
  description   text  NOT NULL DEFAULT '',
  max_level     integer NOT NULL DEFAULT 5,
  base_cost     jsonb NOT NULL DEFAULT '{}',
  base_duration integer NOT NULL DEFAULT 300, -- seconds
  effect_type   text  NOT NULL DEFAULT 'percent',
  effect_value  numeric NOT NULL DEFAULT 0
);

ALTER TABLE research_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rd_select_auth" ON research_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rd_no_insert"   ON research_definitions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "rd_no_update"   ON research_definitions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "rd_no_delete"   ON research_definitions FOR DELETE TO authenticated USING (false);

-- ─── 4. user_research ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_research (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  research_id   uuid        NOT NULL REFERENCES research_definitions(id) ON DELETE CASCADE,
  level         integer     NOT NULL DEFAULT 0,
  started_at    timestamptz,
  ends_at       timestamptz,
  is_researching boolean    NOT NULL DEFAULT false,
  UNIQUE (user_id, research_id)
);

ALTER TABLE user_research ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ur_select_own" ON user_research FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ur_insert_own" ON user_research FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ur_no_update"  ON user_research FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "ur_no_delete"  ON user_research FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_user_research_user ON user_research(user_id);

-- ─── 5. troops ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS troops (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  troop_type     text        NOT NULL,
  tier           integer     NOT NULL DEFAULT 1,
  amount         integer     NOT NULL DEFAULT 0,
  wounded_amount integer     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, troop_type, tier)
);

ALTER TABLE troops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "troops_select_own" ON troops FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "troops_no_insert"  ON troops FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "troops_no_update"  ON troops FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "troops_no_delete"  ON troops FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_troops_user ON troops(user_id);

-- ─── 6. troop_training_queue ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS troop_training_queue (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  troop_type text        NOT NULL,
  tier       integer     NOT NULL DEFAULT 1,
  amount     integer     NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz NOT NULL,
  status     text        NOT NULL DEFAULT 'training' -- 'training', 'completed', 'cancelled'
);

ALTER TABLE troop_training_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ttq_select_own" ON troop_training_queue FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ttq_no_insert"  ON troop_training_queue FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "ttq_no_update"  ON troop_training_queue FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "ttq_no_delete"  ON troop_training_queue FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_ttq_user ON troop_training_queue(user_id);

-- ─── 7. battle_reports ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS battle_reports (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id      uuid        REFERENCES battles(id) ON DELETE SET NULL,
  attacker_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  defender_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  result         text        NOT NULL DEFAULT 'pending', -- 'victory', 'defeat', 'draw'
  attacker_power integer     NOT NULL DEFAULT 0,
  defender_power integer     NOT NULL DEFAULT 0,
  casualties     jsonb       NOT NULL DEFAULT '{}',
  wounded        jsonb       NOT NULL DEFAULT '{}',
  loot           jsonb       NOT NULL DEFAULT '{}',
  report_data    jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE battle_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "br_select_own"  ON battle_reports FOR SELECT  TO authenticated USING (auth.uid() = attacker_id OR auth.uid() = defender_id);
CREATE POLICY "br_no_insert"   ON battle_reports FOR INSERT  TO authenticated WITH CHECK (false);
CREATE POLICY "br_no_update"   ON battle_reports FOR UPDATE  TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "br_no_delete"   ON battle_reports FOR DELETE  TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_br_attacker ON battle_reports(attacker_id);
CREATE INDEX IF NOT EXISTS idx_br_defender ON battle_reports(defender_id);

-- ─── 8. daily_reward_claims ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_reward_claims (
  id           uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_day   integer NOT NULL DEFAULT 1, -- 1-7 streak day
  claimed_date date  NOT NULL,
  reward       jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, claimed_date)
);

ALTER TABLE daily_reward_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drc_select_own" ON daily_reward_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "drc_no_insert"  ON daily_reward_claims FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "drc_no_update"  ON daily_reward_claims FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "drc_no_delete"  ON daily_reward_claims FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_drc_user ON daily_reward_claims(user_id);

-- ─── 9. event_progress ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_progress (
  id              uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        text  NOT NULL,
  user_id         uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points          integer NOT NULL DEFAULT 0,
  rank            integer,
  claimed_rewards jsonb NOT NULL DEFAULT '[]',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE event_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ep_select_own" ON event_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ep_no_insert"  ON event_progress FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "ep_no_update"  ON event_progress FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "ep_no_delete"  ON event_progress FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_ep_user  ON event_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_ep_event ON event_progress(event_id);

-- ─── 10. admin_logs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        text        NOT NULL,
  target_type   text        NOT NULL DEFAULT '',
  target_id     uuid,
  payload       jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "al_no_select" ON admin_logs FOR SELECT TO authenticated USING (false);
CREATE POLICY "al_no_insert" ON admin_logs FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "al_no_update" ON admin_logs FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "al_no_delete" ON admin_logs FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin   ON admin_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_target  ON admin_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);

-- ─── 11. chest_openings ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chest_openings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chest_type text        NOT NULL, -- 'bronze', 'silver', 'gold'
  cost       integer     NOT NULL DEFAULT 0,
  rewards    jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chest_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "co_select_own" ON chest_openings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "co_no_insert"  ON chest_openings FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "co_no_update"  ON chest_openings FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "co_no_delete"  ON chest_openings FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_co_user    ON chest_openings(user_id);
CREATE INDEX IF NOT EXISTS idx_co_created ON chest_openings(created_at DESC);

-- ─── 12. vip_transactions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vip_transactions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source            text        NOT NULL DEFAULT 'purchase', -- 'purchase', 'admin', 'event'
  vip_points_added  integer     NOT NULL DEFAULT 0,
  vip_level_before  integer     NOT NULL DEFAULT 0,
  vip_level_after   integer     NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vip_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vt_select_own" ON vip_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "vt_no_insert"  ON vip_transactions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "vt_no_update"  ON vip_transactions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "vt_no_delete"  ON vip_transactions FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_vt_user ON vip_transactions(user_id);

-- ─── 13. player_boosts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS player_boosts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  boost_type text        NOT NULL, -- 'construction_speed', 'training_speed', 'resource_production', 'attack', 'defense', 'xp_gain'
  value      numeric     NOT NULL DEFAULT 0,
  starts_at  timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz NOT NULL,
  source     text        NOT NULL DEFAULT 'item' -- 'item', 'vip', 'event', 'admin'
);

ALTER TABLE player_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pb_select_own" ON player_boosts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pb_no_insert"  ON player_boosts FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "pb_no_update"  ON player_boosts FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "pb_no_delete"  ON player_boosts FOR DELETE TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_pb_user    ON player_boosts(user_id);
CREATE INDEX IF NOT EXISTS idx_pb_ends_at ON player_boosts(ends_at);

-- ─── vip_definitions table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vip_definitions (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  vip_level    integer UNIQUE NOT NULL,
  points_required integer NOT NULL DEFAULT 0,
  daily_diamonds integer NOT NULL DEFAULT 0,
  bonuses      jsonb   NOT NULL DEFAULT '[]',
  description  text    NOT NULL DEFAULT ''
);

ALTER TABLE vip_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vd_select_auth" ON vip_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "vd_no_insert"   ON vip_definitions FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "vd_no_update"   ON vip_definitions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "vd_no_delete"   ON vip_definitions FOR DELETE TO authenticated USING (false);

-- ─── PUBLIC LEADERBOARD VIEWS ─────────────────────────────────────────────────

CREATE OR REPLACE VIEW public_player_leaderboard AS
SELECT
  p.id,
  p.username,
  p.level,
  p.power,
  p.title,
  p.vip_level,
  p.reputation,
  p.family_id,
  f.name AS family_name,
  f.tag  AS family_tag,
  p.created_at
FROM players p
LEFT JOIN families f ON f.id = p.family_id
ORDER BY p.power DESC;

GRANT SELECT ON public_player_leaderboard TO authenticated;

CREATE OR REPLACE VIEW public_family_leaderboard AS
SELECT
  f.id,
  f.name,
  f.tag,
  f.level,
  f.power,
  f.territory_count,
  COUNT(fm.user_id) AS member_count,
  f.created_at
FROM families f
LEFT JOIN family_members fm ON fm.family_id = f.id
GROUP BY f.id
ORDER BY f.power DESC;

GRANT SELECT ON public_family_leaderboard TO authenticated;

-- ─── Update open_chest RPC to also log chest_openings ─────────────────────────
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
    INSERT INTO suspicious_activity (user_id, activity_type, severity, description, payload)
    VALUES (auth.uid(), 'invalid_chest_type', 'low', 'Invalid chest type: ' || p_chest_type, jsonb_build_object('chest_type', p_chest_type));
    RETURN jsonb_build_object('ok', false, 'error', 'Gecersiz sandik tipi');
  END IF;

  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  IF v_player.diamonds < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli elmas yok');
  END IF;

  UPDATE players SET diamonds = diamonds - v_cost, updated_at = now() WHERE id = auth.uid();

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

  SELECT id INTO v_existing_unlock FROM user_enforcers
  WHERE user_id = auth.uid() AND enforcer_id = v_enforcer_id AND level >= 1;

  IF v_existing_unlock IS NOT NULL THEN
    v_shard_gain := 5;
    UPDATE user_enforcers SET shards = shards + v_shard_gain WHERE id = v_existing_unlock;
    SELECT shards INTO v_new_shards FROM user_enforcers WHERE id = v_existing_unlock;
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

  -- Log chest opening
  INSERT INTO chest_openings (user_id, chest_type, cost, rewards)
  VALUES (auth.uid(), p_chest_type, v_cost, jsonb_build_object(
    'enforcer_key', v_enforcer_key, 'rarity', v_rarity,
    'unlocked', v_unlocked, 'shards', v_new_shards
  ));

  -- Log resource transaction
  INSERT INTO resource_transactions (user_id, source_type, resource_type, amount, balance_after, metadata)
  SELECT auth.uid(), 'chest', 'diamonds', -v_cost, p.diamonds,
    jsonb_build_object('chest_type', p_chest_type, 'enforcer_key', v_enforcer_key)
  FROM players p WHERE p.id = auth.uid();

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

-- ─── Update claim_daily_reward to also log daily_reward_claims ────────────────
CREATE OR REPLACE FUNCTION claim_daily_reward()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_today date := current_date;
  v_streak integer;
  v_day integer;
  v_cash integer;
  v_diamonds integer;
  v_rewards jsonb[] := ARRAY[
    '{"cash":1000,"diamonds":0}'::jsonb,
    '{"cash":2000,"diamonds":0}'::jsonb,
    '{"cash":3000,"diamonds":10}'::jsonb,
    '{"cash":5000,"diamonds":0}'::jsonb,
    '{"cash":5000,"diamonds":20}'::jsonb,
    '{"cash":8000,"diamonds":0}'::jsonb,
    '{"cash":10000,"diamonds":50}'::jsonb
  ];
BEGIN
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  IF v_player.last_daily_reward_at = v_today THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Gunluk odul bugün zaten alindi');
  END IF;

  IF v_player.last_daily_reward_at = v_today - 1 THEN
    v_streak := COALESCE(v_player.daily_login_streak, 0) + 1;
  ELSE
    v_streak := 1;
  END IF;

  v_day := ((v_streak - 1) % 7) + 1;
  v_cash     := (v_rewards[v_day]->>'cash')::integer;
  v_diamonds := (v_rewards[v_day]->>'diamonds')::integer;

  UPDATE players
  SET cash                = cash + v_cash,
      diamonds            = diamonds + v_diamonds,
      last_daily_reward_at= v_today,
      daily_login_streak  = v_streak,
      updated_at          = now()
  WHERE id = auth.uid();

  INSERT INTO daily_reward_claims (user_id, reward_day, claimed_date, reward)
  VALUES (auth.uid(), v_day, v_today, v_rewards[v_day]);

  INSERT INTO resource_transactions (user_id, source_type, resource_type, amount, balance_after, metadata)
  SELECT auth.uid(), 'daily_reward', 'cash', v_cash, p.cash, jsonb_build_object('day', v_day, 'streak', v_streak)
  FROM players p WHERE p.id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'cash', v_cash, 'diamonds', v_diamonds, 'streak', v_streak, 'day', v_day);
END;
$$;

-- ─── RPC: start_troop_training ────────────────────────────────────────────────
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
  v_cash_cost integer;
  v_duration integer;
  v_ends_at timestamptz;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  -- Base cost per troop type (per unit)
  v_cash_cost := CASE p_troop_type
    WHEN 'street_thugs' THEN 100
    WHEN 'hitmen'       THEN 500
    WHEN 'bodyguards'   THEN 300
    WHEN 'bikers'       THEN 800
    WHEN 'vehicle_crew' THEN 1500
    WHEN 'heavy_crew'   THEN 3000
    ELSE 200
  END * p_amount * p_tier;

  v_duration := CASE p_troop_type
    WHEN 'street_thugs' THEN 30
    WHEN 'hitmen'       THEN 120
    WHEN 'bodyguards'   THEN 90
    WHEN 'bikers'       THEN 180
    WHEN 'vehicle_crew' THEN 300
    WHEN 'heavy_crew'   THEN 600
    ELSE 60
  END * p_amount;

  IF v_player.cash < v_cash_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli nakit yok');
  END IF;

  UPDATE players SET cash = cash - v_cash_cost, updated_at = now() WHERE id = auth.uid();

  v_ends_at := now() + (v_duration || ' seconds')::interval;

  INSERT INTO troop_training_queue (user_id, troop_type, tier, amount, started_at, ends_at, status)
  VALUES (auth.uid(), p_troop_type, p_tier, p_amount, now(), v_ends_at, 'training');

  RETURN jsonb_build_object('ok', true, 'ends_at', v_ends_at, 'duration', v_duration);
END;
$$;
GRANT EXECUTE ON FUNCTION start_troop_training(text, integer, integer) TO authenticated;

-- ─── RPC: complete_troop_training ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_troop_training(p_queue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queue troop_training_queue%ROWTYPE;
BEGIN
  SELECT * INTO v_queue FROM troop_training_queue WHERE id = p_queue_id AND user_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Egitim kaydı bulunamadi'); END IF;

  IF v_queue.status != 'training' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bu egitim aktif degil');
  END IF;

  IF v_queue.ends_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Egitim suresi dolmadi', 'ends_at', v_queue.ends_at);
  END IF;

  UPDATE troop_training_queue SET status = 'completed' WHERE id = p_queue_id;

  INSERT INTO troops (user_id, troop_type, tier, amount)
  VALUES (auth.uid(), v_queue.troop_type, v_queue.tier, v_queue.amount)
  ON CONFLICT (user_id, troop_type, tier)
  DO UPDATE SET amount = troops.amount + EXCLUDED.amount, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'troop_type', v_queue.troop_type, 'amount', v_queue.amount);
END;
$$;
GRANT EXECUTE ON FUNCTION complete_troop_training(uuid) TO authenticated;

-- ─── RPC: start_research ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION start_research(p_research_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_def research_definitions%ROWTYPE;
  v_user_res user_research%ROWTYPE;
  v_player players%ROWTYPE;
  v_current_level integer := 0;
  v_cash_cost integer;
  v_intel_cost integer;
  v_duration integer;
  v_ends_at timestamptz;
  v_active_count integer;
BEGIN
  SELECT * INTO v_def FROM research_definitions WHERE id = p_research_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Arastirma bulunamadi'); END IF;

  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  SELECT * INTO v_user_res FROM user_research WHERE user_id = auth.uid() AND research_id = p_research_id;
  IF FOUND THEN v_current_level := v_user_res.level; END IF;

  IF v_current_level >= v_def.max_level THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bu arastirma maksimum seviyede');
  END IF;

  SELECT COUNT(*) INTO v_active_count FROM user_research
  WHERE user_id = auth.uid() AND is_researching = true;
  IF v_active_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Zaten aktif bir arastirma var');
  END IF;

  v_cash_cost  := COALESCE((v_def.base_cost->>'cash')::integer, 0)  * (v_current_level + 1);
  v_intel_cost := COALESCE((v_def.base_cost->>'intel')::integer, 0) * (v_current_level + 1);
  v_duration   := v_def.base_duration * (v_current_level + 1);

  IF v_player.cash < v_cash_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli nakit yok');
  END IF;
  IF v_player.intel < v_intel_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli istihbarat yok');
  END IF;

  UPDATE players
  SET cash  = cash  - v_cash_cost,
      intel = intel - v_intel_cost,
      updated_at = now()
  WHERE id = auth.uid();

  v_ends_at := now() + (v_duration || ' seconds')::interval;

  INSERT INTO user_research (user_id, research_id, level, started_at, ends_at, is_researching)
  VALUES (auth.uid(), p_research_id, v_current_level, now(), v_ends_at, true)
  ON CONFLICT (user_id, research_id)
  DO UPDATE SET started_at = now(), ends_at = v_ends_at, is_researching = true;

  RETURN jsonb_build_object('ok', true, 'ends_at', v_ends_at, 'duration', v_duration);
END;
$$;
GRANT EXECUTE ON FUNCTION start_research(uuid) TO authenticated;

-- ─── RPC: complete_research ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_research(p_research_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_res user_research%ROWTYPE;
  v_def research_definitions%ROWTYPE;
BEGIN
  SELECT * INTO v_user_res FROM user_research WHERE user_id = auth.uid() AND research_id = p_research_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Arastirma kaydı bulunamadi'); END IF;

  IF NOT v_user_res.is_researching THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Arastirma aktif degil');
  END IF;

  IF v_user_res.ends_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Arastirma suresi dolmadi', 'ends_at', v_user_res.ends_at);
  END IF;

  SELECT * INTO v_def FROM research_definitions WHERE id = p_research_id;

  UPDATE user_research
  SET level = level + 1, is_researching = false, started_at = null, ends_at = null
  WHERE user_id = auth.uid() AND research_id = p_research_id;

  UPDATE players SET xp = xp + 200 * (v_user_res.level + 1), updated_at = now() WHERE id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'new_level', v_user_res.level + 1, 'research_key', v_def.key);
END;
$$;
GRANT EXECUTE ON FUNCTION complete_research(uuid) TO authenticated;

-- Grant execute on new functions
GRANT EXECUTE ON FUNCTION open_chest(text)           TO authenticated;
GRANT EXECUTE ON FUNCTION claim_daily_reward()       TO authenticated;
