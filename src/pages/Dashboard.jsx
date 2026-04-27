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
import PageEyebrow from '../components/PageEyebrow'
import HairlineRow from '../components/HairlineRow'
import KitchenNote from '../components/KitchenNote'
import { getWeekDatesTZ, getWeekStartTZ, getDayOfWeekTZ, timeGreetingTZ } from '../lib/dateUtils'
import BottomNav from '../components/BottomNav'
import { getSageIntelligence } from '../lib/getSageIntelligence'
import { getIntelligenceMessage } from '../lib/getIntelligenceMessage'
import { useArc } from '../context/ArcContext'
import { JOKES } from '../lib/jokes'
import { color, alpha, elevation } from '../styles/tokens'

// ── Design tokens ──────────────────────────────────────────────────────────────
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

function getMealName(meal) {
  if (!meal) return null
  if (meal.slot_type === 'leftover') return 'Leftovers'
  if (meal.slot_type === 'eating_out') return 'Eating Out'
  return meal.custom_name || meal.meals?.name || meal.recipes?.name || meal.note || null
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Dashboard({ appUser }) {
  const { color: arcColor, stage: arcStage } = useArc()
  const navigate = useNavigate()

  const [activePlan, setActivePlan]         = useState(null)
  const [tonightMeal, setTonightMeal]       = useState(null)
  const [weekMeals, setWeekMeals]           = useState([])
  const [shoppingList, setShoppingList]     = useState(null)
  const [shopTile, setShopTile]             = useState({ state: 'none', listCount: 0, totalSpent: 0, remaining: 0 })
  const [loading, setLoading]               = useState(true)
  const [sageMessages, setSageMessages] = useState([]) // unified Sage nudge queue
  const [unreviewedPlanId, setUnreviewedPlanId] = useState(null)
  const [sageIntelligence, setSageIntelligence] = useState(null)

  const tz         = appUser?.timezone ?? 'America/Chicago'
  const weekDates  = getWeekDatesTZ(tz)                     // [Mon..Sun]
  const today      = new Date()
  const todayJsDay = getDayOfWeekTZ(tz)                     // 0=Sun..6=Sat in user's TZ
  const todayDow   = DOW_KEYS[todayJsDay]                   // e.g. 'thursday'
  const todayMbIdx = getMondayBasedIndex(todayJsDay)        // 0=Mon..6=Sun
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
          .eq('status', 'planned')
          .maybeSingle(),

        supabase.from('planned_meals')
          .select('day_of_week, status, tradition_id, slot_type, note, custom_name, created_at, updated_at')
          .eq('meal_plan_id', plan.id)
          .eq('meal_type', 'dinner')
          .eq('status', 'planned'),

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

      // Check for unreviewed past weeks (deferred)
      const now = new Date()
      const dayOfWeek = now.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const currentMonday = new Date(now)
      currentMonday.setDate(now.getDate() - daysToMonday)
      currentMonday.setHours(0, 0, 0, 0)
      supabase.from('meal_plans').select('id').eq('household_id', hid)
        .lt('week_start_date', currentMonday.toISOString().split('T')[0])
        .is('reviewed_at', null).eq('auto_closed', false).limit(1).maybeSingle()
        .then(({ data: pastPlan }) => { if (pastPlan) setUnreviewedPlanId(pastPlan.id) })

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
      tonightMeal,
      shoppingList,
      sageIntelligence,
      sageMessages,
      calendarConnected: !!appUser?.calendar_sync_enabled,
      shopTile,
      appUser,
    }, arcStage)
  }, [loading, activePlan, weekMeals, tonightMeal, shoppingList, sageIntelligence, sageMessages, shopTile, arcStage])

  // Persist shown intelligence message (7-day dedup tracking)
  useEffect(() => {
    if (!intel?.messageId || !appUser?.id) return
    const prefs = appUser?.preferences || {}
    const shown = { ...(prefs.shown_messages || {}), [intel.messageId]: new Date().toISOString() }
    supabase.from('users').update({ preferences: { ...prefs, shown_messages: shown } }).eq('id', appUser.id)
  }, [intel?.messageId])

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

  // Plan status text for greeting
  const plannedCount = Math.min(new Set(weekMeals.map(m => m.day_of_week)).size, 7)

  // Up next: next 2 planned meals after today (Mon-based week ordering).
  const upNextMeals = useMemo(() => {
    if (loading) return []
    const order = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
    const labels = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' }
    const todayIdx = order.indexOf(todayDow)
    const futureIdx = (dow) => {
      const i = order.indexOf(dow)
      return i > todayIdx ? i : i + 100  // push past-week days to the back
    }
    return weekMeals
      .filter(m => order.indexOf(m.day_of_week) > todayIdx)
      .sort((a, b) => futureIdx(a.day_of_week) - futureIdx(b.day_of_week))
      .slice(0, 2)
      .map(m => ({
        day_of_week: m.day_of_week,
        shortDow: labels[m.day_of_week] || '',
        name: m.custom_name || m.note || 'Untitled',
      }))
  }, [loading, weekMeals, todayDow])

  return (
    <div className="page-scroll-container" style={{
      background: color.paper,
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

        {/* ── Greeting (PageEyebrow) ────────────────────────────────────── */}
        <div style={{ animation: 'fadeUp 0.4s ease both' }}>
          <PageEyebrow
            kicker={formatGreetingDate(today)}
            title={`${timeGreetingTZ(tz)},`}
            titleAccent={loading ? '…' : `${firstName}.`}
            subtitle={loading ? null : `${plannedCount} of 7 nights planned`}
          />
        </div>

        {/* ── This Week Strip ───────────────────────────────────────────── */}
        {loading ? (
          <ShimmerCard height="70px" margin="0 18px" />
        ) : (
          <WeekStrip
            weekDates={weekDates}
            weekMeals={weekMeals}
            todayMbIdx={todayMbIdx}
            onSeeAll={() => navigate('/plan')}
            arcColor={arcColor}
          />
        )}

        {/* ── Divider ──────────────────────────────────────────────────── */}
        {!loading && <div style={{ height: '0.5px', background: color.rule, margin: '16px 18px' }} />}

        {/* ── Tonight Card ──────────────────────────────────────────────── */}
        {loading ? (
          <ShimmerCard height="56px" margin="0 18px" />
        ) : tonightMeal ? (
          <TonightCard meal={tonightMeal} arcColor={arcColor} onView={() => navigate(tonightMeal.recipe_id ? `/recipe/${tonightMeal.recipe_id}` : '/plan', tonightMeal.recipe_id ? { state: { from: '/' } } : undefined)} />
        ) : (
          <TonightEmpty onPlan={() => navigate('/plan')} />
        )}

        {/* ── Divider ──────────────────────────────────────────────────── */}
        {!loading && <div style={{ height: '0.5px', background: color.rule, margin: '16px 18px' }} />}

        {/* ── Week closeout prompt ───────────────────────────────────── */}
        {!loading && unreviewedPlanId && (
          <div style={{
            borderLeft: `2px solid ${color.rule}`, paddingLeft: '14px',
            margin: '14px 18px 0',
          }}>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: '14px', fontStyle: 'italic',
              color: color.ink, lineHeight: 1.7, marginBottom: '8px',
            }}>
              Last week is ready to close out — takes about a minute.
            </div>
            <button onClick={() => navigate(`/review/${unreviewedPlanId}`)} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: '12px', color: arcColor, fontWeight: 500,
              fontFamily: "'Jost', sans-serif",
            }}>
              Close out last week →
            </button>
          </div>
        )}

        {/* ── A note from your kitchen (Direction A pull-quote) ────────── */}
        {loading ? (
          <ShimmerCard height="84px" margin="14px 0 0" />
        ) : intel ? (
          <KitchenNote>{intel.message}</KitchenNote>
        ) : jokeData ? (
          <KitchenNote>{jokeData.text}</KitchenNote>
        ) : null}

        {/* ── Up next this week (HairlineRow list — next 2 planned meals) ── */}
        {!loading && (() => {
          const rest = upNextMeals
          if (rest.length === 0) return null
          return (
            <div style={{ marginTop: '14px' }}>
              <div style={{
                padding: '0 22px 8px',
                fontSize: '9px', fontWeight: 500, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: color.inkSoft,
                fontFamily: "'Jost', sans-serif",
              }}>
                Up next this week
              </div>
              {rest.map((m, i) => (
                <HairlineRow
                  key={m.day_of_week}
                  isLast={i === rest.length - 1}
                  onClick={() => navigate('/plan')}
                  left={
                    <span style={{
                      fontFamily: "'Playfair Display', serif",
                      fontStyle: 'italic',
                      fontSize: '14px',
                      color: color.sage,
                      width: '40px',
                      display: 'inline-block',
                    }}>{m.shortDow}</span>
                  }
                  center={
                    <span style={{
                      fontFamily: "'Jost', sans-serif",
                      fontSize: '14px',
                      color: color.ink,
                      fontWeight: 400,
                    }}>{m.name}</span>
                  }
                  right={<span style={{ fontSize: '16px' }}>›</span>}
                />
              ))}
            </div>
          )
        })()}

      </div>

      {/* ── Bottom Nav ────────────────────────────────────────────────────── */}
      <BottomNav activeTab="home" />

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

