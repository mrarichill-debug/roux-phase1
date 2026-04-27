/**
 * KitchenNote — the Direction A pull-quote pattern for Roux's voice.
 *
 *   ●  A NOTE FROM YOUR KITCHEN              ← honey dot + Jost uppercase eyebrow
 *   "Henry has practice 'til 7. I moved
 *   his plate to the warmer in the plan."    ← Playfair italic message
 *
 * No card chrome. No background fill. Hairline `--rule` top border only.
 * The intelligence-message data source is unchanged — this replaces the
 * visual treatment of SageNudgeCard's content, not the data plumbing.
 *
 * Optional `actions` slot renders below the message (typically two pill
 * buttons — primary forest + ghost). Children prop provides the message
 * for flexibility (string or JSX with embedded names/values).
 */

import { color } from '../styles/tokens'

export default function KitchenNote({
  eyebrow = 'A NOTE FROM YOUR KITCHEN',
  children,
  actions,
  showRule = true,
}) {
  return (
    <div style={{
      padding: '16px 22px 14px',
      borderTop: showRule ? `1px solid ${color.rule}` : 'none',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
      }}>
        <span style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: color.honey,
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: "'Jost', sans-serif",
          fontSize: '9px',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: color.inkSoft,
        }}>
          {eyebrow}
        </span>
      </div>
      {children && (
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontStyle: 'italic',
          fontSize: '15px',
          lineHeight: 1.4,
          color: color.ink,
        }}>
          {children}
        </div>
      )}
      {actions && (
        <div style={{ marginTop: '12px' }}>{actions}</div>
      )}
    </div>
  )
}
