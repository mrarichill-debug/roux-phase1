/**
 * Dashboard.jsx — Home screen (intelligence-first layout).
 * Hero: Intelligence card → Tonight card → Week strip.
 * Removed: weekly spend widget, shortcut buttons, Sage message list.
 */

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchCalendarEvents } from '../lib/calendarSync'
import { sageBusyNightDetection } from '../lib/sageBusyNightDetection'
import WatermarkLayer from '../components/WatermarkLayer'
import TopBar from '../components/TopBar'
import { getWeekDatesTZ, getWeekStartTZ, getDayOfWeekTZ, timeGreetingTZ } from '../lib/dateUtils'
import BottomNav from '../components/BottomNav'
import { getSageIntelligence } from '../lib/getSageIntelligence'
import { getIntelligenceMessage } from '../lib/getIntelligenceMessage'
import { getArcStage } from '../lib/getArcStage'
import { getArcColor } from '../lib/getArcColor'
import { JOKES } from '../lib/jokes'

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  forest:    '#3D6B4F',
  forestDk:  '#2E5038',
  sage:      '#7A8C6E',
  honey:     '#C49A3C',
  cream:     '#FAF7F2',
  ink:       '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E',
  linen:     '#E8E0D0',
  walnut:    '#8B6F52',
  red:       '#A03030',
}

// ── Date/time helpers ──────────────────────────────────────────────────────────
const DOW_KEYS  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const MON_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] // Mon-based

function getMondayBasedIndex(jsDay) {
  // Convert JS getDay() (0=Sun) to Monday-based index (0=Mon, 6=Sun)
  return jsDay === 0 ? 6 : jsDay - 1
}

function formatGreetingDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function getDayType(jsDay) {
  // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  if (jsDay === 0 || jsDay === 6) return { label: 'Weekend', color: '#3D6B4F', bg: 'rgba(61,107,79,0.10)', border: 'rgba(61,107,79,0.18)' }
  return { label: 'School Day', color: '#3A6CB5', bg: 'rgba(91,141,217,0.10)', border: 'rgba(91,141,217,0.18)' }
}

