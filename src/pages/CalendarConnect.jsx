/**
 * CalendarConnect.jsx — Calendar provider settings screen.
 * Handles Google OAuth callback, calendar selection, and Apple CalDAV (TEST ONLY).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E', linen: '#E8E0D0',
  sage: '#7A8C6E', honey: '#C49A3C', red: '#A03030',
}

const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: '14px', fontFamily: "'Jost', sans-serif", fontWeight: 300,
  border: `1.5px solid ${C.linen}`, borderRadius: '10px', outline: 'none', color: C.ink,
  boxSizing: 'border-box', background: 'white',
}

const sectionHeader = {
  fontSize: '10px', fontWeight: 500, letterSpacing: '2px',
  textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '12px',
}

const cardStyle = {
  background: 'white', border: '1px solid rgba(200,185,160,0.55)',
  borderRadius: '16px', padding: '18px', margin: '0 22px 14px',
}

export default function CalendarConnect({ appUser }) {
  const navigate = useNavigate()
  const [provider, setProvider] = useState(appUser?.calendar_provider || null)
  const [enabled, setEnabled] = useState(appUser?.calendar_sync_enabled || false)
  const [connectedEmail, setConnectedEmail] = useState(null)
  const [toast, setToast] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [debugError, setDebugError] = useState(null)

  // Calendar selection
  const [calendarList, setCalendarList] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loadingCalendars, setLoadingCalendars] = useState(false)
  const [savingSelection, setSavingSelection] = useState(false)

  // Apple fields
  const [appleEmail, setAppleEmail] = useState('')
  const [applePassword, setApplePassword] = useState('')
  const [saving, setSaving] = useState(false)

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code && appUser?.id) {
      handleGoogleCallback(code)
    } else if (appUser?.calendar_provider === 'google' && appUser?.calendar_sync_enabled) {
      loadCalendarList()
    }
  }, [appUser?.id])

  async function loadCalendarList() {
    setLoadingCalendars(true)
    try {
      const response = await fetch('/api/google-calendar-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: appUser.id }),
      })
      const data = await response.json()
      if (data.calendars?.length) {
        setCalendarList(data.calendars)
        // Load saved selection or apply defaults
        const { data: userData } = await supabase.from('users')
          .select('calendar_credentials').eq('id', appUser.id).single()
        const creds = userData?.calendar_credentials
        const saved = typeof creds === 'string' ? JSON.parse(creds) : creds
        if (saved?.selectedCalendarIds?.length) {
          setSelectedIds(new Set(saved.selectedCalendarIds))
        } else {
          // Default: primary + calendars with "family" in name
          const defaults = data.calendars
            .filter(c => c.primary || c.summary.toLowerCase().includes('family'))
            .map(c => c.id)
          setSelectedIds(new Set(defaults))
        }
      }
    } catch (err) {
      console.warn('[CalendarConnect] Load calendar list error:', err.message)
    }
    setLoadingCalendars(false)
  }

  async function handleGoogleCallback(code) {
    setConnecting(true)
    window.history.replaceState({}, '', window.location.pathname)
    try {
      const redirectUri = `${window.location.origin}/settings/calendar`
      const response = await fetch('/api/google-oauth-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userId: appUser.id, redirectUri }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        setDebugError(data.error || 'Connection failed')
        showToast(data.error || 'Connection failed')
        setConnecting(false)
        return
      }
      setProvider('google')
      setEnabled(true)
      setConnectedEmail(data.email || null)
      setDebugError(null)
      showToast('Google Calendar connected')
      setConnecting(false)
      loadCalendarList()
    } catch (err) {
      setDebugError(`Connection error: ${err.message}`)
      showToast('Connection failed')
      setConnecting(false)
    }
  }

  function toggleCalendar(calId) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(calId) ? next.delete(calId) : next.add(calId)
      return next
    })
  }

  async function saveCalendarSelection() {
    setSavingSelection(true)
    // Read current credentials, add selectedCalendarIds
    const { data: userData } = await supabase.from('users')
      .select('calendar_credentials').eq('id', appUser.id).single()
    const creds = typeof userData?.calendar_credentials === 'string'
      ? JSON.parse(userData.calendar_credentials)
      : (userData?.calendar_credentials || {})
    creds.selectedCalendarIds = [...selectedIds]
    await supabase.from('users').update({ calendar_credentials: creds }).eq('id', appUser.id)
    setSavingSelection(false)
    showToast('Calendar selection saved')
  }

  async function saveApple() {
    if (!appleEmail.trim() || !applePassword.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from('users').update({
      calendar_provider: 'apple', calendar_sync_enabled: true,
      calendar_credentials: JSON.stringify({ email: appleEmail.trim(), appPassword: applePassword }),
    }).eq('id', appUser.id)
    setSaving(false)
    if (error) { showToast('Failed to save'); return }
    setProvider('apple')
    setEnabled(true)
    showToast('Apple Calendar connected')
  }

  function connectGoogle() {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) { showToast('Google not configured'); return }
    const redirectUri = `${window.location.origin}/settings/calendar`
    const scope = 'https://www.googleapis.com/auth/calendar.readonly'
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`
    window.location.href = authUrl
  }

  async function disconnect() {
    await supabase.from('users').update({
      calendar_provider: null, calendar_sync_enabled: false, calendar_credentials: null,
    }).eq('id', appUser.id)
    setProvider(null)
    setEnabled(false)
    setConnectedEmail(null)
    setCalendarList([])
    setSelectedIds(new Set())
    showToast('Calendar disconnected')
  }

  return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 8px))',
    }}>
      <TopBar slim
        leftAction={{ onClick: () => navigate('/profile'), icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg> }}
        centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Calendar</span>}
      />

      {connecting && (
        <div style={{ padding: '40px 22px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: `3px solid ${C.linen}`, borderTop: `3px solid ${C.forest}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ marginTop: '12px', fontSize: '14px', color: C.driftwood, fontStyle: 'italic' }}>Connecting to Google Calendar...</div>
          {debugError && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: C.red, lineHeight: 1.5 }}>{debugError}</div>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!connecting && (
        <div style={{ padding: '18px 0' }}>
          {/* Connected status */}
          {enabled && (
            <div style={{ ...cardStyle, borderLeft: `3px solid ${C.sage}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
                </svg>
                <span style={{ fontSize: '14px', color: C.ink, fontWeight: 500 }}>
                  Connected — {provider === 'apple' ? 'Apple Calendar' : 'Google Calendar'}
                </span>
              </div>
              {connectedEmail && (
                <div style={{ fontSize: '12px', color: C.driftwood, marginBottom: '8px' }}>{connectedEmail}</div>
              )}
              <div style={{ fontSize: '12px', color: C.driftwood, marginBottom: '12px' }}>Events show on your weekly menu.</div>
              <button onClick={disconnect} style={{
                padding: '8px 16px', borderRadius: '10px',
                border: `1px solid ${C.linen}`, background: 'none',
                color: C.driftwood, fontSize: '12px', cursor: 'pointer',
                fontFamily: "'Jost', sans-serif",
              }}>Disconnect</button>
            </div>
          )}

          {/* Calendar selection — Google only, when connected */}
          {enabled && provider === 'google' && (
            <div style={cardStyle}>
              <div style={sectionHeader}>Calendars to Show</div>
              {loadingCalendars ? (
                <div style={{ fontSize: '13px', color: C.driftwood, fontStyle: 'italic' }}>Loading calendars...</div>
              ) : calendarList.length === 0 ? (
                <div style={{ fontSize: '13px', color: C.driftwood, fontStyle: 'italic' }}>No calendars found.</div>
              ) : (
                <>
                  {calendarList.map(cal => {
                    const isOn = selectedIds.has(cal.id)
                    return (
                      <div key={cal.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 0', borderBottom: '1px solid rgba(200,185,160,0.2)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: cal.backgroundColor, flexShrink: 0,
                          }} />
                          <div>
                            <div style={{ fontSize: '14px', color: C.ink }}>{cal.summary}</div>
                            {cal.primary && <div style={{ fontSize: '10px', color: C.driftwood }}>Primary</div>}
                          </div>
                        </div>
                        <button onClick={() => toggleCalendar(cal.id)} style={{
                          width: '44px', height: '24px', borderRadius: '12px', padding: 0,
                          border: isOn ? 'none' : `1.5px solid ${C.linen}`,
                          background: isOn ? C.forest : C.cream,
                          cursor: 'pointer', position: 'relative', transition: 'background 0.25s',
                        }}>
                          <span style={{
                            position: 'absolute', top: '2px', left: isOn ? '22px' : '2px',
                            width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'left 0.25s',
                          }} />
                        </button>
                      </div>
                    )
                  })}
                  <button onClick={saveCalendarSelection} disabled={savingSelection} style={{
                    width: '100%', padding: '12px', marginTop: '12px', borderRadius: '12px', border: 'none',
                    background: C.forest, color: 'white', cursor: 'pointer',
                    fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                  }}>{savingSelection ? 'Saving...' : 'Save selection'}</button>
                </>
              )}
            </div>
          )}

          {/* Google connect — when not connected */}
          {!enabled && (
            <div style={cardStyle}>
              <div style={sectionHeader}>Google Calendar</div>
              <div style={{ fontSize: '13px', color: C.driftwood, marginBottom: '12px', lineHeight: 1.5 }}>
                Connect your Google Calendar to see family events alongside your meal plan.
              </div>
              <button onClick={connectGoogle} style={{
                width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                background: C.forest, color: 'white', cursor: 'pointer',
                fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
              }}>Connect Google Calendar</button>
            </div>
          )}

          {/* Apple — TEST ONLY */}
          {import.meta.env.DEV && !enabled && (
            <div style={{ ...cardStyle, position: 'relative' }}>
              <span style={{
                position: 'absolute', top: '10px', right: '14px',
                background: C.honey, color: 'white', fontSize: '8px', fontWeight: 600,
                padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px',
              }}>TEST ONLY</span>
              <div style={sectionHeader}>Apple Calendar</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 500, marginBottom: '4px' }}>iCloud email</div>
                  <input type="email" value={appleEmail} onChange={e => setAppleEmail(e.target.value)} placeholder="you@icloud.com" style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', letterSpacing: '1px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 500, marginBottom: '4px' }}>App-specific password</div>
                  <input type="password" value={applePassword} onChange={e => setApplePassword(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" style={inputStyle} />
                </div>
                <a href="https://appleid.apple.com/account/manage" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: C.sage, textDecoration: 'none' }}>
                  How to generate an app-specific password →
                </a>
                <button onClick={saveApple} disabled={!appleEmail.trim() || !applePassword.trim() || saving} style={{
                  padding: '12px', borderRadius: '12px', border: 'none',
                  background: appleEmail.trim() && applePassword.trim() ? C.forest : C.linen,
                  color: appleEmail.trim() && applePassword.trim() ? 'white' : C.driftwood,
                  cursor: appleEmail.trim() && applePassword.trim() ? 'pointer' : 'default',
                  fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                }}>{saving ? 'Saving...' : 'Connect Apple Calendar'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {debugError && !connecting && (
        <div style={{ margin: '0 22px 14px', padding: '14px 16px', background: 'white', borderRadius: '12px', borderLeft: `3px solid ${C.red}` }}>
          <div style={{ fontSize: '13px', color: C.ink, lineHeight: 1.5 }}>
            Something went wrong connecting your calendar. Try again or check your Google account permissions.
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: C.forest, color: 'white', padding: '10px 22px', borderRadius: '10px',
          fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
          zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>{toast}</div>
      )}

      <BottomNav activeTab="home" />
    </div>
  )
}
