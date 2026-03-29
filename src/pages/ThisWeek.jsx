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
import { sageBusyNightDetection } from '../lib/sageBusyNightDetection'
import TopBar from '../components/TopBar'
import SageNudgeCard from '../components/SageNudgeCard'
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
  const [addBatchMultiplier, setAddBatchMultiplier] = useState(1.0)
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
  const [categorizing, setCategorizing] = useState(false)

  // Delete confirm
  const [selectedDay, setSelectedDay] = useState(null) // DOW_KEY of selected pill
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [ingredientDialog, setIngredientDialog] = useState(null) // { mealId, mealName, itemCount }
  const [householdMemberCount, setHouseholdMemberCount] = useState(1)

  // Week review
  const [weekEndDate, setWeekEndDate] = useState(null)
  const [weekReviewed, setWeekReviewed] = useState(false)

  // Recipe link sheet (for ghost meals)
  const [linkSheetMeal, setLinkSheetMeal] = useState(null) // { id, custom_name }
  const [linkSearch, setLinkSearch] = useState('')
  const [linkResults, setLinkResults] = useState([])
  const linkDebounceRef = useRef(null)

  // Batch edit
  const [batchEditMealId, setBatchEditMealId] = useState(null)

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
        .is('removed_at', null)
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
        .select('id, status, shopping_injected, week_end_date, reviewed_at')
        .eq('household_id', appUser.household_id)
        .eq('week_start_date', ws)
        .maybeSingle()

      if (plan) {
        setPlanId(plan.id)
        setPlanStatus(plan.status)
        setShoppingInjected(plan.shopping_injected || false)
        setWeekEndDate(plan.week_end_date || null)
        setWeekReviewed(!!plan.reviewed_at)
        // Fetch meals, then recipe names separately (no embedded join)
        const { data: mealsData } = await supabase
          .from('planned_meals')
          .select('*')
          .eq('meal_plan_id', plan.id)
          .is('removed_at', null)
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

    // Check household member count for family visibility toggle
    const { count: memberCount } = await supabase.from('users').select('id', { count: 'exact', head: true })
      .eq('household_id', appUser.household_id).neq('membership_status', 'invited')
    setHouseholdMemberCount(memberCount || 1)

    // Fetch calendar events if sync is enabled
    if (appUser.calendar_sync_enabled) {
      fetchCalendarEvents(appUser, dates).then(events => {
        setCalendarEvents(events)
        // Run busy night detection — meals state is already set by this point
        if (events?.length) {
          sageBusyNightDetection({ calendarEvents: events, meals, weekDates: dates, appUser })
        }
      })
    }

    // Show first-time hint if user hasn't planned a meal yet
    if (!appUser.has_planned_first_meal) {
      // Check if any meals exist globally for this household
      const { count } = await supabase.from('planned_meals').select('id', { count: 'exact', head: true }).eq('household_id', appUser.household_id).is('removed_at', null)
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
    setAddBatchMultiplier(1.0)
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
        batch_multiplier: addBatchMultiplier,
        previous_batch_multiplier: addBatchMultiplier,
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

  async function initDeleteMeal(mealId) {
    const meal = meals.find(m => m.id === mealId)
    if (!meal) return
    const mealName = meal.custom_name || meal.recipes?.name || 'Meal'
    setDeleteConfirmId(null)

    // Check if ingredients exist on the shopping list for this meal
    const { data: list } = await supabase.from('shopping_lists').select('id')
      .eq('household_id', appUser.household_id).eq('list_type', 'master').neq('status', 'completed').limit(1).maybeSingle()
    if (list) {
      // Case-insensitive match — source_meal_name may differ in casing from custom_name
      const { data: matchingItems } = await supabase.from('shopping_list_items')
        .select('id, source_meal_name')
        .eq('shopping_list_id', list.id)
        .eq('is_purchased', false)
        .not('source_meal_name', 'is', null)
      const matches = (matchingItems || []).filter(i =>
        i.source_meal_name?.toLowerCase() === mealName.toLowerCase()
      )
      if (matches.length > 0) {
        // Use the stored source_meal_name for deletion (exact match)
        setIngredientDialog({ mealId, mealName: matches[0].source_meal_name, itemCount: matches.length })
        return
      }
    }

    // Path 1 — no ingredients, soft-delete silently
    await softDeleteMeal(mealId, mealName, null)
  }

  async function softDeleteMeal(mealId, mealName, ingredientsKept) {
    setMeals(prev => prev.filter(m => m.id !== mealId))
    setIngredientDialog(null)
    showToast('Removed from menu')

    logActivity({
      user: appUser, actionType: 'meal_skipped', targetType: 'meal',
      targetId: mealId, targetName: mealName,
      metadata: { ingredients_kept: ingredientsKept },
    })

    await supabase.from('planned_meals').update({
      status: 'removed', removed_at: new Date().toISOString(),
      ingredients_kept: ingredientsKept,
    }).eq('id', mealId)
  }

  async function removeMealWithIngredients(mealId, mealName) {
    // Delete unpurchased shopping list items for this meal
    const { data: listId } = await supabase.from('shopping_lists').select('id')
      .eq('household_id', appUser.household_id).eq('list_type', 'master').neq('status', 'completed').limit(1).maybeSingle()
    if (listId) {
      await supabase.from('shopping_list_items').delete()
        .eq('shopping_list_id', listId.id)
        .eq('source_meal_name', mealName)
        .eq('is_purchased', false)
    }
    await softDeleteMeal(mealId, mealName, false)
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

  // ── Recipe link sheet for ghost meals ─────────────────────────
  function openLinkSheet(meal) {
    setLinkSheetMeal(meal)
    setLinkSearch('')
    setLinkResults([])
    // Load all recipes initially
    supabase.from('recipes').select('id, name').eq('household_id', appUser.household_id)
      .order('name').limit(50)
      .then(({ data }) => setLinkResults(data || []))
  }

  function handleLinkSearch(val) {
    setLinkSearch(val)
    if (linkDebounceRef.current) clearTimeout(linkDebounceRef.current)
    linkDebounceRef.current = setTimeout(async () => {
      if (val.trim().length < 1) {
        const { data } = await supabase.from('recipes').select('id, name')
          .eq('household_id', appUser.household_id).order('name').limit(50)
        setLinkResults(data || [])
      } else {
        const { data } = await supabase.from('recipes').select('id, name')
          .eq('household_id', appUser.household_id).ilike('name', `%${val.trim()}%`).order('name').limit(30)
        setLinkResults(data || [])
      }
    }, 200)
  }

  async function linkFromSheet(recipeId, recipeName) {
    if (!linkSheetMeal) return
    await linkRecipeToMeal(linkSheetMeal.id, recipeId, recipeName)
    logActivity({ user: appUser, actionType: 'recipe_linked_from_week', targetType: 'planned_meal', targetId: linkSheetMeal.id, targetName: recipeName })
    setLinkSheetMeal(null)
    showToast(`Linked to ${recipeName}`)
  }

  async function changeBatchMultiplier(mealId, newMultiplier) {
    const meal = meals.find(m => m.id === mealId)
    if (!meal) return
    const oldMultiplier = meal.batch_multiplier || 1

    // Update in-memory state
    setMeals(prev => prev.map(m =>
      m.id === mealId ? { ...m, batch_multiplier: newMultiplier, previous_batch_multiplier: oldMultiplier } : m
    ))
    setBatchEditMealId(null)

    // Update DB
    await supabase.from('planned_meals').update({
      batch_multiplier: newMultiplier, previous_batch_multiplier: oldMultiplier,
    }).eq('id', mealId)

    // If already injected, update shopping list quantities in place
    if (shoppingInjected && meal.recipe_id) {
      const mealName = meal.custom_name || meal.recipes?.name || ''
      if (mealName) {
        const { data: listItems } = await supabase.from('shopping_list_items')
          .select('id, quantity').ilike('source_meal_name', mealName).eq('status', 'active')
        if (listItems?.length && oldMultiplier !== 0) {
          for (const item of listItems) {
            if (!item.quantity) continue
            const raw = parseFloat(item.quantity)
            if (isNaN(raw)) continue
            const base = raw / oldMultiplier
            const newQty = String(Math.round(base * newMultiplier * 100) / 100)
            await supabase.from('shopping_list_items').update({ quantity: newQty }).eq('id', item.id)
          }
        }
      }
    }
    showToast(`Batch ${formatMultiplierBadge(newMultiplier)}`)
    logActivity({ user: appUser, actionType: 'batch_multiplier_changed', targetType: 'planned_meal', targetId: mealId, metadata: { old: oldMultiplier, new: newMultiplier } })
  }

  async function markAsCooked(mealId) {
    const now = new Date().toISOString()
    setMeals(prev => prev.map(m =>
      m.id === mealId ? { ...m, status: 'cooked', cooked_at: now, quick_reviewed: true } : m
    ))
    setBatchEditMealId(null)
    await supabase.from('planned_meals').update({ status: 'cooked', cooked_at: now, quick_reviewed: true }).eq('id', mealId)
    logActivity({ user: appUser, actionType: 'meal_marked_cooked', targetType: 'planned_meal', targetId: mealId })
    showToast('Marked as cooked')
  }

  // ── Visibility & inject ────────────────────────────────────────
  async function toggleVisibility() {
    if (!planId) return
    const isPublished = planStatus === 'published'
    const newStatus = isPublished ? 'draft' : 'published'
    await supabase.from('meal_plans').update({
      status: newStatus,
      published_at: isPublished ? null : new Date().toISOString(),
    }).eq('id', planId)
    setPlanStatus(newStatus)
  }

  async function buildShoppingList() {
    if (!planId || injecting) return
    setInjecting(true)
    const { count } = await injectMealPlanToList({
      planId,
      householdId: appUser.household_id,
      onCategorizing: setCategorizing,
    })
    setShoppingInjected(true)
    setShareSheetOpen(false)
    showToast(`Added ${count} item${count !== 1 ? 's' : ''} to your list`)
    setInjecting(false)
    setCategorizing(false)
    setTimeout(() => navigate('/pantry/list'), 800)
  }

  // ── Computed ──────────────────────────────────────────────────
  const todayStr = toLocalDateStr(new Date())
  const plannedDays = new Set(meals.map(m => m.day_of_week))

  // Week review eligibility: after Sunday 8pm or any time Monday+
  const showWeekReview = (() => {
    if (!weekEndDate || weekReviewed || !planId) return false
    const now = new Date()
    const endDate = new Date(weekEndDate + 'T20:00:00')
    return now > endDate
  })()
  const ghostMeals = meals.filter(m => m.entry_type === 'ghost' && !m.recipe_id && !m.removed_at)
  const ghostNames = ghostMeals.map(m => m.custom_name || 'Untitled')
  const ghostMessage = ghostNames.length === 1
    ? `${ghostNames[0]} doesn't have a recipe yet — add one so Sage can build your shopping list.`
    : ghostNames.length === 2
    ? `${ghostNames[0]} and ${ghostNames[1]} don't have recipes yet — add them so Sage can build your shopping list.`
    : `${ghostNames[0]}, ${ghostNames[1]}, and ${ghostNames.length - 2} other${ghostNames.length - 2 > 1 ? 's' : ''} don't have recipes yet — add them so Sage can build your shopping list.`

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

  const BATCH_OPTIONS = [0.5, 1, 1.5, 2, 3]
  const BATCH_LABELS = { 0.5: '½', 1: '1', 1.5: '1½', 2: '2', 3: '3' }

  function formatMultiplierBadge(val) {
    if (val === 0.5) return '×½'
    if (val === 1.5) return '×1½'
    return `×${val}`
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

        {/* Row 3: status + visibility toggle */}
        <div style={{ textAlign: 'center', fontSize: '11px', color: C.driftwood, fontStyle: 'italic', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <span>{plannedDays.size} of 7 nights planned</span>
          {householdMemberCount > 1 && planId && (
            <button onClick={toggleVisibility} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: '10px', fontFamily: "'Jost', sans-serif", fontWeight: 400,
              color: planStatus === 'published' ? C.sage : C.driftwood,
            }}>
              · {planStatus === 'published' ? 'Visible to family ✓' : 'Private'}
            </button>
          )}
        </div>
      </div>

      {/* ── Weekly Review Nudge ──────────────────────────────────── */}
      {showWeekReview && (
        <div style={{ padding: '8px 0 0' }}>
          <SageNudgeCard
            message="This week is done — want to close it out with Sage?"
            actionLabel="Quick review"
            onAction={() => navigate(`/review/${planId}?mode=quick`)}
            secondaryActionLabel="Full review"
            secondaryOnAction={() => navigate(`/review/${planId}?mode=detailed`)}
          />
        </div>
      )}

      {/* ── Week Strip (sticky below topbar) ────────────────────── */}
      <div style={{
        display: 'flex', gap: '4px', padding: '8px 22px 12px',
        overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        position: 'sticky', top: '66px', zIndex: 10,
        background: C.cream,
        boxShadow: '0 2px 6px rgba(80,60,30,0.06)',
      }}>
        {weekDates.map((date, i) => {
          const dateStr = toLocalDateStr(date)
          const isToday = dateStr === todayStr
          const hasPlanned = meals.some(m => m.day_of_week === DOW_KEYS[i])
          const isSelected = selectedDay ? selectedDay === DOW_KEYS[i] : isToday
          return (
            <button key={i} onClick={() => {
              setSelectedDay(DOW_KEYS[i])
              const el = document.getElementById(`day-${DOW_KEYS[i]}`)
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }} style={{
              flex: '1 0 auto', minWidth: '44px', padding: '6px 8px', borderRadius: '10px',
              border: 'none', cursor: 'pointer', textAlign: 'center',
              background: isSelected ? C.forest : 'white',
              color: isSelected ? 'white' : C.ink,
              boxShadow: isSelected ? '0 2px 8px rgba(61,107,79,0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
              fontFamily: "'Jost', sans-serif",
            }}>
              <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', opacity: isSelected ? 0.8 : 0.5 }}>
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
                scrollMarginTop: '145px',
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
                        const isAllDay = ev.allDay || !timeStr
                        const title = ev.title || ''
                        return (
                          <div key={ev.id} style={{
                            fontSize: '10px', fontFamily: "'Jost', sans-serif", fontWeight: 300,
                            color: isAllDay ? C.driftwood : textColor,
                            display: 'flex', alignItems: 'center', gap: '12px',
                          }}>
                            {!isAllDay && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: C.honey, flexShrink: 0 }} />}
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: isAllDay ? 'italic' : 'normal' }}>{title}</span>
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
                        <div onClick={() => setBatchEditMealId(meal.id)} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 0',
                          borderBottom: sageMatches ? 'none' : '1px solid rgba(200,185,160,0.15)',
                          cursor: 'pointer',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '14px', color: meal.status === 'cooked' ? C.sage : (meal.entry_type === 'linked' && meal.recipe_id) ? C.forest : C.ink }}>
                                {meal.status === 'cooked' && <span style={{ color: C.sage }}>✓ </span>}
                                {getMealName(meal)}
                              </span>
                              {meal.batch_multiplier && meal.batch_multiplier !== 1 && (
                                <span style={{ fontSize: '10px', fontWeight: 600, color: C.forest, fontFamily: "'Jost', sans-serif" }}>
                                  {formatMultiplierBadge(meal.batch_multiplier)}
                                </span>
                              )}
                              {meal.entry_type === 'linked' && (
                                <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0 }}>
                                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                                </svg>
                              )}
                              {meal.entry_type === 'ghost' && !meal.recipe_id && (
                                <button onClick={e => { e.stopPropagation(); openLinkSheet(meal) }} style={{
                                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                                  display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.5,
                                }}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                                    <path d="M9 10h6M9 14h4"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                            <span style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.driftwood }}>
                              {MEAL_TYPE_LABELS[meal.meal_type] || 'Dinner'}
                            </span>
                          </div>
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

      {/* ── Build / View my list button ──────────────────────────── */}
      {meals.length >= 1 && !loading && (
        <div style={{ padding: '0 22px 12px' }}>
          <button onClick={shoppingInjected ? () => navigate('/pantry/list') : () => setShareSheetOpen(true)} disabled={injecting} style={{
            width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
            background: C.forest, color: 'white', cursor: 'pointer',
            fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
            boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
          }}>{categorizing ? 'Sage is organizing your ingredients…' : injecting ? 'Building...' : shoppingInjected ? 'View my list →' : 'Build my list →'}</button>
        </div>
      )}

      {/* ── Ghost Bridge Card ────────────────────────────────────── */}
      {ghostMeals.length > 0 && (
        <SageNudgeCard
          message={ghostMessage}
          actionLabel="Add recipes →"
          onAction={() => navigate('/meals/recipes')}
        />
      )}

      {/* ── Ingredient Cleanup Dialog ────────────────────────────── */}
      {ingredientDialog && (
        <>
          <div onClick={() => setIngredientDialog(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '0 0 env(safe-area-inset-bottom, 24px)', zIndex: 201,
            boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
            animation: 'sheetRise 0.28s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
            <div style={{ padding: '20px 22px 24px' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '8px' }}>
                Remove {ingredientDialog.mealName}?
              </div>
              <div style={{ fontSize: '14px', color: C.driftwood, lineHeight: 1.6, marginBottom: '20px' }}>
                {ingredientDialog.itemCount} ingredient{ingredientDialog.itemCount !== 1 ? 's' : ''} for this meal {ingredientDialog.itemCount !== 1 ? 'are' : 'is'} already on your shopping list. Remove {ingredientDialog.itemCount !== 1 ? 'them' : 'it'} too?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => removeMealWithIngredients(ingredientDialog.mealId, ingredientDialog.mealName)} style={{
                  width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
                  background: C.forest, color: 'white', cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                }}>Yes, remove ingredients</button>
                <button onClick={() => softDeleteMeal(ingredientDialog.mealId, ingredientDialog.mealName, true)} style={{
                  width: '100%', padding: '12px', borderRadius: '14px',
                  background: 'none', color: C.ink, border: `1.5px solid ${C.linen}`,
                  cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontSize: '14px',
                }}>Keep ingredients on my list</button>
                <button onClick={() => setIngredientDialog(null)} style={{
                  width: '100%', padding: '10px', background: 'none', border: 'none',
                  cursor: 'pointer', color: C.driftwood, fontSize: '13px', fontWeight: 300,
                  fontFamily: "'Jost', sans-serif",
                }}>Never mind, keep this meal</button>
              </div>
            </div>
          </div>
        </>
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
                  {ghostNames.length === 1
                    ? `${ghostNames[0]} doesn't have a recipe — you can add those items manually.`
                    : ghostNames.length === 2
                    ? `${ghostNames[0]} and ${ghostNames[1]} don't have recipes — you can add those items manually.`
                    : `${ghostNames[0]}, ${ghostNames[1]}, and ${ghostNames.length - 2} other${ghostNames.length - 2 > 1 ? 's' : ''} don't have recipes — you can add those items manually.`
                  }
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={buildShoppingList} disabled={injecting} style={{
                  width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
                  background: C.forest, color: 'white', cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                  boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
                }}>{categorizing ? 'Sage is organizing your ingredients…' : injecting ? 'Building...' : 'Build my list →'}</button>
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

              {/* Batch size */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: C.driftwood, marginBottom: '6px' }}>Batch size</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {BATCH_OPTIONS.map(val => (
                    <button key={val} onClick={() => setAddBatchMultiplier(val)} style={{
                      flex: 1, padding: '8px', borderRadius: '10px', fontSize: '13px',
                      border: addBatchMultiplier === val ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                      background: addBatchMultiplier === val ? 'rgba(61,107,79,0.08)' : 'white',
                      color: addBatchMultiplier === val ? C.forest : C.ink,
                      cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                      fontWeight: addBatchMultiplier === val ? 600 : 400,
                    }}>{BATCH_LABELS[val]}</button>
                  ))}
                </div>
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

      {/* ── Meal Edit Sheet ──────────────────────────────────────── */}
      {batchEditMealId && (() => {
        const editMeal = meals.find(m => m.id === batchEditMealId)
        if (!editMeal) return null
        const currentBatch = editMeal.batch_multiplier || 1
        return (
          <>
            <div onClick={() => setBatchEditMealId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
            <div onClick={e => e.stopPropagation()} style={{
              position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
              padding: '0 0 env(safe-area-inset-bottom, 24px)', zIndex: 201,
              boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
              animation: 'sheetRise 0.28s cubic-bezier(0.22,1,0.36,1) both',
            }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
              <div style={{ padding: '16px 22px 20px' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '18px' }}>
                  {getMealName(editMeal)}
                </div>

                {/* Cooked button — for past meals that haven't been reviewed */}
                {editMeal.planned_date && editMeal.planned_date < todayStr && editMeal.status !== 'cooked' && !editMeal.removed_at && (
                  <button onClick={() => markAsCooked(editMeal.id)} style={{
                    width: '100%', padding: '12px', borderRadius: '12px', marginBottom: '16px',
                    border: `1.5px solid ${C.forest}`, background: 'white', color: C.forest,
                    cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}>✓ Mark as cooked</button>
                )}
                {editMeal.status === 'cooked' && editMeal.cooked_at && (
                  <div style={{
                    width: '100%', padding: '12px', borderRadius: '12px', marginBottom: '16px',
                    background: 'rgba(122,140,110,0.08)', textAlign: 'center',
                    fontSize: '13px', color: C.sage, fontFamily: "'Jost', sans-serif", fontWeight: 400,
                  }}>✓ Cooked {new Date(editMeal.cooked_at).toLocaleDateString('en-US', { weekday: 'long' })}</div>
                )}

                {/* Batch size */}
                <div style={{ fontSize: '11px', color: C.driftwood, marginBottom: '8px' }}>Batch size</div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
                  {BATCH_OPTIONS.map(val => (
                    <button key={val} onClick={() => changeBatchMultiplier(batchEditMealId, val)} style={{
                      flex: 1, padding: '12px', borderRadius: '10px', fontSize: '15px',
                      border: currentBatch === val ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                      background: currentBatch === val ? 'rgba(61,107,79,0.08)' : 'white',
                      color: currentBatch === val ? C.forest : C.ink,
                      cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                      fontWeight: currentBatch === val ? 600 : 400,
                    }}>{BATCH_LABELS[val]}</button>
                  ))}
                </div>

                {/* Done button */}
                <button onClick={() => setBatchEditMealId(null)} style={{
                  width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                  background: C.forest, color: 'white', cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                  boxShadow: '0 4px 16px rgba(30,55,35,0.25)', marginBottom: '16px',
                }}>Done</button>

                {/* Divider + Remove */}
                <div style={{ borderTop: `1px solid ${C.linen}`, paddingTop: '14px', textAlign: 'center' }}>
                  <button onClick={() => { setBatchEditMealId(null); initDeleteMeal(editMeal.id) }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '13px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontWeight: 300,
                  }}>Remove this meal →</button>
                </div>
              </div>
            </div>
          </>
        )
      })()}

      {/* ── Recipe Link Sheet (ghost meals) ──────────────────────── */}
      {linkSheetMeal && (
        <>
          <div onClick={() => setLinkSheetMeal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '0 0 env(safe-area-inset-bottom, 24px)', zIndex: 201,
            boxShadow: '0 -4px 32px rgba(44,36,23,0.18)', maxHeight: '70vh',
            animation: 'sheetRise 0.28s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
            <div style={{ padding: '16px 22px 20px' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '14px' }}>
                Link a recipe to {getMealName(linkSheetMeal)}?
              </div>
              <input
                type="text" value={linkSearch} onChange={e => handleLinkSearch(e.target.value)}
                placeholder="Search recipes..." autoFocus
                style={{
                  width: '100%', padding: '12px 14px', fontSize: '14px',
                  fontFamily: "'Jost', sans-serif", fontWeight: 300,
                  border: `1.5px solid ${C.linen}`, borderRadius: '12px',
                  outline: 'none', color: C.ink, boxSizing: 'border-box', marginBottom: '10px',
                }}
              />
              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                {linkResults.length === 0 && (
                  <div style={{ fontSize: '13px', color: C.driftwood, fontStyle: 'italic', padding: '12px 0' }}>
                    {linkSearch.trim() ? 'No recipes found' : 'Loading recipes...'}
                  </div>
                )}
                {linkResults.map(r => (
                  <button key={r.id} onClick={() => linkFromSheet(r.id, r.name)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '12px 0', background: 'none', border: 'none',
                    borderBottom: '1px solid rgba(200,185,160,0.15)',
                    cursor: 'pointer', textAlign: 'left', fontFamily: "'Jost', sans-serif",
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                    </svg>
                    <span style={{ fontSize: '14px', color: C.ink, fontWeight: 300 }}>{r.name}</span>
                  </button>
                ))}
              </div>
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
