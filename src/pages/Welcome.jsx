import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Welcome.css'

export default function Welcome({ onComplete }) {
  const [mode, setMode] = useState(null) // 'create' or 'join'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const handleCreateHousehold = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1. Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      })

      if (authError) throw authError

      // 2. Generate invite code
      const { data: codeData } = await supabase.rpc('generate_invite_code')
      const inviteCode = codeData

      // 3. Create household
      const { data: household, error: householdError } = await supabase
        .from('households')
        .insert({
          name: householdName,
          invite_code: inviteCode
        })
        .select()
        .single()

      if (householdError) throw householdError

      // 4. Create user profile
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          household_id: household.id,
          name: name,
          preferences: {},
          tutorial_completed: false
        })

      if (userError) throw userError

      onComplete(authData.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleJoinHousehold = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1. Find household by invite code
      const { data: household, error: householdError } = await supabase
        .from('households')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .single()

      if (householdError) throw new Error('Invalid invite code')

      // 2. Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      })

      if (authError) throw authError

      // 3. Create user profile linked to household
      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          household_id: household.id,
          name: name,
          preferences: {},
          tutorial_completed: false
        })

      if (userError) throw userError

      onComplete(authData.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Initial choice screen
  if (!mode) {
    return (
      <div className="welcome-container">
        <div className="welcome-hero">
          <div className="welcome-logo">roux<span className="logo-dot">.</span></div>
          <p className="welcome-tagline">Family meal planning,<br />simplified.</p>
        </div>

        <div className="welcome-choices">
          <button className="choice-card" onClick={() => setMode('create')}>
            <div className="choice-icon">🏠</div>
            <div className="choice-title">Create New Household</div>
            <div className="choice-desc">Start fresh and invite others to join</div>
          </button>

          <button className="choice-card" onClick={() => setMode('join')}>
            <div className="choice-icon">🔗</div>
            <div className="choice-title">Join Existing Household</div>
            <div className="choice-desc">Enter an invite code from your family</div>
          </button>
        </div>

        <p className="welcome-footer">
          Powered by Sage, your AI planning assistant
        </p>
      </div>
    )
  }

  // Create household form
  if (mode === 'create') {
    return (
      <div className="auth-container">
        <button className="btn-ghost back-btn" onClick={() => setMode(null)}>
          ← Back
        </button>

        <div className="auth-header">
          <h1 className="auth-title">Create Your Household</h1>
          <p className="auth-subtitle">Set up Roux for your family</p>
        </div>

        <form onSubmit={handleCreateHousehold} className="auth-form">
          <div className="form-group">
            <label>Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lauren"
              required
            />
          </div>

          <div className="form-group">
            <label>Household Name</label>
            <input
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="Lauren & Aric"
              required
            />
            <span className="form-hint">This is just for you - name it whatever you want</span>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="lauren@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
            <span className="form-hint">At least 6 characters</span>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Create Household'}
          </button>
        </form>
      </div>
    )
  }

  // Join household form
  if (mode === 'join') {
    return (
      <div className="auth-container">
        <button className="btn-ghost back-btn" onClick={() => setMode(null)}>
          ← Back
        </button>

        <div className="auth-header">
          <h1 className="auth-title">Join a Household</h1>
          <p className="auth-subtitle">Enter the invite code from your family member</p>
        </div>

        <form onSubmit={handleJoinHousehold} className="auth-form">
          <div className="form-group">
            <label>Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aric"
              required
            />
          </div>

          <div className="form-group">
            <label>Invite Code</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="ROUX-1234"
              required
              style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontSize: '1.1rem' }}
            />
            <span className="form-hint">Ask your family member for their invite code</span>
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aric@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
            <span className="form-hint">At least 6 characters</span>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Join Household'}
          </button>
        </form>
      </div>
    )
  }
}
