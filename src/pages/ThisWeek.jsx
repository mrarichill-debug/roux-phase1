/**
 * ThisWeek.jsx — Menu Planner.
 * The week is a blank canvas menu, not a slot-based form.
 * Each day is a card. Lauren adds meals by typing. Meal type is optional metadata.
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { sageMealMatch } from '../lib/sageMealMatch'
import { injectMealPlanToList } from '../lib/injectMealPlanToList'
import { injectSingleMeal } from '../lib/injectSingleMeal'
import { getOrCreateShoppingList } from '../lib/getOrCreateShoppingList'
import { getWeekDatesTZ, getWeekStartTZ, toLocalDateStr } from '../lib/dateUtils'
import { fetchCalendarEvents, getEventsForDate } from '../lib/calendarSync'
import { sageBusyNightDetection } from '../lib/sageBusyNightDetection'
import { hasSeenTooltip, dismissTooltip } from '../lib/tooltips'
import TopBar from '../components/TopBar'
import SageNudgeCard from '../components/SageNudgeCard'
import BottomSheet from '../components/BottomSheet'
import BottomNav from '../components/BottomNav'
import { useArc } from '../context/ArcContext'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E', linen: '#E8E0D0',
  sage: '#7A8C6E', honey: '#C49A3C', honeyDark: '#7A5C14', red: '#A03030',
}

const DOW_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_ABBR = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const MEAL_TYPES = ['breakfast','lunch','dinner','snack','other','leftovers','eating_out']
const MEAL_TYPE_LABELS = { dinner: 'Dinner', lunch: 'Lunch', breakfast: 'Breakfast', snack: 'Snack', other: 'Other', leftovers: 'Leftovers', eating_out: 'Eating Out' }
const MEAL_TYPE_ORDER = { breakfast: 0, snack: 1, lunch: 2, dinner: 3, leftovers: 4, other: 5, eating_out: 6 }

export default function ThisWeek({ appUser }) {
  const { color: arcColor } = useArc()
  const navigate = useNavigate()
  const location = useLocation()
  const tz = appUser?.timezone || 'America/Chicago'

  const [weekOffset, _setWeekOffset] = useState(() => {
    const stored = sessionStorage.getItem('roux_weekOffset')
    return stored ? parseInt(stored, 10) : 0
  })
  const setWeekOffset = (v) => {
    const val = typeof v === 'function' ? v(weekOffset) : v
    sessionStorage.setItem('roux_weekOffset', String(val))
    _setWeekOffset(val)
  }
  const [weekDates, setWeekDates] = useState(() => getWeekDatesTZ(tz, weekOffset))
  const [weekStart, setWeekStart] = useState(() => getWeekStartTZ(tz, weekOffset))
  const [planId, setPlanId] = useState(null)
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [dayTypes, setDayTypes] = useState({}) // dowKey → day type name

  // Add sheet state
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [addSheetDate, setAddSheetDate] = useState(null) // Date object
  const [addInput, setAddInput] = useState('')
  const [addMealType, setAddMealType] = useState('dinner') // meal time: breakfast/lunch/dinner/snack
  const [addMealCategory, setAddMealCategory] = useState(null) // null | 'other' | 'leftovers' | 'eating_out'
  const [recipeSuggestions, setRecipeSuggestions] = useState([])
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [adding, setAdding] = useState(false)
  const [addBatchMultiplier, setAddBatchMultiplier] = useState(1.0)
  const [addSheetRecipes, setAddSheetRecipes] = useState([]) // [{ recipe_id, recipe_name }]
  const [addSheetLinkOpen, setAddSheetLinkOpen] = useState(false) // link sheet opened from add flow
  const [addEatingOutCost, setAddEatingOutCost] = useState('')
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

  // Keep as-is memory — meals that don't need recipes
  const [dismissedMeals, setDismissedMeals] = useState(new Set())

  // Accordion — collapse past days by default
  const [collapsedDays, setCollapsedDays] = useState(new Set())

  // Day-tile list control
  const [onListDays, setOnListDays] = useState(new Set())
  const [deselectConfirm, setDeselectConfirm] = useState(null) // { dow, dayName, mealNames }

  // Batch edit
  const [batchEditMealId, setBatchEditMealId] = useState(null)

  // Move meal to another day
  const [moveDayPickerOpen, setMoveDayPickerOpen] = useState(false)
  const [moveMealId, setMoveMealId] = useState(null)
  const [moveNextWeekCounts, setMoveNextWeekCounts] = useState({}) // dateStr → count

  // Swipe navigation
  const [touchStart, setTouchStart] = useState(null)

  // Repeat days for breakfast/snack
  const [repeatDays, setRepeatDays] = useState(new Set())
  const [showRepeatPicker, setShowRepeatPicker] = useState(false)

  // Leftovers source
  const [recentMeals, setRecentMeals] = useState([])
  const [selectedSourceMeal, setSelectedSourceMeal] = useState(null)
  const [leftoversFreeText, setLeftoversFreeText] = useState('')

  // Family member tagging
  const [familyMembers, setFamilyMembers] = useState([])
  const [selectedMembers, setSelectedMembers] = useState(new Set())

  // Tooltips
  const [mealsVsRecipesDismissed, setMealsVsRecipesDismissed] = useState(() => hasSeenTooltip(appUser, 'meals_vs_recipes'))
  const [mealAddedTip, setMealAddedTip] = useState(false) // shows after first meal add
  const [recipeLinkedTip, setRecipeLinkedTip] = useState(false) // shows after first recipe link

  // Toast
  const [toast, setToast] = useState('')
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  useEffect(() => {
    if (appUser?.household_id) loadWeek()
  }, [appUser?.household_id, weekOffset])

  // Load family members for tagging
  useEffect(() => {
    if (!appUser?.household_id) return
    supabase.from('family_members').select('id, name, is_pet')
      .eq('household_id', appUser.household_id).eq('is_pet', false).order('name')
      .then(({ data }) => setFamilyMembers(data ?? []))
  }, [appUser?.household_id])

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

  // Initialize accordion — collapse past days when week changes
  useEffect(() => {
    const today = toLocalDateStr(new Date())
    const collapsed = new Set()
    weekDates.forEach((date, i) => {
      if (toLocalDateStr(date) < today) collapsed.add(DOW_KEYS[i])
    })
    setCollapsedDays(collapsed)
  }, [weekStart])

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
        // Load linked recipes from junction table (separate queries per LESSONS.md)
        const mealIds = (mealsData || []).map(m => m.id)
        let linkedRecipeMap = {} // planned_meal_id → [{ recipe_id, recipe_name }]
        if (mealIds.length > 0) {
          const { data: pmrRows } = await supabase.from('planned_meal_recipes')
            .select('planned_meal_id, recipe_id, sort_order')
            .in('planned_meal_id', mealIds)
            .order('sort_order')
          if (pmrRows?.length) {
            const allRecipeIds = [...new Set(pmrRows.map(r => r.recipe_id))]
            const { data: recipeRows } = await supabase.from('recipes').select('id, name, prep_time_minutes').in('id', allRecipeIds)
            const recipeMap = Object.fromEntries((recipeRows || []).map(r => [r.id, r]))
            for (const pmr of pmrRows) {
              if (!linkedRecipeMap[pmr.planned_meal_id]) linkedRecipeMap[pmr.planned_meal_id] = []
              const rec = recipeMap[pmr.recipe_id]
              if (rec) linkedRecipeMap[pmr.planned_meal_id].push({ recipe_id: rec.id, recipe_name: rec.name })
            }
          }
        }
        // Also resolve legacy recipe_id for backward compat display
        const legacyRecipeIds = (mealsData || []).filter(m => m.recipe_id).map(m => m.recipe_id)
        let legacyRecipeMap = {}
        if (legacyRecipeIds.length > 0) {
          const { data: recipes } = await supabase.from('recipes').select('id, name, prep_time_minutes').in('id', legacyRecipeIds)
          legacyRecipeMap = Object.fromEntries((recipes || []).map(r => [r.id, r]))
        }
        // Load member tags (separate query per LESSONS.md)
        let memberMap = {} // planned_meal_id → [member_name]
        if (mealIds.length > 0) {
          const { data: memberRows } = await supabase.from('planned_meal_members')
            .select('planned_meal_id, member_name').in('planned_meal_id', mealIds)
          for (const mr of (memberRows || [])) {
            if (!memberMap[mr.planned_meal_id]) memberMap[mr.planned_meal_id] = []
            memberMap[mr.planned_meal_id].push(mr.member_name)
          }
        }

        const enriched = (mealsData || []).map(m => ({
          ...m,
          linkedRecipes: linkedRecipeMap[m.id] || [],
          recipes: m.recipe_id ? legacyRecipeMap[m.recipe_id] || null : null,
          members: memberMap[m.id] || [],
        }))
        setMeals(enriched)
        // Load on_list state for day tiles
        const listedDays = new Set(enriched.filter(m => m.on_list).map(m => m.day_of_week))
        setOnListDays(listedDays)
        // Load keep-as-is meal preferences
        const { data: prefs } = await supabase
          .from('sage_meal_preferences')
          .select('meal_name, no_recipe_needed')
          .eq('household_id', appUser.household_id)
          .eq('no_recipe_needed', true)
        setDismissedMeals(new Set((prefs ?? []).map(p => p.meal_name.toLowerCase())))
      } else {
        setPlanId(null)
        setMeals([])
        setOnListDays(new Set())
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

  // Reset repeat days when meal time changes
  useEffect(() => {
    setRepeatDays(new Set())
    setShowRepeatPicker(addMealType === 'breakfast' || addMealType === 'snack')
  }, [addMealType])

  // Reset category-specific state when category changes
  useEffect(() => {
    setSelectedSourceMeal(null)
    setLeftoversFreeText('')
  }, [addMealCategory])

  // Load recent meals when leftovers selected
  useEffect(() => {
    if (addMealCategory !== 'leftovers' || !appUser?.household_id) return
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    supabase.from('planned_meals')
      .select('id, custom_name, planned_date, meal_type')
      .eq('household_id', appUser.household_id)
      .neq('meal_type', 'leftovers').neq('meal_type', 'eating_out')
      .not('custom_name', 'ilike', 'Leftovers%')
      .is('removed_at', null)
      .gte('planned_date', twoWeeksAgo.toISOString().split('T')[0])
      .order('planned_date', { ascending: false })
      .limit(15)
      .then(({ data }) => {
        const seen = new Set()
        setRecentMeals((data ?? []).filter(m => {
          if (!m.custom_name || seen.has(m.custom_name)) return false
          seen.add(m.custom_name)
          return true
        }))
      })
  }, [addMealCategory])

  function formatMealDate(dateStr) {
    if (!dateStr) return ''
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const date = new Date(dateStr); date.setHours(0, 0, 0, 0)
    const diff = Math.floor((today - date) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'today'
    if (diff === 1) return 'yesterday'
    if (diff < 0) return 'upcoming'
    return `${diff} days ago`
  }

  // ── Prefill from Meals tab navigation ──────────────────────────
  const prefillHandled = useRef(false)
  useEffect(() => {
    const s = location.state
    if (s?.prefillMeal && weekDates.length > 0 && !loading && !prefillHandled.current) {
      prefillHandled.current = true
      const todayDate = weekDates.find(d => toLocalDateStr(d) === toLocalDateStr(new Date())) || weekDates[0]
      openAddSheet(todayDate, { name: s.prefillMeal, mealType: s.prefillType })
      navigate('/plan', { replace: true, state: {} })
    }
  }, [location.state?.prefillMeal, loading])

  // ── Add meal ──────────────────────────────────────────────────
  function openAddSheet(date, prefill) {
    setAddSheetDate(date)
    setAddInput('')
    setAddMealType('dinner')
    setAddMealCategory(null)
    setRecipeSuggestions([])
    setSelectedRecipe(null)
    setAddBatchMultiplier(1.0)
    setAddSheetRecipes([])
    setAddSheetLinkOpen(false)
    setAddEatingOutCost('')
    setRepeatDays(new Set())
    setShowRepeatPicker(false)
    setSelectedSourceMeal(null)
    setLeftoversFreeText('')
    setRecentMeals([])
    setSelectedMembers(new Set())
    if (prefill) {
      if (prefill.name) setAddInput(prefill.name)
      if (prefill.mealType) setAddMealType(prefill.mealType)
    }
    setAddSheetOpen(true)
  }

  function handleAddInputChange(val) {
    setAddInput(val)
    setSelectedRecipe(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setRecipeSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      // Query planned_meals history — eating out gets restaurant names, others get regular meals
      let query = supabase
        .from('planned_meals')
        .select('id, custom_name, recipe_id, entry_type, meal_type')
        .eq('household_id', appUser.household_id)
        .not('custom_name', 'is', null)
        .ilike('custom_name', `%${val.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(10)
      if (addMealCategory === 'eating_out') {
        query = query.eq('entry_type', 'eating_out')
      } else {
        query = query.neq('entry_type', 'eating_out')
      }
      const { data: historyData } = await query
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
    setSelectedRecipe(null) // Never auto-link from add sheet — Sage surfaces matches after save
    // Pre-select meal time from history — guard against legacy category values
    const mealTimes = new Set(['breakfast', 'lunch', 'dinner', 'snack'])
    const categories = new Set(['other', 'leftovers', 'eating_out'])
    if (suggestion.meal_type) {
      if (mealTimes.has(suggestion.meal_type)) setAddMealType(suggestion.meal_type)
      else if (categories.has(suggestion.meal_type)) setAddMealCategory(suggestion.meal_type)
    }
    setRecipeSuggestions([])
  }

  async function addMeal() {
    const isLeftovers = addMealCategory === 'leftovers'
    const leftoversSource = selectedSourceMeal?.custom_name || leftoversFreeText.trim()

    // Leftovers: require a source, not a meal name
    if (isLeftovers) {
      if (!leftoversSource || adding) return
    } else {
      if (!addInput.trim() || adding) return
    }

    setAdding(true)
    try {
      const mpId = await ensurePlan()
      if (!mpId) { setAdding(false); return }

      // Leftovers — single row, no recipes, no Sage match, no injection
      if (isLeftovers) {
        const dateStr = toLocalDateStr(addSheetDate)
        const dowKey = DOW_KEYS[addSheetDate.getDay() === 0 ? 6 : addSheetDate.getDay() - 1]
        const customName = `Leftovers — ${leftoversSource}`

        const { data, error } = await supabase.from('planned_meals').insert({
          household_id: appUser.household_id,
          meal_plan_id: mpId,
          day_of_week: dowKey,
          meal_type: addMealType,
          planned_date: dateStr,
          custom_name: customName,
          recipe_id: null,
          entry_type: 'ghost',
          slot_type: 'note',
          status: 'planned',
          sort_order: meals.filter(m => m.day_of_week === dowKey).length,
          batch_multiplier: 1,
          source_meal_id: selectedSourceMeal?.id || null,
          source_meal_name: leftoversSource,
        }).select('*').single()

        if (error) throw error
        // Write member tags if any
        if (selectedMembers.size > 0) {
          await supabase.from('planned_meal_members').insert(
            Array.from(selectedMembers).map(name => ({ household_id: appUser.household_id, planned_meal_id: data.id, member_name: name }))
          )
        }
        const members = Array.from(selectedMembers)
        setMeals(prev => [...prev, { ...data, linkedRecipes: [], recipes: null, members }])
        setAddSheetOpen(false)
        showToast(`Added ${customName}`)
        logActivity({ user: appUser, actionType: 'meal_added_to_week', targetType: 'meal', targetId: data.id, targetName: customName, metadata: { entry_type: 'leftovers' } })
        if (showHint || !appUser.has_planned_first_meal) {
          setShowHint(false)
          supabase.from('users').update({ has_planned_first_meal: true }).eq('id', appUser.id)
        }
        setAdding(false)
        return
      }

      const isEatingOut = addMealCategory === 'eating_out'
      const hasRecipes = !isEatingOut && addSheetRecipes.length > 0
      const eatingOutCost = isEatingOut && addEatingOutCost.trim() ? parseFloat(addEatingOutCost.replace(/[^0-9.]/g, '')) : null

      // Build list of dates: current day + any repeat days
      const datesToCreate = [addSheetDate]
      if (repeatDays.size > 0) {
        for (const dowIdx of repeatDays) {
          const repeatDate = new Date(weekDates[dowIdx])
          const currentDateStr = toLocalDateStr(addSheetDate)
          const repeatDateStr = toLocalDateStr(repeatDate)
          if (repeatDateStr !== currentDateStr) datesToCreate.push(repeatDate)
        }
      }

      const allEnriched = []
      let firstData = null

      for (const targetDate of datesToCreate) {
        const dateStr = toLocalDateStr(targetDate)
        const dowKey = DOW_KEYS[targetDate.getDay() === 0 ? 6 : targetDate.getDay() - 1]

        const { data, error } = await supabase.from('planned_meals').insert({
          household_id: appUser.household_id,
          meal_plan_id: mpId,
          day_of_week: dowKey,
          meal_type: addMealType,
          planned_date: dateStr,
          custom_name: addInput.trim(),
          recipe_id: null,
          entry_type: isEatingOut ? 'eating_out' : hasRecipes ? 'linked' : 'ghost',
          slot_type: isEatingOut ? 'note' : hasRecipes ? 'recipe' : 'note',
          status: 'planned',
          sort_order: meals.filter(m => m.day_of_week === dowKey).length,
          batch_multiplier: isEatingOut ? 1 : addBatchMultiplier,
          previous_batch_multiplier: isEatingOut ? 1 : addBatchMultiplier,
          eating_out_cost: eatingOutCost && !isNaN(eatingOutCost) ? eatingOutCost : null,
        }).select('*').single()

        if (error) throw error
        if (!firstData) firstData = data

        // Write linked recipes to junction table for each row
        if (hasRecipes) {
          await supabase.from('planned_meal_recipes').insert(
            addSheetRecipes.map((r, i) => ({ planned_meal_id: data.id, recipe_id: r.recipe_id, sort_order: i }))
          )
        }

        // Write member tags for each row
        if (selectedMembers.size > 0) {
          await supabase.from('planned_meal_members').insert(
            Array.from(selectedMembers).map(name => ({ household_id: appUser.household_id, planned_meal_id: data.id, member_name: name }))
          )
        }

        const members = Array.from(selectedMembers)
        allEnriched.push({ ...data, linkedRecipes: hasRecipes ? [...addSheetRecipes] : [], recipes: null, members })

        // Fire Sage meal match for ghost entries (skip eating out) — only first row
        if (!hasRecipes && !isEatingOut && data === firstData) {
          sageMealMatch({ mealId: data.id, mealName: addInput.trim(), householdId: appUser.household_id })
        }

        // Auto-inject if shopping list already built and recipes linked
        if (hasRecipes && shoppingInjected && mpId) {
          injectSingleMeal({
            mealId: data.id,
            mealName: addInput.trim(),
            batchMultiplier: addBatchMultiplier,
            planId: mpId,
            householdId: appUser.household_id,
            legacyRecipeId: data.recipe_id || null,
          })
        }
      }

      setMeals(prev => [...prev, ...allEnriched])
      setAddSheetOpen(false)
      const dayCount = datesToCreate.length
      showToast(dayCount > 1 ? `Added ${addInput.trim()} to ${dayCount} days` : `Added ${addInput.trim()}`)

      logActivity({
        user: appUser, actionType: 'meal_added_to_week', targetType: 'meal',
        targetId: firstData.id, targetName: addInput.trim(),
        metadata: { day_count: dayCount, entry_type: isEatingOut ? 'eating_out' : hasRecipes ? 'linked' : 'ghost' },
      })

      // Dismiss first-time hint and mark user
      if (showHint || !appUser.has_planned_first_meal) {
        setShowHint(false)
        supabase.from('users').update({ has_planned_first_meal: true }).eq('id', appUser.id)
      }

      // Show first-meal-added tooltip
      if (!hasSeenTooltip(appUser, 'meal_added_first')) {
        setMealAddedTip(true)
      }
    } catch (err) {
      console.error('[Menu] Add meal error:', err)
    }
    setAdding(false)
  }

  // ── Move meal to another day ────────────────────────────────
  async function openMovePicker(mealId) {
    setMoveMealId(mealId)
    setMoveDayPickerOpen(true)
    // Fetch next week meal counts
    const nextDates = getWeekDatesTZ(tz, weekOffset + 1)
    const startStr = toLocalDateStr(nextDates[0])
    const endStr = toLocalDateStr(nextDates[6])
    const { data } = await supabase
      .from('planned_meals')
      .select('planned_date')
      .eq('household_id', appUser.household_id)
      .is('removed_at', null)
      .gte('planned_date', startStr)
      .lte('planned_date', endStr)
    const counts = {}
    ;(data || []).forEach(m => {
      counts[m.planned_date] = (counts[m.planned_date] || 0) + 1
    })
    setMoveNextWeekCounts(counts)
  }

  async function moveMealToDay(targetDate) {
    const meal = meals.find(m => m.id === moveMealId)
    if (!meal) return
    const dateStr = toLocalDateStr(targetDate)
    const dayIdx = targetDate.getDay() === 0 ? 6 : targetDate.getDay() - 1
    const newDow = DOW_KEYS[dayIdx]

    // Ensure a plan exists for the target week
    const targetWeekStart = getWeekStartTZ(tz, toLocalDateStr(targetDate) >= toLocalDateStr(getWeekDatesTZ(tz, weekOffset + 1)[0]) ? weekOffset + 1 : weekOffset)
    let targetPlanId = planId
    if (targetWeekStart !== weekStart) {
      const { data: existingPlan } = await supabase
        .from('meal_plans')
        .select('id')
        .eq('household_id', appUser.household_id)
        .eq('week_start_date', targetWeekStart)
        .maybeSingle()
      if (existingPlan) {
        targetPlanId = existingPlan.id
      } else {
        const [y, m, d] = targetWeekStart.split('-').map(Number)
        const endDate = new Date(y, m - 1, d + 6)
        const { data: newPlan, error: planErr } = await supabase.from('meal_plans').insert({
          household_id: appUser.household_id,
          week_start_date: targetWeekStart,
          week_end_date: toLocalDateStr(endDate),
          status: 'draft',
          created_by: appUser.id,
        }).select('id').single()
        if (planErr || !newPlan) { console.error('[Menu] Create plan for move:', planErr); return }
        targetPlanId = newPlan.id
      }
    }

    const { error } = await supabase.from('planned_meals').update({
      planned_date: dateStr,
      day_of_week: newDow,
      meal_plan_id: targetPlanId,
    }).eq('id', moveMealId)

    if (!error) {
      // Remove from local state (it moved away from the current view, or moved within it)
      if (targetWeekStart === weekStart) {
        setMeals(prev => prev.map(m => m.id === moveMealId ? { ...m, planned_date: dateStr, day_of_week: newDow } : m))
      } else {
        setMeals(prev => prev.filter(m => m.id !== moveMealId))
      }
      showToast(`Moved ${getMealName(meal)} to ${DAY_NAMES[dayIdx]}`)
      logActivity({ user: appUser, actionType: 'meal_moved', targetType: 'meal', targetId: moveMealId, targetName: getMealName(meal), metadata: { from_date: meal.planned_date, to_date: dateStr } })
    }
    setMoveDayPickerOpen(false)
    setMoveMealId(null)
    setBatchEditMealId(null)
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
    // Insert into junction table (upsert to avoid dupes)
    await supabase.from('planned_meal_recipes').upsert(
      { planned_meal_id: mealId, recipe_id: recipeId, sort_order: 0 },
      { onConflict: 'planned_meal_id,recipe_id' }
    )
    // Mark as linked + resolved
    await supabase.from('planned_meals').update({
      entry_type: 'linked', sage_match_status: 'resolved',
    }).eq('id', mealId)
    const meal = meals.find(m => m.id === mealId)
    setMeals(prev => prev.map(m => {
      if (m.id !== mealId) return m
      const existing = m.linkedRecipes || []
      const alreadyLinked = existing.some(r => r.recipe_id === recipeId)
      return {
        ...m,
        entry_type: 'linked',
        sage_match_status: 'resolved',
        linkedRecipes: alreadyLinked ? existing : [...existing, { recipe_id: recipeId, recipe_name: recipeName }],
        recipes: { name: recipeName },
      }
    }))
    // Auto-inject ingredients if shopping list already built
    if (shoppingInjected && planId) {
      injectSingleMeal({
        mealId,
        mealName: meal?.custom_name || recipeName,
        batchMultiplier: meal?.batch_multiplier || 1,
        planId,
        householdId: appUser.household_id,
        legacyRecipeId: recipeId || meal?.recipe_id || null,
      })
    }
    // Update sage_meal_preferences — recipe now preferred
    const linkedMealName = meal?.custom_name || recipeName
    if (linkedMealName) {
      const key = linkedMealName.toLowerCase().trim()
      setDismissedMeals(prev => { const next = new Set(prev); next.delete(key); return next })
      await supabase
        .from('sage_meal_preferences')
        .upsert({
          household_id: appUser.household_id,
          meal_name: key,
          no_recipe_needed: false,
          recipe_id: recipeId,
        }, { onConflict: 'household_id,meal_name' })
    }
    // Show first-recipe-linked tooltip
    if (!hasSeenTooltip(appUser, 'recipe_linked_first')) {
      setRecipeLinkedTip(true)
    }
  }

  async function unlinkRecipeFromMeal(mealId, recipeId) {
    await supabase.from('planned_meal_recipes').delete()
      .eq('planned_meal_id', mealId).eq('recipe_id', recipeId)
    setMeals(prev => prev.map(m => {
      if (m.id !== mealId) return m
      const remaining = (m.linkedRecipes || []).filter(r => r.recipe_id !== recipeId)
      return {
        ...m,
        linkedRecipes: remaining,
        entry_type: remaining.length > 0 ? 'linked' : 'ghost',
      }
    }))
    // If no recipes remain, revert entry_type
    const meal = meals.find(m => m.id === mealId)
    const remaining = (meal?.linkedRecipes || []).filter(r => r.recipe_id !== recipeId)
    if (remaining.length === 0) {
      await supabase.from('planned_meals').update({ entry_type: 'ghost' }).eq('id', mealId)
    }
  }

  async function dismissSageMatch(mealId) {
    const meal = meals.find(m => m.id === mealId)
    const mealName = meal?.custom_name || ''
    setMeals(prev => prev.map(m =>
      m.id === mealId ? { ...m, sage_match_status: 'resolved' } : m
    ))
    await supabase.from('planned_meals').update({ sage_match_status: 'resolved' }).eq('id', mealId)
    // Persist keep-as-is preference
    if (mealName) {
      const key = mealName.toLowerCase().trim()
      setDismissedMeals(prev => new Set([...prev, key]))
      await supabase
        .from('sage_meal_preferences')
        .upsert({
          household_id: appUser.household_id,
          meal_name: key,
          no_recipe_needed: true,
        }, { onConflict: 'household_id,meal_name' })
    }
  }

  // ── Recipe link sheet for ghost meals ─────────────────────────
  // ── Day-tile list control ────────────────────────────────────────────────
  async function selectDayForList(dow) {
    if (!planId || !appUser?.household_id) return
    // Optimistic update
    setOnListDays(prev => new Set([...prev, dow]))
    // DB: mark meals as on_list
    await supabase.from('planned_meals').update({ on_list: true })
      .eq('meal_plan_id', planId).eq('day_of_week', dow).is('removed_at', null)
    // Split meals by recipe availability
    const dayMeals = meals.filter(m => m.day_of_week === dow && !m.removed_at)
    const mealsWithRecipes = dayMeals.filter(m => m.linkedRecipes?.length || m.recipe_id)
    const mealsWithoutRecipes = dayMeals.filter(m => !m.linkedRecipes?.length && !m.recipe_id)
    // Inject ingredients for meals with recipes
    for (const m of mealsWithRecipes) {
      try {
        await injectSingleMeal({
          mealId: m.id,
          mealName: m.custom_name || 'Untitled',
          batchMultiplier: m.batch_multiplier || 1,
          planId,
          householdId: appUser.household_id,
          legacyRecipeId: m.recipe_id || null,
        })
      } catch {}
    }
    // Add placeholder items for meals without recipes
    if (mealsWithoutRecipes.length > 0) {
      const listId = await getOrCreateShoppingList(planId, appUser.household_id)
      if (listId) {
        for (const m of mealsWithoutRecipes) {
          const mealName = m.custom_name || 'Untitled'
          if (mealName === 'Untitled') continue
          // Insert one placeholder per planned meal (no dedup — each day-tap adds one)
          await supabase.from('shopping_list_items').insert({
            shopping_list_id: listId,
            household_id: appUser.household_id,
            name: mealName,
            grocery_category: 'other',
            source_meal_name: mealName,
            is_placeholder: true,
            status: 'active',
            item_type: 'manual',
            approval_status: 'approved',
          })
        }
      }
    }
  }

  function requestDeselectDay(dow) {
    const dayMeals = meals.filter(m => m.day_of_week === dow && !m.removed_at)
    const mealNames = dayMeals.map(m => m.custom_name || 'Untitled')
    const dayName = DAY_NAMES[DOW_KEYS.indexOf(dow)] || dow
    setDeselectConfirm({ dow, dayName, mealNames })
  }

  async function confirmDeselectDay() {
    if (!deselectConfirm || !planId || !appUser?.household_id) return
    const { dow, mealNames } = deselectConfirm
    // Optimistic update
    setOnListDays(prev => { const next = new Set(prev); next.delete(dow); return next })
    setDeselectConfirm(null)
    // DB: mark meals as off list
    await supabase.from('planned_meals').update({ on_list: false })
      .eq('meal_plan_id', planId).eq('day_of_week', dow)
    // Remove ingredients + placeholders from shopping list by source_meal_name
    const { data: lists } = await supabase.from('shopping_lists').select('id').eq('meal_plan_id', planId)
    if (lists?.length) {
      const listIds = lists.map(l => l.id)
      for (const name of mealNames) {
        if (name && name !== 'Untitled') {
          await supabase.from('shopping_list_items').delete()
            .in('shopping_list_id', listIds).eq('source_meal_name', name)
        }
      }
    }
  }

  function handleDayTileTap(dow) {
    if (onListDays.has(dow)) {
      requestDeselectDay(dow)
    } else {
      selectDayForList(dow)
    }
  }

  function openLinkSheet(meal) {
    // Dismiss active keyboard before opening sheet
    if (document.activeElement) document.activeElement.blur()
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
    if (addSheetLinkOpen) {
      // Add sheet context — update local state only, don't write to DB yet
      setAddSheetRecipes(prev => {
        if (prev.some(r => r.recipe_id === recipeId)) return prev
        return [...prev, { recipe_id: recipeId, recipe_name: recipeName }]
      })
      showToast(`Linked ${recipeName}`)
    } else {
      // Edit sheet context — write to DB immediately
      await linkRecipeToMeal(linkSheetMeal.id, recipeId, recipeName)
      logActivity({ user: appUser, actionType: 'recipe_linked_from_week', targetType: 'planned_meal', targetId: linkSheetMeal.id, targetName: recipeName })
      showToast(`Linked ${recipeName}`)
    }
  }

  function unlinkFromSheet(recipeId) {
    if (addSheetLinkOpen) {
      setAddSheetRecipes(prev => prev.filter(r => r.recipe_id !== recipeId))
    } else if (linkSheetMeal) {
      unlinkRecipeFromMeal(linkSheetMeal.id, recipeId)
    }
  }

  function closeLinkSheet() {
    setLinkSheetMeal(null)
    setAddSheetLinkOpen(false)
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
    if (shoppingInjected && meal.linkedRecipes?.length > 0) {
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

  // Eating out
  const [ateOutInput, setAteOutInput] = useState('')
  const [showAteOutInput, setShowAteOutInput] = useState(false)
  const [actualCostInput, setActualCostInput] = useState('')
  const [showActualCostEdit, setShowActualCostEdit] = useState(false)

  async function markAsAteOut(mealId) {
    const now = new Date().toISOString()
    const cost = ateOutInput.trim() ? parseFloat(ateOutInput.replace(/[^0-9.]/g, '')) : null
    const update = { status: 'eating_out', cooked_at: now, quick_reviewed: true }
    if (cost && !isNaN(cost)) update.eating_out_cost = cost
    setMeals(prev => prev.map(m =>
      m.id === mealId ? { ...m, ...update } : m
    ))
    setBatchEditMealId(null)
    setShowAteOutInput(false)
    setAteOutInput('')
    await supabase.from('planned_meals').update(update).eq('id', mealId)
    logActivity({ user: appUser, actionType: 'meal_marked_eating_out', targetType: 'planned_meal', targetId: mealId, metadata: { cost: cost || null } })
    showToast('Marked as ate out')
    // Sage insight — fire and forget
    if (cost) {
      const meal = meals.find(m => m.id === mealId)
      const mealName = meal?.custom_name || meal?.recipes?.name || 'Meal'
      supabase.from('sage_background_activity').insert({
        household_id: appUser.household_id, user_id: appUser.id,
        activity_type: 'eating_out',
        message: `You ate out instead of making ${mealName} and spent $${cost.toFixed(2)}.`,
        seen: false, metadata: { meal_id: mealId, meal_name: mealName, cost },
      })
    }
  }

  async function saveActualCost(mealId) {
    const cost = actualCostInput.trim() ? parseFloat(actualCostInput.replace(/[^0-9.]/g, '')) : null
    if (!cost || isNaN(cost)) return
    const meal = meals.find(m => m.id === mealId)
    setMeals(prev => prev.map(m => m.id === mealId ? { ...m, eating_out_actual_cost: cost } : m))
    setActualCostInput('')
    setShowActualCostEdit(false)
    await supabase.from('planned_meals').update({ eating_out_actual_cost: cost }).eq('id', mealId)
    logActivity({ user: appUser, actionType: 'eating_out_actual_cost', targetType: 'planned_meal', targetId: mealId, metadata: { cost } })
    // Sage budget vs actual nudge
    if (meal?.eating_out_cost) {
      const est = Number(meal.eating_out_cost)
      const diff = Math.abs(cost - est).toFixed(2)
      const mealName = meal.custom_name || 'Eating out'
      const message = cost > est
        ? `You estimated $${est.toFixed(2)} for ${mealName} but spent $${cost.toFixed(2)} — $${diff} over budget.`
        : `Nice — you came in $${diff} under your estimate at ${mealName}!`
      supabase.from('sage_background_activity').insert({
        household_id: appUser.household_id, user_id: appUser.id,
        activity_type: 'eating_out_actual', message, seen: false,
        metadata: { meal_id: mealId, estimated: est, actual: cost },
      })
    }
    showToast('Cost saved')
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
    setTimeout(() => navigate('/shop'), 800)
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
  // Only show ghost meal warnings for current or future weeks
  const isCurrentOrFutureWeek = weekOffset >= 0
  const ghostMeals = isCurrentOrFutureWeek
    ? meals.filter(m => m.entry_type === 'ghost' && !m.linkedRecipes?.length && !m.removed_at && !dismissedMeals.has((m.custom_name || '').toLowerCase()))
    : []
  const ghostNames = ghostMeals.map(m => m.custom_name || 'Untitled')

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

  function toggleDayCollapse(dowKey) {
    setCollapsedDays(prev => {
      const next = new Set(prev)
      if (next.has(dowKey)) next.delete(dowKey)
      else next.add(dowKey)
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="page-scroll-container" style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 8px))',
    }}>
      <TopBar />

      {/* ── Week Header (swipe left/right to change weeks) ─────── */}
      <div
        onTouchStart={e => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={e => {
          if (touchStart === null) return
          const diff = touchStart - e.changedTouches[0].clientX
          if (Math.abs(diff) > 50) {
            if (diff > 0) setWeekOffset(o => o + 1)
            else setWeekOffset(o => o - 1)
          }
          setTouchStart(null)
        }}
        style={{ padding: '12px 22px 0', position: 'relative' }}>
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
        {weekOffset < 0 && planId && !weekReviewed && (
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <button onClick={() => navigate(`/review/${planId}`)} style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: '12px', color: arcColor, fontWeight: 400,
              fontFamily: "'Jost', sans-serif",
            }}>
              Review this week →
            </button>
          </div>
        )}
      </div>

      {/* ── Weekly Review Nudge ──────────────────────────────────── */}
      {showWeekReview && (
        <div style={{ padding: '8px 0 0' }}>
          <SageNudgeCard
            tier="notice"
            message="This week is done — ready to close it out?"
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
          const dow = DOW_KEYS[i]
          const hasPlanned = meals.some(m => m.day_of_week === dow)
          const isOnList = onListDays.has(dow)
          const showFilled = isOnList
          return (
            <button key={i} onClick={() => {
              if (hasPlanned) handleDayTileTap(dow)
            }} style={{
              flex: '1 0 auto', minWidth: '44px', padding: '6px 8px', borderRadius: '8px',
              border: showFilled ? 'none' : `0.5px solid ${C.linen}`,
              cursor: 'pointer', textAlign: 'center',
              background: showFilled ? arcColor : 'white',
              color: showFilled ? 'white' : hasPlanned ? C.ink : C.driftwood,
              fontFamily: "'Jost', sans-serif",
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase', opacity: showFilled ? 0.8 : 0.5 }}>
                {DAY_ABBR[i]}
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', fontWeight: 500 }}>
                {date.getDate()}
              </div>
              <div style={{
                width: '5px', height: '5px', borderRadius: '50%', margin: '2px auto 0',
                background: showFilled ? 'rgba(255,255,255,0.7)' : hasPlanned ? arcColor : 'transparent',
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
                Tap any day and describe what you want to make — "Chicken tacos with rice" or "Pizza night." Roux will help you find a recipe or save a new one.
              </div>
              <div style={{ textAlign: 'right', marginTop: '10px' }}>
                <button onClick={dismissHint} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '13px', color: arcColor, fontWeight: 500,
                  fontFamily: "'Jost', sans-serif",
                }}>Got it →</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── First meal added tooltip ─────────────────────────────── */}
      {mealAddedTip && (
        <SageNudgeCard
          tier="teaching"
          message={"Your first meal is on the menu! \uD83C\uDF89 The first time you add a meal you'll type it out manually — but Roux is already learning. Over time, autofill and suggestions will make planning faster and faster. The more you build out your menu, the smarter Roux gets."}
          actionLabel="Got it, don't show again"
          onAction={async () => {
            const updated = await dismissTooltip(appUser.id, appUser.dismissed_tooltips, 'meal_added_first')
            appUser.dismissed_tooltips = updated
            setMealAddedTip(false)
          }}
          secondaryActionLabel="Show me again next time"
          secondaryOnAction={() => setMealAddedTip(false)}
        />
      )}

      {/* ── First recipe linked tooltip ───────────────────────────── */}
      {recipeLinkedTip && (
        <SageNudgeCard
          tier="teaching"
          message={"You just linked a recipe — nice work! A meal and its recipe aren't always the same thing. 'French Dip Sandwiches' might link to a slow cooker beef recipe AND a homemade French bread recipe. The more you link, the smarter your shopping list gets."}
          actionLabel="Got it, don't show again"
          onAction={async () => {
            const updated = await dismissTooltip(appUser.id, appUser.dismissed_tooltips, 'recipe_linked_first')
            appUser.dismissed_tooltips = updated
            setRecipeLinkedTip(false)
          }}
          secondaryActionLabel="Show me again next time"
          secondaryOnAction={() => setRecipeLinkedTip(false)}
        />
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
            const isCollapsed = collapsedDays.has(dowKey)

            return (
              <div key={dowKey} id={`day-${dowKey}`} style={{
                background: 'white', borderRadius: 12, marginBottom: '12px',
                border: `0.5px solid ${isToday ? C.linen : 'rgba(200,185,160,0.45)'}`,
                borderLeft: isToday ? `3px solid ${arcColor}` : undefined,
                overflow: 'hidden',
                scrollMarginTop: '145px',
                animation: `fadeUp 0.35s ease ${0.02 + i * 0.03}s both`,
              }}>
                {/* Day header — tap to toggle */}
                <div onClick={() => toggleDayCollapse(dowKey)} style={{ padding: '12px 14px', cursor: 'pointer', userSelect: 'none' }}>
                  {isToday && (
                    <div style={{
                      fontSize: 11,
                      color: arcColor,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      fontWeight: 500,
                      marginBottom: 4,
                    }}>
                      Today
                    </div>
                  )}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 500, color: C.ink }}>
                        {DAY_NAMES[i]}
                      </span>
                      <span style={{ fontSize: '12px', color: C.ink, opacity: 0.6 }}>{date.getDate()}</span>
                      {isCollapsed && dayMeals.length > 0 && (
                        <span style={{ fontSize: '12px', color: C.driftwood, fontWeight: 300 }}>
                          · {dayMeals.length} meal{dayMeals.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {dt && (
                        <span style={{
                          fontSize: '9px', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: '4px',
                          background: `${dt.color}18`,
                          color: dt.color,
                        }}>{dt.name}</span>
                      )}
                      <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{
                        width: 14, height: 14, opacity: 0.5,
                        transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                        transition: 'transform 200ms ease-out',
                      }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Collapsible content */}
                <div style={{
                  display: 'grid',
                  gridTemplateRows: isCollapsed ? '0fr' : '1fr',
                  transition: 'grid-template-rows 200ms ease-out',
                }}>
                <div style={{ overflow: 'hidden' }}>

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

                  return (
                    <div style={{ padding: '8px 14px 4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {shown.map(ev => {
                        const timeStr = formatEventTime(ev)
                        const title = ev.title || ''
                        return (
                          <div key={ev.id} style={{
                            fontSize: '12px', fontFamily: "'Jost', sans-serif", fontWeight: 400,
                            color: C.honeyDark,
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            background: 'rgba(196,154,60,0.12)',
                            border: '0.5px solid rgba(196,154,60,0.3)',
                            borderRadius: '20px',
                            padding: '3px 10px',
                            alignSelf: 'flex-start',
                          }}>
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
                            {timeStr && <span style={{ flexShrink: 0, fontSize: '11px', opacity: 0.8 }}>{timeStr}</span>}
                          </div>
                        )
                      })}
                      {overflow > 0 && (
                        <div style={{ fontSize: '11px', color: C.honeyDark, opacity: 0.6, paddingLeft: '4px' }}>+{overflow} more</div>
                      )}
                    </div>
                  )
                })()}

                {/* Meals — grouped by meal type */}
                <div style={{ padding: dayMeals.length > 0 ? '4px 14px 8px' : '0' }}>
                  {(() => {
                    const grouped = dayMeals.reduce((acc, meal) => {
                      const type = meal.meal_type || 'dinner'
                      if (!acc[type]) acc[type] = []
                      acc[type].push(meal)
                      return acc
                    }, {})
                    return Object.entries(grouped)
                      .sort(([a], [b]) => (MEAL_TYPE_ORDER[a] ?? 99) - (MEAL_TYPE_ORDER[b] ?? 99))
                      .map(([type, typeMeals]) => (
                      <div key={type}>
                        <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.driftwood, padding: '6px 0 2px' }}>
                          {MEAL_TYPE_LABELS[type] || 'Dinner'}
                        </div>
                        {typeMeals.map(meal => {
                    const sageMatches = meal.sage_match_status === 'pending' && meal.sage_match_result?.matches
                    const isGhost = meal.entry_type === 'ghost' && !meal.linkedRecipes?.length && !dismissedMeals.has((meal.custom_name || '').toLowerCase())
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
                              <span style={{ fontSize: '14px', fontWeight: 500, color: meal.status === 'cooked' ? C.sage : (meal.status === 'eating_out' || meal.entry_type === 'eating_out') ? C.driftwood : meal.linkedRecipes?.length > 0 ? arcColor : C.ink }}>
                                {meal.status === 'cooked' && <span style={{ color: C.sage }}>✓ </span>}
                                {getMealName(meal)}
                              </span>
                              {isGhost && (
                                <svg viewBox="0 0 24 24" fill="none" stroke={C.honey} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0, opacity: 0.8 }}>
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
                                </svg>
                              )}
                              {meal.entry_type === 'eating_out' && meal.eating_out_cost && (
                                <span style={{ fontSize: '11px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontWeight: 300 }}>
                                  ~${Number(meal.eating_out_cost).toFixed(0)}
                                </span>
                              )}
                              {meal.batch_multiplier && meal.batch_multiplier !== 1 && meal.entry_type !== 'eating_out' && (
                                <span style={{ fontSize: '10px', fontWeight: 600, color: arcColor, fontFamily: "'Jost', sans-serif" }}>
                                  {formatMultiplierBadge(meal.batch_multiplier)}
                                </span>
                              )}
                              {(meal.linkedRecipes?.length > 0 || meal.entry_type === 'linked') && meal.entry_type !== 'eating_out' && (
                                <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0 }}>
                                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                                </svg>
                              )}
                            </div>
                            {meal.source_meal_name && (
                              <div style={{ fontSize: '11px', color: C.driftwood, marginTop: '2px' }}>
                                ↩ {meal.source_meal_name}
                              </div>
                            )}
                            {meal.members?.length > 0 && (
                              <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                                {meal.members.map(m => (
                                  <span key={m} style={{
                                    fontSize: '10px', padding: '2px 8px', borderRadius: '20px',
                                    background: '#EFF4EC', color: arcColor, border: `0.5px solid ${arcColor}30`,
                                  }}>{m.split(' ')[0]}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Sage match suggestion card */}
                        {sageMatches && sageMatches.length > 0 && (
                          <div style={{
                            padding: '10px 12px', marginBottom: '6px',
                            background: 'rgba(122,140,110,0.06)', borderRadius: '8px',
                            borderLeft: `3px solid ${C.sage}`,
                          }}>
                            <div style={{ fontSize: '13px', color: C.ink, marginBottom: '8px', lineHeight: 1.5 }}>
                              <span style={{ color: C.sage }}>✦</span> Recipes that might work:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {sageMatches.map(match => (
                                <button key={match.recipe_id} onClick={() => linkRecipeToMeal(meal.id, match.recipe_id, match.recipe_name)} style={{
                                  padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 500,
                                  background: arcColor, color: 'white', border: 'none', cursor: 'pointer',
                                  fontFamily: "'Jost', sans-serif",
                                }}>{match.recipe_name}</button>
                              ))}
                              <button onClick={() => navigate('/save-recipe', { state: { returnTo: 'week', plannedMealId: meal.id, mealName: getMealName(meal) } })} style={{
                                padding: '5px 10px', borderRadius: '8px', fontSize: '11px',
                                background: 'none', color: arcColor, border: `1px solid ${arcColor}`,
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
                            <div style={{ fontSize: '13px', color: C.driftwood, marginBottom: '8px', fontStyle: 'italic' }}>
                              <span style={{ color: C.sage }}>✦</span> No matching recipes found — want to save one?
                            </div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => navigate('/save-recipe', { state: { returnTo: 'week', plannedMealId: meal.id, mealName: getMealName(meal) } })} style={{
                                padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 500,
                                background: arcColor, color: 'white', border: 'none', cursor: 'pointer',
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
                    ))
                  })()}
                </div>

                {/* Add button */}
                <button onClick={() => openAddSheet(date)} style={{
                  width: '100%', padding: dayMeals.length > 0 ? '8px 14px 10px' : '14px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: dayMeals.length > 0 ? '12px' : '13px',
                  color: arcColor, fontWeight: 400,
                  fontFamily: "'Jost', sans-serif",
                  textAlign: 'left',
                  borderTop: dayMeals.length > 0 ? 'none' : `1px dashed ${C.linen}`,
                }}>
                  {dayMeals.length > 0 ? '+ Add another' : `+ Add to ${isToday ? 'Today' : DAY_NAMES[i]}`}
                </button>

                </div>{/* end overflow hidden */}
                </div>{/* end grid accordion */}
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
            background: arcColor, color: 'white', cursor: 'pointer',
            fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
            boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
          }}>{categorizing ? 'Organizing your ingredients…' : injecting ? 'Building...' : shoppingInjected ? 'View my list →' : 'Build my list →'}</button>
        </div>
      )}

      {/* ── Ingredient Cleanup Dialog ────────────────────────────── */}
      <BottomSheet isOpen={!!ingredientDialog} onClose={() => setIngredientDialog(null)}>
        <div style={{ padding: '20px 22px 24px' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '8px' }}>
            Remove {ingredientDialog?.mealName}?
          </div>
          <div style={{ fontSize: '14px', color: C.driftwood, lineHeight: 1.6, marginBottom: '20px' }}>
            {ingredientDialog?.itemCount} ingredient{ingredientDialog?.itemCount !== 1 ? 's' : ''} for this meal {ingredientDialog?.itemCount !== 1 ? 'are' : 'is'} already on your shopping list. Remove {ingredientDialog?.itemCount !== 1 ? 'them' : 'it'} too?
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => removeMealWithIngredients(ingredientDialog.mealId, ingredientDialog.mealName)} style={{
              width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
              background: arcColor, color: 'white', cursor: 'pointer',
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
      </BottomSheet>

      {/* ── Sage Share Sheet ─────────────────────────────────────── */}
      <BottomSheet isOpen={shareSheetOpen} onClose={() => setShareSheetOpen(false)}>
        <div style={{ padding: '20px 22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ color: C.sage, fontSize: '18px' }}>✦</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink }}>Your week is set.</span>
          </div>
          <div style={{ fontSize: '14px', color: C.driftwood, lineHeight: 1.6, marginBottom: '20px' }}>
            Ready to build your shopping list? I'll pull in everything you need from this week's recipes.
          </div>
          {ghostMeals.length > 0 && (
            <div style={{ fontSize: '13px', color: C.driftwood, fontStyle: 'italic', marginBottom: '16px', paddingLeft: '4px' }}>
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
              background: arcColor, color: 'white', cursor: 'pointer',
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
              boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
            }}>{categorizing ? 'Organizing your ingredients…' : injecting ? 'Building...' : 'Build my list →'}</button>
            <button onClick={() => setShareSheetOpen(false)} style={{
              width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
              background: 'none', color: C.driftwood, cursor: 'pointer',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 300,
            }}>I'll do it later</button>
          </div>
        </div>
      </BottomSheet>

      {/* ── Add Meal Sheet ───────────────────────────────────────── */}
      {/* ── Add Meal — full-screen overlay ──────────────────────────── */}
      {addSheetOpen && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: C.cream, overflowY: 'auto',
        maxWidth: '430px', margin: '0 auto',
      }}>
        <TopBar leftAction={{ onClick: () => setAddSheetOpen(false), label: 'Back' }} />
        <div style={{ padding: '16px 22px 40px' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '14px' }}>
                {addSheetDate && `${DAY_NAMES[addSheetDate.getDay() === 0 ? 6 : addSheetDate.getDay() - 1]}, ${addSheetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </div>

              {/* Meals vs recipes education tooltip */}
              {!mealsVsRecipesDismissed && (
                <div style={{
                  padding: '12px 14px', marginBottom: '14px', background: 'white',
                  borderRadius: '10px', borderLeft: `3px solid ${C.sage}`,
                  border: `1px solid rgba(200,185,160,0.4)`,
                }}>
                  <div style={{ fontSize: '13px', color: C.ink, lineHeight: 1.6, marginBottom: '10px' }}>
                    <span style={{ color: C.sage }}>✦</span> Think of this page as your family's weekly menu. Each day card is that day's menu — add what you're having: "Hamburgers", "Tacos", "Spaghetti". These are menu items, not recipes. Recipes live behind the scenes and power your shopping list. Each menu item can have one or more recipes linked to it — and you choose which recipe to use each time you plan that meal.
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={async () => {
                      const updated = await dismissTooltip(appUser.id, appUser.dismissed_tooltips, 'meals_vs_recipes')
                      appUser.dismissed_tooltips = updated
                      setMealsVsRecipesDismissed(true)
                    }} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: '12px', color: arcColor, fontWeight: 500, fontFamily: "'Jost', sans-serif",
                    }}>Got it, don't show again</button>
                    <button onClick={() => setAddSheetOpen(false)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: '12px', color: C.driftwood, fontWeight: 300, fontFamily: "'Jost', sans-serif",
                    }}>Show me again next time</button>
                  </div>
                </div>
              )}

              {/* Input — hidden for leftovers (source selector replaces it) */}
              {addMealCategory !== 'leftovers' && (
              <>
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
                    border: `1.5px solid ${C.linen}`, borderRadius: recipeSuggestions.length > 0 ? '12px 12px 0 0' : '12px',
                    outline: 'none', color: C.ink, boxSizing: 'border-box',
                  }}
                />
                {/* Meal name suggestions — traditional dropdown */}
                {recipeSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: `0.5px solid ${C.linen}`,
                    borderTop: 'none',
                    borderRadius: '0 0 10px 10px',
                    boxShadow: '0 4px 12px rgba(44,36,23,0.08)',
                    zIndex: 50,
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}>
                    {recipeSuggestions.map((r, idx) => (
                      <div
                        key={r.id}
                        onMouseDown={() => selectRecipeSuggestion(r)}
                        style={{
                          padding: '12px 14px',
                          fontSize: 14,
                          color: C.ink,
                          borderBottom: idx < recipeSuggestions.length - 1 ? `0.5px solid ${C.linen}` : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontFamily: "'Jost', sans-serif",
                        }}
                      >
                        <span style={{ fontSize: 11, color: C.driftwood }}>↩</span>
                        {r.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </>
              )}

              {/* Meal time selector — always one selected */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                {['breakfast', 'lunch', 'dinner', 'snack'].map(mt => (
                  <button key={mt} onClick={() => setAddMealType(mt)} style={{
                    flex: 1, padding: '8px', borderRadius: '10px', fontSize: '12px',
                    border: addMealType === mt ? `1.5px solid ${arcColor}` : `1px solid ${C.linen}`,
                    background: addMealType === mt ? 'rgba(61,107,79,0.08)' : 'white',
                    color: addMealType === mt ? arcColor : C.ink,
                    cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                    fontWeight: addMealType === mt ? 500 : 400,
                  }}>{MEAL_TYPE_LABELS[mt]}</button>
                ))}
              </div>
              {/* Category selector — toggleable, none by default */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                {['other', 'leftovers', 'eating_out'].map(cat => (
                  <button key={cat} onClick={() => setAddMealCategory(prev => prev === cat ? null : cat)} style={{
                    flex: 1, padding: '8px', borderRadius: '10px', fontSize: '12px',
                    border: addMealCategory === cat ? `1.5px solid ${C.honey}` : `1px solid ${C.linen}`,
                    background: addMealCategory === cat ? 'rgba(196,154,60,0.08)' : 'white',
                    color: addMealCategory === cat ? C.honeyDark : C.driftwood,
                    cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                    fontWeight: addMealCategory === cat ? 500 : 400,
                  }}>{MEAL_TYPE_LABELS[cat]}</button>
                ))}
              </div>

              {/* Leftovers source selector */}
              {addMealCategory === 'leftovers' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: C.driftwood, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                    What are these leftovers from?
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                    {recentMeals.map(meal => (
                      <button key={meal.id} onClick={() => { setSelectedSourceMeal(meal); setLeftoversFreeText('') }} style={{
                        padding: '12px 14px', borderRadius: '10px',
                        border: `0.5px solid ${selectedSourceMeal?.id === meal.id ? arcColor : C.linen}`,
                        background: selectedSourceMeal?.id === meal.id ? `${arcColor}15` : 'white',
                        textAlign: 'left', cursor: 'pointer',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontFamily: "'Jost', sans-serif",
                      }}>
                        <span style={{ fontSize: '14px', color: C.ink }}>{meal.custom_name}</span>
                        <span style={{ fontSize: '11px', color: C.driftwood }}>{formatMealDate(meal.planned_date)}</span>
                      </button>
                    ))}
                    {recentMeals.length === 0 && (
                      <div style={{ fontSize: '13px', color: C.driftwood, fontStyle: 'italic', padding: '8px 0' }}>No recent meals found</div>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: C.driftwood, marginBottom: '6px' }}>Don't see it? Type the meal name:</div>
                  <input type="text" placeholder="e.g. Birthday dinner leftovers" value={leftoversFreeText}
                    onChange={e => { setLeftoversFreeText(e.target.value); setSelectedSourceMeal(null) }}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      border: `0.5px solid ${C.linen}`, fontSize: '14px',
                      fontFamily: "'Jost', sans-serif", color: C.ink, background: 'white',
                      outline: 'none', boxSizing: 'border-box',
                    }} />
                </div>
              )}

              {/* Repeat days picker — auto for breakfast/snack, toggle for lunch */}
              {(addMealType === 'breakfast' || addMealType === 'snack' || (addMealType === 'lunch' && showRepeatPicker)) && addSheetDate && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: C.driftwood, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                    Repeat this week
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {weekDates.map((d, i) => {
                      const isCurrentDay = toLocalDateStr(d) === toLocalDateStr(addSheetDate)
                      const isSelected = repeatDays.has(i)
                      return (
                        <button key={i} onClick={() => {
                          if (isCurrentDay) return
                          setRepeatDays(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next })
                        }} style={{
                          flex: 1, padding: '8px 0', borderRadius: '8px',
                          border: `0.5px solid ${isSelected ? arcColor : C.linen}`,
                          background: isCurrentDay ? C.linen : isSelected ? arcColor : 'white',
                          color: isCurrentDay ? C.driftwood : isSelected ? 'white' : C.driftwood,
                          fontSize: '11px', fontFamily: "'Jost', sans-serif",
                          cursor: isCurrentDay ? 'default' : 'pointer',
                          opacity: isCurrentDay ? 0.5 : 1,
                        }}>
                          {DAY_ABBR[i].charAt(0)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {addMealType === 'lunch' && !showRepeatPicker && (
                <button onClick={() => setShowRepeatPicker(true)} style={{
                  fontSize: '12px', color: arcColor, background: 'none', border: 'none',
                  padding: '0 0 12px', cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                }}>+ Repeat this week</button>
              )}

              {/* Eating out: cost input */}
              {addMealCategory === 'eating_out' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: C.driftwood, marginBottom: '6px' }}>Estimated spend? (optional)</div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: C.driftwood }}>$</span>
                    <input type="text" inputMode="decimal" value={addEatingOutCost} onChange={e => setAddEatingOutCost(e.target.value)}
                      placeholder="0.00" style={{
                        width: '100%', padding: '12px 14px 12px 28px', fontSize: '15px',
                        fontFamily: "'Jost', sans-serif", fontWeight: 300,
                        border: `1.5px solid ${C.linen}`, borderRadius: '12px',
                        outline: 'none', color: C.ink, boxSizing: 'border-box',
                      }} />
                  </div>
                </div>
              )}

              {/* Link recipes (optional) — hidden for eating out and leftovers */}
              {addMealCategory !== 'eating_out' && addMealCategory !== 'leftovers' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: C.driftwood, marginBottom: '8px' }}>Link a recipe (optional)</div>
                  {addSheetRecipes.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {addSheetRecipes.map(lr => (
                        <span key={lr.recipe_id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '5px 10px', borderRadius: '8px', fontSize: '12px',
                          background: 'rgba(61,107,79,0.08)', color: arcColor,
                          fontFamily: "'Jost', sans-serif", fontWeight: 500,
                        }}>
                          {lr.recipe_name}
                          <button onClick={() => setAddSheetRecipes(prev => prev.filter(r => r.recipe_id !== lr.recipe_id))} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontSize: '14px', color: C.driftwood, lineHeight: 1, marginLeft: '2px',
                          }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setAddSheetLinkOpen(true); openLinkSheet({ id: '__add_sheet__', custom_name: addInput.trim() || 'New meal', linkedRecipes: addSheetRecipes }) }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '12px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontWeight: 400,
                  }}>{addSheetRecipes.length > 0 ? '+ Add another recipe' : '+ Link a recipe'}</button>
                </div>
              )}

              {/* Batch size — hidden for eating out and leftovers */}
              {addMealCategory !== 'eating_out' && addMealCategory !== 'leftovers' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: C.driftwood, marginBottom: '6px' }}>Batch size</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {BATCH_OPTIONS.map(val => (
                      <button key={val} onClick={() => setAddBatchMultiplier(val)} style={{
                        flex: 1, padding: '8px', borderRadius: '10px', fontSize: '13px',
                        border: addBatchMultiplier === val ? `1.5px solid ${arcColor}` : `1px solid ${C.linen}`,
                        background: addBatchMultiplier === val ? 'rgba(61,107,79,0.08)' : 'white',
                        color: addBatchMultiplier === val ? arcColor : C.ink,
                        cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                        fontWeight: addBatchMultiplier === val ? 600 : 400,
                      }}>{BATCH_LABELS[val]}</button>
                  ))}
                </div>
              </div>
              )}

              {/* Member tagging — optional, all meal types */}
              {familyMembers.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: C.driftwood, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                    For (optional)
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {familyMembers.map(member => {
                      const firstName = member.name.split(' ')[0]
                      const isSelected = selectedMembers.has(member.name)
                      return (
                        <button key={member.id} onClick={() => {
                          setSelectedMembers(prev => { const next = new Set(prev); if (next.has(member.name)) next.delete(member.name); else next.add(member.name); return next })
                        }} style={{
                          padding: '6px 12px', borderRadius: '20px',
                          border: `0.5px solid ${isSelected ? arcColor : C.linen}`,
                          background: isSelected ? `${arcColor}15` : 'white',
                          color: isSelected ? arcColor : C.driftwood,
                          fontSize: '12px', fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                        }}>{firstName}</button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Add button */}
              {(() => {
                const canSave = addMealCategory === 'leftovers'
                  ? !!(selectedSourceMeal || leftoversFreeText.trim())
                  : !!addInput.trim()
                return (
                <button onClick={addMeal} disabled={!canSave || adding} style={{
                  width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
                  background: canSave ? arcColor : C.linen,
                  color: canSave ? 'white' : C.driftwood,
                  cursor: canSave ? 'pointer' : 'default',
                  fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                  boxShadow: canSave ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
                }}>
                  {adding ? 'Adding...' : 'Add to menu'}
                </button>
                )
              })()}
            </div>
      </div>
      )}

      {/* ── Meal Edit Sheet ──────────────────────────────────────── */}
      {/* ── Meal Edit — full-page overlay (keyboard safe for cost inputs) ── */}
      {!!batchEditMealId && (() => {
        const editMeal = meals.find(m => m.id === batchEditMealId)
        if (!editMeal) return null
        const currentBatch = editMeal.batch_multiplier || 1
        return (
          <div style={{
            position: 'fixed', inset: 0, background: C.cream, zIndex: 200,
            display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto',
          }}>
            <div style={{
              background: C.forest, padding: '10px 16px 12px',
              display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            }}>
              <button onClick={() => setBatchEditMealId(null)} style={{
                background: 'rgba(250,247,242,0.15)', border: 'none', borderRadius: '50%',
                width: 32, height: 32, color: 'white', fontSize: 18, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>‹</button>
              <span style={{ fontFamily: "'Slabo 27px', serif", fontSize: 18, color: 'rgba(250,247,242,0.95)' }}>
                Edit meal
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', paddingBottom: 120 }}>
                {/* 1. Meal name */}
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '18px' }}>
                  {getMealName(editMeal)}
                </div>

                {/* 2. Linked recipes */}
                <div style={{ fontSize: '11px', color: C.driftwood, marginBottom: '8px' }}>Linked recipes</div>
                <div style={{ marginBottom: '16px' }}>
                  {(editMeal.linkedRecipes || []).length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {editMeal.linkedRecipes.map(lr => (
                        <span key={lr.recipe_id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '5px 10px', borderRadius: '8px', fontSize: '12px',
                          background: 'rgba(61,107,79,0.08)', color: arcColor,
                          fontFamily: "'Jost', sans-serif", fontWeight: 500,
                        }}>
                          {lr.recipe_name}
                          <button onClick={() => unlinkRecipeFromMeal(editMeal.id, lr.recipe_id)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontSize: '14px', color: C.driftwood, lineHeight: 1, marginLeft: '2px',
                          }}>×</button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <button onClick={() => { setBatchEditMealId(null); openLinkSheet(editMeal) }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '12px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontWeight: 400,
                  }}>{(editMeal.linkedRecipes || []).length > 0 ? '+ Add another recipe' : '+ Link a recipe'}</button>
                </div>

                {/* 3. Cooked / Ate out — for past meals that haven't been reviewed */}
                {editMeal.planned_date && editMeal.planned_date < todayStr && editMeal.status !== 'cooked' && editMeal.status !== 'eating_out' && !editMeal.removed_at && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: showAteOutInput ? '10px' : 0 }}>
                      <button onClick={() => markAsCooked(editMeal.id)} style={{
                        flex: 1, padding: '12px', borderRadius: '12px',
                        border: `1.5px solid ${arcColor}`, background: 'white', color: arcColor,
                        cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}>✓ Cooked</button>
                      <button onClick={() => setShowAteOutInput(!showAteOutInput)} style={{
                        flex: 1, padding: '12px', borderRadius: '12px',
                        border: `1.5px solid ${C.linen}`, background: showAteOutInput ? 'rgba(140,123,107,0.06)' : 'white', color: C.driftwood,
                        cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 400,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      }}>🍽️ Ate out</button>
                    </div>
                    {showAteOutInput && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: C.driftwood }}>$</span>
                          <input type="text" inputMode="decimal" value={ateOutInput} onChange={e => setAteOutInput(e.target.value)}
                            placeholder="0.00" style={{
                              width: '100%', padding: '10px 12px 10px 24px', fontSize: '14px',
                              fontFamily: "'Jost', sans-serif", border: `1.5px solid ${C.linen}`,
                              borderRadius: '10px', outline: 'none', color: C.ink, boxSizing: 'border-box',
                            }} />
                        </div>
                        <button onClick={() => markAsAteOut(editMeal.id)} style={{
                          padding: '10px 16px', borderRadius: '10px', border: 'none',
                          background: arcColor, color: 'white', cursor: 'pointer',
                          fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 500,
                        }}>Save</button>
                        <button onClick={() => { setAteOutInput(''); markAsAteOut(editMeal.id) }} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          fontSize: '12px', color: C.driftwood, fontFamily: "'Jost', sans-serif",
                        }}>Skip</button>
                      </div>
                    )}
                  </div>
                )}
                {editMeal.status === 'cooked' && editMeal.cooked_at && (
                  <div style={{
                    width: '100%', padding: '12px', borderRadius: '12px', marginBottom: '16px',
                    background: 'rgba(122,140,110,0.08)', textAlign: 'center',
                    fontSize: '13px', color: C.sage, fontFamily: "'Jost', sans-serif", fontWeight: 400,
                  }}>✓ Cooked {new Date(editMeal.cooked_at).toLocaleDateString('en-US', { weekday: 'long' })}</div>
                )}
                {(editMeal.status === 'eating_out' || editMeal.entry_type === 'eating_out') && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      width: '100%', padding: '12px', borderRadius: '12px', marginBottom: '10px',
                      background: 'rgba(140,123,107,0.06)', textAlign: 'center',
                      fontSize: '13px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontWeight: 400,
                    }}>🍽️ {editMeal.status === 'eating_out' ? 'Ate out' : 'Eating out'}{editMeal.eating_out_cost ? ` · Est. $${Number(editMeal.eating_out_cost).toFixed(2)}` : ''}</div>

                    {/* Actual cost capture — for past meals */}
                    {editMeal.planned_date && editMeal.planned_date < todayStr && (
                      editMeal.eating_out_actual_cost && !showActualCostEdit ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '14px', color: C.sage, fontWeight: 500 }}>Spent: ${Number(editMeal.eating_out_actual_cost).toFixed(2)} ✓</span>
                          <button onClick={() => { setActualCostInput(String(editMeal.eating_out_actual_cost)); setShowActualCostEdit(true) }} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontSize: '12px', color: C.driftwood, fontFamily: "'Jost', sans-serif",
                          }}>Update</button>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '11px', color: C.driftwood, marginBottom: '6px' }}>How much did you spend?</div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: C.driftwood }}>$</span>
                              <input type="text" inputMode="decimal" value={actualCostInput} onChange={e => setActualCostInput(e.target.value)}
                                placeholder="0.00" style={{
                                  width: '100%', padding: '10px 12px 10px 24px', fontSize: '14px',
                                  fontFamily: "'Jost', sans-serif", border: `1.5px solid ${C.linen}`,
                                  borderRadius: '10px', outline: 'none', color: C.ink, boxSizing: 'border-box',
                                }} />
                            </div>
                            <button onClick={() => saveActualCost(editMeal.id)} disabled={!actualCostInput.trim()} style={{
                              padding: '10px 16px', borderRadius: '10px', border: 'none',
                              background: actualCostInput.trim() ? arcColor : C.linen, color: actualCostInput.trim() ? 'white' : C.driftwood,
                              cursor: actualCostInput.trim() ? 'pointer' : 'default',
                              fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 500,
                            }}>Save</button>
                          </div>
                          <button onClick={() => navigate(`/pantry/eating-out-receipt/${editMeal.id}`)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0 0',
                            fontSize: '12px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontStyle: 'italic',
                          }}>or scan a receipt →</button>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* 4. Batch size — compact */}
                <div style={{ fontSize: '11px', color: C.driftwood, marginBottom: '6px' }}>Batch size</div>
                <div style={{ display: 'flex', gap: '5px', marginBottom: '20px' }}>
                  {BATCH_OPTIONS.map(val => (
                    <button key={val} onClick={() => changeBatchMultiplier(batchEditMealId, val)} style={{
                      flex: 1, padding: '6px 10px', height: '32px', borderRadius: '8px', fontSize: '13px',
                      border: currentBatch === val ? `1.5px solid ${arcColor}` : `1px solid ${C.linen}`,
                      background: currentBatch === val ? 'rgba(61,107,79,0.08)' : 'white',
                      color: currentBatch === val ? arcColor : C.ink,
                      cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                      fontWeight: currentBatch === val ? 600 : 400,
                    }}>{BATCH_LABELS[val]}</button>
                  ))}
                </div>

                {/* 5. Done button */}
                <button onClick={() => setBatchEditMealId(null)} style={{
                  width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                  background: arcColor, color: 'white', cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                  boxShadow: '0 4px 16px rgba(30,55,35,0.25)', marginBottom: '16px',
                }}>Done</button>

                {/* Divider + Move / Remove */}
                <div style={{ borderTop: `1px solid ${C.linen}`, paddingTop: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => openMovePicker(editMeal.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '13px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontWeight: 400,
                  }}>Move to another day →</button>
                  <button onClick={() => { setBatchEditMealId(null); initDeleteMeal(editMeal.id) }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '13px', color: '#C0392B', fontFamily: "'Jost', sans-serif", fontWeight: 400,
                  }}>Remove this meal →</button>
                </div>
            </div>
          </div>
        )
      })()}

      {/* ── Move Meal Day Picker ─────────────────────────────────── */}
      <BottomSheet isOpen={moveDayPickerOpen} onClose={() => { setMoveDayPickerOpen(false); setMoveMealId(null) }} zIndex={300}>
        <div style={{ padding: '20px 22px 24px' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '16px' }}>
            Move to another day
          </div>
          {(() => {
            const thisWeekDates = weekDates
            const nextWeekDates = getWeekDatesTZ(tz, weekOffset + 1)
            const movingMeal = meals.find(m => m.id === moveMealId)
            const currentDateStr = movingMeal ? movingMeal.planned_date : null

            function renderDay(date, mealCount) {
              const dateStr = toLocalDateStr(date)
              const dayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1
              const isCurrent = dateStr === currentDateStr
              const isToday = dateStr === todayStr
              return (
                <button key={dateStr} onClick={() => !isCurrent && moveMealToDay(date)} disabled={isCurrent} style={{
                  width: '100%', padding: '12px 14px', borderRadius: '10px',
                  border: `0.5px solid ${isCurrent ? C.linen : 'rgba(200,185,160,0.3)'}`,
                  background: isCurrent ? C.linen : 'white',
                  cursor: isCurrent ? 'default' : 'pointer',
                  opacity: isCurrent ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontFamily: "'Jost', sans-serif",
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: isToday ? 500 : 400, color: isToday ? arcColor : C.ink }}>
                      {DAY_NAMES[dayIdx]}
                    </span>
                    <span style={{ fontSize: '12px', color: C.driftwood }}>
                      {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: C.driftwood }}>
                    {mealCount > 0 ? `${mealCount} meal${mealCount !== 1 ? 's' : ''}` : ''}
                  </span>
                </button>
              )
            }

            return (
              <>
                {(() => {
                  const thisWeekFiltered = thisWeekDates.filter(date => toLocalDateStr(date) >= todayStr)
                  if (thisWeekFiltered.length === 0) return null
                  return (
                    <>
                      <div style={{ fontSize: '11px', color: C.driftwood, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>This week</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                        {thisWeekFiltered.map(date => {
                          const dayIdx = date.getDay() === 0 ? 6 : date.getDay() - 1
                          const count = meals.filter(m => m.day_of_week === DOW_KEYS[dayIdx]).length
                          return renderDay(date, count)
                        })}
                      </div>
                    </>
                  )
                })()}
                <div style={{ fontSize: '11px', color: C.driftwood, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Next week</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {nextWeekDates.map(date => {
                    const dateStr = toLocalDateStr(date)
                    const count = moveNextWeekCounts[dateStr] || 0
                    return renderDay(date, count)
                  })}
                </div>
              </>
            )
          })()}
        </div>
      </BottomSheet>

      {/* ── Recipe Link Sheet (multi-select) ──────────────────────── */}
      {/* ── Recipe Link — full-page overlay (keyboard safe) ────── */}
      {!!linkSheetMeal && (() => {
        const linkedSet = addSheetLinkOpen
          ? new Set(addSheetRecipes.map(r => r.recipe_id))
          : new Set((meals.find(m => m.id === linkSheetMeal.id)?.linkedRecipes || []).map(r => r.recipe_id))
        const sheetMealName = addSheetLinkOpen ? (addInput.trim() || 'New meal') : getMealName(linkSheetMeal)
        return (
          <div style={{
            position: 'fixed', inset: 0, background: C.cream, zIndex: 300,
            display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto',
          }}>
            <div style={{
              background: C.forest, padding: '10px 16px 12px',
              display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
            }}>
              <button onClick={closeLinkSheet} style={{
                background: 'rgba(250,247,242,0.15)', border: 'none', borderRadius: '50%',
                width: 32, height: 32, color: 'white', fontSize: 18, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>‹</button>
              <span style={{ fontFamily: "'Slabo 27px', serif", fontSize: 18, color: 'rgba(250,247,242,0.95)' }}>
                Link recipes
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', paddingBottom: 120 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '14px' }}>
                {sheetMealName}
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
              <div>
                {linkResults.length === 0 && (
                  <div style={{ fontSize: '13px', color: C.driftwood, fontStyle: 'italic', padding: '12px 0' }}>
                    {linkSearch.trim() ? 'No recipes found' : 'Loading recipes...'}
                  </div>
                )}
                {linkResults.map(r => {
                  const isLinked = linkedSet.has(r.id)
                  return (
                    <button key={r.id} onClick={() => isLinked ? unlinkFromSheet(r.id) : linkFromSheet(r.id, r.name)} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                      padding: '12px 0', background: 'none', border: 'none',
                      borderBottom: '1px solid rgba(200,185,160,0.15)',
                      cursor: 'pointer', textAlign: 'left', fontFamily: "'Jost', sans-serif",
                    }}>
                      {isLinked ? (
                        <div style={{ width: 18, height: 18, borderRadius: '4px', background: arcColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}><path d="M20 6L9 17l-5-5"/></svg>
                        </div>
                      ) : (
                        <div style={{ width: 18, height: 18, borderRadius: '4px', border: `1.5px solid ${C.linen}`, flexShrink: 0 }} />
                      )}
                      <span style={{ fontSize: '14px', color: isLinked ? arcColor : C.ink, fontWeight: isLinked ? 500 : 300 }}>{r.name}</span>
                    </button>
                  )
                })}
              </div>
              <button onClick={() => {
                closeLinkSheet()
                setAddSheetOpen(false)
                navigate('/save-recipe', { state: { returnTo: 'week', mealName: sheetMealName } })
              }} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0 0',
                fontSize: '13px', color: arcColor, fontFamily: "'Jost', sans-serif", fontWeight: 400,
                width: '100%', textAlign: 'left',
              }}>+ Save a new recipe</button>
              <button onClick={closeLinkSheet} style={{
                width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                background: arcColor, color: 'white', cursor: 'pointer', marginTop: '12px',
                fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
              }}>Done</button>
            </div>
          </div>
        )
      })()}

      {/* ── Toast ────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: arcColor, color: 'white', padding: '10px 22px', borderRadius: '10px',
          fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
          zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>{toast}</div>
      )}

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── Day deselect confirmation ──────────────────────────── */}
      <BottomSheet isOpen={!!deselectConfirm} onClose={() => setDeselectConfirm(null)}>
        {deselectConfirm && (
          <div style={{ padding: '16px 22px 24px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '8px' }}>
              Remove {deselectConfirm.dayName}'s ingredients?
            </div>
            <div style={{ fontSize: '13px', color: C.driftwood, lineHeight: 1.6, marginBottom: '20px' }}>
              This will remove ingredients from {deselectConfirm.mealNames.join(', ')} from your list.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={confirmDeselectDay} style={{
                flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                background: arcColor, color: 'white',
                fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500, cursor: 'pointer',
              }}>Remove from list</button>
              <button onClick={() => setDeselectConfirm(null)} style={{
                flex: 1, padding: '12px', borderRadius: '12px',
                border: `1px solid ${C.linen}`, background: 'none', color: C.driftwood,
                fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 400, cursor: 'pointer',
              }}>Keep them</button>
            </div>
          </div>
        )}
      </BottomSheet>

      <BottomNav activeTab="plan" />
    </div>
  )
}
