/**
 * activityLog.js — Fire-and-forget activity logging.
 * Every meaningful user action writes to activity_log.
 * Never blocks UI. Never shows errors to user.
 */
import { supabase } from './supabase'

export async function logActivity({ user, actionType, targetType, targetId, targetName, metadata = {} }) {
  if (!user?.id || !user?.household_id) return
  try {
    await supabase.from('activity_log').insert({
      household_id: user.household_id,
      user_id: user.id,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      metadata,
    })
  } catch (e) {
    console.warn('[ActivityLog] Failed to write:', e.message)
  }
}
