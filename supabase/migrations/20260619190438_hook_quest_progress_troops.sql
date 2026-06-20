
-- Hook quest progress into troop training completion
CREATE OR REPLACE FUNCTION complete_troop_training(p_queue_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_queue record;
  v_troop_def record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT tq.*, t.name, t.power
  INTO v_queue
  FROM troop_training_queue tq
  JOIN troops t ON t.id = tq.troop_id
  WHERE tq.id = p_queue_id AND tq.user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Queue not found');
  END IF;

  IF v_queue.ends_at > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Training not complete');
  END IF;

  UPDATE players
  SET power = power + (v_queue.quantity * v_queue.power)
  WHERE id = v_uid;

  DELETE FROM troop_training_queue WHERE id = p_queue_id;

  -- Quest progress
  PERFORM increment_quest_progress(v_uid, 'train_troops');
  PERFORM increment_quest_progress(v_uid, 'weekly_train_troops', v_queue.quantity);

  -- Battle pass XP
  PERFORM _add_bp_xp(v_uid, 20);

  -- Notification
  PERFORM _send_notification(v_uid, 'training_done', 'Eğitim Tamamlandı!', v_queue.quantity || 'x ' || v_queue.name || ' hazır!', '{}'::jsonb);

  RETURN jsonb_build_object(
    'ok', true,
    'quantity', v_queue.quantity,
    'power_gain', v_queue.quantity * v_queue.power
  );
END;
$$;
