
-- ============================================================
-- Admin System
-- 1. Add role to players
-- 2. Admin-only views (bypassing RLS via SECURITY DEFINER)
-- 3. Admin RPCs: check_admin, admin_get_players, admin_get_player,
--    admin_adjust_resources, admin_ban_player, admin_unban_player,
--    admin_update_product, admin_get_dashboard_stats,
--    admin_get_suspicious_activity, admin_get_battle_reports,
--    admin_get_families, admin_get_purchases
-- ============================================================

-- 1. Add role + is_banned to players
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='role') THEN
    ALTER TABLE players ADD COLUMN role text NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='is_banned') THEN
    ALTER TABLE players ADD COLUMN is_banned boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='ban_reason') THEN
    ALTER TABLE players ADD COLUMN ban_reason text;
  END IF;
END $$;

-- Allow GRANT back for role/is_banned (they are read-only to players by default)
-- The authenticated role only has UPDATE on username/avatar_url/updated_at; role/is_banned
-- can only be set by SECURITY DEFINER admin RPCs.

-- ─── Helper: check if current user is admin ──────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─── Admin dashboard stats ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_players integer;
  v_total_purchases integer;
  v_total_diamond_spent bigint;
  v_top_players jsonb;
  v_top_families jsonb;
  v_recent_battles jsonb;
  v_recent_purchases jsonb;
  v_recent_suspicious jsonb;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;

  SELECT COUNT(*) INTO v_total_players FROM players;
  SELECT COUNT(*) INTO v_total_purchases FROM purchases;
  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_diamond_spent
    FROM resource_transactions WHERE resource_type = 'diamonds' AND amount < 0;

  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_top_players FROM (
    SELECT id, username, level, power, vip_level, title, is_banned FROM players ORDER BY power DESC LIMIT 10
  ) t;

  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_top_families FROM (
    SELECT f.id, f.name, f.tag, f.power, f.level, f.territory_count,
           COUNT(fm.id)::int AS member_count
    FROM families f LEFT JOIN family_members fm ON fm.family_id = f.id
    GROUP BY f.id ORDER BY f.power DESC LIMIT 10
  ) t;

  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_recent_battles FROM (
    SELECT br.id, br.attacker_id, br.defender_id, br.result, br.battle_type,
           br.attacker_power, br.defender_power, br.created_at,
           ap.username AS attacker_name, dp.username AS defender_name
    FROM battle_reports br
    LEFT JOIN players ap ON ap.id = br.attacker_id
    LEFT JOIN players dp ON dp.id = br.defender_id
    ORDER BY br.created_at DESC LIMIT 10
  ) t;

  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_recent_purchases FROM (
    SELECT pu.id, pu.user_id, pu.amount, pu.status, pu.created_at,
           p.username, sp.sku, sp.name AS product_name
    FROM purchases pu
    LEFT JOIN players p ON p.id = pu.user_id
    LEFT JOIN shop_products sp ON sp.id = pu.product_id
    ORDER BY pu.created_at DESC LIMIT 10
  ) t;

  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_recent_suspicious FROM (
    SELECT sa.id, sa.user_id, sa.activity_type, sa.severity, sa.description,
           sa.payload, sa.created_at, p.username
    FROM suspicious_activity sa
    LEFT JOIN players p ON p.id = sa.user_id
    ORDER BY sa.created_at DESC LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'total_players', v_total_players,
    'total_purchases', v_total_purchases,
    'total_diamond_spent', v_total_diamond_spent,
    'top_players', COALESCE(v_top_players, '[]'::jsonb),
    'top_families', COALESCE(v_top_families, '[]'::jsonb),
    'recent_battles', COALESCE(v_recent_battles, '[]'::jsonb),
    'recent_purchases', COALESCE(v_recent_purchases, '[]'::jsonb),
    'recent_suspicious', COALESCE(v_recent_suspicious, '[]'::jsonb)
  );
END;
$$;

