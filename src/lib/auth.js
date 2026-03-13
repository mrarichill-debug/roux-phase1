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
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, household_id, avatar_url, households(timezone)')
    .eq('auth_id', authUserId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load user: ${error.message}`)
  if (!data)  return null

  // Flatten household timezone onto the user object
  return {
    ...data,
    timezone: data.households?.timezone ?? 'America/Chicago',
    households: undefined,
  }
}
