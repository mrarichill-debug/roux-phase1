/**
 * Shared utilities for the welcome/onboarding flow.
 */

// ── Design tokens (inline style values) ────────────────────────────────────
export const C = {
  forest:    '#3D6B4F',
  forestDk:  '#2E5038',
  sage:      '#7A8C6E',
  honey:     '#C49A3C',
  cream:     '#FAF8F4',
  ink:       '#2C2417',
  driftwood: '#8C7B6B',
  linen:     '#E8E0D0',
  walnut:    '#8B6F52',
  red:       '#A03030',
}

// ── Shared container style ──────────────────────────────────────────────────
export const screenWrap = {
  background: C.cream,
  fontFamily: "'Jost', sans-serif",
  fontWeight: 300,
  minHeight: '100vh',
  maxWidth: '430px',
  margin: '0 auto',
  overflowX: 'hidden',
  position: 'relative',
}

// ── Background radial gradient (rendered as a fixed div) ───────────────────
export function BgTexture() {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: `
        radial-gradient(ellipse at 15% 15%, rgba(122,140,110,0.07) 0%, transparent 55%),
        radial-gradient(ellipse at 85% 85%, rgba(196,154,60,0.04) 0%, transparent 50%)
      `,
    }} />
  )
}

// ── Mini wordmark (R + italic oux) ──────────────────────────────────────────
export function MiniWordmark() {
  return (
    <span style={{
      fontFamily: "'Slabo 27px', serif",
      fontSize: '22px', fontWeight: 400,
      color: C.ink, letterSpacing: '-0.5px',
    }}>
      Roux.
    </span>
  )
}

// ── Back button (circular) ─────────────────────────────────────────────────
export function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Back"
      style={{
        width: '38px', height: '38px', borderRadius: '50%',
        border: '1px solid rgba(200,185,160,0.6)',
        background: 'white', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.driftwood,
        boxShadow: '0 1px 4px rgba(80,60,30,0.07)',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}
      onMouseDown={e => e.currentTarget.style.background = C.linen}
      onMouseUp={e => e.currentTarget.style.background = 'white'}
      onTouchStart={e => e.currentTarget.style.background = C.linen}
      onTouchEnd={e => e.currentTarget.style.background = 'white'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>
  )
}

// ── Progress bar ────────────────────────────────────────────────────────────
export function ProgressBar({ step, total }) {
  const pct = step <= total ? Math.round((step / total) * 100) : 100
  const label = step <= total ? `Step ${step} of ${total}` : 'All done ✓'
  return (
    <div style={{ padding: '24px 24px 0', position: 'relative', zIndex: 1, opacity: 0, animation: 'fadeIn 0.4s ease 0.1s forwards' }}>
      <div style={{ height: '3px', background: C.linen, borderRadius: '2px', overflow: 'hidden', marginBottom: '8px' }}>
        <div style={{
          height: '100%', background: C.forest, borderRadius: '2px',
          width: `${pct}%`, transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)',
        }} />
      </div>
      <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwood }}>
        {label}
      </div>
    </div>
  )
}

// ── Nav row (back + wordmark + spacer) ──────────────────────────────────────
export function NavRow({ onBack }) {
  return (
    <div style={{
      position: 'relative', zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '52px 24px 0',
      opacity: 0, animation: 'fadeIn 0.4s ease 0.05s forwards',
    }}>
      <BackButton onClick={onBack} />
      <MiniWordmark />
      <div style={{ width: '38px' }} />
    </div>
  )
}

// ── Primary button ──────────────────────────────────────────────────────────
export function PrimaryButton({ onClick, disabled, loading, children, style = {} }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%', padding: '16px 20px', borderRadius: '14px',
        background: disabled ? C.linen : C.forest,
        color: disabled ? C.driftwood : 'white',
        fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500, letterSpacing: '0.3px',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        boxShadow: disabled ? 'none' : '0 4px 16px rgba(30,55,35,0.25)',
        transition: 'background 0.15s, transform 0.12s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        ...style,
      }}
      onMouseDown={e => !disabled && !loading && (e.currentTarget.style.background = C.forestDk)}
      onMouseUp={e => !disabled && !loading && (e.currentTarget.style.background = C.forest)}
      onTouchStart={e => !disabled && !loading && (e.currentTarget.style.background = C.forestDk)}
      onTouchEnd={e => !disabled && !loading && (e.currentTarget.style.background = C.forest)}
    >
      {loading ? (
        <div style={{
          width: '17px', height: '17px',
          border: '2px solid rgba(255,255,255,0.3)',
          borderTopColor: 'white', borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
      ) : children}
    </button>
  )
}