-- ─── Admin: list players with search ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_players(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_total integer;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;

  SELECT COUNT(*) INTO v_total FROM players
  WHERE (p_search IS NULL OR username ILIKE '%' || p_search || '%' OR email ILIKE '%' || p_search || '%');

  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_rows FROM (
    SELECT id, email, username, level, xp, power, vip_level, vip_points,
           cash, diamonds, influence, loyalty, weapon_power, black_money, intel,
           police_heat, role, is_banned, ban_reason, created_at, updated_at, title, reputation, family_id
    FROM players
    WHERE (p_search IS NULL OR username ILIKE '%' || p_search || '%' OR email ILIKE '%' || p_search || '%')
    ORDER BY power DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'players', COALESCE(v_rows, '[]'::jsonb),
    'total', v_total
  );
END;
$$;

-- ─── Admin: get single player detail ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_player(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player jsonb;
  v_buildings jsonb;
  v_recent_missions jsonb;
  v_recent_battles jsonb;
  v_family jsonb;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;

  SELECT row_to_json(p)::jsonb INTO v_player FROM players p WHERE id = p_player_id;
  IF v_player IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi');
  END IF;

  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_buildings FROM (
    SELECT b.*, bd.name AS building_name FROM buildings b
    LEFT JOIN building_definitions bd ON bd.type = b.building_type
    WHERE b.user_id = p_player_id
  ) t;

  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_recent_missions FROM (
    SELECT um.id, um.status, um.started_at, um.ends_at,
           m.name AS mission_name, m.category
    FROM user_missions um LEFT JOIN missions m ON m.id = um.mission_id
    WHERE um.user_id = p_player_id ORDER BY um.created_at DESC LIMIT 10
  ) t;

  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_recent_battles FROM (
    SELECT br.id, br.result, br.battle_type, br.created_at,
           br.attacker_power, br.defender_power,
           CASE WHEN br.attacker_id = p_player_id THEN 'attacker' ELSE 'defender' END AS role,
           CASE WHEN br.attacker_id = p_player_id THEN dp.username ELSE ap.username END AS opponent
    FROM battle_reports br
    LEFT JOIN players ap ON ap.id = br.attacker_id
    LEFT JOIN players dp ON dp.id = br.defender_id
    WHERE br.attacker_id = p_player_id OR br.defender_id = p_player_id
    ORDER BY br.created_at DESC LIMIT 10
  ) t;

  SELECT row_to_json(f)::jsonb INTO v_family FROM families f
  WHERE f.id = (SELECT family_id FROM players WHERE id = p_player_id);

  RETURN jsonb_build_object(
    'ok', true,
    'player', v_player,
    'buildings', COALESCE(v_buildings, '[]'::jsonb),
    'recent_missions', COALESCE(v_recent_missions, '[]'::jsonb),
    'recent_battles', COALESCE(v_recent_battles, '[]'::jsonb),
    'family', v_family
  );
END;
$$;

-- ─── Admin: adjust player resources ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_adjust_resources(
  p_player_id uuid,
  p_resource text,
  p_amount integer,
  p_reason text DEFAULT 'Admin adjustment'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid_resources text[] := ARRAY['cash','diamonds','influence','loyalty','weapon_power','black_money','intel','xp','power'];
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;

  IF NOT (p_resource = ANY(v_valid_resources)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Gecersiz kaynak tipi');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_player_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi');
  END IF;

  EXECUTE format(
    'UPDATE players SET %I = GREATEST(0, %I + $1), updated_at = now() WHERE id = $2',
    p_resource, p_resource
  ) USING p_amount, p_player_id;

  INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, payload)
  VALUES (auth.uid(), 'adjust_resources', 'player', p_player_id,
    jsonb_build_object('resource', p_resource, 'amount', p_amount, 'reason', p_reason));

  INSERT INTO resource_transactions (user_id, source_type, source_id, resource_type, amount, balance_after)
  VALUES (p_player_id, 'admin_adjustment', NULL, p_resource, p_amount, 0);

  RETURN jsonb_build_object('ok', true, 'resource', p_resource, 'amount', p_amount);
END;
$$;

-- ─── Admin: ban/unban player ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_ban_player(
  p_player_id uuid,
  p_reason text DEFAULT 'Kural ihlali'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_player_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi');
  END IF;

  UPDATE players SET is_banned = true, ban_reason = p_reason WHERE id = p_player_id;

  INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, payload)
  VALUES (auth.uid(), 'ban_player', 'player', p_player_id, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION admin_unban_player(p_player_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;

  UPDATE players SET is_banned = false, ban_reason = NULL WHERE id = p_player_id;

  INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, payload)
  VALUES (auth.uid(), 'unban_player', 'player', p_player_id, '{}');

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Admin: update shop product ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_update_product(
  p_product_id uuid,
  p_is_active boolean DEFAULT NULL,
  p_price integer DEFAULT NULL,
  p_contents jsonb DEFAULT NULL,
  p_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;

  UPDATE shop_products
  SET
    is_active = COALESCE(p_is_active, is_active),
    price     = COALESCE(p_price,     price),
    contents  = COALESCE(p_contents,  contents),
    name      = COALESCE(p_name,      name)
  WHERE id = p_product_id;

  INSERT INTO admin_logs (admin_user_id, action, target_type, target_id, payload)
  VALUES (auth.uid(), 'update_product', 'shop_product', p_product_id,
    jsonb_build_object(
      'is_active', p_is_active,
      'price', p_price,
      'name', p_name
    ));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Admin: get shop products ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_products()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;
  SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.price) INTO v_rows FROM (
    SELECT *, (SELECT COUNT(*) FROM purchases WHERE product_id = sp.id)::int AS purchase_count
    FROM shop_products sp
  ) t;
  RETURN jsonb_build_object('ok', true, 'products', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

-- ─── Admin: get families ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_families(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb; v_total integer;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;
  SELECT COUNT(*) INTO v_total FROM families;
  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_rows FROM (
    SELECT f.id, f.name, f.tag, f.power, f.level, f.territory_count, f.created_at,
           COUNT(fm.id)::int AS member_count,
           lp.username AS leader_name
    FROM families f
    LEFT JOIN family_members fm ON fm.family_id = f.id
    LEFT JOIN players lp ON lp.id = f.leader_id
    GROUP BY f.id, lp.username
    ORDER BY f.power DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN jsonb_build_object('ok', true, 'families', COALESCE(v_rows, '[]'::jsonb), 'total', v_total);
END;
$$;

-- ─── Admin: get family detail ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_family(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_family jsonb; v_members jsonb;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;
  SELECT row_to_json(f)::jsonb INTO v_family FROM families f WHERE f.id = p_family_id;
  IF v_family IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Aile bulunamadi'); END IF;
  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_members FROM (
    SELECT fm.id, fm.user_id, fm.rank, fm.contribution, fm.joined_at,
           p.username, p.level, p.power
    FROM family_members fm LEFT JOIN players p ON p.id = fm.user_id
    WHERE fm.family_id = p_family_id ORDER BY fm.rank DESC, p.power DESC
  ) t;
  RETURN jsonb_build_object('ok', true, 'family', v_family, 'members', COALESCE(v_members, '[]'::jsonb));
END;
$$;

-- ─── Admin: get battle reports ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_battles(
  p_player_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb; v_total integer;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;
  SELECT COUNT(*) INTO v_total FROM battle_reports
  WHERE (p_player_id IS NULL OR attacker_id = p_player_id OR defender_id = p_player_id);
  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_rows FROM (
    SELECT br.id, br.attacker_id, br.defender_id, br.result, br.battle_type,
           br.attacker_power, br.defender_power, br.loot, br.casualties, br.created_at,
           ap.username AS attacker_name, dp.username AS defender_name
    FROM battle_reports br
    LEFT JOIN players ap ON ap.id = br.attacker_id
    LEFT JOIN players dp ON dp.id = br.defender_id
    WHERE (p_player_id IS NULL OR br.attacker_id = p_player_id OR br.defender_id = p_player_id)
    ORDER BY br.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN jsonb_build_object('ok', true, 'battles', COALESCE(v_rows, '[]'::jsonb), 'total', v_total);
END;
$$;

-- ─── Admin: get suspicious activity ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_suspicious(
  p_severity text DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb; v_total integer;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;
  SELECT COUNT(*) INTO v_total FROM suspicious_activity
  WHERE (p_severity IS NULL OR severity = p_severity);
  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_rows FROM (
    SELECT sa.id, sa.user_id, sa.activity_type, sa.severity, sa.description,
           sa.payload, sa.created_at, p.username, p.email
    FROM suspicious_activity sa
    LEFT JOIN players p ON p.id = sa.user_id
    WHERE (p_severity IS NULL OR sa.severity = p_severity)
    ORDER BY sa.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN jsonb_build_object('ok', true, 'items', COALESCE(v_rows, '[]'::jsonb), 'total', v_total);
END;
$$;

-- ─── Admin: get purchases ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_purchases(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb; v_total integer;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;
  SELECT COUNT(*) INTO v_total FROM purchases;
  SELECT jsonb_agg(row_to_json(t)::jsonb) INTO v_rows FROM (
    SELECT pu.id, pu.user_id, pu.amount, pu.currency, pu.status, pu.created_at,
           p.username, sp.sku, sp.name AS product_name
    FROM purchases pu
    LEFT JOIN players p ON p.id = pu.user_id
    LEFT JOIN shop_products sp ON sp.id = pu.product_id
    ORDER BY pu.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN jsonb_build_object('ok', true, 'purchases', COALESCE(v_rows, '[]'::jsonb), 'total', v_total);
END;
$$;

-- ─── Admin: get chest definitions ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_chests()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;
  SELECT jsonb_agg(row_to_json(c)::jsonb) INTO v_rows FROM chest_definitions c ORDER BY diamond_cost;
  RETURN jsonb_build_object('ok', true, 'chests', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

-- ─── Admin: get vip definitions ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_get_vip_defs()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows jsonb;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz erisim');
  END IF;
  SELECT jsonb_agg(row_to_json(v)::jsonb ORDER BY v.vip_level) INTO v_rows FROM vip_definitions v;
  RETURN jsonb_build_object('ok', true, 'vip_defs', COALESCE(v_rows, '[]'::jsonb));
END;
$$;

-- ─── RLS on admin_logs: only admins can read ──────────────────────────────────
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_only_read_logs" ON admin_logs;
CREATE POLICY "admin_only_read_logs" ON admin_logs FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "no_client_insert_logs" ON admin_logs;
CREATE POLICY "no_client_insert_logs" ON admin_logs FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "no_client_update_logs" ON admin_logs;
CREATE POLICY "no_client_update_logs" ON admin_logs FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "no_client_delete_logs" ON admin_logs;
CREATE POLICY "no_client_delete_logs" ON admin_logs FOR DELETE
  TO authenticated USING (false);

-- ─── Grant execute on all admin functions ────────────────────────────────────
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_players(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_player(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_adjust_resources(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_ban_player(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_unban_player(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_product(uuid, boolean, integer, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_products() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_families(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_family(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_battles(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_suspicious(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_purchases(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_chests() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_vip_defs() TO authenticated;
