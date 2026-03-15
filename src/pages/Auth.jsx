import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { loadAppUser } from '../lib/auth'

export default function Auth({ onSignupComplete }) {
  const [view, setView] = useState('login') // 'login' | 'signup'

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Wordmark */}
        <h1 style={{ fontFamily: "'Slabo 27px', Georgia, serif", fontSize: '36px', fontWeight: 400, color: '#2C2417', textAlign: 'center', marginBottom: '32px' }}>
          Roux.
        </h1>

        {/* Tab switcher */}
        <div className="flex border-b border-stone-200 mb-6">
          <button
            onClick={() => setView('login')}
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              view === 'login'
                ? 'text-stone-900 border-b-2 border-stone-900 -mb-px'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Log in
          </button>
          <button
            onClick={() => setView('signup')}
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              view === 'signup'
                ? 'text-stone-900 border-b-2 border-stone-900 -mb-px'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            Sign up
          </button>
        </div>

        {view === 'login' ? <LoginForm /> : <SignupForm onSignupComplete={onSignupComplete} />}
      </div>
    </div>
  )
}

function LoginForm() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="current-password"
        required
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  )
}

function SignupForm({ onSignupComplete }) {
  const [name, setName]                   = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [error, setError]                 = useState(null)
  const [loading, setLoading]             = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // signUp passes name + household_name as metadata.
      // The handle_new_user database trigger reads these and creates the
      // households and users rows automatically — no client-side RLS issues.
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, household_name: householdName },
        },
      })
      if (signUpErr) throw signUpErr

      if (!data?.session) {
        throw new Error('Check your email to confirm your account, then log in.')
      }

      // Trigger has fired synchronously inside Postgres — rows exist now.
      // Load the users row and hand it to App.
      const appUser = await loadAppUser(data.user.id)
      if (!appUser) throw new Error('Account created but user record not found. Please log in.')
      onSignupComplete(appUser)

    } catch (err) {
      console.error('[signup] error:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field
        label="Your name"
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        autoComplete="name"
        required
      />
      <Field
        label="Household name"
        type="text"
        placeholder="e.g. Your Family Kitchen"
        value={householdName}
        onChange={e => setHouseholdName(e.target.value)}
        required
      />
      <Field
        label="Email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        autoComplete="email"
        required
      />
      <Field
        label="Password"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        autoComplete="new-password"
        minLength={6}
        required
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Creating your household…' : 'Create account'}
      </button>
    </form>
  )
}

function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1">
        {label}
      </label>
      <input
        {...props}
        className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm text-stone-900 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
      />
    </div>
  )
}
