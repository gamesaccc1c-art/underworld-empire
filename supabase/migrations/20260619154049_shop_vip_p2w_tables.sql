
-- ═══════════════════════════════════════════════════════════════════════════════
-- SHOP, VIP & P2W ECONOMY SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── VIP Definitions (15 levels) — recreate with proper columns ──────────────
DROP TABLE IF EXISTS vip_definitions CASCADE;
CREATE TABLE vip_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vip_level int NOT NULL UNIQUE,
  points_required int NOT NULL,
  daily_diamonds int NOT NULL DEFAULT 0,
  construction_speed int DEFAULT 0,
  training_speed int DEFAULT 0,
  research_speed int DEFAULT 0,
  resource_production int DEFAULT 0,
  attack_bonus int DEFAULT 0,
  defense_bonus int DEFAULT 0,
  extra_missions int DEFAULT 0,
  extra_raids int DEFAULT 0,
  energy_regen_bonus int DEFAULT 0,
  shop_discount int DEFAULT 0,
  daily_chest_tier text DEFAULT 'none'
);
ALTER TABLE vip_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_vip_defs" ON vip_definitions FOR SELECT TO authenticated USING (true);

INSERT INTO vip_definitions (vip_level, points_required, daily_diamonds, construction_speed, training_speed, research_speed, resource_production, attack_bonus, defense_bonus, extra_missions, extra_raids, energy_regen_bonus, shop_discount, daily_chest_tier) VALUES
  (1,  100,    20,  5,  3,  3,  5,  0,  0,  0, 0,  5,  0, 'bronze'),
  (2,  500,    30,  8,  5,  5,  8,  2,  1,  1, 0,  8,  3, 'bronze'),
  (3,  1500,   50,  12, 8,  8,  12, 3,  2,  1, 1,  10, 5, 'bronze'),
  (4,  3000,   80,  15, 10, 10, 15, 5,  3,  2, 1,  12, 5, 'silver'),
  (5,  6000,   100, 18, 12, 12, 18, 6,  4,  2, 2,  15, 8, 'silver'),
  (6,  10000,  130, 20, 15, 15, 20, 8,  5,  3, 2,  18, 8, 'silver'),
  (7,  16000,  160, 23, 18, 18, 23, 10, 6,  3, 3,  20, 10, 'gold'),
  (8,  25000,  200, 25, 20, 20, 25, 12, 8,  4, 3,  22, 10, 'gold'),
  (9,  35000,  250, 28, 22, 22, 28, 14, 10, 4, 4,  25, 12, 'gold'),
  (10, 50000,  300, 30, 25, 25, 30, 16, 12, 5, 4,  28, 12, 'gold'),
  (11, 70000,  350, 33, 28, 28, 33, 18, 14, 5, 5,  30, 15, 'epic'),
  (12, 100000, 400, 35, 30, 30, 35, 20, 16, 6, 5,  33, 15, 'epic'),
  (13, 150000, 500, 38, 33, 33, 38, 22, 18, 6, 6,  35, 18, 'epic'),
  (14, 220000, 600, 40, 35, 35, 40, 25, 20, 7, 6,  38, 18, 'legendary'),
  (15, 350000, 800, 45, 40, 40, 45, 30, 25, 8, 7,  40, 20, 'legendary');

-- ─── Purchases table (future payment ready) ─────────────────────────────────
DROP TABLE IF EXISTS purchases CASCADE;
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES players(id),
  product_id uuid REFERENCES shop_products(id),
  product_sku text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'TRY',
  provider text DEFAULT 'demo',
  external_payment_id text DEFAULT NULL,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  webhook_verified boolean DEFAULT false,
  contents jsonb DEFAULT '{}',
  vip_points_earned int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_purchases" ON purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_purchases" ON purchases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_purchases" ON purchases FOR UPDATE TO authenticated USING (false);
CREATE POLICY "delete_own_purchases" ON purchases FOR DELETE TO authenticated USING (false);

-- ─── Player items inventory (speed-ups, boosts) ─────────────────────────────
DROP TABLE IF EXISTS player_items CASCADE;
CREATE TABLE player_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES players(id),
  item_key text NOT NULL,
  amount int DEFAULT 1,
  UNIQUE(user_id, item_key)
);
ALTER TABLE player_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_items" ON player_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_items" ON player_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_items" ON player_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_own_items" ON player_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── Enhanced shop_products for full P2W catalog ─────────────────────────────
DELETE FROM shop_products WHERE true;

