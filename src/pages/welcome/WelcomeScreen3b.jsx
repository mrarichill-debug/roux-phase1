import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  C, BgTexture, NavRow, ProgressBar, screenWrap,
  StepHead, FormField, inputStyle, PrimaryButton,
  PasswordStrength, getPasswordStrength, ArrowIcon, TosLine, EyeIcon,
} from './welcomeUtils'

// ── Role data ─────────────────────────────────────────────────────────────────
const ROLES = [
  {
    key: 'admin',
    title: 'Co-admin',
    desc: 'Full access — meal planning, shopping list, budget. Same as the admin.',
    badge: 'Admin',
    badgeBg: 'rgba(61,107,79,0.1)', badgeColor: C.forest,
    pillBg: 'rgba(61,107,79,0.1)', pillColor: C.forest,
    sub: 'You can see the full meal plan, shopping list, and budget.',
    dbRole: 'co_admin',
  },
  {
    key: 'member',
    title: 'Family member',
    desc: 'See the meal plan, mark favorites, request meals. No budget access.',
    badge: 'Member',
    badgeBg: 'rgba(196,154,60,0.1)', badgeColor: C.honey,
    pillBg: 'rgba(196,154,60,0.1)', pillColor: C.honey,
    sub: 'You can see the meal plan, mark favorites, and request meals. Budget info stays with the admin.',
    dbRole: 'member_admin',
  },
  {
    key: 'child',
    title: 'Just browsing',
    desc: 'See what\'s for dinner. Perfect for kids or light viewers.',
    badge: 'View only',
    badgeBg: 'rgba(122,140,110,0.1)', badgeColor: C.sage,
    pillBg: 'rgba(122,140,110,0.1)', pillColor: C.sage,
    sub: 'You can see what\'s for dinner and mark your favorites. Simple and easy.',
    dbRole: 'member_viewer',
  },
]

