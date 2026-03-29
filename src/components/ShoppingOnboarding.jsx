/**
 * ShoppingOnboarding.jsx — 4-screen guided intro to the shopping workflow.
 * Full-screen overlay matching Onboarding.jsx style.
 * Triggers on first visit to Shop tab when items exist on the list.
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', sage: '#7A8C6E', linen: '#E8E0D0',
}

const SCREENS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32 }}>
        <line x1="9" x2="21" y1="6" y2="6"/>
        <line x1="9" x2="21" y1="12" y2="12"/>
        <line x1="9" x2="21" y1="18" y2="18"/>
        <circle cx="4" cy="6" r="1.3" fill={C.sage} stroke="none"/>
        <circle cx="4" cy="12" r="1.3" fill={C.sage} stroke="none"/>
        <circle cx="4" cy="18" r="1.3" fill={C.sage} stroke="none"/>
      </svg>
    ),
    heading: 'Your shopping list is ready',
    body: "Sage has pulled all the ingredients from your planned meals into one list \u2014 organized by category so you can shop efficiently.",
    button: 'Show me \u2192',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32 }}>
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    ),
    heading: 'Already have something?',
    body: "Tap \u2018Have it\u2019 on any ingredient you already have at home. Mark it as just for this week, or tell Sage it\u2019s a pantry staple you always keep on hand.",
    button: 'Got it \u2192',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32 }}>
        <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
    ),
    heading: 'Ready to shop?',
    body: "Tap \u2018Start a Trip\u2019, choose your store, and pick which ingredients you\u2019re getting there. You can split items across multiple stores.",
    button: 'Makes sense \u2192',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32 }}>
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
        <path d="M8 7h8M8 11h8M8 15h4"/>
      </svg>
    ),
    heading: 'Check things off as you go',
    body: "When you\u2019re at the store, open your trip and tap each item as you find it. When you\u2019re done, scan your receipt so Sage can learn what things cost.",
    button: "Let\u2019s shop \u2192",
  },
]

export default function ShoppingOnboarding({ appUser, onComplete }) {
  const [step, setStep] = useState(0)
  const screen = SCREENS[step]

  async function handleNext() {
    if (step < SCREENS.length - 1) {
      setStep(s => s + 1)
    } else {
      // Complete — set flag
      await supabase.from('users').update({ has_seen_shopping_onboarding: true }).eq('id', appUser.id)
      onComplete()
    }
  }

  function handleBack() {
    if (step > 0) setStep(s => s - 1)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: C.cream,
      display: 'flex', flexDirection: 'column',
      maxWidth: '430px', margin: '0 auto',
      fontFamily: "'Jost', sans-serif", fontWeight: 300,
    }}>
      {/* Back arrow */}
      {step > 0 && (
        <button onClick={handleBack} style={{
          position: 'absolute', top: '20px', left: '20px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: C.driftwood, padding: '4px', zIndex: 10,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
      )}

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 36px 140px', textAlign: 'center',
      }}>
        <div style={{ animation: 'fadeUp 0.4s ease both' }} key={step}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(122,140,110,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            {screen.icon}
          </div>
          <div style={{
            fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500,
            color: C.ink, marginBottom: '16px',
          }}>{screen.heading}</div>
          <div style={{ fontSize: '16px', color: C.driftwood, lineHeight: 1.7, maxWidth: '300px', fontWeight: 400 }}>
            {screen.body}
          </div>
        </div>
      </div>

      {/* CTA button + progress dots */}
      <div style={{
        position: 'fixed', bottom: '0', left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', padding: '20px 36px 40px',
        background: C.cream,
      }}>
        <button onClick={handleNext} style={{
          width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
          background: C.forest, color: 'white',
          cursor: 'pointer', fontFamily: "'Jost', sans-serif",
          fontSize: '15px', fontWeight: 500,
          boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
        }}>{screen.button}</button>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          {SCREENS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? '20px' : '6px', height: '6px', borderRadius: '3px',
              background: i === step ? C.forest : C.linen,
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
