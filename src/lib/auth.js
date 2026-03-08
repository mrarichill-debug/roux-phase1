import { supabase } from './supabase'

/**
 * Loads the app-level user row for the currently authenticated session.
 * Returns null if no row exists yet.
 *
 * Note: the households and users rows are created automatically by the
 * handle_new_user Postgres trigger on auth.users INSERT. No client-side
 * record creation is needed.
 */
export async function loadAppUser(authUserId) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, household_id, avatar_url')
    .eq('auth_id', authUserId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load user: ${error.message}`)
  return data
}
