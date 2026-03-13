/**
 * POST /api/join-home
 * Reassigns a newly created user to an existing household.
 * Called immediately after supabase.auth.signUp() in the join-home flow.
 *
 * Body: { householdId: string, role: 'co_admin' | 'member_admin' | 'member_viewer' }
 * Headers: Authorization: Bearer <session_access_token>
 *
 * The handle_new_user trigger creates a new household + user row on every signup.
 * This endpoint corrects that for joining users: updates household_id + role,
 * and removes the orphaned household the trigger created.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.
 */

import { createClient } from '@supabase/supabase-js'

const ROLE_MAP = {
  admin:  'co_admin',
  member: 'member_admin',
  child:  'member_viewer',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Extract bearer token from Authorization header
  const authHeader = req.headers.authorization || ''
  const accessToken = authHeader.replace('Bearer ', '').trim()
  if (!accessToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { householdId, role } = req.body || {}
  if (!householdId || !role) {
    return res.status(400).json({ error: 'householdId and role required' })
  }

  const dbRole = ROLE_MAP[role] || 'member_viewer'

  const supabaseUrl    = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Resolve the user from their access token
  const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken)
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid token' })
  }

  // Get the user's current users row (trigger created it with a new household)
  const { data: userRow, error: rowError } = await supabase
    .from('users')
    .select('id, household_id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (rowError || !userRow) {
    return res.status(404).json({ error: 'User row not found' })
  }

  const orphanedHouseholdId = userRow.household_id

  // Update user to the correct household + role
  const { error: updateError } = await supabase
    .from('users')
    .update({ household_id: householdId, role: dbRole })
    .eq('id', userRow.id)

  if (updateError) {
    return res.status(500).json({ error: 'Failed to update user' })
  }

  // Delete the orphaned household the trigger created (if different from target)
  if (orphanedHouseholdId && orphanedHouseholdId !== householdId) {
    await supabase.from('households').delete().eq('id', orphanedHouseholdId)
  }

  return res.status(200).json({ ok: true })
}
