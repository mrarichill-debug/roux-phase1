/**
 * BottomNav — Direction A bottom navigation.
 *
 * 5 tabs: Home · Meals · Plan · Events · Lists
 * Hand-drawn monoline icon set (1.3 stroke, 24×24 viewBox, round caps/joins).
 *
 * Active state: --sage-dark stroke + --sage-light fill on icon, --sage label
 * text, --sage 4×4 dot between icon and label.
 * Inactive state: --ink-soft stroke, no fill, --ink-soft label.
 *
 * Events route consolidates the older "Traditions" concept under a more
 * flexible menu name. Legacy /meals/traditions route remains for any deep
 * links but is no longer surfaced in nav.
 */

import { useNavigate, useLocation } from 'react-router-dom'
import { color } from '../styles/tokens'

const ICON_SIZE = 22
const STROKE_W = 1.3

// ── Hand-drawn monoline icon set ─────────────────────────────────────────────
function HomeIcon({ active }) {
  const stroke = active ? color.sageDark : color.inkSoft
  const fill = active ? color.sageLight : 'none'
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill={fill}>
      <path d="M3.5 11.2 12 4.4l8.5 6.8" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M5.4 10.5v9.1c0 .5.4.9.9.9h11.4c.5 0 .9-.4.9-.9v-9.1" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 20.5v-5.3h4v5.3" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function MealsIcon({ active }) {
  const stroke = active ? color.sageDark : color.inkSoft
  const fill = active ? color.sageLight : 'none'
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <path d="M4 12h16c0 4.4-3.6 8-8 8s-8-3.6-8-8z" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" strokeLinejoin="round" fill={fill} />
      <path d="M3 12h18" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" />
      <path d="M9.5 7c.5-1 .5-2 0-3" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" />
      <path d="M13 7c.5-1 .5-2 0-3" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" />
    </svg>
  )
}

function PlanIcon({ active }) {
  const stroke = active ? color.sageDark : color.inkSoft
  const fill = active ? color.sageLight : 'none'
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
      <rect x="3.8" y="5.5" width="16.4" height="14" rx="1.6" stroke={stroke} strokeWidth={STROKE_W} strokeLinejoin="round" fill={fill} />
      <path d="M3.8 10h16.4" stroke={stroke} strokeWidth={STROKE_W} />
      <path d="M8 4v3M16 4v3" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" />
      <circle cx="12" cy="14.5" r="1" fill={stroke} />
    </svg>
  )
}

// Events placeholder: bookmark glyph (same family as the icon study's "saved").
// Always fills sage-light when active — bookmarks want to feel "saved."
function EventsIcon({ active }) {
  const stroke = active ? color.sageDark : color.inkSoft
  const fill = active ? color.sageLight : 'none'
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill={fill}>
      <path d="M6.5 3.5h11v17l-5.5-3.7-5.5 3.7z" stroke={stroke} strokeWidth={STROKE_W} strokeLinejoin="round" />
    </svg>
  )
}

function ListsIcon({ active }) {
  const stroke = active ? color.sageDark : color.inkSoft
  const fill = active ? color.sageLight : 'none'
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill={fill}>
      <path d="M5.5 3.5h13v17h-13z" stroke={stroke} strokeWidth={STROKE_W} strokeLinejoin="round" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h5" stroke={stroke} strokeWidth={STROKE_W} strokeLinecap="round" fill="none" />
    </svg>
  )
}

const NAV_TABS = [
  { key: 'home',   path: '/',       label: 'Home',   Icon: HomeIcon },
  { key: 'meals',  path: '/meals',  label: 'Meals',  Icon: MealsIcon },
  { key: 'plan',   path: '/plan',   label: 'Plan',   Icon: PlanIcon },
  { key: 'events', path: '/events', label: 'Events', Icon: EventsIcon },
  { key: 'lists',  path: '/shop',   label: 'Lists',  Icon: ListsIcon },
]

const PATH_TO_TAB = {
  '/':                     'home',
  '/profile':              'home',
  '/plan':                 'plan',
  '/thisweek':             'plan',
  '/week':                 'plan',
  '/week-settings':        'plan',
  '/week/defaults':        'plan',
  '/meals':                'meals',
  '/meals/recipes':        'meals',
  '/meals/history':        'meals',
  '/meals/plan':           'meals',
  '/meals/traditions':     'meals',
  '/meals/traditions/new': 'meals',
  '/meals/saved':          'meals',
  '/meals/staples':        'meals',
  '/recipes':              'meals',
  '/save-recipe':          'meals',
  '/events':               'events',
  '/shop':                 'lists',
  '/shopping':             'lists',
  '/pantry':               'lists',
  '/pantry/list':          'lists',
}

function getTabFromPath(pathname) {
  if (PATH_TO_TAB[pathname]) return PATH_TO_TAB[pathname]
  if (pathname.startsWith('/recipe/')) return 'meals'
  if (pathname.startsWith('/meals/')) return 'meals'
  if (pathname.startsWith('/pantry/')) return 'lists'
  if (pathname.startsWith('/shop')) return 'lists'
  return 'home'
}

export default function BottomNav({ activeTab, onBeforeNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const currentTab = activeTab || getTabFromPath(location.pathname)

  function handleNavClick(path) {
    if (onBeforeNavigate) onBeforeNavigate(() => navigate(path))
    else navigate(path)
  }

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '430px',
      zIndex: 100,
      background: color.paper,
      borderTop: `1px solid ${color.rule}`,
      paddingBottom: 'env(safe-area-inset-bottom, 8px)',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        padding: '8px 0 6px',
      }}>
        {NAV_TABS.map(tab => {
          const active = tab.key === currentTab
          return (
            <button
              key={tab.key}
              onClick={() => handleNavClick(tab.path)}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'flex-start', gap: '3px',
                padding: '4px 0 2px',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <tab.Icon active={active} />
              <span style={{
                width: '4px', height: '4px', borderRadius: '50%',
                background: active ? color.sage : 'transparent',
                marginTop: '1px',
              }} />
              <span style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: '9px',
                letterSpacing: '0.1em',
                fontWeight: active ? 500 : 300,
                color: active ? color.sage : color.inkSoft,
                marginTop: '1px',
              }}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
