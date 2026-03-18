/**
 * SavedMeals.jsx — List of all saved meals for the household.
 * Each meal card shows name + recipe components joined by middle dots.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0',
}

export default function SavedMeals({ appUser }) {
  const navigate = useNavigate()
  const [meals, setMeals] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!appUser?.household_id) return
    supabase
      .from('meals')
      .select('id, name, meal_recipes(recipe_id, sort_order, recipes(name))')
      .eq('household_id', appUser.household_id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('[Roux] SavedMeals fetch error:', error)
        setMeals(data || [])
      })
  }, [appUser?.household_id])

  return (
    <div style={{
      background: C.cream, minHeight: '100vh', maxWidth: '430px',
      margin: '0 auto', fontFamily: "'Jost', sans-serif",
      paddingBottom: '80px',
    }}>
      <TopBar
        leftAction={{
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
              <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          ),
          onClick: () => navigate('/meals'),
        }}
        centerContent={
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>
            Saved Meals
          </span>
        }
      />

      <div style={{ padding: '16px 16px 0' }}>
        {meals === null ? (
          /* Loading */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[0,1,2].map(i => (
              <div key={i} className="shimmer-block" style={{ height: '72px', borderRadius: '14px' }} />
            ))}
          </div>
        ) : meals.length === 0 ? (
          /* Empty state */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '60px 20px', textAlign: 'center',
          }}>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: '17px',
              fontStyle: 'italic', color: C.driftwood, marginBottom: '8px',
            }}>
              Nothing built yet.
            </div>
            <button
              onClick={() => navigate('/meals/plan')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Jost', sans-serif", fontSize: '13px',
                color: C.forest, fontWeight: 300,
              }}
            >
              Plan a meal to get started
            </button>
          </div>
        ) : (() => {
          const filtered = search.trim()
            ? meals.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
            : meals

          return (
            <>
              {/* Search bar — only when 2+ meals */}
              {meals.length > 1 && (
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{
                    width: 14, height: 14, position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                  }}>
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search your meals\u2026"
                    style={{
                      width: '100%', padding: '10px 12px 10px 34px', fontSize: '14px',
                      fontFamily: "'Jost', sans-serif", fontWeight: 300,
                      background: C.cream, border: '1px solid #E4DDD2',
                      borderRadius: '10px', outline: 'none', color: C.ink,
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = '#7A8C6E'}
                    onBlur={e => e.target.style.borderColor = '#E4DDD2'}
                  />
                </div>
              )}

              {/* Filtered meal list */}
              {filtered.length === 0 ? (
                <div style={{ fontSize: '13px', color: C.driftwood, fontWeight: 300, padding: '20px 0', textAlign: 'center' }}>
                  No meals match that search.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {filtered.map((meal, i) => {
                    const recipeNames = (meal.meal_recipes || [])
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map(mr => mr.recipes?.name)
                      .filter(Boolean)

                    return (
                      <button
                        key={meal.id}
                        onClick={() => navigate(`/meals/saved/${meal.id}`)}
                        style={{
                          background: 'white', borderRadius: '14px', padding: '16px',
                          border: '1px solid #E4DDD2',
                          cursor: 'pointer', textAlign: 'left', width: '100%',
                          opacity: 0, animation: `fadeUp 0.4s ease ${0.04 * i}s forwards`,
                        }}
                      >
                        <div style={{
                          fontFamily: "'Playfair Display', serif", fontSize: '18px',
                          fontWeight: 500, color: C.ink,
                        }}>
                          {meal.name}
                        </div>
                        {recipeNames.length > 0 && (
                          <div style={{
                            fontSize: '12px', color: C.driftwood, fontWeight: 300,
                            marginTop: '4px', lineHeight: 1.4,
                          }}>
                            {recipeNames.join(' · ')}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </>
          )
        })()}
      </div>

      <BottomNav activeTab="meals" />
    </div>
  )
}
