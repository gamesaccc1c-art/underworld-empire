
-- ═══════════════════════════════════════════════════════════════════════════════
-- FAMILY / CLAN SYSTEM — Full social & competitive features
-- ═══════════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS territory_war_contributions CASCADE;
DROP TABLE IF EXISTS territory_wars CASCADE;
DROP TABLE IF EXISTS family_help_requests CASCADE;
DROP TABLE IF EXISTS family_donations CASCADE;
DROP TABLE IF EXISTS family_tech CASCADE;
DROP TABLE IF EXISTS family_chat CASCADE;
DROP TABLE IF EXISTS family_members CASCADE;

-- ─── Families table enhancement ──────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'families' AND table_schema = 'public') THEN
    CREATE TABLE families (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL UNIQUE,
      tag text NOT NULL UNIQUE,
      leader_id uuid NOT NULL REFERENCES players(id),
      description text DEFAULT '',
      level int DEFAULT 1,
      xp int DEFAULT 0,
      power bigint DEFAULT 0,
      territory_count int DEFAULT 0,
      member_count int DEFAULT 1,
      max_members int DEFAULT 30,
      join_type text DEFAULT 'open' CHECK (join_type IN ('open', 'apply', 'invite_only')),
      min_power int DEFAULT 0,
      announcement text DEFAULT '',
      created_at timestamptz DEFAULT now()
    );
  ELSE
    ALTER TABLE families ADD COLUMN IF NOT EXISTS xp int DEFAULT 0;
    ALTER TABLE families ADD COLUMN IF NOT EXISTS max_members int DEFAULT 30;
    ALTER TABLE families ADD COLUMN IF NOT EXISTS join_type text DEFAULT 'open';
    ALTER TABLE families ADD COLUMN IF NOT EXISTS min_power int DEFAULT 0;
    ALTER TABLE families ADD COLUMN IF NOT EXISTS announcement text DEFAULT '';
  END IF;
END $$;

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_families" ON families;
CREATE POLICY "select_families" ON families FOR SELECT TO authenticated USING (true);

-- ─── Family Members ──────────────────────────────────────────────────────────
CREATE TABLE family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES players(id),
  rank int DEFAULT 1 CHECK (rank BETWEEN 1 AND 5),
  contribution bigint DEFAULT 0,
  daily_donations_today int DEFAULT 0,
  daily_donations_date date DEFAULT CURRENT_DATE,
  daily_helps_today int DEFAULT 0,
  daily_helps_date date DEFAULT CURRENT_DATE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(family_id, user_id)
);
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_family_members" ON family_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_family_members" ON family_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_family_members" ON family_members FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "delete_family_members" ON family_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ─── Family Tech ─────────────────────────────────────────────────────────────
CREATE TABLE family_tech (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  tech_key text NOT NULL,
  level int DEFAULT 0,
  progress int DEFAULT 0,
  required_progress int DEFAULT 1000,
  UNIQUE(family_id, tech_key)
);
ALTER TABLE family_tech ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_family_tech" ON family_tech FOR SELECT TO authenticated USING (true);

-- ─── Family Donations ────────────────────────────────────────────────────────
CREATE TABLE family_donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES players(id),
  resource_type text NOT NULL,
  amount int NOT NULL,
  contribution_gained int NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE family_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_family_donations" ON family_donations FOR SELECT TO authenticated
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "insert_family_donations" ON family_donations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "update_family_donations" ON family_donations FOR UPDATE TO authenticated USING (false);
CREATE POLICY "delete_family_donations" ON family_donations FOR DELETE TO authenticated USING (false);

