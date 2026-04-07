import { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
// SageChat removed — Sage interactions are structured, not chat-based
import Family from '../pages/Family'

// BrowserRouter lives in App.jsx — Shell just uses the router context
export function Shell({ appUser }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const menuItems = [
    { label: 'Home',          path: '/',          icon: <CalendarIcon /> },
    { label: 'Plan',           path: '/plan',      icon: <CalendarIcon /> },
    { label: 'Meals',         path: '/meals',     icon: <RecipesIcon /> },
    { label: 'Shop',   path: '/shop',    icon: <ShoppingIcon /> },
    // Sage removed from drawer — accessed via topbar sparkle icon
    { label: 'Family',        path: '/family',    icon: <FamilyIcon /> },
  ]

  function go(path) {
    navigate(path)
    setDrawerOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col">

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <header className="h-14 bg-white shadow-[0_1px_0_0_#e7e5e4] flex items-center px-4 relative z-30 shrink-0">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 -ml-2 text-stone-500 hover:text-stone-800 transition-colors"
          aria-label="Open menu"
        >
          <HamburgerIcon />
        </button>

        <span className="absolute left-1/2 -translate-x-1/2 font-display text-2xl font-light tracking-wide text-stone-800 select-none">
          Roux
        </span>
      </header>

      {/* ── Page content ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Routes>
          {/* /sage route removed */}
          <Route path="/family"   element={<Family     appUser={appUser} />} />
        </Routes>
      </main>

      {/* ── Backdrop ─────────────────────────────────────────────── */}
      <div
        onClick={() => setDrawerOpen(false)}
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* ── Drawer ───────────────────────────────────────────────── */}
      <div className={`fixed top-0 left-0 h-full w-72 bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
        drawerOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>

        {/* Drawer header */}
        <div className="h-14 flex items-center justify-between px-5 shadow-[0_1px_0_0_#e7e5e4] shrink-0">
          <span className="font-display text-2xl font-light tracking-wide text-stone-800 select-none">
            Roux
          </span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-2 -mr-2 text-stone-400 hover:text-stone-700 transition-colors"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {menuItems.map(item => {
            const active = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-left text-sm font-medium mb-0.5 transition-colors ${
                  active
                    ? 'bg-stone-100 text-stone-900'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
                }`}
              >
                <span className={active ? 'text-stone-700' : 'text-stone-400'}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* User info + sign out */}
        <div className="px-5 py-5 shadow-[0_-1px_0_0_#e7e5e4] shrink-0">
          <p className="text-sm font-medium text-stone-800 leading-tight">{appUser.name}</p>
          <p className="text-xs text-stone-400 mt-0.5">{appUser.email}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-3 text-xs text-stone-400 hover:text-stone-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

    </div>
  )
}


// ── Icons ─────────────────────────────────────────────────────────────────────

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="3" y1="6"  x2="19" y2="6"  />
      <line x1="3" y1="11" x2="19" y2="11" />
      <line x1="3" y1="16" x2="19" y2="16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="4" y1="4" x2="16" y2="16" />
      <line x1="16" y1="4" x2="4"  y2="16" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="14" height="14" rx="2" />
      <line x1="3"  y1="8.5" x2="17" y2="8.5" />
      <line x1="7"  y1="2"   x2="7"  y2="6"   />
      <line x1="13" y1="2"   x2="13" y2="6"   />
    </svg>
  )
}

function RecipesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <line x1="7"  y1="7"  x2="13" y2="7"  />
      <line x1="7"  y1="10" x2="13" y2="10" />
      <line x1="7"  y1="13" x2="10" y2="13" />
    </svg>
  )
}

function ShoppingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h2l2.5 8h7l2-5.5H6.5" />
      <circle cx="9"  cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2 L11.5 7.5 L17 9 L11.5 10.5 L10 16 L8.5 10.5 L3 9 L8.5 7.5 Z" />
    </svg>
  )
}

function FamilyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7"  cy="6"  r="2.5" />
      <circle cx="13" cy="7"  r="2"   />
      <path d="M2 17c0-3 2.2-5 5-5s5 2 5 5" />
      <path d="M13 11c2.2 0 4 1.8 4 4.5" />
    </svg>
  )
}
