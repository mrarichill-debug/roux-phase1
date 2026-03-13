/**
 * dateUtils.js — Timezone-aware date utilities for Roux.
 *
 * All functions that need a timezone accept a `tz` parameter (IANA string,
 * e.g. 'America/Chicago'). Pass `appUser.timezone` everywhere.
 *
 * NEVER use `new Date().toISOString().split('T')[0]` — that returns a UTC date
 * which is wrong for users in the evening hours of UTC-offset timezones.
 */

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Format a Date to YYYY-MM-DD using the device's LOCAL date components.
 * Use this when building dates from local Date arithmetic (getDate, setDate, etc.)
 * and you want the result to stay in local time.
 */
export function toLocalDateStr(d) {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

/**
 * Get formatted date parts for `now` in a specific IANA timezone.
 * Returns { year, month, day, hour } as integers.
 */
function nowPartsInTZ(tz) {
  const now  = new Date()
  const fmtD = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const fmtH = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric', hour12: false,
  })
  const dp = Object.fromEntries(fmtD.formatToParts(now).map(p => [p.type, p.value]))
  return {
    year:  parseInt(dp.year),
    month: parseInt(dp.month),
    day:   parseInt(dp.day),
    hour:  parseInt(fmtH.format(now)),
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Detect the browser's IANA timezone string. */
export function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Today's date as YYYY-MM-DD in the user's timezone.
 * This is the correct replacement for `new Date().toISOString().split('T')[0]`
 * when the intent is "what day is it for the user right now".
 */
export function getTodayStr(tz) {
  const { year, month, day } = nowPartsInTZ(tz)
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

/**
 * Current hour (0-23) in the user's timezone.
 * Use for time-of-day greetings (morning/afternoon/evening).
 */
export function getHourTZ(tz) {
  return nowPartsInTZ(tz).hour
}

/**
 * Day of week (0=Sun … 6=Sat) in the user's timezone.
 * This is the correct replacement for `new Date().getDay()` when used for
 * week-boundary calculations.
 */
export function getDayOfWeekTZ(tz) {
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short',
  }).format(new Date())
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[s]
}

/**
 * Monday of the current week as YYYY-MM-DD in the user's timezone.
 * `offsetWeeks`: 0 = this week, 1 = next week, -1 = last week.
 */
export function getWeekStartTZ(tz, offsetWeeks = 0) {
  const { year, month, day } = nowPartsInTZ(tz)
  const jsDay = getDayOfWeekTZ(tz)
  const diff  = jsDay === 0 ? -6 : 1 - jsDay   // days back to Monday
  // Build Monday using local arithmetic — no timezone conversion issues
  const mon = new Date(year, month - 1, day + diff + offsetWeeks * 7)
  return toLocalDateStr(mon)
}

/**
 * Array of 7 Date objects (Mon–Sun) for the week offset by `offsetWeeks`
 * from the current week in the user's timezone.
 * The returned Date objects use the local (browser) calendar, which is correct
 * as long as the browser TZ matches the stored TZ (both should be 'America/Chicago').
 */
export function getWeekDatesTZ(tz, offsetWeeks = 0) {
  const ws   = getWeekStartTZ(tz, 0)                   // base: this week's Monday
  const [y, m, d] = ws.split('-').map(Number)
  const mon  = new Date(y, m - 1, d + offsetWeeks * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(mon)
    dt.setDate(mon.getDate() + i)
    return dt
  })
}

/**
 * Time-of-day greeting string based on user's timezone.
 */
export function timeGreetingTZ(tz) {
  const h = getHourTZ(tz)
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
