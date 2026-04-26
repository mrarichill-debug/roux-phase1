/**
 * SettingsHub.jsx — Settings hub screen.
 * Clean grouped list with user identity header.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useArc } from '../context/ArcContext'
import { SCHEME_NAMES } from '../lib/colorSchemes'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { color, alpha, elevation } from '../styles/tokens'

const CHEVRON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#C8BFB4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
    <path d="m9 18 6-6-6-6"/>
  </svg>
)

// ── Inline SVG icons — 16×16, stroke #8C7B6B, strokeWidth 1.5 ──────────────
const ICONS = {
  household: (
    <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  ),
  appearance: (
    <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <circle cx="12" cy="12" r="5"/><line x1="12" x2="12" y1="1" y2="3"/><line x1="12" x2="12" y1="21" y2="23"/><line x1="4.22" x2="5.64" y1="4.22" y2="5.64"/><line x1="18.36" x2="19.78" y1="18.36" y2="19.78"/><line x1="1" x2="3" y1="12" y2="12"/><line x1="21" x2="23" y1="12" y2="12"/><line x1="4.22" x2="5.64" y1="19.78" y2="18.36"/><line x1="18.36" x2="19.78" y1="5.64" y2="4.22"/>
    </svg>
  ),
  defaults: (
    <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  subscription: (
    <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  about: (
    <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/>
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>
    </svg>
  ),
}

export default function SettingsHub({ appUser }) {
  const { color: arcColor } = useArc()
  const navigate = useNavigate()

  const [householdName, setHouseholdName] = useState('')
  const [memberCount, setMemberCount] = useState(0)
  const [colorScheme, setColorScheme] = useState('garden')

  useEffect(() => {
    if (appUser?.household_id) loadSettings()
  }, [appUser?.household_id])

  async function loadSettings() {
    if (!appUser?.household_id) return
    const [hhRes, countRes] = await Promise.all([
      supabase.from('households').select('name, color_scheme').eq('id', appUser.household_id).maybeSingle(),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('household_id', appUser.household_id),
    ])
    if (hhRes.data) {
      setHouseholdName(hhRes.data.name || '')
      setColorScheme(hhRes.data.color_scheme || 'garden')
    }
    setMemberCount(countRes.count ?? 0)
  }

  const ADMIN_USER_IDS = [
    '1fb645c3-14a4-4057-afb3-9e803c3cca78', // Aric
    '18c38c61-fb49-4c29-a4c2-e8907a554dac',  // Lauren
  ]
  const isAdmin = ADMIN_USER_IDS.includes(appUser?.id)

  const firstName = appUser?.name?.split(' ')[0] ?? ''
  const initials = (appUser?.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const roleLabel = appUser?.role === 'admin' ? 'Household admin' : appUser?.role === 'co_admin' ? 'Co-admin' : 'Member'
  const tierLabel = appUser?.subscription_tier === 'full' ? 'Full plan' : 'Free plan'
  const calConnected = !!appUser?.calendar_sync_enabled
  const schemeName = SCHEME_NAMES?.[colorScheme] || 'Garden'

  const kitchenRows = [
    { key: 'household', icon: ICONS.household, title: 'Home', sub: `${householdName || 'Home'}${memberCount ? ` · ${memberCount} member${memberCount !== 1 ? 's' : ''}` : ''}`, route: '/settings/household' },
    { key: 'calendar', icon: ICONS.calendar, title: 'Calendar', sub: calConnected ? 'Google · connected' : 'Not connected', route: '/settings/calendar', dot: calConnected },
    { key: 'appearance', icon: ICONS.appearance, title: 'Appearance', sub: schemeName, route: '/settings/appearance' },
    { key: 'defaults', icon: ICONS.defaults, title: 'Home defaults', sub: 'Meal types, day settings', route: '/settings/household' },
  ]

  const accountRows = [
    { key: 'profile', icon: ICONS.profile, title: 'Profile', sub: 'Name, email, avatar', route: '/profile/edit' },
    { key: 'subscription', icon: ICONS.subscription, title: 'Subscription', sub: tierLabel, route: '/settings/subscription' },
    { key: 'about', icon: ICONS.about, title: 'About', sub: 'Version, feedback', route: '/settings/about' },
  ]

  return (
    <div className="page-scroll-container" style={{
      background: color.paper,
      fontFamily: "'Jost', sans-serif",
      fontWeight: 300,
      minHeight: '100vh',
      maxWidth: '430px',
      margin: '0 auto',
      paddingBottom: 'calc(140px + env(safe-area-inset-bottom, 8px))',
      overflowY: 'auto',
    }}>
      <TopBar />

      <div style={{ padding: '24px 18px 0' }}>

        {/* ── User identity ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: color.forest, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Playfair Display', serif",
            fontSize: '17px', fontWeight: 600, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '18px', fontWeight: 500, color: color.ink, lineHeight: 1.3,
            }}>
              {appUser?.name || 'You'}
            </div>
            <div style={{ fontSize: '11px', color: color.inkSoft, marginTop: '2px' }}>
              {roleLabel} · {tierLabel}
            </div>
          </div>
          <button
            onClick={() => navigate('/profile/edit')}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: '11px', fontWeight: 400, color: arcColor,
              fontFamily: "'Jost', sans-serif", whiteSpace: 'nowrap',
            }}
          >
            Edit profile →
          </button>
        </div>

        {/* ── Your kitchen ───────────────────────────────────────────── */}
        <SectionLabel text="Your kitchen" />
        <SettingsCard rows={kitchenRows} navigate={navigate} />

        {/* ── Account ────────────────────────────────────────────────── */}
        <SectionLabel text="Account" />
        <SettingsCard rows={accountRows} navigate={navigate} />

        {/* ── Developer (admin only) ─────────────────────────────────── */}
        {isAdmin && (
          <>
            <SectionLabel text="Developer" />
            <SettingsCard rows={[
              { key: 'admin', icon: ICONS.admin, title: 'Admin Dashboard', sub: 'App health, analytics, data', route: '/admin' },
            ]} navigate={navigate} />
          </>
        )}

      </div>

      <BottomNav activeTab="home" />
    </div>
  )
}

function SectionLabel({ text }) {
  return (
    <div style={{
      fontSize: '10px', fontWeight: 500, letterSpacing: '2px',
      textTransform: 'uppercase', color: color.inkSoft,
      marginBottom: '8px',
    }}>
      {text}
    </div>
  )
}

function SettingsCard({ rows, navigate }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      border: `0.5px solid ${color.rule}`,
      marginBottom: '20px',
      overflow: 'hidden',
    }}>
      {rows.map((row, i) => (
        <button
          key={row.key}
          onClick={() => navigate(row.route)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '13px 14px',
            background: 'none', border: 'none', cursor: 'pointer',
            textAlign: 'left',
            borderTop: i > 0 ? `0.5px solid ${color.rule}` : 'none',
            minHeight: '44px',
          }}
        >
          {row.icon}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 400, color: color.ink }}>
              {row.title}
            </div>
            <div style={{ fontSize: '10px', color: color.inkSoft, marginTop: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {row.dot && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: color.forest, flexShrink: 0 }} />
              )}
              {row.sub}
            </div>
          </div>
          {CHEVRON}
        </button>
      ))}
    </div>
  )
}
