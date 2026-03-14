/**
 * ThisWeek.jsx — Weekly meal planner.
 * Matches prototypes/roux-thisweek-style1-objects.html exactly.
 * Standalone full-page component (own topbar + bottom nav, like Dashboard).
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getWeekDatesTZ, getWeekStartTZ, getDayOfWeekTZ, getTodayStr, toLocalDateStr } from '../lib/dateUtils'

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  forest:    '#3D6B4F',
  forestDk:  '#2E5038',
  sage:      '#7A8C6E',
  honey:     '#C49A3C',
  cream:     '#FAF7F2',
  ink:       '#2C2417',
  driftwood: '#8C7B6B',
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
  const [publishBarVisible, setPublishBarVisible] = useState(true)
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

  const overlayRef = useRef(null)
  const tz         = appUser?.timezone ?? 'America/Chicago'
  const weekDates  = getWeekDatesTZ(tz, weekOffset)
  const today      = new Date()
  const todayStr   = getTodayStr(tz)    // YYYY-MM-DD in user's timezone
  const isPastWeek = weekOffset < 0

  useEffect(() => {
    if (appUser?.household_id) loadWeekData()
  }, [appUser?.household_id, weekOffset, location.key])

  async function loadWeekData() {
    setLoading(true)
    setPlan(null)
    setPlanMeals([])
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

      // Parse saved day types from meal_plans.notes (set by Week Settings)
      if (activePlan?.notes) {
        try {
          const config = JSON.parse(activePlan.notes)
          if (config.day_types) setSavedDayTypes(config.day_types)
          else setSavedDayTypes(null)
        } catch { setSavedDayTypes(null) }
      } else {
        setSavedDayTypes(null)
      }

      const isPublished = activePlan?.status === 'published' || activePlan?.status === 'active'
      setPublishBarVisible(!isPublished && activePlan?.status === 'draft')

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
      }
    } catch (err) {
      console.error('ThisWeek load error:', err)
    } finally {
      setLoading(false)
    }
  }

  function getMealsForDay(dowKey, mealType) {
    return planMeals.filter(m => m.day_of_week === dowKey && m.meal_type === mealType)
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
        day_of_week: sheetDow, meal_type: sheetSlot.toLowerCase(),
        slot_type: 'recipe', recipe_id: pick.id, status: 'planned', sage_suggested: true,
      })
      if (error) throw error
      closeSheet()
      showToast(`Sage suggested ${pick.name}`)
      loadWeekData()
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
        day_of_week: sheetDow, meal_type: sheetSlot.toLowerCase(),
        slot_type: 'note', note: manualInput.trim(), status: 'planned',
      })
      if (error) throw error
      closeSheet()
      showToast(`Added ${manualInput.trim()}`)
      loadWeekData()
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
        day_of_week: sheetDow, meal_type: sheetSlot.toLowerCase(),
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
    if (!sheetMealId) return
    try {
      await supabase.from('planned_meals').delete().eq('id', sheetMealId)
      closeSheet()
      showToast('Meal removed')
      loadWeekData()
    } catch (err) {
      console.error('[Roux] removeMeal error:', err)
    }
  }

  // Swap — remove existing then open add sheet
  async function swapMeal() {
    if (!sheetMealId) return
    await supabase.from('planned_meals').delete().eq('id', sheetMealId)
    setSheetMode('add')
    setSheetMealId(null)
    loadWeekData()
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

      // Step 3 (120ms): publish bar slides down
      setTimeout(() => setPublishBarVisible(false), 120)

      // Surface shopping list prompt after bar finishes exiting
      setTimeout(() => setShoppingPrompt(true), 520)

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
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: '68px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        background: C.forest,
        boxShadow: `
          0 2px  0px rgba(20,40,25,0.55),
          0 4px  8px rgba(20,40,25,0.40),
          0 8px 24px rgba(30,55,35,0.28),
          0 16px 40px rgba(30,55,35,0.14),
          0 1px  0px rgba(255,255,255,0.06) inset
        `,
        flexShrink: 0,
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '26px', fontWeight: 600,
          color: 'rgba(250,247,242,0.95)', userSelect: 'none',
        }}>
          Ro<em style={{ fontStyle: 'italic', color: 'rgba(188,218,178,0.82)' }}>ux</em>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button style={iconBtnStyle} aria-label="History">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M12 7v5l4 2"/>
            </svg>
          </button>
          <button style={iconBtnStyle} aria-label="Templates">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
              <rect width="7" height="7" x="3" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="3" rx="1"/>
              <rect width="7" height="7" x="3" y="14" rx="1"/>
              <rect width="7" height="7" x="14" y="14" rx="1"/>
            </svg>
          </button>
        </div>
      </header>

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
      />

      {/* ── Day Rows ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
        {weekDates.map((date, i) => {
          const dowKey    = DOW_KEYS[date.getDay()]
          const isToday   = toDateStr(date) === todayStr && weekOffset === 0
          const dinner    = getMealsForDay(dowKey, 'dinner')[0]   ?? null
          const breakfast = getMealsForDay(dowKey, 'breakfast')[0] ?? null
          const lunch     = getMealsForDay(dowKey, 'lunch')[0]    ?? null
          // Tradition from household_traditions (by day_of_week), overridden by actual planned meal tradition
          const htTrad    = traditions.find(t => t.day_of_week === dowKey)
          const tradition = dinner?.household_traditions ?? htTrad ?? null

          return (
            <DayRow
              key={dowKey}
              date={date}
              dowKey={dowKey}
              isToday={isToday}
              isPastWeek={isPastWeek}
              dinner={dinner}
              breakfast={breakfast}
              lunch={lunch}
              tradition={tradition}
              savedDayType={savedDayTypes?.[dowKey] ?? null}
              animDelay={`${0.06 + i * 0.05}s`}
              onOpenSheet={openSheet}
            />
          )
        })}
      </div>

      {/* ── Publish Bar ──────────────────────────────────────────────────── */}
      <PublishBar
        visible={publishBarVisible && !isPublished}
        publishing={publishing}
        onPublish={publishPlan}
      />

      {/* ── Shopping List Prompt (post-publish handoff) ───────────────────── */}
      {shoppingPrompt && (
        <ShoppingPrompt
          onGo={()      => { setShoppingPrompt(false); navigate('/shopping') }}
          onDismiss={()  => setShoppingPrompt(false)}
        />
      )}

      {/* ── Bottom Nav ────────────────────────────────────────────────────── */}
      <BottomNav navigate={navigate} />

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
          <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300 }}>
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
function ProteinRoster({ proteins, open, onToggle }) {
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
            <span style={{ fontSize: '10px', color: C.driftwood }}>
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
        maxHeight: open ? '220px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.3s ease',
      }}>
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {proteins.length === 0 ? (
            <div style={{ fontSize: '12px', color: C.driftwood, fontStyle: 'italic', padding: '4px 0' }}>
              No proteins added yet.
            </div>
          ) : proteins.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', background: C.cream, borderRadius: '8px',
              border: '1px solid rgba(200,185,160,0.4)',
            }}>
              <span style={{ fontSize: '13px', color: C.ink }}>{p.protein_name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {p.grocery_stores?.name && (
                  <span style={{ fontSize: '11px', color: C.driftwood }}>{p.grocery_stores.name}</span>
                )}
                {p.is_on_sale && (
                  <span style={{
                    fontSize: '10px', fontWeight: 500, color: C.forest,
                    background: 'rgba(61,107,79,0.08)', border: '1px solid rgba(61,107,79,0.15)',
                    padding: '2px 7px', borderRadius: '4px',
                  }}>
                    On sale
                  </span>
                )}
              </div>
            </div>
          ))}
          <button style={{
            fontSize: '11px', color: C.driftwood, background: 'none',
            border: '1px dashed rgba(200,185,160,0.7)', borderRadius: '8px',
            padding: '8px 10px', cursor: 'pointer', textAlign: 'center', fontFamily: "'Jost', sans-serif",
          }}>
            + Add protein
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Day Row ────────────────────────────────────────────────────────────────────
function DayRow({ date, dowKey, isToday, isPastWeek, dinner, breakfast, lunch, tradition, savedDayType, animDelay, onOpenSheet }) {
  const dayType  = getDayType(date.getDay(), savedDayType)
  const dayName  = isToday ? 'Today' : dowKey.charAt(0).toUpperCase() + dowKey.slice(1)
  const isOpenEv = dinner?.note === 'open_evening'
  const hasDinner= dinner && !isOpenEv

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

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '11px 14px 10px',
        borderBottom: isToday ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(200,185,160,0.35)',
        background: isToday ? C.forest : 'transparent',
      }}>
        {/* Left: day name + date + tradition */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{
            fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase',
            color: isToday ? 'rgba(255,255,255,0.65)' : C.driftwood,
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
              background: isToday ? 'rgba(255,255,255,0.15)' : 'rgba(139,111,82,0.10)',
              color: isToday ? 'rgba(255,255,255,0.85)' : C.walnut,
              display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start',
            }}>
              {tradition.name}
            </div>
          )}
        </div>

        {/* Right: day type badge */}
        <div>
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
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Dinner label */}
        <div style={{
          fontSize: '9px', fontWeight: 500, letterSpacing: '1.8px', textTransform: 'uppercase',
          color: isToday ? 'rgba(255,255,255,0.5)' : C.driftwood,
        }}>
          Dinner
        </div>

        {/* Dinner slot */}
        {isOpenEv ? (
          <OpenDaySlot onAdd={() => onOpenSheet(dayName, 'Dinner', toDateStr(date))} />
        ) : hasDinner ? (
          <FilledMealCard meal={dinner} onSwap={() => onOpenSheet(dayName, 'Dinner', toDateStr(date), false, dinner.id)} />
        ) : (
          <EmptyDinnerSlot
            onTap={()      => onOpenSheet(dayName, 'Dinner', toDateStr(date))}
            onSage={()     => onOpenSheet(dayName, 'Dinner', toDateStr(date), true)}
          />
        )}

        {/* Light slots: Breakfast + Lunch */}
        <div style={{ display: 'flex', gap: '7px' }}>
          <LightSlot
            label="Breakfast"
            meal={breakfast}
            onTap={() => onOpenSheet(dayName, 'Breakfast', toDateStr(date))}
          />
          <LightSlot
            label="Lunch"
            meal={lunch}
            onTap={() => onOpenSheet(dayName, 'Lunch', toDateStr(date))}
          />
        </div>
      </div>
    </div>
  )
}

