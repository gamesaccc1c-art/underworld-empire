-- Daily lucky wheel spin system
CREATE TABLE IF NOT EXISTS lucky_wheel_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES players(id),
  prize_type TEXT NOT NULL,
  prize_amount INTEGER NOT NULL DEFAULT 0,
  spun_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_wheel_spins_user ON lucky_wheel_spins(user_id, spun_at DESC);

ALTER TABLE lucky_wheel_spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_spins" ON lucky_wheel_spins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_spins" ON lucky_wheel_spins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_spins" ON lucky_wheel_spins FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_spins" ON lucky_wheel_spins FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Spin the wheel RPC
CREATE OR REPLACE FUNCTION spin_lucky_wheel()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last_spin TIMESTAMPTZ;
  v_roll INTEGER;
  v_prize_type TEXT;
  v_prize_amount INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  -- Check if already spun today
  SELECT spun_at INTO v_last_spin
  FROM lucky_wheel_spins WHERE user_id = v_uid
  ORDER BY spun_at DESC LIMIT 1;

  IF v_last_spin IS NOT NULL AND v_last_spin::date = now()::date THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bugun zaten cevrildi', 'next_spin', (now()::date + 1)::text);
  END IF;

  -- Random prize (weighted)
  v_roll := floor(random() * 100) + 1;

  IF v_roll <= 30 THEN
    v_prize_type := 'cash';
    v_prize_amount := (floor(random() * 5) + 1)::integer * 5000;
  ELSIF v_roll <= 55 THEN
    v_prize_type := 'xp';
    v_prize_amount := (floor(random() * 3) + 1)::integer * 100;
  ELSIF v_roll <= 70 THEN
    v_prize_type := 'energy';
    v_prize_amount := (floor(random() * 3) + 1)::integer;
  ELSIF v_roll <= 85 THEN
    v_prize_type := 'diamonds';
    v_prize_amount := (floor(random() * 3) + 1)::integer * 5;
  ELSIF v_roll <= 95 THEN
    v_prize_type := 'influence';
    v_prize_amount := (floor(random() * 5) + 1)::integer * 10;
  ELSE
    v_prize_type := 'diamonds';
    v_prize_amount := 50;
  END IF;

  -- Record spin
  INSERT INTO lucky_wheel_spins (user_id, prize_type, prize_amount)
  VALUES (v_uid, v_prize_type, v_prize_amount);

  -- Grant prize
  IF v_prize_type = 'cash' THEN
    UPDATE players SET cash = cash + v_prize_amount WHERE id = v_uid;
  ELSIF v_prize_type = 'xp' THEN
    UPDATE players SET xp = xp + v_prize_amount WHERE id = v_uid;
  ELSIF v_prize_type = 'energy' THEN
    UPDATE players SET raid_energy = LEAST(raid_energy + v_prize_amount, 10) WHERE id = v_uid;
  ELSIF v_prize_type = 'diamonds' THEN
    UPDATE players SET diamonds = diamonds + v_prize_amount WHERE id = v_uid;
  ELSIF v_prize_type = 'influence' THEN
    UPDATE players SET influence = influence + v_prize_amount WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('ok', true, 'prize_type', v_prize_type, 'prize_amount', v_prize_amount);
END;
$$;

-- Check wheel status
CREATE OR REPLACE FUNCTION get_wheel_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last_spin TIMESTAMPTZ;
  v_can_spin BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT spun_at INTO v_last_spin
  FROM lucky_wheel_spins WHERE user_id = v_uid
  ORDER BY spun_at DESC LIMIT 1;

  v_can_spin := (v_last_spin IS NULL OR v_last_spin::date < now()::date);

  RETURN jsonb_build_object('ok', true, 'can_spin', v_can_spin, 'last_spin', v_last_spin);
END;
$$;
