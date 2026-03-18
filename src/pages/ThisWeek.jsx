/**
 * ThisWeek.jsx — Weekly meal planner.
 * Matches prototypes/roux-thisweek-style1-objects.html exactly.
 * Standalone full-page component (own topbar + bottom nav, like Dashboard).
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getWeekDatesTZ, getWeekStartTZ, getDayOfWeekTZ, getTodayStr, toLocalDateStr } from '../lib/dateUtils'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

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

const DOW_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDateStr(d) {
  return toLocalDateStr(d)
}

function formatWeekRange(dates) {
  const opts = { month: 'short', day: 'numeric' }
  return `${dates[0].toLocaleDateString('en-US', opts)} — ${dates[6].toLocaleDateString('en-US', opts)}`
}

const DAY_TYPE_MAP = {
  school:    { label: 'School',    emoji: '🔵', color: '#3A6CB5',    bg: 'rgba(91,141,217,0.12)'  },
  weekend:   { label: 'Weekend',   emoji: '🟢', color: C.forest,     bg: 'rgba(122,140,110,0.12)' },
  no_school: { label: 'No School', emoji: '🟠', color: '#D4874A',    bg: 'rgba(212,135,74,0.12)'  },
  summer:    { label: 'Summer',    emoji: '🟡', color: C.honey,      bg: 'rgba(196,154,60,0.12)'  },
}

function getDayType(jsDay, savedType) {
  if (savedType && DAY_TYPE_MAP[savedType]) return DAY_TYPE_MAP[savedType]
  if (jsDay === 0 || jsDay === 6) return DAY_TYPE_MAP.weekend
  return DAY_TYPE_MAP.school
}

function getMealName(meal) {
  if (!meal) return null
  if (meal.slot_type === 'meal')     return meal.meals?.name     ?? null
  if (meal.slot_type === 'recipe')   return meal.recipes?.name   ?? null
  if (meal.slot_type === 'note')     return meal.note            ?? null
  if (meal.slot_type === 'leftover') return 'Leftovers'
  if (meal.slot_type === 'takeout')  return 'Eating Out'
  return meal.meals?.name ?? meal.recipes?.name ?? meal.note ?? null
}

function getStatusChip(status) {
  if (status === 'cooked' || status === 'prepped') return { label: 'Confirmed', variant: 'confirmed' }
  if (status === 'skipped')                        return { label: 'Skipped',   variant: 'skipped'   }
  return                                                  { label: 'Planned',   variant: 'planned'   }
}

const chipStyles = {
  confirmed: { background: 'rgba(61,107,79,0.10)',   color: C.forest    },
  planned:   { background: 'rgba(200,185,160,0.30)', color: C.driftwood },
  skipped:   { background: 'rgba(200,60,60,0.08)',   color: C.red, textDecoration: 'line-through' },
}

// ── Shared button styles ───────────────────────────────────────────────────────
const iconBtnStyle = {
  width: '38px', height: '38px', borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', background: 'none', cursor: 'pointer',
  color: 'rgba(210,230,200,0.7)',
}

const weekNavBtnStyle = {
  width: '34px', height: '34px', borderRadius: '50%',
  border: '1px solid rgba(200,185,160,0.6)',
  background: 'white', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: C.driftwood, boxShadow: '0 1px 4px rgba(80,60,30,0.07)',
  flexShrink: 0,
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ThisWeek({ appUser }) {
  const navigate  = useNavigate()
  const location  = useLocation()

  const [weekOffset,        setWeekOffset]        = useState(0)
  const [plan,              setPlan]              = useState(null)
  const [planMeals,         setPlanMeals]         = useState([])
  const [proteins,          setProteins]          = useState([])
  const [traditions,        setTraditions]        = useState([])
  const [loading,           setLoading]           = useState(true)
  const [proteinOpen,       setProteinOpen]       = useState(false)
  const [publishing,        setPublishing]        = useState(false)
  // publishBarVisible removed — publish action lives in status banner only
  const [bannerPulsing,     setBannerPulsing]     = useState(false)
  const [sheetOpen,         setSheetOpen]         = useState(false)
  const [sheetDay,          setSheetDay]          = useState('')
  const [sheetSlot,         setSheetSlot]         = useState('')
  const [sheetDate,         setSheetDate]         = useState('')
  const [sheetDow,          setSheetDow]          = useState('')
  const [sheetSagePrimary,  setSheetSagePrimary]  = useState(false)
  const [sheetMode,         setSheetMode]         = useState('add') // 'add' | 'filled' | 'manual'
  const [sheetMealId,       setSheetMealId]       = useState(null)  // planned_meals.id for filled sheet
  const [manualInput,       setManualInput]       = useState('')
  const [toastMsg,          setToastMsg]          = useState('')
  const [overlayVisible,    setOverlayVisible]    = useState(false)
  const [shoppingPrompt,    setShoppingPrompt]    = useState(false)
  const [savedDayTypes,     setSavedDayTypes]     = useState(null) // from meal_plans.notes
  const [activeTemplateName, setActiveTemplateName] = useState(null)
  const [repeatPrompt,      setRepeatPrompt]      = useState(null) // { mealName, mealType, slotType, recipeId, note, savedDow }
  const [repeatSelected,    setRepeatSelected]    = useState(new Set())
  const [addProteinOpen,    setAddProteinOpen]    = useState(false)
  const [groceryStores,     setGroceryStores]     = useState([])
  const [proteinName,       setProteinName]       = useState('')
  const [proteinStoreId,    setProteinStoreId]    = useState(null)
  const [proteinOnSale,     setProteinOnSale]     = useState(false)
  const [proteinPrice,      setProteinPrice]      = useState('')
  const [savingProtein,     setSavingProtein]     = useState(false)
  const [proteinUnit,       setProteinUnit]       = useState('lb')
  const [editingProteinId,  setEditingProteinId]  = useState(null)
  const [addingStore,       setAddingStore]       = useState(false)
  const [newStoreName,      setNewStoreName]      = useState('')
  const [proteinTab,        setProteinTab]        = useState('usuals') // 'usuals' | 'new'
  const [proteinFavorites,  setProteinFavorites]  = useState([])
  const [saveToUsuals,      setSaveToUsuals]      = useState(true)
  const [editingFavorites,  setEditingFavorites]  = useState(false)
  const [expandedDays,      setExpandedDays]      = useState(new Set()) // dowKeys that are expanded

  const overlayRef = useRef(null)
  const tz         = appUser?.timezone ?? 'America/Chicago'
  const weekDates  = getWeekDatesTZ(tz, weekOffset)
  const today      = new Date()
  const todayStr   = getTodayStr(tz)    // YYYY-MM-DD in user's timezone
  const isPastWeek = weekOffset < 0

  // Auto-expand today when viewing current week
  useEffect(() => {
    if (weekOffset === 0) {
      const todayDow = DOW_KEYS[getDayOfWeekTZ(tz)]
      setExpandedDays(new Set([todayDow]))
    } else {
      setExpandedDays(new Set())
    }
  }, [weekOffset, tz])

  useEffect(() => {
    if (appUser?.household_id) {
      loadWeekData()
      // Load grocery stores + protein favorites once
      supabase.from('grocery_stores').select('id, name').eq('household_id', appUser.household_id)
        .then(({ data }) => { if (data) setGroceryStores(data) })
      supabase.from('protein_favorites').select('*, grocery_stores(name)').eq('household_id', appUser.household_id).order('sort_order')
        .then(({ data, error }) => { if (data) setProteinFavorites(data); if (error) console.log('[Roux] protein_favorites not available:', error.message) })
    }
  }, [appUser?.household_id, weekOffset, location.key])

  async function loadWeekData() {
    setLoading(true)
    setProteins([])
    try {
      const hid       = appUser.household_id
      const weekStart = getWeekStartTZ(tz, weekOffset)

      const [tradRes, planRes] = await Promise.all([
        supabase.from('household_traditions')
          .select('id, name, day_of_week, tradition_type')
          .eq('household_id', hid),
        supabase.from('meal_plans')
          .select('id, status, week_start_date, week_end_date, published_at, notes')
          .eq('household_id', hid)
          .eq('week_start_date', weekStart)
          .maybeSingle(),
      ])

      if (tradRes.data) setTraditions(tradRes.data)

      let activePlan = planRes.data

      // Future weeks: create a draft on first navigation
      if (!activePlan && weekOffset > 0) {
        const { data: newPlan } = await supabase
          .from('meal_plans')
          .insert({
            household_id:    hid,
            created_by:      appUser.id,
            week_start_date: weekStart,
            week_end_date:   toLocalDateStr(weekDates[6]),
            status:          'draft',
          })
          .select('id, status, week_start_date, week_end_date, published_at')
          .single()
        activePlan = newPlan
      }

      setPlan(activePlan)

      // Parse saved day types + template name from meal_plans.notes (set by Week Settings)
      if (activePlan?.notes) {
        try {
          const config = JSON.parse(activePlan.notes)
          setSavedDayTypes(config.day_types || null)
          setActiveTemplateName(config.active_template_name || null)
        } catch { setSavedDayTypes(null); setActiveTemplateName(null) }
      } else {
        setSavedDayTypes(null)
        setActiveTemplateName(null)
      }

      const isPublished = activePlan?.status === 'published' || activePlan?.status === 'active'

      if (activePlan) {
        const [mealsRes, proteinsRes] = await Promise.all([
          supabase.from('planned_meals')
            .select('*, meals(name), recipes(name, prep_time_minutes), household_traditions(name)')
            .eq('meal_plan_id', activePlan.id),
          supabase.from('weekly_proteins')
            .select('*, grocery_stores(name)')
            .eq('meal_plan_id', activePlan.id),
        ])
        if (mealsRes.data) setPlanMeals(mealsRes.data)
        if (proteinsRes.data) setProteins(proteinsRes.data)
        return mealsRes.data ?? []
      }
      return []
    } catch (err) {
      console.error('ThisWeek load error:', err)
      return []
    } finally {
      setLoading(false)
    }
  }

  function getMealsForDay(dowKey, mealType) {
    return planMeals.filter(m => m.day_of_week === dowKey && m.meal_type === mealType)
  }

  // Map UI slot label to DB meal_type
  function slotToMealType(slot) {
    if (slot === 'Everything else') return 'other'
    return slot.toLowerCase()
  }

  function openSheet(dayName, slotName, dateStr = '', fromSage = false, existingMealId = null) {
    setSheetDay(dayName)
    setSheetSlot(slotName)
    setSheetDate(dateStr)
    setSheetSagePrimary(fromSage)
    setSheetMode(existingMealId ? 'filled' : 'add')
    setSheetMealId(existingMealId)
    setManualInput('')
    // Compute dowKey from dateStr
    if (dateStr) {
      const d = new Date(dateStr + 'T00:00:00')
      setSheetDow(DOW_KEYS[d.getDay()])
    }
    setSheetOpen(true)
    overlayRef.current = setTimeout(() => setOverlayVisible(true), 40)
  }

  function closeSheet() {
    clearTimeout(overlayRef.current)
    setOverlayVisible(false)
    setSheetOpen(false)
  }

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  // Ensure a plan exists for the current week, creating a draft if needed
  async function ensurePlan() {
    if (plan) return plan
    const hid = appUser.household_id
    const weekStart = getWeekStartTZ(tz, weekOffset)
    const { data: newPlan, error } = await supabase
      .from('meal_plans')
      .insert({
        household_id: hid, created_by: appUser.id,
        week_start_date: weekStart, week_end_date: toLocalDateStr(weekDates[6]),
        status: 'draft',
      })
      .select('id, status, week_start_date, week_end_date, published_at')
      .single()
    if (error) { console.error('[Roux] ensurePlan error:', error); return null }
    setPlan(newPlan)
    return newPlan
  }

  // "Let Sage suggest" — pick a random recipe not already planned this week
  async function sageSuggest() {
    try {
      const activePlan = await ensurePlan()
      if (!activePlan) return
      const { data: recipes } = await supabase
        .from('recipes')
        .select('id, name')
        .eq('household_id', appUser.household_id)
      if (!recipes || recipes.length === 0) { showToast('No recipes in your library yet'); closeSheet(); return }
      const plannedIds = new Set(planMeals.filter(m => m.recipe_id).map(m => m.recipe_id))
      const available = recipes.filter(r => !plannedIds.has(r.id))
      const pick = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : recipes[Math.floor(Math.random() * recipes.length)]
      const { error } = await supabase.from('planned_meals').insert({
        meal_plan_id: activePlan.id, household_id: appUser.household_id,
        day_of_week: sheetDow, meal_type: slotToMealType(sheetSlot),
        slot_type: 'recipe', recipe_id: pick.id, status: 'planned', sage_suggested: true,
      })
      if (error) throw error
      const savedMealType = slotToMealType(sheetSlot)
      const savedDow = sheetDow
      console.log('[Roux] sageSuggest success:', { name: pick.name, mealType: savedMealType, dow: savedDow })
      closeSheet()
      showToast(`Sage suggested ${pick.name}`)
      const freshMeals = await loadWeekData()
      maybeShowRepeatPrompt(pick.name, savedMealType, 'recipe', pick.id, null, savedDow)
    } catch (err) {
      console.error('[Roux] sageSuggest error:', err)
    }
  }

  // "Enter manually" — save typed meal name as a note
  async function saveManualMeal() {
    if (!manualInput.trim()) return
    try {
      const activePlan = await ensurePlan()
      if (!activePlan) return
      const { error } = await supabase.from('planned_meals').insert({
        meal_plan_id: activePlan.id, household_id: appUser.household_id,
        day_of_week: sheetDow, meal_type: slotToMealType(sheetSlot),
        slot_type: 'note', note: manualInput.trim(), status: 'planned',
      })
      if (error) throw error
      const savedName = manualInput.trim()
      const savedMealType = slotToMealType(sheetSlot)
      const savedDow = sheetDow
      console.log('[Roux] saveManualMeal success:', { name: savedName, mealType: savedMealType, dow: savedDow })
      closeSheet()
      showToast(`Added ${savedName}`)
      const freshMeals = await loadWeekData()
      maybeShowRepeatPrompt(savedName, savedMealType, 'note', null, savedName, savedDow)
    } catch (err) {
      console.error('[Roux] saveManualMeal error:', err)
    }
  }

  // "Mark as open evening"
  async function markOpenEvening() {
    try {
      const activePlan = await ensurePlan()
      if (!activePlan) return
      const { error } = await supabase.from('planned_meals').insert({
        meal_plan_id: activePlan.id, household_id: appUser.household_id,
        day_of_week: sheetDow, meal_type: slotToMealType(sheetSlot),
        slot_type: 'note', note: 'open_evening', status: 'planned',
      })
      if (error) throw error
      closeSheet()
      loadWeekData()
    } catch (err) {
      console.error('[Roux] markOpenEvening error:', err)
    }
  }

  // Remove a planned meal
  async function removeMeal() {
    if (!sheetMealId) { console.warn('[Roux] removeMeal: no sheetMealId'); return }
    const idToDelete = sheetMealId
    console.log('[Roux] removeMeal: deleting', idToDelete)

    // Immediately update UI — optimistic removal
    setPlanMeals(prev => prev.filter(m => m.id !== idToDelete))
    closeSheet()
    showToast('Meal removed')

    // Then delete from DB
    try {
      const { data, error } = await supabase
        .from('planned_meals')
        .delete()
        .eq('id', idToDelete)
        .select('id')
      console.log('[Roux] removeMeal DB result:', { deleted: data?.length ?? 0, error: error?.message })
      if (error) console.error('[Roux] removeMeal error:', error.message, error.code)
    } catch (err) {
      console.error('[Roux] removeMeal error:', err)
    }
  }

  // Offer to add the same item to other days this week
  function maybeShowRepeatPrompt(mealName, mealType, slotType, recipeId, note, savedDow) {
    // Show for all slot types — slots support multiple items
    const otherDays = DOW_KEYS.filter(dow => dow !== savedDow)
    if (otherDays.length === 0) return
    setTimeout(() => {
      setRepeatPrompt({ mealName, mealType, slotType, recipeId, note, savedDow })
      setRepeatSelected(new Set())
    }, 400)
  }

  async function confirmRepeat() {
    if (!repeatPrompt || repeatSelected.size === 0) return
    const activePlan = plan
    if (!activePlan) return
    const { mealType, slotType, recipeId, note } = repeatPrompt
    const daysToWrite = [...repeatSelected]

    const inserts = daysToWrite.map(dow => ({
        meal_plan_id: activePlan.id,
        household_id: appUser.household_id,
        day_of_week: dow,
        meal_type: mealType,
        slot_type: slotType,
        recipe_id: recipeId || null,
        note: note || null,
        status: 'planned',
      }))

    if (inserts.length > 0) {
      const { error } = await supabase.from('planned_meals').insert(inserts)
      if (error) console.error('[Roux] confirmRepeat error:', error)
    }

    setRepeatPrompt(null)
    loadWeekData()
  }

  // Swap — remove existing then open add sheet
  async function swapMeal() {
    if (!sheetMealId) return
    const idToDelete = sheetMealId
    setPlanMeals(prev => prev.filter(m => m.id !== idToDelete))
    setSheetMode('add')
    setSheetMealId(null)
    // Delete from DB in background
    supabase.from('planned_meals').delete().eq('id', idToDelete).select('id')
      .then(({ error }) => { if (error) console.error('[Roux] swapMeal delete error:', error.message) })
  }

  function editProtein(p) {
    setProteinName(p.protein_name)
    setProteinStoreId(p.store_id || null)
    setProteinOnSale(p.is_on_sale || false)
    setProteinPrice(p.sale_price ? String(p.sale_price) : '')
    setProteinUnit(p.unit || 'lb')
    setEditingProteinId(p.id)
    setSaveToUsuals(false)
    setProteinTab('new')
    setEditingFavorites(false)
    setAddingStore(false)
    setAddProteinOpen(true)
  }

  function openAddProtein() {
    setProteinName('')
    setProteinStoreId(groceryStores[0]?.id || null)
    setProteinOnSale(false)
    setProteinPrice('')
    setProteinUnit('lb')
    setEditingProteinId(null)
    setSaveToUsuals(true)
    setProteinTab('usuals')
    setEditingFavorites(false)
    setAddingStore(false)
    setAddProteinOpen(true)
  }

  function selectFavorite(fav) {
    setProteinName(fav.name)
    setProteinStoreId(null)
    setProteinPrice('')
    setProteinUnit('lb')
    setProteinOnSale(false)
    setSaveToUsuals(false)
    setProteinTab('confirm')
  }

  async function saveProtein() {
    if (!proteinName.trim() || savingProtein) return
    setSavingProtein(true)
    try {
      const payload = {
        protein_name: proteinName.trim(),
        store_id: proteinStoreId || null,
        is_on_sale: proteinOnSale,
        sale_price: proteinOnSale && proteinPrice ? parseFloat(proteinPrice) : null,
        unit: proteinPrice ? proteinUnit : null,
      }

      let data
      if (editingProteinId) {
        // UPDATE existing record
        const { data: updated, error } = await supabase.from('weekly_proteins')
          .update(payload)
          .eq('id', editingProteinId)
          .select('*, grocery_stores(name)')
          .single()
        if (error) throw error
        data = updated
        setProteins(prev => prev.map(p => p.id === editingProteinId ? data : p))
      } else {
        // INSERT new record
        const activePlan = await ensurePlan()
        if (!activePlan) return
        const { data: inserted, error } = await supabase.from('weekly_proteins')
          .insert({ ...payload, household_id: appUser.household_id, meal_plan_id: activePlan.id })
          .select('*, grocery_stores(name)')
          .single()
        if (error) throw error
        data = inserted
        setProteins(prev => [...prev, data])
      }

      // Also save to favorites if toggle is on (name only — no store/price)
      if (saveToUsuals && proteinTab === 'new') {
        const { data: favData } = await supabase.from('protein_favorites').insert({
          household_id: appUser.household_id,
          name: proteinName.trim(),
          sort_order: proteinFavorites.length + 1,
        }).select('id, name, sort_order').single()
        if (favData) setProteinFavorites(prev => [...prev, favData])
      }

      setAddProteinOpen(false)
      showToast('Protein added')
    } catch (err) {
      console.error('[Roux] saveProtein error:', err)
    } finally {
      setSavingProtein(false)
    }
  }

  async function deleteProtein(proteinId) {
    setProteins(prev => prev.filter(p => p.id !== proteinId))
    showToast('Protein removed')
    supabase.from('weekly_proteins').delete().eq('id', proteinId)
      .then(({ error }) => { if (error) console.error('[Roux] deleteProtein error:', error.message) })
  }

  async function deleteFavorite(favId) {
    setProteinFavorites(prev => prev.filter(f => f.id !== favId))
    supabase.from('protein_favorites').delete().eq('id', favId)
      .then(({ error }) => { if (error) console.error('[Roux] deleteFavorite error:', error.message) })
  }

  async function saveNewStore() {
    if (!newStoreName.trim()) return
    try {
      const { data, error } = await supabase.from('grocery_stores').insert({
        household_id: appUser.household_id,
        name: newStoreName.trim(),
      }).select('id, name').single()
      if (error) throw error
      setGroceryStores(prev => [...prev, data])
      setProteinStoreId(data.id)
      setNewStoreName('')
      setAddingStore(false)
    } catch (err) {
      console.error('[Roux] saveNewStore error:', err)
    }
  }

  async function publishPlan() {
    if (!plan || publishing) return
    setPublishing(true)
    try {
      const { error } = await supabase
        .from('meal_plans')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', plan.id)
      if (error) throw error

      // Step 1 (0ms): status dot + banner color shift
      setPlan(p => ({ ...p, status: 'published' }))

      // Step 2 (60ms): banner pulse
      setTimeout(() => {
        setBannerPulsing(true)
        setTimeout(() => setBannerPulsing(false), 200)
      }, 60)

      // Surface shopping list prompt after publish animation
      setTimeout(() => setShoppingPrompt(true), 400)

    } catch (err) {
      console.error('Publish error:', err)
    } finally {
      setPublishing(false)
    }
  }

  const isPublished = plan?.status === 'published' || plan?.status === 'active'

  return (
    <div style={{
      background:   C.cream,
      fontFamily:   "'Jost', sans-serif",
      fontWeight:   300,
      minHeight:    '100vh',
      maxWidth:     '430px',
      margin:       '0 auto',
      paddingBottom:'140px',
      position:     'relative',
      overflowX:    'hidden',
    }}>

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <TopBar />

      {/* ── Week Navigation ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 24px 10px',
        position: 'relative', zIndex: 1,
        animation: 'fadeUp 0.35s ease both',
      }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={weekNavBtnStyle} aria-label="Previous week">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.sage, marginBottom: '2px' }}>
            {weekOffset === 0 ? 'This Week' : weekOffset < 0 ? 'Past Week' : 'Next Week'}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: C.ink, fontWeight: 500 }}>
            {formatWeekRange(weekDates)}
          </div>
          {activeTemplateName && (
            <button
              onClick={() => navigate('/week-settings')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                marginTop: '4px', padding: '3px 9px', borderRadius: '12px',
                background: 'rgba(196,154,60,0.12)', border: '1px solid rgba(196,154,60,0.30)',
                color: C.honey, fontSize: '11px', fontWeight: 500,
                fontFamily: "'Jost', sans-serif", cursor: 'pointer',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              {activeTemplateName}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={() => setWeekOffset(w => w + 1)} style={weekNavBtnStyle} aria-label="Next week">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </button>
          <button onClick={() => navigate('/week-settings')} style={weekNavBtnStyle} aria-label="Week settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Plan Status Banner ───────────────────────────────────────────── */}
      <PlanStatusBanner
        plan={plan}
        loading={loading}
        isPublished={isPublished}
        pulsing={bannerPulsing}
        onPublish={publishPlan}
      />

      {/* ── Protein Roster ───────────────────────────────────────────────── */}
      <ProteinRoster
        proteins={proteins}
        open={proteinOpen}
        onToggle={() => setProteinOpen(v => !v)}
        onAdd={openAddProtein}
        onEdit={editProtein}
        onDelete={deleteProtein}
      />

      {/* ── Expand/Collapse All ──────────────────────────────────────────── */}
      {(() => {
        const allDowKeys = weekDates.map(d => DOW_KEYS[d.getDay()])
        const allExpanded = allDowKeys.every(k => expandedDays.has(k))
        const todayDow = weekOffset === 0 ? DOW_KEYS[getDayOfWeekTZ(tz)] : null
        return (
          <div style={{ padding: '0 24px 6px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                if (allExpanded) {
                  // Collapse all except today
                  setExpandedDays(todayDow ? new Set([todayDow]) : new Set())
                } else {
                  setExpandedDays(new Set(allDowKeys))
                }
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Jost', sans-serif", fontSize: '12px',
                fontWeight: 300, color: C.forest, padding: 0,
              }}
            >
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
        )
      })()}

      {/* ── Day Rows ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
        {weekDates.map((date, i) => {
          const dowKey    = DOW_KEYS[date.getDay()]
          const isToday   = toDateStr(date) === todayStr && weekOffset === 0
          const dinnerMeals    = getMealsForDay(dowKey, 'dinner')
          const breakfastMeals = getMealsForDay(dowKey, 'breakfast')
          const lunchMeals     = getMealsForDay(dowKey, 'lunch')
          const otherMeals     = getMealsForDay(dowKey, 'other')
          const allDayMeals    = planMeals.filter(m => m.day_of_week === dowKey)
          // Tradition from household_traditions (by day_of_week), overridden by actual planned meal tradition
          const htTrad    = traditions.find(t => t.day_of_week === dowKey)
          const tradition = dinnerMeals[0]?.household_traditions ?? htTrad ?? null
          const expanded  = expandedDays.has(dowKey)

          return (
            <DayRow
              key={dowKey}
              date={date}
              dowKey={dowKey}
              isToday={isToday}
              isPastWeek={isPastWeek}
              dinnerMeals={dinnerMeals}
              breakfastMeals={breakfastMeals}
              lunchMeals={lunchMeals}
              otherMeals={otherMeals}
              tradition={tradition}
              savedDayType={savedDayTypes?.[dowKey] ?? null}
              animDelay={`${0.06 + i * 0.05}s`}
              onOpenSheet={openSheet}
              expanded={expanded}
              mealCount={allDayMeals.length}
              onToggleExpand={() => setExpandedDays(prev => {
                const next = new Set(prev)
                if (next.has(dowKey)) next.delete(dowKey)
                else next.add(dowKey)
                return next
              })}
            />
          )
        })}
      </div>

      {/* ── Shopping List Prompt (post-publish handoff) ───────────────────── */}
      {shoppingPrompt && (
        <ShoppingPrompt
          onGo={()      => { setShoppingPrompt(false); navigate('/shopping') }}
          onDismiss={()  => setShoppingPrompt(false)}
        />
      )}

      {/* ── Bottom Nav ────────────────────────────────────────────────────── */}
      <BottomNav activeTab="week" />

      {/* ── Sheet overlay ─────────────────────────────────────────────────── */}
      <div
        onClick={closeSheet}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(44,36,23,0.45)',
          zIndex: 200,
          opacity: overlayVisible ? 1 : 0,
          pointerEvents: sheetOpen ? 'all' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* ── Bottom Sheet ─────────────────────────────────────────────────── */}
      <BottomSheet
        open={sheetOpen}
        dayName={sheetDay}
        slotName={sheetSlot}
        dateStr={sheetDate}
        sagePrimary={sheetSagePrimary}
        mode={sheetMode}
        manualInput={manualInput}
        onManualChange={setManualInput}
        onClose={closeSheet}
        onSageSuggest={sageSuggest}
        onManualSave={saveManualMeal}
        onOpenEvening={markOpenEvening}
        onRemove={removeMeal}
        onSwap={swapMeal}
        onSetMode={setSheetMode}
        navigate={navigate}
      />

      {/* ── Add Protein Sheet ──────────────────────────────────────────── */}
      {addProteinOpen && (
        <>
          <div onClick={() => setAddProteinOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200, animation: 'fadeIn 0.2s ease' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '0 0 40px', zIndex: 201, boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
            animation: 'sheetRise 0.32s cubic-bezier(0.32,0.72,0,1) both',
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
            <div style={{ padding: '16px 22px 0' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '12px' }}>
                {editingProteinId ? 'Edit Protein' : 'Add a Protein'}
              </div>

              {/* Tabs (hidden in edit mode) */}
              {proteinTab !== 'confirm' && !editingProteinId && (
                <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: `1px solid ${C.linen}` }}>
                  {[{ key: 'usuals', label: 'Your Usuals' }, { key: 'new', label: 'Something New' }].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => { setProteinTab(tab.key); setEditingFavorites(false) }}
                      style={{
                        flex: 1, padding: '10px', textAlign: 'center',
                        fontFamily: "'Jost', sans-serif", fontSize: '12px', fontWeight: 500,
                        letterSpacing: '0.5px', color: proteinTab === tab.key ? C.forest : C.driftwood,
                        background: 'none', border: 'none', cursor: 'pointer',
                        borderBottom: proteinTab === tab.key ? `2px solid ${C.forest}` : '2px solid transparent',
                        transition: 'all 0.15s',
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Your Usuals tab ────────────────────────────────── */}
              {proteinTab === 'usuals' && (
                <div>
                  {proteinFavorites.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                      <button onClick={() => setEditingFavorites(v => !v)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '11px', color: editingFavorites ? C.forest : C.driftwoodSm, fontWeight: 500,
                        fontFamily: "'Jost', sans-serif",
                      }}>
                        {editingFavorites ? 'Done' : 'Edit list'}
                      </button>
                    </div>
                  )}
                  {proteinFavorites.length === 0 ? (
                    <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood, padding: '20px 0', textAlign: 'center', lineHeight: 1.5 }}>
                      No usuals saved yet — add something new and save it to your list.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {proteinFavorites.map(fav => (
                        <div
                          key={fav.id}
                          onClick={editingFavorites ? undefined : () => selectFavorite(fav)}
                          style={{
                            padding: '10px 14px', borderRadius: '12px',
                            border: '1px solid rgba(200,185,160,0.55)',
                            background: C.cream, cursor: editingFavorites ? 'default' : 'pointer',
                            position: 'relative', minWidth: '80px', transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ fontSize: '13px', fontWeight: 500, color: C.ink }}>{fav.name}</div>
                          {editingFavorites && (
                            <button
                              onClick={e => { e.stopPropagation(); deleteFavorite(fav.id) }}
                              style={{
                                position: 'absolute', top: '-6px', right: '-6px',
                                width: '20px', height: '20px', borderRadius: '50%',
                                background: '#A03030', color: 'white', border: 'none',
                                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setAddProteinOpen(false)} style={{
                    width: '100%', background: 'none', border: 'none', color: C.driftwood,
                    fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300,
                    padding: '10px', cursor: 'pointer',
                  }}>
                    Cancel
                  </button>
                </div>
              )}

              {/* ── Quick confirm (after tapping a favorite) ───────── */}
              {proteinTab === 'confirm' && (
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: C.ink, fontWeight: 500, marginBottom: '14px' }}>{proteinName}</div>

                  {/* Store selector */}
                  <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '6px' }}>
                    Where are you getting it this week?
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {groceryStores.map(store => (
                      <button key={store.id} onClick={() => setProteinStoreId(store.id)} style={{
                        padding: '6px 14px', fontSize: '12px', fontFamily: "'Jost', sans-serif", fontWeight: proteinStoreId === store.id ? 500 : 400,
                        borderRadius: '14px', cursor: 'pointer', border: `1.5px solid ${proteinStoreId === store.id ? C.forest : C.linen}`,
                        background: proteinStoreId === store.id ? C.forest : 'transparent', color: proteinStoreId === store.id ? 'white' : C.ink, transition: 'all 0.15s',
                      }}>
                        {store.name}
                      </button>
                    ))}
                  </div>

                  {/* On sale toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span style={{ fontSize: '13px', color: C.ink }}>On sale this week</span>
                    <button onClick={() => setProteinOnSale(v => !v)} style={{
                      width: '44px', height: '24px', borderRadius: '12px',
                      border: proteinOnSale ? 'none' : `1.5px solid ${C.linen}`,
                      background: proteinOnSale ? C.honey : C.cream,
                      cursor: 'pointer', position: 'relative', transition: 'background 0.25s', padding: 0, flexShrink: 0,
                    }}>
                      <span style={{ position: 'absolute', top: '2px', left: proteinOnSale ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'left 0.25s' }} />
                    </button>
                  </div>
                  {proteinOnSale && (
                    <>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
                        <input type="number" value={proteinPrice} onChange={e => setProteinPrice(e.target.value)} placeholder="$0.00" step="0.01" style={{
                          flex: 1, padding: '12px 14px', border: `1px solid ${C.linen}`, borderRadius: '10px',
                          fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: C.ink, outline: 'none', background: C.cream, boxSizing: 'border-box',
                        }} />
                        {['lb', 'pkg', 'total'].map(u => (
                          <button key={u} onClick={() => setProteinUnit(u)} style={{
                            padding: '8px 10px', fontSize: '11px', fontFamily: "'Jost', sans-serif", fontWeight: proteinUnit === u ? 500 : 400,
                            borderRadius: '8px', cursor: 'pointer', border: `1px solid ${proteinUnit === u ? C.forest : C.linen}`,
                            background: proteinUnit === u ? C.forest : 'transparent', color: proteinUnit === u ? 'white' : C.driftwoodSm,
                            transition: 'all 0.15s',
                          }}>
                            {u === 'lb' ? '/ lb' : u === 'pkg' ? '/ pkg' : 'total'}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <button onClick={saveProtein} disabled={savingProtein} style={{
                    width: '100%', padding: '14px', borderRadius: '12px', background: C.forest, color: 'white',
                    border: 'none', fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500, cursor: 'pointer', marginBottom: '8px',
                  }}>
                    {savingProtein ? 'Adding…' : 'Add to this week'}
                  </button>
                  <button onClick={() => setProteinTab('usuals')} style={{
                    width: '100%', background: 'none', border: 'none', color: C.driftwood,
                    fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300, padding: '10px', cursor: 'pointer',
                  }}>
                    ← Back
                  </button>
                </div>
              )}

              {/* ── Something New tab ──────────────────────────────── */}
              {proteinTab === 'new' && (
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '6px' }}>Name</div>
                  <input type="text" value={proteinName} onChange={e => setProteinName(e.target.value)} placeholder="e.g. Chicken thighs, Ground beef" autoFocus style={{
                    width: '100%', padding: '12px 14px', border: `1px solid ${C.linen}`, borderRadius: '10px',
                    fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: C.ink, outline: 'none', background: C.cream, boxSizing: 'border-box', marginBottom: '14px',
                  }} />

                  <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '6px' }}>Store</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                    {groceryStores.map(store => (
                      <button key={store.id} onClick={() => setProteinStoreId(store.id)} style={{
                        padding: '6px 14px', fontSize: '12px', fontFamily: "'Jost', sans-serif", fontWeight: proteinStoreId === store.id ? 500 : 400,
                        borderRadius: '14px', cursor: 'pointer', border: `1.5px solid ${proteinStoreId === store.id ? C.forest : C.linen}`,
                        background: proteinStoreId === store.id ? C.forest : 'transparent', color: proteinStoreId === store.id ? 'white' : C.ink, transition: 'all 0.15s',
                      }}>
                        {store.name}
                      </button>
                    ))}
                    {addingStore ? (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input type="text" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} placeholder="Store name" autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') saveNewStore() }}
                          style={{ padding: '5px 10px', fontSize: '12px', width: '120px', border: `1.5px solid ${C.forest}`, borderRadius: '14px', fontFamily: "'Jost', sans-serif", color: C.ink, outline: 'none', background: C.cream }} />
                        <button onClick={saveNewStore} disabled={!newStoreName.trim()} style={{
                          padding: '5px 10px', fontSize: '11px', fontWeight: 500, borderRadius: '14px', cursor: newStoreName.trim() ? 'pointer' : 'default',
                          border: 'none', background: C.forest, color: 'white', fontFamily: "'Jost', sans-serif",
                        }}>Add</button>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingStore(true); setNewStoreName('') }} style={{
                        padding: '6px 14px', fontSize: '12px', fontFamily: "'Jost', sans-serif", fontWeight: 400,
                        borderRadius: '14px', cursor: 'pointer', border: `1.5px dashed rgba(200,185,160,0.6)`, background: 'transparent', color: C.driftwood,
                      }}>+ Add store</button>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span style={{ fontSize: '13px', color: C.ink }}>On sale this week</span>
                    <button onClick={() => setProteinOnSale(v => !v)} style={{
                      width: '44px', height: '24px', borderRadius: '12px', border: proteinOnSale ? 'none' : `1.5px solid ${C.linen}`,
                      background: proteinOnSale ? C.honey : C.cream, cursor: 'pointer', position: 'relative', transition: 'background 0.25s', padding: 0, flexShrink: 0,
                    }}>
                      <span style={{ position: 'absolute', top: '2px', left: proteinOnSale ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'left 0.25s' }} />
                    </button>
                  </div>
                  {proteinOnSale && (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '14px' }}>
                      <input type="number" value={proteinPrice} onChange={e => setProteinPrice(e.target.value)} placeholder="$0.00" step="0.01" style={{
                        flex: 1, padding: '12px 14px', border: `1px solid ${C.linen}`, borderRadius: '10px',
                        fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: C.ink, outline: 'none', background: C.cream, boxSizing: 'border-box',
                      }} />
                      {['lb', 'pkg', 'total'].map(u => (
                        <button key={u} onClick={() => setProteinUnit(u)} style={{
                          padding: '8px 10px', fontSize: '11px', fontFamily: "'Jost', sans-serif", fontWeight: proteinUnit === u ? 500 : 400,
                          borderRadius: '8px', cursor: 'pointer', border: `1px solid ${proteinUnit === u ? C.forest : C.linen}`,
                          background: proteinUnit === u ? C.forest : 'transparent', color: proteinUnit === u ? 'white' : C.driftwoodSm,
                          transition: 'all 0.15s',
                        }}>
                          {u === 'lb' ? '/ lb' : u === 'pkg' ? '/ pkg' : 'total'}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Save to usuals toggle (hidden in edit mode) */}
                  {!editingProteinId && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <span style={{ fontSize: '13px', color: C.ink }}>Save to your usuals</span>
                    <button onClick={() => setSaveToUsuals(v => !v)} style={{
                      width: '44px', height: '24px', borderRadius: '12px', border: saveToUsuals ? 'none' : `1.5px solid ${C.linen}`,
                      background: saveToUsuals ? C.forest : C.cream, cursor: 'pointer', position: 'relative', transition: 'background 0.25s', padding: 0, flexShrink: 0,
                    }}>
                      <span style={{ position: 'absolute', top: '2px', left: saveToUsuals ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'left 0.25s' }} />
                    </button>
                  </div>
                  )}

                  <button onClick={saveProtein} disabled={!proteinName.trim() || savingProtein} style={{
                    width: '100%', padding: '14px', borderRadius: '12px', background: proteinName.trim() ? C.forest : C.linen,
                    color: proteinName.trim() ? 'white' : C.driftwood, border: 'none', fontFamily: "'Jost', sans-serif",
                    fontSize: '14px', fontWeight: 500, cursor: proteinName.trim() ? 'pointer' : 'default', marginBottom: '8px',
                  }}>
                    {savingProtein ? (editingProteinId ? 'Saving…' : 'Adding…') : (editingProteinId ? 'Save Changes' : 'Add Protein')}
                  </button>
                  <button onClick={() => setAddProteinOpen(false)} style={{
                    width: '100%', background: 'none', border: 'none', color: C.driftwood,
                    fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300, padding: '10px', cursor: 'pointer',
                  }}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Repeat Prompt (breakfast/lunch) ──────────────────────────────── */}
      {repeatPrompt && (
        <>
          <div
            onClick={() => setRepeatPrompt(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)',
              zIndex: 200, animation: 'fadeIn 0.2s ease',
            }}
          />
          <RepeatPromptSheet
            prompt={repeatPrompt}
            planMeals={planMeals}
            weekDates={weekDates}
            selected={repeatSelected}
            onToggleDay={dow => setRepeatSelected(prev => {
              const next = new Set(prev)
              next.has(dow) ? next.delete(dow) : next.add(dow)
              return next
            })}
            onSelectAll={emptyDays => setRepeatSelected(new Set(emptyDays))}
            onConfirm={confirmRepeat}
            onSkip={() => setRepeatPrompt(null)}
          />
        </>
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
          background: C.forest, color: 'white', padding: '10px 20px',
          borderRadius: '10px', fontSize: '13px', fontWeight: 500,
          fontFamily: "'Jost', sans-serif", zIndex: 500,
          boxShadow: '0 4px 16px rgba(30,55,35,0.30)',
          animation: 'fadeUp 0.25s ease both',
        }}>
          {toastMsg}
        </div>
      )}

    </div>
  )
}

