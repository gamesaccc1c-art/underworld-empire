
-- ═══════════════════════════════════════════════════════════════════════════════
-- SHOP / VIP / CHEST RPCs
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Enhanced buy_demo_product with VIP points & purchase log ────────────────
CREATE OR REPLACE FUNCTION buy_demo_product(p_product_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_product record;
  v_contents jsonb;
  v_vip_points int;
  v_diamonds int;
  v_new_vip int;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  SELECT * INTO v_product FROM shop_products WHERE id = p_product_id AND is_active = true;
  IF v_product IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Urun bulunamadi veya aktif degil'); END IF;

  v_contents := v_product.contents;

  -- Grant direct resources
  UPDATE players SET
    cash = cash + COALESCE((v_contents->>'cash')::int, 0),
    diamonds = diamonds + COALESCE((v_contents->>'diamonds')::int, 0),
    influence = influence + COALESCE((v_contents->>'influence')::int, 0),
    loyalty = loyalty + COALESCE((v_contents->>'loyalty')::int, 0),
    weapon_power = weapon_power + COALESCE((v_contents->>'weapon_power')::int, 0),
    black_money = black_money + COALESCE((v_contents->>'black_money')::int, 0),
    intel = intel + COALESCE((v_contents->>'intel')::int, 0)
  WHERE id = v_uid;

  -- Grant VIP points (1 VIP point per 1 TRY spent)
  v_vip_points := COALESCE((v_contents->>'vip_points')::int, 0) + v_product.price;
  UPDATE players SET vip_points = vip_points + v_vip_points WHERE id = v_uid;

  -- Check VIP level up
  SELECT vip_points + v_vip_points INTO v_diamonds FROM players WHERE id = v_uid;
  SELECT COALESCE(MAX(vip_level), 0) INTO v_new_vip
    FROM vip_definitions WHERE points_required <= (v_player.vip_points + v_vip_points);
  IF v_new_vip > v_player.vip_level THEN
    UPDATE players SET vip_level = v_new_vip WHERE id = v_uid;
  END IF;

  -- Grant speed-up items
  IF (v_contents->>'speed_5m') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_5m', (v_contents->>'speed_5m')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_5m')::int;
  END IF;
  IF (v_contents->>'speed_1h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_1h', (v_contents->>'speed_1h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_1h')::int;
  END IF;
  IF (v_contents->>'speed_2h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_2h', (v_contents->>'speed_2h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_2h')::int;
  END IF;
  IF (v_contents->>'speed_5h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_5h', (v_contents->>'speed_5h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_5h')::int;
  END IF;
  IF (v_contents->>'speed_8h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_8h', (v_contents->>'speed_8h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_8h')::int;
  END IF;
  IF (v_contents->>'speed_24h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_24h', (v_contents->>'speed_24h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_24h')::int;
  END IF;
  IF (v_contents->>'speed_50h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_50h', (v_contents->>'speed_50h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_contents->>'speed_50h')::int;
  END IF;

  -- Monthly card
  IF v_product.sku = 'monthly_card' THEN
    UPDATE players SET monthly_card_until = now() + interval '30 days' WHERE id = v_uid;
  END IF;
  -- Season pass
  IF v_product.sku = 'season_pass' THEN
    UPDATE players SET season_pass_until = now() + interval '90 days' WHERE id = v_uid;
  END IF;

  -- Shield
  IF (v_contents->>'shield_3d') IS NOT NULL THEN
    UPDATE players SET shield_until = GREATEST(COALESCE(shield_until, now()), now()) + interval '3 days' WHERE id = v_uid;
  END IF;

  -- Log purchase
  INSERT INTO purchases (user_id, product_id, product_sku, amount, currency, provider, status, contents, vip_points_earned)
  VALUES (v_uid, p_product_id, v_product.sku, v_product.price, v_product.currency, 'demo', 'completed', v_contents, v_vip_points);

  RETURN jsonb_build_object('ok', true, 'contents', v_contents, 'vip_points', v_vip_points);
END;
$$;

-- ─── Open Chest (enhanced) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION open_game_chest(p_chest_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_chest record;
  v_roll numeric;
  v_rarity text;
  v_rewards jsonb := '{}'::jsonb;
  v_possible jsonb;
  v_min int;
  v_max int;
  v_amount int;
  v_key text;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;

  SELECT * INTO v_chest FROM chest_definitions WHERE chest_type = p_chest_type;
  IF v_chest IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Sandik bulunamadi'); END IF;

  IF v_player.level < v_chest.min_level THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Minimum seviye: ' || v_chest.min_level);
  END IF;

  IF v_player.diamonds < v_chest.diamond_cost THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetersiz elmas (' || v_chest.diamond_cost || ' gerekli)');
  END IF;

  -- Deduct diamonds
  UPDATE players SET diamonds = diamonds - v_chest.diamond_cost WHERE id = v_uid;

  -- Roll rarity
  v_roll := random() * 100;
  IF v_roll < COALESCE((v_chest.drop_rates->>'mythic')::numeric, 0) THEN v_rarity := 'mythic';
  ELSIF v_roll < COALESCE((v_chest.drop_rates->>'mythic')::numeric, 0) + COALESCE((v_chest.drop_rates->>'legendary')::numeric, 0) THEN v_rarity := 'legendary';
  ELSIF v_roll < COALESCE((v_chest.drop_rates->>'mythic')::numeric, 0) + COALESCE((v_chest.drop_rates->>'legendary')::numeric, 0) + COALESCE((v_chest.drop_rates->>'epic')::numeric, 0) THEN v_rarity := 'epic';
  ELSIF v_roll < COALESCE((v_chest.drop_rates->>'mythic')::numeric, 0) + COALESCE((v_chest.drop_rates->>'legendary')::numeric, 0) + COALESCE((v_chest.drop_rates->>'epic')::numeric, 0) + COALESCE((v_chest.drop_rates->>'rare')::numeric, 0) THEN v_rarity := 'rare';
  ELSIF v_roll < 100 - COALESCE((v_chest.drop_rates->>'common')::numeric, 0) THEN v_rarity := 'uncommon';
  ELSE v_rarity := 'common';
  END IF;

  -- Generate rewards based on rarity multiplier
  v_possible := v_chest.possible_rewards;
  FOR v_key IN SELECT jsonb_object_keys(v_possible) LOOP
    v_min := (v_possible->v_key->>0)::int;
    v_max := (v_possible->v_key->>1)::int;
    -- Scale by rarity
    v_amount := v_min + floor(random() * (v_max - v_min + 1))::int;
    IF v_rarity = 'uncommon' THEN v_amount := round(v_amount * 1.3)::int;
    ELSIF v_rarity = 'rare' THEN v_amount := round(v_amount * 1.8)::int;
    ELSIF v_rarity = 'epic' THEN v_amount := round(v_amount * 2.5)::int;
    ELSIF v_rarity = 'legendary' THEN v_amount := round(v_amount * 4.0)::int;
    ELSIF v_rarity = 'mythic' THEN v_amount := round(v_amount * 6.0)::int;
    END IF;
    -- Only include 2-3 reward types randomly
    IF random() > 0.4 THEN
      v_rewards := v_rewards || jsonb_build_object(v_key, v_amount);
    END IF;
  END LOOP;

  -- Ensure at least one reward
  IF v_rewards = '{}'::jsonb THEN
    v_key := (SELECT jsonb_object_keys(v_possible) LIMIT 1);
    v_min := (v_possible->v_key->>0)::int;
    v_max := (v_possible->v_key->>1)::int;
    v_amount := v_min + floor(random() * (v_max - v_min + 1))::int;
    v_rewards := jsonb_build_object(v_key, v_amount);
  END IF;

  -- Apply resource rewards
  UPDATE players SET
    cash = cash + COALESCE((v_rewards->>'cash')::int, 0),
    diamonds = diamonds + COALESCE((v_rewards->>'diamonds')::int, 0),
    influence = influence + COALESCE((v_rewards->>'influence')::int, 0),
    weapon_power = weapon_power + COALESCE((v_rewards->>'weapon_power')::int, 0),
    black_money = black_money + COALESCE((v_rewards->>'black_money')::int, 0),
    intel = intel + COALESCE((v_rewards->>'intel')::int, 0),
    vip_points = vip_points + COALESCE((v_rewards->>'vip_points')::int, 0)
  WHERE id = v_uid;

  -- Grant speed-up items from chest
  IF (v_rewards->>'speed_5m') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_5m', (v_rewards->>'speed_5m')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_rewards->>'speed_5m')::int;
  END IF;
  IF (v_rewards->>'speed_1h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_1h', (v_rewards->>'speed_1h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_rewards->>'speed_1h')::int;
  END IF;
  IF (v_rewards->>'speed_8h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_8h', (v_rewards->>'speed_8h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_rewards->>'speed_8h')::int;
  END IF;
  IF (v_rewards->>'speed_24h') IS NOT NULL THEN
    INSERT INTO player_items (user_id, item_key, amount) VALUES (v_uid, 'speed_24h', (v_rewards->>'speed_24h')::int)
    ON CONFLICT (user_id, item_key) DO UPDATE SET amount = player_items.amount + (v_rewards->>'speed_24h')::int;
  END IF;

  -- Log chest opening
  INSERT INTO chest_openings (user_id, chest_type, cost, rewards)
  VALUES (v_uid, p_chest_type, v_chest.diamond_cost, v_rewards);

  RETURN jsonb_build_object('ok', true, 'rarity', v_rarity, 'rewards', v_rewards, 'chest_type', p_chest_type);
END;
$$;

-- ─── Claim VIP Daily Reward ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_vip_daily()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_vip_def record;
  v_daily_diamonds int;
  v_monthly_bonus int := 0;
  v_season_bonus int := 0;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;
  IF v_player IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Oyuncu bulunamadi'); END IF;
  IF v_player.vip_level < 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'VIP seviyeniz yok'); END IF;

  -- Check daily claim
  IF v_player.last_vip_claim_at = CURRENT_DATE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bugun zaten aldiniz');
  END IF;

  SELECT * INTO v_vip_def FROM vip_definitions WHERE vip_level = v_player.vip_level;
  v_daily_diamonds := COALESCE(v_vip_def.daily_diamonds, 0);

  -- Monthly card bonus
  IF v_player.monthly_card_until IS NOT NULL AND v_player.monthly_card_until > now() THEN
    v_monthly_bonus := 200;
  END IF;

  -- Season pass bonus
  IF v_player.season_pass_until IS NOT NULL AND v_player.season_pass_until > now() THEN
    v_season_bonus := 100;
  END IF;

  UPDATE players SET
    diamonds = diamonds + v_daily_diamonds + v_monthly_bonus + v_season_bonus,
    last_vip_claim_at = CURRENT_DATE
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'ok', true,
    'diamonds', v_daily_diamonds + v_monthly_bonus + v_season_bonus,
    'vip_diamonds', v_daily_diamonds,
    'monthly_bonus', v_monthly_bonus,
    'season_bonus', v_season_bonus,
    'chest_tier', v_vip_def.daily_chest_tier
  );
END;
$$;

-- ─── Get VIP Info ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_vip_info()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_player record;
  v_current_vip jsonb;
  v_next_vip jsonb;
  v_all_vips jsonb;
BEGIN
  SELECT * INTO v_player FROM players WHERE id = v_uid;

  SELECT row_to_json(vd)::jsonb INTO v_current_vip FROM vip_definitions vd WHERE vd.vip_level = v_player.vip_level;
  SELECT row_to_json(vd)::jsonb INTO v_next_vip FROM vip_definitions vd WHERE vd.vip_level = v_player.vip_level + 1;

  SELECT jsonb_agg(row_to_json(vd)::jsonb ORDER BY vd.vip_level)
  INTO v_all_vips FROM vip_definitions vd;

  RETURN jsonb_build_object(
    'ok', true,
    'vip_level', v_player.vip_level,
    'vip_points', v_player.vip_points,
    'current', v_current_vip,
    'next', v_next_vip,
    'all', v_all_vips,
    'can_claim_daily', v_player.last_vip_claim_at IS NULL OR v_player.last_vip_claim_at < CURRENT_DATE,
    'monthly_card_active', v_player.monthly_card_until IS NOT NULL AND v_player.monthly_card_until > now(),
    'season_pass_active', v_player.season_pass_until IS NOT NULL AND v_player.season_pass_until > now()
  );
END;
$$;

-- ─── Get Player Items ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_player_items()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_items jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('item_key', item_key, 'amount', amount))
  INTO v_items FROM player_items WHERE user_id = v_uid AND amount > 0;
  RETURN COALESCE(v_items, '[]'::jsonb);
END;
$$;

-- ─── Use Speed-Up Item ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION use_speedup_item(p_item_key text, p_target_type text, p_target_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item record;
  v_minutes int;
  v_reduction interval;
BEGIN
  SELECT * INTO v_item FROM player_items WHERE user_id = v_uid AND item_key = p_item_key;
  IF v_item IS NULL OR v_item.amount < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetersiz hizlandirici');
  END IF;

  -- Map item to minutes
  v_minutes := CASE p_item_key
    WHEN 'speed_5m' THEN 5
    WHEN 'speed_1h' THEN 60
    WHEN 'speed_2h' THEN 120
    WHEN 'speed_5h' THEN 300
    WHEN 'speed_8h' THEN 480
    WHEN 'speed_24h' THEN 1440
    WHEN 'speed_50h' THEN 3000
    ELSE 0
  END;
  IF v_minutes = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Gecersiz item'); END IF;

  v_reduction := (v_minutes || ' minutes')::interval;

  -- Apply to target
  IF p_target_type = 'building' THEN
    UPDATE buildings SET upgrade_ends_at = upgrade_ends_at - v_reduction
    WHERE id = p_target_id AND user_id = v_uid AND is_upgrading = true;
  ELSIF p_target_type = 'research' THEN
    UPDATE user_research SET ends_at = ends_at - v_reduction
    WHERE id = p_target_id AND user_id = v_uid AND is_researching = true;
  ELSIF p_target_type = 'training' THEN
    UPDATE troop_training_queue SET ends_at = ends_at - v_reduction
    WHERE id = p_target_id AND user_id = v_uid AND status = 'training';
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Gecersiz hedef tipi');
  END IF;

  -- Deduct item
  UPDATE player_items SET amount = amount - 1 WHERE id = v_item.id;

  RETURN jsonb_build_object('ok', true, 'minutes_reduced', v_minutes);
END;
$$;
