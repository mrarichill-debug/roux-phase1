/**
 * Color scheme token system.
 * Each household can pick a scheme (garden/slate/walnut/midnight).
 * Tokens map to CSS custom properties via useColorScheme().
 */

export const COLOR_SCHEMES = {
  garden: {
    primary: '#3D6B4F',
    primaryDark: '#2E5038',
    secondary: '#7A8C6E',
    accent: '#C49A3C',
    background: '#FAF7F2',
    surface: 'white',
    ink: '#2C2417',
    driftwood: '#9A8B78',
    linen: '#E4DDD2',
    tonightCard: 'wood_grain',
    topbarLogo: 'rgba(250,247,242,0.95)',
    topbarLogoAccent: 'rgba(188,218,178,0.82)',
    watermark: true,
  },
  slate: {
    primary: '#2C3E50',
    primaryDark: '#1A2B3C',
    secondary: '#4A90A4',
    accent: '#7AB8C8',
    background: '#F4F5F7',
    surface: 'white',
    ink: '#1A2332',
    driftwood: '#7A8899',
    linen: 'rgba(44,62,80,0.12)',
    tonightCard: 'solid',
    topbarLogo: 'rgba(244,245,247,0.95)',
    topbarLogoAccent: 'rgba(244,245,247,0.95)',
    watermark: false,
  },
  walnut: {
    primary: '#5C3D2E',
    primaryDark: '#4A2E22',
    secondary: '#8B6F52',
    accent: '#C49A3C',
    background: '#FAF6F1',
    surface: 'white',
    ink: '#2C1A0E',
    driftwood: '#A08060',
    linen: 'rgba(139,111,82,0.2)',
    tonightCard: 'wood_grain',
    topbarLogo: 'rgba(250,246,241,0.95)',
    topbarLogoAccent: 'rgba(250,246,241,0.95)',
    watermark: true,
  },
  midnight: {
    primary: '#1B2A4A',
    primaryDark: '#111E35',
    secondary: '#4169A8',
    accent: '#6B8EC4',
    background: '#0F1923',
    surface: '#162030',
    ink: '#E8EDF2',
    driftwood: '#4A5E72',
    linen: 'rgba(107,142,196,0.12)',
    tonightCard: 'solid',
    topbarLogo: 'rgba(240,244,248,0.95)',
    topbarLogoAccent: 'rgba(240,244,248,0.95)',
    watermark: false,
  },
}

export const SCHEME_NAMES = {
  garden: 'Garden',
  slate: 'Slate',
  walnut: 'Walnut',
  midnight: 'Midnight',
}

export function getScheme(name) {
  return COLOR_SCHEMES[name] || COLOR_SCHEMES.garden
}
