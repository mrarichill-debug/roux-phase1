import React, { useEffect, useState, useCallback, useRef, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { loadAppUser } from './lib/auth'
import { getBrowserTimezone } from './lib/dateUtils'
import { autoClosePastWeeks } from './lib/autoClosePastWeeks'

// Welcome screens
import WelcomeScreen1  from './pages/welcome/WelcomeScreen1'
import WelcomeScreen2  from './pages/welcome/WelcomeScreen2'
import WelcomeScreen3a from './pages/welcome/WelcomeScreen3a'
import WelcomeScreen3b from './pages/welcome/WelcomeScreen3b'
import WelcomeScreen4  from './pages/welcome/WelcomeScreen4'

import Dashboard      from './pages/Dashboard'
import ThisWeek       from './pages/ThisWeek'
import Meals          from './pages/Meals'
import RecipeLibrary  from './pages/RecipeLibrary'
import RecipeCard     from './pages/RecipeCard'
import SaveRecipe     from './pages/SaveRecipe'
import ShoppingList from './pages/ShoppingList'
import Pantry from './pages/Pantry'
import PantryList from './pages/PantryList'
import ShoppingTrip from './pages/ShoppingTrip'
import ReceiptScan from './pages/ReceiptScan'
import EatingOutReceipt from './pages/EatingOutReceipt'
import WeekReview from './pages/WeekReview'
// Sage page removed — Sage interactions are structured, not chat-based
import PlanMeal     from './pages/PlanMeal'
import SavedMeals   from './pages/SavedMeals'
// WeekSettings unused — ThisWeekSettings handles /week-settings
import ThisWeekSettings from './pages/ThisWeekSettings'
import HouseholdDefaults from './pages/HouseholdDefaults'
import EditRecipe from './pages/EditRecipe'
import Profile from './pages/Profile'
import SettingsHub from './pages/SettingsHub'
import AdminDashboard from './pages/AdminDashboard'
import EventsPage from './pages/EventsPage'
import Onboarding from './pages/Onboarding'
import CalendarConnect from './pages/CalendarConnect'
// DevReset — only loaded in dev, never bundled in production
const DevReset = import.meta.env.DEV
  ? lazy(() => import('./pages/DevReset'))
  : () => null
import { ArcContext } from './context/ArcContext'
import { getArcStage } from './lib/getArcStage'
import { getArcColor } from './lib/getArcColor'
import ProfileSheet from './components/ProfileSheet'
import BottomSheet from './components/BottomSheet'
import TopBar from './components/TopBar'
import ScrollToTop from './components/ScrollToTop'
import BottomNav from './components/BottomNav'
// AppShell (Shell) removed — Phase 1 leftover, disconnected from routing

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function TraditionsPlaceholder() {
  const navigate = useNavigate()
  return (
    <div style={{ background: '#FAF7F2', minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
      <TopBar
        leftAction={{ onClick: () => navigate(-1), label: 'Back' }}
        centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Traditions</span>}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 22px', color: '#8C7B6B', fontStyle: 'italic' }}>
        Traditions — coming soon
      </div>
      <BottomNav activeTab="meals" />
    </div>
  )
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(true) // true until initial auth check completes
  const [session, setSession] = useState(null)
  const [appUser, setAppUser] = useState(null)
  const [arcStage, setArcStage] = useState(1)
  const isFetchingRef = useRef(false)
  const initialCheckDone = useRef(false)

  useEffect(() => {
    // Check for existing session first — prevents flash of welcome screen
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      console.log('[Roux] getSession:', existingSession ? 'has session' : 'no session')
      if (existingSession) {
        fetchAppUser(existingSession.user.id, existingSession)
      } else {
        // No persisted session — safe to show welcome
        setSession(null)
        setAppUser(null)
        initialCheckDone.current = true
        setAuthLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      console.log('[Roux] onAuthStateChange:', _event, sess ? 'has session' : 'no session')

      if (sess) {
        fetchAppUser(sess.user.id, sess)
      } else if (initialCheckDone.current) {
        // Only clear session after initial check is done (sign-out events)
        setSession(null)
        setAppUser(null)
        setAuthLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchAppUser(authUserId, sess) {
    if (isFetchingRef.current) {
      console.log('[Roux] fetchAppUser SKIPPED — already in progress')
      return
    }
    isFetchingRef.current = true

    try {
      console.time('[Roux] Auth → ready')
      const isPendingJoin = sessionStorage.getItem('pendingJoinFlow') === 'true'
      console.log('[Roux] fetchAppUser called — authUserId:', authUserId, 'isPendingJoin:', isPendingJoin)

      console.time('[Roux] loadAppUser')
      let user = await loadAppUser(authUserId)
      console.timeEnd('[Roux] loadAppUser')
      console.log('[Roux] loadAppUser result:', user ? { id: user.id, membership_status: user.membership_status, household_id: user.household_id } : null)

      // If join flow is in progress, poll until the users record exists AND
      // has membership_status = 'pending' (set by WelcomeScreen3b handleJoin).
      // The trigger creates the record first (membership_status is null), then
      // handleJoin() updates it — we must wait for that update to land.
      if (isPendingJoin) {
        console.log('[Roux] Join flow: waiting for membership_status = pending...')
        let found = false
        for (let i = 0; i < 15; i++) {
          if (user && user.membership_status === 'pending') {
            console.log('[Roux] Join flow: record ready after', i * 500, 'ms — membership_status: pending')
            found = true
            break
          }
          await new Promise(r => setTimeout(r, 500))
          user = await loadAppUser(authUserId)
          console.log('[Roux] Join flow poll', i + 1, ':', user ? { membership_status: user.membership_status, household_id: user.household_id } : 'null')
        }

        // Final check after loop — user might have been approved instantly (active)
        if (!found && user && user.membership_status === 'active') {
          console.log('[Roux] Join flow: user already active, proceeding')
          found = true
        }

        if (!found) {
          // Poll timed out without membership_status being set — do NOT route to AuthenticatedApp
          console.error('[Roux] Join flow: poll timed out, membership_status:', user?.membership_status, '— signing out')
          sessionStorage.removeItem('pendingJoinFlow')
          setAuthLoading(false)
          await supabase.auth.signOut()
          return
        }
      }

      if (!user) {
        // User record not found on first try — retry a few times before giving up.
        // RLS timing or Supabase cache can cause a brief null window after sign-in.
        console.log('[Roux] No user record on first load, retrying...')
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 500))
          user = await loadAppUser(authUserId)
          if (user) {
            console.log('[Roux] User record found on retry', i + 1, ':', { id: user.id, membership_status: user.membership_status })
            break
          }
        }
      }

      if (!user) {
        // In dev mode, auto-create user linked to Hill household to prevent blank screens
        if (import.meta.env.DEV) {
          console.warn('[Roux] DEV: No user record — auto-creating linked to Hill household')
          const HILL_HOUSEHOLD = '53f6a197-544a-48e6-9a46-23d7252399c2'
          await supabase.from('users').upsert({
            auth_id: authUserId,
            household_id: HILL_HOUSEHOLD,
            name: sess.user.email?.split('@')[0] || 'Dev User',
            email: sess.user.email || 'dev@roux.app',
            role: 'admin',
            membership_status: 'active',
            has_planned_first_meal: true,
          }, { onConflict: 'auth_id' })
          user = await loadAppUser(authUserId)
        }

        if (!user) {
          // Still no user record after retries — sign out.
          console.error('[Roux] No user record found for auth ID:', authUserId, 'after retries — signing out')
          sessionStorage.removeItem('pendingJoinFlow')
          setAuthLoading(false)
          await supabase.auth.signOut()
          return
        }
      }

      console.log('[Roux] Routing decision — session:', !!sess, 'membership_status:', user.membership_status)
      console.timeEnd('[Roux] Auth → ready')
      // Set all three atomically — prevents any flash between states
      setAppUser(user)
      setSession(sess)
      if (!initialCheckDone.current) {
        initialCheckDone.current = true
      }
      setAuthLoading(false)

      // Clear the join flow flag AFTER state is set
      if (isPendingJoin) {
        sessionStorage.removeItem('pendingJoinFlow')
        console.log('[Roux] Join flow: flag cleared after routing')
      }

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

        // Auto-close any past weeks that were never reviewed (fire-and-forget)
        autoClosePastWeeks(user.household_id).catch(() => {})

        // Compute arc stage (deferred, never blocks app load)
        Promise.all([
          supabase.from('planned_meals').select('id', { count: 'exact', head: true }).eq('household_id', user.household_id).eq('status', 'planned'),
          supabase.from('shopping_trips').select('id', { count: 'exact', head: true }).eq('household_id', user.household_id).not('receipt_photo_url', 'is', null),
          supabase.from('meal_plans').select('id', { count: 'exact', head: true }).eq('household_id', user.household_id).not('reviewed_at', 'is', null),
          supabase.from('planned_meals').select('id', { count: 'exact', head: true }).eq('household_id', user.household_id).eq('status', 'skipped'),
        ]).then(([meals, receipts, weeks, skips]) => {
          const stage = getArcStage({
            mealsCount: meals.count ?? 0,
            receiptsScanned: receipts.count ?? 0,
            weeksClosedOut: weeks.count ?? 0,
            skipsDetected: skips.count ?? 0,
          })
          setArcStage(stage)
        }).catch(() => {}) // default 1 on failure
      }
    } catch (err) {
      console.error('[Roux] Failed to load app user:', err)
      sessionStorage.removeItem('pendingJoinFlow')
      setAuthLoading(false)
      // Sign out on error — recover to welcome flow rather than infinite splash
      await supabase.auth.signOut()
    } finally {
      isFetchingRef.current = false
    }
  }

  // Auth still loading — branded splash, never show welcome or dashboard
  if (authLoading) return (
    <div style={{
      minHeight: '100vh', background: '#FAF7F2',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontFamily: "'Slabo 27px', serif", fontSize: '27px', fontWeight: 400,
        color: '#3D6B4F',
      }}>Roux.</span>
    </div>
  )

  return (
    <BrowserRouter>
      {!session ? (
        // ── Welcome flow — only shown after auth confirms no session ─────
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
        <div style={{ minHeight: '100vh', background: '#FAF7F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: "'Slabo 27px', serif", fontSize: '27px', fontWeight: 400, color: '#3D6B4F' }}>Roux.</span>
        </div>
      ) : appUser.membership_status === 'pending' ? (
        // ── Pending approval — warm holding screen ────────────────────────
        <PendingApprovalScreen appUser={appUser} onApproved={() => {
          // Re-fetch user to get updated membership_status
          if (session) fetchAppUser(session.user.id, session)
        }} />
      ) : appUser.membership_status === 'declined' ? (
        // ── Declined ─────────────────────────────────────────────────────
        <DeclinedScreen />
      ) : (
        // ── Authenticated app ─────────────────────────────────────────────
        <ArcContext.Provider value={{ stage: arcStage, color: getArcColor(arcStage) }}>
          <AuthenticatedApp appUser={appUser} setAppUser={setAppUser} />
        </ArcContext.Provider>
      )}
    </BrowserRouter>
  )
}

// ── Authenticated shell — global avatar + ProfileSheet ──────────────────────
function AuthenticatedApp({ appUser, setAppUser }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isOnboarding = location.pathname === '/onboarding'
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [sageActivity, setSageActivity] = useState([])
  const [approvalRoles, setApprovalRoles] = useState({}) // notifId → selected role
  const firstName = appUser?.name?.split(' ')[0] ?? ''

  // Load unread notifications + sage activity on mount
  useEffect(() => {
    if (!appUser?.id) return
    supabase.from('notifications')
      .select('id, type, title, body, action_type, target_id, is_read, is_acted_on, created_at')
      .eq('user_id', appUser.id)
      .eq('is_acted_on', false)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (data) setNotifications(data)
        if (error) console.log('[Roux] notifications not available:', error.message)
      })
    if (appUser.household_id) {
      supabase.from('sage_background_activity')
        .select('id, message, activity_type, created_at, seen, metadata')
        .eq('household_id', appUser.household_id)
        .eq('seen', false)
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data }) => { if (data) setSageActivity(data) })
    }
  }, [appUser?.id])

  const unreadCount = notifications.filter(n => !n.is_read).length
  const totalBadge = unreadCount + (sageActivity?.length ?? 0)

  async function handleNotifAction(notifId, action, targetId, role) {
    if (action === 'approve_member') {
      const assignedRole = role || 'member_admin'
      console.log('[Roux] Approving member:', targetId, 'with role:', assignedRole)

      // Update membership_status and role
      const { data: updateData, error: updateErr } = await supabase.from('users').update({
        membership_status: 'active',
        role: assignedRole,
      }).eq('id', targetId).select('id, membership_status, role')
      console.log('[Roux] Approve update result:', updateErr ? 'FAILED: ' + updateErr.message : 'OK', 'rows:', updateData?.length ?? 0, 'data:', updateData)

      // Verify the update actually landed
      if (!updateData || updateData.length === 0) {
        console.error('[Roux] Approve: UPDATE returned 0 rows — RLS may be blocking. Trying via target user read...')
        const { data: check } = await supabase.from('users').select('id, membership_status, role, household_id').eq('id', targetId).maybeSingle()
        console.log('[Roux] Approve verify read:', check)
      }

      const { error: notifErr } = await supabase.from('notifications').update({ is_acted_on: true, acted_on_at: new Date().toISOString() }).eq('id', notifId)
      console.log('[Roux] Notification mark acted:', notifErr ? 'FAILED: ' + notifErr.message : 'OK')
      setNotifications(prev => prev.filter(n => n.id !== notifId))
    } else if (action === 'decline_member') {
      console.log('[Roux] Declining member:', targetId)
      const { data: updateData, error: updateErr } = await supabase.from('users').update({ membership_status: 'declined' }).eq('id', targetId).select('id, membership_status')
      console.log('[Roux] Decline update result:', updateErr ? 'FAILED: ' + updateErr.message : 'OK', 'rows:', updateData?.length ?? 0)
      await supabase.from('notifications').update({ is_acted_on: true, acted_on_at: new Date().toISOString() }).eq('id', notifId)
      setNotifications(prev => prev.filter(n => n.id !== notifId))
    }
  }

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/"              element={appUser.has_planned_first_meal === false ? <Navigate to="/onboarding" replace /> : <Dashboard appUser={appUser} />} />
        {/* Plan */}
        <Route path="/plan"         element={<ThisWeek      appUser={appUser} />} />
        <Route path="/thisweek"     element={<Navigate to="/plan" replace />} />
        <Route path="/week"         element={<Navigate to="/plan" replace />} />
        <Route path="/week-settings" element={<ThisWeekSettings appUser={appUser} />} />
        {/* Meals */}
        <Route path="/meals"         element={<Navigate to="/meals/recipes" replace />} />
        <Route path="/meals/recipes" element={<RecipeLibrary appUser={appUser} />} />
        <Route path="/meals/history" element={<Meals          appUser={appUser} />} />
        <Route path="/meals/plan"    element={<PlanMeal       appUser={appUser} />} />
        <Route path="/meals/plan/:id" element={<PlanMeal       appUser={appUser} />} />
        <Route path="/meals/traditions" element={<TraditionsPlaceholder />} />
        <Route path="/meals/traditions/new" element={<TraditionsPlaceholder />} />
        <Route path="/meals/saved"     element={<SavedMeals   appUser={appUser} />} />
        <Route path="/recipes"      element={<RecipeLibrary appUser={appUser} />} />
        <Route path="/recipe/:id"   element={<RecipeCard    appUser={appUser} />} />
        <Route path="/recipe/:id/edit" element={<EditRecipe  appUser={appUser} />} />
        <Route path="/save-recipe"  element={<SaveRecipe    appUser={appUser} />} />
        {/* Events */}
        <Route path="/events"       element={<EventsPage    appUser={appUser} />} />
        {/* Shop */}
        <Route path="/shop"           element={<PantryList    appUser={appUser} />} />
        <Route path="/pantry"         element={<Navigate to="/shop" replace />} />
        <Route path="/pantry/list"    element={<Navigate to="/shop" replace />} />
        <Route path="/shopping"       element={<Navigate to="/shop" replace />} />
        <Route path="/pantry/trip/:id" element={<ShoppingTrip appUser={appUser} />} />
        <Route path="/pantry/trip/:tripId/receipt" element={<ReceiptScan appUser={appUser} />} />
        <Route path="/pantry/eating-out-receipt/:mealId" element={<EatingOutReceipt appUser={appUser} />} />
        <Route path="/review/:mealPlanId" element={<WeekReview appUser={appUser} />} />
        <Route path="/week/defaults" element={<HouseholdDefaults appUser={appUser} />} />
        <Route path="/profile"       element={<SettingsHub    appUser={appUser} />} />
        <Route path="/profile/edit"  element={<Profile        appUser={appUser} />} />
        <Route path="/settings/household" element={<HouseholdDefaults appUser={appUser} />} />
        <Route path="/onboarding"   element={<Onboarding     appUser={appUser} setAppUser={setAppUser} />} />
        <Route path="/settings/calendar" element={<CalendarConnect appUser={appUser} />} />
        <Route path="/admin" element={<AdminDashboard appUser={appUser} />} />
        {import.meta.env.DEV && <Route path="/dev/reset" element={<Suspense fallback={null}><DevReset appUser={appUser} /></Suspense>} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* ── Global topbar icons — sage, bell, avatar — z-index 150 ──── */}
      {!isOnboarding && <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', height: '66px',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '0 14px', gap: '2px',
        zIndex: 150, pointerEvents: 'none',
      }}>
        {/* Bell */}
        <button
          onClick={() => setNotifOpen(true)}
          aria-label="Notifications"
          style={{
            pointerEvents: 'auto', position: 'relative',
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(210,230,200,0.7)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 19, height: 19 }}>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {totalBadge > 0 && (
            <span style={{
              position: 'absolute', top: '4px', right: '4px',
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#C49A3C', border: '1.5px solid #3D6B4F',
            }} />
          )}
        </button>
        {/* Avatar */}
        <button
          onClick={() => setProfileOpen(true)}
          aria-label="Profile"
          style={{
            pointerEvents: 'auto',
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.18)',
            color: 'rgba(250,247,242,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            border: '1.5px solid rgba(255,255,255,0.25)',
            userSelect: 'none', fontFamily: "'Jost', sans-serif",
          }}
        >
          {firstName.charAt(0).toUpperCase() || '?'}
        </button>
      </div>}

      {/* ── Global ProfileSheet ──────────────────────────────────────────── */}
      <ProfileSheet
        appUser={appUser}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      {/* ── Notification Sheet (includes sage activity + notifications) ── */}
      <BottomSheet isOpen={notifOpen} onClose={() => {
        setNotifOpen(false)
        if (sageActivity?.length > 0) {
          const ids = sageActivity.map(a => a.id)
          supabase.from('sage_background_activity').update({ seen: true }).in('id', ids).then(() => {})
          setSageActivity([])
        }
      }} title="Notifications">
        <div style={{ padding: '0 22px 40px' }}>
          {sageActivity?.length > 0 && (
            <>
              {sageActivity.map(item => (
                <div key={item.id} style={{
                  padding: '12px 0',
                  borderBottom: '0.5px solid #E4DDD2',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span style={{ color: '#3D6B4F', fontSize: 12, marginTop: 2 }}>✦</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: '#2C2417', lineHeight: 1.55, fontFamily: "'Jost', sans-serif", fontWeight: 300 }}>
                      {item.message}
                    </div>
                    <div style={{ fontSize: '10px', color: '#8C7B6B', marginTop: 3 }}>
                      {formatRelativeTime(item.created_at)}
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length > 0 && (
                <div style={{ height: '0.5px', background: '#E4DDD2', margin: '4px 0' }} />
              )}
            </>
          )}
          {notifications.length === 0 && sageActivity?.length === 0 ? (
            <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#8C7B6B', padding: '20px 0' }}>
              All caught up — nothing needs your attention.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '8px', marginTop: sageActivity?.length > 0 ? '10px' : 0 }}>
              {notifications.map(n => (
                <div key={n.id} style={{
                  padding: '14px', borderRadius: '12px',
                  border: '1px solid rgba(200,185,160,0.55)',
                  background: '#FAF7F2',
                }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#2C2417', marginBottom: '4px' }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{ fontSize: '13px', color: '#8C7B6B', fontWeight: 300, lineHeight: 1.5, marginBottom: '10px' }}>
                      {n.body}
                    </div>
                  )}
                  {n.action_type === 'membership_approval' && (
                    <div>
                      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                        {[
                          { key: 'co_admin', label: 'Co-admin' },
                          { key: 'member_admin', label: 'Family member' },
                          { key: 'member_viewer', label: 'View only' },
                        ].map(r => {
                          const sel = (approvalRoles[n.id] || 'member_admin') === r.key
                          return (
                            <button key={r.key} onClick={() => setApprovalRoles(prev => ({ ...prev, [n.id]: r.key }))} style={{
                              flex: 1, padding: '6px 4px', fontSize: '10px', fontWeight: sel ? 500 : 400,
                              fontFamily: "'Jost', sans-serif", borderRadius: '8px', cursor: 'pointer',
                              border: `1px solid ${sel ? '#3D6B4F' : '#E8E0D0'}`,
                              background: sel ? '#3D6B4F' : 'transparent',
                              color: sel ? 'white' : '#2C2417', transition: 'all 0.15s',
                              textAlign: 'center',
                            }}>{r.label}</button>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleNotifAction(n.id, 'approve_member', n.target_id, approvalRoles[n.id] || 'member_admin')} style={{
                          flex: 1, padding: '10px', borderRadius: '10px',
                          background: '#3D6B4F', color: 'white', border: 'none',
                          fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        }}>Approve</button>
                        <button onClick={() => handleNotifAction(n.id, 'decline_member', n.target_id)} style={{
                          flex: 1, padding: '10px', borderRadius: '10px',
                          background: 'none', color: '#8C7B6B', border: '1px solid #E8E0D0',
                          fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                        }}>Decline</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setNotifOpen(false)} style={{
            width: '100%', background: 'none', border: 'none', color: '#8C7B6B',
            fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300,
            padding: '10px', cursor: 'pointer',
          }}>Close</button>
        </div>
      </BottomSheet>
    </>
  )
}

// ── Pending Approval Screen ─────────────────────────────────────────────────
function PendingApprovalScreen({ appUser, onApproved }) {
  const firstName = appUser?.name?.split(' ')[0] ?? ''
  const [adminName, setAdminName] = useState(null)
  const [isApproved, setIsApproved] = useState(false)

  useEffect(() => {
    // Fetch admin's first name for the message
    if (appUser?.household_id) {
      supabase.from('users').select('name').eq('household_id', appUser.household_id).eq('role', 'admin').maybeSingle()
        .then(({ data }) => { if (data?.name) setAdminName(data.name.split(' ')[0]) })
    }

    // Poll every 5s — check if membership_status changed to active
    console.log('[Roux] PendingApprovalScreen: starting poll for user', appUser.id)
    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('membership_status')
        .eq('id', appUser.id)
        .single()
      console.log('[Roux] Pending poll:', { membership_status: data?.membership_status, error: error?.message })
      if (data?.membership_status === 'active') {
        console.log('[Roux] Membership approved! Showing welcome transition.')
        clearInterval(interval)
        setIsApproved(true)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [appUser?.id])

  // Graceful approved transition — show welcome message then reload
  useEffect(() => {
    if (!isApproved) return
    const timer = setTimeout(() => {
      console.log('[Roux] Welcome transition complete, reloading app.')
      window.location.href = '/'
    }, 1500)
    return () => clearTimeout(timer)
  }, [isApproved])

  if (isApproved) {
    return (
      <div style={{
        background: '#FAF7F2', minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 32px', fontFamily: "'Jost', sans-serif", textAlign: 'center',
        opacity: 0, animation: 'fadeIn 0.5s ease forwards',
      }}>
        <div style={{
          fontFamily: "'Slabo 27px', Georgia, serif", fontSize: '36px', fontWeight: 400,
          color: '#3D6B4F', letterSpacing: '-0.5px', marginBottom: '24px',
        }}>
          Roux.
        </div>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'rgba(61,107,79,0.10)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#7A8C6E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
        </div>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500,
          color: '#2C2417', fontStyle: 'italic',
        }}>
          Welcome to the kitchen, {firstName}.
        </div>
      </div>
    )
  }

  const statusMsg = adminName
    ? `${adminName} will review your request. You'll get access as soon as they approve.`
    : 'Your request is being reviewed. You\'ll get access as soon as it\'s approved.'

  return (
    <div style={{
      background: '#FAF7F2', minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 32px', fontFamily: "'Jost', sans-serif", textAlign: 'center',
    }}>
      <div style={{
        fontFamily: "'Slabo 27px', Georgia, serif", fontSize: '36px', fontWeight: 400,
        color: '#2C2417', letterSpacing: '-0.5px', marginBottom: '24px',
      }}>
        Roux.
      </div>
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%',
        background: 'rgba(61,107,79,0.10)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#7A8C6E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>
      </div>
      <div style={{
        fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500,
        color: '#2C2417', marginBottom: '10px',
      }}>
        Request sent, {firstName}.
      </div>
      <div style={{
        fontSize: '15px', color: '#8C7B6B', fontWeight: 300, lineHeight: 1.6, maxWidth: '280px',
      }}>
        {statusMsg}
      </div>
    </div>
  )
}

// ── Declined Screen ─────────────────────────────────────────────────────────
function DeclinedScreen() {
  return (
    <div style={{
      background: '#FAF7F2', minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 32px', fontFamily: "'Jost', sans-serif", textAlign: 'center',
    }}>
      <div style={{
        fontFamily: "'Slabo 27px', Georgia, serif", fontSize: '36px', fontWeight: 400,
        color: '#3D6B4F', marginBottom: '24px',
      }}>
        Roux.
      </div>
      <div style={{
        fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500,
        color: '#2C2417', marginBottom: '10px',
      }}>
        Your request was not approved.
      </div>
      <div style={{ fontSize: '14px', color: '#8C7B6B', fontWeight: 300, lineHeight: 1.6 }}>
        Contact the kitchen admin if you think this was a mistake.
      </div>
    </div>
  )
}
