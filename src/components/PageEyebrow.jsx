/**
 * PageEyebrow — the recurring header pattern for Direction A screens.
 *
 *   [MONO-STYLE EYEBROW · UPPERCASE]            ← kicker
 *   Big Serif Headline                           ← title (+ optional italic accent)
 *   optional sans subtitle                       ← subtitle
 *
 * Used on every primary screen below the topbar (Home, Plan, Meals, Lists,
 * Recipe detail, etc.). All colors from tokens.js — no hex literals.
 *
 * Per project convention: no JetBrains Mono. Jost uppercase with
 * letter-spacing carries the "eyebrow" texture.
 */

import { color } from '../styles/tokens'

export default function PageEyebrow({ kicker, title, titleAccent, subtitle }) {
  return (
    <div style={{ padding: '20px 22px 14px' }}>
      {kicker && (
        <div style={{
          fontFamily: "'Jost', sans-serif",
          fontSize: '9px',
          fontWeight: 500,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: color.inkSoft,
          marginBottom: '8px',
        }}>
          {kicker}
        </div>
      )}
      {title && (
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 400,
          fontSize: '24px',
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          color: color.ink,
        }}>
          {title}
          {titleAccent && (
            <>
              {' '}
              <em style={{ fontStyle: 'italic', color: color.ink }}>
                {titleAccent}
              </em>
            </>
          )}
        </div>
      )}
      {subtitle && (
        <div style={{
          fontFamily: "'Jost', sans-serif",
          fontWeight: 300,
          fontSize: '13px',
          color: color.inkSoft,
          marginTop: '6px',
        }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}
