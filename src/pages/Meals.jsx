/**
 * Meals.jsx — Meals hub screen.
 * Three cards: Plan a Meal, Family Recipes, Our Traditions.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E', linen: '#E8E0D0',
  honey: '#C49A3C',
}

export default function Meals({ appUser }) {
  const navigate = useNavigate()
  const [recipeCount, setRecipeCount] = useState(null)

  useEffect(() => {
    if (!appUser?.household_id) return
    supabase
      .from('recipes')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', appUser.household_id)
      .then(({ count }) => setRecipeCount(count ?? 0))
  }, [appUser?.household_id])

  return (
    <div style={{
      background: C.cream, minHeight: '100vh', maxWidth: '430px',
      margin: '0 auto', fontFamily: "'Jost', sans-serif",
      paddingBottom: '80px',
    }}>
      <TopBar />

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* ── Card 1: Plan a Meal ───────────────────────────────────── */}
        <button
          onClick={() => navigate('/meals/plan')}
          style={{
            background: C.forest, borderRadius: '14px', padding: '16px 16px',
            display: 'flex', flexDirection: 'column', gap: '6px',
            border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
            opacity: 0, animation: 'fadeUp 0.4s ease 0.05s forwards',
          }}
        >
          <div style={{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(250,247,242,0.55)', fontFamily: "'Jost', sans-serif" }}>
            What are we having?
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: 'rgba(250,247,242,0.95)', fontWeight: 500 }}>
            Plan a Meal
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(250,247,242,0.65)', fontWeight: 300 }}>
            One recipe or a combination — build it your way.
          </div>
          <div style={{
            background: 'rgba(250,247,242,0.15)', borderRadius: '20px',
            padding: '6px 14px', marginTop: '6px',
            fontSize: '11px', color: 'rgba(250,247,242,0.9)', fontWeight: 500,
            alignSelf: 'flex-start',
          }}>
            + Start planning
          </div>
        </button>

        {/* ── Card 2: Family Recipes ────────────────────────────────── */}
        <button
          onClick={() => navigate('/meals/recipes')}
          style={{
            background: 'white', borderRadius: '14px', padding: '16px 18px',
            border: `1px solid rgba(200,185,160,0.5)`,
            display: 'flex', alignItems: 'center', gap: '14px',
            cursor: 'pointer', textAlign: 'left', width: '100%',
            boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
            opacity: 0, animation: 'fadeUp 0.4s ease 0.10s forwards',
          }}
        >
          {/* Recipe box icon */}
          <div style={{ flexShrink: 0, color: C.forest, opacity: 0.7 }}>
            <svg width="36" height="32" viewBox="0 0 32 30" fill="none">
              <rect x="1" y="9" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <rect x="3" y="6" width="20" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <rect x="5" y="3" width="16" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <line x1="5" x2="21" y1="15" y2="15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
              <line x1="5" x2="16" y1="20" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '17px', color: C.ink, fontWeight: 500, marginBottom: '2px' }}>
              Family Recipes
            </div>
            <div style={{ fontSize: '10px', color: C.driftwoodSm, fontWeight: 300 }}>
              Your saved collection
            </div>
            {recipeCount !== null && (
              <div style={{ fontSize: '9px', color: C.driftwoodSm, fontWeight: 400, marginTop: '3px', opacity: 0.7 }}>
                {recipeCount} recipe{recipeCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke={C.linen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        {/* ── Card 3: Our Traditions ────────────────────────────────── */}
        <button
          onClick={() => navigate('/meals/traditions')}
          style={{
            background: 'white', borderRadius: '14px', padding: '16px 18px',
            border: `1px solid rgba(200,185,160,0.5)`,
            display: 'flex', alignItems: 'center', gap: '14px',
            cursor: 'pointer', textAlign: 'left', width: '100%',
            boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
            opacity: 0, animation: 'fadeUp 0.4s ease 0.15s forwards',
          }}
        >
          {/* Star/honey icon */}
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(196,154,60,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={C.honey} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '17px', color: C.ink, fontWeight: 500, marginBottom: '2px' }}>
              Our Traditions
            </div>
            <div style={{ fontSize: '10px', color: C.driftwoodSm, fontWeight: 300 }}>
              The meals that bring everyone home
            </div>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke={C.linen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

      </div>

      <BottomNav activeTab="meals" />
    </div>
  )
}