INSERT INTO shop_products (sku, name, description, price, currency, contents, is_active, is_limited, badge, discount_label) VALUES
('starter_pack', 'Baslangic Paketi', '1.000 Elmas + 50.000 Nakit + 2 Saat Hizlandirici + Rare Enforcer Parcasi', 49, 'TRY', '{"diamonds":1000,"cash":50000,"speed_2h":2,"enforcer_shards":5}', true, false, 'Yeni Baslayanlar', '%400 Deger'),
('daily_diamond', 'Gunluk Elmas Paketi', '30 gun boyunca her gun 200 Elmas. Toplam 6.000 Elmas!', 79, 'TRY', '{"diamonds_daily":200,"duration_days":30}', true, false, 'En Karli', 'Gunluk 2.6 TL'),
('weekly_power', 'Haftalik Guc Paketi', '3.000 Elmas + 100.000 Nakit + 50.000 Silah Gucu + 5 Saat Hizlandirici', 199, 'TRY', '{"diamonds":3000,"cash":100000,"weapon_power":50000,"speed_5h":3}', true, false, 'Haftalik', '%350 Deger'),
('boss_pack', 'Patron Paketi', '40.000 Elmas + Legendary Enforcer + 3 Gunluk Kalkan + 50 Saat Hizlandirici + 500K Nakit', 1999, 'TRY', '{"diamonds":40000,"cash":500000,"speed_50h":1,"shield_3d":1,"legendary_shards":20}', true, true, 'PATRON', '%500 Deger'),
('family_war_pack', 'Aile Savasi Paketi', '10.000 Elmas + 200 Agir Tim + 100.000 Silah Gucu + Savas Hizlandirici', 699, 'TRY', '{"diamonds":10000,"heavy_crew":200,"weapon_power":100000,"war_boost":1}', true, false, 'Savas', '%300 Deger'),
('legendary_enforcer_pack', 'Legendary Enforcer Paketi', 'Garantili Legendary Enforcer + 5.000 Elmas + 20 Enforcer Parcasi', 999, 'TRY', '{"diamonds":5000,"legendary_shards":20,"enforcer_chest_legendary":1}', true, true, 'LEGENDARI', 'Garantili'),
('speedup_pack', 'Hizlandirici Paketi', '24 Saat + 5x8 Saat + 10x1 Saat + 20x5 Dakika Hizlandirici', 299, 'TRY', '{"speed_24h":1,"speed_8h":5,"speed_1h":10,"speed_5m":20}', true, false, 'Hiz', '%250 Deger'),
('resource_pack', 'Kaynak Paketi', '500K Nakit + 100K Kara Para + 50K Silah Gucu + 10K Istihbarat', 349, 'TRY', '{"cash":500000,"black_money":100000,"weapon_power":50000,"intel":10000}', true, false, 'Kaynak', '%200 Deger'),
('black_market_pack', 'Kara Borsa Paketi', '300K Kara Para + 200K Nakit + 50K Istihbarat + 3 Rare Sandik', 449, 'TRY', '{"black_money":300000,"cash":200000,"intel":50000,"rare_chest":3}', true, false, 'Kara Borsa', '%280 Deger'),
('vip_points_pack', 'VIP Puan Paketi', '5.000 VIP Puani + 2.000 Elmas + Gunluk VIP Sandik x7', 399, 'TRY', '{"vip_points":5000,"diamonds":2000}', true, false, 'VIP', 'Aninda VIP+'),
('monthly_card', 'Aylik Kart', '30 gun: Gunluk 200 Elmas + VIP Sandik + Ek Gorev + Ek Baskin', 149, 'TRY', '{"diamonds_daily":200,"daily_chest":1,"extra_mission":1,"extra_raid":1,"duration_days":30}', true, false, 'Aylik', 'Gunluk 5 TL'),
('season_pass', 'Sezon Karti', '90 gun: Gunluk 100 Elmas + Haftalik Epic Sandik + Ozel Avatar + %10 XP', 499, 'TRY', '{"diamonds_daily":100,"weekly_epic_chest":1,"xp_bonus":10,"avatar_frame":"season_gold","duration_days":90}', true, false, 'SEZON', '90 Gun Bonus'),
('diamond_100', '100 Elmas', 'Kucuk elmas paketi', 19, 'TRY', '{"diamonds":100}', true, false, null, null),
('diamond_500', '500 Elmas', '+50 Bonus Elmas', 49, 'TRY', '{"diamonds":550}', true, false, null, '+%10'),
('diamond_2500', '2.500 Elmas', '+500 Bonus Elmas', 199, 'TRY', '{"diamonds":3000}', true, false, 'Populer', '+%20'),
('diamond_10000', '10.000 Elmas', '+3.000 Bonus Elmas', 699, 'TRY', '{"diamonds":13000}', true, false, 'En Karli', '+%30'),
('diamond_50000', '50.000 Elmas', '+20.000 Bonus Elmas', 2999, 'TRY', '{"diamonds":70000}', true, false, 'MEGA', '+%40');

