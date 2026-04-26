/**
 * Onboarding.jsx — 4-screen onboarding flow for new users.
 * Screen 3 is interactive — Lauren adds her first meal.
 * Shown after account creation or dev reset.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { sageMealMatch } from '../lib/sageMealMatch'
import { getWeekStartTZ, toLocalDateStr } from '../lib/dateUtils'
import { color, alpha, elevation } from '../styles/tokens'

const SageIcon = ({ size = 24, color = color.sage }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
  </svg>
)

const DOW_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const MEAL_TYPES = ['breakfast','lunch','dinner','other']
const MEAL_TYPE_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', other: 'Other' }

export default function Onboarding({ appUser, setAppUser }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const firstName = appUser?.name?.split(' ')[0] || ''
  const tz = appUser?.timezone || 'America/Chicago'

  // Screen 3 interactive state
  const [mealInput, setMealInput] = useState('')
  const [mealType, setMealType] = useState(null)
  const [addingMeal, setAddingMeal] = useState(false)
  const [addedMealName, setAddedMealName] = useState(null) // set after first meal added
  const [addError, setAddError] = useState(null)
  const inputRef = useRef(null)

  // Only redirect on initial mount if already onboarded — not during the flow
  useEffect(() => {
    if (appUser?.has_planned_first_meal && step === 0) navigate('/', { replace: true })
  }, [])

  // Focus input when Screen 3 appears
  useEffect(() => {
    if (step === 2) setTimeout(() => inputRef.current?.focus(), 400)
  }, [step])

  const totalSteps = 4

  async function next() {
    if (step < totalSteps - 1) {
      setStep(s => s + 1)
    } else {
      // Final screen — set flag in DB and update in-memory state before navigating
      await supabase.from('users').update({ has_planned_first_meal: true }).eq('id', appUser.id)
      if (setAppUser) setAppUser(prev => ({ ...prev, has_planned_first_meal: true }))
      navigate('/plan')
    }
  }

  function back() {
    if (step > 0) setStep(s => s - 1)
  }

  // Add first meal (Screen 3)
  async function addFirstMeal() {
    if (!mealInput.trim() || !mealType || addingMeal) return
    setAddingMeal(true)
    setAddError(null)
    try {
      const ws = getWeekStartTZ(tz, 0)
      const today = new Date()
      const dateStr = toLocalDateStr(today)
      const jsDay = today.getDay()
      const dowKey = DOW_KEYS[jsDay === 0 ? 6 : jsDay - 1]

      // Ensure meal plan exists
      let { data: plan } = await supabase.from('meal_plans')
        .select('id').eq('household_id', appUser.household_id).eq('week_start_date', ws).maybeSingle()
      if (!plan) {
        // week_end_date = 6 days after start (Sunday)
        const [y, m, d] = ws.split('-').map(Number)
        const endDate = new Date(y, m - 1, d + 6)
        const wed = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
        const { data: newPlan } = await supabase.from('meal_plans').insert({
          household_id: appUser.household_id, created_by: appUser.id,
          week_start_date: ws, week_end_date: wed, status: 'draft',
        }).select('id').single()
        plan = newPlan
      }
      if (!plan) { setAddError('Could not create meal plan. Try again.'); setAddingMeal(false); return }

      const name = mealInput.trim()
      const { data, error } = await supabase.from('planned_meals').insert({
        household_id: appUser.household_id,
        meal_plan_id: plan.id,
        day_of_week: dowKey,
        meal_type: mealType || 'dinner',
        planned_date: dateStr,
        custom_name: name,
        entry_type: 'ghost',
        slot_type: 'note',
        status: 'planned',
        sort_order: 0,
      }).select('*').single()

      if (error) throw error

      // Mark first meal flag — await so it's set before any navigation, update in-memory state
      await supabase.from('users').update({ has_planned_first_meal: true }).eq('id', appUser.id)
      if (setAppUser) setAppUser(prev => ({ ...prev, has_planned_first_meal: true }))

      logActivity({
        user: appUser, actionType: 'meal_added_to_week', targetType: 'meal',
        targetId: data.id, targetName: name,
        metadata: { day_of_week: dowKey, entry_type: 'ghost', source: 'onboarding' },
      })

      // Fire Sage meal match
      sageMealMatch({ mealId: data.id, mealName: name, householdId: appUser.household_id })

      setAddedMealName(name)
      setStep(3) // Advance to celebration screen
    } catch (err) {
      console.error('[Onboarding] Add meal error:', err)
      setAddError('Something went wrong. Try again.')
    }
    setAddingMeal(false)
  }

  // Today's display name
  const todayName = DAY_NAMES[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]

  return (
    <div style={{
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      fontFamily: "'Jost', sans-serif", fontWeight: 300,
      display: 'flex', flexDirection: 'column',
      background: step === 0 ? color.forest : color.paper,
      transition: 'background 0.4s ease',
    }}>
      {/* Back arrow */}
      {step > 0 && (
        <button onClick={back} style={{
          position: 'absolute', top: '20px', left: '20px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: color.inkSoft, padding: '4px', zIndex: 10,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
      )}

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: step === 2 ? '60px 28px 140px' : '60px 36px 140px', textAlign: 'center',
      }}>

        {/* ── Screen 1: Welcome ─────────────────────────────────── */}
        {step === 0 && (
          <div style={{ animation: 'fadeUp 0.4s ease both' }}>
            <div style={{
              fontFamily: "'Slabo 27px', serif", fontSize: '36px', fontWeight: 400,
              color: 'rgba(250,247,242,0.95)', marginBottom: '32px',
            }}>Roux.</div>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 500,
              color: 'rgba(250,247,242,0.95)', lineHeight: 1.4, marginBottom: '12px',
            }}>
              Welcome to Roux, {firstName}.
            </div>
            <div style={{ fontSize: '15px', color: 'rgba(250,247,242,0.7)', lineHeight: 1.6 }}>
              Where your family's meals come together.
            </div>
          </div>
        )}

        {/* ── Screen 2: Meet Sage ───────────────────────────────── */}
        {step === 1 && (
          <div style={{ animation: 'fadeUp 0.4s ease both' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(122,140,110,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <SageIcon size={28} />
            </div>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500,
              color: color.ink, marginBottom: '16px',
            }}>Meet Sage</div>
            <div style={{ fontSize: '14px', color: color.inkSoft, lineHeight: 1.7, maxWidth: '300px' }}>
              Sage is the intelligence inside Roux. She learns your family's meals, notices your patterns, and understands what your family loves over time. The more you plan with Roux, the more Sage can do for you.
            </div>
          </div>
        )}

        {/* ── Screen 3: Add first meal (interactive) ─────────────── */}
        {step === 2 && (
          <div style={{ animation: 'fadeUp 0.4s ease both', width: '100%', maxWidth: '340px', textAlign: 'left' }}>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500,
              color: color.ink, marginBottom: '8px', textAlign: 'center',
            }}>Let's add your first meal.</div>
            <div style={{ fontSize: '13px', color: color.inkSoft, lineHeight: 1.6, marginBottom: '24px', textAlign: 'center' }}>
              Describe what you want to make — "Chicken tacos with rice" or "Pizza night." Don't worry about recipes yet.
            </div>

            {/* Day card */}
            <div style={{
              background: 'white', borderRadius: '14px', border: `1.5px solid ${color.forest}`,
              overflow: 'hidden', marginBottom: '16px',
            }}>
              <div style={{
                background: color.forest, padding: '10px 14px', color: 'white',
                fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 500,
              }}>
                {todayName}
              </div>
              <div style={{ padding: '14px' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={mealInput}
                  onChange={e => setMealInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addFirstMeal() }}
                  placeholder="What do you want to make?"
                  style={{
                    width: '100%', padding: '12px 14px', fontSize: '15px',
                    fontFamily: "'Jost', sans-serif", fontWeight: 300,
                    border: `1.5px solid ${color.rule}`, borderRadius: '10px',
                    outline: 'none', color: color.ink, boxSizing: 'border-box',
                  }}
                />
                {/* Meal type pills */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  {MEAL_TYPES.map(mt => (
                    <button key={mt} onClick={() => setMealType(mt)} style={{
                      flex: 1, padding: '7px', borderRadius: '8px', fontSize: '11px',
                      border: mealType === mt ? `1.5px solid ${color.forest}` : `1px solid ${color.rule}`,
                      background: mealType === mt ? 'rgba(61,107,79,0.08)' : 'white',
                      color: mealType === mt ? color.forest : color.ink,
                      cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                      fontWeight: mealType === mt ? 500 : 400,
                    }}>{MEAL_TYPE_LABELS[mt]}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Screen 4: Celebration ──────────────────────────────── */}
        {step === 3 && (
          <div style={{ animation: 'fadeUp 0.4s ease both' }}>
            {addedMealName ? (
              <>
                <div style={{
                  fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500,
                  color: color.ink, marginBottom: '12px',
                }}>Great start, {firstName}.</div>
                <div style={{ fontSize: '14px', color: color.inkSoft, lineHeight: 1.7, maxWidth: '300px', marginBottom: '24px' }}>
                  Your menu is taking shape. Head to your week and fill in the rest — Sage will help as you go.
                </div>
                {/* Preview of added meal */}
                <div style={{
                  background: 'white', borderRadius: '10px', padding: '12px 16px',
                  border: `1px solid ${color.rule}`, marginBottom: '8px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ color: color.sage, fontSize: '14px' }}>✦</span>
                  <span style={{ fontSize: '14px', color: color.ink }}>{addedMealName}</span>
                  <span style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', color: color.inkSoft, marginLeft: 'auto' }}>
                    {MEAL_TYPE_LABELS[mealType]}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: color.sage, fontStyle: 'italic' }}>
                  Sage is searching for matching recipes...
                </div>
              </>
            ) : (
              <>
                <div style={{
                  fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500,
                  color: color.ink, marginBottom: '12px',
                }}>Let's build your first menu.</div>
                <div style={{ fontSize: '14px', color: color.inkSoft, lineHeight: 1.7, maxWidth: '300px', marginBottom: '24px' }}>
                  Tap any day and describe what you want to make this week. Sage will help you find recipes as you go.
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px 16px', background: 'rgba(122,140,110,0.08)',
                  borderRadius: '10px', borderLeft: `3px solid ${color.sage}`,
                }}>
                  <SageIcon size={16} />
                  <span style={{ fontSize: '13px', color: color.sage, fontStyle: 'italic' }}>
                    I'll help you find recipes as you go.
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* CTA button area */}
      <div style={{
        position: 'fixed', bottom: '0', left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', padding: '20px 36px 40px',
        background: step === 0 ? 'transparent' : color.paper,
      }}>
        {step === 2 ? (
          <>
            <button onClick={addFirstMeal} disabled={!mealInput.trim() || !mealType || addingMeal} style={{
              width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
              background: mealInput.trim() && mealType ? color.forest : color.rule,
              color: mealInput.trim() && mealType ? 'white' : color.inkSoft,
              cursor: mealInput.trim() && mealType ? 'pointer' : 'default',
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
              boxShadow: mealInput.trim() && mealType ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
            }}>
              {addingMeal ? 'Adding...' : 'Add to menu →'}
            </button>
            {addError && (
              <div style={{ marginTop: '8px', fontSize: '13px', color: color.rust, textAlign: 'center' }}>{addError}</div>
            )}
            <button onClick={next} style={{
              width: '100%', padding: '10px', marginTop: '8px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: color.inkSoft, fontSize: '13px', fontFamily: "'Jost', sans-serif",
            }}>Skip for now →</button>
          </>
        ) : (
          <button onClick={next} style={{
            width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
            background: step === 0 ? 'rgba(250,247,242,0.95)' : color.forest,
            color: step === 0 ? color.forest : 'white',
            cursor: 'pointer', fontFamily: "'Jost', sans-serif",
            fontSize: '15px', fontWeight: 500,
            boxShadow: step === 0 ? 'none' : '0 4px 16px rgba(30,55,35,0.25)',
          }}>
            {step === 0 ? "Let's get started →"
              : step === 1 ? 'Sounds good →'
              : 'Go to my menu →'}
          </button>
        )}

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} style={{
              width: i === step ? '20px' : '6px', height: '6px', borderRadius: '3px',
              background: step === 0
                ? (i === step ? 'rgba(250,247,242,0.9)' : 'rgba(250,247,242,0.3)')
                : (i === step ? color.forest : color.rule),
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