// ── Plan Status Banner ─────────────────────────────────────────────────────────
function PlanStatusBanner({ plan, loading, isPublished, pulsing, onPublish }) {
  if (loading || !plan) return null

  return (
    <div style={{
      margin: '0 24px 16px',
      background:   isPublished ? 'rgba(61,107,79,0.08)'    : 'rgba(196,154,60,0.08)',
      border:       isPublished ? '1px solid rgba(61,107,79,0.22)' : '1px solid rgba(196,154,60,0.25)',
      borderRadius: '10px', padding: '10px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      animation: `fadeUp 0.35s ease 0.04s both${pulsing ? ', publishPulse 0.20s ease forwards' : ''}`,
      position: 'relative', zIndex: 1,
      transition: 'background 0.2s ease, border-color 0.2s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Status dot */}
        <div style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: isPublished ? C.sage : C.honey,
          flexShrink: 0,
          transition: 'background 0.15s ease',
        }} />
        <div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: C.ink }}>
            {isPublished ? 'Published' : 'Draft'}
          </div>
          <div style={{ fontSize: '11px', color: C.driftwoodSm, fontWeight: 300 }}>
            {isPublished ? 'Family can see this plan' : 'Only you can see this plan'}
          </div>
        </div>
      </div>
      <button
        onClick={isPublished ? undefined : onPublish}
        style={{
          fontSize: '11px', color: C.forest, fontWeight: 500,
          background: 'none', border: 'none', cursor: isPublished ? 'default' : 'pointer',
          padding: '4px 8px', borderRadius: '6px', fontFamily: "'Jost', sans-serif",
          opacity: isPublished ? 0.5 : 1,
        }}
      >
        {isPublished ? 'Edit plan' : 'Ready to share →'}
      </button>
    </div>
  )
}

