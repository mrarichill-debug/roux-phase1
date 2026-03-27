/**
 * ThisWeek.jsx — Menu Planner.
 * The week is a blank canvas menu, not a slot-based form.
 * Each day is a card. Lauren adds meals by typing. Meal type is optional metadata.
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { sageMealMatch } from '../lib/sageMealMatch'
import { injectMealPlanToList } from '../lib/injectMealPlanToList'
import { getWeekDatesTZ, getWeekStartTZ, toLocalDateStr } from '../lib/dateUtils'
import { fetchCalendarEvents, getEventsForDate } from '../lib/calendarSync'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E', linen: '#E8E0D0',
  sage: '#7A8C6E', honey: '#C49A3C', red: '#A03030',
}

const DOW_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_ABBR = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const MEAL_TYPES = ['breakfast','lunch','dinner','other']
const MEAL_TYPE_LABELS = { dinner: 'Dinner', lunch: 'Lunch', breakfast: 'Breakfast', other: 'Other' }

export default function ThisWeek({ appUser }) {
  const navigate = useNavigate()
  const tz = appUser?.timezone || 'America/Chicago'

  const [weekOffset, setWeekOffset] = useState(0)
  const [weekDates, setWeekDates] = useState(() => getWeekDatesTZ(tz, 0))
  const [weekStart, setWeekStart] = useState(() => getWeekStartTZ(tz, 0))
  const [planId, setPlanId] = useState(null)
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [dayTypes, setDayTypes] = useState({}) // dowKey → day type name

  // Add sheet state
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [addSheetDate, setAddSheetDate] = useState(null) // Date object
  const [addInput, setAddInput] = useState('')
  const [addMealType, setAddMealType] = useState('dinner')
  const [recipeSuggestions, setRecipeSuggestions] = useState([])
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [adding, setAdding] = useState(false)
  const debounceRef = useRef(null)

  // Calendar events
  const [calendarEvents, setCalendarEvents] = useState([])

  // First-time hint
  const [showHint, setShowHint] = useState(false)

  // Share / finalization
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [planStatus, setPlanStatus] = useState(null) // 'draft' | 'shared'
  const [shoppingInjected, setShoppingInjected] = useState(false)
  const [injecting, setInjecting] = useState(false)

  // Delete confirm
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // Toast
  const [toast, setToast] = useState('')
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (appUser?.household_id) loadWeek()
  }, [appUser?.household_id, weekOffset])

  // Poll for Sage match results on ghost meals
  useEffect(() => {
    const pendingMeals = meals.filter(m => m.entry_type === 'ghost' && !m.sage_match_status && !m.sage_match_result)
    const unresolvedMeals = meals.filter(m => m.sage_match_status === 'pending' || (m.entry_type === 'ghost' && !m.sage_match_status))
    if (unresolvedMeals.length === 0 || !planId) return

    const interval = setInterval(async () => {
      const { data: updated } = await supabase
        .from('planned_meals')
        .select('id, sage_match_result, sage_match_status, custom_name')
        .eq('meal_plan_id', planId)
        .not('sage_match_status', 'is', null)
      if (updated?.length) {
        setMeals(prev => prev.map(m => {
          const match = updated.find(u => u.id === m.id)
          if (match && match.sage_match_status && !m.sage_match_result) {
            return { ...m, sage_match_result: match.sage_match_result, sage_match_status: match.sage_match_status, custom_name: match.custom_name || m.custom_name }
          }
          return m
        }))
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [meals, planId])

  async function loadWeek() {
    setLoading(true)
    const dates = getWeekDatesTZ(tz, weekOffset)
    const ws = getWeekStartTZ(tz, weekOffset)
    setWeekDates(dates)
    setWeekStart(ws)

    try {
      // Get or find meal plan for this week
      const { data: plan } = await supabase
        .from('meal_plans')
        .select('id, status, shopping_injected')
        .eq('household_id', appUser.household_id)
        .eq('week_start_date', ws)
        .maybeSingle()

      if (plan) {
        setPlanId(plan.id)
        setPlanStatus(plan.status)
        setShoppingInjected(plan.shopping_injected || false)
        // Fetch meals, then recipe names separately (no embedded join)
        const { data: mealsData } = await supabase
          .from('planned_meals')
          .select('*')
          .eq('meal_plan_id', plan.id)
          .order('sort_order')
        // Resolve recipe names
        const recipeIds = (mealsData || []).filter(m => m.recipe_id).map(m => m.recipe_id)
        let recipeMap = {}
        if (recipeIds.length > 0) {
          const { data: recipes } = await supabase.from('recipes').select('id, name, prep_time_minutes').in('id', recipeIds)
          recipeMap = Object.fromEntries((recipes || []).map(r => [r.id, r]))
        }
        const enriched = (mealsData || []).map(m => ({
          ...m,
          recipes: m.recipe_id ? recipeMap[m.recipe_id] || null : null,
        }))
        setMeals(enriched)
      } else {
        setPlanId(null)
        setMeals([])
      }

      // Load day types for display (no embedded join — separate queries)
      if (plan) {
        const { data: dtAssignments } = await supabase
          .from('meal_plan_day_types')
          .select('day_of_week, day_type_id')
          .eq('meal_plan_id', plan.id)
        if (dtAssignments?.length) {
          const dtIds = [...new Set(dtAssignments.map(a => a.day_type_id))]
          const { data: dtDefs } = await supabase
            .from('day_types')
            .select('id, name, color')
            .in('id', dtIds)
          const defMap = Object.fromEntries((dtDefs || []).map(d => [d.id, d]))
          const dtMap = {}
          for (const a of dtAssignments) {
            if (defMap[a.day_type_id]) dtMap[a.day_of_week] = defMap[a.day_type_id]
          }
          setDayTypes(dtMap)
        } else {
          setDayTypes({})
        }
      } else {
        setDayTypes({})
      }
    } catch (err) {
      console.error('[Menu] Load error:', err)
    }
    setLoading(false)

    // Fetch calendar events if sync is enabled
    if (appUser.calendar_sync_enabled) {
      fetchCalendarEvents(appUser, dates).then(setCalendarEvents)
    }

    // Show first-time hint if user hasn't planned a meal yet
    if (!appUser.has_planned_first_meal) {
      // Check if any meals exist globally for this household
      const { count } = await supabase.from('planned_meals').select('id', { count: 'exact', head: true }).eq('household_id', appUser.household_id)
      if (!count || count === 0) setShowHint(true)
    }
  }

  async function ensurePlan() {
    if (planId) return planId
    // week_end_date = 6 days after start (Sunday)
    const [y, m, d] = weekStart.split('-').map(Number)
    const endDate = new Date(y, m - 1, d + 6)
    const wed = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    const { data, error } = await supabase.from('meal_plans').insert({
      household_id: appUser.household_id,
      created_by: appUser.id,
      week_start_date: weekStart,
      week_end_date: wed,
      status: 'draft',
    }).select('id').single()
    if (error) { console.error('[Menu] Create plan error:', error); return null }
    setPlanId(data.id)
    return data.id
  }

  // ── Add meal ──────────────────────────────────────────────────
  function openAddSheet(date) {
    setAddSheetDate(date)
    setAddInput('')
    setAddMealType('dinner')
    setRecipeSuggestions([])
    setSelectedRecipe(null)
    setAddSheetOpen(true)
  }

  function handleAddInputChange(val) {
    setAddInput(val)
    setSelectedRecipe(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setRecipeSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      // Query planned_meals history first — deduplicated by name
      const { data: historyData } = await supabase
        .from('planned_meals')
        .select('id, custom_name, recipe_id, entry_type, meal_type')
        .eq('household_id', appUser.household_id)
        .not('custom_name', 'is', null)
        .ilike('custom_name', `%${val.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(10)
      const seen = new Set()
      const suggestions = (historyData || []).filter(m => {
        const key = m.custom_name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).slice(0, 6).map(m => ({
        id: m.id,
        name: m.custom_name,
        recipe_id: m.recipe_id || null,
        entry_type: m.entry_type,
        meal_type: m.meal_type,
        source: 'history',
      }))
      setRecipeSuggestions(suggestions)
    }, 200)
  }

  function selectRecipeSuggestion(suggestion) {
    setAddInput(suggestion.name)
    // If past meal had a recipe linked, carry it forward
    if (suggestion.recipe_id) {
      setSelectedRecipe({ id: suggestion.recipe_id, name: suggestion.name })
    } else {
      setSelectedRecipe(null)
    }
    // Pre-select the meal type from history
    if (suggestion.meal_type) setAddMealType(suggestion.meal_type)
    setRecipeSuggestions([])
  }

  async function addMeal() {
    if (!addInput.trim() || adding) return
    setAdding(true)
    try {
      const mpId = await ensurePlan()
      if (!mpId) { setAdding(false); return }

      const dateStr = toLocalDateStr(addSheetDate)
      const dowKey = DOW_KEYS[addSheetDate.getDay() === 0 ? 6 : addSheetDate.getDay() - 1]
      const isLinked = !!selectedRecipe

      const { data, error } = await supabase.from('planned_meals').insert({
        household_id: appUser.household_id,
        meal_plan_id: mpId,
        day_of_week: dowKey,
        meal_type: addMealType,
        planned_date: dateStr,
        custom_name: isLinked ? null : addInput.trim(),
        recipe_id: isLinked ? selectedRecipe.id : null,
        entry_type: isLinked ? 'linked' : 'ghost',
        slot_type: isLinked ? 'recipe' : 'note',
        status: 'planned',
        sort_order: meals.filter(m => m.day_of_week === dowKey).length,
      }).select('*').single()

      if (error) throw error
      const enriched = { ...data, recipes: selectedRecipe ? { name: selectedRecipe.name } : null }
      setMeals(prev => [...prev, enriched])
      setAddSheetOpen(false)
      showToast(`Added ${addInput.trim()}`)

      logActivity({
        user: appUser, actionType: 'meal_added_to_week', targetType: 'meal',
        targetId: data.id, targetName: addInput.trim(),
        metadata: { day_of_week: dowKey, entry_type: isLinked ? 'linked' : 'ghost' },
      })

      // Dismiss first-time hint and mark user
      if (showHint || !appUser.has_planned_first_meal) {
        setShowHint(false)
        supabase.from('users').update({ has_planned_first_meal: true }).eq('id', appUser.id)
      }

      // Fire Sage meal match for ghost entries (don't await — background)
      if (!isLinked) {
        sageMealMatch({ mealId: data.id, mealName: addInput.trim(), householdId: appUser.household_id })
      }
    } catch (err) {
      console.error('[Menu] Add meal error:', err)
    }
    setAdding(false)
  }

  async function deleteMeal(mealId) {
    const meal = meals.find(m => m.id === mealId)
    setMeals(prev => prev.filter(m => m.id !== mealId))
    setDeleteConfirmId(null)
    showToast('Removed from menu')

    if (meal) {
      logActivity({
        user: appUser, actionType: 'meal_skipped', targetType: 'meal',
        targetId: mealId, targetName: meal.custom_name || meal.recipes?.name || 'Meal',
        metadata: { day_of_week: meal.day_of_week, recipe_id: meal.recipe_id },
      })
    }

    await supabase.from('planned_meals').delete().eq('id', mealId)
  }

  async function dismissHint() {
    setShowHint(false)
    supabase.from('users').update({ has_planned_first_meal: true }).eq('id', appUser.id)
  }

  async function linkRecipeToMeal(mealId, recipeId, recipeName) {
    setMeals(prev => prev.map(m =>
      m.id === mealId ? { ...m, recipe_id: recipeId, entry_type: 'linked', sage_match_status: 'resolved', recipes: { name: recipeName } } : m
    ))
    await supabase.from('planned_meals').update({
      recipe_id: recipeId, entry_type: 'linked', sage_match_status: 'resolved',
    }).eq('id', mealId)
  }

  async function dismissSageMatch(mealId) {
    setMeals(prev => prev.map(m =>
      m.id === mealId ? { ...m, sage_match_status: 'resolved' } : m
    ))
    await supabase.from('planned_meals').update({ sage_match_status: 'resolved' }).eq('id', mealId)
  }

  // ── Share & inject ─────────────────────────────────────────────
  async function sharePlan() {
    if (!planId) return
    await supabase.from('meal_plans').update({ status: 'shared' }).eq('id', planId)
    setPlanStatus('shared')
    setShareSheetOpen(true)
  }

  async function buildShoppingList() {
    if (!planId || injecting) return
    setInjecting(true)
    const { count } = await injectMealPlanToList({ planId, householdId: appUser.household_id })
    setShoppingInjected(true)
    setShareSheetOpen(false)
    showToast(`Added ${count} item${count !== 1 ? 's' : ''} to your list`)
    setInjecting(false)
    setTimeout(() => navigate('/pantry/list'), 800)
  }

  // ── Computed ──────────────────────────────────────────────────
  const todayStr = toLocalDateStr(new Date())
  const plannedDays = new Set(meals.map(m => m.day_of_week))
  const ghostMeals = meals.filter(m => m.entry_type === 'ghost')

  const weekLabel = weekOffset === 0 ? "This Week's Menu"
    : weekOffset === 1 ? "Next Week's Menu"
    : weekOffset === -1 ? "Last Week's Menu"
    : weekOffset > 0 ? `${weekOffset} Weeks Ahead`
    : `${Math.abs(weekOffset)} Weeks Ago`

  const dateRangeStr = weekDates.length === 7
    ? `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : ''

  function getMealName(m) {
    return m.custom_name || m.recipes?.name || m.note || 'Untitled'
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 8px))',
    }}>
      <TopBar showWordmark={false} centerContent={
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>
          Menu
        </span>
      } />

      {/* ── Week Header ──────────────────────────────────────────── */}
      <div style={{ padding: '12px 22px 0', position: 'relative' }}>
        {/* Row 1: context label + arrows */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: '2px' }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={{
            position: 'absolute', left: 0, background: 'none', border: 'none', cursor: 'pointer',
            color: C.driftwood, padding: '4px', display: 'flex',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontSize: '11px', fontWeight: 300, letterSpacing: '1.2px', textTransform: 'uppercase', color: C.driftwood }}>
            {weekLabel}
          </span>
          <button onClick={() => setWeekOffset(o => o + 1)} style={{
            position: 'absolute', right: 0, background: 'none', border: 'none', cursor: 'pointer',
            color: C.driftwood, padding: '4px', display: 'flex',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        {/* Row 2: date range */}
        <div style={{ textAlign: 'center', fontFamily: "'Playfair Display', serif", fontSize: '17px', color: C.ink, marginBottom: '6px' }}>
          {dateRangeStr}
        </div>

        {/* Row 3: status */}
        <div style={{ textAlign: 'center', fontSize: '11px', color: C.driftwood, fontStyle: 'italic', marginBottom: '12px' }}>
          {plannedDays.size} of 7 nights planned
        </div>
      </div>

      {/* ── Week Strip ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '4px', padding: '0 22px 16px',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        {weekDates.map((date, i) => {
          const dateStr = toLocalDateStr(date)
          const isToday = dateStr === todayStr
          const hasPlanned = meals.some(m => m.day_of_week === DOW_KEYS[i])
          return (
            <button key={i} onClick={() => {
              const el = document.getElementById(`day-${DOW_KEYS[i]}`)
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }} style={{
              flex: '1 0 auto', minWidth: '44px', padding: '6px 8px', borderRadius: '10px',
              border: 'none', cursor: 'pointer', textAlign: 'center',
              background: isToday ? C.forest : 'white',
              color: isToday ? 'white' : C.ink,
              boxShadow: isToday ? '0 2px 8px rgba(61,107,79,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
              fontFamily: "'Jost', sans-serif",
            }}>
              <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', opacity: isToday ? 0.8 : 0.5 }}>
                {DAY_ABBR[i]}
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 500 }}>
                {date.getDate()}
              </div>
              <div style={{
                width: '5px', height: '5px', borderRadius: '50%', margin: '2px auto 0',
                background: hasPlanned ? (isToday ? 'rgba(255,255,255,0.7)' : C.sage) : 'transparent',
              }} />
            </button>
          )
        })}
      </div>

      {/* ── First-time hint ─────────────────────────────────────── */}
      {showHint && (
        <div style={{
          margin: '0 22px 14px', padding: '16px 18px',
          background: 'white', borderRadius: '14px',
          borderLeft: `3px solid ${C.sage}`,
          boxShadow: '0 1px 6px rgba(80,60,30,0.08)',
          animation: 'fadeUp 0.35s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(122,140,110,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 500, color: C.ink, marginBottom: '6px' }}>
                Think of this as your family's weekly menu.
              </div>
              <div style={{ fontSize: '13px', color: C.driftwood, fontWeight: 300, lineHeight: 1.6 }}>
                Tap any day and describe what you want to make — "Chicken tacos with rice" or "Pizza night." Sage will help you find a recipe or save a new one.
              </div>
              <div style={{ textAlign: 'right', marginTop: '10px' }}>
                <button onClick={dismissHint} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '13px', color: C.forest, fontWeight: 500,
                  fontFamily: "'Jost', sans-serif",
                }}>Got it →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Day Cards ────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: '0 22px' }}>
          {[1,2,3].map(i => <div key={i} className="shimmer-block" style={{ height: '80px', borderRadius: '14px', marginBottom: '12px' }} />)}
        </div>
      ) : (
        <div style={{ padding: '0 22px' }}>
          {weekDates.map((date, i) => {
            const dowKey = DOW_KEYS[i]
            const dateStr = toLocalDateStr(date)
            const isToday = dateStr === todayStr
            const dayMeals = meals.filter(m => m.day_of_week === dowKey)
            const dt = dayTypes[dowKey]

            return (
              <div key={dowKey} id={`day-${dowKey}`} style={{
                background: 'white', borderRadius: '14px', marginBottom: '12px',
                border: isToday ? `1.5px solid ${C.forest}` : '1px solid rgba(200,185,160,0.45)',
                overflow: 'hidden',
                animation: `fadeUp 0.35s ease ${0.02 + i * 0.03}s both`,
              }}>
                {/* Day header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: isToday ? C.forest : 'transparent',
                  color: isToday ? 'white' : C.ink,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 500 }}>
                      {isToday ? 'Today' : DAY_NAMES[i]}
                    </span>
                    <span style={{ fontSize: '12px', opacity: 0.6 }}>{date.getDate()}</span>
                  </div>
                  {dt && (
                    <span style={{
                      fontSize: '9px', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase',
                      padding: '2px 8px', borderRadius: '4px',
                      background: isToday ? 'rgba(255,255,255,0.15)' : `${dt.color}18`,
                      color: isToday ? 'rgba(255,255,255,0.8)' : dt.color,
                    }}>{dt.name}</span>
                  )}
                </div>

                {/* Calendar events — vertical, sorted by start time */}
                {(() => {
                  const dayEvents = getEventsForDate(calendarEvents, toLocalDateStr(date))
                    .sort((a, b) => {
                      if (a.allDay && !b.allDay) return -1
                      if (!a.allDay && b.allDay) return 1
                      return (a.start || '').localeCompare(b.start || '')
                    })
                  const shown = dayEvents.slice(0, 3)
                  const overflow = dayEvents.length - 3
                  if (shown.length === 0) return null

                  function formatEventTime(ev) {
                    if (ev.allDay || !ev.start?.includes('T')) return null
                    const startDt = new Date(ev.start)
                    const fmt = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    const startStr = fmt(startDt)
                    if (!ev.end || !ev.end.includes('T')) return startStr
                    const endDt = new Date(ev.end)
                    // Skip end time if midnight or same as start
                    if (endDt.getHours() === 0 && endDt.getMinutes() === 0) return startStr
                    if (ev.start === ev.end) return startStr
                    return `${startStr} – ${fmt(endDt)}`
                  }

                  const textColor = C.driftwoodSm // always on white background, even Today card

                  return (
                    <div style={{ padding: '8px 14px 4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {shown.map(ev => {
                        const timeStr = formatEventTime(ev)
                        const title = (ev.title || '').length > 22 ? (ev.title || '').substring(0, 22) + '…' : (ev.title || '')
                        return (
                          <div key={ev.id} style={{
                            fontSize: '10px', color: textColor, fontFamily: "'Jost', sans-serif", fontWeight: 300,
                            display: 'flex', alignItems: 'center', gap: '5px',
                          }}>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: C.honey, flexShrink: 0 }} />
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                            {timeStr && <span style={{ flexShrink: 0, opacity: 0.8 }}>{timeStr}</span>}
                          </div>
                        )
                      })}
                      {overflow > 0 && (
                        <div style={{ fontSize: '10px', color: textColor, opacity: 0.6, paddingLeft: '9px' }}>+{overflow} more</div>
                      )}
                    </div>
                  )
                })()}

                {/* Meals */}
                <div style={{ padding: dayMeals.length > 0 ? '4px 14px 8px' : '0' }}>
                  {dayMeals.map(meal => {
                    const sageMatches = meal.sage_match_status === 'pending' && meal.sage_match_result?.matches
                    return (
                      <div key={meal.id}>
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: sageMatches ? 'none' : '1px solid rgba(200,185,160,0.15)',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '14px', color: C.ink }}>{getMealName(meal)}</span>
                              {meal.entry_type === 'linked' && (
                                <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0 }}>
                                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                                </svg>
                              )}
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.driftwood }}>
                              {MEAL_TYPE_LABELS[meal.meal_type] || 'Dinner'}
                            </span>
                          </div>
                          {deleteConfirmId === meal.id ? (
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              <button onClick={() => deleteMeal(meal.id)} style={{ fontSize: '11px', color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 500 }}>Remove</button>
                              <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: '11px', color: C.driftwood, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Keep</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirmId(meal.id)} style={{
                              background: 'none', border: 'none', cursor: 'pointer', color: C.driftwood, padding: '4px', flexShrink: 0, opacity: 0.4,
                            }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          )}
                        </div>

                        {/* Sage match suggestion card */}
                        {sageMatches && sageMatches.length > 0 && (
                          <div style={{
                            padding: '10px 12px', marginBottom: '6px',
                            background: 'rgba(122,140,110,0.06)', borderRadius: '8px',
                            borderLeft: `3px solid ${C.sage}`,
                          }}>
                            <div style={{ fontSize: '12px', color: C.ink, marginBottom: '8px', lineHeight: 1.5 }}>
                              <span style={{ color: C.sage }}>✦</span> I found some recipes that might work:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {sageMatches.map(match => (
                                <button key={match.recipe_id} onClick={() => linkRecipeToMeal(meal.id, match.recipe_id, match.recipe_name)} style={{
                                  padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 500,
                                  background: C.forest, color: 'white', border: 'none', cursor: 'pointer',
                                  fontFamily: "'Jost', sans-serif",
                                }}>{match.recipe_name}</button>
                              ))}
                              <button onClick={() => navigate('/save-recipe', { state: { returnTo: 'week', plannedMealId: meal.id, mealName: getMealName(meal) } })} style={{
                                padding: '5px 10px', borderRadius: '8px', fontSize: '11px',
                                background: 'none', color: C.forest, border: `1px solid ${C.forest}`,
                                cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                              }}>Save new recipe</button>
                              <button onClick={() => dismissSageMatch(meal.id)} style={{
                                padding: '5px 10px', borderRadius: '8px', fontSize: '11px',
                                background: 'none', color: C.driftwood, border: `1px solid ${C.linen}`,
                                cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                              }}>Keep as-is</button>
                            </div>
                          </div>
                        )}
                        {/* Sage found no matches but suggests creating */}
                        {meal.sage_match_status === 'pending' && meal.sage_match_result && (!meal.sage_match_result.matches || meal.sage_match_result.matches.length === 0) && (
                          <div style={{
                            padding: '10px 12px', marginBottom: '6px',
                            background: 'rgba(122,140,110,0.06)', borderRadius: '8px',
                            borderLeft: `3px solid ${C.sage}`,
                          }}>
                            <div style={{ fontSize: '12px', color: C.driftwood, marginBottom: '8px', fontStyle: 'italic' }}>
                              <span style={{ color: C.sage }}>✦</span> No matching recipes found — want to save one?
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => navigate('/save-recipe', { state: { returnTo: 'week', plannedMealId: meal.id, mealName: getMealName(meal) } })} style={{
                                padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 500,
                                background: C.forest, color: 'white', border: 'none', cursor: 'pointer',
                                fontFamily: "'Jost', sans-serif",
                              }}>Save a recipe</button>
                              <button onClick={() => dismissSageMatch(meal.id)} style={{
                                padding: '5px 10px', borderRadius: '8px', fontSize: '11px',
                                background: 'none', color: C.driftwood, border: `1px solid ${C.linen}`,
                                cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                              }}>Keep as-is</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Add button */}
                <button onClick={() => openAddSheet(date)} style={{
                  width: '100%', padding: dayMeals.length > 0 ? '8px 14px 10px' : '14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: dayMeals.length > 0 ? '12px' : '13px',
                  color: C.forest, fontWeight: 400,
                  fontFamily: "'Jost', sans-serif",
                  textAlign: 'left',
                  borderTop: dayMeals.length > 0 ? 'none' : `1px dashed ${C.linen}`,
                }}>
                  {dayMeals.length > 0 ? '+ Add another' : `+ Add to ${isToday ? 'Today' : DAY_NAMES[i]}`}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Share with family button ────────────────────────────── */}
      {meals.length >= 2 && planStatus !== 'shared' && !loading && (
        <div style={{ padding: '0 22px 12px' }}>
          <button onClick={sharePlan} style={{
            width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
            background: C.forest, color: 'white', cursor: 'pointer',
            fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
            boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
          }}>Share with family →</button>
        </div>
      )}

      {/* ── Ghost Bridge Card ────────────────────────────────────── */}
      {ghostMeals.length > 0 && (
        <div style={{
          margin: '4px 22px 16px', padding: '14px 16px',
          background: 'white', borderRadius: '12px',
          borderLeft: `3px solid ${C.sage}`,
          border: '1px solid rgba(200,185,160,0.45)',
        }}>
          <div style={{ fontSize: '13px', color: C.ink, lineHeight: 1.6, marginBottom: '10px' }}>
            <span style={{ color: C.sage }}>✦</span> Some meals don't have recipes yet — want Sage to help with your shopping list?
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => navigate('/meals/recipes')} style={{
              padding: '8px 14px', borderRadius: '10px', border: 'none',
              background: C.forest, color: 'white', fontSize: '12px', fontWeight: 500,
              cursor: 'pointer', fontFamily: "'Jost', sans-serif",
            }}>Add recipes</button>
            <button onClick={() => navigate('/pantry/list')} style={{
              padding: '8px 14px', borderRadius: '10px',
              background: 'none', color: C.forest, fontSize: '12px', fontWeight: 500,
              border: `1px solid ${C.forest}`,
              cursor: 'pointer', fontFamily: "'Jost', sans-serif",
            }}>Add items manually</button>
          </div>
        </div>
      )}

      {/* ── Sage Share Sheet ─────────────────────────────────────── */}
      {shareSheetOpen && (
        <>
          <div onClick={() => setShareSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '0 0 env(safe-area-inset-bottom, 24px)', zIndex: 201,
            boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
            animation: 'sheetRise 0.28s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
            <div style={{ padding: '20px 22px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ color: C.sage, fontSize: '18px' }}>✦</span>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink }}>Your week is set.</span>
              </div>
              <div style={{ fontSize: '14px', color: C.driftwood, lineHeight: 1.6, marginBottom: '20px' }}>
                Ready to build your shopping list? I'll pull in everything you need from this week's recipes.
              </div>
              {ghostMeals.length > 0 && (
                <div style={{ fontSize: '12px', color: C.driftwood, fontStyle: 'italic', marginBottom: '16px', paddingLeft: '4px' }}>
                  {ghostMeals.length} meal{ghostMeals.length > 1 ? 's' : ''} don't have recipes yet — you can add those items manually.
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={buildShoppingList} disabled={injecting} style={{
                  width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
                  background: C.forest, color: 'white', cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                  boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
                }}>{injecting ? 'Building...' : 'Build my list →'}</button>
                <button onClick={() => setShareSheetOpen(false)} style={{
                  width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
                  background: 'none', color: C.driftwood, cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 300,
                }}>I'll do it later</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Add Meal Sheet ───────────────────────────────────────── */}
      {addSheetOpen && (
        <>
          <div onClick={() => setAddSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '0 0 env(safe-area-inset-bottom, 24px)', zIndex: 201,
            boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
            animation: 'sheetRise 0.28s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
            <div style={{ padding: '16px 22px 20px' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '14px' }}>
                {addSheetDate && `${DAY_NAMES[addSheetDate.getDay() === 0 ? 6 : addSheetDate.getDay() - 1]}, ${addSheetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </div>

              {/* Input */}
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <input
                  type="text"
                  value={addInput}
                  onChange={e => handleAddInputChange(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addMeal() }}
                  placeholder="What are you making?"
                  autoFocus
                  style={{
                    width: '100%', padding: '14px 16px', fontSize: '16px',
                    fontFamily: "'Jost', sans-serif", fontWeight: 300,
                    border: `1.5px solid ${C.linen}`, borderRadius: '12px',
                    outline: 'none', color: C.ink, boxSizing: 'border-box',
                  }}
                />
                {selectedRecipe && (
                  <div style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    fontSize: '9px', fontWeight: 500, color: C.sage, background: 'rgba(122,140,110,0.1)',
                    padding: '2px 6px', borderRadius: '4px',
                  }}>Recipe</div>
                )}
              </div>

              {/* Recipe suggestions */}
              {recipeSuggestions.length > 0 && !selectedRecipe && (
                <div style={{
                  marginBottom: '12px', background: C.cream, borderRadius: '10px',
                  border: `1px solid ${C.linen}`, maxHeight: '140px', overflowY: 'auto',
                }}>
                  {recipeSuggestions.map(r => (
                    <button key={r.id} onClick={() => selectRecipeSuggestion(r)} style={{
                      display: 'block', width: '100%', padding: '10px 14px',
                      background: 'none', border: 'none', borderBottom: `1px solid ${C.linen}`,
                      cursor: 'pointer', textAlign: 'left', fontSize: '14px', color: C.ink,
                      fontFamily: "'Jost', sans-serif",
                    }}>
                      {r.name}
                      {r.recipe_id && <span style={{ fontSize: '10px', color: C.sage, marginLeft: '6px' }}>Recipe linked</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Meal type selector */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                {MEAL_TYPES.map(mt => (
                  <button key={mt} onClick={() => setAddMealType(mt)} style={{
                    flex: 1, padding: '8px', borderRadius: '10px', fontSize: '12px',
                    border: addMealType === mt ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                    background: addMealType === mt ? 'rgba(61,107,79,0.08)' : 'white',
                    color: addMealType === mt ? C.forest : C.ink,
                    cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                    fontWeight: addMealType === mt ? 500 : 400,
                  }}>{MEAL_TYPE_LABELS[mt]}</button>
                ))}
              </div>

              {/* Add button */}
              <button onClick={addMeal} disabled={!addInput.trim() || adding} style={{
                width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
                background: addInput.trim() ? C.forest : C.linen,
                color: addInput.trim() ? 'white' : C.driftwood,
                cursor: addInput.trim() ? 'pointer' : 'default',
                fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                boxShadow: addInput.trim() ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
              }}>
                {adding ? 'Adding...' : 'Add to menu'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: C.forest, color: 'white', padding: '10px 22px', borderRadius: '10px',
          fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
          zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>{toast}</div>
      )}

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes sheetRise { from { transform: translateX(-50%) translateY(100%); } to { transform: translateX(-50%) translateY(0); } }
      `}</style>

      <BottomNav activeTab="week" />
    </div>
  )
}
