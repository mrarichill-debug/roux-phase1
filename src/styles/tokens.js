// Roux design tokens — single source of truth for color, alpha, and elevation
// in JS. Mirrors :root in src/styles/global.css and docs/DESIGN-SYSTEM.md.
//
// Usage:
//   import { color, alpha, elevation } from '../styles/tokens'
//   <div style={{ background: color.cream, boxShadow: elevation.card }}>
//
// Inline `const C = {...}` palette objects in pages/components are being
// migrated out in favor of importing from here. New code MUST NOT introduce
// hex literals or hand-written rgba/boxShadow strings — see DESIGN-SYSTEM.md.

// ── Base palette ─────────────────────────────────────────────────────────────
export const color = {
  forest:      '#3D6B4F',
  forestDk:    '#2E5038',
  sage:        '#7A8C6E',
  honey:       '#C49A3C',
  honeyDk:     '#7A5C14',
  cream:       '#FAF7F2',
  ink:         '#2C2417',
  driftwood:   '#8C7B6B',
  driftwoodSm: '#6B5B4E',
  linen:       '#E8E0D0',
  linenDk:     '#C8B9A0',
  walnut:      '#8B6F52',
  red:         '#A03030',

  daySchool:   '#5B8DD9',
  dayWeekend:  '#7A8C6E',
  dayNoSchool: '#D4874A',
  daySummer:   '#C49A3C',
}

// ── Canonical alpha steps ────────────────────────────────────────────────────
// Values come from a sweep of every rgba(...) literal in src/. Steps here are
// the ones that appear 3+ times. Use the nearest existing step rather than
// inventing new ones; if your design genuinely needs a new step, add it here
// (review-gated) instead of inlining a one-off rgba.
export const alpha = {
  forest: {
    6:  'rgba(61,107,79,0.06)',
    8:  'rgba(61,107,79,0.08)',
    10: 'rgba(61,107,79,0.10)',
    15: 'rgba(61,107,79,0.15)',
    25: 'rgba(61,107,79,0.25)',
    40: 'rgba(61,107,79,0.40)',
  },
  honey: {
    8:  'rgba(196,154,60,0.08)',
    10: 'rgba(196,154,60,0.10)',
    12: 'rgba(196,154,60,0.12)',
    30: 'rgba(196,154,60,0.30)',
  },
  sage: {
    6:  'rgba(122,140,110,0.06)',
    8:  'rgba(122,140,110,0.08)',
    10: 'rgba(122,140,110,0.10)',
    12: 'rgba(122,140,110,0.12)',
  },
  cream: {
    15: 'rgba(250,247,242,0.15)',
    50: 'rgba(250,247,242,0.50)',
    70: 'rgba(250,247,242,0.70)',
    90: 'rgba(250,247,242,0.90)',
    95: 'rgba(250,247,242,0.95)',
  },
  linenDk: {
    15: 'rgba(200,185,160,0.15)',
    20: 'rgba(200,185,160,0.20)',
    25: 'rgba(200,185,160,0.25)',
    45: 'rgba(200,185,160,0.45)',
    55: 'rgba(200,185,160,0.55)',
  },
  red: {
    7:  'rgba(160,48,48,0.07)',
    20: 'rgba(160,48,48,0.20)',
  },
}

// ── Shadow elevations ────────────────────────────────────────────────────────
// Mirror --elev-* CSS variables. Every boxShadow in components should come
// from this scale; new entries require a design review.
export const elevation = {
  card:          '0 1px 4px rgba(80,60,30,0.06)',
  cardRaised:    '0 2px 6px rgba(80,60,30,0.06)',
  cardComposite: '0 1px 4px rgba(80,60,30,0.07), 0 3px 12px rgba(80,60,30,0.05)',
  chip:          '0 1px 3px rgba(0,0,0,0.15)',
  modal:         '0 4px 16px rgba(30,55,35,0.25)',
  toast:         '0 4px 16px rgba(0,0,0,0.15)',
  drawer:        '0 8px 32px rgba(44,36,23,0.18)',
  topbar: [
    '0 2px  0px rgba(20,40,25,0.55)',
    '0 4px  8px rgba(20,40,25,0.40)',
    '0 8px 24px rgba(30,55,35,0.28)',
    '0 16px 40px rgba(30,55,35,0.14)',
    '0 1px  0px rgba(255,255,255,0.06) inset',
  ].join(', '),
}
