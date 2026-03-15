import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

// Standard client — uses anon key, subject to RLS. Use for all normal operations.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Anon-only client — no auth session, no stored tokens. Use for unauthenticated
// lookups (invite code verification) where the query must run as the anon role.
export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})


// Helper to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

// Helper to get user's household
export const getUserHousehold = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('household_id, households(*)')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

// Helper to check if user has completed tutorial
export const hasTutorialCompleted = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select('tutorial_completed')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data?.tutorial_completed ?? false
}

// Helper to mark tutorial as complete
export const completeTutorial = async (userId) => {
  const { error } = await supabase
    .from('users')
    .update({ tutorial_completed: true })
    .eq('id', userId)

  if (error) throw error
}

// Save Sage onboarding preferences to user profile.
// Stored in the existing `preferences` JSONB column on the users table.
export const saveSagePreferences = async (userId, prefs) => {
  const { error } = await supabase
    .from('users')
    .update({ preferences: prefs })
    .eq('id', userId)

  if (error) throw error
}
