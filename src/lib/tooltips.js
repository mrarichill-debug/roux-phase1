/**
 * tooltips.js — Persistent tooltip dismiss system.
 * Uses users.dismissed_tooltips JSONB column with string keys.
 * One flexible column handles unlimited tips forever.
 */
import { supabase } from './supabase'

export function hasSeenTooltip(appUser, key) {
  return appUser?.dismissed_tooltips?.[key] === true
}

export async function dismissTooltip(userId, currentTooltips, key) {
  const updated = { ...(currentTooltips || {}), [key]: true }
  await supabase
    .from('users')
    .update({ dismissed_tooltips: updated })
    .eq('id', userId)
  return updated
}
