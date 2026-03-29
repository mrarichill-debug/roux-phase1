/**
 * Dashboard.jsx — Home screen.
 * Matches prototypes/roux-dashboard-cuttingboard.html exactly.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchCalendarEvents } from '../lib/calendarSync'
import { sageBusyNightDetection } from '../lib/sageBusyNightDetection'
import WatermarkLayer from '../components/WatermarkLayer'
import TopBar from '../components/TopBar'
import { getWeekDatesTZ, getWeekStartTZ, getDayOfWeekTZ, getTodayStr, timeGreetingTZ, toLocalDateStr } from '../lib/dateUtils'
import BottomNav from '../components/BottomNav'
import SageNudgeCard from '../components/SageNudgeCard'
import SageIntelligenceCard from '../components/SageIntelligenceCard'
import { getSageIntelligence } from '../lib/getSageIntelligence'

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
  const [spendUsedPct, setSpendUsedPct]     = useState(null)
  const [shopTile, setShopTile]             = useState({ state: 'none', listCount: 0, totalSpent: 0, remaining: 0 })
  const [activeTemplateName, setActiveTemplateName] = useState(null)
  const [loading, setLoading]               = useState(true)  // Phase 1+2 loading
  const [sageMessages, setSageMessages] = useState([]) // unified Sage nudge queue
  const [sageIntelligence, setSageIntelligence] = useState(null)
  const [sageIndex, setSageIndex] = useState(0) // which message is currently shown

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

      // Read template name from joined table
      setActiveTemplateName(plan?.meal_plan_templates?.name || null)

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

        // Count items in parallel
        console.time('[Roux] Phase 3: spending')
        const sid = primaryList.id
        const [totalRes, purchasedRes] = await Promise.all([
          supabase.from('shopping_list_items').select('id', { count: 'exact', head: true }).eq('shopping_list_id', sid),
          supabase.from('shopping_list_items').select('id', { count: 'exact', head: true }).eq('shopping_list_id', sid).eq('is_purchased', true),
        ])
        const total     = totalRes.count ?? 0
        const purchased = purchasedRes.count ?? 0
        if (total > 0) setSpendUsedPct(Math.round((purchased / total) * 100))
        console.timeEnd('[Roux] Phase 3: spending')
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
      setSageIndex(0)

      // Run busy night detection if calendar is connected
      if (appUser.calendar_sync_enabled) {
        fetchCalendarEvents(appUser, weekDates).then(events => {
          if (events?.length) {
            sageBusyNightDetection({ calendarEvents: events, meals: weekMeals, weekDates, appUser })
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

  // Compute open dinner days (today onward) for Sage nudge
  const plannedDows = new Set(weekMeals.map(m => m.day_of_week))
  const openDayNames = weekDates
    .slice(todayMbIdx)
    .filter(d => !plannedDows.has(DOW_KEYS[getMondayBasedIndex(d.getDay())]))
    .map(d => MON_SHORT[getMondayBasedIndex(d.getDay())])

  // Add dynamic open-days message to sage queue (after weekMeals resolves)
  useEffect(() => {
    if (loading || !weekMeals) return
    let openMsg = null
    if (openDayNames.length === 1) {
      openMsg = `${openDayNames[0]} doesn't have a dinner planned yet. Want me to suggest something?`
    } else if (openDayNames.length >= 2) {
      const last = openDayNames[openDayNames.length - 1]
      const other = openDayNames.slice(0, -1).join(', ')
      openMsg = `${other} and ${last} don't have dinners yet. I have some ideas that would work with this week's groceries.`
    }
    if (openMsg) {
      setSageMessages(prev => {
        if (prev.some(m => m.source === 'open_days')) return prev
        return [{ id: 'open-days', message: openMsg, actionLabel: 'Plan your week →', actionUrl: '/thisweek', source: 'open_days' }, ...prev]
      })
    }
  }, [loading, openDayNames.length])

  // Plan status text for greeting
  const plannedCount = weekMeals.length
  const planStatusText = !activePlan ? 'No plan yet'
    : activePlan.status === 'published' ? 'Plan published'
    : activePlan.status === 'active'    ? 'Week active'
    : activePlan.status === 'draft'     ? 'Draft in progress'
    : activePlan.status === 'completed' ? 'Week complete'
    : 'Plan exists'

  return (
    <div style={{
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
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span>{plannedCount} of 7 nights planned</span>
              {activeTemplateName && (
                <>
                  <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: C.linen, flexShrink: 0 }} />
                  <span>{activeTemplateName}</span>
                </>
              )}
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: C.linen, flexShrink: 0 }} />
              <span>{planStatusText}</span>
            </div>
          )}
        </div>

        {/* ── Tonight Card ──────────────────────────────────────────────── */}
        {loading ? (
          <ShimmerCard height="160px" margin="0 22px 14px" />
        ) : tonightMeal ? (
          <TonightFilled meal={tonightMeal} onView={() => navigate(tonightMeal.recipe_id ? `/recipe/${tonightMeal.recipe_id}` : '/thisweek', tonightMeal.recipe_id ? { state: { from: '/' } } : undefined)} />
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
            onFullPlan={() => navigate('/thisweek')}
          />
        )}

        {/* ── Unified Sage Nudge ─────────────────────────────────────── */}
        {sageMessages.length > 0 && sageIndex < sageMessages.length && (() => {
          const msg = sageMessages[sageIndex]
          return (
            <SageNudgeCard
              message={msg.message}
              actionLabel={msg.actionLabel}
              onAction={msg.onLinkAction || (msg.actionUrl ? () => navigate(msg.actionUrl) : undefined)}
              count={sageMessages.length}
              currentIndex={sageIndex}
              onDismiss={msg.noDismiss ? undefined : async () => {
                // Mark stored messages as seen
                if (msg.dbId) {
                  await supabase.from('sage_background_activity').update({ seen: true }).eq('id', msg.dbId)
                }
                // Advance to next or clear
                if (sageIndex < sageMessages.length - 1) {
                  setSageIndex(i => i + 1)
                } else {
                  setSageMessages([])
                  setSageIndex(0)
                }
              }}
            />
          )
        })()}

        {/* ── Sage Intelligence ───────────────────────────────────────── */}
        <SageIntelligenceCard intelligence={sageIntelligence} />

        {/* ── Spending Snapshot ─────────────────────────────────────────── */}
        <SpendingSnapshot
          shoppingList={shoppingList}
          usedPct={spendUsedPct}
          loading={loading}
        />

        {/* ── Quick Access ──────────────────────────────────────────────── */}
        <QuickAccess navigate={navigate} shopTile={shopTile} />

      </div>

      {/* ── Bottom Nav ────────────────────────────────────────────────────── */}
      <BottomNav activeTab="today" />

    </div>
  )
}

