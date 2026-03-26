/**
 * /api/google-calendar-list.js — Fetches the user's Google Calendar list.
 * Uses stored refresh token via service role key. Never exposes credentials.
 */

import { google } from 'googleapis'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return res.status(500).json({ error: 'Server configuration error' })

    const userRes = await fetch(`${url}/rest/v1/users?id=eq.${userId}&select=calendar_credentials`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
    })
    const users = await userRes.json()
    const creds = users?.[0]?.calendar_credentials
    if (!creds) return res.status(200).json({ calendars: [] })

    const parsed = typeof creds === 'string' ? JSON.parse(creds) : creds
    if (!parsed.refreshToken) return res.status(200).json({ calendars: [] })

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    )
    oauth2Client.setCredentials({ refresh_token: parsed.refreshToken })

    try {
      await oauth2Client.refreshAccessToken()
    } catch {
      return res.status(200).json({ calendars: [] })
    }

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const listRes = await calendar.calendarList.list()

    const calendars = (listRes.data.items || []).map(c => ({
      id: c.id,
      summary: c.summary || 'Untitled',
      backgroundColor: c.backgroundColor || '#4285f4',
      primary: !!c.primary,
    }))

    return res.status(200).json({ calendars })
  } catch (error) {
    console.error('[google-calendar-list] Error:', error.message)
    return res.status(500).json({ error: 'Failed to fetch calendars' })
  }
}
