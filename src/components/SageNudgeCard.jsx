/**
 * SageNudgeCard.jsx — Unified Sage notification card.
 * Single consistent visual: sage green left border, ✦ sparkle, dismiss X.
 * All Sage messages on Home route through this component.
 */

const C = {
  sage: '#7A8C6E', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', forest: '#3D6B4F', linen: '#E8E0D0',
}

export default function SageNudgeCard({
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  secondaryOnAction,
  onDismiss,
  count,       // total number of unseen messages
  currentIndex, // 0-based index of this message
}) {
  return (
    <div style={{
      margin: '0 22px 14px',
      background: 'white',
      border: '1px solid rgba(200,185,160,0.55)',
      borderLeft: `3px solid ${C.sage}`,
      borderRadius: '14px',
      padding: '14px 16px',
      boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
      animation: 'fadeUp 0.35s ease 0.12s both',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Sage sparkle icon */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: 'rgba(122,140,110,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
        </div>

        {/* Message */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', color: C.ink, lineHeight: 1.5, fontFamily: "'Jost', sans-serif", fontWeight: 300 }}>
            {message}
          </div>
          {actionLabel && onAction && (
            <button onClick={onAction} style={{
              marginTop: '6px', background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', fontSize: '12px', color: C.forest, fontWeight: 400,
              fontFamily: "'Jost', sans-serif",
            }}>{actionLabel}</button>
          )}
          {secondaryActionLabel && secondaryOnAction && (
            <button onClick={secondaryOnAction} style={{
              marginTop: '4px', background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', fontSize: '11px', color: C.driftwood, fontWeight: 300,
              fontFamily: "'Jost', sans-serif", fontStyle: 'italic', display: 'block',
            }}>{secondaryActionLabel}</button>
          )}
        </div>

        {/* Dismiss X */}
        {onDismiss && (
          <button onClick={onDismiss} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.driftwood, padding: '2px', flexShrink: 0, opacity: 0.5,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Stack counter */}
      {count > 1 && (
        <div style={{
          marginTop: '8px', paddingTop: '6px', borderTop: `1px solid ${C.linen}`,
          fontSize: '10px', color: C.driftwood, textAlign: 'center',
          fontFamily: "'Jost', sans-serif",
        }}>
          {currentIndex + 1} of {count} — tap ✦ to see more
        </div>
      )}
    </div>
  )
}
