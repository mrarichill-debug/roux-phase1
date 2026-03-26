/**
 * /api/calendar-sync.js — Calendar sync serverless function.
 * Reads calendar events from Apple CalDAV or Google Calendar.
 * Credentials read server-side from Supabase — never accepted in request body.
 * Apple CalDAV is TEST ONLY — not suitable for production.
 */

import ical from 'node-ical'
import { google } from 'googleapis'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { userId, startDate, endDate } = req.body

    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ error: 'userId, startDate, endDate required' })
    }

    // Fetch user credentials server-side via service role
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const userRes = await fetch(`${url}/rest/v1/users?id=eq.${userId}&select=calendar_provider,calendar_credentials,calendar_sync_enabled`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
    })
    const users = await userRes.json()
    const user = users?.[0]

    if (!user || !user.calendar_sync_enabled || !user.calendar_credentials) {
      return res.status(200).json({ events: [] })
    }

    const creds = typeof user.calendar_credentials === 'string'
      ? JSON.parse(user.calendar_credentials)
      : user.calendar_credentials

    let events = []

    if (user.calendar_provider === 'apple') {
      events = await fetchAppleCalendar(creds, startDate, endDate)
    } else if (user.calendar_provider === 'google') {
      events = await fetchGoogleCalendar(creds, startDate, endDate)
    }

    return res.status(200).json({ events })
  } catch (error) {
    console.error('[calendar-sync] Error:', error.message)
    return res.status(500).json({ error: 'Calendar sync failed', events: [] })
  }
}

/**
 * Apple CalDAV — TEST ONLY
 * Uses basic auth with app-specific password against iCloud CalDAV.
 */
async function fetchAppleCalendar(creds, startDate, endDate) {
  const { email, appPassword } = creds
  if (!email || !appPassword) return []

  try {
    // CalDAV REPORT request for events in date range
    const calUrl = `https://caldav.icloud.com/${encodeURIComponent(email)}/calendars/`
    const auth = Buffer.from(`${email}:${appPassword}`).toString('base64')

    // First, discover calendars via PROPFIND
    const propfindRes = await fetch(calUrl, {
      method: 'PROPFIND',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/xml',
        'Depth': '1',
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
        <d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:caldav">
          <d:prop><d:displayname/><d:resourcetype/></d:prop>
        </d:propfind>`,
    })

    if (!propfindRes.ok) {
      console.error('[calendar-sync] Apple PROPFIND failed:', propfindRes.status)
      return []
    }

    // For now, try to fetch the default calendar's events
    const reportBody = `<?xml version="1.0" encoding="utf-8"?>
      <c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:prop><d:getetag/><c:calendar-data/></d:prop>
        <c:filter>
          <c:comp-filter name="VCALENDAR">
            <c:comp-filter name="VEVENT">
              <c:time-range start="${startDate.replace(/-/g, '')}T000000Z" end="${endDate.replace(/-/g, '')}T235959Z"/>
            </c:comp-filter>
          </c:comp-filter>
        </c:filter>
      </c:calendar-query>`

    const reportRes = await fetch(calUrl, {
      method: 'REPORT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/xml',
        'Depth': '1',
      },
      body: reportBody,
    })

    if (!reportRes.ok) {
      console.error('[calendar-sync] Apple REPORT failed:', reportRes.status)
      return []
    }

    const xml = await reportRes.text()
    // Extract iCal data from XML response and parse
    const icalMatches = xml.match(/BEGIN:VCALENDAR[\s\S]*?END:VCALENDAR/g) || []
    const events = []

    for (const icalStr of icalMatches) {
      const parsed = ical.sync.parseICS(icalStr)
      for (const [, event] of Object.entries(parsed)) {
        if (event.type !== 'VEVENT') continue
        const start = event.start ? event.start.toISOString().split('T')[0] : null
        if (!start) continue
        events.push({
          id: event.uid || `apple-${Date.now()}-${Math.random()}`,
          title: event.summary || 'Untitled',
          start: event.datetype === 'date' ? start : event.start.toISOString(),
          end: event.end ? (event.datetype === 'date' ? event.end.toISOString().split('T')[0] : event.end.toISOString()) : start,
          allDay: event.datetype === 'date',
          calendar: 'iCloud',
        })
      }
    }

    return events
  } catch (err) {
    console.error('[calendar-sync] Apple error:', err.message)
    return []
  }
}

/**
 * Google Calendar — OAuth2 with refresh token.
 */
async function fetchGoogleCalendar(creds, startDate, endDate) {
  const { refreshToken } = creds
  if (!refreshToken) return []

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    )
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: `${startDate}T00:00:00Z`,
      timeMax: `${endDate}T23:59:59Z`,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    })

    return (res.data.items || []).map(event => ({
      id: event.id,
      title: event.summary || 'Untitled',
      start: event.start?.date || event.start?.dateTime || startDate,
      end: event.end?.date || event.end?.dateTime || startDate,
      allDay: !!event.start?.date,
      calendar: 'Google',
    }))
  } catch (err) {
    console.error('[calendar-sync] Google error:', err.message)
    return []
  }
}
