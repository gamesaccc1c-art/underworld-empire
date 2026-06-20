
-- Helper: add battle pass XP
CREATE OR REPLACE FUNCTION _add_bp_xp(p_user_id uuid, p_xp int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_season_id uuid;
  v_bp record;
  v_level_xp_required int;
  v_new_xp int;
  v_new_level int;
BEGIN
  SELECT id INTO v_season_id FROM battle_pass_seasons WHERE is_active = true LIMIT 1;
  IF v_season_id IS NULL THEN RETURN; END IF;

  INSERT INTO user_battle_pass(user_id, season_id, current_level, current_xp, total_xp)
  VALUES (p_user_id, v_season_id, 1, 0, 0)
  ON CONFLICT (user_id, season_id) DO NOTHING;

  SELECT * INTO v_bp FROM user_battle_pass WHERE user_id = p_user_id AND season_id = v_season_id;
  v_new_xp := v_bp.current_xp + p_xp;
  v_new_level := v_bp.current_level;

  LOOP
    SELECT xp_required INTO v_level_xp_required
    FROM battle_pass_levels
    WHERE season_id = v_season_id AND level_number = v_new_level
    LIMIT 1;
    EXIT WHEN v_level_xp_required IS NULL;
    EXIT WHEN v_new_xp < v_level_xp_required;
    v_new_xp := v_new_xp - v_level_xp_required;
    v_new_level := v_new_level + 1;
    EXIT WHEN v_new_level > 50;
  END LOOP;

  UPDATE user_battle_pass
  SET current_xp = v_new_xp,
      current_level = LEAST(v_new_level, 50),
      total_xp = total_xp + p_xp
  WHERE user_id = p_user_id AND season_id = v_season_id;
END;
$$;

-- Helper: increment quest progress
CREATE OR REPLACE FUNCTION increment_quest_progress(p_user_id uuid, p_quest_type text, p_amount int DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_def record;
  v_quest record;
  v_week_start date;
  v_daily_points int;
BEGIN
  v_week_start := DATE_TRUNC('week', CURRENT_DATE)::date;

  -- Daily quest
  SELECT * INTO v_def FROM quest_definitions WHERE quest_type = p_quest_type AND is_active = true LIMIT 1;
  IF v_def IS NOT NULL THEN
    INSERT INTO user_daily_quests(user_id, quest_type, quest_date, current_value)
    VALUES (p_user_id, p_quest_type, CURRENT_DATE, 0)
    ON CONFLICT (user_id, quest_type, quest_date) DO NOTHING;

    UPDATE user_daily_quests
    SET current_value = LEAST(current_value + p_amount, v_def.target_value),
        is_completed = (current_value + p_amount >= v_def.target_value),
        completed_at = CASE WHEN is_completed = false AND current_value + p_amount >= v_def.target_value THEN now() ELSE completed_at END
    WHERE user_id = p_user_id AND quest_type = p_quest_type AND quest_date = CURRENT_DATE;
  END IF;

  -- Weekly quest
  SELECT * INTO v_def FROM weekly_quest_definitions WHERE quest_type = p_quest_type AND is_active = true LIMIT 1;
  IF v_def IS NOT NULL THEN
    INSERT INTO user_weekly_quests(user_id, quest_type, week_start, current_value)
    VALUES (p_user_id, p_quest_type, v_week_start, 0)
    ON CONFLICT (user_id, quest_type, week_start) DO NOTHING;

    UPDATE user_weekly_quests
    SET current_value = LEAST(current_value + p_amount, v_def.target_value),
        is_completed = (current_value + p_amount >= v_def.target_value),
        completed_at = CASE WHEN is_completed = false AND current_value + p_amount >= v_def.target_value THEN now() ELSE completed_at END
    WHERE user_id = p_user_id AND quest_type = p_quest_type AND week_start = v_week_start;
  END IF;
END;
$$;

-- Claim daily login reward
CREATE OR REPLACE FUNCTION claim_daily_login()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_streak record;
  v_reward record;
  v_next_day int;
  v_today date := CURRENT_DATE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oturum açık değil'); END IF;

  INSERT INTO user_login_streaks(user_id, current_day, last_claim_date)
  VALUES (v_uid, 1, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_streak FROM user_login_streaks WHERE user_id = v_uid;

  IF v_streak.last_claim_date = v_today THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bugün zaten ödülünü aldın');
  END IF;

  IF v_streak.last_claim_date = v_today - 1 THEN
    v_next_day := CASE WHEN v_streak.current_day >= 7 THEN 1 ELSE v_streak.current_day + 1 END;
  ELSE
    v_next_day := 1;
  END IF;

  SELECT * INTO v_reward FROM daily_login_rewards WHERE day_number = v_next_day;
  IF v_reward IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Ödül bulunamadı'); END IF;

  UPDATE players
  SET cash = cash + v_reward.cash,
      diamonds = diamonds + v_reward.diamonds,
      xp = xp + v_reward.xp
  WHERE id = v_uid;

  UPDATE user_login_streaks
  SET current_day = v_next_day,
      last_claim_date = v_today,
      total_claims = total_claims + 1
  WHERE user_id = v_uid;

  PERFORM _add_bp_xp(v_uid, 50);

  RETURN jsonb_build_object(
    'ok', true,
    'day', v_next_day,
    'cash', v_reward.cash,
    'diamonds', v_reward.diamonds,
    'xp', v_reward.xp,
    'label', v_reward.label
  );
END;
$$;

-- Get daily quests
CREATE OR REPLACE FUNCTION get_daily_quests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_streak record;
  v_total_points int := 0;
  v_claimed_thresholds int[];
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

  -- Ensure today's quest rows exist
  INSERT INTO user_daily_quests(user_id, quest_type, quest_date, current_value)
  SELECT v_uid, quest_type, CURRENT_DATE, 0
  FROM quest_definitions WHERE is_active = true
  ON CONFLICT DO NOTHING;

  -- Sum points for completed quests
  SELECT COALESCE(SUM(qd.points), 0) INTO v_total_points
  FROM user_daily_quests udq
  JOIN quest_definitions qd ON qd.quest_type = udq.quest_type
  WHERE udq.user_id = v_uid AND udq.quest_date = CURRENT_DATE AND udq.is_completed = true;

  SELECT COALESCE(ARRAY_AGG(threshold_id), ARRAY[]::int[]) INTO v_claimed_thresholds
  FROM user_daily_threshold_claims
  WHERE user_id = v_uid AND claim_date = CURRENT_DATE;

  SELECT * INTO v_streak FROM user_login_streaks WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'quests', (
      SELECT jsonb_agg(jsonb_build_object(
        'quest_type', qd.quest_type,
        'name', qd.name,
        'description', qd.description,
        'points', qd.points,
        'target_value', qd.target_value,
        'current_value', COALESCE(udq.current_value, 0),
        'is_completed', COALESCE(udq.is_completed, false)
      ) ORDER BY qd.points)
      FROM quest_definitions qd
      LEFT JOIN user_daily_quests udq ON udq.quest_type = qd.quest_type AND udq.user_id = v_uid AND udq.quest_date = CURRENT_DATE
      WHERE qd.is_active = true
    ),
    'total_points', v_total_points,
    'thresholds', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'required_points', required_points,
        'chest_type', chest_type,
        'is_claimed', (id = ANY(v_claimed_thresholds))
      ) ORDER BY id)
      FROM daily_quest_thresholds
    ),
    'login_streak', jsonb_build_object(
      'current_day', COALESCE(v_streak.current_day, 1),
      'last_claim_date', v_streak.last_claim_date,
      'total_claims', COALESCE(v_streak.total_claims, 0)
    ),
    'login_rewards', (
      SELECT jsonb_agg(jsonb_build_object(
        'day_number', day_number,
        'cash', cash,
        'diamonds', diamonds,
        'xp', xp,
        'label', label
      ) ORDER BY day_number)
      FROM daily_login_rewards
    )
  );
