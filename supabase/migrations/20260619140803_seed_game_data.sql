
-- ============================================================
-- Seed Data: Buildings, Missions, Enforcers, Shop, VIP, Territories, Research, Troops
-- ============================================================

-- ─── BUILDINGS (already seeded via constants, but ensure shop_products exist) ───

-- ─── SHOP PRODUCTS (8 packages) ──────────────────────────────────────────────
INSERT INTO shop_products (sku, name, description, price, currency, contents, is_active, is_limited, badge, discount_label)
VALUES
  ('starter_pack',  'Baslangic Paketi',  '1.000 Elmas, 50.000 Nakit, Egitim Hizlandirici',   99,   'TRY', '{"diamonds":1000,"cash":50000}',              true, false, 'Yeni Baslayanlar', '%80 Deger'),
  ('power_pack',    'Guc Paketi',        '7.500 Elmas, 250.000 Nakit, 100.000 Silah Gucu',   499,  'TRY', '{"diamonds":7500,"cash":250000,"weapon_power":100000}', true, false, 'En Cok Satan', '%300 Deger'),
  ('boss_pack',     'Patron Paketi',     '40.000 Elmas, 500.000 Nakit, 3 Gunluk Kalkan',     1999, 'TRY', '{"diamonds":40000,"cash":500000}',             true,  true, 'PATRON',         '%500 Deger'),
  ('monthly_card',  'Aylik Kart',        'Her gun 200 Elmas, Gunluk sandik hakki',            149,  'TRY', '{"diamonds_daily":200,"daily_chest":1}',       true, false, 'Aylik',          'Gunluk 5 TL'),
  ('diamond_small', '500 Elmas',         '500 Elmas paketi',                                   49,  'TRY', '{"diamonds":500}',                             true, false, NULL, NULL),
  ('diamond_medium','2.500 Elmas',       '2.500 Elmas + 500 Bonus',                           199,  'TRY', '{"diamonds":3000}',                            true, false, 'Populer', '+500 Bonus'),
  ('diamond_large', '10.000 Elmas',      '10.000 Elmas + 3.000 Bonus',                        699,  'TRY', '{"diamonds":13000}',                           true, false, 'En Iyi Deger', '+3.000 Bonus'),
  ('vip_3_pack',    'VIP Kilavuzu',      'VIP 3 Paketi: 5.000 VIP puan + 2.500 Elmas',       299,  'TRY', '{"diamonds":2500,"vip_points":5000}',          true, false, 'VIP', NULL)
ON CONFLICT (sku) DO NOTHING;