function getMealName(meal) {
  if (!meal) return null
  if (meal.slot_type === 'meal')     return meal.meals?.name ?? null
  if (meal.slot_type === 'recipe')   return meal.recipes?.name ?? null
  if (meal.slot_type === 'note')     return meal.note ?? null
  if (meal.slot_type === 'leftover') return 'Leftovers'
  if (meal.slot_type === 'takeout')  return 'Eating Out'
  return meal.meals?.name ?? meal.recipes?.name ?? meal.note ?? null
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Dashboard({ appUser }) {
  const navigate = useNavigate()

  const [activePlan, setActivePlan]         = useState(null)
  const [tonightMeal, setTonightMeal]       = useState(null)
  const [weekMeals, setWeekMeals]           = useState([])
  const [shoppingList, setShoppingList]     = useState(null)
  const [shopTile, setShopTile]             = useState({ state: 'none', listCount: 0, totalSpent: 0, remaining: 0 })
  const [loading, setLoading]               = useState(true)
  const [sageMessages, setSageMessages] = useState([]) // unified Sage nudge queue
  const [sageIntelligence, setSageIntelligence] = useState(null)

  const tz         = appUser?.timezone ?? 'America/Chicago'
  const weekDates  = getWeekDatesTZ(tz)                     // [Mon..Sun]
  const today      = new Date()
  const todayJsDay = getDayOfWeekTZ(tz)                     // 0=Sun..6=Sat in user's TZ
  const todayDow   = DOW_KEYS[todayJsDay]                   // e.g. 'thursday'
  const todayMbIdx = getMondayBasedIndex(todayJsDay)        // 0=Mon..6=Sun
  const dayType    = getDayType(todayJsDay)
  const firstName  = appUser?.name?.split(' ')[0] ?? ''

  useEffect(() => {
    if (appUser?.household_id) loadDashboardData()
  }, [appUser?.household_id])

  async function loadDashboardData() {
    console.time('[Roux] Dashboard total')
    setLoading(true)
    try {
      const hid = appUser.household_id
      const weekStart = getWeekStartTZ(tz)

      // ── Phase 1: Get the active plan ─────────────────────────────────
      console.time('[Roux] Phase 1: plan')
      const { data: plan } = await supabase.from('meal_plans')
        .select('id, status, week_start_date, week_end_date, template_id, meal_plan_templates(name)')
        .eq('household_id', hid)
        .eq('week_start_date', weekStart)
        .maybeSingle()
      console.timeEnd('[Roux] Phase 1: plan')

      setActivePlan(plan)

      if (!plan) {
        setLoading(false)
        console.timeEnd('[Roux] Dashboard total')
        return
      }

      // ── Phase 2: Tonight + week strip + shopping lists — all parallel ──
      console.time('[Roux] Phase 2: meals+lists')
      const [tonightRes, weekRes, shoppingRes] = await Promise.all([
        supabase.from('planned_meals')
          .select('*, meals(name), recipes(name, prep_time_minutes), household_traditions(name)')
          .eq('meal_plan_id', plan.id)
          .eq('day_of_week', todayDow)
          .eq('meal_type', 'dinner')
          .maybeSingle(),

        supabase.from('planned_meals')
          .select('day_of_week, status, tradition_id, slot_type, note, created_at, updated_at')
          .eq('meal_plan_id', plan.id)
          .eq('meal_type', 'dinner'),

        supabase.from('shopping_lists')
          .select('id, status, estimated_cost, actual_cost, updated_at')
          .eq('meal_plan_id', plan.id)
          .order('created_at'),
      ])
      console.timeEnd('[Roux] Phase 2: meals+lists')

      if (tonightRes.data) setTonightMeal(tonightRes.data)
      if (weekRes.data)    setWeekMeals(weekRes.data)

      // Show primary content now — Phase 3 fills in details
      setLoading(false)

      // ── Phase 3 (deferred): Spending snapshot + shopping tile state ────
      const allLists = shoppingRes.data ?? []
      const primaryList = allLists[0] ?? null

      if (primaryList) {
        setShoppingList(primaryList)
      }

      // Sage intelligence — deferred, non-blocking
      getSageIntelligence(supabase, hid).then(data => setSageIntelligence(data))

      // Shopping tile state
      if (allLists.length === 0) {
        setShopTile({ state: 'none', listCount: 0, totalSpent: 0, remaining: 0 })
      } else {
        const completedLists = allLists.filter(l => l.status === 'completed')
        const activeLists    = allLists.filter(l => l.status !== 'completed')
        const totalSpent     = allLists.reduce((sum, l) => sum + (parseFloat(l.actual_cost) || 0), 0)
        const listCount      = allLists.length

        if (activeLists.length > 0) {
          // Count remaining items across all active lists in parallel
          const activeIds = activeLists.map(l => l.id)
          const remainingCounts = await Promise.all(
            activeIds.map(lid =>
              supabase.from('shopping_list_items')
                .select('id', { count: 'exact', head: true })
                .eq('shopping_list_id', lid)
                .eq('is_purchased', false)
                .then(r => r.count ?? 0)
            )
          )
          const remaining = remainingCounts.reduce((sum, c) => sum + c, 0)
          setShopTile({ state: 'active', listCount, totalSpent, remaining })
        } else if (completedLists.length > 0) {
          const latestComplete = completedLists.reduce((a, b) =>
            new Date(a.updated_at) > new Date(b.updated_at) ? a : b
          )
          const meals = weekRes.data ?? []
          const mealsChangedAfter = meals.some(m => {
            const mTime = new Date(m.updated_at || m.created_at)
            return mTime > new Date(latestComplete.updated_at)
          })
          setShopTile({
            state: mealsChangedAfter ? 'needs-run' : 'complete',
            listCount, totalSpent, remaining: 0,
          })
        }
      }
      // Build unified Sage message queue
      const messages = []

      // 1. Pending ingredient reviews
      const { data: pendingRes } = await supabase.from('recipes')
        .select('id, name')
        .eq('household_id', hid)
        .eq('sage_assist_status', 'pending')
        .limit(5)
      if (pendingRes?.length) {
        messages.push({
          id: `review-${pendingRes[0].id}`,
          message: pendingRes.length === 1
            ? `I took a look at ${pendingRes[0].name} after you saved it — I have a suggestion or two about the ingredients.`
            : `I reviewed ${pendingRes.length} recipes you recently saved and have some ingredient suggestions.`,
          actionLabel: 'See suggestions →',
          actionUrl: `/recipe/${pendingRes[0].id}`,
          source: 'review',
        })
      }

      // 2. Unseen Sage background activity
      const { data: bgActivity } = await supabase.from('sage_background_activity')
        .select('id, message, activity_type, recipe_id, metadata, created_at')
        .eq('household_id', hid)
        .eq('seen', false)
        .order('created_at')
        .limit(5)
      for (const bg of (bgActivity || [])) {
        const entry = { id: `bg-${bg.id}`, dbId: bg.id, message: bg.message, source: 'background' }
        // recipe_match entries get a "Link it" action
        if (bg.activity_type === 'recipe_match' && bg.recipe_id && bg.metadata?.matched_meal_id) {
          entry.actionLabel = 'Link it →'
          entry.onLinkAction = async () => {
            // Write to junction table, not planned_meals.recipe_id
            await supabase.from('planned_meal_recipes').upsert(
              { planned_meal_id: bg.metadata.matched_meal_id, recipe_id: bg.recipe_id, sort_order: 0 },
              { onConflict: 'planned_meal_id,recipe_id' }
            )
            await supabase.from('planned_meals').update({
              entry_type: 'linked', sage_match_status: 'resolved',
            }).eq('id', bg.metadata.matched_meal_id)
            await supabase.from('sage_background_activity').update({ seen: true }).eq('id', bg.id)
            setSageMessages(prev => prev.filter(m => m.id !== entry.id))
          }
        }
        // calendar_context nudges with action URL
        if (bg.activity_type === 'calendar_context' && bg.metadata?.action_url) {
          const dayName = bg.metadata.day_of_week ? bg.metadata.day_of_week.charAt(0).toUpperCase() + bg.metadata.day_of_week.slice(1) : 'that day'
          entry.actionLabel = `Plan ${dayName} →`
          entry.actionUrl = bg.metadata.action_url
          entry.dayOfWeek = dayName
        }
        messages.push(entry)
      }

      // 3. Check for unreviewd past week
      const lastWeekStart = getWeekStartTZ(tz, -1)
      const { data: lastPlan } = await supabase.from('meal_plans')
        .select('id, week_end_date, reviewed_at')
        .eq('household_id', hid)
        .eq('week_start_date', lastWeekStart)
        .maybeSingle()
      if (lastPlan && !lastPlan.reviewed_at) {
        const endDate = new Date((lastPlan.week_end_date || lastWeekStart) + 'T20:00:00')
        if (new Date() > endDate) {
          messages.unshift({
            id: 'weekly-review',
            message: `Hey ${appUser.name?.split(' ')[0] || 'there'} — how did last week go? Closing it out takes less than a minute.`,
            actionLabel: "Let's do it →",
            actionUrl: `/review/${lastPlan.id}`,
            source: 'review',
            noDismiss: true,
          })
        }
      }

      setSageMessages(messages)

      // Run busy night detection if calendar is connected
      if (appUser.calendar_sync_enabled) {
        fetchCalendarEvents(appUser, weekDates).then(events => {
          if (events?.length) {
            sageBusyNightDetection({ calendarEvents: events, meals: weekRes.data ?? [], weekDates, appUser })
          }
        })
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
      console.timeEnd('[Roux] Dashboard total')
    }
  }

  // ── Intelligence message (derived from already-fetched data) ──
  const intel = useMemo(() => {
    if (loading) return null
    return getIntelligenceMessage({
      activePlan,
      weekMeals,
      shoppingList,
      sageIntelligence,
      sageMessages,
      calendarConnected: !!appUser?.calendar_sync_enabled,
      shopTile,
    })
  }, [loading, activePlan, weekMeals, shoppingList, sageIntelligence, sageMessages, shopTile])

  // ── Humor card (fallback when no intelligence message) ────────
  const jokeData = useMemo(() => {
    if (loading || intel) return null
    const prefs = appUser?.preferences || {}
    const lastShown = prefs.last_joke_shown ? new Date(prefs.last_joke_shown) : null
    const daysSince = lastShown ? (Date.now() - lastShown.getTime()) / (1000 * 60 * 60 * 24) : Infinity

    if (daysSince < 10) return null // too soon

    const lastIdx = typeof prefs.last_joke_index === 'number' ? prefs.last_joke_index : -1
    const nextIdx = (lastIdx + 1) % JOKES.length
    return { text: JOKES[nextIdx], nextIdx }
  }, [loading, intel, appUser?.id])

  // Persist joke state in a separate effect (not inside useMemo)
  useEffect(() => {
    if (!jokeData || !appUser?.id) return
    const prefs = appUser?.preferences || {}
    const newPrefs = { ...prefs, last_joke_index: jokeData.nextIdx, last_joke_shown: new Date().toISOString() }
    supabase.from('users').update({ preferences: newPrefs }).eq('id', appUser.id)
  }, [jokeData?.nextIdx])

  // ── Arc stage + color (derived from already-fetched intelligence data) ──
  const arcStage = useMemo(() => {
    if (loading || !sageIntelligence) return 1
    const score = sageIntelligence.score || { receipts: 0, reviews: 0, meals: 0, staples: 0 }
    return getArcStage({
      mealsCount: score.meals,
      weeksClosedOut: score.reviews,
      receiptsScanned: score.receipts,
      skipsDetected: 0,
    })
  }, [loading, sageIntelligence])

  const arcColor = getArcColor(arcStage)

  // Plan status text for greeting
  const plannedCount = Math.min(new Set(weekMeals.map(m => m.day_of_week)).size, 7)

  return (
    <div className="page-scroll-container" style={{
      background: C.cream,
      fontFamily: "'Jost', sans-serif",
      fontWeight: 300,
      minHeight: '100vh',
      maxWidth: '430px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 8px))',
    }}>

      <WatermarkLayer />

      <TopBar />

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>

        {/* ── Greeting ──────────────────────────────────────────────────── */}
        <div style={{
          padding: '24px 22px 18px',
          animation: 'fadeUp 0.4s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{
              fontSize: '10px', letterSpacing: '2.5px', textTransform: 'uppercase',
              color: C.sage, fontWeight: 500,
            }}>
              {formatGreetingDate(today)}
            </span>
            <span style={{
              fontSize: '10px', fontWeight: 400, letterSpacing: '0.8px',
              textTransform: 'uppercase', padding: '2px 8px', borderRadius: '4px',
              fontFamily: "'Jost', sans-serif",
              background: dayType.bg, color: dayType.color,
            }}>
              {dayType.label}
            </span>
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '29px', fontWeight: 500, color: C.ink, lineHeight: 1.2,
            margin: 0,
          }}>
            {timeGreetingTZ(tz)},<br />
            <em style={{ fontStyle: 'italic', color: C.sage }}>
              {loading ? '…' : `${firstName}.`}
            </em>
          </h1>

          {!loading && (
            <div style={{
              marginTop: '5px', fontSize: '12px', color: C.driftwoodSm, fontWeight: 300,
            }}>
              {plannedCount} of 7 nights planned
            </div>
          )}
        </div>

        {/* ── Intelligence Card (hero) ─────────────────────────────────── */}
        {loading ? (
          <ShimmerCard height="140px" margin="0 22px 14px" />
        ) : intel ? (
          <IntelligenceCard intel={intel} navigate={navigate} arcColor={arcColor} />
        ) : jokeData ? (
          <HumorCard joke={jokeData.text} />
        ) : null}

        {/* ── Tonight Card ──────────────────────────────────────────────── */}
        {loading ? (
          <ShimmerCard height="110px" margin="0 22px 14px" />
        ) : tonightMeal ? (
          <TonightCard meal={tonightMeal} onView={() => navigate(tonightMeal.recipe_id ? `/recipe/${tonightMeal.recipe_id}` : '/thisweek', tonightMeal.recipe_id ? { state: { from: '/' } } : undefined)} />
        ) : (
          <TonightEmpty onPlan={() => navigate('/thisweek')} />
        )}

        {/* ── This Week Strip ───────────────────────────────────────────── */}
        {loading ? (
          <ShimmerCard height="88px" margin="0 22px 14px" />
        ) : (
          <WeekStrip
            weekDates={weekDates}
            weekMeals={weekMeals}
            todayMbIdx={todayMbIdx}
            onSeeAll={() => navigate('/thisweek')}
            arcColor={arcColor}
          />
        )}

      </div>

      {/* ── Bottom Nav ────────────────────────────────────────────────────── */}
      <BottomNav activeTab="today" />

    </div>
  )
}

