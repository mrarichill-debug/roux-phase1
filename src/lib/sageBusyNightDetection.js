/**
 * sageBusyNightDetection.js — Scans calendar events for busy nights.
 * Inserts Sage nudges for days that look packed.
 * Fire-and-forget. Deduplicates by date to prevent repeat nudges.
 */
import { supabase } from './supabase'
import { toLocalDateStr } from './dateUtils'

const DOW_NAMES = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' }
const DOW_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function getHour(isoStr) {
  if (!isoStr || !isoStr.includes('T')) return null
  const d = new Date(isoStr)
  return d.getHours() + d.getMinutes() / 60
}

function isBusyNight(dayEvents) {
  const timed = dayEvents.filter(e => !e.allDay && e.start?.includes('T'))
  if (timed.length >= 2) return true
  // Single long afternoon/evening event
  if (timed.length === 1) {
    const startH = getHour(timed[0].start)
    const endH = getHour(timed[0].end)
    if (startH !== null && endH !== null && startH >= 15 && endH >= 19) return true
  }
  return false
}

export async function sageBusyNightDetection({ calendarEvents, meals, weekDates, appUser }) {
  if (!calendarEvents?.length || !weekDates?.length || !appUser?.household_id) return

  const firstName = appUser.name?.split(' ')[0] || 'there'

  // Group events by date
  const eventsByDate = {}
  for (const ev of calendarEvents) {
    const dateStr = (ev.start || '').substring(0, 10)
    if (!dateStr) continue
    if (!eventsByDate[dateStr]) eventsByDate[dateStr] = []
    eventsByDate[dateStr].push(ev)
  }

  // Group meals by day_of_week
  const mealsByDow = {}
  for (const m of (meals || [])) {
    if (!mealsByDow[m.day_of_week]) mealsByDow[m.day_of_week] = []
    mealsByDow[m.day_of_week].push(m)
  }

  // Check existing nudges this week to deduplicate
  const weekStartStr = toLocalDateStr(weekDates[0])
  const { data: existingNudges } = await supabase.from('sage_background_activity')
    .select('metadata')
    .eq('household_id', appUser.household_id)
    .eq('activity_type', 'calendar_context')
    .gte('created_at', weekStartStr + 'T00:00:00')
  const existingDates = new Set(
    (existingNudges || []).map(n => n.metadata?.date).filter(Boolean)
  )

  for (let i = 0; i < weekDates.length; i++) {
    const date = weekDates[i]
    const dateStr = toLocalDateStr(date)
    const dowKey = DOW_KEYS[i]
    const dayName = DOW_NAMES[dowKey]
    const dayEvents = eventsByDate[dateStr] || []

    if (!isBusyNight(dayEvents)) continue
    if (existingDates.has(dateStr)) continue // already nudged for this date

    const dayMeals = mealsByDow[dowKey] || []
    const hasMeal = dayMeals.length > 0

    if (hasMeal) {
      const mealName = dayMeals[0].custom_name || dayMeals[0].recipes?.name || 'your plan'
      await supabase.from('sage_background_activity').insert({
        household_id: appUser.household_id,
        user_id: appUser.id,
        activity_type: 'calendar_context',
        message: `${dayName} has ${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}. ${mealName} is already on the plan — good timing.`,
        seen: false,
        metadata: { date: dateStr, day_of_week: dowKey, has_meal: true },
      })
    } else {
      await supabase.from('sage_background_activity').insert({
        household_id: appUser.household_id,
        user_id: appUser.id,
        activity_type: 'calendar_context',
        message: `${dayName} has ${dayEvents.length} calendar event${dayEvents.length !== 1 ? 's' : ''} and nothing planned for dinner yet.`,
        seen: false,
        metadata: { date: dateStr, day_of_week: dowKey, has_meal: false, action_url: '/plan' },
      })
    }
  }
}