-- ─── MISSIONS (10 dark jobs + 10 more dark jobs) ─────────────────────────────
INSERT INTO missions (category, name, description, required_level, duration, rewards, risk, police_heat_gain)
VALUES
  -- Original 10 dark jobs
  ('dark_job', 'Mahalle Tahsilati',      'Bolgedeki dukkanlardan harac topla.',                   1, 300,  '{"cash":500,"xp":50}',                     10, 5),
  ('dark_job', 'Gizli Sevkiyat',         'Limandan gizli bir yuklemeyi teslim et.',               3, 600,  '{"cash":1200,"black_money":200,"xp":100}',  25, 10),
  ('dark_job', 'Kara Borsa Anlasmasi',   'Yeralti pazarinda buyuk bir anlasma kapat.',            5, 900,  '{"black_money":800,"influence":150,"xp":150}', 35, 15),
  ('dark_job', 'Rakip Mekan Sabotaji',   'Rakip aile mekanini is goremez hale getir.',            7, 1200, '{"influence":300,"weapon_power":200,"xp":200}', 45, 20),
  ('dark_job', 'Polis Takibinden Kacis', 'Arananlari gizli bir rotayla sehir disina cikar.',      4, 480,  '{"loyalty":400,"intel":150,"xp":120}',       30, 8),
  ('dark_job', 'Bilgi Sizdirma',         'Rakip ailenin planlarini ogrenip sat.',                 6, 720,  '{"intel":500,"cash":2000,"xp":180}',         40, 12),
  ('dark_job', 'Liman Kontrolu',         'Liman bolgesinde hakimiyet kur.',                      10, 1800, '{"cash":5000,"black_money":1500,"influence":500,"xp":350}', 60, 25),
  ('dark_job', 'Depo Baskini',           'Rakip cetanin silah deposuna baskin duz.',              8, 1500, '{"weapon_power":1000,"cash":3000,"xp":250}',  55, 22),
  ('dark_job', 'Casino Kontrolu',        'Kumarhane isletmesini ele gecir.',                     12, 2400, '{"cash":8000,"influence":800,"loyalty":300,"xp":400}', 50, 18),
  ('dark_job', 'Siyasi Baglanti',        'Sehir meclisinde bir mutttefik kazan.',                15, 3600, '{"influence":2000,"intel":1000,"xp":500}',    30, 5),
  -- 10 more dark jobs
  ('dark_job', 'Sahte Evrak',            'Polise sahte kimlik belgesi sat.',                      2, 360,  '{"cash":800,"intel":100,"xp":70}',           20, 8),
  ('dark_job', 'Karaborsadan Silah',     'Yasadisi silah satisi yap.',                            4, 540,  '{"weapon_power":500,"cash":1500,"xp":130}',  35, 14),
  ('dark_job', 'Haraclari Arttir',       'Tum mahalledeki isletmelerden harac topla.',            6, 840,  '{"cash":3000,"influence":200,"xp":170}',      30, 12),
  ('dark_job', 'Casusu Temizle',         'Aileye sizmis polisin isini bitir.',                    9, 1080, '{"loyalty":600,"influence":400,"xp":220}',    50, 20),
  ('dark_job', 'Konteyner Kacakciligi',  'Limandan 3 konteyneri gizlice gecir.',                 11, 1440, '{"black_money":2000,"cash":4000,"xp":300}',   45, 18),
  ('dark_job', 'Uyusturucu Rotasi',      'Sehirler arasi karisik sevkiyati organize et.',        14, 2700, '{"black_money":5000,"cash":6000,"xp":450}',   65, 28),
  ('dark_job', 'Devlet Ihalesi Yolsuzlugu','Kamu ihalesine mudahale et.',                       18, 4800, '{"cash":15000,"influence":3000,"xp":600}',    40, 10),
  ('dark_job', 'Terazi Cevir',           'Mahkemede kendi lehinize karar cikar.',                16, 3000, '{"loyalty":2000,"influence":1500,"xp":520}',  25, 6),
  ('dark_job', 'Gece Operasyonu',        'Rakip ailenin kasasina gece baskini yap.',             13, 2100, '{"cash":10000,"black_money":2000,"xp":380}',  60, 25),
  ('dark_job', 'Sehrin Efendisi',        'Tum bolgelerde hakim ol.',                             20, 7200, '{"influence":5000,"cash":20000,"intel":2000,"xp":1000}', 70, 30),
  -- 5 daily missions
  ('daily', 'Gunluk Tahsilat',    '10.000 Nakit topla.',       1, 0, '{"cash":2000,"xp":30}',        0, 0),
  ('daily', 'Adam Egit',          '10 adam egit.',             1, 0, '{"loyalty":100,"xp":30}',      0, 0),
  ('daily', 'Bina Yukselt',       '1 bina yukselt.',           1, 0, '{"influence":50,"xp":50}',     0, 0),
  ('daily', 'Arastirma Baslat',   '1 arastirma baslat.',       2, 0, '{"intel":50,"xp":40}',         0, 0),
  ('daily', 'Baskin Yap',         '3 baskin yap.',             3, 0, '{"weapon_power":200,"xp":60}', 0, 0)
ON CONFLICT DO NOTHING;

-- ─── ENFORCERS (8 base + additional) ─────────────────────────────────────────
INSERT INTO enforcers (key, name, class, rarity, description, active_skill, passive_skill, attack_bonus, defense_bonus, economy_bonus, crime_success_bonus)
VALUES
  ('shadow_blade',  'Golge Bicak',     'hitman',             'epic',      'Sessiz ve olumcul. Baskinlarda ekstra hasar verir.',       'Olumcul Vurusu',       'Golge Adimi',       25,  5,  0, 15),
  ('iron_fist',     'Demir Yumruk',    'bodyguard',          'rare',      'Kale gibi savunma. Karargahi korur.',                      'Celik Kalkan',         'Yilmaz Savunucu',    5, 30,  0,  0),
  ('golden_count',  'Altin Kont',      'accountant',         'legendary', 'Para buldugu yerde para vardir.',                          'Altin Yagmuru',        'Vergi Kacakcisi',    0,  0, 40, 10),
  ('ghost_runner',  'Hayalet Kurye',   'smuggler',           'rare',      'Hicbir sevkiyat iz birakmaz.',                             'Gorunmez Yuk',         'Hizli Teslimat',    10,  0, 15, 25),
  ('cyber_wolf',    'Siber Kurt',      'hacker',             'epic',      'Dijital dunyada iz surucu.',                               'Sistem Carki',         'Veri Madencisi',     0, 10, 20, 20),
  ('don_carlo',     'Don Carlo',       'mediator',           'legendary', 'Diplomat ve arabulucu. Aile iliskilerinde uzman.',         'Teklif Edilemez',      'Diplomasi Ustasi',   5,  5, 25, 15),
  ('viper',         'Engerek',         'street_leader',      'common',    'Sokaklarin efendisi.',                                     'Sokak Savascisi',      'Bolge Hakimiyeti',  15, 10,  5, 10),
  ('deep_throat',   'Derin Bogaz',     'mole',               'mythic',    'Polisin icindeki goz. En degerli enforcer.',               'Ic Bilgi',             'Risk Sifirla',       0, 15, 10, 35),
  ('the_fixer',     'Dokunuscu',       'strategist',         'uncommon',  'Her sorunu cozar, iz birakmaz.',                           'Hassas Plan',          'Geri Cekilme',      10,  8, 12,  8),
  ('la_princesa',   'La Princesa',     'black_market_expert','rare',      'Kara borsanin kraliçesi.',                                 'Kara Borsa Patlamas',  'Buyuk Indirim',      0,  5, 35, 20),
  ('the_hammer',    'Cekic',           'hitman',             'uncommon',  'Kaba kuvvet ustasi.',                                      'Ezici Darbe',          'Dayaniklilik',      20, 15,  0,  5),
  ('el_fantasma',   'El Fantasma',     'smuggler',           'epic',      'Hicbir sınır onu durduramaz.',                             'Hayalet Gecisi',       'Bolge Atlama',      15,  0, 20, 30)
