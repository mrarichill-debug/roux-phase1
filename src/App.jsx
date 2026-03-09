import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { loadAppUser } from './lib/auth'
import Auth from './pages/Auth'
import AppShell from './components/AppShell'

export default function App() {
  const [session, setSession]   = useState(undefined) // undefined = still loading
  const [appUser, setAppUser]   = useState(null)

  // Load session on mount, then subscribe to auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchAppUser(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchAppUser(session.user.id)
      } else {
        setAppUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchAppUser(authUserId) {
    try {
      const user = await loadAppUser(authUserId)
      setAppUser(user)
    } catch (err) {
      console.error('Failed to load app user:', err)
    }
  }

  // Still determining auth state
  if (session === undefined) return null

  // Not logged in
  if (!session) return <Auth onSignupComplete={setAppUser} />

  // Logged in but user record not yet loaded
  if (!appUser) return null

  // Logged in + user record loaded
  return <AppShell appUser={appUser} />
}