// ── Intelligence section — left accent line on cream ─────────────────────────
function IntelligenceCard({ intel, navigate, arcColor, arcStage }) {
  const { message, arcAnswer, primaryAction, secondaryAction } = intel

  return (
    <div style={{
      borderLeft: `2.5px solid ${color.rule}`,
      paddingLeft: '14px',
      margin: '14px 18px 0',
      animation: 'fadeUp 0.4s ease 0.06s both',
    }}>
      {/* Message — Playfair italic */}
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: '14px',
        fontStyle: 'italic',
        color: color.ink,
        lineHeight: 1.7,
        marginBottom: '12px',
      }}>
        {message}
      </div>

      {/* Arc label */}
      <div style={{
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: color.inkSoft,
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
        marginBottom: '10px',
      }}>
        {arcAnswer}
      </div>

      {/* Arc progress dots */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
        {[1,2,3,4,5,6,7].map(s => (
          <div key={s} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: s <= arcStage
              ? (s <= 2 ? color.forest : s <= 4 ? color.sage : s <= 6 ? color.honey : '#A07830')
              : color.rule,
          }} />
        ))}
      </div>

      {/* Action buttons — pill style */}
      {(primaryAction || secondaryAction) && (
        <div style={{ display: 'flex', gap: '10px' }}>
          {primaryAction && (
            <button
              onClick={() => primaryAction.route && navigate(primaryAction.route)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '20px',
                border: 'none',
                background: arcColor,
                color: color.paper,
                fontSize: '11px',
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
                padding: '8px 0',
                borderRadius: '20px',
                border: `0.5px solid ${arcColor}`,
                background: 'transparent',
                color: arcColor,
                fontSize: '11px',
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

// ── Humor Card — on cream, no card border ───────────────────────────────────
function HumorCard({ joke, arcColor }) {
  return (
    <div style={{
      margin: '14px 18px 0',
      textAlign: 'center',
      animation: 'fadeUp 0.4s ease 0.06s both',
    }}>
      <div style={{ height: '0.5px', background: color.rule, marginBottom: '16px' }} />
      <div style={{ fontSize: '14px', color: arcColor, marginBottom: '8px' }}>
        ✦
      </div>
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: '12px',
        fontStyle: 'italic',
        color: color.inkSoft,
        lineHeight: 1.7,
      }}>
        {joke}
      </div>
    </div>
  )
}

// ── Tonight Card — left accent line on cream ────────────────────────────────
function TonightCard({ meal, onView, arcColor }) {
  const mealName = getMealName(meal)
  const slotType = meal.slot_type
  const tradition = meal.household_traditions?.name

  const typeLabel = slotType === 'eating_out' ? 'Eating Out'
    : slotType === 'leftover' ? 'Leftovers'
    : 'Dinner'

  return (
    <div
      onClick={onView}
      style={{
        borderLeft: `2px solid ${arcColor}`,
        paddingLeft: '14px',
        margin: '0 18px',
        cursor: 'pointer',
        animation: 'fadeUp 0.4s ease 0.08s both',
      }}
    >
      {/* Top row: label + pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '9px', fontWeight: 500, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: color.inkSoft,
        }}>
          Tonight
        </span>
        <span style={{
          fontSize: '9px', fontWeight: 500, padding: '2px 8px', borderRadius: '10px',
          background: '#EFF4EC', color: color.forest,
          border: '0.5px solid #C8D9C0',
        }}>
          {typeLabel}
        </span>
        {tradition && (
          <span style={{
            fontSize: '9px', fontWeight: 500, padding: '2px 8px', borderRadius: '10px',
            background: 'rgba(196,154,60,0.12)', color: '#A07830',
          }}>
            {tradition}
          </span>
        )}
      </div>

      {/* Meal name */}
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: '17px', fontWeight: 500,
        color: color.ink, lineHeight: 1.3,
      }}>
        {mealName ?? 'Dinner'}
      </div>

      {/* View recipe link */}
      {meal.recipe_id && (
        <button
          onClick={e => { e.stopPropagation(); onView() }}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontSize: '9px', fontWeight: 400, color: color.inkSoft,
            fontFamily: "'Jost', sans-serif", marginTop: '6px',
          }}
        >
          View recipe →
        </button>
      )}
    </div>
  )
}

