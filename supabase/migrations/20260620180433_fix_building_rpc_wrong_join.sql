-- Fix finish_building_upgrade: buildings join via building_type, not building_def_id
-- Also fix: set is_upgrading = false, clear upgrade timestamps, correct XP/power logic

CREATE OR REPLACE FUNCTION finish_building_upgrade(p_building_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_building   record;
  v_def        record;
  v_new_level  int;
  v_xp_gain    int;
  v_power_gain int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT b.*, bd.name
  INTO v_building
  FROM buildings b
  JOIN building_definitions bd ON bd.type = b.building_type
  WHERE b.id = p_building_id AND b.user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Building not found');
  END IF;

  IF v_building.upgrade_ends_at IS NULL OR v_building.upgrade_ends_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Upgrade not complete');
  END IF;

  v_new_level  := v_building.level + 1;
  v_xp_gain    := v_new_level * 50;
  v_power_gain := v_new_level * 10;

  UPDATE buildings
  SET level             = v_new_level,
      is_upgrading      = false,
      upgrade_ends_at   = NULL,
      upgrade_started_at = NULL
  WHERE id = p_building_id;

  UPDATE players
  SET xp    = xp + v_xp_gain,
      power = power + v_power_gain
  WHERE id = v_uid;

  PERFORM increment_quest_progress(v_uid, 'upgrade_building');
  PERFORM increment_quest_progress(v_uid, 'weekly_building_upgrades');
  PERFORM _add_bp_xp(v_uid, 50);
  PERFORM _send_notification(
    v_uid, 'building_done',
    'Bina Yükseltildi!',
    v_building.name || ' Seviye ' || v_new_level || ' tamamlandı.',
    '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'ok',         true,
    'new_level',  v_new_level,
    'xp_gain',    v_xp_gain,
    'power_gain', v_power_gain
  );
END;
$$;

-- Fix collect_building_production: join via building_type, use production_type column,
-- match frontend capacity formula, handle all resource types via dynamic SQL

CREATE OR REPLACE FUNCTION collect_building_production(p_building_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_building     record;
  v_def          record;
  v_rate         integer;
  v_capacity     integer;
  v_elapsed_hrs  numeric;
  v_pending      integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT b.*
  INTO v_building
  FROM buildings b
  WHERE b.id = p_building_id AND b.user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Building not found');
  END IF;

  IF v_building.is_upgrading THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Building is upgrading');
  END IF;

  SELECT * INTO v_def
  FROM building_definitions
  WHERE type = v_building.building_type;

  IF v_def IS NULL OR v_def.production_type IS NULL OR v_def.production_rate <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a production building');
  END IF;

  -- Match frontend formula exactly
  v_rate        := floor(v_def.production_rate * (1 + (v_building.level - 1) * 0.3))::integer;
  v_elapsed_hrs := EXTRACT(EPOCH FROM (now() - v_building.last_collected_at)) / 3600.0;
  v_capacity    := v_rate * v_def.production_capacity_hours;
  v_pending     := floor(LEAST(v_elapsed_hrs * v_rate, v_capacity))::integer;

  IF v_pending <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nothing to collect yet');
  END IF;

  UPDATE buildings SET last_collected_at = now() WHERE id = p_building_id;

  EXECUTE format(
    'UPDATE players SET %I = %I + $1 WHERE id = $2',
    v_def.production_type, v_def.production_type
  ) USING v_pending, v_uid;

  PERFORM increment_quest_progress(v_uid, 'collect_production');

  RETURN jsonb_build_object(
    'ok',      true,
    'resource', v_def.production_type,
    'amount',   v_pending,
    'hours',    round(v_elapsed_hrs::numeric, 2)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION finish_building_upgrade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION collect_building_production(uuid) TO authenticated;
