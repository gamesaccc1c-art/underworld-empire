
-- Hook quest progress into PvP battles and production collection
CREATE OR REPLACE FUNCTION collect_building_production(p_building_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_building record;
  v_def record;
  v_hours_elapsed float;
  v_production bigint;
  v_resource text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT b.*, bd.production_rate, bd.production_resource, bd.name
  INTO v_building
  FROM buildings b
  JOIN building_definitions bd ON bd.id = b.building_def_id
  WHERE b.id = p_building_id AND b.user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Building not found');
  END IF;

  IF v_building.production_rate IS NULL OR v_building.production_rate = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a production building');
  END IF;

  v_hours_elapsed := EXTRACT(EPOCH FROM (now() - COALESCE(v_building.last_collected_at, v_building.created_at))) / 3600.0;
  v_hours_elapsed := LEAST(v_hours_elapsed, 24.0);
  v_production := FLOOR(v_building.production_rate * v_building.level * v_hours_elapsed);

  IF v_production <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nothing to collect yet');
  END IF;

  v_resource := v_building.production_resource;

  UPDATE buildings SET last_collected_at = now() WHERE id = p_building_id;

  IF v_resource = 'cash' THEN
    UPDATE players SET cash = cash + v_production WHERE id = v_uid;
  ELSIF v_resource = 'black_money' THEN
    UPDATE players SET black_money = black_money + v_production WHERE id = v_uid;
  ELSIF v_resource = 'influence' THEN
    UPDATE players SET influence = influence + v_production WHERE id = v_uid;
  END IF;

  -- Quest progress
  PERFORM increment_quest_progress(v_uid, 'collect_production');

  RETURN jsonb_build_object(
    'ok', true,
    'resource', v_resource,
    'amount', v_production
  );
END;
$$;
