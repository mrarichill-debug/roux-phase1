import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
}

// Standard client — uses anon key, subject to RLS. Use for all normal operations.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)


// Helper to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
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
