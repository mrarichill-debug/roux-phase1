/**
 * POST /api/join-notification
 * Creates a notification for the household admin when a new user joins.
 * Uses service role key to bypass RLS — the joining user can't read/write
 * cross-household records.
 *
 * Body: { householdId, userName, newUserId }
 * Returns: { ok: true } or { error: string }
 */

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { householdId, userName, newUserId } = req.body || {}
  console.log('[join-notification] Received:', JSON.stringify({ householdId, userName, newUserId }))

  if (!householdId || !userName || !newUserId) {
    console.error('[join-notification] Missing params')
    return res.status(400).json({ error: 'householdId, userName, and newUserId required' })
  }

  const supabaseUrl    = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log('[join-notification] Env check: url=' + !!supabaseUrl + ' key=' + !!serviceRoleKey)

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[join-notification] Missing Supabase env vars')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Find the household admin — try 'admin' first, fall back to 'co_admin'
  let { data: admin, error: adminErr } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('household_id', householdId)
    .in('role', ['admin', 'co_admin'])
    .order('role')
    .limit(1)
    .maybeSingle()

  console.log('[join-notification] Admin lookup result:', JSON.stringify({ admin, error: adminErr?.message }))

  if (adminErr || !admin) {
    // Last resort: list all users in household for debugging
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, name, role, household_id')
      .eq('household_id', householdId)
    console.error('[join-notification] No admin found. All users in household:', JSON.stringify(allUsers))
    return res.status(404).json({ error: 'No admin found for household', householdId })
  }

  // Get household name for the notification
  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .single()

  const homeName = household?.name || 'your home'

  // Create the notification
  const { error: notifErr } = await supabase.from('notifications').insert({
    household_id: householdId,
    user_id: admin.id,
    type: 'membership_request',
    title: `${userName} wants to join ${homeName}`,
    body: 'Approve or decline their request.',
    action_type: 'membership_approval',
    target_id: newUserId,
  })

  if (notifErr) {
    console.error('[join-notification] Insert failed:', notifErr.message, notifErr.details, notifErr.hint)
    return res.status(500).json({ error: 'Failed to create notification', details: notifErr.message })
  }

  console.log('[join-notification] SUCCESS: Notification created for', admin.name, '(', admin.id, ') about user', newUserId)
  return res.status(200).json({ ok: true })
}
