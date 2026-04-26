/**
 * WeeklyReview.jsx — Weekly meal review screen.
 * Quick mode: cooked/skipped per meal.
 * Detailed mode: expanded with ingredient tracking + ratings.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import BottomNav from '../components/BottomNav'
import { color, alpha, elevation } from '../styles/tokens'

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export default function WeeklyReview({ appUser }) {
  const { mealPlanId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [mode, setMode] = useState(searchParams.get('mode') || 'quick')
  const [plan, setPlan] = useState(null)
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedMeal, setExpandedMeal] = useState(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => { if (mealPlanId) loadReview() }, [mealPlanId])

  async function loadReview() {
    setLoading(true)
    try {
      const { data: planData } = await supabase.from('meal_plans')
        .select('id, week_start_date, week_end_date, reviewed_at, status')
        .eq('id', mealPlanId).single()
      if (!planData) { navigate('/'); return }
      setPlan(planData)

      // Load meals — separate query for recipe names per LESSONS.md
      const { data: mealsData } = await supabase.from('planned_meals')
        .select('*').eq('meal_plan_id', mealPlanId).is('removed_at', null).order('planned_date').order('sort_order')
      const recipeIds = (mealsData || []).filter(m => m.recipe_id).map(m => m.recipe_id)
      let recipeMap = {}
      if (recipeIds.length > 0) {
        const { data: recipes } = await supabase.from('recipes').select('id, name').in('id', recipeIds)
        recipeMap = Object.fromEntries((recipes || []).map(r => [r.id, r]))
      }
      setMeals((mealsData || []).map(m => ({
        ...m,
        displayName: m.custom_name || recipeMap[m.recipe_id]?.name || m.note || 'Untitled',
      })))
    } catch (err) {
      console.error('[WeeklyReview] Load error:', err)
    }
    setLoading(false)
  }

  const reviewedCount = meals.filter(m => m.status === 'cooked' || m.status === 'skipped' || m.status === 'eating_out').length
  const allReviewed = meals.length > 0 && reviewedCount === meals.length

  function getMealDay(meal) {
    if (!meal.planned_date) return ''
    const d = new Date(meal.planned_date + 'T12:00:00')
    const dow = d.getDay()
    return DAY_LABELS[dow === 0 ? 6 : dow - 1]
  }

  async function setMealStatus(mealId, status) {
    const now = new Date().toISOString()
    const update = { status, quick_reviewed: true }
    if (status === 'cooked' || status === 'eating_out') update.cooked_at = now
    setMeals(prev => prev.map(m => m.id === mealId ? { ...m, ...update } : m))
    await supabase.from('planned_meals').update(update).eq('id', mealId)
  }

  async function setDetailedField(mealId, field, value) {
    setMeals(prev => prev.map(m => m.id === mealId ? { ...m, [field]: value } : m))
    await supabase.from('planned_meals').update({ [field]: value, detailed_reviewed: true }).eq('id', mealId)
  }

  async function closeOutWeek() {
    if (closing) return
    setClosing(true)
    const now = new Date().toISOString()
    await supabase.from('meal_plans').update({ reviewed_at: now, status: 'archived', archived_at: now }).eq('id', mealPlanId)
    logActivity({ user: appUser, actionType: 'weekly_review_completed', targetType: 'meal_plan', targetId: mealPlanId, metadata: { mode, meals_reviewed: reviewedCount } })
    navigate('/')
  }

  const dateRange = plan ? (() => {
    const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(plan.week_start_date)} – ${fmt(plan.week_end_date)}`
  })() : ''

  if (loading) return (
    <div style={{ background: color.paper, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
      <div style={{ padding: '20px 22px' }}>
        {[60, 40, 40, 40].map((h, i) => <div key={i} className="shimmer-block" style={{ height: `${h}px`, borderRadius: '12px', marginBottom: '10px' }} />)}
      </div>
    </div>
  )

  return (
    <div style={{
      background: color.paper, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 8px))',
    }}>
      {/* Header */}
      <div style={{ background: color.forest, padding: '20px 22px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <button onClick={() => navigate(-1)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(250,247,242,0.7)', padding: '4px', display: 'flex', alignItems: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>
            {dateRange} — {mode === 'quick' ? 'Quick' : 'Full'} Review
          </span>
        </div>
        {/* Progress */}
        <div style={{ fontSize: '12px', color: 'rgba(250,247,242,0.6)' }}>
          {reviewedCount} of {meals.length} meals reviewed
        </div>
        <div style={{ marginTop: '8px', height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }}>
          <div style={{ height: '100%', background: 'rgba(250,247,242,0.7)', borderRadius: '2px', width: `${meals.length > 0 ? (reviewedCount / meals.length) * 100 : 0}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Meal cards */}
      <div style={{ padding: '16px 22px' }}>
        {meals.map(meal => {
          const isCooked = meal.status === 'cooked'
          const isSkipped = meal.status === 'skipped'
          const isEatingOut = meal.status === 'eating_out'
          const isReviewed = isCooked || isSkipped || isEatingOut
          const isExpanded = expandedMeal === meal.id && mode === 'detailed'

          return (
            <div key={meal.id} style={{
              background: 'white', borderRadius: '14px', border: `1px solid ${isReviewed ? 'rgba(122,140,110,0.3)' : color.rule}`,
              padding: '14px 16px', marginBottom: '10px',
              opacity: isReviewed && !isExpanded ? 0.7 : 1, transition: 'opacity 0.2s',
            }}>
              {/* Day + meal name */}
              <div onClick={() => mode === 'detailed' && setExpandedMeal(isExpanded ? null : meal.id)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isReviewed && !isExpanded ? '0' : '12px',
                cursor: mode === 'detailed' ? 'pointer' : 'default',
              }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', color: color.inkSoft, marginBottom: '2px' }}>
                    {getMealDay(meal)}
                  </div>
                  <div style={{ fontSize: '15px', color: isCooked ? color.sage : color.ink, fontWeight: 400 }}>
                    {isCooked && <span style={{ color: color.sage }}>✓ </span>}
                    {isSkipped && <span style={{ color: color.inkSoft }}>— </span>}
                    {meal.displayName}
                  </div>
                </div>
                {isReviewed && !isExpanded && (
                  <span style={{ fontSize: '10px', color: isCooked ? color.sage : color.inkSoft, fontWeight: 500 }}>
                    {isCooked ? 'Cooked' : isSkipped ? 'Skipped' : 'Ate out'}
                  </span>
                )}
              </div>

              {/* Quick mode: two buttons */}
              {!isReviewed && mode === 'quick' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setMealStatus(meal.id, 'cooked')} style={{
                    flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                    background: color.forest, color: 'white', cursor: 'pointer',
                    fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                  }}>✓ Cooked</button>
                  <button onClick={() => setMealStatus(meal.id, 'skipped')} style={{
                    flex: 1, padding: '12px', borderRadius: '10px',
                    border: `1.5px solid ${color.rule}`, background: 'white', color: color.ink, cursor: 'pointer',
                    fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 400,
                  }}>Skipped</button>
                </div>
              )}

              {/* Detailed mode: three status buttons + expanded fields */}
              {!isReviewed && mode === 'detailed' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => { setMealStatus(meal.id, 'cooked'); setExpandedMeal(meal.id) }} style={{
                    flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                    background: color.forest, color: 'white', cursor: 'pointer',
                    fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 500,
                  }}>✓ Cooked</button>
                  <button onClick={() => { setMealStatus(meal.id, 'skipped'); setExpandedMeal(meal.id) }} style={{
                    flex: 1, padding: '10px', borderRadius: '10px',
                    border: `1.5px solid ${color.rule}`, background: 'white', color: color.ink, cursor: 'pointer',
                    fontFamily: "'Jost', sans-serif", fontSize: '13px',
                  }}>Skipped</button>
                  <button onClick={() => { setMealStatus(meal.id, 'eating_out'); setExpandedMeal(meal.id) }} style={{
                    flex: 1, padding: '10px', borderRadius: '10px',
                    border: `1.5px solid ${color.rule}`, background: 'white', color: color.ink, cursor: 'pointer',
                    fontFamily: "'Jost', sans-serif", fontSize: '13px',
                  }}>Ate out</button>
                </div>
              )}

              {/* Detailed expanded fields */}
              {isExpanded && isReviewed && (
                <div style={{ marginTop: '12px', borderTop: `1px solid ${color.rule}`, paddingTop: '12px' }}>
                  {isCooked && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: color.inkSoft, marginBottom: '6px' }}>Did you use all the ingredients?</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {['yes', 'mostly', 'no'].map(val => (
                          <button key={val} onClick={() => setDetailedField(meal.id, 'ingredients_consumed', val)} style={{
                            flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px',
                            border: meal.ingredients_consumed === val ? `1.5px solid ${color.forest}` : `1px solid ${color.rule}`,
                            background: meal.ingredients_consumed === val ? 'rgba(61,107,79,0.08)' : 'white',
                            color: meal.ingredients_consumed === val ? color.forest : color.ink,
                            cursor: 'pointer', fontFamily: "'Jost', sans-serif", textTransform: 'capitalize',
                          }}>{val}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isEatingOut && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: color.inkSoft, marginBottom: '6px' }}>How much did you spend?</div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: color.inkSoft }}>$</span>
                          <input type="text" inputMode="decimal" value={meal.eating_out_actual_cost || ''}
                            onChange={e => setDetailedField(meal.id, 'eating_out_actual_cost', e.target.value ? parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || null : null)}
                            placeholder="0.00" style={{
                              width: '100%', padding: '8px 12px 8px 24px', fontSize: '14px',
                              fontFamily: "'Jost', sans-serif", border: `1.5px solid ${color.rule}`,
                              borderRadius: '8px', outline: 'none', color: color.ink, boxSizing: 'border-box',
                            }} />
                        </div>
                        <span style={{ fontSize: '11px', color: color.inkSoft, fontStyle: 'italic' }}>optional</span>
                      </div>
                    </div>
                  )}

                  {isSkipped && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: color.inkSoft, marginBottom: '6px' }}>Did you buy ingredients before skipping?</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[true, false].map(val => (
                          <button key={String(val)} onClick={() => setDetailedField(meal.id, 'ingredients_bought_before_skip', val)} style={{
                            flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px',
                            border: meal.ingredients_bought_before_skip === val ? `1.5px solid ${color.forest}` : `1px solid ${color.rule}`,
                            background: meal.ingredients_bought_before_skip === val ? 'rgba(61,107,79,0.08)' : 'white',
                            color: meal.ingredients_bought_before_skip === val ? color.forest : color.ink,
                            cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                          }}>{val ? 'Yes' : 'No'}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Review rating */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: color.inkSoft, marginBottom: '6px' }}>Would you make this again?</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {[{ val: 'hit', label: 'Hit', emoji: '👍' }, { val: 'skip', label: 'Skip', emoji: '👎' }, { val: 'maybe', label: 'Maybe', emoji: '🤔' }].map(opt => (
                        <button key={opt.val} onClick={() => setDetailedField(meal.id, 'review_rating', opt.val)} style={{
                          flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px',
                          border: meal.review_rating === opt.val ? `1.5px solid ${color.forest}` : `1px solid ${color.rule}`,
                          background: meal.review_rating === opt.val ? 'rgba(61,107,79,0.08)' : 'white',
                          color: meal.review_rating === opt.val ? color.forest : color.ink,
                          cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                        }}>{opt.emoji} {opt.label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Note */}
                  <input type="text" placeholder="Add a note (optional)"
                    value={meal.review_note || ''}
                    onChange={e => setDetailedField(meal.id, 'review_note', e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: '13px',
                      fontFamily: "'Jost', sans-serif", fontWeight: 300,
                      border: `1px solid ${color.rule}`, borderRadius: '10px',
                      outline: 'none', color: color.ink, boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* Close out button */}
        {allReviewed && (
          <button onClick={closeOutWeek} disabled={closing} style={{
            width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
            background: color.forest, color: 'white', cursor: 'pointer', marginTop: '12px',
            fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
            boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
          }}>{closing ? 'Closing out...' : 'Close out this week →'}</button>
        )}

        {/* Mode switch */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button onClick={() => setMode(mode === 'quick' ? 'detailed' : 'quick')} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: '12px', color: color.inkSoft, fontFamily: "'Jost', sans-serif", fontWeight: 300, fontStyle: 'italic',
          }}>Switch to {mode === 'quick' ? 'detailed' : 'quick'} review</button>
        </div>
      </div>

      <BottomNav activeTab="plan" />
    </div>
  )
}