// ── Filled Meal Card ───────────────────────────────────────────────────────────
function FilledMealCard({ meal, onSwap }) {
  const name    = getMealName(meal)
  const chip    = getStatusChip(meal.status)
  const hasNote = meal.note && meal.note !== 'open_evening' && meal.slot_type !== 'note'
  const isCustom= meal.slot_type === 'note' && meal.note !== 'open_evening'

  return (
    <div style={{
      background: C.cream, border: '1px solid rgba(200,185,160,0.5)',
      borderRadius: '10px', padding: '11px 12px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      cursor: 'pointer', gap: '8px',
      animation: 'mealEntrance 0.22s ease both',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '15px', color: C.ink, fontWeight: 500,
          lineHeight: 1.25, marginBottom: '4px',
        }}>
          {name ?? 'Dinner'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '9px', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase',
            padding: '2px 6px', borderRadius: '4px',
            ...chipStyles[chip.variant],
          }}>
            {chip.label}
          </span>
          {isCustom && (
            <span style={{
              fontSize: '9px', fontWeight: 500, letterSpacing: '0.8px', textTransform: 'uppercase',
              padding: '2px 6px', borderRadius: '4px',
              background: 'rgba(139,111,82,0.08)', color: C.walnut,
            }}>
              Custom
            </span>
          )}
          {hasNote && (
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: C.honey, flexShrink: 0,
              display: 'inline-block',
            }} />
          )}
        </div>
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
          fontSize: '11px', color: C.driftwood, background: 'none', border: 'none',
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
      <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '4px' }}>
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