// ── Shimmer placeholder card ──────────────────────────────────────────────────
function ShimmerCard({ height, margin }) {
  return (
    <div
      className="shimmer-block"
      style={{ height, margin: margin ?? '0 22px 14px' }}
    />
  )
}

// ── Intelligence Card (hero) ─────────────────────────────────────────────────
function IntelligenceCard({ intel, navigate, arcColor }) {
  const { message, arcAnswer, primaryAction, secondaryAction } = intel

  return (
    <div style={{
      margin: '0 22px 14px',
      background: 'white',
      border: '0.5px solid var(--linen)',
      borderRadius: '16px',
      padding: '18px 20px',
      animation: 'fadeUp 0.4s ease 0.06s both',
      position: 'relative', zIndex: 1,
    }}>
      {/* Message */}
      <div style={{
        fontSize: '13px',
        color: C.ink,
        lineHeight: 1.65,
        fontFamily: "'Jost', sans-serif",
        fontWeight: 300,
        marginBottom: '14px',
      }}>
        {message}
      </div>

      {/* Arc label */}
      <div style={{
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: C.driftwood,
        marginBottom: '4px',
      }}>
        What can Roux do for you?
      </div>

      {/* Arc answer */}
      <div style={{
        fontSize: '12px',
        fontWeight: 500,
        color: arcColor,
        fontFamily: "'Jost', sans-serif",
        marginBottom: (primaryAction || secondaryAction) ? '16px' : 0,
      }}>
        {arcAnswer}
      </div>

      {/* Action buttons */}
      {(primaryAction || secondaryAction) && (
        <div style={{ display: 'flex', gap: '10px' }}>
          {primaryAction && (
            <button
              onClick={() => primaryAction.route && navigate(primaryAction.route)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
                border: 'none',
                background: arcColor,
                color: 'white',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: "'Jost', sans-serif",
                cursor: 'pointer',
              }}
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={() => secondaryAction.route && navigate(secondaryAction.route)}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '10px',
                border: `1px solid ${arcColor}`,
                background: 'transparent',
                color: arcColor,
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: "'Jost', sans-serif",
                cursor: 'pointer',
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Humor Card (quiet moment fallback) ───────────────────────────────────────
function HumorCard({ joke }) {
  return (
    <div style={{
      margin: '0 22px 14px',
      background: 'white',
      border: '0.5px solid var(--linen)',
      borderRadius: '16px',
      padding: '22px 20px',
      textAlign: 'center',
      animation: 'fadeUp 0.4s ease 0.06s both',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{
        fontSize: '16px',
        color: C.honey,
        marginBottom: '10px',
      }}>
        ✦
      </div>
      <div style={{
        fontSize: '12px',
        fontStyle: 'italic',
        color: C.ink,
        lineHeight: 1.7,
        fontFamily: "'Jost', sans-serif",
        fontWeight: 300,
      }}>
        {joke}
      </div>
    </div>
  )
}

// ── Tonight Card — slim cutting board ────────────────────────────────────────
function TonightCard({ meal, onView }) {
  const mealName = getMealName(meal)
  const slotType = meal.slot_type
  const tradition = meal.household_traditions?.name

  // Meal type pill label
  const typeLabel = slotType === 'takeout' ? 'Eating Out'
    : slotType === 'leftover' ? 'Leftovers'
    : slotType === 'note' ? 'Quick Note'
    : 'Dinner'

  return (
    <div
      className="tonight-board"
      style={{ margin: '0 22px 14px' }}
      onClick={onView}
    >
      <div style={{ padding: '16px 18px 14px', position: 'relative', zIndex: 1 }}>
        {/* Top row: label + pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '9px', fontWeight: 500, letterSpacing: '2.5px',
            textTransform: 'uppercase', color: 'rgba(80,38,8,0.52)',
          }}>
            Tonight
          </span>
          <span style={{
            fontSize: '9px', fontWeight: 500, padding: '2px 8px', borderRadius: '10px',
            background: 'rgba(80,38,8,0.10)', color: 'rgba(60,25,5,0.75)',
            border: '1px solid rgba(80,38,8,0.14)',
          }}>
            {typeLabel}
          </span>
          {tradition && (
            <span style={{
              fontSize: '9px', fontWeight: 500, padding: '2px 8px', borderRadius: '10px',
              background: 'rgba(80,38,8,0.10)', color: 'rgba(60,25,5,0.75)',
              border: '1px solid rgba(80,38,8,0.14)',
            }}>
              {tradition}
            </span>
          )}
        </div>

        {/* Meal name */}
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '22px', fontWeight: 500,
          color: 'rgba(40,18,4,0.92)', lineHeight: 1.2, marginBottom: '10px',
        }}>
          {mealName ?? 'Dinner'}
        </div>

        {/* View recipe link */}
        {meal.recipe_id && (
          <button
            onClick={e => { e.stopPropagation(); onView() }}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: '11px', fontWeight: 400, color: 'rgba(80,38,8,0.58)',
              fontFamily: "'Jost', sans-serif",
            }}
          >
            View recipe →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Tonight Card — empty state ──────────────────────────────────────────────
function TonightEmpty({ onPlan }) {
  return (
    <div
      className="tonight-board"
      style={{ margin: '0 22px 14px' }}
      onClick={onPlan}
    >
      <div style={{ padding: '16px 18px 14px', position: 'relative', zIndex: 1 }}>
        <span style={{
          fontSize: '9px', fontWeight: 500, letterSpacing: '2.5px',
          textTransform: 'uppercase', color: 'rgba(80,38,8,0.52)',
          marginBottom: '8px', display: 'block',
        }}>
          Tonight
        </span>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '20px', fontWeight: 500, fontStyle: 'italic',
          color: 'rgba(40,18,4,0.40)', lineHeight: 1.2, marginBottom: '10px',
        }}>
          What's for dinner?
        </div>
        <button
          onClick={e => { e.stopPropagation(); onPlan() }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: 'rgba(80,38,8,0.12)', color: 'rgba(40,18,4,0.80)',
            border: '1px solid rgba(80,38,8,0.18)', borderRadius: '8px',
            padding: '5px 12px', cursor: 'pointer',
            fontFamily: "'Jost', sans-serif", fontSize: '11px', fontWeight: 500,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Plan tonight
        </button>
      </div>
    </div>
  )
}

// ── This Week Strip ───────────────────────────────────────────────────────────
function WeekStrip({ weekDates, weekMeals, todayMbIdx, onSeeAll, arcColor }) {
  const plannedMap = {}
  weekMeals.forEach(m => { plannedMap[m.day_of_week] = m })

  return (
    <div style={{
      margin: '0 22px 14px',
      background: 'white',
      border: '0.5px solid var(--linen)',
      borderRadius: '16px',
      padding: '14px 16px 12px',
      animation: 'fadeUp 0.4s ease 0.12s both',
      position: 'relative', zIndex: 1,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm }}>
          This week
        </span>
        <button
          onClick={onSeeAll}
          style={{
            fontSize: '12px', color: arcColor, background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 400,
            fontFamily: "'Jost', sans-serif",
          }}
        >
          See all →
        </button>
      </div>

      {/* Day tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '5px' }}>
        {weekDates.map((d, i) => {
          const isToday   = i === todayMbIdx
          const dowKey    = DOW_KEYS[d.getDay()]
          const hasPlanned = !!plannedMap[dowKey]

          return (
            <div
              key={i}
              onClick={onSeeAll}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                padding: '7px 2px 6px', borderRadius: '10px',
                background: hasPlanned ? arcColor : 'transparent',
                border: isToday && !hasPlanned
                  ? `1.5px solid ${C.honey}`
                  : hasPlanned
                  ? 'none'
                  : `1px solid ${C.linen}`,
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontSize: '8px', fontWeight: 500, letterSpacing: '0.8px',
                textTransform: 'uppercase',
                color: hasPlanned ? 'rgba(255,255,255,0.6)' : C.driftwood,
              }}>
                {MON_SHORT[i]}
              </span>
              <span style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '15px', fontWeight: 400, lineHeight: 1,
                color: hasPlanned ? 'white' : isToday ? C.ink : 'rgba(140,123,107,0.5)',
              }}>
                {d.getDate()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

