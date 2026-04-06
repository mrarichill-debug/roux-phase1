/**
 * autoClosePastWeeks.js — Silently closes any past meal plan weeks
 * that were never formally reviewed. Runs on every app load.
 * Sets reviewed_at + auto_closed=true so they don't trigger
 * the weekly review nudge on the Dashboard.
 */
import { supabase } from './supabase'

export async function autoClosePastWeeks(householdId) {
  if (!householdId) return

  // Current week start (Monday-based)
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon...
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const currentWeekStart = new Date(now)
  currentWeekStart.setDate(now.getDate() - daysToMonday)
  currentWeekStart.setHours(0, 0, 0, 0)
  const currentWeekStartStr = currentWeekStart.toISOString().split('T')[0]

  // Find all past weeks that were never reviewed
  const { data: pastWeeks } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('household_id', householdId)
    .lt('week_start_date', currentWeekStartStr)
    .is('reviewed_at', null)

  if (!pastWeeks?.length) return

  // Auto-close them all
  const ids = pastWeeks.map(w => w.id)
  await supabase
    .from('meal_plans')
    .update({
      reviewed_at: new Date().toISOString(),
      auto_closed: true,
    })
    .in('id', ids)
}
