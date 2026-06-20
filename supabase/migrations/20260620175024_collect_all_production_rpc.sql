-- Collect all buildings production in a single RPC call
CREATE OR REPLACE FUNCTION collect_all_production()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_building record;
  v_def record;
  v_elapsed_hours numeric;
  v_rate integer;
  v_capacity integer;
  v_pending integer;
  v_totals jsonb := '{}';
  v_collected_count integer := 0;
BEGIN
  -- Loop over all non-upgrading buildings that have production
  FOR v_building IN
    SELECT b.*
    FROM buildings b
    WHERE b.user_id = v_uid
      AND b.is_upgrading = false
  LOOP
    SELECT * INTO v_def
    FROM building_definitions
    WHERE id = v_building.building_definition_id;

    CONTINUE WHEN v_def IS NULL;
    CONTINUE WHEN v_def.production_type IS NULL;
    CONTINUE WHEN v_def.production_rate <= 0;

    v_rate := floor(v_def.production_rate * (1 + (v_building.level - 1) * 0.3))::integer;
    CONTINUE WHEN v_rate <= 0;

    v_elapsed_hours := EXTRACT(EPOCH FROM (now() - v_building.last_collected_at)) / 3600.0;
    v_capacity := v_rate * v_def.production_capacity_hours;
    v_pending := floor(LEAST(v_elapsed_hours * v_rate, v_capacity))::integer;

    CONTINUE WHEN v_pending <= 0;

    -- Update building collection timestamp
    UPDATE buildings
    SET last_collected_at = now(), updated_at = now()
    WHERE id = v_building.id;

    -- Add to player resources
    EXECUTE format(
      'UPDATE players SET %I = %I + $1, updated_at = now() WHERE id = $2',
      v_def.production_type, v_def.production_type
    ) USING v_pending, v_uid;

    v_totals := v_totals || jsonb_build_object(
      v_def.production_type,
      COALESCE((v_totals->>v_def.production_type)::integer, 0) + v_pending
    );
    v_collected_count := v_collected_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'collected', v_collected_count,
    'totals', v_totals
  );
END;
$$;

GRANT EXECUTE ON FUNCTION collect_all_production() TO authenticated;