// ── Password strength hook ──────────────────────────────────────────────────
export function getPasswordStrength(pw) {
  const hasLength  = pw.length >= 8
  const hasNumber  = /\d/.test(pw)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(pw)
  const score = [hasLength, hasNumber, hasSpecial].filter(Boolean).length
  return { hasLength, hasNumber, hasSpecial, score }
}

// ── Password strength UI ────────────────────────────────────────────────────
export function PasswordStrength({ password, visible }) {
  if (!visible || !password) return null
  const { hasLength, hasNumber, hasSpecial, score } = getPasswordStrength(password)
  const barColor = score === 1 ? C.honey : score === 2 ? C.sage : score === 3 ? C.forest : C.linen

  return (
    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', gap: '4px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            flex: 1, height: '3px', borderRadius: '2px',
            background: i <= score ? barColor : C.linen,
            transition: 'background 0.25s',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {[
          { met: hasLength,  label: 'At least 8 characters' },
          { met: hasNumber,  label: 'One number' },
          { met: hasSpecial, label: 'One special character' },
        ].map(({ met, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s', color: met ? C.forest : C.driftwood, fontSize: '11px', fontWeight: 300 }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: met ? C.forest : C.linen, flexShrink: 0, transition: 'background 0.2s' }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Form field ───────────────────────────────────────────────────────────────
export function FormField({ label, error, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, paddingLeft: '2px' }}>
        {label}
      </div>
      {children}
      {hint && !error && <div style={{ fontSize: '11.5px', color: C.driftwood, fontWeight: 300, paddingLeft: '2px', marginTop: '2px', lineHeight: 1.5 }}>{hint}</div>}
      {error && <div style={{ fontSize: '11.5px', color: C.red, fontWeight: 300, paddingLeft: '2px', marginTop: '2px' }}>{error}</div>}
    </div>
  )
}

// ── Input style factory ──────────────────────────────────────────────────────
export function inputStyle({ focused, hasValue, hasError }) {
  let border = `1.5px solid ${C.linen}`
  let boxShadow = 'none'
  if (hasError) { border = `1.5px solid ${C.red}`; boxShadow = '0 0 0 3px rgba(160,48,48,0.08)' }
  else if (focused) { border = `1.5px solid ${C.sage}`; boxShadow = '0 0 0 3px rgba(122,140,110,0.12)' }
  else if (hasValue) { border = `1.5px solid rgba(61,107,79,0.35)` }

  return {
    width: '100%', padding: '14px 16px',
    borderRadius: '12px', border,
    background: 'white', boxShadow,
    fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: C.ink,
    outline: 'none', transition: 'border-color 0.18s, box-shadow 0.18s',
    WebkitAppearance: 'none',
  }
}

// ── Arrow icon ───────────────────────────────────────────────────────────────
export function ArrowIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  )
}

// ── House icon ───────────────────────────────────────────────────────────────
export function HouseIcon({ size = 34, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

// ── ToS line ─────────────────────────────────────────────────────────────────
export function TosLine() {
  return (
    <p style={{ fontSize: '10px', color: C.driftwood, textAlign: 'center', lineHeight: 1.7, marginTop: '12px', fontWeight: 300 }}>
      By continuing you agree to our{' '}
      <a href="#" style={{ color: 'inherit', textDecoration: 'underline' }}>Terms of Service</a>
      {' '}and{' '}
      <a href="#" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy Policy</a>
    </p>
  )
}

// ── Password show/hide toggle ────────────────────────────────────────────────
export function EyeIcon({ visible }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

// ── Step heading block ────────────────────────────────────────────────────────
export function StepHead({ eyebrow, title, sub, animDelay = '0.15s' }) {
  return (
    <div style={{ padding: '32px 0 28px', opacity: 0, animation: `fadeUp 0.45s ease ${animDelay} forwards` }}>
      {eyebrow && (
        <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2.5px', textTransform: 'uppercase', color: C.sage, marginBottom: '8px' }}>
          {eyebrow}
        </div>
      )}
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 500, color: C.ink, lineHeight: 1.25, marginBottom: '8px' }}>
        {title}
      </div>
      {sub && (
        <div style={{ fontSize: '13.5px', color: C.driftwood, fontWeight: 300, lineHeight: 1.6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
