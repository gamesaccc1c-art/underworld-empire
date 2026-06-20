/*
# Underworld Empire: Karanlik Sehir - Ana Oyun Semasi

## Aciklama
Bu migration, mafya strateji oyununun temel veritabani semasini olusturur.
Oyuncu profilleri, binalar, enforcerlar, gorevler, aileler ve magaza tablolarini icerir.

## Yeni Tablolar
- `players`: Oyuncu profili, kaynaklar, seviye, VIP, polis riski
- `buildings`: Oyuncu binalari ve yukseltme durumlari
- `enforcers`: Enforcer (kahraman) tanimlari
- `user_enforcers`: Oyuncunun sahip oldugu enforcerlar
- `missions`: Gorev tanimlari (karanlik isler, gunluk, haftalik)
- `user_missions`: Oyuncunun aktif/tamamlanmis gorevleri
- `families`: Aile/klan bilgileri
- `family_members`: Aile uyelik bilgileri
- `territories`: Sehir bolgeleri
- `battles`: Savas kayitlari
- `shop_products`: Magaza urunleri
- `purchases`: Satin alma gecmisi

## Guvenlik
- Tum tablolarda RLS aktif
- Her tablo icin SELECT/INSERT/UPDATE/DELETE politikalari
- Oyuncular sadece kendi verilerine erisebilir
- Ortak veriler (enforcers, missions, shop_products, territories) herkes okuyabilir
*/

-- Players tablosu
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  username text NOT NULL DEFAULT 'Oyuncu',
  avatar_url text,
  level integer NOT NULL DEFAULT 1,
  xp integer NOT NULL DEFAULT 0,
  vip_level integer NOT NULL DEFAULT 0,
  vip_points integer NOT NULL DEFAULT 0,
  power integer NOT NULL DEFAULT 10,
  family_id uuid,
  title text NOT NULL DEFAULT 'Sokak Serserisi',
  reputation integer NOT NULL DEFAULT 0,
  diamonds integer NOT NULL DEFAULT 100,
  cash integer NOT NULL DEFAULT 5000,
  influence integer NOT NULL DEFAULT 100,
  loyalty integer NOT NULL DEFAULT 50,
  weapon_power integer NOT NULL DEFAULT 50,
  black_money integer NOT NULL DEFAULT 0,
  intel integer NOT NULL DEFAULT 20,
  police_heat integer NOT NULL DEFAULT 0,
  raid_energy integer NOT NULL DEFAULT 10,
  dark_job_energy integer NOT NULL DEFAULT 5,
  spy_energy integer NOT NULL DEFAULT 3,
  shield_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_player" ON players;
CREATE POLICY "select_own_player" ON players FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_player" ON players;
CREATE POLICY "insert_own_player" ON players FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_player" ON players;
CREATE POLICY "update_own_player" ON players FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_player" ON players;
CREATE POLICY "delete_own_player" ON players FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- Buildings tablosu
CREATE TABLE IF NOT EXISTS buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  building_type text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  upgrade_started_at timestamptz,
  upgrade_ends_at timestamptz,
  is_upgrading boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_buildings" ON buildings;
CREATE POLICY "select_own_buildings" ON buildings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_buildings" ON buildings;
CREATE POLICY "insert_own_buildings" ON buildings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_buildings" ON buildings;
CREATE POLICY "update_own_buildings" ON buildings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_buildings" ON buildings;
CREATE POLICY "delete_own_buildings" ON buildings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Enforcers tablosu (ortak veri, herkes okuyabilir)
CREATE TABLE IF NOT EXISTS enforcers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  class text NOT NULL,
  rarity text NOT NULL DEFAULT 'common',
  description text NOT NULL DEFAULT '',
  active_skill text NOT NULL DEFAULT '',
  passive_skill text NOT NULL DEFAULT '',
  attack_bonus integer NOT NULL DEFAULT 0,
  defense_bonus integer NOT NULL DEFAULT 0,
  economy_bonus integer NOT NULL DEFAULT 0,
  crime_success_bonus integer NOT NULL DEFAULT 0
);

