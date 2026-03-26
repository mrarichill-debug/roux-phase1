/**
 * /api/google-oauth-callback.js — Exchanges Google OAuth code for tokens.
 * Stores refresh_token in users.calendar_credentials via service role key.
 */

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ success: false, error: 'Google OAuth not configured' })
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ success: false, error: 'Server configuration error' })
  }

  try {
    const { code, userId, redirectUri } = req.body

    if (!code || !userId || !redirectUri) {
      return res.status(400).json({ success: false, error: 'code, userId, and redirectUri required' })
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error('[google-oauth-callback] Token exchange failed:', tokenRes.status, errBody)
      return res.status(422).json({ success: false, error: 'Token exchange failed' })
    }

    const tokens = await tokenRes.json()

    if (!tokens.refresh_token && !tokens.access_token) {
      return res.status(422).json({ success: false, error: 'No tokens received' })
    }

    // Fetch user's Google email for display
    let googleEmail = null
    if (tokens.access_token) {
      try {
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` },
        })
        if (profileRes.ok) {
          const profile = await profileRes.json()
          googleEmail = profile.email || null
        }
      } catch {}
    }

    // Store credentials in Supabase via service role
    const credentials = {
      provider: 'google',
      refreshToken: tokens.refresh_token || null,
      accessToken: tokens.access_token || null,
      email: googleEmail,
    }

    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        calendar_provider: 'google',
        calendar_sync_enabled: true,
        calendar_credentials: credentials,
      }),
    })

    if (!updateRes.ok) {
      console.error('[google-oauth-callback] Supabase update failed:', updateRes.status)
      return res.status(500).json({ success: false, error: 'Failed to save credentials' })
    }

    return res.status(200).json({ success: true, email: googleEmail })
  } catch (error) {
    console.error('[google-oauth-callback] Error:', error.message)
    return res.status(500).json({ success: false, error: 'OAuth callback failed' })
  }
}
