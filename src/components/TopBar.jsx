/**
 * TopBar.jsx — Shared topbar component used across all screens.
 *
 * Direction A treatment: slim 52px forest bar, no shadow, Playfair italic
 * wordmark. Avatar + bell are rendered by the global overlay in App.jsx.
 */

import { useLocation } from 'react-router-dom'
import { color, alpha } from '../styles/tokens'

const backBtnStyle = {
  width: '32px', height: '32px', borderRadius: '50%',
  border: 'none', background: alpha.paper[15],
  color: alpha.paper[95],
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
  slim = false,                  // legacy prop; Direction A is uniformly slim
  children,
  childrenHeight = 0,
  noShadow = false,              // legacy; Direction A is shadowless by default
  hideDefaultActions = false,
  onBellClick,
  notifCount = 0,
}) {
  // Direction A: slim 52px bar everywhere. The `slim` prop is preserved for
  // back-compat (some callers pass it explicitly) but no longer changes height.
  const barHeight = 52
  const { pathname } = useLocation()

  const topbarTitle = (() => {
    if (pathname.startsWith('/meals')) return 'Meals.'
    if (pathname.startsWith('/plan') || pathname.startsWith('/thisweek') || pathname.startsWith('/week')) return 'Plan.'
    if (pathname.startsWith('/events')) return 'Events.'
    if (pathname === '/pantry') return 'Pantry.'
    if (pathname.startsWith('/shop') || pathname.startsWith('/pantry') || pathname.startsWith('/shopping')) return 'Lists.'
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
        background: color.forest,
        // Direction A: no shadow. The flat forest bar is the brand.
      }}>
        {/* Main bar */}
        <div style={{
          height: `${barHeight}px`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 18px',
        }}>
          {/* Left */}
          {leftAction ? (
            <button onClick={leftAction.onClick} style={backBtnStyle} aria-label={leftAction.label || 'Back'}>
              {leftAction.icon || (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              )}
            </button>
          ) : showWordmark ? (
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontStyle: 'italic',
              fontSize: '18px',
              fontWeight: 400,
              color: alpha.paper[95],
              userSelect: 'none',
              letterSpacing: '-0.005em',
            }}>
              {topbarTitle}
            </div>
          ) : (
            <div style={{ width: '32px' }} />
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
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: alpha.paper[95],
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

export { backBtnStyle }