// ── Protein Roster ─────────────────────────────────────────────────────────────
function ProteinRoster({ proteins, open, onToggle, onAdd, onEdit, onDelete }) {
  const iconColor = open ? C.forest : C.driftwood

  return (
    <div style={{
      margin: '0 24px 16px',
      background: 'white', border: '1px solid rgba(200,185,160,0.55)',
      borderRadius: '12px', overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
      animation: 'fadeUp 0.35s ease 0.06s both',
      position: 'relative', zIndex: 1,
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '11px 14px', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0, transition: 'stroke 0.2s' }}>
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
          <span style={{ fontSize: '11px', fontWeight: 500, color: C.ink, letterSpacing: '0.3px' }}>
            This Week's Proteins
          </span>
          {proteins.length > 0 && (
            <span style={{ fontSize: '10px', color: C.driftwoodSm }}>
              {proteins.length} on hand
            </span>
          )}
        </div>
        <svg
          viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ width: 14, height: 14, transition: 'transform 0.25s', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>

      {/* Body */}
      <div style={{
        maxHeight: open ? '400px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.3s ease',
      }}>
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {proteins.length === 0 ? (
            <div style={{ fontSize: '12px', color: C.driftwoodSm, fontStyle: 'italic', padding: '4px 0' }}>
              No proteins added yet.
            </div>
          ) : proteins.map(p => (
            <div key={p.id} onClick={() => onEdit(p)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', background: C.cream, borderRadius: '8px',
              border: '1px solid rgba(200,185,160,0.4)', cursor: 'pointer',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '13px', color: C.ink }}>{p.protein_name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {p.grocery_stores?.name && (
                  <span style={{ fontSize: '11px', color: C.driftwoodSm }}>{p.grocery_stores.name}</span>
                )}
                {p.is_on_sale && (
                  <span style={{
                    fontSize: '9px', fontWeight: 500, color: C.honey,
                    background: 'rgba(196,154,60,0.10)', border: '1px solid rgba(196,154,60,0.25)',
                    padding: '2px 6px', borderRadius: '4px',
                  }}>
                    Sale
                  </span>
                )}
                {p.sale_price && parseFloat(p.sale_price) > 0 && (
                  <span style={{ fontSize: '11px', color: C.driftwoodSm, fontWeight: 400 }}>
                    ${parseFloat(p.sale_price).toFixed(2)}{p.unit === 'lb' ? ' / lb' : p.unit === 'pkg' ? ' / pkg' : p.unit === 'total' ? ' total' : ''}
                  </span>
                )}
                {/* Edit */}
                <button
                  onClick={e => { e.stopPropagation(); onEdit(p) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(140,123,107,0.55)', padding: '3px', display: 'flex',
                  }}
                  aria-label="Edit protein"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    <path d="m15 5 4 4"/>
                  </svg>
                </button>
                {/* Delete */}
                <button
                  onClick={e => { e.stopPropagation(); onDelete(p.id) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(140,123,107,0.55)', padding: '3px', display: 'flex',
                  }}
                  aria-label="Remove protein"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={e => { e.stopPropagation(); onAdd() }}
            style={{
              fontSize: '11px', color: C.driftwoodSm, background: 'none',
              border: '1px dashed rgba(200,185,160,0.7)', borderRadius: '8px',
              padding: '8px 10px', cursor: 'pointer', textAlign: 'center', fontFamily: "'Jost', sans-serif",
            }}
          >
            + Add protein
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Day Row ────────────────────────────────────────────────────────────────────
function DayRow({ date, dowKey, isToday, isPastWeek, dinnerMeals, breakfastMeals, lunchMeals, otherMeals, tradition, savedDayType, animDelay, onOpenSheet, expanded, mealCount, onToggleExpand }) {
  const dayType  = getDayType(date.getDay(), savedDayType)
  const dayName  = isToday ? 'Today' : dowKey.charAt(0).toUpperCase() + dowKey.slice(1)
  const dateStr  = toDateStr(date)

  // Reusable multi-item slot renderer
  function renderSlot(label, sheetSlotName, meals, isDominant) {
    const isOpenEv = isDominant && meals.length === 1 && meals[0]?.note === 'open_evening'
    return (
      <div>
        <div style={{
          fontSize: '9px', fontWeight: 500, letterSpacing: '1.8px', textTransform: 'uppercase',
          color: C.driftwoodSm, marginBottom: isDominant ? '6px' : '4px',
        }}>
          {label}
        </div>
        {isOpenEv ? (
          <OpenDaySlot onAdd={() => onOpenSheet(dayName, sheetSlotName, dateStr)} />
        ) : meals.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {meals.map(m => (
              <FilledMealCard key={m.id} meal={m} onSwap={() => onOpenSheet(dayName, sheetSlotName, dateStr, false, m.id)} />
            ))}
            <button
              onClick={() => onOpenSheet(dayName, sheetSlotName, dateStr)}
              style={{
                background: 'none', border: `1px dashed ${C.linen}`, borderRadius: '8px',
                padding: isDominant ? '8px' : '6px', cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                fontSize: '12px', color: C.driftwood, fontWeight: 300, width: '100%',
              }}
            >
              + Add another
            </button>
          </div>
        ) : isDominant ? (
          <EmptyDinnerSlot
            onTap={() => onOpenSheet(dayName, sheetSlotName, dateStr)}
            onSage={() => onOpenSheet(dayName, sheetSlotName, dateStr, true)}
          />
        ) : (
          <button
            onClick={() => onOpenSheet(dayName, sheetSlotName, dateStr)}
            style={{
              background: 'none', border: `1px dashed ${C.linen}`, borderRadius: '8px',
              padding: '6px', cursor: 'pointer', fontFamily: "'Jost', sans-serif",
              fontSize: '12px', color: C.driftwood, fontWeight: 300, width: '100%',
            }}
          >
            + Add
          </button>
        )}
      </div>
    )
  }

  // Collapsed row
  if (!expanded) {
    return (
      <button
        onClick={onToggleExpand}
        style={{
          background: 'white',
          border: isToday ? `1px solid ${C.forest}` : '1px solid rgba(200,185,160,0.55)',
          borderRadius: '12px', overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(80,60,30,0.04)',
          animation: `fadeUp 0.35s ease ${animDelay} both`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', cursor: 'pointer', width: '100%',
          fontFamily: "'Jost', sans-serif", textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '15px', fontWeight: 500, color: C.ink, lineHeight: 1, minWidth: '22px',
          }}>
            {date.getDate()}
          </div>
          <div style={{
            fontSize: '11px', fontWeight: 400, color: C.driftwoodSm,
            letterSpacing: '0.3px',
          }}>
            {dayName}
          </div>
          <div style={{
            fontSize: '9px', fontWeight: 500, letterSpacing: '0.6px', textTransform: 'uppercase',
            padding: '2px 6px', borderRadius: '4px',
            background: dayType.bg, color: dayType.color,
          }}>
            {dayType.label}
          </div>
          {tradition && (
            <div style={{
              fontSize: '9px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px',
              background: 'rgba(196,154,60,0.12)', color: C.honey,
            }}>
              {tradition.name}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {mealCount > 0 && (
            <span style={{ fontSize: '12px', color: C.driftwood, fontWeight: 300 }}>
              {mealCount} item{mealCount !== 1 ? 's' : ''} planned
            </span>
          )}
          <svg viewBox="0 0 24 24" fill="none" stroke={C.linen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>
    )
  }

  // Expanded card
  return (
    <div style={{
      background: 'white',
      border: isToday ? `1px solid ${C.forest}` : '1px solid rgba(200,185,160,0.55)',
      borderRadius: '16px', overflow: 'hidden',
      boxShadow: isToday
        ? '0 2px 4px rgba(30,65,42,0.22), 0 6px 16px rgba(30,65,42,0.16), 0 14px 28px rgba(30,65,42,0.10)'
        : '0 1px 4px rgba(80,60,30,0.06), 0 3px 10px rgba(80,60,30,0.04)',
      animation: `fadeUp 0.35s ease ${animDelay} both`,
    }}>

      {/* Header — tappable to collapse */}
      <div
        onClick={onToggleExpand}
        style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '11px 14px 10px',
          borderBottom: isToday ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(200,185,160,0.35)',
          background: isToday ? C.forest : 'transparent',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{
            fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase',
            color: isToday ? 'rgba(255,255,255,0.65)' : C.driftwoodSm,
          }}>
            {dayName}
          </div>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '17px', fontWeight: 500, color: isToday ? 'white' : C.ink, lineHeight: 1,
          }}>
            {date.getDate()}
          </div>
          {tradition && (
            <div style={{
              fontSize: '9px', fontWeight: 500, padding: '3px 7px', borderRadius: '4px',
              background: isToday ? 'rgba(255,255,255,0.15)' : 'rgba(196,154,60,0.12)',
              color: isToday ? 'rgba(255,255,255,0.85)' : C.honey,
              display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start',
            }}>
              {tradition.name}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            fontSize: '9px', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase',
            padding: '3px 7px', borderRadius: '4px',
            display: 'flex', alignItems: 'center', gap: '4px',
            ...(isToday
              ? { background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }
              : { background: dayType.bg, color: dayType.color }),
          }}>
            {dayType.emoji} {dayType.label}
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke={isToday ? 'rgba(255,255,255,0.5)' : C.linen} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </div>
      </div>

      {/* Body — all four slots */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {renderSlot('Dinner', 'Dinner', dinnerMeals, true)}

        <div style={{ display: 'flex', gap: '7px' }}>
          <div style={{ flex: 1 }}>
            {renderSlot('Breakfast', 'Breakfast', breakfastMeals, false)}
          </div>
          <div style={{ flex: 1 }}>
            {renderSlot('Lunch', 'Lunch', lunchMeals, false)}
          </div>
        </div>

        {renderSlot('Everything else', 'Everything else', otherMeals, false)}
      </div>
    </div>
  )
}

// ── Filled Meal Card ───────────────────────────────────────────────────────────
function FilledMealCard({ meal, onSwap }) {
  const name    = getMealName(meal)
  const hasNote = meal.note && meal.note !== 'open_evening' && meal.slot_type !== 'note'

  return (
    <div style={{
      background: C.cream, border: '1px solid rgba(200,185,160,0.5)',
      borderRadius: '10px', padding: '11px 12px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      cursor: 'pointer', gap: '8px',
      animation: 'mealEntrance 0.22s ease both',
    }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '15px', color: C.ink, fontWeight: 500,
          lineHeight: 1.25,
        }}>
          {name ?? 'Meal'}
        </div>
        {hasNote && (
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: C.honey, flexShrink: 0,
          }} />
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onSwap() }}
        style={{
          width: '34px', height: '34px', borderRadius: '50%',
          border: '1px solid rgba(200,185,160,0.6)', background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: C.driftwood, flexShrink: 0,
        }}
        aria-label="Swap meal"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
          <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/>
          <path d="M12 8v4l3 3"/>
        </svg>
      </button>
    </div>
  )
}

// ── Empty Dinner Slot ──────────────────────────────────────────────────────────
function EmptyDinnerSlot({ onTap, onSage }) {
  return (
    <div
      onClick={onTap}
      style={{
        border: '1.5px dashed rgba(200,185,160,0.65)',
        borderRadius: '10px', padding: '16px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', background: 'rgba(250,247,242,0.5)', gap: '10px',
      }}
    >
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: '15px', fontStyle: 'italic',
        color: 'rgba(140,123,107,0.65)', lineHeight: 1.3,
      }}>
        What's for dinner?
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Ask Sage button */}
        <button
          onClick={e => { e.stopPropagation(); onSage() }}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '10px', color: C.sage, fontWeight: 500,
            background: 'rgba(122,140,110,0.08)', border: '1px solid rgba(122,140,110,0.18)',
            borderRadius: '6px', padding: '5px 9px',
            cursor: 'pointer', fontFamily: "'Jost', sans-serif",
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
          Ask Sage
        </button>
        {/* + circle */}
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          background: C.forest, color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', fontWeight: 300, flexShrink: 0,
          boxShadow: '0 2px 6px rgba(61,107,79,0.22)',
        }}>
          +
        </div>
      </div>
    </div>
  )
}

