-- Achievement definitions
CREATE TABLE IF NOT EXISTS achievement_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  icon TEXT NOT NULL DEFAULT 'star',
  rarity TEXT NOT NULL DEFAULT 'common',
  target_value INTEGER NOT NULL DEFAULT 1,
  reward_type TEXT,
  reward_amount INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE achievement_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone_can_read_achievements" ON achievement_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "anon_can_read_achievements" ON achievement_definitions FOR SELECT TO anon USING (true);

-- Player achievement progress
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES players(id),
  achievement_key TEXT NOT NULL REFERENCES achievement_definitions(key),
  current_value INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  is_claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_achievements" ON user_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_achievements" ON user_achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_achievements" ON user_achievements FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_achievements" ON user_achievements FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Seed achievement definitions
INSERT INTO achievement_definitions (key, name, description, category, icon, rarity, target_value, reward_type, reward_amount, sort_order) VALUES
-- Combat achievements
('first_blood', 'Ilk Kan', 'Ilk PvP saldirini gerceklestir', 'combat', 'swords', 'common', 1, 'cash', 5000, 1),
('warrior_10', 'Savasci', '10 PvP saldiri gerceklestir', 'combat', 'swords', 'rare', 10, 'diamonds', 20, 2),
('warrior_50', 'Gladyator', '50 PvP saldiri gerceklestir', 'combat', 'swords', 'epic', 50, 'diamonds', 100, 3),
('warrior_200', 'Savas Lordu', '200 PvP saldiri gerceklestir', 'combat', 'crown', 'legendary', 200, 'diamonds', 500, 4),
('npc_slayer_10', 'Avci', '10 NPC hedefi yen', 'combat', 'crosshair', 'common', 10, 'cash', 10000, 5),
('npc_slayer_50', 'Katil', '50 NPC hedefi yen', 'combat', 'crosshair', 'rare', 50, 'diamonds', 50, 6),
('undefeated_5', 'Yenilmez', '5 ust uste PvP galibiyeti kazanin', 'combat', 'shield', 'epic', 5, 'diamonds', 75, 7),

-- Building achievements
('first_build', 'Mimar', 'Ilk binani kur', 'building', 'building', 'common', 1, 'cash', 3000, 10),
('builder_5', 'Usta Mimar', '5 binayi Lv.5 yap', 'building', 'building', 'rare', 5, 'diamonds', 30, 11),
('builder_10', 'Sehir Planlayici', '5 binayi Lv.10 yap', 'building', 'building', 'epic', 5, 'diamonds', 100, 12),
('collector_100k', 'Hasat Ustasi', 'Toplamda 100K kaynak topla', 'building', 'coins', 'rare', 100000, 'cash', 20000, 13),

-- Mission achievements
('mission_first', 'Karanlik Baslangic', 'Ilk gorevini tamamla', 'mission', 'target', 'common', 1, 'cash', 2000, 20),
('mission_25', 'Profesyonel', '25 gorev tamamla', 'mission', 'target', 'rare', 25, 'diamonds', 25, 21),
('mission_100', 'Efsane', '100 gorev tamamla', 'mission', 'target', 'epic', 100, 'diamonds', 100, 22),
('heat_survivor', 'Polisten Kacan', 'Polis isisi %80 ustundeyken gorev tamamla', 'mission', 'flame', 'epic', 1, 'diamonds', 50, 23),

-- Economy achievements
('rich_100k', 'Zengin', '100K nakit biriktir', 'economy', 'banknote', 'common', 100000, 'diamonds', 10, 30),
('rich_1m', 'Milyoner', '1M nakit biriktir', 'economy', 'banknote', 'rare', 1000000, 'diamonds', 50, 31),
('diamond_hoarder', '500 elmas biriktir', 'Elmas Koleksiyoncusu', 'economy', 'gem', 'epic', 500, 'cash', 50000, 32),

-- Social achievements
('family_join', 'Aile Bagi', 'Bir aileye katil', 'social', 'users', 'common', 1, 'cash', 5000, 40),
('family_donate', 'Cömert', 'Aileye 10 kez bagis yap', 'social', 'heart', 'rare', 10, 'diamonds', 30, 41),
('territory_capture', 'Fatih', 'Bir bolgeyi ele gecir', 'social', 'map', 'epic', 1, 'diamonds', 75, 42),

-- Progression achievements
('level_5', 'Acemi', 'Seviye 5 ol', 'progression', 'zap', 'common', 5, 'cash', 5000, 50),
('level_10', 'Deneyimli', 'Seviye 10 ol', 'progression', 'zap', 'rare', 10, 'diamonds', 25, 51),
('level_20', 'Usta', 'Seviye 20 ol', 'progression', 'zap', 'epic', 20, 'diamonds', 100, 52),
('level_50', 'Efsanevi', 'Seviye 50 ol', 'progression', 'zap', 'legendary', 50, 'diamonds', 500, 53),
('power_1000', 'Guclu', '1000 guce ulas', 'progression', 'shield', 'rare', 1000, 'diamonds', 20, 54),
('power_10000', 'Korkunç', '10000 guce ulas', 'progression', 'shield', 'epic', 10000, 'diamonds', 100, 55),

