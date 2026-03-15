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
  if (!householdId || !userName || !newUserId) {
    return res.status(400).json({ error: 'householdId, userName, and newUserId required' })
  }

  const supabaseUrl    = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[join-notification] Missing Supabase env vars')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Find the household admin
  const { data: admin, error: adminErr } = await supabase
    .from('users')
    .select('id')
    .eq('household_id', householdId)
    .eq('role', 'admin')
    .maybeSingle()

  if (adminErr || !admin) {
    console.error('[join-notification] Admin lookup failed:', adminErr?.message || 'no admin found')
    return res.status(404).json({ error: 'No admin found for household' })
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
    console.error('[join-notification] Insert failed:', notifErr.message)
    return res.status(500).json({ error: 'Failed to create notification' })
  }

  console.log('[join-notification] Notification created for admin', admin.id, 'about user', newUserId)
  return res.status(200).json({ ok: true })
}