ON CONFLICT (key) DO NOTHING;

-- ─── TERRITORIES (5 regions) ─────────────────────────────────────────────────
INSERT INTO territories (name, district_type, level, resource_bonus, defense_bonus)
VALUES
  ('Liman',              'harbor',      5, 'black_money',  10),
  ('Sanayi Bolgesi',     'industrial',  3, 'weapon_power', 15),
  ('Gece Kulubu Sokagi', 'nightlife',   4, 'loyalty',       5),
  ('Finans Merkezi',     'finance',     8, 'cash',         20),
  ('Eski Mahalle',       'old_quarter', 1, 'influence',     8)
ON CONFLICT DO NOTHING;

-- ─── RESEARCH DEFINITIONS (5 categories × 5 nodes each = 25) ─────────────────
INSERT INTO research_definitions (category, key, name, description, max_level, base_cost, base_duration, effect_type, effect_value)
VALUES
  -- Economy (5 nodes)
  ('economy', 'eco_cash_flow',       'Para Akisi',        'Saatlik nakit uretimini arttirir.',         5, '{"cash":1000,"intel":50}',    300,  'percent', 5),
  ('economy', 'eco_black_market',    'Kara Borsa Ag',     'Kara para uretimini arttirir.',             5, '{"cash":2000,"intel":100}',   600,  'percent', 8),
  ('economy', 'eco_tax_evasion',     'Vergi Kacakcisi',   'Kaynak harcamalarini azaltir.',             5, '{"cash":3000,"intel":200}',   900,  'percent', 5),
  ('economy', 'eco_influence_trade', 'Etki Ticareti',     'Etki uretimini arttirir.',                  5, '{"cash":4000,"intel":300}',   1200, 'percent', 6),
  ('economy', 'eco_intel_network',   'Istihbarat Agi',    'Intel uretimini arttirir.',                 5, '{"cash":5000,"intel":400}',   1500, 'percent', 10),
  -- Combat (5 nodes)
  ('combat',  'com_street_tactics',  'Sokak Taktikleri',  'Saldiri gucunu arttirir.',                  5, '{"cash":1500,"intel":75}',    400,  'percent', 5),
  ('combat',  'com_weapon_mastery',  'Silah Hakimiyeti',  'Silah gucunu arttirir.',                    5, '{"cash":3000,"intel":150}',   800,  'percent', 8),
  ('combat',  'com_ambush',          'Pusu Kurma',        'Baskin hasarini arttirir.',                 5, '{"cash":5000,"intel":250}',   1200, 'percent', 10),
  ('combat',  'com_guerrilla',       'Gerilla Savasi',    'Kucuk birlik saldiri bonusu.',              5, '{"cash":7000,"intel":350}',   1600, 'percent', 12),
  ('combat',  'com_total_war',       'Tam Savas',         'Tum saldiri degerlerini arttirir.',         5, '{"cash":10000,"intel":500}',  2400, 'percent', 15),
  -- Defense (5 nodes)
  ('defense', 'def_wall_thickness',  'Kalinlastirilmis Duvar','Savunma degerini arttirir.',            5, '{"cash":1500,"intel":75}',    400,  'percent', 5),
  ('defense', 'def_guard_training',  'Koruma Egitimi',    'Muhafizlarin savunma bonusu.',              5, '{"cash":3000,"intel":150}',   800,  'percent', 8),
  ('defense', 'def_alarm_system',    'Alarm Sistemi',     'Baskin erken uyari sistemi.',               5, '{"cash":5000,"intel":250}',   1200, 'flat',    10),
  ('defense', 'def_bunker',          'Bunker',            'Maksimum savunma artisi.',                  5, '{"cash":8000,"intel":400}',   1800, 'percent', 12),
  ('defense', 'def_iron_wall',       'Demir Kale',        'Tum savunmayı iki katina cikar.',          5, '{"cash":12000,"intel":600}',  3000, 'percent', 20),
  -- Intelligence (5 nodes)
  ('intelligence', 'int_spy_network',    'Casus Agi',        'Casusluk basari sansini arttirir.',     5, '{"cash":2000,"intel":100}',   500,  'percent', 8),
  ('intelligence', 'int_counter_intel',  'Karsı Istihbarat', 'Rakip casusluga karsi bonus.',          5, '{"cash":4000,"intel":200}',   1000, 'percent', 10),
  ('intelligence', 'int_deep_cover',     'Derin Gorev',      'Uzun sureli casusluk bonusu.',          5, '{"cash":6000,"intel":300}',   1500, 'percent', 12),
  ('intelligence', 'int_data_mining',    'Veri Madenciligi', 'Intel uretimi buyuk artis.',            5, '{"cash":8000,"intel":400}',   2000, 'percent', 15),
  ('intelligence', 'int_ghost_protocol', 'Hayalet Protokol', 'Gorev tespit edilme riskini dusurur.', 5, '{"cash":10000,"intel":500}',  2500, 'percent', 20),
  -- Family (5 nodes)
  ('family', 'fam_loyalty_pact',    'Sadakat Anlasması', 'Aile sadakatini arttirir.',                5, '{"cash":2000,"intel":100}',   600,  'percent', 8),
  ('family', 'fam_expansion',       'Yayilim',           'Aile bolge limitini arttirir.',            5, '{"cash":5000,"intel":300}',   1200, 'flat',    1),
  ('family', 'fam_brotherhood',     'Kardeslik',         'Aile uye bonuslarini arttirir.',           5, '{"cash":8000,"intel":400}',   1800, 'percent', 10),
  ('family', 'fam_war_council',     'Savas Konseyi',     'Aile savasi koordinasyonu arttirir.',      5, '{"cash":12000,"intel":600}',  2400, 'percent', 12),
  ('family', 'fam_empire',          'Imparatorluk',      'Tum aile bonuslarini ikiye katlar.',       5, '{"cash":20000,"intel":1000}', 3600, 'percent', 25)
