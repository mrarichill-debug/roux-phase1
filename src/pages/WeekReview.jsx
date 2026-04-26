/**
 * WeekReview.jsx — Quick week closeout flow.
 * One day at a time. Made it / Close enough / Skipped.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { useArc } from '../context/ArcContext'
import TopBar from '../components/TopBar'
import { color, alpha, elevation } from '../styles/tokens'

const DOW_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DOW_NAMES = { monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday' }

export default function WeekReview({ appUser }) {
  const { mealPlanId } = useParams()
  const navigate = useNavigate()
  const { color: arcColor } = useArc()

  const [meals, setMeals] = useState([])
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (mealPlanId) loadReviewData()
  }, [mealPlanId])

  async function loadReviewData() {
    setLoading(true)
    const [planRes, mealsRes] = await Promise.all([
      supabase.from('meal_plans').select('id, week_start_date, week_end_date').eq('id', mealPlanId).maybeSingle(),
      supabase.from('planned_meals').select('id, day_of_week, meal_type, custom_name, slot_type, status')
        .eq('meal_plan_id', mealPlanId).eq('status', 'planned').is('removed_at', null)
        .order('sort_order'),
    ])
    setPlan(planRes.data)

    // Sort meals by day order, filter out empty slots
    const sorted = (mealsRes.data || [])
      .filter(m => m.custom_name || m.slot_type === 'eating_out' || m.slot_type === 'leftover')
      .sort((a, b) => DOW_KEYS.indexOf(a.day_of_week) - DOW_KEYS.indexOf(b.day_of_week))
    setMeals(sorted)
    setLoading(false)
  }

  async function markMeal(mealId, status) {
    // Optimistic advance
    const nextIdx = currentIdx + 1

    // DB update
    const now = new Date().toISOString()
    await supabase.from('planned_meals').update({
      status,
      ...(status === 'completed' ? { cooked_at: now } : {}),
      quick_reviewed: true,
    }).eq('id', mealId)

    logActivity({ user: appUser, actionType: `meal_${status}`, targetType: 'planned_meal', targetId: mealId })

    if (nextIdx >= meals.length) {
      await closeOutWeek()
    } else {
      setCurrentIdx(nextIdx)
    }
  }

  async function closeOutWeek() {
    await supabase.from('meal_plans').update({
      reviewed_at: new Date().toISOString(),
      auto_closed: false,
      status: 'reviewed',
    }).eq('id', mealPlanId)

    // Reset on_list for all meals in the closed week
    await supabase.from('planned_meals').update({ on_list: false }).eq('meal_plan_id', mealPlanId)

    logActivity({ user: appUser, actionType: 'week_reviewed', targetType: 'meal_plan', targetId: mealPlanId })
    setDone(true)
  }

  function goBack() {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1)
    } else {
      navigate(-1)
    }
  }

  const firstName = appUser?.name?.split(' ')[0] || ''

  // ── Loading ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: color.paper, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
        <TopBar centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Week Review</span>} />
        <div style={{ padding: '40px 22px', color: color.inkSoft, fontStyle: 'italic' }}>Loading...</div>
      </div>
    )
  }

  // ── No meals to review ───────────────────────────────────
  if (meals.length === 0 && !done) {
    return (
      <div style={{ background: color.paper, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
        <TopBar leftAction={{ onClick: () => navigate(-1), label: 'Back' }}
          centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Week Review</span>} />
        <div style={{ padding: '60px 22px', textAlign: 'center' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: color.ink, marginBottom: '8px' }}>
            Nothing to review.
          </div>
          <div style={{ fontSize: '13px', color: color.inkSoft, marginBottom: '24px' }}>
            No meals were planned this week.
          </div>
          <button onClick={async () => { await closeOutWeek(); navigate('/') }} style={{
            padding: '12px 28px', borderRadius: '20px', border: 'none',
            background: arcColor, color: 'white', fontSize: '13px', fontWeight: 500,
            fontFamily: "'Jost', sans-serif", cursor: 'pointer',
          }}>Close out this week</button>
        </div>
      </div>
    )
  }

  // ── Done screen ──────────────────────────────────────────
  if (done) {
    return (
      <div style={{
        background: color.paper, minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
        fontFamily: "'Jost', sans-serif", display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '40px 30px',
      }}>
        <div style={{ fontSize: '28px', color: arcColor, marginBottom: '20px' }}>✦</div>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 500,
          color: color.ink, marginBottom: '12px',
        }}>
          Thanks, {firstName}.
        </div>
        <div style={{
          fontSize: '14px', color: color.inkSoft, lineHeight: 1.7,
          textAlign: 'center', maxWidth: '280px', marginBottom: '32px',
        }}>
          Every week you review helps Roux understand your family better. What worked gets remembered.
        </div>
        <button onClick={() => navigate('/')} style={{
          padding: '12px 32px', borderRadius: '20px', border: 'none',
          background: arcColor, color: 'white', fontSize: '14px', fontWeight: 500,
          fontFamily: "'Jost', sans-serif", cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(30,55,35,0.2)',
        }}>
          Back to home
        </button>
      </div>
    )
  }

  // ── Day card ─────────────────────────────────────────────
  const meal = meals[currentIdx]
  const dayName = DOW_NAMES[meal.day_of_week] || meal.day_of_week
  const mealName = meal.custom_name || (meal.slot_type === 'eating_out' ? 'Eating Out' : meal.slot_type === 'leftover' ? 'Leftovers' : 'Untitled')
  const MEAL_TYPE_LABELS = { dinner: 'Dinner', lunch: 'Lunch', breakfast: 'Breakfast', other: 'Other', eating_out: 'Eating Out' }
  const typeLabel = MEAL_TYPE_LABELS[meal.meal_type] || 'Dinner'

  // Week date for display
  const weekStart = plan?.week_start_date ? new Date(plan.week_start_date + 'T00:00:00') : null
  const dayIdx = DOW_KEYS.indexOf(meal.day_of_week)
  const mealDate = weekStart ? new Date(weekStart.getTime() + dayIdx * 86400000) : null
  const dateStr = mealDate ? mealDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

  return (
    <div style={{
      background: color.paper, minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      fontFamily: "'Jost', sans-serif", fontWeight: 300,
      display: 'flex', flexDirection: 'column',
    }}>
      <TopBar
        leftAction={{ onClick: goBack, label: 'Back' }}
        centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Week Review</span>}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 22px' }}>

        {/* Progress */}
        <div style={{ fontSize: '11px', color: color.inkSoft, letterSpacing: '1px', marginBottom: '24px' }}>
          {currentIdx + 1} of {meals.length}
        </div>

        {/* Day card */}
        <div style={{
          background: 'white', borderRadius: '16px', border: `0.5px solid ${color.rule}`,
          padding: '28px 24px', width: '100%', maxWidth: '340px', textAlign: 'center',
          marginBottom: '28px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: color.inkSoft, marginBottom: '6px' }}>
            {dayName} {dateStr}
          </div>
          <div style={{
            fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500,
            color: color.ink, lineHeight: 1.3, marginBottom: '10px',
          }}>
            {mealName}
          </div>
          <span style={{
            display: 'inline-block', fontSize: '10px', fontWeight: 500, letterSpacing: '1px',
            textTransform: 'uppercase', padding: '3px 10px', borderRadius: '10px',
            background: '#EFF4EC', color: color.forest,
          }}>
            {typeLabel}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '340px' }}>
          <button onClick={() => markMeal(meal.id, 'completed')} style={{
            width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
            background: arcColor, color: 'white',
            fontSize: '15px', fontWeight: 500, fontFamily: "'Jost', sans-serif", cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(30,55,35,0.2)',
          }}>
            Made it
          </button>
          <button onClick={() => markMeal(meal.id, 'completed')} style={{
            width: '100%', padding: '14px', borderRadius: '14px',
            border: `1.5px solid ${arcColor}`, background: 'transparent', color: arcColor,
            fontSize: '15px', fontWeight: 500, fontFamily: "'Jost', sans-serif", cursor: 'pointer',
          }}>
            Close enough
          </button>
          <button onClick={() => markMeal(meal.id, 'skipped')} style={{
            width: '100%', padding: '14px', borderRadius: '14px',
            border: `1px solid ${color.rule}`, background: 'transparent', color: color.inkSoft,
            fontSize: '15px', fontWeight: 400, fontFamily: "'Jost', sans-serif", cursor: 'pointer',
          }}>
            Skipped
          </button>
        </div>
      </div>
    </div>
  )
}
