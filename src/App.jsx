import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { loadAppUser } from './lib/auth'
import { getBrowserTimezone } from './lib/dateUtils'

// Welcome screens
import WelcomeScreen1  from './pages/welcome/WelcomeScreen1'
import WelcomeScreen2  from './pages/welcome/WelcomeScreen2'
import WelcomeScreen3a from './pages/welcome/WelcomeScreen3a'
import WelcomeScreen3b from './pages/welcome/WelcomeScreen3b'
import WelcomeScreen4  from './pages/welcome/WelcomeScreen4'

import Dashboard      from './pages/Dashboard'
import ThisWeek       from './pages/ThisWeek'
import RecipeLibrary  from './pages/RecipeLibrary'
import RecipeCard     from './pages/RecipeCard'
import SaveRecipe     from './pages/SaveRecipe'
import ShoppingList from './pages/ShoppingList'
import { Shell } from './components/AppShell'

function SplashScreen() {
  return (
    <div style={{
      background: '#FAF7F2', minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: '42px', fontWeight: 600, color: '#2C2417',
        letterSpacing: '-0.5px',
      }}>
        Ro<em style={{ fontStyle: 'italic', color: '#3D6B4F' }}>ux</em>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [appUser, setAppUser] = useState(null)

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
      // Sync browser timezone to household record (fire-and-forget)
      if (user?.household_id) {
        const browserTz = getBrowserTimezone()
        if (browserTz && browserTz !== user.timezone) {
          supabase
            .from('households')
            .update({ timezone: browserTz })
            .eq('id', user.household_id)
            .then(({ error }) => {
              if (error) console.warn('Could not sync timezone:', error.message)
            })
        }
      }
    } catch (err) {
      console.error('Failed to load app user:', err)
    }
  }

  // Still determining auth state — show splash
  if (session === undefined) return <SplashScreen />

  return (
    <BrowserRouter>
      {!session ? (
        // ── Welcome flow ─────────────────────────────────────────────────
        <Routes>
          <Route path="/"            element={<WelcomeScreen1 />} />
          <Route path="/get-started" element={<WelcomeScreen2 />} />
          <Route path="/create-home" element={<WelcomeScreen3a />} />
          <Route path="/join"        element={<WelcomeScreen3b />} />
          <Route path="/sign-in"     element={<WelcomeScreen4 />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>
      ) : !appUser ? (
        // ── Session loaded, waiting on user record ────────────────────────
        <SplashScreen />
      ) : (
        // ── Authenticated app ─────────────────────────────────────────────
        <Routes>
          <Route path="/"            element={<Dashboard     appUser={appUser} />} />
          <Route path="/thisweek"   element={<ThisWeek      appUser={appUser} />} />
          <Route path="/recipes"    element={<RecipeLibrary appUser={appUser} />} />
          <Route path="/recipe/:id" element={<RecipeCard    appUser={appUser} />} />
          <Route path="/save-recipe" element={<SaveRecipe    appUser={appUser} />} />
          <Route path="/shopping"   element={<ShoppingList  appUser={appUser} />} />
          <Route path="/*"          element={<Shell          appUser={appUser} />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
