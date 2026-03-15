import { useEffect, useState, useCallback } from 'react'
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
import Profile from './pages/Profile'
import ProfileSheet from './components/ProfileSheet'
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
        <AuthenticatedApp appUser={appUser} />
      )}
    </BrowserRouter>
  )
}

// ── Authenticated shell — global avatar + ProfileSheet ──────────────────────
function AuthenticatedApp({ appUser }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [approvalRoles, setApprovalRoles] = useState({}) // notifId → selected role
  const firstName = appUser?.name?.split(' ')[0] ?? ''

  // Load unread notifications on mount
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
  }, [appUser?.id])

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function handleNotifAction(notifId, action, targetId, role) {
    if (action === 'approve_member') {
      // Approve: set membership_status to active and assign role
      await supabase.from('users').update({
        membership_status: 'active',
        role: role || 'member_admin',
      }).eq('id', targetId)
      await supabase.from('notifications').update({ is_acted_on: true, acted_on_at: new Date().toISOString() }).eq('id', notifId)
      setNotifications(prev => prev.filter(n => n.id !== notifId))
    } else if (action === 'decline_member') {
      await supabase.from('users').update({ membership_status: 'declined' }).eq('id', targetId)
      await supabase.from('notifications').update({ is_acted_on: true, acted_on_at: new Date().toISOString() }).eq('id', notifId)
      setNotifications(prev => prev.filter(n => n.id !== notifId))
    }
  }

  return (
    <>
      <Routes>
        <Route path="/"              element={<Dashboard     appUser={appUser} />} />
        <Route path="/thisweek"     element={<ThisWeek      appUser={appUser} />} />
        <Route path="/recipes"      element={<RecipeLibrary appUser={appUser} />} />
        <Route path="/recipe/:id"   element={<RecipeCard    appUser={appUser} />} />
        <Route path="/save-recipe"  element={<SaveRecipe    appUser={appUser} />} />
        <Route path="/shopping"      element={<ShoppingList  appUser={appUser} />} />
        <Route path="/week-settings" element={<WeekSettings  appUser={appUser} />} />
        <Route path="/profile"       element={<Profile        appUser={appUser} />} />
        <Route path="/*"             element={<Shell          appUser={appUser} />} />
      </Routes>

      {/* ── Global topbar icons — search, bell, avatar — z-index 150 ──── */}
      <div style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', height: '66px',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '0 14px', gap: '2px',
        zIndex: 150, pointerEvents: 'none',
      }}>
        {/* Search */}
        <button
          onClick={() => {}}
          aria-label="Search"
          style={{
            pointerEvents: 'auto',
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(210,230,200,0.7)',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 19, height: 19 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
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
          {unreadCount > 0 && (
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
      </div>

      {/* ── Global ProfileSheet ──────────────────────────────────────────── */}
      <ProfileSheet
        appUser={appUser}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
      />

      {/* ── Notification Sheet ────────────────────────────────────────────── */}
      {notifOpen && (
        <>
          <div onClick={() => setNotifOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)',
            zIndex: 200, animation: 'fadeIn 0.2s ease',
          }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white',
            borderRadius: '20px 20px 0 0', padding: '0 0 40px', zIndex: 201,
            boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
            animation: 'sheetRise 0.32s cubic-bezier(0.32,0.72,0,1) both',
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
            <div style={{ padding: '20px 22px 0' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: '#2C2417', marginBottom: '14px' }}>
                Notifications
              </div>
              {notifications.length === 0 ? (
                <div style={{ fontSize: '13px', fontStyle: 'italic', color: '#8C7B6B', padding: '20px 0' }}>
                  All caught up — nothing needs your attention.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '8px' }}>
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
                          {/* Role selector */}
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
          </div>
        </>
      )}
    </>
  )
}

// ── Pending Approval Screen ─────────────────────────────────────────────────
function PendingApprovalScreen({ appUser, onApproved }) {
  const firstName = appUser?.name?.split(' ')[0] ?? ''
  const [adminName, setAdminName] = useState(null)

  useEffect(() => {
    // Fetch admin's first name for the message
    if (appUser?.household_id) {
      supabase.from('users').select('name').eq('household_id', appUser.household_id).eq('role', 'admin').maybeSingle()
        .then(({ data }) => { if (data?.name) setAdminName(data.name.split(' ')[0]) })
    }

    // Poll every 10s — check if membership_status changed to active
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('users')
        .select('membership_status')
        .eq('id', appUser.id)
        .single()
      if (data?.membership_status === 'active') {
        clearInterval(interval)
        onApproved()
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [appUser?.id])

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
        fontFamily: "'Playfair Display', serif", fontSize: '36px', fontWeight: 600,
        color: '#2C2417', letterSpacing: '-0.5px', marginBottom: '24px',
      }}>
        Ro<em style={{ fontStyle: 'italic', color: '#3D6B4F' }}>ux</em>
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
        fontFamily: "'Playfair Display', serif", fontSize: '36px', fontWeight: 600,
        color: '#2C2417', marginBottom: '24px',
      }}>
        Ro<em style={{ fontStyle: 'italic', color: '#3D6B4F' }}>ux</em>
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
