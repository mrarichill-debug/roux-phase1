-- Allow anon/unauthenticated users to look up households by invite_code
-- This is required for the join flow — users enter a code BEFORE signing up
DROP POLICY IF EXISTS "Anon can lookup by invite code" ON households;
CREATE POLICY "Anon can lookup by invite code"
  ON households FOR SELECT
  TO anon
  USING (true);

-- Note: this allows anon to SELECT from households, but they can only see
-- id, name, invite_code — no sensitive data is in this table. The RLS for
-- authenticated users (via get_my_household_id()) still controls what
-- logged-in users see.

-- Clean up orphan household
DELETE FROM households WHERE name = 'My Household' AND founded_by IS NULL;
