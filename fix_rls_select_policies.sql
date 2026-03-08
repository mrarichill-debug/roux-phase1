-- ══════════════════════════════════════════════════════════════════════════════
-- Fix RLS SELECT policies for users and households
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Problem: both policies depend entirely on get_my_household_id(), which
-- queries the users table. If that function returns NULL (e.g. right after
-- signup before the session is fully propagated), household_id = NULL
-- evaluates to NULL — not TRUE — and the row is filtered out.
--
-- Fix for users: add auth_id = auth.uid() as the primary condition.
-- A user can always read their own row directly. The OR clause keeps
-- visibility of other household members for the family management UI.
--
-- Fix for households: add id IN (SELECT household_id FROM users WHERE
-- auth_id = auth.uid()) as a direct fallback that doesn't chain through
-- the helper function.
-- ══════════════════════════════════════════════════════════════════════════════

-- users SELECT
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users
  FOR SELECT USING (
    auth_id = auth.uid()
    OR household_id = get_my_household_id()
  );

-- households SELECT
DROP POLICY IF EXISTS households_select ON households;
CREATE POLICY households_select ON households
  FOR SELECT USING (
    id = get_my_household_id()
    OR id IN (
      SELECT household_id FROM users WHERE auth_id = auth.uid()
    )
  );
