/**
 * Shared 5-tab bottom navigation.
 * Order: Home | This Week | Recipes | Sage | Shopping
 */
import { useNavigate, useLocation } from 'react-router-dom'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', driftwood: '#8C7B6B', linen: '#E8E0D0',
}

const NAV_TABS = [
  {
    key: 'home', label: 'Home', path: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    key: 'thisweek', label: 'This Week', path: '/thisweek',
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
    key: 'recipes', label: 'Recipes', path: '/recipes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
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
    key: 'shopping', label: 'Shopping', path: '/shopping',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" x2="21" y1="6" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
]

// Map paths to their tab key for active detection
const PATH_TO_TAB = {
  '/': 'home',
  '/thisweek': 'thisweek',
  '/recipes': 'recipes',
  '/sage': 'sage',
  '/shopping': 'shopping',
  '/profile': 'home',
  '/week-settings': 'thisweek',
}

export default function BottomNav({ activeTab }) {
  const navigate = useNavigate()
  const location = useLocation()

  // Use explicit activeTab if provided, otherwise derive from path
  const currentTab = activeTab || PATH_TO_TAB[location.pathname] || 'home'

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '430px', height: '80px',
      padding: '10px 0 22px',
      display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
      zIndex: 100, background: C.cream,
      borderTop: `1px solid ${C.linen}`,
      boxShadow: '0 -2px 12px rgba(80,60,30,0.08)',
    }}>
      {NAV_TABS.map(tab => {
        const active = tab.key === currentTab
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
              cursor: 'pointer', padding: '4px 0',
              background: 'none', border: 'none',
              color: active ? C.forest : C.driftwood,
              transition: 'color 0.15s',
              position: 'relative',
              fontFamily: "'Jost', sans-serif",
            }}
          >
            {active && (
              <span style={{
                position: 'absolute', bottom: '-2px', left: '50%', transform: 'translateX(-50%)',
                width: '4px', height: '4px', borderRadius: '50%', background: C.forest,
              }} />
            )}
            {tab.icon}
            <span style={{ fontSize: '10px', fontWeight: active ? 600 : 400, letterSpacing: '0.3px' }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
