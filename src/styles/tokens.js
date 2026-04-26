// Roux design tokens — single source of truth for color, alpha, and elevation
// in JS. Mirrors :root in src/styles/global.css and docs/DESIGN-SYSTEM.md.
//
// Usage:
//   import { color, alpha, elevation } from '../styles/tokens'
//   <div style={{ background: color.paper, boxShadow: elevation.card }}>
//
// Inline `const C = {...}` palette objects in pages/components have been
// migrated out in favor of importing from here. New code MUST NOT introduce
// hex literals or hand-written rgba/boxShadow strings — see DESIGN-SYSTEM.md.
//
// Naming:
//   - paper / surface — background layers (paper = canvas, surface = elevated card bg)
//   - ink / inkSoft   — primary and secondary text, also used as a darker accent
//   - rule            — borders, dividers, inactive surfaces
//   - forest / sage / honey / amber / rust — brand color families, each with a
//     {family}Light / {family} / {family}Dark triplet.
//
// STEP 1 of the new-palette migration uses the previous hex values under the
// new names — no visual change. STEP 2 swaps the values to the new 19-token
// palette in one commit.

// ── Base palette (v2.1 — 19-token system) ────────────────────────────────────
export const color = {
  // Surfaces
  paper:        '#F4EFE6',
  surface:      '#FBF7EE',
  ink:          '#1A1612',
  inkSoft:      '#6B5E51',
  rule:         '#E2DACB',

  // Forest family
  forestLight:  '#E5EDD8',
  forest:       '#3D6B4F',
  forestDark:   '#243F30',

  // Sage family
  sageLight:    '#E4E7DA',
  sage:         '#7A8C6E',
  sageDark:     '#4D5B43',

  // Honey family
  honeyLight:   '#F2E4C7',
  honey:        '#C99A4B',
  honeyDark:    '#8A6628',

  // Amber family
  amberLight:   '#ECD9B0',
  amber:        '#A07830',
  amberDark:    '#6E4F18',

  // Rust family
  rustLight:    '#F1D9CB',
  rust:         '#C26240',
  rustDark:     '#8A3F22',

  // Day-type accents (orthogonal to the palette — left untouched for now;
  // no blue counterpart in the v2.1 19-token system)
  daySchool:    '#5B8DD9',
  dayWeekend:   '#7A8C6E',
  dayNoSchool:  '#D4874A',
  daySummer:    '#C49A3C',
}

// ── Canonical alpha steps ────────────────────────────────────────────────────
// Steps are the rgba values that recur 3+ times in the codebase. Use the
// nearest existing step rather than inventing new ones. Each base's rgb
// matches the v2.1 base color above.
export const alpha = {
  forest: {  // base #3D6B4F
    6:  'rgba(61,107,79,0.06)',
    8:  'rgba(61,107,79,0.08)',
    10: 'rgba(61,107,79,0.10)',
    15: 'rgba(61,107,79,0.15)',
    25: 'rgba(61,107,79,0.25)',
    40: 'rgba(61,107,79,0.40)',
  },
  honey: {  // base #C99A4B
    8:  'rgba(201,154,75,0.08)',
    10: 'rgba(201,154,75,0.10)',
    12: 'rgba(201,154,75,0.12)',
    30: 'rgba(201,154,75,0.30)',
  },
  sage: {  // base #7A8C6E
    6:  'rgba(122,140,110,0.06)',
    8:  'rgba(122,140,110,0.08)',
    10: 'rgba(122,140,110,0.10)',
    12: 'rgba(122,140,110,0.12)',
  },
  paper: {  // base #F4EFE6
    15: 'rgba(244,239,230,0.15)',
    50: 'rgba(244,239,230,0.50)',
    70: 'rgba(244,239,230,0.70)',
    90: 'rgba(244,239,230,0.90)',
    95: 'rgba(244,239,230,0.95)',
  },
  rule: {  // base #E2DACB
    15: 'rgba(226,218,203,0.15)',
    20: 'rgba(226,218,203,0.20)',
    25: 'rgba(226,218,203,0.25)',
    45: 'rgba(226,218,203,0.45)',
    55: 'rgba(226,218,203,0.55)',
  },
  rust: {  // base #C26240
    7:  'rgba(194,98,64,0.07)',
    20: 'rgba(194,98,64,0.20)',
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
