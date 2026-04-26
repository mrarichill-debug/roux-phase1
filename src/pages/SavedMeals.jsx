/**
 * SavedMeals.jsx — List of all saved meals for the household.
 * Each meal card shows name + recipe components joined by middle dots.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import AddToPlanSheet from '../components/AddToPlanSheet'
import { color, alpha, elevation } from '../styles/tokens'

export default function SavedMeals({ appUser }) {
  const navigate = useNavigate()
  const [meals, setMeals] = useState(null)
  const [search, setSearch] = useState('')
  const [planSheetMeal, setPlanSheetMeal] = useState(null)

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
      background: color.paper, minHeight: '100vh', maxWidth: '430px',
      margin: '0 auto', fontFamily: "'Jost', sans-serif",
      paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 8px))',
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
              fontStyle: 'italic', color: color.inkSoft, marginBottom: '8px',
            }}>
              Nothing built yet.
            </div>
            <button
              onClick={() => navigate('/meals/plan')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Jost', sans-serif", fontSize: '13px',
                color: color.forest, fontWeight: 300,
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
                  <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{
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
                      background: color.paper, border: '1px solid #E4DDD2',
                      borderRadius: '10px', outline: 'none', color: color.ink,
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = color.sage}
                    onBlur={e => e.target.style.borderColor = color.rule}
                  />
                </div>
              )}

              {/* Filtered meal list */}
              {filtered.length === 0 ? (
                <div style={{ fontSize: '13px', color: color.inkSoft, fontWeight: 300, padding: '20px 0', textAlign: 'center' }}>
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
                      <div
                        key={meal.id}
                        style={{
                          background: 'white', borderRadius: '14px', padding: '16px',
                          border: '1px solid #E4DDD2',
                          opacity: 0, animation: `fadeUp 0.4s ease ${0.04 * i}s forwards`,
                        }}
                      >
                        <button
                          onClick={() => navigate(`/meals/plan/${meal.id}`)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            textAlign: 'left', width: '100%', padding: 0,
                            fontFamily: "'Jost', sans-serif",
                          }}
                        >
                          <div style={{
                            fontFamily: "'Playfair Display', serif", fontSize: '18px',
                            fontWeight: 500, color: color.ink,
                          }}>
                            {meal.name}
                          </div>
                          {recipeNames.length > 0 && (
                            <div style={{
                              fontSize: '12px', color: color.inkSoft, fontWeight: 300,
                              marginTop: '4px', lineHeight: 1.4,
                            }}>
                              {recipeNames.join(' · ')}
                            </div>
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPlanSheetMeal({ id: meal.id, name: meal.name }) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            fontFamily: "'Jost', sans-serif", fontSize: '11px',
                            color: color.forest, fontWeight: 400, padding: '8px 0 0',
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                            <line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/>
                            <line x1="3" x2="21" y1="10" y2="10"/>
                          </svg>
                          Add to plan
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )
        })()}
      </div>

      <AddToPlanSheet
        open={!!planSheetMeal}
        onClose={() => setPlanSheetMeal(null)}
        meal={planSheetMeal}
        appUser={appUser}
        onSuccess={() => setPlanSheetMeal(null)}
      />

      <BottomNav activeTab="meals" />
    </div>
  )
}