-- ─── Family Help Requests ────────────────────────────────────────────────────
CREATE TABLE family_help_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES players(id),
  help_type text NOT NULL CHECK (help_type IN ('building', 'research', 'training')),
  target_id text NOT NULL,
  helps_received int DEFAULT 0,
  max_helps int DEFAULT 10,
  time_reduction_per_help int DEFAULT 60,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '8 hours')
);
ALTER TABLE family_help_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_family_help" ON family_help_requests FOR SELECT TO authenticated
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "insert_family_help" ON family_help_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "update_family_help" ON family_help_requests FOR UPDATE TO authenticated
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "delete_family_help" ON family_help_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── Family Chat ─────────────────────────────────────────────────────────────
CREATE TABLE family_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES players(id),
  username text NOT NULL DEFAULT '',
  message text NOT NULL,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'donation', 'war')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE family_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_family_chat" ON family_chat FOR SELECT TO authenticated
  USING (family_id IN (SELECT family_id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "insert_family_chat" ON family_chat FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "update_family_chat" ON family_chat FOR UPDATE TO authenticated USING (false);
CREATE POLICY "delete_family_chat" ON family_chat FOR DELETE TO authenticated USING (false);

-- ─── Territory enhancement ───────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'territories' AND table_schema = 'public') THEN
    CREATE TABLE territories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      district_type text NOT NULL,
      level int DEFAULT 1,
      owner_family_id uuid REFERENCES families(id) ON DELETE SET NULL,
      resource_bonus text NOT NULL,
      defense_bonus int DEFAULT 20,
      control_points int DEFAULT 0,
      shield_until timestamptz DEFAULT NULL,
      daily_income int DEFAULT 500,
      created_at timestamptz DEFAULT now()
    );
  ELSE
    ALTER TABLE territories ADD COLUMN IF NOT EXISTS control_points int DEFAULT 0;
    ALTER TABLE territories ADD COLUMN IF NOT EXISTS shield_until timestamptz DEFAULT NULL;
    ALTER TABLE territories ADD COLUMN IF NOT EXISTS daily_income int DEFAULT 500;
  END IF;
END $$;

ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_territories" ON territories;
CREATE POLICY "select_territories" ON territories FOR SELECT TO authenticated USING (true);

-- ─── Territory Wars ──────────────────────────────────────────────────────────
CREATE TABLE territory_wars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid NOT NULL REFERENCES territories(id),
  attacker_family_id uuid NOT NULL REFERENCES families(id),
  defender_family_id uuid REFERENCES families(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'attacker_won', 'defender_won', 'draw')),
  attacker_points int DEFAULT 0,
  defender_points int DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  ends_at timestamptz DEFAULT (now() + interval '2 hours')
);
ALTER TABLE territory_wars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_territory_wars" ON territory_wars FOR SELECT TO authenticated USING (true);

-- ─── Territory War Contributions ─────────────────────────────────────────────
CREATE TABLE territory_war_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  war_id uuid NOT NULL REFERENCES territory_wars(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES players(id),
  family_id uuid NOT NULL REFERENCES families(id),
  points int DEFAULT 0,
  troops_sent jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE territory_war_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_war_contributions" ON territory_war_contributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_war_contributions" ON territory_war_contributions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "update_war_contributions" ON territory_war_contributions FOR UPDATE TO authenticated USING (false);
CREATE POLICY "delete_war_contributions" ON territory_war_contributions FOR DELETE TO authenticated USING (false);

-- ─── Seed territories ────────────────────────────────────────────────────────
DELETE FROM territories WHERE true;
INSERT INTO territories (name, district_type, level, resource_bonus, defense_bonus, daily_income) VALUES
  ('Dogus Limani', 'harbor', 3, 'black_money', 25, 800),
  ('Sanayi Bolgesi', 'industrial', 4, 'weapon_power', 35, 1000),
  ('Gece Kulupleri Sokagi', 'nightlife', 3, 'loyalty', 20, 700),
  ('Finans Merkezi', 'finance', 5, 'cash', 50, 1500),
  ('Eski Mahalle', 'old_quarter', 2, 'influence', 15, 500),
  ('Yeralti Pazari', 'underground', 6, 'black_money', 60, 2000),
  ('Sehir Merkezi', 'downtown', 7, 'intel', 70, 2500);
