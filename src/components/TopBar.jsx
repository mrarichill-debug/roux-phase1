/**
 * TopBar.jsx — Shared topbar component used across all screens.
 * Forest green, 66px (or 58px slim variant), sticky, z-index 100.
 * Wordmark left, optional right actions, global avatar handled by App.jsx.
 */

import { useLocation } from 'react-router-dom'

const C = {
  forest: '#3D6B4F',
  cream:  '#FAF7F2',
}

const SHADOW = `
  0 2px  0px rgba(20,40,25,0.55),
  0 4px  8px rgba(20,40,25,0.40),
  0 8px 24px rgba(30,55,35,0.28),
  0 16px 40px rgba(30,55,35,0.14),
  0 1px  0px rgba(255,255,255,0.06) inset
`

const backBtnStyle = {
  width: '36px', height: '36px', borderRadius: '50%',
  border: 'none', background: 'rgba(255,255,255,0.14)',
  color: 'rgba(250,247,242,0.9)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0,
  transition: 'background 0.15s',
}

/**
 * Props:
 * - showWordmark: boolean (default true) — show "Roux" logo
 * - leftAction: { onClick, icon?, label? } — back arrow or custom left button
 * - rightActions: [{ onClick, icon, label }] — array of right-side icon buttons
 * - centerContent: ReactNode — optional center element (e.g. status pill)
 * - slim: boolean (default false) — 58px instead of 66px
 * - children: ReactNode — additional content below the main bar (e.g. search strip)
 * - noShadow: boolean — omit shadow (used when children extend the green zone)
 */
const BELL_ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
// Search icon removed — search lives contextually on individual screens

export default function TopBar({
  showWordmark = true,
  leftAction,
  rightActions,
  centerContent,
  slim = false,
  children,
  childrenHeight = 0,
  noShadow = false,
  hideDefaultActions = false,
  onBellClick,
  notifCount = 0,
}) {
  const barHeight = slim ? 58 : 66
  const { pathname } = useLocation()

  const topbarTitle = (() => {
    if (pathname.startsWith('/meals')) return 'Meals.'
    if (pathname.startsWith('/plan') || pathname.startsWith('/thisweek') || pathname.startsWith('/week')) return 'Plan.'
    if (pathname.startsWith('/events')) return 'Traditions.'
    if (pathname.startsWith('/shop') || pathname.startsWith('/pantry') || pathname.startsWith('/shopping')) return 'List.'
    if (pathname.startsWith('/settings') || pathname.startsWith('/profile')) return 'Settings.'
    return 'Roux.'
  })()

  // Bell, search, and avatar are all global in App.jsx at z-index 150.
  // TopBar only renders custom rightActions if explicitly provided (e.g. fav star on RecipeCard).
  const actions = rightActions || []

  return (
    <>
      {/* Fixed header */}
      <header style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px',
        zIndex: 100,
        background: C.forest,
        boxShadow: noShadow && !children ? 'none' : SHADOW,
      }}>
        {/* Main bar */}
        <div style={{
          height: `${barHeight}px`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 22px',
        }}>
          {/* Left */}
          {leftAction ? (
            <button onClick={leftAction.onClick} style={backBtnStyle} aria-label={leftAction.label || 'Back'}>
              {leftAction.icon || (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              )}
            </button>
          ) : showWordmark ? (
            <div style={{
              fontFamily: "'Slabo 27px', Georgia, serif",
              fontSize: '20px', fontWeight: 400,
              color: 'rgba(250,247,242,0.95)', userSelect: 'none',
            }}>
              {topbarTitle}
            </div>
          ) : (
            <div style={{ width: '36px' }} />
          )}

          {/* Center */}
          {centerContent || null}

          {/* Right — icon buttons + avatar spacer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                aria-label={action.label}
                style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: 'rgba(210,230,200,0.7)',
                }}
              >
                {action.icon}
              </button>
            ))}
            {/* Spacer for global icons (bell + avatar) at z-index 150 */}
            <div style={{ width: '72px' }} />
          </div>
        </div>

        {/* Extended content (search strip, etc.) — same green background */}
        {children}
      </header>

      {/* Spacer to push content below the fixed header */}
      <div style={{ height: `${barHeight + childrenHeight}px`, flexShrink: 0 }} />
    </>
  )
}

export { SHADOW, backBtnStyle }
