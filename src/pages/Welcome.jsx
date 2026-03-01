import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Welcome.css'

export default function Welcome({ onComplete }) {
  const [mode, setMode] = useState(null) // 'create' or 'join'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [inviteCode, setGeneratedInviteCode] = useState(null)
  const [showInviteCode, setShowInviteCode] = useState(false)

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [joinInviteCode, setJoinInviteCode] = useState('')

  const handleCreateHousehold = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.log('Step 1: Generating invite code...')
      // 1. Generate invite code first
      const { data: codeData, error: codeError } = await supabase.rpc('generate_invite_code')
      if (codeError) {
        console.error('Invite code error:', codeError)
        throw codeError
      }
      const newInviteCode = codeData
      console.log('Invite code generated:', newInviteCode)

      console.log('Step 2: Signing up user...')
      // 2. Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      })

      if (authError) {
        console.error('Auth error:', authError)
        throw authError
      }
      if (!authData.user) throw new Error('User creation failed')
      console.log('User signed up:', authData.user.id)

      console.log('Step 3: Creating household...')
      // 3. Create household
      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .insert({
          name: householdName,
          invite_code: newInviteCode
        })
        .select()

      if (householdError) {
        console.error('Household error:', householdError)
        throw householdError
      }
      
      if (!householdData || householdData.length === 0) {
        throw new Error('Household was created but no data returned')
      }
      
      const household = householdData[0]
      console.log('Household created:', household.id)

      console.log('Step 4: Creating user profile...')
      // 4. Create user profile
      const { data: userDataArray, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          household_id: household.id,
          name: name,
          preferences: {},
          tutorial_completed: false
        })
        .select()

      if (userError) {
        console.error('User profile error:', userError)
        throw new Error(`Failed to create user profile: ${userError.message}`)
      }
      
      if (!userDataArray || userDataArray.length === 0) {
        throw new Error('User profile was created but no data returned')
      }
      
      const userData = userDataArray[0]
      console.log('User profile created:', userData)

      // 5. Show invite code to user
      setGeneratedInviteCode(newInviteCode)
      setShowInviteCode(true)
      setLoading(false)

    } catch (err) {
      console.error('Household creation error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const handleJoinHousehold = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.log('Step 1: Finding household with code:', joinInviteCode)
      // 1. Find household by invite code
      const { data: household, error: householdError } = await supabase
        .from('households')
        .select('*')
        .eq('invite_code', joinInviteCode.toUpperCase())
        .single()

      if (householdError) {
        console.error('Household lookup error:', householdError)
        throw new Error('Invalid invite code')
      }
      console.log('Household found:', household.id)

      console.log('Step 2: Signing up user...')
      // 2. Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password
      })

      if (authError) {
        console.error('Auth error:', authError)
        throw authError
      }
      if (!authData.user) throw new Error('User creation failed')
      console.log('User signed up:', authData.user.id)

      console.log('Step 3: Creating user profile...')
      // 3. Create user profile linked to household
      const { data: userDataArray, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          household_id: household.id,
          name: name,
          preferences: {},
          tutorial_completed: false
        })
        .select()

      if (userError) {
        console.error('User profile error:', userError)
        throw new Error(`Failed to create user profile: ${userError.message}`)
      }
      
      if (!userDataArray || userDataArray.length === 0) {
        throw new Error('User profile was created but no data returned')
      }
      
      const userData = userDataArray[0]
      console.log('User profile created:', userData)

      setLoading(false)
      onComplete(authData.user)
    } catch (err) {
      console.error('Join household error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Login failed')

      onComplete(authData.user)
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message === 'Invalid login credentials' ? 'Invalid email or password' : err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleContinueAfterInvite = () => {
    setShowInviteCode(false)
    // User is already created, just trigger the completion flow
    window.location.reload() // Simple way to trigger auth state update
  }

  // Show invite code after household creation
  if (showInviteCode && inviteCode) {
    return (
      <div className="invite-code-display">
        <div className="invite-hero">
          <div className="invite-icon">✓</div>
          <h1 className="invite-title">Household Created!</h1>
          <p className="invite-subtitle">Share this code with your family members so they can join</p>
        </div>

        <div className="invite-code-box">
          <div className="invite-label">Your Invite Code</div>
          <div className="invite-code">{inviteCode}</div>
          <button 
            className="btn btn-ghost"
            onClick={() => {
              navigator.clipboard.writeText(inviteCode)
              alert('Copied to clipboard!')
            }}
          >
            Copy Code
          </button>
        </div>

        <div className="invite-instructions">
          <p>Your family members can join by:</p>
          <ol>
            <li>Opening Roux on their phone</li>
            <li>Tapping "Join Existing Household"</li>
            <li>Entering this code: <strong>{inviteCode}</strong></li>
          </ol>
        </div>

        <button className="btn btn-primary btn-full" onClick={handleContinueAfterInvite}>
          Continue to Roux →
        </button>
      </div>
    )
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
            <div className="choice-content">
              <div className="choice-title">Create New Household</div>
              <div className="choice-desc">Start fresh and invite others to join</div>
            </div>
          </button>

          <button className="choice-card" onClick={() => setMode('join')}>
            <div className="choice-icon">🔗</div>
            <div className="choice-content">
              <div className="choice-title">Join Existing Household</div>
              <div className="choice-desc">Enter an invite code from your family</div>
            </div>
          </button>

          <button className="choice-card" onClick={() => setMode('login')}>
            <div className="choice-icon">👤</div>
            <div className="choice-content">
              <div className="choice-title">Log In</div>
              <div className="choice-desc">Already have an account? Sign in here</div>
            </div>
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
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="password-input"
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
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
              value={joinInviteCode}
              onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
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
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="password-input"
              />
              <button 
                type="button" 
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
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

  // Login form
  if (mode === 'login') {
    return (
      <div className="auth-container">
        <button className="btn-ghost back-btn" onClick={() => setMode(null)}>
          ← Back
        </button>

        <div className="auth-header">
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Log in to your household</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="password-input"
                autoComplete="current-password"
              />
              <button 
                type="button" 
                className="password-toggle"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setShowPassword(!showPassword)
                }}
                tabIndex={-1}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Log In'}
          </button>
        </form>
      </div>
    )
  }
}
