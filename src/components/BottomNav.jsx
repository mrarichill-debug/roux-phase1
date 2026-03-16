/**
 * Shared 5-tab bottom navigation.
 * Order: Today | Week | Meals (center, green circle) | Sage | Shop
 */
import { useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', driftwood: '#8C7B6B', linen: '#E8E0D0',
}

// ── Icons ────────────────────────────────────────────────────────────────────

const TodayIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="3" x2="21" y1="9" y2="9"/>
    <line x1="9" x2="9" y1="4" y2="9"/>
    <line x1="15" x2="15" y1="4" y2="9"/>
    <circle cx="12" cy="15.5" r="2.2" fill="currentColor" stroke="none"/>
  </svg>
)

const WeekIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="3" x2="21" y1="9" y2="9"/>
    <line x1="9" x2="9" y1="4" y2="9"/>
    <line x1="15" x2="15" y1="4" y2="9"/>
    <circle cx="7.5" cy="13.5" r="1.3" fill="currentColor" stroke="none"/>
    <circle cx="12" cy="13.5" r="1.3" fill="currentColor" stroke="none"/>
    <circle cx="16.5" cy="13.5" r="1.3" fill="currentColor" stroke="none"/>
    <circle cx="7.5" cy="18" r="1.3" fill="currentColor" stroke="none" opacity="0.4"/>
    <circle cx="12" cy="18" r="1.3" fill="currentColor" stroke="none" opacity="0.4"/>
    <circle cx="16.5" cy="18" r="1.3" fill="currentColor" stroke="none" opacity="0.4"/>
  </svg>
)

const MealsIcon = () => (
  <svg width="22" height="20" viewBox="0 0 32 30" fill="none">
    <rect x="1" y="9" width="24" height="18" rx="2" stroke="rgba(250,247,242,0.92)" strokeWidth="2" fill="none"/>
    <rect x="3" y="6" width="20" height="5" rx="1.5" stroke="rgba(250,247,242,0.92)" strokeWidth="2" fill="none"/>
    <rect x="5" y="3" width="16" height="5" rx="1.5" stroke="rgba(250,247,242,0.92)" strokeWidth="2" fill="none"/>
    <line x1="5" x2="21" y1="15" y2="15" stroke="rgba(250,247,242,0.65)" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="5" x2="16" y1="20" y2="20" stroke="rgba(250,247,242,0.65)" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M5 10V8" stroke="rgba(250,247,242,0.5)" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M21 10V8" stroke="rgba(250,247,242,0.5)" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
)

const SageIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <path d="M12 7 L11.2 9.5a1 1 0 0 1-.6.6L8 11l2.6.9a1 1 0 0 1 .6.6L12 15l.8-2.5a1 1 0 0 1 .6-.6L16 11l-2.6-.9a1 1 0 0 1-.6-.6Z"/>
  </svg>
)

const ShopIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" x2="21" y1="6" y2="6"/>
    <line x1="9" x2="21" y1="12" y2="12"/>
    <line x1="9" x2="21" y1="18" y2="18"/>
    <circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none"/>
    <circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none"/>
    <circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none"/>
  </svg>
)

// ── Path → tab mapping ───────────────────────────────────────────────────────
const PATH_TO_TAB = {
  '/': 'today',
  '/thisweek': 'week',
  '/week': 'week',
  '/meals': 'meals',
  '/meals/recipes': 'meals',
  '/meals/plan': 'meals',
  '/meals/traditions': 'meals',
  '/recipes': 'meals',
  '/recipe': 'meals',
  '/save-recipe': 'meals',
  '/sage': 'sage',
  '/shopping': 'shop',
  '/profile': 'today',
  '/week-settings': 'week',
}

function getTabFromPath(pathname) {
  // Exact match first
  if (PATH_TO_TAB[pathname]) return PATH_TO_TAB[pathname]
  // Prefix match for dynamic routes like /recipe/:id
  if (pathname.startsWith('/recipe/')) return 'meals'
  if (pathname.startsWith('/meals/')) return 'meals'
  return 'today'
}

// ── NavItem ──────────────────────────────────────────────────────────────────
function NavItem({ tab, label, icon, active, isCenter, onClick, width }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '3px',
        width: width || 42, height: '100%',
        cursor: 'pointer', background: 'none', border: 'none',
        color: isCenter ? 'rgba(250,247,242,0.95)' : (active ? C.forest : C.driftwood),
        transition: 'color 0.15s',
        position: 'relative',
        fontFamily: "'Jost', sans-serif",
        padding: 0,
      }}
    >
      {icon}
      <span style={{
        fontSize: '9px',
        fontWeight: active || isCenter ? 600 : 400,
        letterSpacing: '0.3px',
        color: isCenter ? 'rgba(250,247,242,0.85)' : undefined,
      }}>
        {label}
      </span>
      {active && !isCenter && (
        <span style={{
          position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)',
          width: '3px', height: '3px', borderRadius: '50%', background: C.forest,
        }} />
      )}
    </button>
  )
}

// ── BottomNav ────────────────────────────────────────────────────────────────
export default function BottomNav({ activeTab }) {
  const navigate = useNavigate()
  const location = useLocation()
  const circleRef = useRef(null)

  const currentTab = activeTab || getTabFromPath(location.pathname)

  const handleMealsTap = useCallback(() => {
    // Pulse animation
    if (circleRef.current) {
      circleRef.current.classList.remove('meals-circle-active')
      // Force reflow to restart animation
      void circleRef.current.offsetWidth
      circleRef.current.classList.add('meals-circle-active')
    }
    navigate('/meals')
  }, [navigate])

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '430px', height: '66px',
      zIndex: 100, background: C.cream,
      borderTop: `1px solid ${C.linen}`,
      overflow: 'hidden',
    }}>
      {/* Green circle behind Meals */}
      <div
        ref={circleRef}
        style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 68, height: 68, borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(61,107,79,0.95) 0%, rgba(61,107,79,0.85) 50%, rgba(61,107,79,0.6) 75%, rgba(61,107,79,0.0) 100%)',
          zIndex: 1,
          transition: 'transform 0.2s ease',
        }}
      />

      {/* Nav items */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2,
      }}>
        {/* Left pair */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <NavItem tab="today" label="Today" icon={<TodayIcon />}
            active={currentTab === 'today'} width={52}
            onClick={() => navigate('/')} />
          <NavItem tab="week" label="Week" icon={<WeekIcon />}
            active={currentTab === 'week'} width={52}
            onClick={() => navigate('/thisweek')} />
        </div>

        {/* Gap */}
        <div style={{ width: 10 }} />

        {/* Meals center */}
        <NavItem tab="meals" label="Meals" icon={<MealsIcon />}
          isCenter active={currentTab === 'meals'} width={64}
          onClick={handleMealsTap} />

        {/* Gap */}
        <div style={{ width: 10 }} />

        {/* Right pair */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <NavItem tab="sage" label="Sage" icon={<SageIcon />}
            active={currentTab === 'sage'} width={52}
            onClick={() => navigate('/sage')} />
          <NavItem tab="shop" label="Shop" icon={<ShopIcon />}
            active={currentTab === 'shop'} width={52}
            onClick={() => navigate('/shopping')} />
        </div>
      </div>
    </nav>
  )
}
