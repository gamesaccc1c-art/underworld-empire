
-- Daily login rewards (7-day cycle)
INSERT INTO daily_login_rewards (day_number, cash, diamonds, xp, label) VALUES
(1, 5000, 0, 100, 'Günlük Giriş'),
(2, 10000, 0, 200, 'Devam'),
(3, 15000, 10, 300, 'Harika!'),
(4, 20000, 0, 400, 'Tutarlı'),
(5, 25000, 20, 500, 'Kararlı'),
(6, 30000, 0, 600, 'Neredeyse!'),
(7, 50000, 50, 1000, 'Haftalık Bonus!')
ON CONFLICT (day_number) DO UPDATE SET cash = EXCLUDED.cash, diamonds = EXCLUDED.diamonds, xp = EXCLUDED.xp, label = EXCLUDED.label;

-- Daily quest thresholds
INSERT INTO daily_quest_thresholds (id, required_points, chest_type) VALUES
(1, 20, 'bronze'),
(2, 40, 'bronze'),
(3, 60, 'silver'),
(4, 80, 'silver'),
(5, 100, 'gold')
ON CONFLICT (id) DO UPDATE SET required_points = EXCLUDED.required_points, chest_type = EXCLUDED.chest_type;

-- Daily quest definitions
INSERT INTO quest_definitions (quest_type, name, description, points, target_value) VALUES
('complete_mission', 'Görev Tamamla', 'Herhangi bir karanlık iş tamamla', 20, 1),
('collect_production', 'Üretim Topla', 'Binadan üretim topla', 10, 3),
('train_troops', 'Asker Eğit', 'Asker eğitimini tamamla', 20, 1),
('pvp_attack', 'Rakibe Saldır', 'PvP savaşı yap', 30, 1),
('upgrade_building', 'Bina Geliştir', 'Bina geliştirme tamamla', 20, 1)
ON CONFLICT (quest_type) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, points = EXCLUDED.points, target_value = EXCLUDED.target_value;

-- Weekly quest definitions
INSERT INTO weekly_quest_definitions (quest_type, name, description, target_value, reward_cash, reward_diamonds, reward_xp) VALUES
('weekly_building_upgrades', 'İnşaat Ustası', '5 bina geliştirme tamamla', 5, 100000, 50, 2000),
('weekly_train_troops', 'Ordu Komutanı', '500 asker eğit', 500, 80000, 30, 1500),
('weekly_dark_jobs', 'Karanlık Patron', '10 karanlık iş tamamla', 10, 60000, 20, 1000),
('weekly_pvp_wins', 'Sokak Savaşçısı', '5 PvP zaferi kazan', 5, 120000, 75, 3000),
('weekly_family_donation', 'Sadık Üye', '3 aile bağışı yap', 3, 50000, 15, 800),
('weekly_research', 'Araştırmacı', '1 araştırma tamamla', 1, 70000, 40, 1200)
ON CONFLICT (quest_type) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, target_value = EXCLUDED.target_value, reward_cash = EXCLUDED.reward_cash, reward_diamonds = EXCLUDED.reward_diamonds, reward_xp = EXCLUDED.reward_xp;

-- Battle Pass Season 1
WITH ins AS (
  INSERT INTO battle_pass_seasons (season_number, name, starts_at, ends_at, is_active, premium_cost_diamonds)
  VALUES (1, 'Sezon 1: Karanlığın Yükselişi', now(), now() + interval '90 days', true, 1000)
  ON CONFLICT (season_number) DO UPDATE SET name = EXCLUDED.name, ends_at = EXCLUDED.ends_at, is_active = EXCLUDED.is_active
  RETURNING id
)
INSERT INTO battle_pass_levels (season_id, level_number, xp_required, free_reward_type, free_reward_amount, premium_reward_type, premium_reward_amount)
SELECT
  ins.id,
  lvl,
  200,
  CASE
    WHEN lvl % 10 = 0 THEN 'diamonds'
    WHEN lvl % 5 = 0 THEN 'xp'
    ELSE 'cash'
  END,
  CASE
    WHEN lvl % 10 = 0 THEN 10
    WHEN lvl % 5 = 0 THEN 500
    ELSE 5000 * ((lvl / 10) + 1)
  END,
  CASE
    WHEN lvl % 10 = 0 THEN 'diamonds'
    WHEN lvl % 5 = 0 THEN 'xp'
    ELSE 'cash'
  END,
  CASE
    WHEN lvl % 10 = 0 THEN 25
    WHEN lvl % 5 = 0 THEN 1500
    ELSE 15000 * ((lvl / 10) + 1)
  END
FROM ins, generate_series(1, 50) AS lvl
ON CONFLICT (season_id, level_number) DO NOTHING;

-- Event definitions
INSERT INTO event_definitions (event_type, name, description, icon, is_active, starts_at, ends_at, metadata) VALUES
('power_race', 'Güç Yarışı', 'Güç puan toplayarak sıralamalarda yüksel ve ödüller kazan.', '⚡', true, now(), now() + interval '7 days', '{"min_rank_reward": 1, "max_rank_reward": 100}'),
('black_market_week', 'Kara Pazar Haftası', 'Özel indirimler ve ekstra ödüller ile alışveriş yap.', '🏪', true, now(), now() + interval '7 days', '{"discount_pct": 20}'),
('family_war', 'Aile Savaşı', 'Ailenle birlikte savaş ve rakip aileleri yen.', '🛡️', false, now() + interval '7 days', now() + interval '14 days', '{"min_family_size": 5}'),
('city_center_war', 'Şehir Merkezi Savaşı', 'Şehrin kontrolü için diğer ailelerle savaş.', '🏙️', false, now() + interval '14 days', now() + interval '21 days', '{}'),
('chest_event', 'Sandık Etkinliği', 'Özel etkinlik sandıkları için extra ödüller.', '📦', false, now() + interval '3 days', now() + interval '10 days', '{"bonus_multiplier": 2}'),
('enforcer_collect', 'Uygulayıcı Toplama', 'Nadir uygulayıcı parçaları topla.', '👤', false, now() + interval '10 days', now() + interval '17 days', '{}'),
('resource_rush', 'Kaynak Akını', 'Kaynak üretimi x2 ve görevlerden ek ödüller.', '💰', false, now() + interval '5 days', now() + interval '12 days', '{"production_multiplier": 2}')
ON CONFLICT (event_type) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, is_active = EXCLUDED.is_active, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, metadata = EXCLUDED.metadata;