-- ─── Chest definitions ───────────────────────────────────────────────────────
DROP TABLE IF EXISTS chest_definitions CASCADE;
CREATE TABLE chest_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chest_type text NOT NULL UNIQUE,
  name text NOT NULL,
  description text DEFAULT '',
  diamond_cost int NOT NULL DEFAULT 0,
  drop_rates jsonb NOT NULL DEFAULT '{}',
  possible_rewards jsonb NOT NULL DEFAULT '{}',
  min_level int DEFAULT 1
);
ALTER TABLE chest_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_chests" ON chest_definitions FOR SELECT TO authenticated USING (true);

INSERT INTO chest_definitions (chest_type, name, description, diamond_cost, drop_rates, possible_rewards, min_level) VALUES
('normal', 'Normal Sandik', 'Temel oduller. Her gun 1 ucretsiz!', 50, '{"common":60,"uncommon":25,"rare":12,"epic":2.5,"legendary":0.5}', '{"cash":[1000,5000],"diamonds":[5,20],"influence":[100,500],"speed_5m":[1,3]}', 1),
('rare', 'Rare Sandik', 'Daha iyi oduller ve enforcer parcalari.', 150, '{"common":30,"uncommon":35,"rare":25,"epic":8,"legendary":2}', '{"cash":[5000,20000],"diamonds":[20,50],"weapon_power":[2000,8000],"enforcer_shards":[3,8],"speed_1h":[1,2]}', 3),
('epic', 'Epic Sandik', 'Yuksek oduller garantili. Epic+ enforcer sansi.', 500, '{"common":10,"uncommon":20,"rare":35,"epic":25,"legendary":8,"mythic":2}', '{"cash":[20000,80000],"diamonds":[50,200],"black_money":[10000,40000],"enforcer_shards":[8,15],"speed_8h":[1,3]}', 5),
('legendary', 'Legendary Sandik', 'En iyi oduller. Legendary enforcer sansi!', 1500, '{"common":5,"uncommon":10,"rare":20,"epic":35,"legendary":22,"mythic":8}', '{"cash":[50000,200000],"diamonds":[200,500],"weapon_power":[30000,100000],"enforcer_shards":[15,30],"speed_24h":[1,2]}', 8),
('enforcer', 'Enforcer Sandigi', 'Enforcer parcalari garantili!', 300, '{"common":20,"uncommon":30,"rare":30,"epic":15,"legendary":4,"mythic":1}', '{"enforcer_shards":[5,20],"diamonds":[10,50]}', 1),
('event', 'Etkinlik Sandigi', 'Ozel etkinlik oduller! Sinirli sure.', 800, '{"common":5,"uncommon":15,"rare":30,"epic":30,"legendary":15,"mythic":5}', '{"cash":[30000,150000],"diamonds":[100,400],"vip_points":[100,500],"enforcer_shards":[10,25],"speed_8h":[2,5]}', 1);

-- ─── Add VIP/subscription tracking to players ────────────────────────────────
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_vip_claim_at date DEFAULT NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS monthly_card_until timestamptz DEFAULT NULL;
ALTER TABLE players ADD COLUMN IF NOT EXISTS season_pass_until timestamptz DEFAULT NULL;
