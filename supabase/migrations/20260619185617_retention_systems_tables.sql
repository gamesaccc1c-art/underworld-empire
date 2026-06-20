
-- Daily login rewards
CREATE TABLE IF NOT EXISTS daily_login_rewards (
  day_number int PRIMARY KEY CHECK (day_number BETWEEN 1 AND 7),
  cash bigint NOT NULL DEFAULT 0,
  diamonds int NOT NULL DEFAULT 0,
  xp int NOT NULL DEFAULT 0,
  label text
);

CREATE TABLE IF NOT EXISTS user_login_streaks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_day int NOT NULL DEFAULT 1,
  last_claim_date date,
  total_claims int NOT NULL DEFAULT 0
);

ALTER TABLE user_login_streaks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_login_streak" ON user_login_streaks;
CREATE POLICY "own_login_streak" ON user_login_streaks FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Daily quests
CREATE TABLE IF NOT EXISTS quest_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_type text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  points int NOT NULL DEFAULT 10,
  target_value int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE quest_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_quest_defs" ON quest_definitions;
CREATE POLICY "read_quest_defs" ON quest_definitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "no_insert_quest_defs" ON quest_definitions;
CREATE POLICY "no_insert_quest_defs" ON quest_definitions FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_quest_defs" ON quest_definitions;
CREATE POLICY "no_update_quest_defs" ON quest_definitions FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_quest_defs" ON quest_definitions;
CREATE POLICY "no_delete_quest_defs" ON quest_definitions FOR DELETE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS daily_quest_thresholds (
  id int PRIMARY KEY,
  required_points int NOT NULL,
  chest_type text NOT NULL CHECK (chest_type IN ('bronze', 'silver', 'gold'))
);

ALTER TABLE daily_quest_thresholds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_dq_thresholds" ON daily_quest_thresholds;
CREATE POLICY "read_dq_thresholds" ON daily_quest_thresholds FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "no_insert_dq_thresholds" ON daily_quest_thresholds;
CREATE POLICY "no_insert_dq_thresholds" ON daily_quest_thresholds FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_dq_thresholds" ON daily_quest_thresholds;
CREATE POLICY "no_update_dq_thresholds" ON daily_quest_thresholds FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_dq_thresholds" ON daily_quest_thresholds;
CREATE POLICY "no_delete_dq_thresholds" ON daily_quest_thresholds FOR DELETE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS user_daily_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_type text NOT NULL,
  quest_date date NOT NULL DEFAULT CURRENT_DATE,
  current_value int NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  UNIQUE(user_id, quest_type, quest_date)
);

ALTER TABLE user_daily_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_daily_quests" ON user_daily_quests;
CREATE POLICY "own_daily_quests" ON user_daily_quests FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "no_insert_daily_quests" ON user_daily_quests;
CREATE POLICY "no_insert_daily_quests" ON user_daily_quests FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_daily_quests" ON user_daily_quests;
CREATE POLICY "no_update_daily_quests" ON user_daily_quests FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_daily_quests" ON user_daily_quests;
CREATE POLICY "no_delete_daily_quests" ON user_daily_quests FOR DELETE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS user_daily_threshold_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  threshold_id int NOT NULL,
  claim_date date NOT NULL DEFAULT CURRENT_DATE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, threshold_id, claim_date)
);

ALTER TABLE user_daily_threshold_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_threshold_claims" ON user_daily_threshold_claims;
CREATE POLICY "own_threshold_claims" ON user_daily_threshold_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "no_insert_threshold_claims" ON user_daily_threshold_claims;
CREATE POLICY "no_insert_threshold_claims" ON user_daily_threshold_claims FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_threshold_claims" ON user_daily_threshold_claims;
CREATE POLICY "no_update_threshold_claims" ON user_daily_threshold_claims FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_threshold_claims" ON user_daily_threshold_claims;
CREATE POLICY "no_delete_threshold_claims" ON user_daily_threshold_claims FOR DELETE TO authenticated USING (false);

-- Weekly quests
CREATE TABLE IF NOT EXISTS weekly_quest_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_type text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  target_value int NOT NULL DEFAULT 1,
  reward_cash bigint NOT NULL DEFAULT 0,
  reward_diamonds int NOT NULL DEFAULT 0,
  reward_xp int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE weekly_quest_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_weekly_quest_defs" ON weekly_quest_definitions;
CREATE POLICY "read_weekly_quest_defs" ON weekly_quest_definitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "no_insert_weekly_quest_defs" ON weekly_quest_definitions;
CREATE POLICY "no_insert_weekly_quest_defs" ON weekly_quest_definitions FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_weekly_quest_defs" ON weekly_quest_definitions;
CREATE POLICY "no_update_weekly_quest_defs" ON weekly_quest_definitions FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_weekly_quest_defs" ON weekly_quest_definitions;
CREATE POLICY "no_delete_weekly_quest_defs" ON weekly_quest_definitions FOR DELETE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS user_weekly_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_type text NOT NULL,
  week_start date NOT NULL,
  current_value int NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  is_claimed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  claimed_at timestamptz,
  UNIQUE(user_id, quest_type, week_start)
);

ALTER TABLE user_weekly_quests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_weekly_quests" ON user_weekly_quests;
CREATE POLICY "own_weekly_quests" ON user_weekly_quests FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "no_insert_weekly_quests" ON user_weekly_quests;
CREATE POLICY "no_insert_weekly_quests" ON user_weekly_quests FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_weekly_quests" ON user_weekly_quests;
CREATE POLICY "no_update_weekly_quests" ON user_weekly_quests FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_weekly_quests" ON user_weekly_quests;
CREATE POLICY "no_delete_weekly_quests" ON user_weekly_quests FOR DELETE TO authenticated USING (false);