ON CONFLICT (key) DO NOTHING;

-- ─── VIP DEFINITIONS (15 levels) ─────────────────────────────────────────────
INSERT INTO vip_definitions (vip_level, points_required, daily_diamonds, bonuses, description)
VALUES
  (1,  100,     20,  '[{"type":"construction_speed","value":5},{"type":"mission_slot","value":1}]',                   'Temel VIP ayricaliklari'),
  (2,  300,     30,  '[{"type":"construction_speed","value":10},{"type":"resource_production","value":5}]',           'Guvenilir ortak'),
  (3,  600,     50,  '[{"type":"training_speed","value":10},{"type":"attack_bonus","value":3}]',                      'Kabiliyetli yonetici'),
  (4,  1000,    75,  '[{"type":"construction_speed","value":15},{"type":"defense_bonus","value":5}]',                 'Sokak lideri'),
  (5,  2000,   100,  '[{"type":"resource_production","value":15},{"type":"mission_slot","value":2}]',                 'Guclu ortak'),
  (6,  3500,   150,  '[{"type":"training_speed","value":20},{"type":"attack_bonus","value":6}]',                      'Itibarlı isim'),
  (7,  5500,   200,  '[{"type":"construction_speed","value":20},{"type":"extra_chest","value":1}]',                   'Bolgede taninmis'),
  (8,  8000,   250,  '[{"type":"resource_production","value":25},{"type":"defense_bonus","value":10}]',               'Cete patronu'),
  (9,  12000,  300,  '[{"type":"training_speed","value":30},{"type":"attack_bonus","value":10}]',                     'Buyuk abi'),
  (10, 18000,  400,  '[{"type":"construction_speed","value":30},{"type":"mission_slot","value":3}]',                  'On numara'),
  (11, 25000,  500,  '[{"type":"resource_production","value":35},{"type":"extra_chest","value":2}]',                  'Sehir efsanesi'),
  (12, 35000,  600,  '[{"type":"training_speed","value":40},{"type":"defense_bonus","value":15}]',                    'Mafya babasi'),
  (13, 50000,  800,  '[{"type":"construction_speed","value":40},{"type":"attack_bonus","value":15}]',                 'Efsanevi patron'),
  (14, 70000, 1000,  '[{"type":"resource_production","value":50},{"type":"mission_slot","value":5}]',                 'Golgeden yoneten'),
  (15, 100000,1500,  '[{"type":"construction_speed","value":50},{"type":"training_speed","value":50},{"type":"resource_production","value":50}]', 'Yeraltı İmparatoru')
ON CONFLICT (vip_level) DO NOTHING;
