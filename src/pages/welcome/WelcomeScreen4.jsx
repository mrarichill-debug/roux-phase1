import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { BgTexture, NavRow, screenWrap, inputStyle, EyeIcon } from './welcomeUtils'
import { color, alpha, elevation } from '../../styles/tokens'

export default function WelcomeScreen4() {
  const navigate = useNavigate()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [pwVisible, setPwVisible] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [successName, setSuccessName] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent]   = useState(false)
  const [focusedField, setFocusedField] = useState(null)

  const forgotInputRef = useRef(null)

  const canSubmit = email.trim() && password.length > 0

  function clearError() {
    if (error) setError('')
  }

  async function signIn() {
    if (!canSubmit || loading) return
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password })
      if (error) throw error
      // Derive first name for success greeting
      const name = data?.user?.user_metadata?.first_name
        || data?.user?.user_metadata?.name?.split(' ')[0]
        || email.split('@')[0]
      setSuccessName(name.charAt(0).toUpperCase() + name.slice(1))
      setSuccess(true)
      setTimeout(() => navigate('/'), 1200)
    } catch (e) {
      setError('That email and password don\'t match. Try again, or reset your password below.')
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  async function sendReset() {
    if (!forgotEmail) return
    await supabase.auth.resetPasswordForEmail(forgotEmail.trim())
    setForgotSent(true)
  }

  function toggleForgot() {
    const nowOpen = !forgotOpen
    setForgotOpen(nowOpen)
    if (nowOpen) {
      setForgotEmail(email)
      setForgotSent(false)
      setTimeout(() => forgotInputRef.current?.focus(), 150)
    }
  }

  function fieldStyle(name, value, hasErr = false) {
    return inputStyle({ focused: focusedField === name, hasValue: value.length > 0, hasError: hasErr })
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ ...screenWrap, display: 'flex', flexDirection: 'column' }}>
        <BgTexture />
        <div style={{
          position: 'relative', zIndex: 1, flex: 1,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', padding: '0 28px 48px',
          opacity: 0, animation: 'fadeUp 0.5s ease forwards' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(61,107,79,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
            animation: 'iconPop 0.4s cubic-bezier(0.22,1,0.36,1) 0.1s both' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color.forest} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 500, color: color.ink, marginBottom: '6px' }}>
            Good to see you,
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 500, fontStyle: 'italic', color: color.forest, marginBottom: '14px' }}>
            {successName}
          </div>
          <div style={{ fontSize: '13.5px', color: color.inkSoft, fontWeight: 300 }}>
            Taking you to your kitchen…
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={screenWrap}>
      <BgTexture />

      <NavRow onBack={() => navigate('/')} />

      <div style={{ position: 'relative', zIndex: 1, padding: '0 28px 48px', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 110px)' }}>

        {/* Heading */}
        <div style={{ padding: '44px 0 36px', opacity: 0, animation: 'fadeUp 0.5s ease 0.12s forwards' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '30px', fontWeight: 500, color: color.ink, lineHeight: 1.2, marginBottom: '8px' }}>
            Welcome back.
          </div>
          <div style={{ fontSize: '13.5px', color: color.inkSoft, fontWeight: 300, lineHeight: 1.6 }}>
            Sign in to your kitchen.
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '10px', opacity: 0, animation: 'fadeUp 0.5s ease 0.2s forwards' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: color.inkSoft, paddingLeft: '2px' }}>Email</div>
            <input
              type="email" value={email} placeholder="you@example.com"
              autoComplete="email"
              style={fieldStyle('email', email, !!(error))}
              onChange={e => { setEmail(e.target.value); clearError() }}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
              onKeyDown={e => e.key === 'Enter' && signIn()}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: color.inkSoft, paddingLeft: '2px' }}>Password</div>
            <div style={{ position: 'relative' }}>
              <input
                type={pwVisible ? 'text' : 'password'}
                value={password} placeholder="Your password"
                autoComplete="current-password"
                style={{ ...fieldStyle('pw', password, !!(error)), paddingRight: '44px' }}
                onChange={e => { setPassword(e.target.value); clearError() }}
                onFocus={() => setFocusedField('pw')}
                onBlur={() => setFocusedField(null)}
                onKeyDown={e => e.key === 'Enter' && signIn()}
              />
              <button
                type="button"
                onClick={() => setPwVisible(v => !v)}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: color.inkSoft, padding: '4px', display: 'flex', alignItems: 'center' }}
              >
                <EyeIcon visible={pwVisible} />
              </button>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div style={{
            background: 'rgba(160,48,48,0.07)', border: `1px solid rgba(160,48,48,0.2)`,
            borderRadius: '10px', padding: '11px 14px',
            fontSize: '13px', color: color.rust, fontWeight: 300,
            marginBottom: '16px',
            animation: 'fadeUp 0.3s ease forwards' }}>
            {error}
          </div>
        )}

        {/* Sign in button */}
        <button
          onClick={signIn}
          disabled={!canSubmit || loading}
          style={{
            width: '100%', padding: '16px 20px', borderRadius: '14px',
            background: canSubmit ? color.forest : color.rule,
            color: canSubmit ? 'white' : color.inkSoft,
            fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500, letterSpacing: '0.3px',
            border: 'none', cursor: canSubmit ? 'pointer' : 'default',
            boxShadow: canSubmit ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
            transition: 'background 0.15s, transform 0.12s',
            marginTop: '24px', marginBottom: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            opacity: 0, animation: 'fadeUp 0.5s ease 0.28s forwards' }}
          onMouseDown={e => canSubmit && !loading && (e.currentTarget.style.background = color.forestDark)}
          onMouseUp={e => canSubmit && !loading && (e.currentTarget.style.background = color.forest)}
          onTouchStart={e => canSubmit && !loading && (e.currentTarget.style.background = color.forestDark)}
          onTouchEnd={e => canSubmit && !loading && (e.currentTarget.style.background = color.forest)}
        >
          {loading ? (
            <div style={{ width: '17px', height: '17px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          ) : 'Sign in'}
        </button>

        {/* Forgot password link */}
        <div style={{ textAlign: 'center', marginTop: '8px', opacity: 0, animation: 'fadeUp 0.5s ease 0.33s forwards' }}>
          <button
            type="button"
            onClick={toggleForgot}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300, color: color.inkSoft,
              padding: '6px', textDecoration: 'underline',
              textUnderlineOffset: '3px', textDecorationColor: 'rgba(140,123,107,0.3)' }}
          >
            Forgot your password?
          </button>
        </div>

        {/* Forgot password panel */}
        {forgotOpen && (
          <div style={{
            background: 'white', border: `1px solid ${color.rule}`,
            borderRadius: '14px', padding: '20px 18px',
            marginTop: '16px',
            boxShadow: '0 2px 10px rgba(80,60,30,0.07)',
            animation: 'fadeUp 0.3s ease forwards' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: color.ink, marginBottom: '6px' }}>
              Reset your password
            </div>
            <div style={{ fontSize: '12px', color: color.inkSoft, fontWeight: 300, marginBottom: '12px', lineHeight: 1.5 }}>
              Enter your email and we'll send a reset link.
            </div>
            {!forgotSent ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  ref={forgotInputRef}
                  type="email" value={forgotEmail}
                  placeholder="Your email"
                  onChange={e => setForgotEmail(e.target.value)}
                  style={{
                    flex: 1, padding: '11px 14px', borderRadius: '10px',
                    border: `1.5px solid ${color.rule}`, background: color.paper,
                    fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 300, color: color.ink,
                    outline: 'none', transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = color.sage}
                  onBlur={e => e.target.style.borderColor = color.rule}
                />
                <button
                  onClick={sendReset}
                  style={{
                    padding: '11px 16px', borderRadius: '10px',
                    background: color.forest, color: 'white',
                    fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 500,
                    border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'background 0.15s' }}
                  onMouseDown={e => e.currentTarget.style.background = color.forestDark}
                  onMouseUp={e => e.currentTarget.style.background = color.forest}
                >
                  Send
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: color.forest, fontWeight: 300 }}>
                Check your inbox — link sent.
              </div>
            )}
          </div>
        )}

        {/* Bottom — new to Roux */}
        <div style={{
          marginTop: 'auto', paddingTop: '40px', textAlign: 'center',
          opacity: 0, animation: 'fadeIn 0.5s ease 0.5s forwards' }}>
          <div style={{ fontSize: '12.5px', color: color.inkSoft, fontWeight: 300 }}>
            New to Roux?{' '}
            <button
              onClick={() => navigate('/get-started')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Jost', sans-serif", fontSize: '12.5px', fontWeight: 400, color: color.forest,
                padding: 0, borderBottom: `1px solid rgba(61,107,79,0.25)`, paddingBottom: '1px' }}
            >
              Get started
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