ALTER TABLE enforcers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_enforcers" ON enforcers;
CREATE POLICY "anyone_can_read_enforcers" ON enforcers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "no_insert_enforcers" ON enforcers;
CREATE POLICY "no_insert_enforcers" ON enforcers FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "no_update_enforcers" ON enforcers;
CREATE POLICY "no_update_enforcers" ON enforcers FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "no_delete_enforcers" ON enforcers;
CREATE POLICY "no_delete_enforcers" ON enforcers FOR DELETE
  TO authenticated USING (false);

-- User Enforcers tablosu
CREATE TABLE IF NOT EXISTS user_enforcers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enforcer_id uuid NOT NULL REFERENCES enforcers(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  stars integer NOT NULL DEFAULT 1,
  shards integer NOT NULL DEFAULT 0,
  assigned_role text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_enforcers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user_enforcers" ON user_enforcers;
CREATE POLICY "select_own_user_enforcers" ON user_enforcers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_user_enforcers" ON user_enforcers;
CREATE POLICY "insert_own_user_enforcers" ON user_enforcers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_user_enforcers" ON user_enforcers;
CREATE POLICY "update_own_user_enforcers" ON user_enforcers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_user_enforcers" ON user_enforcers;
CREATE POLICY "delete_own_user_enforcers" ON user_enforcers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Missions tablosu (ortak veri)
CREATE TABLE IF NOT EXISTS missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'dark_job',
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  required_level integer NOT NULL DEFAULT 1,
  duration integer NOT NULL DEFAULT 300,
  rewards jsonb NOT NULL DEFAULT '{}',
  risk integer NOT NULL DEFAULT 0,
  police_heat_gain integer NOT NULL DEFAULT 0
);

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_missions" ON missions;
CREATE POLICY "anyone_can_read_missions" ON missions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "no_insert_missions" ON missions;
CREATE POLICY "no_insert_missions" ON missions FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "no_update_missions" ON missions;
CREATE POLICY "no_update_missions" ON missions FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "no_delete_missions" ON missions;
CREATE POLICY "no_delete_missions" ON missions FOR DELETE
  TO authenticated USING (false);

-- User Missions tablosu
CREATE TABLE IF NOT EXISTS user_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id uuid NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'available',
  assigned_enforcer_id uuid REFERENCES user_enforcers(id),
  started_at timestamptz,
  ends_at timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_user_missions" ON user_missions;
CREATE POLICY "select_own_user_missions" ON user_missions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_user_missions" ON user_missions;
CREATE POLICY "insert_own_user_missions" ON user_missions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_user_missions" ON user_missions;
CREATE POLICY "update_own_user_missions" ON user_missions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_user_missions" ON user_missions;
CREATE POLICY "delete_own_user_missions" ON user_missions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Families tablosu
CREATE TABLE IF NOT EXISTS families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text NOT NULL,
  leader_id uuid NOT NULL REFERENCES auth.users(id),
  level integer NOT NULL DEFAULT 1,
  power integer NOT NULL DEFAULT 0,
  territory_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE families ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_families" ON families;
CREATE POLICY "anyone_can_read_families" ON families FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_families" ON families;
CREATE POLICY "insert_own_families" ON families FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = leader_id);

DROP POLICY IF EXISTS "update_own_families" ON families;
CREATE POLICY "update_own_families" ON families FOR UPDATE
  TO authenticated USING (auth.uid() = leader_id) WITH CHECK (auth.uid() = leader_id);

DROP POLICY IF EXISTS "delete_own_families" ON families;
CREATE POLICY "delete_own_families" ON families FOR DELETE
  TO authenticated USING (auth.uid() = leader_id);