// ── Open Day Slot ──────────────────────────────────────────────────────────────
function OpenDaySlot({ onAdd }) {
  return (
    <div style={{
      background: 'rgba(122,140,110,0.06)', border: '1px solid rgba(122,140,110,0.18)',
      borderRadius: '10px', padding: '11px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ fontSize: '13px', color: C.sage, fontWeight: 400, display: 'flex', alignItems: 'center', gap: '6px' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <path d="m9 11 3 3L22 4"/>
        </svg>
        Open evening — no plan needed
      </div>
      <button
        onClick={onAdd}
        style={{
          fontSize: '11px', color: C.driftwoodSm, background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: "'Jost', sans-serif",
        }}
      >
        Add meal
      </button>
    </div>
  )
}

// ── Light Slot (Breakfast / Lunch) ─────────────────────────────────────────────
function LightSlot({ label, meal, onTap }) {
  const name   = meal ? getMealName(meal) : null
  const filled = !!name

  return (
    <div
      onClick={onTap}
      style={{
        flex: 1, borderRadius: '8px', padding: '8px 10px',
        border: filled ? '1px solid rgba(200,185,160,0.5)' : '1px dashed rgba(200,185,160,0.55)',
        background: filled ? C.cream : 'rgba(250,247,242,0.4)',
        cursor: 'pointer', minWidth: 0,
      }}
    >
      <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '4px' }}>
        {label}
      </div>
      {filled ? (
        <div style={{ fontSize: '12px', color: C.ink, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: 'rgba(140,123,107,0.45)', fontStyle: 'italic' }}>
          + add
        </div>
      )}
    </div>
  )
}

