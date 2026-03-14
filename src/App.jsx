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
import WeekSettings from './pages/WeekSettings'
import { Shell } from './components/AppShell'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [appUser, setAppUser] = useState(null)

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION immediately in Supabase v2 —
    // no separate getSession() needed. Using both causes a race condition where
    // fetchAppUser runs twice concurrently and can overwrite state with null.
    //
    // IMPORTANT: Do not call setSession() before fetchAppUser completes.
    // Setting session immediately while appUser is still null causes a flash
    // (the !appUser branch renders a loading div). Keep session at its previous
    // value until the user record loads, then set both atomically so the UI
    // transitions directly from loading/welcome to the authenticated app.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (sess) {
        fetchAppUser(sess.user.id, sess)
      } else {
        setSession(null)
        setAppUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchAppUser(authUserId, sess) {
    try {
      const user = await loadAppUser(authUserId)
      if (!user) {
        // No user record found — RLS may be blocking or trigger didn't fire.
        // Sign out so the app routes to the welcome flow instead of hanging on splash.
        console.error('[Roux] No user record found for auth ID:', authUserId, '— signing out')
        await supabase.auth.signOut()
        return
      }
      // Set both atomically — prevents splash flash between session and appUser
      setAppUser(user)
      setSession(sess)
      // Sync browser timezone to household record (fire-and-forget)
      if (user.household_id) {
        const browserTz = getBrowserTimezone()
        if (browserTz && browserTz !== user.timezone) {
          supabase
            .from('households')
            .update({ timezone: browserTz })
            .eq('id', user.household_id)
            .then(({ error }) => {
              if (error) console.warn('[Roux] Could not sync timezone:', error.message)
            })
        }
      }
    } catch (err) {
      console.error('[Roux] Failed to load app user:', err)
      // Sign out on error — recover to welcome flow rather than infinite splash
      await supabase.auth.signOut()
    }
  }

  // Still determining auth state — plain cream background, no logo or text
  if (session === undefined) return <div style={{ minHeight: '100vh', background: '#FAF7F2' }} />

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
        <div style={{ minHeight: '100vh', background: '#FAF7F2' }} />
      ) : (
        // ── Authenticated app ─────────────────────────────────────────────
        <Routes>
          <Route path="/"            element={<Dashboard     appUser={appUser} />} />
          <Route path="/thisweek"   element={<ThisWeek      appUser={appUser} />} />
          <Route path="/recipes"    element={<RecipeLibrary appUser={appUser} />} />
          <Route path="/recipe/:id" element={<RecipeCard    appUser={appUser} />} />
          <Route path="/save-recipe" element={<SaveRecipe    appUser={appUser} />} />
          <Route path="/shopping"      element={<ShoppingList  appUser={appUser} />} />
          <Route path="/week-settings" element={<WeekSettings  appUser={appUser} />} />
          <Route path="/*"             element={<Shell          appUser={appUser} />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
