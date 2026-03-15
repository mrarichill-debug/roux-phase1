/**
 * POST /api/invite
 * Server-side invite code lookup.
 * Body: { code: string }
 * Returns: { homeName, invitedBy, householdId } or { error: 'invalid' }
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables.
 * Never exposes the full households row — only home name, admin name, and household ID.
 */

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code } = req.body || {}
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code required' })
  }

  const supabaseUrl      = process.env.VITE_SUPABASE_URL
  const serviceRoleKey   = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[invite] Missing Supabase env vars')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Normalize: strip hyphens, uppercase, reconstruct hyphenated format
  const stripped = code.trim().replace(/-/g, '').toUpperCase()
  const hyphenated = stripped.slice(0, 4) + '-' + stripped.slice(4)
  console.log('[invite] Looking up code:', hyphenated)

  const { data: household, error } = await supabase
    .from('households')
    .select('id, name, founded_by')
    .eq('invite_code', hyphenated)
    .single()

  if (error || !household) {
    return res.status(404).json({ error: 'invalid' })
  }

  // Get the founding admin's name
  let invitedBy = 'the home admin'
  if (household.founded_by) {
    const { data: adminUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', household.founded_by)
      .maybeSingle()
    if (adminUser?.name) invitedBy = adminUser.name
  }

  return res.status(200).json({
    homeName:    household.name,
    householdId: household.id,
    invitedBy,
  })
}
