/**
 * RecipeLibrary.jsx — Recipe library screen.
 * Standalone: own topbar + bottom nav.
 * Matches prototypes/roux-library-style1-objects.html exactly.
 */

import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import WatermarkLayer from '../components/WatermarkLayer'
import { toLocalDateStr, getWeekStartTZ, getWeekDatesTZ } from '../lib/dateUtils'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import AddToPlanSheet from '../components/AddToPlanSheet'
import BottomSheet from '../components/BottomSheet'

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
}

// ── Category pill → DB category mapping ───────────────────────────────────────
// CAT_PILLS and CAT_MAP are now dynamic — derived from fetched recipes
const SYSTEM_PILLS = ['★ Favorites', 'Quick ≤30m']

// Human-readable label for each DB category
// Display category: capitalize first letter of the raw value
function displayCategory(cat) {
  if (!cat) return null
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

const DAYS     = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DOW_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTime(minutes) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function getTotalMinutes(r) {
  if (r.total_time_minutes) return r.total_time_minutes
  return (r.prep_time_minutes || 0) + (r.cook_time_minutes || 0)
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RecipeLibrary({ appUser }) {
  const navigate  = useNavigate()
  const location  = useLocation()

  // selectMode — when navigated from ThisWeek "Browse the library"
  const selectState = location.state
  const selectMode  = selectState?.selectMode  ?? false
  const targetDay   = selectState?.targetDay   ?? ''   // ISO date string e.g. '2026-03-14'
  const targetSlot  = selectState?.targetSlot  ?? 'dinner'

  function getDayLabel(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'long' })
  }
  const dayLabel = getDayLabel(targetDay)

  async function selectRecipe(recipe) {
    if (!targetDay) return
    const tz       = appUser?.timezone ?? 'America/Chicago'
    const d        = new Date(targetDay + 'T00:00:00')
    const jsDay    = d.getDay()
    const DOW_MAP  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
    const dowKey   = DOW_MAP[jsDay]

    // Use the same week-start logic as ThisWeek (Monday-based via getWeekStartTZ)
    const diff      = jsDay === 0 ? -6 : 1 - jsDay
    const mon       = new Date(d)
    mon.setDate(d.getDate() + diff)
    const weekStart = toLocalDateStr(mon)
    const sun       = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const weekEnd   = toLocalDateStr(sun)

    try {
      // Find existing plan for this week
      let { data: plan } = await supabase
        .from('meal_plans')
        .select('id')
        .eq('household_id', appUser.household_id)
        .eq('week_start_date', weekStart)
        .maybeSingle()

      // If no plan exists, create a draft — same as ThisWeek does on first visit
      if (!plan) {
        const { data: newPlan, error: planErr } = await supabase
          .from('meal_plans')
          .insert({
            household_id:    appUser.household_id,
            created_by:      appUser.id,
            week_start_date: weekStart,
            week_end_date:   weekEnd,
            status:          'draft',
          })
          .select('id')
          .single()
        if (planErr) throw planErr
        plan = newPlan
      }

      const { error: mealErr } = await supabase.from('planned_meals').insert({
        meal_plan_id: plan.id,
        household_id: appUser.household_id,
        day_of_week:  dowKey,
        meal_type:    targetSlot,
        slot_type:    'recipe',
        recipe_id:    recipe.id,
        status:       'planned',
      })
      if (mealErr) throw mealErr
    } catch (err) {
      console.error('[Roux] selectRecipe error:', err)
    }

    navigate('/thisweek')
  }

  const [recipes,         setRecipes]         = useState([])
  const [plannedIds,      setPlannedIds]      = useState(new Set())
  const [loading,         setLoading]         = useState(true)
  const [search,          setSearch]          = useState('')
  const [activeTags,      setActiveTags]      = useState(new Set())
  const [tagDefs,         setTagDefs]         = useState([])
  const [recipeTags,      setRecipeTags]      = useState({}) // { recipeId: [tagName, ...] }
  const [activeFilters,   setActiveFilters]   = useState(new Set(['All']))
  const [gridVisible,     setGridVisible]     = useState(true)
  const [weekPickerRecipe,setWeekPickerRecipe]= useState(null)
  const [planSheetRecipe, setPlanSheetRecipe] = useState(null)
  const [saveBtnActive,   setSaveBtnActive]   = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const filterTimer   = useRef(null)
  const isFirstLoad   = useRef(true)

  useEffect(() => {
    if (appUser?.household_id) loadRecipes()
  }, [appUser?.household_id])

  async function loadRecipes() {
    setLoading(true)
    const tz = appUser?.timezone ?? 'America/Chicago'
    const weekStart = getWeekStartTZ(tz)

    const [recipesRes, planRes] = await Promise.all([
      supabase
        .from('recipes')
        .select(`
          id, name, category, personal_notes, credited_to_name,
          prep_time_minutes, cook_time_minutes, total_time_minutes,
          servings, is_family_favorite, diet, created_at
        `)
        .eq('household_id', appUser.household_id)
        .eq('recipe_type', 'full')
        .eq('status', 'complete')
        .order('name'),
      supabase
        .from('meal_plans')
        .select('id')
        .eq('household_id', appUser.household_id)
        .eq('week_start_date', weekStart)
        .maybeSingle(),
    ])

    setRecipes(recipesRes.data ?? [])

    // Fetch tag definitions + recipe tags for filtering (no embedded joins)
    const recipeIds = (recipesRes.data ?? []).map(r => r.id)
    const [tdRes, rtRes] = await Promise.all([
      supabase.from('recipe_tag_definitions').select('id, name, is_default, sort_order').eq('household_id', appUser.household_id).order('sort_order'),
      recipeIds.length > 0
        ? supabase.from('recipe_tags').select('recipe_id, tag_id').in('recipe_id', recipeIds)
        : Promise.resolve({ data: [] }),
    ])
    const defs = tdRes.data || []
    setTagDefs(defs)
    const defMap = Object.fromEntries(defs.map(t => [t.id, t.name]))
    const tagMap = {}
    for (const rt of (rtRes.data || [])) {
      const name = defMap[rt.tag_id]
      if (!name) continue
      if (!tagMap[rt.recipe_id]) tagMap[rt.recipe_id] = []
      tagMap[rt.recipe_id].push(name)
    }
    setRecipeTags(tagMap)

    // Fetch recipe_ids already planned this week
    if (planRes.data) {
      const { data: meals } = await supabase
        .from('planned_meals')
        .select('recipe_id')
        .eq('meal_plan_id', planRes.data.id)
        .not('recipe_id', 'is', null)
      setPlannedIds(new Set((meals ?? []).map(m => m.recipe_id)))
    } else {
      setPlannedIds(new Set())
    }

    setLoading(false)
  }

  const hasActiveFilters = activeTags.size > 0 || !activeFilters.has('All')
  const filterSummary = useMemo(() => {
    const parts = []
    activeTags.forEach(t => parts.push(t))
    if (!activeFilters.has('All')) {
      ;[...activeFilters].filter(f => f !== 'All').forEach(f => parts.push(f))
    }
    return parts.join(' · ')
  }, [activeTags, activeFilters])

  // ── Filtered recipes (reactive) ──────────────────────────────────────────────
  const filteredRecipes = useMemo(() => {
    let r = recipes

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      r = r.filter(rec => rec.name.toLowerCase().includes(q))
    }

    if (activeTags.size > 0) {
      r = r.filter(rec => {
        const tags = recipeTags[rec.id] || []
        return [...activeTags].every(t => tags.includes(t))
      })
    }

    if (!activeFilters.has('All')) {
      if (activeFilters.has('★ Favorites'))
        r = r.filter(rec => rec.is_family_favorite)
      if (activeFilters.has('Quick ≤30m'))
        r = r.filter(rec => getTotalMinutes(rec) > 0 && getTotalMinutes(rec) <= 30)
    }

    return r
  }, [recipes, search, activeTags, activeFilters, recipeTags])

  // ── Filter change animation ─────────────────────────────────────────────────
  const filterKey = [...activeFilters].sort().join(',')
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false
      return
    }
    setGridVisible(false)
    clearTimeout(filterTimer.current)
    filterTimer.current = setTimeout(() => setGridVisible(true), 150)
  }, [search, activeTags, filterKey])

  function toggleFilter(pill) {
    if (pill === 'All') {
      setActiveFilters(new Set(['All']))
      return
    }
    setActiveFilters(prev => {
      const next = new Set(prev)
      next.delete('All')
      if (next.has(pill)) {
        next.delete(pill)
        if (next.size === 0) next.add('All')
      } else {
        next.add(pill)
      }
      return next
    })
  }

  function openWeekPicker(recipe) {
    setWeekPickerRecipe(recipe)
  }

  function closeWeekPicker() {
    setWeekPickerRecipe(null)
  }

  return (
    <div style={{
      background:    C.cream,
      fontFamily:    "'Jost', sans-serif",
      fontWeight:    300,
      minHeight:     '100vh',
      maxWidth:      '430px',
      margin:        '0 auto',
      paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 8px))',
      position:      'relative',
      overflowX:     'hidden',
    }}>

      <WatermarkLayer />

      {/* ── Green zone: Row 1 (topbar 66px) + Row 2 (search 48px) ─────────── */}
      <TopBar childrenHeight={48} leftAction={{
        onClick: () => navigate('/meals'),
        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>,
      }}>
        {/* Row 2: Search input + filter icon — unified green zone */}
        <div style={{ padding: '0 22px 10px', position: 'relative', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              color: 'rgba(210,230,200,0.6)', display: 'flex', alignItems: 'center',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search recipes…"
              className="library-search"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '10px',
                padding: '10px 14px 10px 36px',
                fontFamily: "'Jost', sans-serif",
                fontSize: '14px', fontWeight: 300,
                color: 'rgba(250,247,242,0.92)', outline: 'none',
                transition: 'background 0.15s, border-color 0.15s',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {/* Filter icon */}
          <button
            onClick={() => setFilterSheetOpen(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              position: 'relative', padding: '6px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(210,230,200,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              <line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/>
              <line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/>
              <line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/>
              <line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>
            </svg>
            {hasActiveFilters && (
              <span style={{
                position: 'absolute', top: '4px', right: '4px',
                width: '6px', height: '6px', borderRadius: '50%',
                background: C.honey,
              }} />
            )}
          </button>
        </div>
      </TopBar>

      {/* ── Active filter summary ─────────────────────────────────────────── */}
      {hasActiveFilters && filterSummary && (
        <button
          onClick={() => setFilterSheetOpen(true)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '8px 22px 0', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: "'Jost', sans-serif",
            fontSize: '12px', fontWeight: 300, color: C.driftwood,
            position: 'relative', zIndex: 1,
          }}
        >
          {filterSummary}
        </button>
      )}


      {/* ── Select mode banner ──────────────────────────────────────────────── */}
      {selectMode && (
        <div style={{
          margin: '14px 22px 0',
          padding: '12px 16px',
          background: 'rgba(61,107,79,0.08)',
          border: `1px solid rgba(61,107,79,0.25)`,
          borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'relative', zIndex: 1,
        }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.forest, marginBottom: '2px' }}>
              Selecting recipe for
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: C.ink, fontWeight: 500 }}>
              {dayLabel} {targetSlot === 'other' ? 'Everything else' : targetSlot.charAt(0).toUpperCase() + targetSlot.slice(1)}
            </div>
          </div>
          <button
            onClick={() => navigate('/thisweek')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.driftwood, padding: '4px', display: 'flex',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Header line ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: '12px 22px', position: 'relative', zIndex: 1,
        fontFamily: "'Playfair Display', serif", fontSize: '14px',
        fontStyle: 'italic', color: C.driftwood,
      }}>
        {loading ? '…' : hasActiveFilters || search.trim()
          ? `${filteredRecipes.length} recipe${filteredRecipes.length !== 1 ? 's' : ''} match`
          : `${filteredRecipes.length} recipes from your kitchen`}
      </div>

      {/* ── Card grid ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '12px', padding: '0 22px 16px',
        position: 'relative', zIndex: 1,
        opacity: gridVisible ? 1 : 0,
        transition: 'opacity 0.15s ease',
      }}>
        {filteredRecipes.map((recipe, i) => (
          <RecipeGridCard
            key={recipe.id}
            recipe={recipe}
            index={i}
            selectMode={selectMode}
            isPlanned={plannedIds.has(recipe.id)}
            primaryTag={(recipeTags[recipe.id] || [])[0] || null}
            onTap={selectMode ? () => selectRecipe(recipe) : () => navigate(`/recipe/${recipe.id}`, { state: { from: '/meals/recipes' } })}
            onAddToWeek={selectMode ? () => selectRecipe(recipe) : () => setPlanSheetRecipe({ id: recipe.id, name: recipe.name })}
          />
        ))}
        {!loading && filteredRecipes.length === 0 && (
          <div style={{
            gridColumn: '1 / -1', textAlign: 'center',
            padding: '48px 0', color: C.driftwood, fontSize: '13px', fontStyle: 'italic',
          }}>
            No recipes match your search.
          </div>
        )}
      </div>

      {/* ── Bottom Nav ────────────────────────────────────────────────────────── */}
      {/* ── FAB: Save a Recipe ─────────────────────────────────────────────── */}
      {!selectMode && (
        <button
          onClick={() => navigate('/save-recipe')}
          style={{
            position: 'fixed', bottom: 'calc(58px + env(safe-area-inset-bottom, 8px))', right: '20px',
            width: '56px', height: '56px', borderRadius: '50%',
            background: C.forest, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 50,
            animation: 'fabIn 0.35s cubic-bezier(0.22,1,0.36,1) 0.1s both',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" style={{ width: 24, height: 24 }}>
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      )}

      <BottomNav activeTab="meals" />

      <AddToPlanSheet
        open={!!planSheetRecipe}
        onClose={() => setPlanSheetRecipe(null)}
        meal={planSheetRecipe}
        appUser={appUser}
        onSuccess={() => setPlanSheetRecipe(null)}
        itemType="recipe"
      />

      {/* ── Filter Sheet ────────────────────────────────────────────────────── */}
      <BottomSheet isOpen={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} maxHeight="70vh">
            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Browse by tag — unified section */}
              <div>
                <div style={{ fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 500, marginBottom: '10px' }}>
                  Browse by tag
                </div>
                {/* Default tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tagDefs.filter(t => t.is_default).map(tag => {
                    const isActive = activeTags.has(tag.name)
                    return (
                      <button key={tag.id} onClick={() => setActiveTags(prev => { const n = new Set(prev); n.has(tag.name) ? n.delete(tag.name) : n.add(tag.name); return n })} style={{
                        padding: '6px 14px', borderRadius: '20px',
                        border: isActive ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                        background: isActive ? 'rgba(61,107,79,0.08)' : 'white',
                        color: isActive ? C.forest : C.ink,
                        fontFamily: "'Jost', sans-serif", fontSize: '13px',
                        fontWeight: isActive ? 500 : 400, cursor: 'pointer',
                      }}>{tag.name}</button>
                    )
                  })}
                </div>
                {/* Custom household tags */}
                {tagDefs.some(t => !t.is_default) && (
                  <>
                    <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 300, margin: '12px 0 8px', fontFamily: "'Jost', sans-serif" }}>Your tags</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {tagDefs.filter(t => !t.is_default).map(tag => {
                        const isActive = activeTags.has(tag.name)
                        return (
                          <button key={tag.id} onClick={() => setActiveTags(prev => { const n = new Set(prev); n.has(tag.name) ? n.delete(tag.name) : n.add(tag.name); return n })} style={{
                            padding: '6px 14px', borderRadius: '20px',
                            border: isActive ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                            background: isActive ? 'rgba(61,107,79,0.08)' : 'white',
                            color: isActive ? C.forest : C.ink,
                            fontFamily: "'Jost', sans-serif", fontSize: '13px',
                            fontWeight: isActive ? 500 : 400, cursor: 'pointer',
                          }}>{tag.name}</button>
                        )
                      })}
                    </div>
                  </>
                )}
                {/* System pills — Favorites + Quick */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
                  {SYSTEM_PILLS.map(pill => {
                    const isActive = activeFilters.has(pill)
                    return (
                      <button key={pill} onClick={() => toggleFilter(pill)} style={{
                        padding: '6px 14px', borderRadius: '20px',
                        border: isActive ? `1.5px solid ${C.forest}` : `1px solid ${C.honey}`,
                        background: isActive ? 'rgba(61,107,79,0.08)' : 'white',
                        color: isActive ? C.forest : C.ink,
                        fontFamily: "'Jost', sans-serif", fontSize: '13px',
                        fontWeight: isActive ? 500 : 400, cursor: 'pointer',
                      }}>{pill}</button>
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => setFilterSheetOpen(false)} style={{
                  width: '100%', padding: '14px', borderRadius: '12px',
                  background: C.forest, color: 'white', border: 'none',
                  fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                  cursor: 'pointer',
                }}>
                  Show recipes
                </button>
                {hasActiveFilters && (
                  <button onClick={() => { setActiveTags(new Set()); setActiveFilters(new Set(['All'])) }} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: "'Jost', sans-serif", fontSize: '12px',
                    color: C.driftwood, fontWeight: 300, padding: '4px',
                  }}>
                    Clear all
                  </button>
                )}
              </div>
            </div>
      </BottomSheet>

      {/* ── + Week bottom sheet ───────────────────────────────────────────────── */}
      <BottomSheet isOpen={!!weekPickerRecipe} onClose={() => setWeekPickerRecipe(null)}>
        <WeekPickerSheetContent
          recipe={weekPickerRecipe}
          appUser={appUser}
          onClose={() => { setWeekPickerRecipe(null); setOverlayVisible(false) }}
        />
      </BottomSheet>

    </div>
  )
}

