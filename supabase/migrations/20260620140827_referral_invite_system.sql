-- Referral / invite code system
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES players(id),
  code TEXT UNIQUE NOT NULL,
  uses INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 50,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_referral" ON referral_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_referral" ON referral_codes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_referral" ON referral_codes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_referral" ON referral_codes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS referral_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES players(id),
  referred_id UUID NOT NULL REFERENCES players(id),
  code TEXT NOT NULL,
  referrer_reward_claimed BOOLEAN DEFAULT false,
  referred_reward_claimed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referred_id)
);

ALTER TABLE referral_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_referral_claims" ON referral_claims FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY "insert_referral_claims" ON referral_claims FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = referred_id);
CREATE POLICY "update_own_referral_claims" ON referral_claims FOR UPDATE TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id)
  WITH CHECK (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY "delete_referral_claims" ON referral_claims FOR DELETE TO authenticated
  USING (auth.uid() = referrer_id);

-- Generate a unique referral code for a player
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT;
  v_existing referral_codes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_existing FROM referral_codes WHERE user_id = v_uid AND is_active = true LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'code', v_existing.code, 'uses', v_existing.uses, 'max_uses', v_existing.max_uses);
  END IF;

  v_code := upper(substring(md5(v_uid::text || now()::text) for 8));

  INSERT INTO referral_codes (user_id, code)
  VALUES (v_uid, v_code)
  ON CONFLICT (code) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'code', v_code, 'uses', 0, 'max_uses', 50);
END;
$$;

-- Use a referral code
CREATE OR REPLACE FUNCTION use_referral_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ref referral_codes%ROWTYPE;
  v_existing referral_claims%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  -- Check if already used a referral
  SELECT * INTO v_existing FROM referral_claims WHERE referred_id = v_uid;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Zaten bir davet kodu kullandiniz');
  END IF;

  SELECT * INTO v_ref FROM referral_codes WHERE code = upper(p_code) AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Gecersiz davet kodu');
  END IF;

  IF v_ref.user_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Kendi kodunuzu kullanamazsiniz');
  END IF;

  IF v_ref.uses >= v_ref.max_uses THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bu kod kullanim limitine ulasti');
  END IF;

  -- Record referral
  INSERT INTO referral_claims (referrer_id, referred_id, code)
  VALUES (v_ref.user_id, v_uid, v_ref.code);

  UPDATE referral_codes SET uses = uses + 1 WHERE id = v_ref.id;

  -- Grant rewards
  UPDATE players SET diamonds = diamonds + 50, cash = cash + 25000 WHERE id = v_uid;
  UPDATE players SET diamonds = diamonds + 30, cash = cash + 15000 WHERE id = v_ref.user_id;

  RETURN jsonb_build_object('ok', true, 'reward_diamonds', 50, 'reward_cash', 25000);
END;
$$;

-- Get referral stats
CREATE OR REPLACE FUNCTION get_referral_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT;
  v_uses INTEGER;
  v_max INTEGER;
  v_total_referred INTEGER;
  v_used_code BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT code, uses, max_uses INTO v_code, v_uses, v_max
  FROM referral_codes WHERE user_id = v_uid AND is_active = true LIMIT 1;

  SELECT COUNT(*) INTO v_total_referred FROM referral_claims WHERE referrer_id = v_uid;
  SELECT EXISTS(SELECT 1 FROM referral_claims WHERE referred_id = v_uid) INTO v_used_code;

  RETURN jsonb_build_object(
    'ok', true,
    'code', v_code,
    'uses', COALESCE(v_uses, 0),
    'max_uses', COALESCE(v_max, 50),
    'total_referred', v_total_referred,
    'has_used_code', v_used_code
  );
END;
$$;