// ── Publish Bar ────────────────────────────────────────────────────────────────
function PublishBar({ visible, publishing, onPublish }) {
  return (
    <div style={{
      position: 'fixed', bottom: '80px', left: '50%',
      width: '100%', maxWidth: '430px',
      padding: '10px 24px 12px',
      background: C.cream, borderTop: `1px solid ${C.linen}`,
      boxShadow: '0 -2px 16px rgba(80,60,30,0.10)',
      zIndex: 90,
      opacity:    visible ? 1 : 0,
      pointerEvents: visible ? 'all' : 'none',
      transform:  visible
        ? 'translateX(-50%) translateY(0)'
        : 'translateX(-50%) translateY(12px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
    }}>
      <button
        onClick={onPublish}
        disabled={publishing}
        style={{
          width: '100%', background: C.forest, color: 'white', border: 'none',
          borderRadius: '12px', padding: '15px',
          fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
          letterSpacing: '0.5px', cursor: publishing ? 'default' : 'pointer',
          boxShadow: '0 2px 10px rgba(61,107,79,0.28)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          opacity: publishing ? 0.7 : 1,
        }}
      >
        {publishing ? (
          <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            Share this week with the family
          </>
        )}
      </button>
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
    <div style={{
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
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '2px' }}>
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
                navigate('/recipes', { state: { selectMode: true, targetDay: dateStr, targetSlot: slotName.toLowerCase() } })
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
            <span style={{ fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood }}>or</span>
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
      onClick={onClick}
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
        <div style={{ fontSize: '12px', color: primary ? 'rgba(255,255,255,0.7)' : C.driftwood, fontWeight: 300 }}>
          {sub}
        </div>
      </div>
    </div>
  )
}