// ── Role card ────────────────────────────────────────────────────────────────
function RoleCard({ role, selected, onClick, delay }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', background: selected ? 'rgba(61,107,79,0.02)' : 'white',
        border: `1.5px solid ${selected ? C.forest : 'rgba(200,185,160,0.5)'}`,
        borderRadius: '14px', padding: '16px 18px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '14px',
        textAlign: 'left', transition: 'all 0.18s',
        boxShadow: selected ? `0 0 0 3px rgba(61,107,79,0.1)` : 'none',
        opacity: 0, animation: `fadeUp 0.45s ease ${delay} forwards`,
      }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.985)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onTouchStart={e => e.currentTarget.style.transform = 'scale(0.985)'}
      onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {/* Radio */}
      <div style={{
        width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${selected ? C.forest : C.linen}`,
        background: selected ? C.forest : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        {selected && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'white' }} />}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: C.ink, marginBottom: '3px' }}>{role.title}</div>
        <div style={{ fontSize: '12px', color: C.driftwood, fontWeight: 300, lineHeight: 1.4 }}>{role.desc}</div>
      </div>

      {/* Badge */}
      <div style={{
        fontSize: '9px', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase',
        padding: '3px 8px', borderRadius: '10px', flexShrink: 0,
        background: role.badgeBg, color: role.badgeColor,
      }}>
        {role.badge}
      </div>
    </button>
  )
}

export default function WelcomeScreen3b() {
  const navigate = useNavigate()
  const [step, setStep]           = useState(1)
  const [code, setCode]           = useState('')
  const [codeStatus, setCodeStatus] = useState('idle') // idle | valid | error
  const [householdId, setHouseholdId] = useState(null)
  const [homeName, setHomeName]   = useState('')
  const [invitedBy, setInvitedBy] = useState('')
  const [selectedRole, setSelectedRole] = useState(null)
  const [joinName, setJoinName]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [pwVisible, setPwVisible] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [authError, setAuthError] = useState('')
  const [focusedField, setFocusedField] = useState(null)

  const firstInputRef = useRef(null)
  useEffect(() => {
    if (step <= 3) {
      const t = setTimeout(() => firstInputRef.current?.focus(), 350)
      return () => clearTimeout(t)
    }
  }, [step])

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const { score: pwScore } = getPasswordStrength(password)
  const step3Ready = joinName.trim() && emailValid && pwScore === 3

  function goStep(n) {
    setStep(n)
    setAuthError('')
  }

  function handleBack() {
    if (step > 1) goStep(step - 1)
    else navigate('/get-started')
  }

  function onCodeChange(e) {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    setCode(val)
    setCodeStatus('idle')
  }

  async function verifyCode() {
    if (code.length !== 6) return
    setLoading(true)
    setCodeStatus('idle')
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (data.error || !data.householdId) {
        setCodeStatus('error')
      } else {
        setHouseholdId(data.householdId)
        setHomeName(data.homeName || '')
        setInvitedBy(data.invitedBy || '')
        setCodeStatus('valid')
      }
    } catch {
      setCodeStatus('error')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!householdId || !selectedRole) return
    setLoading(true)
    setAuthError('')
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: joinName.trim() } },
      })
      if (error) throw error

      const session = data.session
      if (session) {
        // Set user's household and membership to pending
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', data.user.id)
          .maybeSingle()

        if (userData) {
          await supabase.from('users').update({
            household_id: householdId,
            membership_status: 'pending',
            role: selectedRole === 'admin' ? 'co_admin' : selectedRole === 'viewer' ? 'member_viewer' : 'member_admin',
          }).eq('id', userData.id)

          // Find the admin to send notification
          const { data: admin } = await supabase
            .from('users')
            .select('id')
            .eq('household_id', householdId)
            .eq('role', 'admin')
            .maybeSingle()

          if (admin) {
            await supabase.from('notifications').insert({
              household_id: householdId,
              user_id: admin.id,
              type: 'membership_request',
              title: `${joinName.trim()} wants to join your kitchen`,
              body: `Approve or decline their request to join as ${selectedRole === 'admin' ? 'Co-admin' : selectedRole === 'viewer' ? 'View only' : 'Family member'}.`,
              action_type: 'membership_approval',
              target_id: userData.id,
            })
          }
        }
      }
      goStep(4)
    } catch (err) {
      setAuthError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function fieldInput(name, value, opts = {}) {
    return inputStyle({ focused: focusedField === name, hasValue: value.length > 0, hasError: opts.hasError || false })
  }

  const role = ROLES.find(r => r.key === selectedRole)

  return (
    <div style={screenWrap}>
      <BgTexture />
      <NavRow onBack={handleBack} />
      <ProgressBar step={step <= 3 ? step : 3} total={3} />

      <div style={{ position: 'relative', zIndex: 1, padding: '0 28px 48px', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 140px)' }}>

        {/* ══ STEP 1 — Invite code ══════════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHead eyebrow="Join a home" title="Enter your invite code." sub="Ask the admin of your home — they can find the code in their Roux settings." />

            {/* Code entry */}
            <div style={{ opacity: 0, animation: 'fadeUp 0.45s ease 0.22s forwards', marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '8px' }}>
                Invite code
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={firstInputRef}
                  type="text" value={code}
                  placeholder="· · · · · ·"
                  maxLength={6}
                  onChange={onCodeChange}
                  onKeyDown={e => e.key === 'Enter' && code.length === 6 && verifyCode()}
                  style={{
                    flex: 1, padding: '16px 14px', textAlign: 'center',
                    borderRadius: '12px',
                    border: `1.5px solid ${codeStatus === 'valid' ? C.forest : codeStatus === 'error' ? C.red : C.linen}`,
                    background: 'white',
                    fontFamily: "'Jost', sans-serif", fontSize: '22px', fontWeight: 500, color: C.ink,
                    letterSpacing: '6px', outline: 'none',
                    boxShadow: codeStatus === 'valid' ? `0 0 0 3px rgba(61,107,79,0.1)` : codeStatus === 'error' ? `0 0 0 3px rgba(160,48,48,0.08)` : 'none',
                    transition: 'border-color 0.18s, box-shadow 0.18s',
                  }}
                />
                <button
                  onClick={verifyCode}
                  disabled={code.length !== 6 || loading}
                  style={{
                    padding: '14px 18px', borderRadius: '12px',
                    background: code.length === 6 ? C.forest : C.linen,
                    color: code.length === 6 ? 'white' : C.driftwood,
                    fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 500,
                    border: 'none', cursor: code.length === 6 ? 'pointer' : 'default',
                    whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  {loading ? '…' : 'Look up'}
                </button>
              </div>
              <div style={{ fontSize: '11.5px', color: C.driftwood, fontWeight: 300, marginTop: '8px', lineHeight: 1.5 }}>
                Your code is 6 characters — like HILL01. Not case sensitive.
              </div>
              {codeStatus === 'error' && (
                <div style={{ fontSize: '11.5px', color: C.red, fontWeight: 300, marginTop: '6px' }}>
                  That code didn't match any home. Double-check with your admin.
                </div>
              )}
            </div>

            {/* Invite card — shown after valid lookup */}
            {codeStatus === 'valid' && (
              <div style={{
                background: 'white', border: `1px solid rgba(200,185,160,0.5)`,
                borderRadius: '18px', padding: '24px 22px', marginBottom: '24px',
                textAlign: 'center', boxShadow: '0 2px 12px rgba(80,60,30,0.07)',
                position: 'relative', overflow: 'hidden',
                opacity: 0, animation: 'fadeUp 0.5s ease 0.05s forwards',
              }}>
                {/* Top accent */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${C.sage}, ${C.forest})` }} />
                {invitedBy && (
                  <div style={{ fontSize: '11px', fontWeight: 400, color: C.driftwood, letterSpacing: '0.3px', marginBottom: '10px' }}>
                    <strong style={{ color: C.ink, fontWeight: 500 }}>{invitedBy}</strong> invited you to join
                  </div>
                )}
                <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.sage, marginBottom: '6px' }}>
                  Your new home
                </div>
                <div style={{ fontFamily: "'Caveat', cursive", fontSize: '28px', color: C.forest, lineHeight: 1.2, marginBottom: '12px' }}>
                  {homeName}
                </div>
                <div style={{ fontSize: '13px', color: C.driftwood, fontWeight: 300, fontStyle: 'italic', lineHeight: 1.5 }}>
                  Plan meals together, shop smarter.
                </div>
              </div>
            )}

            <PrimaryButton
              style={{ marginTop: 'auto', opacity: 0, animation: 'fadeUp 0.45s ease 0.3s forwards' }}
              disabled={codeStatus !== 'valid'}
              onClick={() => goStep(2)}
            >
              Accept Invitation <ArrowIcon />
            </PrimaryButton>
          </div>
        )}

        {/* ══ STEP 2 — Role selection ═══════════════════════════════════════ */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHead eyebrow="Your role" title="How will you use Roux?" sub="This sets what you can see and do. The admin can adjust this later." />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {ROLES.map((r, i) => (
                <RoleCard
                  key={r.key}
                  role={r}
                  selected={selectedRole === r.key}
                  onClick={() => setSelectedRole(r.key)}
                  delay={`${0.22 + i * 0.08}s`}
                />
              ))}
            </div>

            <PrimaryButton
              style={{ marginTop: 'auto', opacity: 0, animation: 'fadeUp 0.45s ease 0.46s forwards' }}
              disabled={!selectedRole}
              onClick={() => goStep(3)}
            >
              Continue <ArrowIcon />
            </PrimaryButton>
          </div>
        )}

        {/* ══ STEP 3 — Create account ═══════════════════════════════════════ */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <StepHead eyebrow="Almost in" title="Create your login." sub="Quick — just your name, email, and a password." />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px', opacity: 0, animation: 'fadeUp 0.45s ease 0.22s forwards' }}>
              <FormField label="Your name">
                <input
                  ref={firstInputRef}
                  type="text" value={joinName} placeholder="Your name"
                  autoComplete="given-name"
                  style={fieldInput('name', joinName)}
                  onChange={e => setJoinName(e.target.value)}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </FormField>

              <FormField label="Email">
                <input
                  type="email" value={email} placeholder="you@example.com"
                  autoComplete="email"
                  style={fieldInput('email', email)}
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
                    style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.driftwood, padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    <EyeIcon visible={pwVisible} />
                  </button>
                </div>
                <PasswordStrength password={password} visible={password.length > 0} />
              </FormField>
            </div>

            {authError && (
              <div style={{ background: 'rgba(160,48,48,0.07)', border: `1px solid rgba(160,48,48,0.2)`, borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: C.red, fontWeight: 300, marginBottom: '16px' }}>
                {authError}
              </div>
            )}

            <PrimaryButton
              style={{ marginTop: 'auto', opacity: 0, animation: 'fadeUp 0.45s ease 0.3s forwards' }}
              disabled={!step3Ready} loading={loading}
              onClick={handleJoin}
            >
              Join the kitchen{' '}
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </PrimaryButton>

            <TosLine />
          </div>
        )}

        {/* ══ STEP 4 — Welcome moment ═══════════════════════════════════════ */}
        {step === 4 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 0 40px', opacity: 0, animation: 'fadeUp 0.6s ease 0.1s forwards' }}>
            {/* People icon */}
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(61,107,79,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', animation: 'iconPop 0.5s cubic-bezier(0.22,1,0.36,1) 0.3s both' }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>

            {invitedBy && (
              <div style={{ fontSize: '12px', color: C.driftwood, fontWeight: 300, marginBottom: '6px' }}>
                Invited by {invitedBy}
              </div>
            )}
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 500, color: C.ink, marginBottom: '6px', lineHeight: 1.2 }}>
              You're in.
            </div>
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: '26px', color: C.forest, marginBottom: '16px' }}>
              {homeName}
            </div>

            {role && (
              <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', padding: '6px 14px', borderRadius: '20px', marginBottom: '20px', display: 'inline-block', background: role.pillBg, color: role.pillColor }}>
                {role.title}
              </div>
            )}

            {role && (
              <div style={{ fontSize: '13.5px', color: C.driftwood, fontWeight: 300, lineHeight: 1.7, marginBottom: '32px' }}>
                {role.sub}
              </div>
            )}

            {/* App auth listener routes automatically. Button as reassurance. */}
            <PrimaryButton style={{ opacity: 0, animation: 'fadeUp 0.45s ease 0.5s forwards', marginTop: 0 }}>
              See the kitchen <ArrowIcon />
            </PrimaryButton>
          </div>
        )}

      </div>
    </div>
  )
}
