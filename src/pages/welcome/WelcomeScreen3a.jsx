import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  C, BgTexture, NavRow, ProgressBar, screenWrap,
  StepHead, FormField, inputStyle, PrimaryButton,
  PasswordStrength, getPasswordStrength, ArrowIcon, TosLine, EyeIcon,
} from './welcomeUtils'

// ── Sage welcome card ─────────────────────────────────────────────────────────
function SageCard({ lastName, animDelay = '0.7s' }) {
  return (
    <div style={{
      width: '100%', background: 'white',
      borderLeft: `3px solid ${C.sage}`,
      borderRadius: '0 12px 12px 0',
      padding: '14px 16px', textAlign: 'left',
      marginBottom: '28px',
      boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
      opacity: 0, animation: `fadeUp 0.5s ease ${animDelay} forwards`,
    }}>
      <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.sage, marginBottom: '5px' }}>
        Sage
      </div>
      <div style={{ fontSize: '13px', color: C.ink, lineHeight: 1.6, fontWeight: 300 }}>
        "Welcome to your kitchen{lastName ? `, ${lastName} family` : ''}. I'm Sage — I'll help you plan your week, shop smarter, and make the most of what's in your fridge. Let's start by setting up your first week."
      </div>
    </div>
  )
}

// ── House icon for complete moment ───────────────────────────────────────────
function CompleteIcon() {
  return (
    <div style={{
      width: '72px', height: '72px', borderRadius: '50%',
      background: 'rgba(61,107,79,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: '24px',
      animation: 'iconPop 0.5s cubic-bezier(0.22,1,0.36,1) 0.3s both',
    }}>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    </div>
  )
}

