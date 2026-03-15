-- Add membership status to users table for invite approval flow
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_status TEXT NOT NULL DEFAULT 'active'
  CHECK (membership_status IN ('pending', 'active', 'declined'));

-- Add metadata to notifications for action handling
-- (notifications table already exists in schema — just ensure RLS)

-- RLS: pending members can only see their own user record, not household data
-- This is enforced by get_my_household_id() returning null for pending users
-- We add an explicit policy to let pending users read their own row
CREATE POLICY IF NOT EXISTS "Users can read own record"
  ON users FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

-- Notifications RLS
CREATE POLICY IF NOT EXISTS "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY IF NOT EXISTS "Authenticated can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Grant permissions
GRANT ALL ON notifications TO anon, authenticated;
