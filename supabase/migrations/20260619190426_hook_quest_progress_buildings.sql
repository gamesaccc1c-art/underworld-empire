
-- Hook quest progress into building upgrade completion
CREATE OR REPLACE FUNCTION finish_building_upgrade(p_building_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_building record;
  v_def record;
  v_new_level int;
  v_power_gain int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT b.*, bd.power_per_level, bd.name
  INTO v_building
  FROM buildings b
  JOIN building_definitions bd ON bd.id = b.building_def_id
  WHERE b.id = p_building_id AND b.user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Building not found');
  END IF;

  IF v_building.upgrade_ends_at IS NULL OR v_building.upgrade_ends_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Upgrade not complete');
  END IF;

  v_new_level := v_building.level + 1;
  v_power_gain := v_building.power_per_level;

  UPDATE buildings
  SET level = v_new_level, upgrade_ends_at = NULL
  WHERE id = p_building_id;

  UPDATE players
  SET power = power + v_power_gain
  WHERE id = v_uid;

  -- Quest progress
  PERFORM increment_quest_progress(v_uid, 'upgrade_building');
  PERFORM increment_quest_progress(v_uid, 'weekly_building_upgrades');

  -- Battle pass XP
  PERFORM _add_bp_xp(v_uid, 50);

  -- Notification
  PERFORM _send_notification(v_uid, 'building_done', 'Bina Yükseltildi!', v_building.name || ' Seviye ' || v_new_level || ' tamamlandı.', '{}'::jsonb);

  RETURN jsonb_build_object(
    'ok', true,
    'new_level', v_new_level,
    'power_gain', v_power_gain
  );
END;
$$;
