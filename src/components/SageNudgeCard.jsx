/**
 * SageNudgeCard.jsx — Unified Sage notification card with three visual tiers.
 * tier="teaching" — tutorials, tooltips, celebrations (sage green, educational)
 * tier="notice" — missing data, action needed (amber/honey, attention)
 * tier="insight" — intelligent suggestions, predictions (forest green, premium)
 * Default tier is "notice" for backward compatibility.
 */
import { getArcColor } from '../lib/getArcColor'

const C = {
  sage: '#7A8C6E', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', forest: '#3D6B4F', linen: '#E8E0D0',
  honey: '#C49A3C',
}

const TIER_STYLES = {
  teaching: {
    bg: C.cream,
    border: `3px solid ${C.sage}`,
    outerBorder: '1px solid rgba(200,185,160,0.55)',
    iconBg: 'rgba(122,140,110,0.10)',
    iconStroke: C.sage,
    iconChar: null, // use sparkle SVG
    textColor: C.ink,
    actionColor: C.forest,
    secondaryColor: C.driftwood,
    dismissColor: C.driftwood,
    counterColor: C.driftwood,
    counterBorder: C.linen,
  },
  notice: {
    bg: '#FDF8F0',
    border: `3px solid ${C.honey}`,
    outerBorder: '1px solid rgba(200,185,160,0.45)',
    iconBg: 'rgba(196,154,60,0.10)',
    iconStroke: C.honey,
    iconChar: '⚠',
    textColor: C.ink,
    actionColor: C.forest,
    secondaryColor: C.driftwood,
    dismissColor: C.driftwood,
    counterColor: C.driftwood,
    counterBorder: C.linen,
  },
  insight: {
    bg: C.forest,
    border: 'none',
    outerBorder: 'none',
    iconBg: 'rgba(250,247,242,0.15)',
    iconStroke: C.cream,
    iconChar: null, // use sparkle SVG
    textColor: C.cream,
    actionColor: C.cream,
    secondaryColor: 'rgba(250,247,242,0.7)',
    dismissColor: 'rgba(250,247,242,0.5)',
    counterColor: 'rgba(250,247,242,0.5)',
    counterBorder: 'rgba(250,247,242,0.15)',
  },
}

export default function SageNudgeCard({
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  secondaryOnAction,
  onDismiss,
  count,
  currentIndex,
  tier = 'notice',
  arcColor,
}) {
  const ac = arcColor || getArcColor(1)
  const baseStyle = TIER_STYLES[tier] || TIER_STYLES.notice
  // Insight tier keeps its forest identity; teaching/notice get arc color
  const s = tier === 'insight' ? baseStyle : {
    ...baseStyle,
    border: `3px solid ${ac}`,
    actionColor: ac,
  }

  return (
    <div style={{
      margin: '0 22px 14px',
      background: s.bg,
      border: s.outerBorder,
      borderLeft: s.border,
      borderRadius: '14px',
      padding: '14px 16px',
      boxShadow: tier === 'insight' ? '0 2px 12px rgba(30,55,35,0.2)' : '0 1px 4px rgba(80,60,30,0.06)',
      animation: 'fadeUp 0.35s ease 0.12s both',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {/* Icon */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: s.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {s.iconChar ? (
            <span style={{ fontSize: '14px', lineHeight: 1 }}>{s.iconChar}</span>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke={s.iconStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
          )}
        </div>

        {/* Message */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', color: s.textColor, lineHeight: 1.5, fontFamily: "'Jost', sans-serif", fontWeight: 400 }}>
            {message}
          </div>
          {(actionLabel || secondaryActionLabel) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', gap: '8px' }}>
              {actionLabel && onAction && (
                <button onClick={onAction} style={{
                  background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', fontSize: '14px', color: s.actionColor, fontWeight: 400,
                  fontFamily: "'Jost', sans-serif",
                  textDecoration: tier === 'insight' ? 'underline' : 'none',
                }}>{actionLabel}</button>
              )}
              {secondaryActionLabel && secondaryOnAction && (
                <button onClick={secondaryOnAction} style={{
                  background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', fontSize: '13px', color: s.secondaryColor, fontWeight: 300,
                  fontFamily: "'Jost', sans-serif", fontStyle: 'italic',
                }}>{secondaryActionLabel}</button>
              )}
            </div>
          )}
        </div>

        {/* Dismiss X */}
        {onDismiss && (
          <button onClick={onDismiss} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: s.dismissColor, padding: '2px', flexShrink: 0, opacity: 0.5,
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
          marginTop: '8px', paddingTop: '6px', borderTop: `1px solid ${s.counterBorder}`,
          fontSize: '10px', color: s.counterColor, textAlign: 'center',
          fontFamily: "'Jost', sans-serif",
        }}>
          {currentIndex + 1} of {count} — tap ✦ to see more
        </div>
      )}
    </div>
  )
}
