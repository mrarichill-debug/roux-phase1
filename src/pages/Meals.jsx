/**
 * Meals.jsx — Meals hub screen.
 * Zone 1: Add something (Plan a Meal + Add a Tradition tiles)
 * Zone 2: Your kitchen (Family Recipes + Saved Meals + Traditions archive tiles)
 * Counts refresh on mount and on window focus.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E', linen: '#E8E0D0',
  honey: '#C49A3C', offWhite: '#F0EBE3',
}

const zoneLabel = {
  fontSize: '11px', letterSpacing: '1.2px', textTransform: 'uppercase',
  color: C.driftwood, fontWeight: 300, fontFamily: "'Jost', sans-serif",
  marginBottom: '10px',
}

export default function Meals({ appUser }) {
  const navigate = useNavigate()
  const [recipeCount, setRecipeCount] = useState(null)
  const [draftCount, setDraftCount] = useState(null)
  const [mealCount, setMealCount] = useState(null)
  const [traditionCount, setTraditionCount] = useState(null)

  const fetchCounts = useCallback(async () => {
    if (!appUser?.household_id) return
    const [
      { count: rc },
      { count: dc },
      { count: mc },
      { count: tc },
    ] = await Promise.all([
      supabase.from('recipes').select('id', { count: 'exact', head: true })
        .eq('status', 'complete').eq('recipe_type', 'full'),
      supabase.from('recipes').select('id', { count: 'exact', head: true })
        .eq('status', 'draft').eq('recipe_type', 'full'),
      supabase.from('meals').select('id', { count: 'exact', head: true }),
      supabase.from('household_traditions').select('id', { count: 'exact', head: true }),
    ])
    setRecipeCount(rc ?? 0)
    setDraftCount(dc ?? 0)
    setMealCount(mc ?? 0)
    setTraditionCount(tc ?? 0)
  }, [appUser?.household_id])

  useEffect(() => { fetchCounts() }, [fetchCounts])

  useEffect(() => {
    function handleFocus() { fetchCounts() }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchCounts])

  return (
    <div style={{
      background: C.cream, minHeight: '100vh', maxWidth: '430px',
      margin: '0 auto', fontFamily: "'Jost', sans-serif",
      paddingBottom: '80px',
    }}>
      <TopBar />

      <div style={{ padding: '18px 16px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Zone 1: Add something ──────────────────────────────────── */}
        <div>
          <div style={zoneLabel}>Add something</div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
            opacity: 0, animation: 'fadeUp 0.4s ease 0.05s forwards',
          }}>
            {/* Plan a Meal */}
            <button
              onClick={() => navigate('/meals/plan')}
              style={{
                background: C.forest, borderRadius: '14px', padding: '14px 14px 16px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                minHeight: '110px',
              }}
            >
              {/* Plus icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="rgba(250,247,242,0.6)" strokeWidth="1.8" strokeLinecap="round" style={{ width: 20, height: 20 }}>
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <div>
                <div style={{
                  fontFamily: "'Playfair Display', serif", fontSize: '18px',
                  color: 'rgba(250,247,242,0.95)', fontWeight: 500, marginBottom: '3px',
                }}>
                  Plan a Meal
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(250,247,242,0.55)', fontWeight: 300, lineHeight: 1.3 }}>
                  Build it, add it to the week.
                </div>
              </div>
            </button>

            {/* Add a Tradition */}
            <button
              onClick={() => navigate('/meals/traditions/new')}
              style={{
                background: C.offWhite, borderRadius: '14px', padding: '14px 14px 16px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                minHeight: '110px',
              }}
            >
              {/* Star icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke={C.honey} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <div>
                <div style={{
                  fontFamily: "'Playfair Display', serif", fontSize: '18px',
                  color: C.ink, fontWeight: 500, marginBottom: '3px',
                }}>
                  Add a Tradition
                </div>
                <div style={{ fontSize: '10px', color: C.driftwoodSm, fontWeight: 300, lineHeight: 1.3 }}>
                  A meal your family keeps coming back to.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* ── Zone 2: Your kitchen ───────────────────────────────────── */}
        <div>
          <div style={zoneLabel}>Your kitchen</div>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px',
            opacity: 0, animation: 'fadeUp 0.4s ease 0.10s forwards',
          }}>
            {/* Family Recipes */}
            <button
              onClick={() => navigate('/meals/recipes')}
              style={{
                background: 'white', borderRadius: '14px', padding: '14px 10px 16px',
                border: `1px solid ${C.linen}`, cursor: 'pointer', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '4px', minHeight: '100px', justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontSize: '22px',
                fontWeight: 500, color: C.forest, lineHeight: 1, marginTop: '2px',
              }}>
                {recipeCount ?? '—'}
              </div>
              <div style={{ fontSize: '12px', color: C.ink, fontWeight: 400 }}>
                Family Recipes
              </div>
              <div style={{ fontSize: '10px', color: C.driftwood, fontWeight: 300 }}>
                recipes
              </div>
              {draftCount > 0 && (
                <div style={{
                  fontSize: '8px', fontWeight: 500, color: C.honey,
                  background: 'rgba(196,154,60,0.12)', borderRadius: '4px',
                  padding: '1px 6px', marginTop: '2px',
                }}>
                  {draftCount} to finish
                </div>
              )}
            </button>

            {/* Saved Meals */}
            <button
              onClick={() => navigate('/meals/saved')}
              style={{
                background: 'white', borderRadius: '14px', padding: '14px 10px 16px',
                border: `1px solid ${C.linen}`, cursor: 'pointer', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '4px', minHeight: '100px', justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 18 18" fill="none" stroke={C.driftwood} style={{ width: 16, height: 16 }}>
                <rect x="2" y="2" width="14" height="14" rx="2" strokeWidth="1.3"/>
                <path d="M5 6h8M5 9h8M5 12h5" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontSize: '22px',
                fontWeight: 500, color: C.forest, lineHeight: 1, marginTop: '2px',
              }}>
                {mealCount ?? '—'}
              </div>
              <div style={{ fontSize: '12px', color: C.ink, fontWeight: 400 }}>
                Saved Meals
              </div>
              <div style={{ fontSize: '10px', color: C.driftwood, fontWeight: 300 }}>
                built
              </div>
            </button>

            {/* Traditions */}
            <button
              onClick={() => navigate('/meals/traditions')}
              style={{
                background: 'white', borderRadius: '14px', padding: '14px 10px 16px',
                border: `1px solid ${C.linen}`, cursor: 'pointer', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: '4px', minHeight: '100px', justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontSize: '22px',
                fontWeight: 500, color: C.forest, lineHeight: 1, marginTop: '2px',
              }}>
                {traditionCount ?? '—'}
              </div>
              <div style={{ fontSize: '12px', color: C.ink, fontWeight: 400 }}>
                Traditions
              </div>
              <div style={{ fontSize: '10px', color: C.driftwood, fontWeight: 300 }}>
                kept
              </div>
            </button>
          </div>
        </div>

      </div>

      <BottomNav activeTab="meals" />
    </div>
  )
}