// ── Shared icon button style (topbar) ─────────────────────────────────────────
const iconBtnStyle = {
  width: '38px', height: '38px', borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', background: 'none', cursor: 'pointer',
  color: 'rgba(210,230,200,0.7)',
  position: 'relative',
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

// ── Tonight Card — filled (cutting board) ────────────────────────────────────
function TonightFilled({ meal, onView }) {
  const mealName = getMealName(meal)
  const tradition = meal.household_traditions?.name
  const prepMin = meal.recipes?.prep_time_minutes

  return (
    <div
      className="tonight-board"
      style={{ margin: '0 22px 14px' }}
      onClick={onView}
    >
      <div style={{ padding: '20px 20px 18px', position: 'relative', zIndex: 1 }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '11px' }}>
          <div style={{
            fontSize: '9px', fontWeight: 500, letterSpacing: '2.5px',
            textTransform: 'uppercase', color: 'rgba(80,38,8,0.52)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
            Tonight
          </div>
          {tradition && (
            <span style={{
              fontSize: '10px', fontWeight: 500, padding: '4px 10px', borderRadius: '20px',
              background: 'rgba(80,38,8,0.12)', color: 'rgba(60,25,5,0.88)',
              border: '1px solid rgba(80,38,8,0.18)', letterSpacing: '0.2px',
            }}>
              {tradition}
            </span>
          )}
        </div>

        {/* Meal name */}
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '27px', fontWeight: 500,
          color: 'rgba(40,18,4,0.92)', lineHeight: 1.2, marginBottom: '16px',
        }}>
          {mealName ?? 'Dinner'}
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(80,38,8,0.14)', marginBottom: '14px' }} />

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {prepMin && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'rgba(80,38,8,0.58)', fontWeight: 300, flex: 1 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, opacity: 0.65 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
                <strong style={{ color: 'rgba(40,18,4,0.88)', fontWeight: 500 }}>{prepMin}m</strong>&nbsp;prep
              </div>
              <div style={{ width: '1px', height: '16px', background: 'rgba(80,38,8,0.14)', margin: '0 8px' }} />
            </>
          )}
          <button
            onClick={e => { e.stopPropagation(); onView() }}
            style={{
              fontSize: '11px', fontWeight: 500, letterSpacing: '0.3px',
              color: 'rgba(40,18,4,0.80)', background: 'rgba(80,38,8,0.10)',
              border: '1px solid rgba(80,38,8,0.20)', borderRadius: '8px',
              padding: '6px 13px', cursor: 'pointer', whiteSpace: 'nowrap',
              marginLeft: 'auto',
            }}
          >
            View recipe →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tonight Card — empty state (cutting board with dashed groove) ──────────────
function TonightEmpty({ onPlan }) {
  return (
    <div
      className="tonight-board"
      style={{ margin: '0 22px 14px' }}
      onClick={onPlan}
    >
      <div style={{ padding: '20px 20px 18px', position: 'relative', zIndex: 1 }}>
        {/* Top row */}
        <div style={{
          fontSize: '9px', fontWeight: 500, letterSpacing: '2.5px',
          textTransform: 'uppercase', color: 'rgba(80,38,8,0.52)',
          display: 'flex', alignItems: 'center', gap: '6px',
          marginBottom: '11px',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
          Tonight
        </div>

        {/* Empty state text */}
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '27px', fontWeight: 500, fontStyle: 'italic',
          color: 'rgba(40,18,4,0.45)', lineHeight: 1.2, marginBottom: '16px',
        }}>
          What's for dinner?
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(80,38,8,0.14)', marginBottom: '14px' }} />

        {/* Footer */}
        <button
          onClick={e => { e.stopPropagation(); onPlan() }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(80,38,8,0.14)', color: 'rgba(40,18,4,0.80)',
            border: '1px solid rgba(80,38,8,0.20)', borderRadius: '8px',
            padding: '6px 13px', cursor: 'pointer',
            fontFamily: "'Jost', sans-serif", fontSize: '11px', fontWeight: 500,
            letterSpacing: '0.3px',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Plan tonight's meal
        </button>
      </div>
    </div>
  )
}

// ── This Week Strip ───────────────────────────────────────────────────────────
function WeekStrip({ weekDates, weekMeals, todayMbIdx, onFullPlan }) {
  const plannedMap = {}
  weekMeals.forEach(m => {
    plannedMap[m.day_of_week] = m
  })

  return (
    <div style={{ margin: '0 22px 14px', position: 'relative', zIndex: 1, animation: 'fadeUp 0.4s ease 0.10s both' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
        <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm }}>
          This Week
        </span>
        <button
          onClick={onFullPlan}
          style={{
            fontSize: '12px', color: C.forest, background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 400,
            fontFamily: "'Jost', sans-serif",
          }}
        >
          Full plan
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '5px' }}>
        {weekDates.map((d, i) => {
          const isToday   = i === todayMbIdx
          const dowKey    = DOW_KEYS[getMondayBasedIndex(d.getDay())]
          const meal      = plannedMap[dowKey]
          const hasPlanned = !!meal
          const hasTrad   = hasPlanned && !!meal.tradition_id
          const isOpen    = !hasPlanned

          return (
            <div
              key={i}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                padding: '9px 4px 7px', borderRadius: '11px',
                background: isToday ? C.forest : isOpen ? 'rgba(250,247,242,0.5)' : 'white',
                border: `1px ${isOpen ? 'dashed' : 'solid'} ${isToday ? C.forest : 'rgba(200,185,160,0.5)'}`,
                boxShadow: isToday ? '0 3px 10px rgba(30,65,42,0.22), 0 8px 20px rgba(30,65,42,0.14)' : '0 1px 3px rgba(80,60,30,0.05)',
                transform: isToday ? 'translateY(-2px)' : 'none',
                cursor: 'pointer',
                transition: 'transform 0.12s',
              }}
            >
              <span style={{
                fontSize: '8px', fontWeight: 500, letterSpacing: '1px',
                textTransform: 'uppercase',
                color: isToday ? 'rgba(255,255,255,0.58)' : C.driftwood,
              }}>
                {MON_SHORT[i]}
              </span>
              <span style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '16px', fontWeight: 400, lineHeight: 1,
                color: isToday ? 'white' : isOpen ? 'rgba(140,123,107,0.45)' : C.ink,
              }}>
                {d.getDate()}
              </span>
              {/* Pip */}
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: isToday
                  ? (hasTrad ? C.honey : 'rgba(255,255,255,0.55)')
                  : hasTrad
                  ? C.honey
                  : hasPlanned
                  ? C.sage
                  : 'rgba(200,185,160,0.45)',
                animation: `pipIn 0.3s ease ${0.15 + i * 0.04}s both`,
              }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Spending Snapshot ─────────────────────────────────────────────────────────
function SpendingSnapshot({ shoppingList, usedPct, loading }) {
  if (loading) return <ShimmerCard height="120px" margin="0 22px 14px" />

  const estimated = shoppingList?.estimated_cost
  const spent     = shoppingList?.actual_cost
  const variance  = (estimated != null && spent != null) ? (estimated - spent) : null
  const under     = variance != null && variance >= 0

  // No data yet
  if (!shoppingList || (estimated == null && spent == null)) {
    return (
      <div style={{
        margin: '0 22px 14px',
        background: 'white',
        border: '1px solid rgba(200,185,160,0.55)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(80,60,30,0.06), 0 3px 10px rgba(80,60,30,0.04)',
        animation: 'fadeUp 0.4s ease 0.18s both',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          padding: '13px 16px 12px',
          borderBottom: '1px solid rgba(232,224,208,0.8)',
        }}>
          <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm }}>
            This Week's Spend
          </span>
        </div>
        <div style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
          <span style={{ fontSize: '13px', color: C.driftwood, fontWeight: 300, lineHeight: 1.5 }}>
            Spending insights appear after your first completed week.
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      margin: '0 22px 14px',
      background: 'white',
      border: '1px solid rgba(200,185,160,0.55)',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(80,60,30,0.06), 0 3px 10px rgba(80,60,30,0.04)',
      animation: 'fadeUp 0.4s ease 0.18s both',
      position: 'relative', zIndex: 1,
    }}>
      {/* Header */}
      <div style={{
        padding: '13px 16px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(232,224,208,0.8)',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm }}>
          This Week's Spend
        </span>
        {variance != null && (
          <span style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '12px', fontWeight: 500, padding: '3px 9px', borderRadius: '20px',
            background: under ? 'rgba(61,107,79,0.08)' : 'rgba(180,55,55,0.07)',
            color: under ? C.forest : C.red,
            border: `1px solid ${under ? 'rgba(61,107,79,0.14)' : 'rgba(180,55,55,0.15)'}`,
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
              <path d={under ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'} />
            </svg>
            ${Math.abs(Math.round(variance))} {under ? 'under' : 'over'}
          </span>
        )}
      </div>

      {/* Three figures */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr', alignItems: 'stretch' }}>
        <SpendFig
          value={estimated != null ? `$${Math.round(estimated)}` : '—'}
          label="Estimated"
          quiet
        />
        <div style={{ background: 'rgba(232,224,208,0.7)' }} />
        <SpendFig
          value={spent != null ? `$${Math.round(spent)}` : '—'}
          label="Spent"
        />
        <div style={{ background: 'rgba(232,224,208,0.7)' }} />
        <SpendFig
          value={usedPct != null ? `${usedPct}%` : '—'}
          label="Used"
          win={usedPct != null && usedPct >= 80}
          alignRight
        />
      </div>

      {/* Sage insight */}
      <div style={{
        padding: '10px 16px 11px',
        borderTop: '1px dashed rgba(200,185,160,0.6)',
        display: 'flex', alignItems: 'center', gap: '7px',
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0 }}>
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>
        <span style={{ fontSize: '11.5px', color: C.driftwoodSm, fontWeight: 300, lineHeight: 1.4 }}>
          Weeks with 5+ planned meals tend to save on groceries — you're on track.
        </span>
      </div>
    </div>
  )
}

