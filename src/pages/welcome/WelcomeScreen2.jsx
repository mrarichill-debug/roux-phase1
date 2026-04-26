import { useNavigate } from 'react-router-dom'
import { BgTexture, NavRow, screenWrap } from './welcomeUtils'
import { color, alpha, elevation } from '../../styles/tokens'

function StepDots({ active }) {
  return (
    <div style={{
      display: 'flex', gap: '6px', marginTop: '40px',
      opacity: 0, animation: 'fadeIn 0.4s ease 0.6s forwards' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          height: '6px', borderRadius: '3px',
          width: i === active ? '18px' : '6px',
          background: i === active ? color.forest : color.rule,
          transition: 'all 0.2s' }} />
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
        opacity: 0, animation: `fadeUp 0.5s ease ${delay} forwards` }}
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
        flexShrink: 0, background: color.paper }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '16px', fontWeight: 500, color: color.ink, marginBottom: '4px',
          fontFamily: "'Playfair Display', serif" }}>{title}</div>
        <div style={{ fontSize: '12.5px', color: color.inkSoft, fontWeight: 300, lineHeight: 1.5 }}>
          {desc}
        </div>
      </div>

      {/* Arrow */}
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%',
        background: color.rule,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, color: color.inkSoft,
        transition: 'all 0.18s' }}>
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
          opacity: 0, animation: 'fadeUp 0.5s ease 0.15s forwards' }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '28px', fontWeight: 500, color: color.ink, lineHeight: 1.25, marginBottom: '10px' }}>
            Let's get you set up.
          </div>
          <div style={{ fontSize: '14px', color: color.inkSoft, fontWeight: 300, lineHeight: 1.6 }}>
            Are you starting a new home,<br />or joining one that already exists?
          </div>
        </div>

        {/* Choice cards */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '36px' }}>
          <ChoiceCard
            delay="0.28s"
            onClick={() => navigate('/create-home')}
            color={{ bg: 'rgba(61,107,79,0.08)', icon: color.forest }}
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
            color={{ bg: 'rgba(196,154,60,0.08)', icon: color.honey }}
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

        {/* OR divider and redundant invite code button removed — 'Join a home' IS the invite flow */}

        {/* Step dots */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <StepDots active={0} />
        </div>

      </div>
    </div>
  )
}