END;
$$;

-- Claim daily threshold chest
CREATE OR REPLACE FUNCTION claim_daily_threshold(p_threshold_id int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_threshold record;
  v_total_points int := 0;
  v_chest_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oturum açık değil'); END IF;

  SELECT * INTO v_threshold FROM daily_quest_thresholds WHERE id = p_threshold_id;
  IF v_threshold IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Eşik bulunamadı'); END IF;

  IF EXISTS (SELECT 1 FROM user_daily_threshold_claims WHERE user_id = v_uid AND threshold_id = p_threshold_id AND claim_date = CURRENT_DATE) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Zaten talep edildi');
  END IF;

  SELECT COALESCE(SUM(qd.points), 0) INTO v_total_points
  FROM user_daily_quests udq
  JOIN quest_definitions qd ON qd.quest_type = udq.quest_type
  WHERE udq.user_id = v_uid AND udq.quest_date = CURRENT_DATE AND udq.is_completed = true;

  IF v_total_points < v_threshold.required_points THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yeterli puan yok');
  END IF;

  INSERT INTO user_daily_threshold_claims(user_id, threshold_id, claim_date)
  VALUES (v_uid, p_threshold_id, CURRENT_DATE);

  v_chest_result := open_game_chest(v_threshold.chest_type);

  PERFORM _add_bp_xp(v_uid, 100);

  RETURN jsonb_build_object('ok', true, 'chest_result', v_chest_result, 'chest_type', v_threshold.chest_type);
END;
$$;

-- Get weekly quests
CREATE OR REPLACE FUNCTION get_weekly_quests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_week_start date := DATE_TRUNC('week', CURRENT_DATE)::date;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

  INSERT INTO user_weekly_quests(user_id, quest_type, week_start, current_value)
  SELECT v_uid, quest_type, v_week_start, 0
  FROM weekly_quest_definitions WHERE is_active = true
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'ok', true,
    'week_start', v_week_start,
    'quests', (
      SELECT jsonb_agg(jsonb_build_object(
        'quest_type', wqd.quest_type,
        'name', wqd.name,
        'description', wqd.description,
        'target_value', wqd.target_value,
        'reward_cash', wqd.reward_cash,
        'reward_diamonds', wqd.reward_diamonds,
        'reward_xp', wqd.reward_xp,
        'current_value', COALESCE(uwq.current_value, 0),
        'is_completed', COALESCE(uwq.is_completed, false),
        'is_claimed', COALESCE(uwq.is_claimed, false)
      ) ORDER BY wqd.reward_diamonds DESC)
      FROM weekly_quest_definitions wqd
      LEFT JOIN user_weekly_quests uwq ON uwq.quest_type = wqd.quest_type AND uwq.user_id = v_uid AND uwq.week_start = v_week_start
      WHERE wqd.is_active = true
    )
  );
