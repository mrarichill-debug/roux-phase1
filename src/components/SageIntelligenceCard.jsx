/**
 * SageIntelligenceCard.jsx — Shows Sage's growth stage with herb visual.
 * Renders on the Home screen. Herb grows from seed to flourishing plant.
 */
import { color, alpha, elevation } from '../styles/tokens'

const SOIL = color.amberDark
const LEAF = color.sage
const STEM = '#6B8C5E'

function HerbSeed() {
  return (
    <svg viewBox="0 0 60 80" style={{ width: 48, height: 64 }}>
      <rect x="5" y="58" width="50" height="18" rx="4" fill={SOIL} opacity="0.3" />
      <ellipse cx="30" cy="60" rx="5" ry="3.5" fill={SOIL} />
    </svg>
  )
}

function HerbSprout() {
  return (
    <svg viewBox="0 0 60 80" style={{ width: 48, height: 64 }}>
      <rect x="5" y="58" width="50" height="18" rx="4" fill={SOIL} opacity="0.3" />
      <line x1="30" y1="58" x2="30" y2="42" stroke={STEM} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="24" cy="42" rx="6" ry="4" fill={LEAF} transform="rotate(-25 24 42)" />
      <ellipse cx="36" cy="44" rx="6" ry="4" fill={LEAF} transform="rotate(25 36 44)" />
    </svg>
  )
}

function HerbGrowing() {
  return (
    <svg viewBox="0 0 60 80" style={{ width: 48, height: 64, animation: 'sway 3s ease-in-out infinite' }}>
      <rect x="5" y="58" width="50" height="18" rx="4" fill={SOIL} opacity="0.3" />
      <line x1="30" y1="58" x2="30" y2="30" stroke={STEM} strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="22" cy="48" rx="7" ry="4" fill={LEAF} transform="rotate(-30 22 48)" />
      <ellipse cx="38" cy="46" rx="7" ry="4" fill={LEAF} transform="rotate(25 38 46)" />
      <ellipse cx="21" cy="38" rx="6" ry="3.5" fill={LEAF} transform="rotate(-20 21 38)" opacity="0.9" />
      <ellipse cx="39" cy="36" rx="6" ry="3.5" fill={LEAF} transform="rotate(20 39 36)" opacity="0.9" />
      <ellipse cx="26" cy="30" rx="5" ry="3" fill={LEAF} transform="rotate(-15 26 30)" opacity="0.8" />
      <ellipse cx="34" cy="30" rx="5" ry="3" fill={LEAF} transform="rotate(15 34 30)" opacity="0.8" />
    </svg>
  )
}

function HerbEstablished() {
  return (
    <svg viewBox="0 0 60 80" style={{ width: 48, height: 64, animation: 'sway 3s ease-in-out infinite' }}>
      <rect x="5" y="58" width="50" height="18" rx="4" fill={SOIL} opacity="0.3" />
      <line x1="30" y1="58" x2="30" y2="22" stroke={STEM} strokeWidth="3" strokeLinecap="round" />
      <line x1="30" y1="48" x2="20" y2="42" stroke={STEM} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="30" y1="40" x2="42" y2="34" stroke={STEM} strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="18" cy="50" rx="8" ry="4.5" fill={LEAF} transform="rotate(-30 18 50)" />
      <ellipse cx="42" cy="48" rx="8" ry="4.5" fill={LEAF} transform="rotate(28 42 48)" />
      <ellipse cx="16" cy="40" rx="7" ry="4" fill={LEAF} transform="rotate(-22 16 40)" />
      <ellipse cx="44" cy="36" rx="7" ry="4" fill={LEAF} transform="rotate(22 44 36)" />
      <ellipse cx="20" cy="32" rx="6" ry="3.5" fill={LEAF} transform="rotate(-18 20 32)" opacity="0.9" />
      <ellipse cx="40" cy="28" rx="6" ry="3.5" fill={LEAF} transform="rotate(18 40 28)" opacity="0.9" />
      <ellipse cx="26" cy="24" rx="5" ry="3" fill={LEAF} transform="rotate(-12 26 24)" opacity="0.85" />
      <ellipse cx="34" cy="22" rx="5" ry="3" fill={LEAF} transform="rotate(12 34 22)" opacity="0.85" />
    </svg>
  )
}