-- Battle Pass
CREATE TABLE IF NOT EXISTS battle_pass_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_number int NOT NULL UNIQUE,
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  premium_cost_diamonds int NOT NULL DEFAULT 1000
);

ALTER TABLE battle_pass_seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_bp_seasons" ON battle_pass_seasons;
CREATE POLICY "read_bp_seasons" ON battle_pass_seasons FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "no_insert_bp_seasons" ON battle_pass_seasons;
CREATE POLICY "no_insert_bp_seasons" ON battle_pass_seasons FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_bp_seasons" ON battle_pass_seasons;
CREATE POLICY "no_update_bp_seasons" ON battle_pass_seasons FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_bp_seasons" ON battle_pass_seasons;
CREATE POLICY "no_delete_bp_seasons" ON battle_pass_seasons FOR DELETE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS battle_pass_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
  level_number int NOT NULL,
  xp_required int NOT NULL DEFAULT 200,
  free_reward_type text,
  free_reward_amount int NOT NULL DEFAULT 0,
  premium_reward_type text,
  premium_reward_amount int NOT NULL DEFAULT 0,
  UNIQUE(season_id, level_number)
);

ALTER TABLE battle_pass_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_bp_levels" ON battle_pass_levels;
CREATE POLICY "read_bp_levels" ON battle_pass_levels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "no_insert_bp_levels" ON battle_pass_levels;
CREATE POLICY "no_insert_bp_levels" ON battle_pass_levels FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_bp_levels" ON battle_pass_levels;
CREATE POLICY "no_update_bp_levels" ON battle_pass_levels FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_bp_levels" ON battle_pass_levels;
CREATE POLICY "no_delete_bp_levels" ON battle_pass_levels FOR DELETE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS user_battle_pass (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
  current_level int NOT NULL DEFAULT 1,
  current_xp int NOT NULL DEFAULT 0,
  total_xp int NOT NULL DEFAULT 0,
  is_premium boolean NOT NULL DEFAULT false,
  unlocked_at timestamptz,
  UNIQUE(user_id, season_id)
);

ALTER TABLE user_battle_pass ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_bp" ON user_battle_pass;
CREATE POLICY "own_bp" ON user_battle_pass FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "no_insert_bp" ON user_battle_pass;
CREATE POLICY "no_insert_bp" ON user_battle_pass FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_bp" ON user_battle_pass;
CREATE POLICY "no_update_bp" ON user_battle_pass FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_bp" ON user_battle_pass;
CREATE POLICY "no_delete_bp" ON user_battle_pass FOR DELETE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS user_bp_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES battle_pass_seasons(id) ON DELETE CASCADE,
  level_number int NOT NULL,
  reward_track text NOT NULL CHECK (reward_track IN ('free', 'premium')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, season_id, level_number, reward_track)
);

ALTER TABLE user_bp_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_bp_claims" ON user_bp_claims;
CREATE POLICY "own_bp_claims" ON user_bp_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "no_insert_bp_claims" ON user_bp_claims;
CREATE POLICY "no_insert_bp_claims" ON user_bp_claims FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_bp_claims" ON user_bp_claims;
CREATE POLICY "no_update_bp_claims" ON user_bp_claims FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_bp_claims" ON user_bp_claims;
CREATE POLICY "no_delete_bp_claims" ON user_bp_claims FOR DELETE TO authenticated USING (false);

-- Events
CREATE TABLE IF NOT EXISTS event_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE event_definitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_event_defs" ON event_definitions;
CREATE POLICY "read_event_defs" ON event_definitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "no_insert_event_defs" ON event_definitions;
CREATE POLICY "no_insert_event_defs" ON event_definitions FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_event_defs" ON event_definitions;
CREATE POLICY "no_update_event_defs" ON event_definitions FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_event_defs" ON event_definitions;
CREATE POLICY "no_delete_event_defs" ON event_definitions FOR DELETE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS event_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES event_definitions(id) ON DELETE CASCADE,
  points bigint NOT NULL DEFAULT 0,
  rank int,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

ALTER TABLE event_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_event_progress" ON event_progress;
CREATE POLICY "own_event_progress" ON event_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "no_insert_event_progress" ON event_progress;
CREATE POLICY "no_insert_event_progress" ON event_progress FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_update_event_progress" ON event_progress;
CREATE POLICY "no_update_event_progress" ON event_progress FOR UPDATE TO authenticated USING (false);
DROP POLICY IF EXISTS "no_delete_event_progress" ON event_progress;
CREATE POLICY "no_delete_event_progress" ON event_progress FOR DELETE TO authenticated USING (false);

-- Notifications
CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON user_notifications(user_id, is_read, created_at DESC);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own_notifications_select" ON user_notifications;
CREATE POLICY "own_notifications_select" ON user_notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own_notifications_update" ON user_notifications;
CREATE POLICY "own_notifications_update" ON user_notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "no_insert_notifications" ON user_notifications;
CREATE POLICY "no_insert_notifications" ON user_notifications FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "no_delete_notifications" ON user_notifications;
CREATE POLICY "no_delete_notifications" ON user_notifications FOR DELETE TO authenticated USING (false);
