// Arc color system — single source of truth for all arc-stage colors
// Every component that needs an accent color imports from here
// Never hardcode arc colors in components

export const ARC_COLORS = {
  forest: '#3D6B4F',  // Stages 1-2: growth, beginnings, safety
  sage:   '#7A8C6E',  // Stages 3-4: wisdom, calm, something personal forming
  honey:  '#C49A3C',  // Stages 5-6: warmth, richness, earned reward
  amber:  '#A07830',  // Stage 7: depth, permanence, a full year
};

// Colors that never change regardless of arc stage
export const ARC_CONSTANTS = {
  topbar:    '#3D6B4F',  // Always forest — Roux's permanent identity
  tonight:   '#3C2F1E',  // Always deep walnut — the evening anchor
  navBg:     '#FFFFFF',  // Always white
  background:'#FAF7F2',  // Always cream
  ink:       '#2C2417',  // Always ink
  driftwood: '#8C7B6B',  // Always driftwood
  linen:     '#E4DDD2',  // Always linen
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
  return '#FAF7F2'; // cream white works on all four arc colors
}