function HerbFlourishing() {
  return (
    <svg viewBox="0 0 60 80" style={{ width: 48, height: 64, animation: 'sway 3s ease-in-out infinite' }}>
      <rect x="5" y="58" width="50" height="18" rx="4" fill={SOIL} opacity="0.3" />
      <line x1="30" y1="58" x2="30" y2="16" stroke={STEM} strokeWidth="3" strokeLinecap="round" />
      <line x1="30" y1="50" x2="16" y2="44" stroke={STEM} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="30" y1="42" x2="46" y2="36" stroke={STEM} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="30" y1="34" x2="18" y2="28" stroke={STEM} strokeWidth="1.5" strokeLinecap="round" />
      {/* Dense leaf canopy */}
      <ellipse cx="14" cy="52" rx="9" ry="5" fill={LEAF} transform="rotate(-32 14 52)" />
      <ellipse cx="46" cy="50" rx="9" ry="5" fill={LEAF} transform="rotate(30 46 50)" />
      <ellipse cx="12" cy="42" rx="8" ry="4.5" fill={LEAF} transform="rotate(-25 12 42)" />
      <ellipse cx="48" cy="38" rx="8" ry="4.5" fill={LEAF} transform="rotate(25 48 38)" />
      <ellipse cx="16" cy="34" rx="7" ry="4" fill={LEAF} transform="rotate(-20 16 34)" opacity="0.95" />
      <ellipse cx="44" cy="30" rx="7" ry="4" fill={LEAF} transform="rotate(20 44 30)" opacity="0.95" />
      <ellipse cx="20" cy="26" rx="7" ry="4" fill={LEAF} transform="rotate(-15 20 26)" opacity="0.9" />
      <ellipse cx="40" cy="22" rx="7" ry="4" fill={LEAF} transform="rotate(15 40 22)" opacity="0.9" />
      <ellipse cx="26" cy="18" rx="6" ry="3.5" fill={LEAF} transform="rotate(-10 26 18)" opacity="0.85" />
      <ellipse cx="34" cy="16" rx="6" ry="3.5" fill={LEAF} transform="rotate(10 34 16)" opacity="0.85" />
      <ellipse cx="30" cy="12" rx="5" ry="3" fill={LEAF} opacity="0.8" />
    </svg>
  )
}

const HERBS = {
  seed: HerbSeed,
  sprout: HerbSprout,
  growing: HerbGrowing,
  established: HerbEstablished,
  flourishing: HerbFlourishing,
}

export default function SageIntelligenceCard({ intelligence }) {
  if (!intelligence) return null
  const { stage, label, description, nextUnlock } = intelligence
  const Herb = HERBS[stage] || HerbSeed

  return (
    <div style={{
      margin: '0 22px 14px', padding: '16px',
      background: 'white', borderRadius: '14px',
      border: `1px solid ${color.rule}`,
      display: 'flex', alignItems: 'center', gap: '16px',
    }}>
      <div style={{ flexShrink: 0 }}>
        <Herb />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: color.ink, fontFamily: "'Jost', sans-serif", marginBottom: '4px' }}>
          {label}
        </div>
        <div style={{ fontSize: '13px', color: color.inkSoft, lineHeight: 1.5, fontFamily: "'Jost', sans-serif", fontWeight: 300 }}>
          {description}
        </div>
        {nextUnlock && (
          <div style={{ fontSize: '12px', color: color.sage, fontStyle: 'italic', marginTop: '6px', fontFamily: "'Jost', sans-serif" }}>
            ↑ {nextUnlock}
          </div>
        )}
      </div>
      <style>{`@keyframes sway { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(1.5deg); } 75% { transform: rotate(-1.5deg); } }`}</style>
    </div>
  )
}
