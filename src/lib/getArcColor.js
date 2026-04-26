// Arc color system — single source of truth for all arc-stage colors
// Every component that needs an accent color imports from here
// Never hardcode arc colors in components

export const ARC_COLORS = {
  forest: '#3D6B4F',  // Stages 1-2: growth, beginnings, safety
  sage:   '#7A8C6E',  // Stages 3-4: wisdom, calm, something personal forming
  honey:  '#C99A4B',  // Stages 5-6: warmth, richness, earned reward (v2.1)
  amber:  '#A07830',  // Stage 7: depth, permanence, a full year
};

// Colors that never change regardless of arc stage. Mirrors src/styles/tokens.js
// (paper / ink / inkSoft / rule). Keep these in sync with the v2.1 palette.
export const ARC_CONSTANTS = {
  topbar:    '#3D6B4F',  // Always forest — Roux's permanent identity
  tonight:   '#3C2F1E',  // Always deep walnut — the evening anchor
  navBg:     '#FFFFFF',  // Always white
  background:'#F4EFE6',  // paper
  ink:       '#1A1612',  // ink
  driftwood: '#6B5E51',  // ink-soft
  linen:     '#E2DACB',  // rule
};

// Primary function — returns the arc color hex for a given stage
export function getArcColor(stage) {
  if (!stage || stage <= 2) return ARC_COLORS.forest;
  if (stage <= 4) return ARC_COLORS.sage;
  if (stage <= 6) return ARC_COLORS.honey;
  return ARC_COLORS.amber;
}

// Returns the arc color name for a given stage (for documentation/logging)
export function getArcColorName(stage) {
  if (!stage || stage <= 2) return 'forest';
  if (stage <= 4) return 'sage';
  if (stage <= 6) return 'honey';
  return 'amber';
}

// Returns arc color at reduced opacity — for subtle backgrounds, borders
export function getArcColorAlpha(stage, alpha = 0.15) {
  const hex = getArcColor(stage);
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Returns the correct text color to use ON the arc color background
// (for buttons, filled pills, etc.)
export function getArcColorText(stage) {
  return '#F4EFE6'; // paper — works on all four arc colors
}
