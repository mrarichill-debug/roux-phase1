/**
 * HairlineRow — a list row separated by a single rule, no card chrome.
 *
 * The Direction A list pattern. Used wherever content is informational and
 * cards would be too heavy: Plan day rows, Shopping items, Up Next, etc.
 *
 *   [left]  [center grows]                [right]
 *   ──────────────────────────────────────────────  ← border-top: --rule
 *
 * left   — typically a date number, day abbreviation, or checkbox (Playfair
 *          for typographic moments, plain svg for affordances)
 * center — primary content. Grows. Multiple lines OK.
 * right  — chevron, action icon, quantity, or status pill.
 *
 * onClick optional — when set, the row is interactive (cursor pointer,
 * preserves left-aligned tap target). Use a real <button> when accessibility
 * matters; this component renders a div for visual consistency with
 * lists that include both clickable and static rows.
 */

import { color } from '../styles/tokens'

export default function HairlineRow({
  left,
  center,
  right,
  onClick,
  isFirst = false,
  isLast = false,
  background = 'transparent',
  leftBorder,                   // optional accent (e.g. arc color for "today")
  style: extra = {},
}) {
  const interactive = typeof onClick === 'function'
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 22px',
        borderTop: `1px solid ${color.rule}`,
        borderBottom: isLast ? `1px solid ${color.rule}` : 'none',
        background,
        cursor: interactive ? 'pointer' : 'default',
        boxShadow: leftBorder ? `inset 2px 0 0 ${leftBorder}` : 'none',
        ...extra,
      }}
    >
      <div style={{ minWidth: 0 }}>{left}</div>
      <div style={{ minWidth: 0 }}>{center}</div>
      <div style={{ minWidth: 0, color: color.inkSoft }}>{right}</div>
    </div>
  )
}