export default function WelcomeScreen3a() {
  const navigate = useNavigate()
  const [step, setStep]           = useState(1)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [homeName, setHomeName]   = useState('')
  const [pwVisible, setPwVisible] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading]     = useState(false)
  const [authError, setAuthError] = useState('')

  // Focus first input on step change
  const firstInputRef = useRef(null)
  useEffect(() => {
    if (step <= 3) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 350)
      return () => clearTimeout(t)
    }
  }, [step])

  // Derived suggestion
  const suggestion = lastName.trim()
    ? `The ${lastName.trim()} Family Kitchen`
    : 'Our Family Kitchen'

  // Step 3 pre-fill suggestion when entering step 3
  useEffect(() => {
    if (step === 3 && !homeName) setHomeName(suggestion)
  }, [step]) // eslint-disable-line

  // Validation
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const { score: pwScore } = getPasswordStrength(password)
  const step1Ready = firstName.trim() && lastName.trim()
  const step2Ready = emailValid && pwScore === 3
  const step3Ready = homeName.trim().length > 0

  function goStep(n) {
    setStep(n)
    setAuthError('')
  }

  function handleBack() {
    if (step > 1) goStep(step - 1)
    else navigate('/get-started')
  }

  async function handleCreate() {
    setLoading(true)
    setAuthError('')
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: `${firstName.trim()} ${lastName.trim()}`,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            home_name: homeName.trim(),
          },
        },
      })
      if (error) throw error
      // The handle_new_user trigger creates the household + user row.
      // Move to welcome moment — auth state change in App.jsx will
      // pick up the session and route to the app after a delay.
      goStep(4)
    } catch (err) {
      setAuthError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Field style helper with focus tracking ───────────────────────────────
  const [focusedField, setFocusedField] = useState(null)

  function fieldInput(name, value, opts = {}) {
    return inputStyle({
      focused: focusedField === name,
      hasValue: value.length > 0,
      hasError: opts.hasError || false,
    })
  }

  const progressStep = step <= 3 ? step : 3

  return (
    <div style={screenWrap}>
      <BgTexture />

      <NavRow onBack={handleBack} />
      <ProgressBar step={progressStep} total={3} />

      <div style={{ position: 'relative', zIndex: 1, padding: '0 28px 48px', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 140px)' }}>

        {/* ══ STEP 1 — Name ══════════════════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHead eyebrow="Let's get acquainted" title="What's your name?" sub="This is how Roux will greet you." />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px', opacity: 0, animation: 'fadeUp 0.45s ease 0.22s forwards' }}>
              <FormField label="First name">
                <input
                  ref={firstInputRef}
                  type="text" value={firstName} placeholder="First name"
                  autoComplete="given-name"
                  style={fieldInput('first', firstName)}
                  onChange={e => setFirstName(e.target.value)}
                  onFocus={() => setFocusedField('first')}
                  onBlur={() => setFocusedField(null)}
                />
              </FormField>
              <FormField label="Last name" hint="Used to suggest a name for your home.">
                <input
                  type="text" value={lastName} placeholder="Last name"
                  autoComplete="family-name"
                  style={fieldInput('last', lastName)}
                  onChange={e => setLastName(e.target.value)}
                  onFocus={() => setFocusedField('last')}
                  onBlur={() => setFocusedField(null)}
                />
              </FormField>
            </div>

            <PrimaryButton style={{ marginTop: 'auto', opacity: 0, animation: 'fadeUp 0.45s ease 0.3s forwards' }} disabled={!step1Ready} onClick={() => goStep(2)}>
              Continue <ArrowIcon />
            </PrimaryButton>
          </div>
        )}

        {/* ══ STEP 2 — Email + Password ════════════════════════════════════ */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHead eyebrow="Your account" title="Create your login." sub="Just you — family members join separately later." />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px', opacity: 0, animation: 'fadeUp 0.45s ease 0.22s forwards' }}>
              <FormField label="Email" error={email && !emailValid ? 'Please enter a valid email address.' : ''}>
                <input
                  ref={firstInputRef}
                  type="email" value={email} placeholder="you@example.com"
                  autoComplete="email"
                  style={fieldInput('email', email, { hasError: !!(email && !emailValid) })}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </FormField>

              <FormField label="Password">
                <div style={{ position: 'relative' }}>
                  <input
                    type={pwVisible ? 'text' : 'password'}
                    value={password} placeholder="Choose a strong password"
                    style={{ ...fieldInput('pw', password), paddingRight: '44px' }}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('pw')}
                    onBlur={() => setFocusedField(null)}
                  />
                  <button
                    type="button"
                    onClick={() => setPwVisible(v => !v)}
                    aria-label="Toggle password"
                    style={{
                      position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: C.driftwood, padding: '4px', display: 'flex', alignItems: 'center',
                    }}
                  >
                    <EyeIcon visible={pwVisible} />
                  </button>
                </div>
                <PasswordStrength password={password} visible={password.length > 0} />
              </FormField>
            </div>

            <PrimaryButton style={{ marginTop: 'auto', opacity: 0, animation: 'fadeUp 0.45s ease 0.3s forwards' }} disabled={!step2Ready} onClick={() => goStep(3)}>
              Continue <ArrowIcon />
            </PrimaryButton>
          </div>
        )}

        {/* ══ STEP 3 — Home name ═══════════════════════════════════════════ */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHead eyebrow="Almost there" title="What do you call your kitchen?" sub="This is your home's name in Roux. You can always change it later." />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px', opacity: 0, animation: 'fadeUp 0.45s ease 0.22s forwards' }}>
              <FormField label="Home name">
                <input
                  ref={firstInputRef}
                  type="text" value={homeName}
                  placeholder="Our Family Kitchen"
                  style={fieldInput('home', homeName)}
                  onChange={e => setHomeName(e.target.value)}
                  onFocus={() => setFocusedField('home')}
                  onBlur={() => setFocusedField(null)}
                />

                {/* Suggestion chip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: C.driftwoodSm, fontWeight: 300 }}>Suggestion:</span>
                  <button
                    type="button"
                    onClick={() => setHomeName(suggestion)}
                    style={{
                      fontFamily: "'Jost', sans-serif",
                      fontSize: '13px', color: C.forest, fontWeight: 400,
                      padding: '4px 10px', borderRadius: '20px',
                      background: 'rgba(61,107,79,0.08)',
                      border: `1px solid rgba(61,107,79,0.2)`,
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseDown={e => e.currentTarget.style.background = 'rgba(61,107,79,0.15)'}
                    onMouseUp={e => e.currentTarget.style.background = 'rgba(61,107,79,0.08)'}
                    onTouchStart={e => e.currentTarget.style.background = 'rgba(61,107,79,0.15)'}
                    onTouchEnd={e => e.currentTarget.style.background = 'rgba(61,107,79,0.08)'}
                  >
                    {suggestion}
                  </button>
                </div>
              </FormField>
            </div>

            {authError && (
              <div style={{
                background: 'rgba(160,48,48,0.07)', border: `1px solid rgba(160,48,48,0.2)`,
                borderRadius: '10px', padding: '11px 14px',
                fontSize: '13px', color: C.red, fontWeight: 300,
                marginBottom: '16px',
              }}>
                {authError}
              </div>
            )}

            <PrimaryButton style={{ marginTop: 'auto', opacity: 0, animation: 'fadeUp 0.45s ease 0.3s forwards' }} disabled={!step3Ready} loading={loading} onClick={handleCreate}>
              Create my home{' '}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </PrimaryButton>

            <TosLine />
          </div>
        )}

        {/* ══ STEP 4 — Welcome moment ══════════════════════════════════════ */}
        {step === 4 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: '20px 0 40px',
            opacity: 0, animation: 'fadeUp 0.6s ease 0.1s forwards',
          }}>
            <CompleteIcon />

            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 500, color: C.ink, marginBottom: '10px', lineHeight: 1.2 }}>
              Welcome home,
            </div>
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: '26px', color: C.forest, marginBottom: '16px' }}>
              {homeName || suggestion}
            </div>
            <div style={{ fontSize: '14px', color: C.driftwood, fontWeight: 300, lineHeight: 1.7, marginBottom: '36px' }}>
              Your home is ready. <strong style={{ color: C.ink, fontWeight: 400 }}>{firstName}</strong>, you're the admin —<br />
              invite your family whenever you're ready.
            </div>

            <SageCard lastName={lastName} />

            {/* The app's auth listener will navigate to /thisweek once session loads.
                This button just reassures the user — navigation happens automatically. */}
            <PrimaryButton style={{ opacity: 0, animation: 'fadeUp 0.45s ease 0.9s forwards' }}>
              Let's go <ArrowIcon />
            </PrimaryButton>
          </div>
        )}

      </div>
    </div>
  )
}
