-- Allow users to update their own record (needed for join flow to set pending status)
DROP POLICY IF EXISTS "Users can update own record" ON users;
CREATE POLICY "Users can update own record"
  ON users FOR UPDATE
  TO authenticated
  USING (auth_id = auth.uid());

-- Fix Aric's membership status to pending (was set to active by column default)
UPDATE users SET membership_status = 'pending'
WHERE email = 'mrarichill@gmail.com'
AND membership_status = 'active';

-- Create a notification for Lauren to approve Aric
INSERT INTO notifications (user_id, household_id, type, action_type, target_id, title, body, is_read)
SELECT
  admin_user.id,
  admin_user.household_id,
  'membership_request',
  'membership_approval',
  pending_user.id,
  'Aric Hill wants to join your kitchen',
  'Approve or decline their request to join as Co-admin.',
  false
FROM users admin_user, users pending_user
WHERE admin_user.email = 'mrslaurenhill@gmail.com'
AND pending_user.email = 'mrarichill@gmail.com';