// ── Shopping List Prompt (post-publish handoff) ────────────────────────────────
function ShoppingPrompt({ onGo, onDismiss }) {
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onDismiss}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(44,36,23,0.45)',
          zIndex: 300,
          animation: 'fadeIn 0.25s ease forwards',
          opacity: 0,
        }}
      />
      {/* Card */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        width: '100%', maxWidth: '430px',
        background: 'white', borderRadius: '20px 20px 0 0',
        padding: '0 0 40px',
        zIndex: 301,
        boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
        animation: 'sheetRise 0.32s cubic-bezier(0.32,0.72,0,1) both',
      }}>
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
        <div style={{ padding: '20px 24px 0' }}>
          {/* Forest icon */}
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: 'rgba(61,107,79,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '14px',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" x2="21" y1="6" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500, color: C.ink, marginBottom: '6px' }}>
            Build your shopping list?
          </div>
          <div style={{ fontSize: '13.5px', color: C.driftwood, fontWeight: 300, lineHeight: 1.6, marginBottom: '24px' }}>
            Sage will pull everything you need from this week's plan into one organized list.
          </div>
          <button
            onClick={onGo}
            style={{
              width: '100%', background: C.forest, color: 'white', border: 'none',
              borderRadius: '12px', padding: '15px',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
              letterSpacing: '0.3px', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(30,55,35,0.25)', marginBottom: '10px',
            }}
          >
            Build shopping list
          </button>
          <button
            onClick={onDismiss}
            style={{
              width: '100%', background: 'none', border: 'none',
              fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300,
              color: C.driftwood, cursor: 'pointer', padding: '8px',
            }}
          >
            Not yet
          </button>
        </div>
      </div>
    </>
  )
}

