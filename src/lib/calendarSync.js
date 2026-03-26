/**
 * calendarSync.js — Client-side calendar event fetching.
 * Calls /api/calendar-sync, returns normalized events.
 */
import { toLocalDateStr } from './dateUtils'

export async function fetchCalendarEvents(appUser, weekDates) {
  if (!appUser?.calendar_sync_enabled || !appUser?.id || !weekDates?.length) return []

  try {
    const startDate = toLocalDateStr(weekDates[0])
    const endDate = toLocalDateStr(weekDates[weekDates.length - 1])

    const response = await fetch('/api/calendar-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: appUser.id, startDate, endDate }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.warn('[CalendarSync] API error:', response.status, data)
      return []
    }
    console.log('[CalendarSync] Fetched', (data.events || []).length, 'events')
    return data.events || []
  } catch (err) {
    console.warn('[CalendarSync] Failed:', err.message)
    return []
  }
}

export function getEventsForDate(events, dateStr) {
  if (!events?.length || !dateStr) return []
  return events.filter(e => {
    const eventDate = (e.start || '').substring(0, 10)
    return eventDate === dateStr
  })
}
