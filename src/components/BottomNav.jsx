/**
 * Shared 5-tab bottom navigation — icons only, no labels.
 * Order: Home | Meals | Plan | Events | Shop
 */
import { useNavigate, useLocation } from 'react-router-dom'
import { useArc } from '../context/ArcContext'

const C = {
  cream: '#FAF7F2', driftwood: '#8C7B6B', linen: '#E8E0D0',
}

const NAV_TABS = [
  {
    key: 'home', path: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    key: 'meals', path: '/meals',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
      </svg>
    ),
  },
  {
    key: 'plan', path: '/plan',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
      </svg>
    ),
  },
  {
    key: 'events', path: '/events',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    key: 'shop', path: '/shop',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" x2="9" y1="12" y2="12.01"/><line x1="13" x2="15" y1="12" y2="12"/><line x1="9" x2="9" y1="16" y2="16.01"/><line x1="13" x2="15" y1="16" y2="16"/>
      </svg>
    ),
  },
]

const PATH_TO_TAB = {
  '/': 'home',
  '/plan': 'plan',
  '/thisweek': 'plan',
  '/week': 'plan',
  '/week-settings': 'plan',
  '/week/defaults': 'plan',
  '/meals': 'meals',
  '/meals/recipes': 'meals',
  '/meals/plan': 'meals',
  '/meals/traditions': 'meals',
  '/meals/traditions/new': 'meals',
  '/meals/saved': 'meals',
  '/recipes': 'meals',
  '/recipe': 'meals',
  '/save-recipe': 'meals',
  '/events': 'events',
  '/shop': 'shop',
  '/shopping': 'shop',
  '/pantry': 'shop',
  '/pantry/list': 'shop',
  '/pantry/trip': 'shop',
  '/profile': 'home',
}

function getTabFromPath(pathname) {
  if (PATH_TO_TAB[pathname]) return PATH_TO_TAB[pathname]
  if (pathname.startsWith('/recipe/')) return 'meals'
  if (pathname.startsWith('/meals/')) return 'meals'
  if (pathname.startsWith('/pantry/')) return 'shop'
  if (pathname.startsWith('/shop')) return 'shop'
  return 'home'
}

export default function BottomNav({ activeTab, onBeforeNavigate }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { color: arcColor } = useArc()

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
              color: active ? arcColor : C.driftwood,
              transition: 'color 0.15s',
              height: '100%',
            }}
          >
            {active ? (
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: arcColor }} />
            ) : (
              <span style={{ width: '4px', height: '4px' }} />
            )}
            {tab.icon}
          </button>
        )
      })}
      </div>
    </nav>
  )
}
