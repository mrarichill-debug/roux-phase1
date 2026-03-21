/**
 * Shared 5-tab bottom navigation.
 * Order: Today | Week | Meals | Sage | Shop
 */
import { useNavigate, useLocation } from 'react-router-dom'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', driftwood: '#8C7B6B', linen: '#E8E0D0',
}

const NAV_TABS = [
  {
    key: 'today', label: 'Home', path: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    key: 'week', label: 'Week', path: '/thisweek',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
        <line x1="16" x2="16" y1="2" y2="6"/>
        <line x1="8" x2="8" y1="2" y2="6"/>
        <line x1="3" x2="21" y1="10" y2="10"/>
      </svg>
    ),
  },
  {
    key: 'meals', label: 'Meals', path: '/meals',
    icon: (
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" style={{ width: 22, height: 22 }}>
        <rect x="2" y="2" width="14" height="14" rx="2" strokeWidth="1.3"/>
        <path d="M5 6h8M5 9h8M5 12h5" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: 'sage', label: 'Sage', path: '/sage',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      </svg>
    ),
  },
  {
    key: 'shop', label: 'Shop', path: '/shopping',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <line x1="9" x2="21" y1="6" y2="6"/>
        <line x1="9" x2="21" y1="12" y2="12"/>
        <line x1="9" x2="21" y1="18" y2="18"/>
        <circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none"/>
        <circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none"/>
        <circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
]

// Map paths to their tab key for active detection
const PATH_TO_TAB = {
  '/': 'today',
  '/thisweek': 'week',
  '/week': 'week',
  '/meals': 'meals',
  '/meals/recipes': 'meals',
  '/meals/plan': 'meals',
  '/meals/traditions': 'meals',
  '/meals/traditions/new': 'meals',
  '/meals/saved': 'meals',
  '/recipes': 'meals',
  '/recipe': 'meals',
  '/save-recipe': 'meals',
  '/sage': 'sage',
  '/shopping': 'shop',
  '/profile': 'today',
  '/week-settings': 'week',
  '/week/defaults': 'week',
}

function getTabFromPath(pathname) {
  if (PATH_TO_TAB[pathname]) return PATH_TO_TAB[pathname]
  if (pathname.startsWith('/recipe/')) return 'meals'
  if (pathname.startsWith('/meals/')) return 'meals'
  return 'today'
}

export default function BottomNav({ activeTab, onBeforeNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()

  const currentTab = activeTab || getTabFromPath(location.pathname)

  function handleNavClick(path) {
    if (onBeforeNavigate) {
      onBeforeNavigate(() => navigate(path))
    } else {
      navigate(path)
    }
  }

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '430px',
      zIndex: 100, background: C.cream,
      borderTop: `1px solid ${C.linen}`,
      paddingBottom: 'env(safe-area-inset-bottom, 8px)',
    }}>
      <div style={{
        height: '48px',
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        alignItems: 'center',
      }}>
      {NAV_TABS.map(tab => {
        const active = tab.key === currentTab
        return (
          <button
            key={tab.key}
            onClick={() => handleNavClick(tab.path)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '3px',
              cursor: 'pointer', padding: 0,
              background: 'none', border: 'none',
              color: active ? C.forest : C.driftwood,
              transition: 'color 0.15s',
              position: 'relative',
              fontFamily: "'Jost', sans-serif",
              height: '100%',
            }}
          >
            {tab.icon}
            <span style={{
              fontSize: '9px',
              fontWeight: active ? 600 : 400,
              letterSpacing: '0.3px',
            }}>
              {tab.label}
            </span>
            {active && (
              <span style={{
                position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)',
                width: '3px', height: '3px', borderRadius: '50%', background: C.forest,
              }} />
            )}
          </button>
        )
      })}
      </div>
    </nav>
  )
}