// ── Bottom Sheet ───────────────────────────────────────────────────────────────
function BottomSheet({ open, dayName, slotName, dateStr, sagePrimary, mode, manualInput, onManualChange, onClose, onSageSuggest, onManualSave, onOpenEvening, onRemove, onSwap, onSetMode, navigate }) {
  const sheetTitle = mode === 'filled' ? slotName : mode === 'manual' ? 'Enter meal name' : slotName

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed', bottom: 0, left: '50%',
      transform: open ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
      width: '100%', maxWidth: '430px',
      background: 'white', borderRadius: '20px 20px 0 0',
      padding: '0 0 40px',
      zIndex: 201,
      transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
      boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
    }}>
      {/* Handle */}
      <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />

      {/* Title row */}
      <div style={{
        padding: '16px 22px 14px',
        borderBottom: `1px solid ${C.linen}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '2px' }}>
            {dayName}
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: C.ink, fontWeight: 500 }}>
            {sheetTitle}
          </div>
        </div>
        <button onClick={onClose} style={{
          width: '32px', height: '32px', borderRadius: '50%',
          border: '1px solid rgba(200,185,160,0.6)', background: C.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: C.driftwood, flexShrink: 0,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* ── Mode: filled slot (swap / remove / keep) ────────────────────── */}
      {mode === 'filled' && (
        <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SheetOption
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0"/><path d="M12 8v4l3 3"/></svg>}
            title="Swap meal"
            sub="Replace with a different recipe or meal"
            onClick={onSwap}
          />
          <SheetOption
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>}
            title="Remove meal"
            sub="Clear this slot — you can always add it back"
            onClick={onRemove}
          />
          <SheetOption
            icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>}
            title="Keep it"
            sub="No change needed"
            onClick={onClose}
          />
        </div>
      )}

      {/* ── Mode: manual text input ─────────────────────────────────────── */}
      {mode === 'manual' && (
        <div style={{ padding: '14px 22px' }}>
          <input
            type="text"
            value={manualInput}
            onChange={e => onManualChange(e.target.value)}
            placeholder="e.g. Tacos, Leftover soup, Eating out"
            autoFocus
            style={{
              width: '100%', padding: '14px 16px',
              border: `1px solid ${C.linen}`, borderRadius: '12px',
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300,
              color: C.ink, outline: 'none', background: C.cream,
              marginBottom: '14px',
            }}
            onKeyDown={e => { if (e.key === 'Enter') onManualSave() }}
          />
          <button
            onClick={onManualSave}
            disabled={!manualInput.trim()}
            style={{
              width: '100%', background: manualInput.trim() ? C.forest : C.linen,
              color: manualInput.trim() ? 'white' : C.driftwood,
              border: 'none', borderRadius: '12px', padding: '14px',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
              cursor: manualInput.trim() ? 'pointer' : 'default',
              transition: 'background 0.15s',
            }}
          >
            Add to plan
          </button>
          <button
            onClick={() => onSetMode('add')}
            style={{
              width: '100%', background: 'none', border: 'none', color: C.driftwood,
              fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300,
              padding: '10px', cursor: 'pointer', marginTop: '4px',
            }}
          >
            ← Back to options
          </button>
        </div>
      )}

      {/* ── Mode: add (empty slot — Sage / Browse / Manual / Open) ───── */}
      {mode === 'add' && (
        <>
          <div style={{ padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <SheetOption
              primary={sagePrimary}
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>}
              title="Let Sage suggest"
              sub="Based on your proteins, day type & preferences"
              onClick={onSageSuggest}
            />
            <SheetOption
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>}
              title="Browse the library"
              sub="Search or filter your recipe collection"
              onClick={() => {
                onClose()
                navigate('/meals/recipes', { state: { selectMode: true, targetDay: dateStr, targetSlot: slotName === 'Everything else' ? 'other' : slotName.toLowerCase() } })
              }}
            />
            <SheetOption
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="M12 5v14M5 12h14"/></svg>}
              title="Enter manually"
              sub="Type a meal name without a full recipe"
              onClick={() => onSetMode('manual')}
            />
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 22px' }}>
            <div style={{ flex: 1, height: '1px', background: C.linen }} />
            <span style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwoodSm }}>or</span>
            <div style={{ flex: 1, height: '1px', background: C.linen }} />
          </div>

          {/* Open evening */}
          <div onClick={onOpenEvening} style={{
            margin: '10px 22px 0', padding: '13px 16px',
            border: '1px dashed rgba(200,185,160,0.7)',
            borderRadius: '12px', cursor: 'pointer', textAlign: 'center',
          }}>
            <div style={{ fontSize: '13px', color: C.driftwood }}>
              Mark this evening as open — no meal needed
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function SheetOption({ primary, icon, title, sub, onClick }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onClick?.() }}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '14px 16px', borderRadius: '12px',
        border: primary ? `1px solid ${C.forest}` : '1px solid rgba(200,185,160,0.55)',
        background: primary ? C.forest : C.cream,
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: '38px', height: '38px', borderRadius: '10px',
        background: primary ? 'rgba(255,255,255,0.15)' : 'rgba(200,185,160,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        color: primary ? 'white' : C.forest,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: primary ? 'white' : C.ink, marginBottom: '2px' }}>
          {title}
        </div>
        <div style={{ fontSize: '12px', color: primary ? 'rgba(255,255,255,0.7)' : C.driftwoodSm, fontWeight: 300 }}>
          {sub}
        </div>
      </div>
    </div>
  )
}

// ── Repeat Prompt Sheet (breakfast/lunch) ─────────────────────────────────────
function RepeatPromptSheet({ prompt, planMeals, weekDates, selected, onToggleDay, onSelectAll, onConfirm, onSkip }) {
  const { mealName, mealType, savedDow } = prompt
  const slotLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1)
  const DAY_LABELS_MAP = { sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' }

  // Derive day order from weekDates (respects user's week start — Mon-Sun or Sun-Sat)
  const orderedDows = weekDates.map(d => DOW_KEYS[d.getDay()])
  const availableDays = orderedDows.filter(dow => dow !== savedDow)

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '430px',
      background: 'white', borderRadius: '20px 20px 0 0',
      padding: '0 0 40px', zIndex: 201,
      boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
      animation: 'sheetRise 0.32s cubic-bezier(0.32,0.72,0,1) both',
    }}>
      <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
      <div style={{ padding: '20px 22px 0' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '4px' }}>
          Add to other days this week?
        </div>
        <div style={{ fontSize: '13px', color: C.driftwood, marginBottom: '16px' }}>
          {mealName} · {slotLabel}
        </div>

        {/* Select all link */}
        <button
          onClick={() => onSelectAll(availableDays)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '12px', color: C.forest, fontWeight: 500,
            fontFamily: "'Jost', sans-serif", padding: '0 0 8px',
          }}
        >
          Select all days
        </button>

        {/* Day chips */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
          {availableDays.map(dow => {
            const isSelected = selected.has(dow)
            return (
              <button
                key={dow}
                onClick={() => onToggleDay(dow)}
                style={{
                  width: '42px', height: '42px', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '11px', fontWeight: 500,
                  border: isSelected ? `1.5px solid ${C.forest}` : '1.5px solid rgba(200,185,160,0.55)',
                  background: isSelected ? C.forest : 'white',
                  color: isSelected ? 'white' : C.ink,
                  transition: 'all 0.15s',
                }}
              >
                {DAY_LABELS_MAP[dow]}
              </button>
            )
          })}
        </div>

        {/* Buttons */}
        <button
          onClick={onConfirm}
          disabled={selected.size === 0}
          style={{
            width: '100%', padding: '14px', borderRadius: '12px',
            background: selected.size > 0 ? C.forest : C.linen,
            color: selected.size > 0 ? 'white' : C.driftwood,
            border: 'none', fontFamily: "'Jost', sans-serif",
            fontSize: '14px', fontWeight: 500, cursor: selected.size > 0 ? 'pointer' : 'default',
            marginBottom: '8px',
          }}
        >
          Add to {selected.size > 0 ? `${selected.size} day${selected.size > 1 ? 's' : ''}` : 'selected days'}
        </button>
        <button
          onClick={onSkip}
          style={{
            width: '100%', background: 'none', border: 'none',
            color: C.driftwood, fontFamily: "'Jost', sans-serif",
            fontSize: '13px', fontWeight: 300, padding: '10px', cursor: 'pointer',
          }}
        >
          Skip
        </button>
      </div>
    </div>
  )
}

