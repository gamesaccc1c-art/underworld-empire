-- Energy regeneration: server-side function that computes how much energy
-- has regenerated since last regen timestamp and updates the player row.
-- Called client-side on app focus / page load.

CREATE OR REPLACE FUNCTION regen_energy()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player players%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_dark_regen_secs CONSTANT int := 1800;   -- 30 min
  v_raid_regen_secs CONSTANT int := 3600;   -- 60 min
  v_spy_regen_secs  CONSTANT int := 2700;   -- 45 min
  v_dark_gained int;
  v_raid_gained int;
  v_spy_gained  int;
  v_new_dark    int;
  v_new_raid    int;
  v_new_spy     int;
  v_new_dark_last  TIMESTAMPTZ;
  v_new_raid_last  TIMESTAMPTZ;
  v_new_spy_last   TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Player not found'); END IF;

  -- ── dark job energy ──────────────────────────────────────────────────────────
  v_new_dark_last := COALESCE(v_player.dark_job_energy_last_regen, v_player.created_at);
  IF v_player.dark_job_energy < v_player.max_dark_job_energy THEN
    v_dark_gained := FLOOR(EXTRACT(EPOCH FROM (v_now - v_new_dark_last)) / v_dark_regen_secs);
    IF v_dark_gained > 0 THEN
      v_new_dark := LEAST(v_player.dark_job_energy + v_dark_gained, v_player.max_dark_job_energy);
      v_new_dark_last := v_now - (EXTRACT(EPOCH FROM (v_now - v_new_dark_last))::int % v_dark_regen_secs) * INTERVAL '1 second';
    ELSE
      v_new_dark := v_player.dark_job_energy;
    END IF;
  ELSE
    v_new_dark := v_player.dark_job_energy;
    v_new_dark_last := v_now;
  END IF;

  -- ── raid energy ──────────────────────────────────────────────────────────────
  v_new_raid_last := COALESCE(v_player.raid_energy_last_regen, v_player.created_at);
  IF v_player.raid_energy < v_player.max_raid_energy THEN
    v_raid_gained := FLOOR(EXTRACT(EPOCH FROM (v_now - v_new_raid_last)) / v_raid_regen_secs);
    IF v_raid_gained > 0 THEN
      v_new_raid := LEAST(v_player.raid_energy + v_raid_gained, v_player.max_raid_energy);
      v_new_raid_last := v_now - (EXTRACT(EPOCH FROM (v_now - v_new_raid_last))::int % v_raid_regen_secs) * INTERVAL '1 second';
    ELSE
      v_new_raid := v_player.raid_energy;
    END IF;
  ELSE
    v_new_raid := v_player.raid_energy;
    v_new_raid_last := v_now;
  END IF;

  -- ── spy energy ───────────────────────────────────────────────────────────────
  v_new_spy_last := COALESCE(v_player.spy_energy_last_regen, v_player.created_at);
  IF v_player.spy_energy < v_player.max_spy_energy THEN
    v_spy_gained := FLOOR(EXTRACT(EPOCH FROM (v_now - v_new_spy_last)) / v_spy_regen_secs);
    IF v_spy_gained > 0 THEN
      v_new_spy := LEAST(v_player.spy_energy + v_spy_gained, v_player.max_spy_energy);
      v_new_spy_last := v_now - (EXTRACT(EPOCH FROM (v_now - v_new_spy_last))::int % v_spy_regen_secs) * INTERVAL '1 second';
    ELSE
      v_new_spy := v_player.spy_energy;
    END IF;
  ELSE
    v_new_spy := v_player.spy_energy;
    v_new_spy_last := v_now;
  END IF;

  -- ── persist ──────────────────────────────────────────────────────────────────
  UPDATE players SET
    dark_job_energy          = v_new_dark,
    raid_energy              = v_new_raid,
    spy_energy               = v_new_spy,
    dark_job_energy_last_regen = v_new_dark_last,
    raid_energy_last_regen     = v_new_raid_last,
    spy_energy_last_regen      = v_new_spy_last,
    updated_at               = v_now
  WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'ok', true,
    'dark_job_energy', v_new_dark,
    'raid_energy',     v_new_raid,
    'spy_energy',      v_new_spy
  );
END;
$$;
