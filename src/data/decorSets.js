/**
 * decorSets.js — Seasonal watermark configurations.
 * Current season = spring (March–May 2026).
 */

export const SEASONS = {
  spring: [
    { slot: 'top-right', key: 'recipeBox',  scale: 0.72, opacity: 0.07, delay: 500 },
    { slot: 'mid-left',  key: 'herbs',      scale: 0.62, opacity: 0.07, delay: 700 },
    { slot: 'bot-right', key: 'spiceJars',  scale: 0.60, opacity: 0.07, delay: 900 },
  ],
  summer: [
    { slot: 'top-right', key: 'lemon',    scale: 0.78, opacity: 0.08, delay: 500 },
    { slot: 'mid-left',  key: 'oliveOil', scale: 0.60, opacity: 0.07, delay: 700 },
    { slot: 'bot-right', key: 'herbs',    scale: 0.62, opacity: 0.07, delay: 900 },
  ],
  fall: [
    { slot: 'top-right', key: 'cookieJar', scale: 0.68, opacity: 0.07, delay: 500 },
    { slot: 'mid-left',  key: 'spiceJars', scale: 0.60, opacity: 0.07, delay: 700 },
    { slot: 'bot-right', key: 'pinecone',  scale: 0.64, opacity: 0.07, delay: 900 },
  ],
  winter: [
    { slot: 'top-right', key: 'cookieJar', scale: 0.70, opacity: 0.08, delay: 500 },
    { slot: 'mid-left',  key: 'castIron',  scale: 0.62, opacity: 0.07, delay: 700 },
    { slot: 'bot-right', key: 'pinecone',  scale: 0.62, opacity: 0.07, delay: 900 },
  ],
}

export const SLOT_POS = {
  'top-right': { top: '78px',    right: '-4px',  bottom: 'auto', left: 'auto' },
  'mid-left':  { top: '44%',     left:  '-8px',  bottom: 'auto', right: 'auto' },
  'bot-right': { bottom: '68px', right: '-4px',  top:    'auto', left: 'auto' },
}

// Parallax scroll rate per slot (fraction of scrollY to translate upward)
export const RATE = {
  'top-right': 0.10,
  'mid-left':  0.15,
  'bot-right': 0.20,
}

export function getCurrentSeason() {
  const m = new Date().getMonth() // 0-indexed
  if (m >= 2 && m <= 4) return 'spring'
  if (m >= 5 && m <= 7) return 'summer'
  if (m >= 8 && m <= 10) return 'fall'
  return 'winter'
}
