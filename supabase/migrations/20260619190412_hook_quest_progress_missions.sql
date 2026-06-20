
-- Hook quest progress into mission completion
CREATE OR REPLACE FUNCTION claim_mission_reward(p_user_mission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_um record;
  v_mission record;
  v_xp_gain int;
  v_cash_gain bigint;
  v_bm_gain bigint;
  v_influence_gain int;
  v_intel_gain int;
  v_heat_gain int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT um.*, m.reward_xp, m.reward_cash, m.reward_black_money,
         m.reward_influence, m.reward_intel, m.police_heat_gain,
         m.category
  INTO v_um
  FROM user_missions um
  JOIN missions m ON m.id = um.mission_id
  WHERE um.id = p_user_mission_id AND um.user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Mission not found');
  END IF;

  IF v_um.status != 'completed' THEN
    IF v_um.ends_at > now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Mission not finished yet');
    END IF;
  END IF;

  IF v_um.status = 'rewarded' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Already rewarded');
  END IF;

  v_xp_gain := v_um.reward_xp;
  v_cash_gain := v_um.reward_cash;
  v_bm_gain := v_um.reward_black_money;
  v_influence_gain := v_um.reward_influence;
  v_intel_gain := v_um.reward_intel;
  v_heat_gain := v_um.police_heat_gain;

  UPDATE players
  SET
    xp = xp + v_xp_gain,
    cash = cash + v_cash_gain,
    black_money = black_money + v_bm_gain,
    influence = influence + v_influence_gain,
    intel = intel + v_intel_gain,
    police_heat = LEAST(police_heat + v_heat_gain, 100)
  WHERE id = v_uid;

  UPDATE user_missions SET status = 'rewarded' WHERE id = p_user_mission_id;

  -- Quest progress
  IF v_um.category = 'dark_job' THEN
    PERFORM increment_quest_progress(v_uid, 'complete_mission');
    PERFORM increment_quest_progress(v_uid, 'weekly_dark_jobs');
  END IF;

  -- Battle pass XP
  PERFORM _add_bp_xp(v_uid, 30);

  RETURN jsonb_build_object(
    'ok', true,
    'xp', v_xp_gain,
    'cash', v_cash_gain,
    'black_money', v_bm_gain,
    'influence', v_influence_gain,
    'intel', v_intel_gain,
    'police_heat', v_heat_gain
  );
END;
$$;
