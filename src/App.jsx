import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { supabase, hasTutorialCompleted } from './lib/supabase'
import Welcome from './pages/Welcome'
import Tutorial from './pages/Tutorial'
import ThisWeek from './pages/ThisWeek'
import Planner from './pages/Planner'
import Recipes from './pages/Recipes'
import Shopping from './pages/Shopping'
import SageChat from './pages/SageChat'
import './styles/global.css'

// Bottom Navigation Component
function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bottom-nav">
      <button
        className={`nav-item ${isActive('/thisweek') ? 'active' : ''}`}
        onClick={() => navigate('/thisweek')}
      >
        <div className="nav-icon">✦</div>
        <div className="nav-label">This Week</div>
      </button>

      <button
        className={`nav-item ${isActive('/planner') ? 'active' : ''}`}
        onClick={() => navigate('/planner')}
      >
        <div className="nav-icon">📅</div>
        <div className="nav-label">Planner</div>
      </button>

      <button
        className={`nav-item ${isActive('/sage') ? 'active' : ''}`}
        onClick={() => navigate('/sage')}
      >
        <div className="nav-icon">🌿</div>
        <div className="nav-label">Sage</div>
      </button>

      <button
        className={`nav-item ${isActive('/recipes') ? 'active' : ''}`}
        onClick={() => navigate('/recipes')}
      >
        <div className="nav-icon">📖</div>
        <div className="nav-label">Recipes</div>
      </button>

      <button
        className={`nav-item ${isActive('/shopping') ? 'active' : ''}`}
        onClick={() => navigate('/shopping')}
      >
        <div className="nav-icon">🛒</div>
        <div className="nav-label">Shopping</div>
      </button>
    </nav>
  )
}

// Main App Layout
function AppLayout({ children }) {
  return (
    <>
      <div className="app-content">{children}</div>
      <BottomNav />
    </>
  )
}

// Main App Component
function App() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [needsTutorial, setNeedsTutorial] = useState(false)

  useEffect(() => {
    // Check initial auth state
    const checkAuth = async () => {
      const {
        data: { user: currentUser }
      } = await supabase.auth.getUser()

      if (currentUser) {
        setUser(currentUser)
        // Check if tutorial is completed
        const tutorialDone = await hasTutorialCompleted(currentUser.id)
        setNeedsTutorial(!tutorialDone)
      }
      setLoading(false)
    }

    checkAuth()

    // Listen for auth changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        const tutorialDone = await hasTutorialCompleted(session.user.id)
        setNeedsTutorial(!tutorialDone)
      } else {
        setUser(null)
        setNeedsTutorial(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleWelcomeComplete = (newUser) => {
    setUser(newUser)
    setNeedsTutorial(true)
  }

  const handleTutorialComplete = () => {
    setNeedsTutorial(false)
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
        <div style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>Loading Roux...</div>
      </div>
    )
  }

  // Not logged in - show welcome
  if (!user) {
    return <Welcome onComplete={handleWelcomeComplete} />
  }

  // Logged in but needs tutorial
  if (needsTutorial) {
    return <Tutorial user={user} onComplete={handleTutorialComplete} />
  }

  // Logged in and tutorial complete - show main app
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/planner" replace />} />
        <Route
          path="/thisweek"
          element={
            <AppLayout>
              <ThisWeek />
            </AppLayout>
          }
        />
        <Route
          path="/planner"
          element={
            <AppLayout>
              <Planner />
            </AppLayout>
          }
        />
        <Route
          path="/recipes"
          element={
            <AppLayout>
              <Recipes />
            </AppLayout>
          }
        />
        <Route
          path="/shopping"
          element={
            <AppLayout>
              <Shopping />
            </AppLayout>
          }
        />
        <Route
          path="/sage"
          element={
            <AppLayout>
              <SageChat />
            </AppLayout>
          }
        />
        <Route path="*" element={<Navigate to="/planner" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
