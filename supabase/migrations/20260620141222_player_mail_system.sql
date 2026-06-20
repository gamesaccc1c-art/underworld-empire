-- In-game mail system
CREATE TABLE IF NOT EXISTS player_mail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES players(id),
  receiver_id UUID NOT NULL REFERENCES players(id),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  mail_type TEXT NOT NULL DEFAULT 'player' CHECK (mail_type IN ('player', 'system', 'family', 'battle_report', 'reward')),
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mail_receiver ON player_mail(receiver_id, created_at DESC);
CREATE INDEX idx_mail_sender ON player_mail(sender_id, created_at DESC);

ALTER TABLE player_mail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_mail" ON player_mail FOR SELECT TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
CREATE POLICY "insert_mail" ON player_mail FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "update_own_mail" ON player_mail FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);
CREATE POLICY "delete_own_mail" ON player_mail FOR DELETE TO authenticated
  USING (auth.uid() = receiver_id);

-- Send mail RPC
CREATE OR REPLACE FUNCTION send_mail(p_receiver_username TEXT, p_subject TEXT, p_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_receiver players%ROWTYPE;
  v_mail_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF length(p_subject) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Konu en fazla 100 karakter');
  END IF;
  IF length(p_body) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Mesaj en fazla 1000 karakter');
  END IF;

  SELECT * INTO v_receiver FROM players WHERE username = p_receiver_username;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi');
  END IF;

  IF v_receiver.id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kendinize mesaj gonderemezsiniz');
  END IF;

  INSERT INTO player_mail (sender_id, receiver_id, subject, body, mail_type)
  VALUES (v_uid, v_receiver.id, p_subject, p_body, 'player')
  RETURNING id INTO v_mail_id;

  RETURN jsonb_build_object('ok', true, 'mail_id', v_mail_id);
END;
$$;

-- Get inbox
CREATE OR REPLACE FUNCTION get_inbox(p_limit INTEGER DEFAULT 30, p_offset INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_mails JSONB;
  v_unread INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_mails
  FROM (
    SELECT m.id, m.subject, m.body, m.mail_type, m.is_read, m.metadata, m.created_at,
           p.username as sender_name, p.level as sender_level
    FROM player_mail m
    LEFT JOIN players p ON p.id = m.sender_id
    WHERE m.receiver_id = v_uid
    ORDER BY m.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  SELECT COUNT(*) INTO v_unread FROM player_mail WHERE receiver_id = v_uid AND is_read = false;

  RETURN jsonb_build_object('ok', true, 'mails', COALESCE(v_mails, '[]'::jsonb), 'unread', v_unread);
END;
$$;

-- Mark mail read
CREATE OR REPLACE FUNCTION mark_mail_read(p_mail_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE player_mail SET is_read = true WHERE id = p_mail_id AND receiver_id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Delete mail
CREATE OR REPLACE FUNCTION delete_mail(p_mail_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM player_mail WHERE id = p_mail_id AND receiver_id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END;
$$;
