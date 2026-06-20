-- Block direct client INSERT on players; all creation now goes through get_or_create_player RPC
DROP POLICY IF EXISTS "insert_own_player" ON players;
CREATE POLICY "insert_own_player" ON players FOR INSERT
  TO authenticated WITH CHECK (false);
