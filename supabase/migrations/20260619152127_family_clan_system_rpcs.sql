
-- ═══════════════════════════════════════════════════════════════════════════════
-- FAMILY SYSTEM RPCs
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Create Family ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_family(p_name text, p_tag text, p_description text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_family_id uuid;
  v_cost int := 50000;
  v_min_level int := 5;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;
  IF v_player.level < v_min_level THEN RETURN jsonb_build_object('ok', false, 'error', 'Minimum seviye ' || v_min_level); END IF;
  IF v_player.cash < v_cost THEN RETURN jsonb_build_object('ok', false, 'error', 'Yetersiz nakit (50.000 gerekli)'); END IF;
  IF v_player.family_id IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Zaten bir aileye uyesiniz'); END IF;
  IF length(p_tag) < 2 OR length(p_tag) > 4 THEN RETURN jsonb_build_object('ok', false, 'error', 'Etiket 2-4 karakter olmali'); END IF;
  IF length(p_name) < 3 OR length(p_name) > 20 THEN RETURN jsonb_build_object('ok', false, 'error', 'Ad 3-20 karakter olmali'); END IF;

  IF EXISTS (SELECT 1 FROM families WHERE name = p_name) THEN RETURN jsonb_build_object('ok', false, 'error', 'Bu isim zaten kullaniliyor'); END IF;
  IF EXISTS (SELECT 1 FROM families WHERE tag = upper(p_tag)) THEN RETURN jsonb_build_object('ok', false, 'error', 'Bu etiket zaten kullaniliyor'); END IF;

  UPDATE players SET cash = cash - v_cost WHERE id = v_uid;

  INSERT INTO families (name, tag, leader_id, description, power)
  VALUES (p_name, upper(p_tag), v_uid, p_description, v_player.power)
  RETURNING id INTO v_family_id;

  INSERT INTO family_members (family_id, user_id, rank) VALUES (v_family_id, v_uid, 5);
  UPDATE players SET family_id = v_family_id WHERE id = v_uid;

  INSERT INTO family_tech (family_id, tech_key, level, progress, required_progress) VALUES
    (v_family_id, 'attack_bonus', 0, 0, 1000),
    (v_family_id, 'defense_bonus', 0, 0, 1000),
    (v_family_id, 'resource_bonus', 0, 0, 1500),
    (v_family_id, 'help_speed', 0, 0, 800),
    (v_family_id, 'territory_income', 0, 0, 2000);

  RETURN jsonb_build_object('ok', true, 'family_id', v_family_id);
END;
$$;

-- ─── Join Family ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION join_family(p_family_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_family record;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;
  IF v_player.family_id IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Zaten bir aileye uyesiniz'); END IF;

  SELECT * INTO v_family FROM families WHERE id = p_family_id;
  IF v_family IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile bulunamadi'); END IF;
  IF v_family.join_type != 'open' THEN RETURN jsonb_build_object('ok', false, 'error', 'Bu aile kapali'); END IF;
  IF v_family.member_count >= v_family.max_members THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile dolu'); END IF;
  IF v_player.power < v_family.min_power THEN RETURN jsonb_build_object('ok', false, 'error', 'Minimum guc: ' || v_family.min_power); END IF;

  INSERT INTO family_members (family_id, user_id, rank) VALUES (p_family_id, v_uid, 1);
  UPDATE players SET family_id = p_family_id WHERE id = v_uid;
  UPDATE families SET member_count = member_count + 1, power = power + v_player.power WHERE id = p_family_id;

  INSERT INTO family_chat (family_id, user_id, username, message, message_type)
  VALUES (p_family_id, v_uid, v_player.username, v_player.username || ' aileye katildi!', 'system');

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Leave Family ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION leave_family()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_family record;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;

  SELECT * INTO v_family FROM families WHERE id = v_player.family_id;
  IF v_family.leader_id = v_uid THEN RETURN jsonb_build_object('ok', false, 'error', 'Patron olarak ayrilamazsiniz'); END IF;

  DELETE FROM family_members WHERE family_id = v_player.family_id AND user_id = v_uid;
  UPDATE players SET family_id = NULL WHERE id = v_uid;
  UPDATE families SET member_count = GREATEST(member_count - 1, 0), power = GREATEST(power - v_player.power, 0) WHERE id = v_player.family_id;

  INSERT INTO family_chat (family_id, user_id, username, message, message_type)
  VALUES (v_player.family_id, v_uid, v_player.username, v_player.username || ' aileden ayrildi.', 'system');

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Change Member Rank ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION change_member_rank(p_target_user_id uuid, p_new_rank int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_my_member record;
  v_target_member record;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;

  SELECT * INTO v_my_member FROM family_members WHERE family_id = v_player.family_id AND user_id = v_uid;
  SELECT * INTO v_target_member FROM family_members WHERE family_id = v_player.family_id AND user_id = p_target_user_id;

  IF v_target_member IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Hedef uye bulunamadi'); END IF;
  IF v_my_member.rank < 4 THEN RETURN jsonb_build_object('ok', false, 'error', 'Yetkiniz yok (R4+ gerekli)'); END IF;
  IF p_new_rank >= v_my_member.rank THEN RETURN jsonb_build_object('ok', false, 'error', 'Kendi rutbenizden yuksek atama yapamazsiniz'); END IF;
  IF v_target_member.rank >= v_my_member.rank THEN RETURN jsonb_build_object('ok', false, 'error', 'Bu uyeyi degistiremezsiniz'); END IF;
  IF p_new_rank < 1 OR p_new_rank > 4 THEN RETURN jsonb_build_object('ok', false, 'error', 'Gecersiz rutbe'); END IF;

  UPDATE family_members SET rank = p_new_rank WHERE id = v_target_member.id;
  RETURN jsonb_build_object('ok', true, 'new_rank', p_new_rank);
END;
$$;

-- ─── Kick Member ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION kick_family_member(p_target_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_my_member record;
  v_target_member record;
  v_target_player record;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;

  SELECT * INTO v_my_member FROM family_members WHERE family_id = v_player.family_id AND user_id = v_uid;
  SELECT * INTO v_target_member FROM family_members WHERE family_id = v_player.family_id AND user_id = p_target_user_id;
  SELECT * INTO v_target_player FROM players WHERE id = p_target_user_id;

  IF v_target_member IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Hedef uye bulunamadi'); END IF;
  IF v_my_member.rank < 3 THEN RETURN jsonb_build_object('ok', false, 'error', 'Yetkiniz yok (R3+ gerekli)'); END IF;
  IF v_target_member.rank >= v_my_member.rank THEN RETURN jsonb_build_object('ok', false, 'error', 'Bu uyeyi atamazsiniz'); END IF;

  DELETE FROM family_members WHERE id = v_target_member.id;
  UPDATE players SET family_id = NULL WHERE id = p_target_user_id;
  UPDATE families SET member_count = GREATEST(member_count - 1, 0), power = GREATEST(power - COALESCE(v_target_player.power, 0), 0) WHERE id = v_player.family_id;

  INSERT INTO family_chat (family_id, user_id, username, message, message_type)
  VALUES (v_player.family_id, v_uid, v_player.username, v_target_player.username || ' aileden atildi.', 'system');

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Donate to Family ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION donate_to_family(p_resource text, p_amount int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_member record;
  v_daily_limit int := 5;
  v_contribution int;
  v_current_val int;
  v_tech_id uuid;
BEGIN
  IF p_amount <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Gecersiz miktar'); END IF;
  IF p_resource NOT IN ('cash', 'influence', 'loyalty', 'weapon_power', 'black_money', 'intel') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Gecersiz kaynak');
  END IF;

  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;

  SELECT * INTO v_member FROM family_members WHERE family_id = v_player.family_id AND user_id = v_uid;

  IF v_member.daily_donations_date < CURRENT_DATE THEN
    UPDATE family_members SET daily_donations_today = 0, daily_donations_date = CURRENT_DATE WHERE id = v_member.id;
    v_member.daily_donations_today := 0;
  END IF;

  IF v_member.daily_donations_today >= v_daily_limit THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Gunluk bagis limitine ulasildi (' || v_daily_limit || ')');
  END IF;

  EXECUTE format('SELECT %I FROM players WHERE id = $1', p_resource) INTO v_current_val USING v_uid;
  IF v_current_val < p_amount THEN RETURN jsonb_build_object('ok', false, 'error', 'Yetersiz kaynak'); END IF;

  EXECUTE format('UPDATE players SET %I = %I - $1 WHERE id = $2', p_resource, p_resource) USING p_amount, v_uid;

  v_contribution := GREATEST(p_amount / 100, 1);

  UPDATE family_members SET
    contribution = contribution + v_contribution,
    daily_donations_today = daily_donations_today + 1
  WHERE id = v_member.id;

  UPDATE families SET xp = xp + v_contribution WHERE id = v_player.family_id;

  -- Add progress to lowest-level tech
  SELECT id INTO v_tech_id FROM family_tech
  WHERE family_id = v_player.family_id AND level < 10
  ORDER BY level ASC, progress ASC LIMIT 1;

  IF v_tech_id IS NOT NULL THEN
    UPDATE family_tech SET progress = progress + v_contribution WHERE id = v_tech_id;
  END IF;

  INSERT INTO family_donations (family_id, user_id, resource_type, amount, contribution_gained)
  VALUES (v_player.family_id, v_uid, p_resource, p_amount, v_contribution);

  RETURN jsonb_build_object('ok', true, 'contribution', v_contribution, 'total_contribution', v_member.contribution + v_contribution);
END;
$$;

-- ─── Upgrade Family Tech ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION upgrade_family_tech(p_tech_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_tech record;
  v_required int;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;

  SELECT * INTO v_tech FROM family_tech WHERE family_id = v_player.family_id AND tech_key = p_tech_key;
  IF v_tech IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Teknoloji bulunamadi'); END IF;
  IF v_tech.level >= 10 THEN RETURN jsonb_build_object('ok', false, 'error', 'Maksimum seviye'); END IF;

  v_required := v_tech.required_progress * (v_tech.level + 1);
  IF v_tech.progress < v_required THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetersiz katki (' || v_tech.progress || '/' || v_required || ')');
  END IF;

  UPDATE family_tech SET level = level + 1, progress = progress - v_required WHERE id = v_tech.id;
  RETURN jsonb_build_object('ok', true, 'new_level', v_tech.level + 1);
END;
$$;

-- ─── Request Family Help ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION request_family_help(p_help_type text, p_target_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;

  IF EXISTS (
    SELECT 1 FROM family_help_requests
    WHERE user_id = v_uid AND target_id = p_target_id AND helps_received < max_helps AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Zaten yardim istediniz');
  END IF;

  INSERT INTO family_help_requests (family_id, user_id, help_type, target_id)
  VALUES (v_player.family_id, v_uid, p_help_type, p_target_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Give Family Help ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION give_family_help(p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_member record;
  v_request record;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;

  SELECT * INTO v_request FROM family_help_requests WHERE id = p_request_id AND family_id = v_player.family_id;
  IF v_request IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Yardim istegi bulunamadi'); END IF;
  IF v_request.user_id = v_uid THEN RETURN jsonb_build_object('ok', false, 'error', 'Kendinize yardim edemezsiniz'); END IF;
  IF v_request.helps_received >= v_request.max_helps THEN RETURN jsonb_build_object('ok', false, 'error', 'Yardim limiti doldu'); END IF;
  IF v_request.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'Sure dolmus'); END IF;

  SELECT * INTO v_member FROM family_members WHERE family_id = v_player.family_id AND user_id = v_uid;

  IF v_member.daily_helps_date < CURRENT_DATE THEN
    UPDATE family_members SET daily_helps_today = 0, daily_helps_date = CURRENT_DATE WHERE id = v_member.id;
    v_member.daily_helps_today := 0;
  END IF;
  IF v_member.daily_helps_today >= 20 THEN RETURN jsonb_build_object('ok', false, 'error', 'Gunluk yardim limitine ulasildi'); END IF;

  UPDATE family_help_requests SET helps_received = helps_received + 1 WHERE id = p_request_id;
  UPDATE family_members SET daily_helps_today = daily_helps_today + 1, contribution = contribution + 1 WHERE id = v_member.id;

  RETURN jsonb_build_object('ok', true, 'time_reduced', v_request.time_reduction_per_help);
END;
$$;

-- ─── Start Territory War ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION start_territory_war(p_territory_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_member record;
  v_territory record;
  v_war_id uuid;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;

  SELECT * INTO v_member FROM family_members WHERE family_id = v_player.family_id AND user_id = v_uid;
  IF v_member.rank < 4 THEN RETURN jsonb_build_object('ok', false, 'error', 'Yetkiniz yok (R4+ gerekli)'); END IF;

  SELECT * INTO v_territory FROM territories WHERE id = p_territory_id;
  IF v_territory IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Bolge bulunamadi'); END IF;
  IF v_territory.owner_family_id = v_player.family_id THEN RETURN jsonb_build_object('ok', false, 'error', 'Bu bolge zaten sizin'); END IF;
  IF v_territory.shield_until IS NOT NULL AND v_territory.shield_until > now() THEN RETURN jsonb_build_object('ok', false, 'error', 'Bolge kalkanla korunuyor'); END IF;

  IF EXISTS (SELECT 1 FROM territory_wars WHERE territory_id = p_territory_id AND status = 'active') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bu bolgede aktif savas var');
  END IF;

  INSERT INTO territory_wars (territory_id, attacker_family_id, defender_family_id)
  VALUES (p_territory_id, v_player.family_id, v_territory.owner_family_id)
  RETURNING id INTO v_war_id;

  RETURN jsonb_build_object('ok', true, 'war_id', v_war_id);
END;
$$;

-- ─── Contribute to Territory War ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION contribute_to_war(p_war_id uuid, p_troop_type text, p_amount int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_war record;
  v_troop record;
  v_points int;
  v_is_attacker boolean;
  v_point_per_unit int;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;

  SELECT * INTO v_war FROM territory_wars WHERE id = p_war_id AND status = 'active';
  IF v_war IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aktif savas bulunamadi'); END IF;
  IF v_war.ends_at < now() THEN RETURN jsonb_build_object('ok', false, 'error', 'Savas suresi dolmus'); END IF;

  IF v_player.family_id = v_war.attacker_family_id THEN v_is_attacker := true;
  ELSIF v_player.family_id = v_war.defender_family_id THEN v_is_attacker := false;
  ELSE RETURN jsonb_build_object('ok', false, 'error', 'Bu savasta tarafiniz yok');
  END IF;

  SELECT * INTO v_troop FROM troops WHERE user_id = v_uid AND troop_type = p_troop_type;
  IF v_troop IS NULL OR v_troop.amount < p_amount THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetersiz birlik');
  END IF;

  UPDATE troops SET amount = amount - p_amount WHERE id = v_troop.id;

  v_point_per_unit := CASE p_troop_type
    WHEN 'street_thugs' THEN 5
    WHEN 'hitmen' THEN 20
    WHEN 'bodyguards' THEN 15
    WHEN 'bikers' THEN 25
    WHEN 'vehicle_crew' THEN 50
    WHEN 'heavy_crew' THEN 100
    ELSE 5
  END;
  v_points := p_amount * v_point_per_unit;

  IF v_is_attacker THEN
    UPDATE territory_wars SET attacker_points = attacker_points + v_points WHERE id = p_war_id;
  ELSE
    UPDATE territory_wars SET defender_points = defender_points + v_points WHERE id = p_war_id;
  END IF;

  INSERT INTO territory_war_contributions (war_id, user_id, family_id, points, troops_sent)
  VALUES (p_war_id, v_uid, v_player.family_id, v_points, jsonb_build_object(p_troop_type, p_amount));

  RETURN jsonb_build_object('ok', true, 'points_added', v_points);
END;
$$;

-- ─── Resolve Territory War ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_territory_war(p_war_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_war record;
  v_winner_family_id uuid;
  v_status text;
BEGIN
  SELECT * INTO v_war FROM territory_wars WHERE id = p_war_id AND status = 'active';
  IF v_war IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aktif savas bulunamadi'); END IF;
  IF v_war.ends_at > now() THEN RETURN jsonb_build_object('ok', false, 'error', 'Savas henuz bitmedi'); END IF;

  IF v_war.attacker_points > v_war.defender_points THEN
    v_winner_family_id := v_war.attacker_family_id;
    v_status := 'attacker_won';
  ELSIF v_war.defender_points > v_war.attacker_points THEN
    v_winner_family_id := v_war.defender_family_id;
    v_status := 'defender_won';
  ELSE
    v_status := 'draw';
  END IF;

  UPDATE territory_wars SET status = v_status WHERE id = p_war_id;

  IF v_winner_family_id IS NOT NULL THEN
    IF v_war.defender_family_id IS NOT NULL THEN
      UPDATE families SET territory_count = GREATEST(territory_count - 1, 0) WHERE id = v_war.defender_family_id;
    END IF;
    UPDATE territories SET owner_family_id = v_winner_family_id, shield_until = now() + interval '24 hours', control_points = 0 WHERE id = v_war.territory_id;
    UPDATE families SET territory_count = territory_count + 1 WHERE id = v_winner_family_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_status, 'winner_family_id', v_winner_family_id);
END;
$$;

-- ─── Get Family Details ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_family_details(p_family_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_family record;
  v_members jsonb;
  v_tech jsonb;
BEGIN
  SELECT * INTO v_family FROM families WHERE id = p_family_id;
  IF v_family IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile bulunamadi'); END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'user_id', fm.user_id,
    'username', p.username,
    'level', p.level,
    'power', p.power,
    'rank', fm.rank,
    'contribution', fm.contribution,
    'joined_at', fm.joined_at,
    'vip_level', p.vip_level
  ) ORDER BY fm.rank DESC, fm.contribution DESC)
  INTO v_members
  FROM family_members fm JOIN players p ON p.id = fm.user_id
  WHERE fm.family_id = p_family_id;

  SELECT jsonb_agg(jsonb_build_object(
    'tech_key', tech_key,
    'level', level,
    'progress', progress,
    'required_progress', required_progress * (level + 1)
  ))
  INTO v_tech
  FROM family_tech WHERE family_id = p_family_id;

  RETURN jsonb_build_object(
    'ok', true,
    'family', row_to_json(v_family),
    'members', COALESCE(v_members, '[]'::jsonb),
    'tech', COALESCE(v_tech, '[]'::jsonb)
  );
END;
$$;

-- ─── Set Family Announcement ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_family_announcement(p_announcement text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_member record;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;
  SELECT * INTO v_member FROM family_members WHERE family_id = v_player.family_id AND user_id = v_uid;
  IF v_member.rank < 4 THEN RETURN jsonb_build_object('ok', false, 'error', 'Yetkiniz yok (R4+ gerekli)'); END IF;

  UPDATE families SET announcement = p_announcement WHERE id = v_player.family_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Get Territory Wars ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_territory_wars()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wars jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', tw.id,
    'territory_id', tw.territory_id,
    'territory_name', t.name,
    'attacker_family_id', tw.attacker_family_id,
    'attacker_name', af.name,
    'attacker_tag', af.tag,
    'defender_family_id', tw.defender_family_id,
    'defender_name', df.name,
    'defender_tag', df.tag,
    'attacker_points', tw.attacker_points,
    'defender_points', tw.defender_points,
    'status', tw.status,
    'started_at', tw.started_at,
    'ends_at', tw.ends_at
  ))
  INTO v_wars
  FROM territory_wars tw
  JOIN territories t ON t.id = tw.territory_id
  JOIN families af ON af.id = tw.attacker_family_id
  LEFT JOIN families df ON df.id = tw.defender_family_id
  WHERE tw.status = 'active' OR tw.started_at > now() - interval '24 hours'
  ORDER BY tw.started_at DESC;

  RETURN COALESCE(v_wars, '[]'::jsonb);
END;
$$;

-- ─── Claim Territory Reward ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_territory_reward()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_total_income int := 0;
  v_territory record;
  v_rewards jsonb := '{}'::jsonb;
  v_tech_bonus numeric := 1.0;
  v_tech record;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player.family_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile uyesi degilsiniz'); END IF;

  SELECT * INTO v_tech FROM family_tech WHERE family_id = v_player.family_id AND tech_key = 'territory_income';
  IF v_tech IS NOT NULL AND v_tech.level > 0 THEN
    v_tech_bonus := 1.0 + (v_tech.level * 0.05);
  END IF;

  FOR v_territory IN SELECT * FROM territories WHERE owner_family_id = v_player.family_id LOOP
    v_total_income := v_total_income + round(v_territory.daily_income * v_tech_bonus)::int;
    EXECUTE format('UPDATE players SET %I = %I + $1 WHERE id = $2', v_territory.resource_bonus, v_territory.resource_bonus)
      USING round(v_territory.daily_income * v_tech_bonus)::int, v_uid;
    v_rewards := v_rewards || jsonb_build_object(v_territory.resource_bonus, round(v_territory.daily_income * v_tech_bonus)::int);
  END LOOP;

  IF v_total_income = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Kontrol edilen bolge yok'); END IF;

  RETURN jsonb_build_object('ok', true, 'total_income', v_total_income, 'rewards', v_rewards);
END;
$$;