-- Family Members tablosu
CREATE TABLE IF NOT EXISTS family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank integer NOT NULL DEFAULT 1,
  contribution integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(family_id, user_id)
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_family_members" ON family_members;
CREATE POLICY "anyone_can_read_family_members" ON family_members FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_family_members" ON family_members;
CREATE POLICY "insert_own_family_members" ON family_members FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_family_members" ON family_members;
CREATE POLICY "update_own_family_members" ON family_members FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_family_members" ON family_members;
CREATE POLICY "delete_own_family_members" ON family_members FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Territories tablosu (ortak veri)
CREATE TABLE IF NOT EXISTS territories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  district_type text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  owner_family_id uuid REFERENCES families(id),
  resource_bonus text NOT NULL DEFAULT 'cash',
  defense_bonus integer NOT NULL DEFAULT 0
);

ALTER TABLE territories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_territories" ON territories;
CREATE POLICY "anyone_can_read_territories" ON territories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "no_insert_territories" ON territories;
CREATE POLICY "no_insert_territories" ON territories FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "no_update_territories" ON territories;
CREATE POLICY "no_update_territories" ON territories FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "no_delete_territories" ON territories;
CREATE POLICY "no_delete_territories" ON territories FOR DELETE
  TO authenticated USING (false);

-- Battles tablosu
CREATE TABLE IF NOT EXISTS battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id uuid NOT NULL REFERENCES auth.users(id),
  defender_id uuid NOT NULL REFERENCES auth.users(id),
  attacker_family_id uuid REFERENCES families(id),
  defender_family_id uuid REFERENCES families(id),
  battle_type text NOT NULL DEFAULT 'raid',
  attacker_power integer NOT NULL DEFAULT 0,
  defender_power integer NOT NULL DEFAULT 0,
  result text NOT NULL DEFAULT 'pending',
  loot jsonb NOT NULL DEFAULT '{}',
  casualties jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE battles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_battles" ON battles;
CREATE POLICY "select_own_battles" ON battles FOR SELECT
  TO authenticated USING (auth.uid() = attacker_id OR auth.uid() = defender_id);

DROP POLICY IF EXISTS "insert_own_battles" ON battles;
CREATE POLICY "insert_own_battles" ON battles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = attacker_id);

DROP POLICY IF EXISTS "no_update_battles" ON battles;
CREATE POLICY "no_update_battles" ON battles FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "no_delete_battles" ON battles;
CREATE POLICY "no_delete_battles" ON battles FOR DELETE
  TO authenticated USING (false);

-- Shop Products tablosu (ortak veri)
CREATE TABLE IF NOT EXISTS shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  contents jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  is_limited boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  badge text,
  discount_label text
);

ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_read_shop_products" ON shop_products;
CREATE POLICY "anyone_can_read_shop_products" ON shop_products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "no_insert_shop_products" ON shop_products;
CREATE POLICY "no_insert_shop_products" ON shop_products FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "no_update_shop_products" ON shop_products;
CREATE POLICY "no_update_shop_products" ON shop_products FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "no_delete_shop_products" ON shop_products;
CREATE POLICY "no_delete_shop_products" ON shop_products FOR DELETE
  TO authenticated USING (false);

-- Purchases tablosu
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES shop_products(id),
  provider text NOT NULL DEFAULT 'demo',
  status text NOT NULL DEFAULT 'completed',
  amount integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_purchases" ON purchases;
CREATE POLICY "select_own_purchases" ON purchases FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_purchases" ON purchases;
CREATE POLICY "insert_own_purchases" ON purchases FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "no_update_purchases" ON purchases;
CREATE POLICY "no_update_purchases" ON purchases FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "no_delete_purchases" ON purchases;
CREATE POLICY "no_delete_purchases" ON purchases FOR DELETE
  TO authenticated USING (false);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_buildings_user ON buildings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_enforcers_user ON user_enforcers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_missions_user ON user_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_battles_attacker ON battles(attacker_id);
CREATE INDEX IF NOT EXISTS idx_battles_defender ON battles(defender_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