// ── Tonight Card — empty state (linen left border on cream) ─────────────────
function TonightEmpty({ onPlan }) {
  return (
    <div
      onClick={onPlan}
      style={{
        borderLeft: `2px dashed ${color.rule}`,
        paddingLeft: '14px',
        margin: '0 18px',
        cursor: 'pointer',
        animation: 'fadeUp 0.4s ease 0.08s both',
      }}
    >
      <span style={{
        fontSize: '9px', fontWeight: 500, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: color.inkSoft,
        marginBottom: '6px', display: 'block',
      }}>
        Tonight
      </span>
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: '16px', fontWeight: 500, fontStyle: 'italic',
        color: 'rgba(140,123,107,0.5)', lineHeight: 1.3,
      }}>
        What's for dinner?
      </div>
      <button
        onClick={e => { e.stopPropagation(); onPlan() }}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          background: 'rgba(140,123,107,0.08)', color: color.inkSoft,
          border: `1px solid ${color.rule}`, borderRadius: '8px',
          padding: '5px 12px', cursor: 'pointer', marginTop: '8px',
          fontFamily: "'Jost', sans-serif", fontSize: '11px', fontWeight: 500,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Plan tonight
      </button>
    </div>
  )
}

// ── This Week Strip — on cream, no card wrapper ─────────────────────────────
function WeekStrip({ weekDates, weekMeals, todayMbIdx, onSeeAll, arcColor }) {
  const plannedMap = {}
  weekMeals.forEach(m => { plannedMap[m.day_of_week] = m })

  return (
    <div style={{
      padding: '14px 18px 0',
      animation: 'fadeUp 0.4s ease 0.12s both',
      position: 'relative', zIndex: 1,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: color.inkSoft }}>
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

      {/* Day tiles — sage-light fill for planned, sage outline ring for today */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '5px' }}>
        {weekDates.map((d, i) => {
          const isToday    = i === todayMbIdx
          const dowKey     = DOW_KEYS[d.getDay()]
          const hasPlanned = !!plannedMap[dowKey]

          return (
            <div
              key={i}
              onClick={onSeeAll}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                padding: '7px 2px 6px', borderRadius: '10px',
                background: hasPlanned ? color.sageLight : 'transparent',
                outline: isToday ? `1.5px solid ${color.sage}` : 'none',
                outlineOffset: isToday ? '1px' : undefined,
                border: hasPlanned || isToday ? 'none' : `1px solid ${color.rule}`,
                cursor: 'pointer',
              }}
            >
              <span style={{
                fontSize: '8px', fontWeight: 500, letterSpacing: '0.8px',
                textTransform: 'uppercase',
                color: hasPlanned ? color.sageDark : isToday ? color.sage : color.inkSoft,
              }}>
                {MON_SHORT[i]}
              </span>
              <span style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '15px', fontWeight: 400, lineHeight: 1,
                color: hasPlanned ? color.ink : isToday ? color.ink : color.inkSoft,
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

