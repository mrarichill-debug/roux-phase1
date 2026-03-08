import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { loadAppUser } from './lib/auth'
import Auth from './pages/Auth'

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

  // Logged in + user record loaded — main app shell goes here
  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <h1 className="font-display text-4xl font-light text-stone-800">Roux</h1>
        <p className="text-stone-600 text-sm">
          Welcome, {appUser.name}
        </p>
        <p className="text-stone-400 text-xs">
          Household ready. Main app shell coming next.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-stone-400 hover:text-stone-600 underline"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