function SpendFig({ value, label, quiet, win, alignRight }) {
  return (
    <div style={{
      padding: '14px 12px 13px',
      textAlign: alignRight ? 'right' : quiet ? 'left' : 'center',
      paddingLeft:  quiet ? '16px' : '12px',
      paddingRight: alignRight ? '16px' : '12px',
    }}>
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: quiet ? '19px' : '23px',
        fontWeight: 400,
        color: win ? C.forest : quiet ? C.driftwood : C.ink,
        lineHeight: 1, marginBottom: '4px', letterSpacing: '-0.5px',
      }}>
        {value}
      </div>
      <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.8px', textTransform: 'uppercase', color: C.driftwoodSm }}>
        {label}
      </div>
    </div>
  )
}

// ── Quick Access ─────────────────────────────────────────────────────────────
function QuickAccess({ navigate, shopTile }) {
  // Shopping tile — context-aware label, subtext, and accent
  let shopLabel   = 'Shopping List'
  let shopSub     = 'No list yet'
  let shopAccent  = null  // null = default muted, 'forest' or 'honey'
  let shopCheck   = false

  const spentStr = shopTile.totalSpent > 0 ? `$${Math.round(shopTile.totalSpent)}` : '$0'
  const listStr  = `${shopTile.listCount} list${shopTile.listCount !== 1 ? 's' : ''}`

  if (shopTile.state === 'active') {
    shopLabel  = 'Shopping'
    shopSub    = `${shopTile.remaining} item${shopTile.remaining !== 1 ? 's' : ''} left`
    shopAccent = 'forest'
  } else if (shopTile.state === 'complete') {
    shopLabel  = 'Main shop done'
    shopSub    = `${listStr} · ${spentStr} spent`
    shopAccent = 'forest'
    shopCheck  = true
  } else if (shopTile.state === 'needs-run') {
    shopLabel  = 'Add another run?'
    shopSub    = `${listStr} · ${spentStr} spent`
    shopAccent = 'honey'
  }

  const shopIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" x2="21" y1="6" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  )

  const tiles = [
    {
      label: 'Add a Meal',
      onClick: () => navigate('/thisweek'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
          <rect width="18" height="18" x="3" y="4" rx="2"/>
          <line x1="16" x2="16" y1="2" y2="6"/>
          <line x1="8" x2="8" y1="2" y2="6"/>
          <line x1="3" x2="21" y1="10" y2="10"/>
          <line x1="12" x2="12" y1="14" y2="18"/>
          <line x1="10" x2="14" y1="16" y2="16"/>
        </svg>
      ),
    },
    {
      label: 'Browse Recipes',
      onClick: () => navigate('/meals/recipes'),
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      ),
    },
    {
      // TODO: "By Ingredient" needs its own screen before go-live — dead tap for now
      label: 'By Ingredient',
      onClick: () => {},
      disabled: true,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: 17, height: 17 }}>
          <path d="M12 22V12"/>
          <path d="M12 12C12 8 9 5 5 5c0 4 3 7 7 7"/>
          <path d="M12 12c0-4 3-7 7-7-1 4-4 7-7 7"/>
        </svg>
      ),
    },
  ]

  const iconBg = shopAccent === 'forest' ? 'rgba(61,107,79,0.10)'
    : shopAccent === 'honey' ? 'rgba(196,154,60,0.10)'
    : 'rgba(122,140,110,0.08)'
  const iconColor = shopAccent === 'honey' ? C.honey : C.forest
  const borderColor = shopAccent === 'honey' ? 'rgba(196,154,60,0.4)' : 'rgba(200,185,160,0.55)'

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px',
      padding: '0 22px',
      animation: 'fadeUp 0.4s ease 0.22s both',
      position: 'relative', zIndex: 1,
    }}>
      {tiles.map(tile => (
        <button
          key={tile.label}
          onClick={tile.onClick}
          style={{
            background: 'white',
            border: '1px solid rgba(200,185,160,0.55)',
            borderRadius: '14px',
            padding: '13px 5px 11px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '7px',
            cursor: tile.disabled ? 'default' : 'pointer',
            boxShadow: '0 1px 4px rgba(80,60,30,0.06), 0 3px 8px rgba(80,60,30,0.04)',
            transition: 'transform 0.12s',
            opacity: tile.disabled ? 0.6 : 1,
            fontFamily: "'Jost', sans-serif",
          }}
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(122,140,110,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: C.forest,
          }}>
            {tile.icon}
          </div>
          <span style={{ fontSize: '9px', fontWeight: 500, color: C.driftwoodSm, textAlign: 'center', letterSpacing: '0.2px', lineHeight: 1.35 }}>
            {tile.label}
          </span>
        </button>
      ))}

      {/* Shopping tile — context-aware */}
      <button
        onClick={() => navigate('/pantry')}
        style={{
          background: 'white',
          border: `1px solid ${borderColor}`,
          borderRadius: '14px',
          padding: '13px 5px 11px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
          cursor: 'pointer',
          boxShadow: '0 1px 4px rgba(80,60,30,0.06), 0 3px 8px rgba(80,60,30,0.04)',
          transition: 'transform 0.12s',
          fontFamily: "'Jost', sans-serif",
        }}
      >
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor, position: 'relative',
        }}>
          {shopIcon}
          {shopCheck && (
            <svg viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              style={{ width: 9, height: 9, position: 'absolute', bottom: '-1px', right: '-1px' }}
            >
              <path d="m9 11 3 3L22 4"/>
            </svg>
          )}
        </div>
        <span style={{
          fontSize: '9px', fontWeight: 500, textAlign: 'center',
          letterSpacing: '0.2px', lineHeight: 1.35,
          color: shopAccent === 'honey' ? C.honey : shopAccent === 'forest' ? C.forest : C.driftwood,
        }}>
          {shopLabel}
        </span>
        <span style={{
          fontSize: '7px', fontWeight: 400, color: C.driftwood,
          textAlign: 'center', lineHeight: 1.2,
          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {shopSub}
        </span>
      </button>
    </div>
  )
}