// ── Recipe Grid Card ───────────────────────────────────────────────────────────
function RecipeGridCard({ recipe, index, selectMode, isPlanned, onTap, onAddToWeek, primaryTag }) {
  const total    = getTotalMinutes(recipe)
  const timeStr  = total > 0 ? formatTime(total) : null
  const catLabel = primaryTag || displayCategory(recipe.category)
  const note     = recipe.personal_notes || null

  const animDelay = `${0.04 + index * 0.03}s`

  function handlePlanTap(e) {
    e.stopPropagation()
    onAddToWeek()
  }

  return (
    <div
      onClick={onTap}
      className="recipe-card-tap"
      style={{
        background:   'white',
        border:       '1px solid rgba(200,185,160,0.55)',
        borderRadius: '16px', overflow: 'hidden',
        cursor:       'pointer',
        boxShadow:    '0 1px 4px rgba(80,60,30,0.07), 0 3px 12px rgba(80,60,30,0.05)',
        transition:   'transform 100ms ease',
        animation:    `fadeUp 0.35s ease ${animDelay} both`,
        position:     'relative',
      }}
    >
      <div style={{ padding: '12px 12px 10px' }}>

        {/* Top: category badge + fav star */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px' }}>
          {catLabel ? (
            <div style={{
              display: 'inline-block',
              background: 'transparent',
              border: '0.5px solid #C4B8A8',
              borderRadius: '4px', padding: '2px 7px',
              fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase',
              color: C.driftwood,
            }}>
              {catLabel}
            </div>
          ) : <div />}
          {recipe.is_family_favorite && (
            <span style={{ color: C.honey, fontSize: '15px', lineHeight: 1, flexShrink: 0, marginLeft: '4px' }}>★</span>
          )}
        </div>

        {/* Recipe name */}
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '17px', fontWeight: 500, color: C.ink,
          lineHeight: 1.3, marginBottom: '4px',
        }}>
          {recipe.name}
        </div>

        {/* Handwritten note (Caveat) */}
        {note && (
          <div style={{
            fontFamily: "'Caveat', cursive",
            fontSize: '12px', color: C.walnut, opacity: 0.8, marginBottom: '4px',
          }}>
            {note}
          </div>
        )}

        {/* Meta: time + servings */}
        {(timeStr || recipe.servings) && (
          <div style={{ fontSize: '11px', color: C.driftwoodSm, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {timeStr && <span>{timeStr}</span>}
            {recipe.servings && <span>{recipe.servings} srv</span>}
          </div>
        )}
      </div>

      {/* Plan link — bottom right */}
      <button
        onClick={handlePlanTap}
        style={{
          position: 'absolute', bottom: '10px', right: '12px',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: "'Jost', sans-serif", fontSize: '11px',
          fontWeight: 300, color: C.forest, padding: 0,
        }}
      >
        {selectMode ? 'Select' : '+ Plan'}
      </button>
    </div>
  )
}

// ── + Week Day Picker Sheet Content ───────────────────────────────────────────
function WeekPickerSheetContent({ recipe, appUser, onClose }) {
  const [adding, setAdding] = useState(null)
  const [added,  setAdded]  = useState(null)

  useEffect(() => {
    if (!recipe) {
      setTimeout(() => { setAdded(null); setAdding(null) }, 320)
    }
  }, [recipe])

  async function addToDay(dayLabel, dowKey) {
    if (adding) return
    setAdding(dayLabel)

    try {
      const tz = appUser?.timezone ?? 'America/Chicago'
      const today    = new Date()
      const jsDay    = today.getDay()
      const diff     = jsDay === 0 ? -6 : 1 - jsDay
      const mon      = new Date(today)
      mon.setDate(today.getDate() + diff)
      const weekStart = toLocalDateStr(mon)

      const { data: plan } = await supabase
        .from('meal_plans')
        .select('id')
        .eq('household_id', appUser.household_id)
        .eq('week_start_date', weekStart)
        .maybeSingle()

      if (!plan) {
        setAdded('no-plan')
        return
      }

      const { error } = await supabase.from('planned_meals').insert({
        meal_plan_id: plan.id,
        household_id: appUser.household_id,
        day_of_week:  dowKey,
        meal_type:    'dinner',
        slot_type:    'recipe',
        recipe_id:    recipe.id,
        status:       'planned',
      })

      if (error) throw error
      setAdded(dayLabel)
    } catch (err) {
      console.error('+ Week error:', err)
      setAdded('error')
    } finally {
      setAdding(null)
    }
  }

  if (!recipe) return null

  return (
    <>
      {/* Header */}
      <div style={{
        padding: '16px 22px 14px',
        borderBottom: `1px solid ${C.linen}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '2px' }}>
            Add to this week
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: C.ink, fontWeight: 500, lineHeight: 1.2 }}>
            {recipe?.name}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: '32px', height: '32px', borderRadius: '50%',
            border: '1px solid rgba(200,185,160,0.6)', background: C.cream,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: C.driftwood, flexShrink: 0,
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 22px' }}>
        {added === 'no-plan' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: C.ink, marginBottom: '8px' }}>
              No plan for this week yet.
            </div>
            <div style={{ fontSize: '13px', color: C.driftwood }}>
              Visit This Week to start planning.
            </div>
          </div>
        ) : added === 'error' ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '13px', color: '#A03030' }}>
            Something went wrong. Try again.
          </div>
        ) : added ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: C.forest, marginBottom: '4px' }}>
              Added to {added} ✓
            </div>
            <div style={{ fontSize: '12px', color: C.driftwoodSm }}>Dinner slot updated in This Week.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {DAYS.map((day, i) => (
              <button
                key={day}
                onClick={() => addToDay(day, DOW_KEYS[i])}
                disabled={!!adding}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: '10px',
                  border: '1px solid rgba(200,185,160,0.55)',
                  background: adding === day ? 'rgba(61,107,79,0.06)' : C.cream,
                  cursor: adding ? 'default' : 'pointer',
                  fontFamily: "'Jost', sans-serif",
                  fontSize: '14px', color: C.ink, fontWeight: 400,
                  opacity: adding && adding !== day ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <span>{day}</span>
                {adding === day ? (
                  <div style={{ width: '14px', height: '14px', border: '2px solid rgba(61,107,79,0.3)', borderTopColor: C.forest, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                ) : (
                  <span style={{ fontSize: '11px', color: C.sage, fontWeight: 500 }}>Dinner →</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