// ── Bottom Navigation ──────────────────────────────────────────────────────────
const NAV_TABS = [
  {
    key: 'home',
    label: 'Home',
    path: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    key: 'thisweek',
    label: 'This Week',
    path: '/thisweek',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
        <line x1="16" x2="16" y1="2" y2="6"/>
        <line x1="8" x2="8" y1="2" y2="6"/>
        <line x1="3" x2="21" y1="10" y2="10"/>
      </svg>
    ),
  },
  {
    key: 'recipes',
    label: 'Recipes',
    path: '/recipes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
  {
    key: 'shopping',
    label: 'Shopping',
    path: '/shopping',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" x2="21" y1="6" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
]

function BottomNav({ navigate }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '430px', height: '80px',
      padding: '10px 0 22px',
      display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
      zIndex: 100, background: C.cream,
      borderTop: `1px solid ${C.linen}`,
      boxShadow: '0 -2px 12px rgba(80,60,30,0.08)',
    }}>
      {NAV_TABS.map(tab => {
        const active = tab.key === 'thisweek'
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.path)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
              cursor: 'pointer', padding: '4px 0',
              background: 'none', border: 'none',
              color: active ? C.forest : C.driftwood,
              transition: 'color 0.15s',
              position: 'relative',
              fontFamily: "'Jost', sans-serif",
            }}
          >
            {active && (
              <span style={{
                position: 'absolute', bottom: '-2px', left: '50%', transform: 'translateX(-50%)',
                width: '4px', height: '4px', borderRadius: '50%', background: C.forest,
              }} />
            )}
            {tab.icon}
            <span style={{ fontSize: '10px', fontWeight: active ? 600 : 400, letterSpacing: '0.3px' }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
