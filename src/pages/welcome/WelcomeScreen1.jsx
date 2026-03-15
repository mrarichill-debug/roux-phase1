import { useNavigate } from 'react-router-dom'
import { C, BgTexture, screenWrap } from './welcomeUtils'

// ── Ghost recipe box — bottom-right corner decoration ───────────────────────
function RecipeBoxDecor() {
  return (
    <div style={{
      position: 'fixed', bottom: '-10px', right: '-18px',
      width: '200px', height: '180px',
      pointerEvents: 'none', zIndex: 0,
      opacity: 0, animation: 'decorFade 1.2s ease 1.0s forwards',
    }}>
      <svg viewBox="0 0 160 140" fill="none" stroke={C.ink} strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="30" width="144" height="100" rx="6" strokeWidth="3"/>
        <path d="M8,52 L152,52" strokeWidth="3"/>
        <path d="M40,30 L40,14 Q80,6 120,14 L120,30" strokeWidth="3"/>
        <rect x="28" y="62" width="104" height="58" rx="3" strokeWidth="2.2"/>
        <line x1="40" y1="78" x2="118" y2="78" strokeWidth="1.8"/>
        <line x1="40" y1="90" x2="118" y2="90" strokeWidth="1.8"/>
        <line x1="40" y1="102" x2="96"  y2="102" strokeWidth="1.8"/>
        <rect x="58" y="24" width="20" height="10" rx="2" strokeWidth="1.8"/>
        <rect x="84" y="24" width="20" height="10" rx="2" strokeWidth="1.8"/>
      </svg>
    </div>
  )
}

// ── Kitchen illustration (cutting board + herbs + spoon + bowl) ──────────────
function KitchenIllustration() {
  return (
    <svg
      width="120" height="96" viewBox="0 0 120 96"
      fill="none" stroke={C.ink} strokeLinecap="round" strokeLinejoin="round"
      style={{ marginBottom: '36px', opacity: 0, animation: 'illustIn 0.8s ease 1.05s forwards' }}
    >
      {/* Cutting board */}
      <rect x="14" y="38" width="92" height="52" rx="5" strokeWidth="2"/>
      <rect x="20" y="44" width="80" height="40" rx="3" strokeWidth="1.4" opacity="0.5"/>
      {/* Board handle */}
      <path d="M14,58 L4,58 Q2,58 2,60 L2,66 Q2,68 4,68 L14,68" strokeWidth="2"/>
      {/* Herbs */}
      <line x1="45" y1="74" x2="45" y2="54" strokeWidth="1.8"/>
      <path d="M45,66 C40,60 34,62 36,56 C38,50 44,54 45,60" strokeWidth="1.6"/>
      <path d="M45,60 C50,54 56,56 54,50 C52,44 46,48 45,55" strokeWidth="1.6"/>
      {/* Spoon */}
      <path d="M72,74 C72,62 74,52 76,46" strokeWidth="2"/>
      <ellipse cx="76" cy="43" rx="5" ry="7" strokeWidth="1.8" transform="rotate(-8,76,43)"/>
      {/* Small bowl */}
      <path d="M88,64 C84,64 82,72 86,74 C90,76 96,74 94,68 C92,63 88,64 88,64" strokeWidth="1.8"/>
      <line x1="82" y1="74" x2="98" y2="74" strokeWidth="1.8"/>
    </svg>
  )
}

export default function WelcomeScreen1() {
  const navigate = useNavigate()

  return (
    <div style={{ ...screenWrap, display: 'flex', flexDirection: 'column' }}>
      <BgTexture />
      <RecipeBoxDecor />

      {/* ── SCREEN ── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        minHeight: '100vh', padding: '0 32px 48px',
      }}>

        {/* Top spacer */}
        <div style={{ flex: 1.2, minHeight: '80px' }} />

        {/* Wordmark block */}
        <div style={{
          textAlign: 'center', marginBottom: '18px',
          opacity: 0, transform: 'scale(0.95)',
          animation: 'logoIn 0.9s cubic-bezier(0.22,1,0.36,1) 0.2s forwards',
        }}>
          <div style={{
            fontFamily: "'Slabo 27px', Georgia, serif",
            fontSize: '58px',
            color: '#3D6B4F',
            letterSpacing: '-0.5px',
            marginBottom: '6px',
          }}>
            Roux.
          </div>
          {/* Tagline — Screen 1 only */}
          <div style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: '14px', fontWeight: 300, fontStyle: 'italic',
            color: C.sage, letterSpacing: '0.3px', lineHeight: 1.5,
            opacity: 0, animation: 'taglineIn 0.7s ease 0.85s forwards',
          }}>
            Roux and You — let's make something good.
          </div>
        </div>

        {/* Divider */}
        <div style={{
          width: '40px', height: '1px', background: C.linen,
          margin: '32px auto',
          opacity: 0, animation: 'fadeIn 0.5s ease 1.1s forwards',
        }} />

        {/* Kitchen illustration */}
        <KitchenIllustration />

        {/* Bottom spacer */}
        <div style={{ flex: 1, minHeight: '40px' }} />

        {/* Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <button
            onClick={() => navigate('/get-started')}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: '14px',
              background: C.forest, color: 'white',
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500, letterSpacing: '0.3px',
              border: 'none', cursor: 'pointer',
              boxShadow: `0 4px 16px rgba(30,55,35,0.28), 0 1px 3px rgba(30,55,35,0.15)`,
              transition: 'background 0.15s, transform 0.12s, box-shadow 0.15s',
              opacity: 0, animation: 'btnIn 0.5s ease 1.15s forwards',
            }}
            onMouseDown={e => { e.currentTarget.style.background = C.forestDk; e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={e => { e.currentTarget.style.background = C.forest; e.currentTarget.style.transform = 'scale(1)' }}
            onTouchStart={e => { e.currentTarget.style.background = C.forestDk; e.currentTarget.style.transform = 'scale(0.98)' }}
            onTouchEnd={e => { e.currentTarget.style.background = C.forest; e.currentTarget.style.transform = 'scale(1)' }}
          >
            Get Started
          </button>

          <button
            onClick={() => navigate('/sign-in')}
            style={{
              width: '100%', padding: '15px 20px', borderRadius: '14px',
              background: 'transparent', color: C.forest,
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500, letterSpacing: '0.3px',
              border: `1.5px solid rgba(61,107,79,0.4)`,
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s, transform 0.12s',
              opacity: 0, animation: 'btnIn 0.5s ease 1.25s forwards',
            }}
            onMouseDown={e => { e.currentTarget.style.background = 'rgba(61,107,79,0.06)'; e.currentTarget.style.transform = 'scale(0.98)' }}
            onMouseUp={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)' }}
            onTouchStart={e => { e.currentTarget.style.background = 'rgba(61,107,79,0.06)'; e.currentTarget.style.transform = 'scale(0.98)' }}
            onTouchEnd={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            Sign In
          </button>
        </div>

        {/* Legal */}
        <div style={{
          fontSize: '10px', color: C.driftwood,
          textAlign: 'center', lineHeight: 1.7,
          marginTop: '28px', fontWeight: 300,
          opacity: 0, animation: 'fadeIn 0.5s ease 1.5s forwards',
        }}>
          By continuing you agree to our{' '}
          <a href="#" style={{ color: 'inherit', textDecoration: 'underline' }}>Terms of Service</a>
          {' '}and{' '}
          <a href="#" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy Policy</a>
        </div>

      </div>
    </div>
  )
}