END;
$$;

-- Claim weekly quest reward
CREATE OR REPLACE FUNCTION claim_weekly_quest(p_quest_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_week_start date := DATE_TRUNC('week', CURRENT_DATE)::date;
  v_def record;
  v_quest record;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oturum açık değil'); END IF;

  SELECT * INTO v_def FROM weekly_quest_definitions WHERE quest_type = p_quest_type;
  IF v_def IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Görev bulunamadı'); END IF;

  SELECT * INTO v_quest FROM user_weekly_quests WHERE user_id = v_uid AND quest_type = p_quest_type AND week_start = v_week_start;
  IF v_quest IS NULL OR NOT v_quest.is_completed THEN RETURN jsonb_build_object('ok', false, 'error', 'Görev tamamlanmadı'); END IF;
  IF v_quest.is_claimed THEN RETURN jsonb_build_object('ok', false, 'error', 'Zaten talep edildi'); END IF;

  UPDATE players
  SET cash = cash + v_def.reward_cash,
      diamonds = diamonds + v_def.reward_diamonds,
      xp = xp + v_def.reward_xp
  WHERE id = v_uid;

  UPDATE user_weekly_quests
  SET is_claimed = true, claimed_at = now()
  WHERE user_id = v_uid AND quest_type = p_quest_type AND week_start = v_week_start;

  PERFORM _add_bp_xp(v_uid, 200);

  RETURN jsonb_build_object(
    'ok', true,
    'cash', v_def.reward_cash,
    'diamonds', v_def.reward_diamonds,
    'xp', v_def.reward_xp
  );
END;
$$;

-- Get battle pass
CREATE OR REPLACE FUNCTION get_battle_pass()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_season record;
  v_bp record;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

  SELECT * INTO v_season FROM battle_pass_seasons WHERE is_active = true ORDER BY season_number DESC LIMIT 1;
  IF v_season IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aktif sezon yok'); END IF;

  INSERT INTO user_battle_pass(user_id, season_id, current_level, current_xp, total_xp)
  VALUES (v_uid, v_season.id, 1, 0, 0)
  ON CONFLICT (user_id, season_id) DO NOTHING;

  SELECT * INTO v_bp FROM user_battle_pass WHERE user_id = v_uid AND season_id = v_season.id;

  RETURN jsonb_build_object(
    'ok', true,
    'season', jsonb_build_object(
      'id', v_season.id,
      'season_number', v_season.season_number,
      'name', v_season.name,
      'starts_at', v_season.starts_at,
      'ends_at', v_season.ends_at,
      'premium_cost_diamonds', v_season.premium_cost_diamonds
    ),
    'progress', jsonb_build_object(
      'current_level', v_bp.current_level,
      'current_xp', v_bp.current_xp,
      'total_xp', v_bp.total_xp,
      'is_premium', v_bp.is_premium
    ),
    'levels', (
      SELECT jsonb_agg(jsonb_build_object(
        'level_number', bpl.level_number,
        'xp_required', bpl.xp_required,
        'free_reward_type', bpl.free_reward_type,
        'free_reward_amount', bpl.free_reward_amount,
        'premium_reward_type', bpl.premium_reward_type,
        'premium_reward_amount', bpl.premium_reward_amount,
        'free_claimed', EXISTS(SELECT 1 FROM user_bp_claims WHERE user_id = v_uid AND season_id = v_season.id AND level_number = bpl.level_number AND reward_track = 'free'),
        'premium_claimed', EXISTS(SELECT 1 FROM user_bp_claims WHERE user_id = v_uid AND season_id = v_season.id AND level_number = bpl.level_number AND reward_track = 'premium')
      ) ORDER BY bpl.level_number)
      FROM battle_pass_levels bpl
      WHERE bpl.season_id = v_season.id
    )
  );
END;
$$;

-- Claim battle pass reward
CREATE OR REPLACE FUNCTION claim_bp_reward(p_level_number int, p_track text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_season_id uuid;
  v_bp record;
  v_level record;
  v_reward_type text;
  v_reward_amount int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oturum açık değil'); END IF;
  IF p_track NOT IN ('free', 'premium') THEN RETURN jsonb_build_object('ok', false, 'error', 'Geçersiz track'); END IF;

  SELECT id INTO v_season_id FROM battle_pass_seasons WHERE is_active = true LIMIT 1;
  IF v_season_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aktif sezon yok'); END IF;

  SELECT * INTO v_bp FROM user_battle_pass WHERE user_id = v_uid AND season_id = v_season_id;
  IF v_bp IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'BP kaydı yok'); END IF;
  IF v_bp.current_level < p_level_number THEN RETURN jsonb_build_object('ok', false, 'error', 'Seviye henüz açılmadı'); END IF;
  IF p_track = 'premium' AND NOT v_bp.is_premium THEN RETURN jsonb_build_object('ok', false, 'error', 'Premium gerekli'); END IF;

  IF EXISTS (SELECT 1 FROM user_bp_claims WHERE user_id = v_uid AND season_id = v_season_id AND level_number = p_level_number AND reward_track = p_track) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Zaten talep edildi');
  END IF;

  SELECT * INTO v_level FROM battle_pass_levels WHERE season_id = v_season_id AND level_number = p_level_number;
  IF v_level IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Seviye bulunamadı'); END IF;

  IF p_track = 'free' THEN v_reward_type := v_level.free_reward_type; v_reward_amount := v_level.free_reward_amount;
  ELSE v_reward_type := v_level.premium_reward_type; v_reward_amount := v_level.premium_reward_amount;
  END IF;

  IF v_reward_type = 'cash' THEN UPDATE players SET cash = cash + v_reward_amount WHERE id = v_uid;
  ELSIF v_reward_type = 'diamonds' THEN UPDATE players SET diamonds = diamonds + v_reward_amount WHERE id = v_uid;
  ELSIF v_reward_type = 'xp' THEN UPDATE players SET xp = xp + v_reward_amount WHERE id = v_uid;
  END IF;

  INSERT INTO user_bp_claims(user_id, season_id, level_number, reward_track) VALUES (v_uid, v_season_id, p_level_number, p_track);

  RETURN jsonb_build_object('ok', true, 'reward_type', v_reward_type, 'reward_amount', v_reward_amount);
END;
$$;

-- Unlock premium battle pass
CREATE OR REPLACE FUNCTION unlock_premium_pass()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_season record;
  v_bp record;
  v_player record;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oturum açık değil'); END IF;

  SELECT * INTO v_season FROM battle_pass_seasons WHERE is_active = true LIMIT 1;
  IF v_season IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aktif sezon yok'); END IF;

  INSERT INTO user_battle_pass(user_id, season_id) VALUES (v_uid, v_season.id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_bp FROM user_battle_pass WHERE user_id = v_uid AND season_id = v_season.id;
  IF v_bp.is_premium THEN RETURN jsonb_build_object('ok', false, 'error', 'Zaten premium'); END IF;

  SELECT diamonds INTO v_player FROM players WHERE id = v_uid;
  IF v_player.diamonds < v_season.premium_cost_diamonds THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetersiz elmas');
  END IF;

  UPDATE players SET diamonds = diamonds - v_season.premium_cost_diamonds WHERE id = v_uid;
  UPDATE user_battle_pass SET is_premium = true, unlocked_at = now() WHERE user_id = v_uid AND season_id = v_season.id;

  RETURN jsonb_build_object('ok', true, 'cost', v_season.premium_cost_diamonds);
END;
$$;

-- Get active events
CREATE OR REPLACE FUNCTION get_active_events()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'events', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', ed.id,
        'event_type', ed.event_type,
        'name', ed.name,
        'description', ed.description,
        'icon', ed.icon,
        'starts_at', ed.starts_at,
        'ends_at', ed.ends_at,
        'is_active', ed.is_active,
        'metadata', ed.metadata,
        'my_points', COALESCE(ep.points, 0),
        'my_rank', ep.rank
      ) ORDER BY ed.is_active DESC, ed.starts_at)
      FROM event_definitions ed
      LEFT JOIN event_progress ep ON ep.event_id = ed.id AND ep.user_id = v_uid
    )
  );
END;
$$;

-- Get notifications
CREATE OR REPLACE FUNCTION get_notifications(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'notifications', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', id,
        'type', type,
        'title', title,
        'body', body,
        'is_read', is_read,
        'metadata', metadata,
        'created_at', created_at
      ) ORDER BY created_at DESC)
      FROM (SELECT * FROM user_notifications WHERE user_id = v_uid ORDER BY created_at DESC LIMIT p_limit) n
    ),
    'unread_count', (SELECT COUNT(*) FROM user_notifications WHERE user_id = v_uid AND is_read = false)
  );
END;
$$;

-- Mark notification read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  UPDATE user_notifications SET is_read = true WHERE id = p_notification_id AND user_id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Mark all notifications read
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  UPDATE user_notifications SET is_read = true WHERE user_id = v_uid AND is_read = false;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- _send_notification helper
CREATE OR REPLACE FUNCTION _send_notification(p_user_id uuid, p_type text, p_title text, p_body text DEFAULT NULL, p_metadata jsonb DEFAULT '{}')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_notifications(user_id, type, title, body, metadata)
  VALUES (p_user_id, p_type, p_title, p_body, p_metadata);
END;
$$;
