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

// ── Base palette ─────────────────────────────────────────────────────────────
export const color = {
  // Surfaces
  paper:        '#FAF7F2',  // STEP 2 → #F4EFE6
  surface:      '#FAF7F2',  // STEP 2 → #FBF7EE
  ink:          '#2C2417',  // STEP 2 → #1A1612
  inkSoft:      '#8C7B6B',  // was driftwood; STEP 2 → #6B5E51
  rule:         '#E8E0D0',  // was linen; STEP 2 → #E2DACB

  // Forest family
  forestLight:  '#3D6B4F',  // STEP 2 → #E5EDD8
  forest:       '#3D6B4F',
  forestDark:   '#2E5038',  // STEP 2 → #243F30

  // Sage family
  sageLight:    '#7A8C6E',  // STEP 2 → #E4E7DA
  sage:         '#7A8C6E',
  sageDark:     '#7A8C6E',  // STEP 2 → #4D5B43

  // Honey family
  honeyLight:   '#C49A3C',  // STEP 2 → #F2E4C7
  honey:        '#C49A3C',  // STEP 2 → #C99A4B
  honeyDark:    '#7A5C14',  // was honeyDk; STEP 2 → #8A6628

  // Amber family
  amberLight:   '#A07830',  // STEP 2 → #ECD9B0
  amber:        '#A07830',
  amberDark:    '#8B6F52',  // was walnut; STEP 2 → #6E4F18

  // Rust family
  rustLight:    '#A03030',  // STEP 2 → #F1D9CB
  rust:         '#A03030',  // was red; STEP 2 → #C26240
  rustDark:     '#A03030',  // STEP 2 → #8A3F22

  // Day-type accents (orthogonal to the palette; intentionally untouched —
  // the new palette has no blue counterpart for daySchool)
  daySchool:    '#5B8DD9',
  dayWeekend:   '#7A8C6E',
  dayNoSchool:  '#D4874A',
  daySummer:    '#C49A3C',
}

// ── Canonical alpha steps ────────────────────────────────────────────────────
// Steps are the rgba values that recur 3+ times in the codebase. Use the
// nearest existing step rather than inventing new ones.
//
// Renames in this migration: alpha.paper → alpha.paper, alpha.rule → alpha.rule.
// Step values still use OLD rgb bases; STEP 2 swaps to new palette rgb.
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
  paper: {
    15: 'rgba(250,247,242,0.15)',
    50: 'rgba(250,247,242,0.50)',
    70: 'rgba(250,247,242,0.70)',
    90: 'rgba(250,247,242,0.90)',
    95: 'rgba(250,247,242,0.95)',
  },
  rule: {
    15: 'rgba(200,185,160,0.15)',
    20: 'rgba(200,185,160,0.20)',
    25: 'rgba(200,185,160,0.25)',
    45: 'rgba(200,185,160,0.45)',
    55: 'rgba(200,185,160,0.55)',
  },
  rust: {
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