-- Retention achievements
('login_7', 'Sadik', '7 gun ust uste giris yap', 'retention', 'calendar', 'common', 7, 'diamonds', 15, 60),
('login_30', 'Bagimsiz', '30 gun ust uste giris yap', 'retention', 'calendar', 'rare', 30, 'diamonds', 75, 61),
('quest_master', 'Gorev Gurusu', 'Gunluk tum gorevleri tamamla', 'retention', 'star', 'rare', 1, 'diamonds', 20, 62)
ON CONFLICT (key) DO NOTHING;

-- RPC: Get achievements with progress
CREATE OR REPLACE FUNCTION get_achievements()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_defs JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.sort_order)
  INTO v_defs
  FROM (
    SELECT
      d.key,
      d.name,
      d.description,
      d.category,
      d.icon,
      d.rarity,
      d.target_value,
      d.reward_type,
      d.reward_amount,
      d.sort_order,
      COALESCE(ua.current_value, 0) AS current_value,
      COALESCE(ua.is_completed, false) AS is_completed,
      ua.completed_at,
      COALESCE(ua.is_claimed, false) AS is_claimed
    FROM achievement_definitions d
    LEFT JOIN user_achievements ua ON ua.achievement_key = d.key AND ua.user_id = v_uid
  ) t;

  RETURN jsonb_build_object('ok', true, 'achievements', COALESCE(v_defs, '[]'::jsonb));
END;
$$;

-- RPC: Claim achievement reward
CREATE OR REPLACE FUNCTION claim_achievement_reward(p_achievement_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ach user_achievements%ROWTYPE;
  v_def achievement_definitions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_ach FROM user_achievements WHERE user_id = v_uid AND achievement_key = p_achievement_key;
  IF NOT FOUND OR NOT v_ach.is_completed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Achievement not completed');
  END IF;
  IF v_ach.is_claimed THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already claimed');
  END IF;

  SELECT * INTO v_def FROM achievement_definitions WHERE key = p_achievement_key;

  -- Grant reward
  IF v_def.reward_type = 'cash' THEN
    UPDATE players SET cash = cash + v_def.reward_amount WHERE id = v_uid;
  ELSIF v_def.reward_type = 'diamonds' THEN
    UPDATE players SET diamonds = diamonds + v_def.reward_amount WHERE id = v_uid;
  ELSIF v_def.reward_type = 'xp' THEN
    UPDATE players SET xp = xp + v_def.reward_amount WHERE id = v_uid;
  END IF;

  UPDATE user_achievements SET is_claimed = true, claimed_at = now() WHERE id = v_ach.id;

  RETURN jsonb_build_object('ok', true, 'reward_type', v_def.reward_type, 'reward_amount', v_def.reward_amount);
END;
$$;

-- RPC: Increment achievement progress (called internally)
CREATE OR REPLACE FUNCTION increment_achievement(p_user_id UUID, p_achievement_key TEXT, p_amount INTEGER DEFAULT 1)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_def achievement_definitions%ROWTYPE;
  v_current INTEGER;
BEGIN
  SELECT * INTO v_def FROM achievement_definitions WHERE key = p_achievement_key;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO user_achievements (user_id, achievement_key, current_value, is_completed, completed_at)
  VALUES (p_user_id, p_achievement_key, LEAST(p_amount, v_def.target_value),
    p_amount >= v_def.target_value,
    CASE WHEN p_amount >= v_def.target_value THEN now() ELSE NULL END)
  ON CONFLICT (user_id, achievement_key)
  DO UPDATE SET
    current_value = LEAST(user_achievements.current_value + p_amount, v_def.target_value),
    is_completed = CASE WHEN user_achievements.current_value + p_amount >= v_def.target_value THEN true ELSE user_achievements.is_completed END,
    completed_at = CASE
      WHEN NOT user_achievements.is_completed AND user_achievements.current_value + p_amount >= v_def.target_value THEN now()
      ELSE user_achievements.completed_at
    END;
END;
$$;

-- RPC: Set achievement value (for absolute values like level, cash)
CREATE OR REPLACE FUNCTION set_achievement_value(p_user_id UUID, p_achievement_key TEXT, p_value INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_def achievement_definitions%ROWTYPE;
BEGIN
  SELECT * INTO v_def FROM achievement_definitions WHERE key = p_achievement_key;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO user_achievements (user_id, achievement_key, current_value, is_completed, completed_at)
  VALUES (p_user_id, p_achievement_key, LEAST(p_value, v_def.target_value),
    p_value >= v_def.target_value,
    CASE WHEN p_value >= v_def.target_value THEN now() ELSE NULL END)
  ON CONFLICT (user_id, achievement_key)
  DO UPDATE SET
    current_value = GREATEST(user_achievements.current_value, LEAST(p_value, v_def.target_value)),
    is_completed = CASE WHEN GREATEST(user_achievements.current_value, p_value) >= v_def.target_value THEN true ELSE user_achievements.is_completed END,
    completed_at = CASE
      WHEN NOT user_achievements.is_completed AND GREATEST(user_achievements.current_value, p_value) >= v_def.target_value THEN now()
      ELSE user_achievements.completed_at
    END;
END;
$$;
