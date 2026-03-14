/**
 * TopBar.jsx — Shared topbar component used across all screens.
 * Forest green, 66px (or 58px slim variant), sticky, z-index 100.
 * Wordmark left, optional right actions, global avatar handled by App.jsx.
 */

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
export default function TopBar({
  showWordmark = true,
  leftAction,
  rightActions,
  centerContent,
  slim = false,
  children,
  noShadow = false,
}) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: C.forest,
      boxShadow: noShadow && !children ? 'none' : SHADOW,
    }}>
      {/* Main bar */}
      <div style={{
        height: slim ? '58px' : '66px',
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
            fontFamily: "'Playfair Display', serif",
            fontSize: '26px', fontWeight: 600,
            color: 'rgba(250,247,242,0.95)', userSelect: 'none',
          }}>
            Ro<em style={{ fontStyle: 'italic', color: 'rgba(188,218,178,0.82)' }}>ux</em>
          </div>
        ) : (
          <div style={{ width: '36px' }} />
        )}

        {/* Center */}
        {centerContent || null}

        {/* Right — icon buttons + avatar spacer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {rightActions?.map((action, i) => (
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
          {/* Avatar spacer — global avatar rendered in App.jsx at z-index 150 */}
          <div style={{ width: '34px' }} />
        </div>
      </div>

      {/* Extended content (search strip, etc.) — same green background */}
      {children}
    </header>
  )
}

export { SHADOW, backBtnStyle }
