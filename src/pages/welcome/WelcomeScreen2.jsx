import { useNavigate } from 'react-router-dom'
import { C, BgTexture, NavRow, screenWrap } from './welcomeUtils'

function StepDots({ active }) {
  return (
    <div style={{
      display: 'flex', gap: '6px', marginTop: '40px',
      opacity: 0, animation: 'fadeIn 0.4s ease 0.6s forwards',
    }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          height: '6px', borderRadius: '3px',
          width: i === active ? '18px' : '6px',
          background: i === active ? C.forest : C.linen,
          transition: 'all 0.2s',
        }} />
      ))}
    </div>
  )
}

function ChoiceCard({ icon, title, desc, color, delay, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', background: 'white',
        border: `1.5px solid rgba(200,185,160,0.5)`,
        borderRadius: '18px', padding: '24px 22px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '18px',
        boxShadow: '0 2px 8px rgba(80,60,30,0.06), 0 1px 2px rgba(80,60,30,0.04)',
        transition: 'all 0.18s', textAlign: 'left',
        opacity: 0, animation: `fadeUp 0.5s ease ${delay} forwards`,
      }}
      onMouseDown={e => {
        e.currentTarget.style.transform = 'scale(0.985)'
        e.currentTarget.style.borderColor = 'rgba(61,107,79,0.4)'
        e.currentTarget.style.background = 'rgba(250,248,244,0.9)'
      }}
      onMouseUp={e => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.borderColor = 'rgba(200,185,160,0.5)'
        e.currentTarget.style.background = 'white'
      }}
      onTouchStart={e => {
        e.currentTarget.style.transform = 'scale(0.985)'
        e.currentTarget.style.borderColor = 'rgba(61,107,79,0.4)'
      }}
      onTouchEnd={e => {
        e.currentTarget.style.transform = 'scale(1)'
        e.currentTarget.style.borderColor = 'rgba(200,185,160,0.5)'
      }}
    >
      {/* Icon container */}
      <div style={{
        width: '52px', height: '52px', borderRadius: '14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, background: color.bg,
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color.icon} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '16px', fontWeight: 500, color: C.ink, marginBottom: '4px',
          fontFamily: "'Playfair Display', serif",
        }}>{title}</div>
        <div style={{ fontSize: '12.5px', color: C.driftwood, fontWeight: 300, lineHeight: 1.5 }}>
          {desc}
        </div>
      </div>

      {/* Arrow */}
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: C.linen,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: C.driftwood,
        transition: 'all 0.18s',
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </button>
  )
}

export default function WelcomeScreen2() {
  const navigate = useNavigate()

  return (
    <div style={screenWrap}>
      <BgTexture />

      <NavRow onBack={() => navigate('/')} />

      <div style={{ position: 'relative', zIndex: 1, padding: '0 28px 48px', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 110px)' }}>

        {/* Heading */}
        <div style={{
          textAlign: 'center', marginBottom: '44px', width: '100%',
          opacity: 0, animation: 'fadeUp 0.5s ease 0.15s forwards',
        }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '28px', fontWeight: 500, color: C.ink, lineHeight: 1.25, marginBottom: '10px',
          }}>
            Let's get you set up.
          </div>
          <div style={{ fontSize: '14px', color: C.driftwood, fontWeight: 300, lineHeight: 1.6 }}>
            Are you starting a new home,<br />or joining one that already exists?
          </div>
        </div>

        {/* Choice cards */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '36px' }}>
          <ChoiceCard
            delay="0.28s"
            onClick={() => navigate('/create-home')}
            color={{ bg: 'rgba(61,107,79,0.08)', icon: C.forest }}
            title="Start from scratch"
            desc="Create a new home for your family. You'll be the admin."
            icon={
              <>
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <line x1="12" y1="13" x2="12" y2="19"/>
                <line x1="9"  y1="16" x2="15" y2="16"/>
              </>
            }
          />
          <ChoiceCard
            delay="0.38s"
            onClick={() => navigate('/join')}
            color={{ bg: 'rgba(196,154,60,0.08)', icon: C.honey }}
            title="Join a home"
            desc="Someone invited you. You'll join their kitchen as a member."
            icon={
              <>
                <circle cx="9" cy="7" r="3"/>
                <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </>
            }
          />
        </div>

        {/* Or divider */}
        <div style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
          marginBottom: '20px',
          opacity: 0, animation: 'fadeUp 0.4s ease 0.48s forwards',
        }}>
          <div style={{ flex: 1, height: '1px', background: C.linen }} />
          <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300, letterSpacing: '1px', textTransform: 'uppercase' }}>or</div>
          <div style={{ flex: 1, height: '1px', background: C.linen }} />
        </div>

        {/* Have a code button */}
        <button
          onClick={() => navigate('/join')}
          style={{
            width: '100%', padding: '14px 18px', borderRadius: '12px',
            background: 'transparent', border: `1px dashed rgba(122,140,110,0.4)`,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 400, color: C.sage,
            transition: 'all 0.15s',
            opacity: 0, animation: 'fadeUp 0.4s ease 0.52s forwards',
          }}
          onMouseDown={e => { e.currentTarget.style.background = 'rgba(122,140,110,0.06)'; e.currentTarget.style.borderStyle = 'solid' }}
          onMouseUp={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderStyle = 'dashed' }}
          onTouchStart={e => { e.currentTarget.style.background = 'rgba(122,140,110,0.06)' }}
          onTouchEnd={e => { e.currentTarget.style.background = 'transparent' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          I have an invite code
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <StepDots active={0} />
        </div>

      </div>
    </div>
  )
}
