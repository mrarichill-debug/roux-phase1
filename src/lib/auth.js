import { supabase } from './supabase'

/**
 * Loads the app-level user row for the currently authenticated session.
 * Also fetches timezone from the household (stored on households.timezone).
 * Returns null if no row exists yet.
 *
 * Note: the households and users rows are created automatically by the
 * handle_new_user Postgres trigger on auth.users INSERT. No client-side
 * record creation is needed.
 */
export async function loadAppUser(authUserId) {
  // No households join — inner join causes the entire query to return null if
  // the households RLS policy blocks the row. Fetch user row alone; timezone
  // is defaulted here and synced separately in App.jsx.
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, household_id, avatar_url, membership_status, households(subscription_tier)')
    .eq('auth_id', authUserId)
    .maybeSingle()

  console.log('[Roux] loadAppUser query:', { authUserId, data: data ? { id: data.id, membership_status: data.membership_status, household_id: data.household_id } : null, error: error?.message })

  if (error) throw new Error(`Failed to load user: ${error.message}`)
  if (!data)  return null

  return {
    ...data,
    subscription_tier: data.households?.subscription_tier || 'free',
    households: undefined,
    timezone: 'America/Chicago',
  }
}
