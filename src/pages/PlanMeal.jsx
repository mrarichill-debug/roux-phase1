/**
 * PlanMeal.jsx — Plan a Meal screen.
 * Name a meal, add one or more recipes (with alternatives), optionally assign to a day this week.
 * Quick items are stored as recipe_type='quick' for cost tracking and autofill.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getWeekDatesTZ, getWeekStartTZ, toLocalDateStr } from '../lib/dateUtils'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', forestDk: '#2E5038',
  cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E',
  linen: '#E8E0D0', sage: '#7A8C6E',
  honey: '#C49A3C', red: '#A03030',
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// ── Recipe Picker Bottom Sheet ──────────────────────────────────────────────
function RecipePickerSheet({ open, onClose, onSelect, addedIds, appUser }) {
  const [recipes, setRecipes] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'quickadd'

  // Quick add form state
  const [qaName, setQaName] = useState('')
  const [qaSource, setQaSource] = useState('')
  const [qaType, setQaType] = useState('quick') // 'quick' | 'draft'
  const [qaSaving, setQaSaving] = useState(false)
  const [qaSuggestions, setQaSuggestions] = useState([])
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setView('list')
    setQaName('')
    setQaSource('')
    setQaType('quick')
    setQaSuggestions([])
    setLoading(true)
    supabase
      .from('recipes')
      .select('id, name, author, credited_to_name, source_type, recipe_type, status')
      .order('name')
      .then(({ data, error }) => {
        if (error) console.error('[Roux] Recipe picker fetch error:', error)
        setRecipes(data || [])
        setLoading(false)
      })
  }, [open])

  const filtered = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  )

  // Autofill — debounced search as user types in quick add name
  function handleQaNameChange(val) {
    setQaName(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setQaSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('recipes')
        .select('id, name, author, recipe_type, status')
        .ilike('name', `${val.trim()}%`)
        .limit(5)
      setQaSuggestions(data || [])
    }, 250)
  }

  async function handleQuickSave() {
    if (!qaName.trim() || qaSaving) return
    setQaSaving(true)
    const isQuick = qaType === 'quick'
    try {
      const { data, error } = await supabase
        .from('recipes')
        .insert({
          name: qaName.trim(),
          author: qaSource.trim() || null,
          household_id: appUser.household_id,
          added_by: appUser.id,
          recipe_type: isQuick ? 'quick' : 'full',
          status: isQuick ? 'complete' : 'draft',
        })
        .select('id, name, author, credited_to_name, source_type, recipe_type, status')
        .single()

      if (error) throw error
      onSelect({ ...data, isQuick, isDraft: !isQuick })
      onClose()
    } catch (err) {
      console.error('[Roux] Quick add recipe error:', err)
    } finally {
      setQaSaving(false)
    }
  }

  // Select an existing recipe from autofill suggestions
  function handleSuggestionTap(recipe) {
    onSelect({ ...recipe, isQuick: recipe.recipe_type === 'quick', isDraft: recipe.status === 'draft' })
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(44,36,23,0.45)',
          zIndex: 200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />
      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', bottom: 0, left: '50%',
          transform: open ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
          width: '100%', maxWidth: '430px',
          background: 'white', borderRadius: '20px 20px 0 0',
          padding: '0 0 40px', zIndex: 201,
          boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
          transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
          maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />

        {view === 'list' ? (
          <>
            {/* Header */}
            <div style={{ padding: '16px 22px 0' }}>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontSize: '20px',
                fontWeight: 500, color: C.ink, marginBottom: '12px',
              }}>
                Add a recipe
              </div>

              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search recipes..."
                style={{
                  width: '100%', padding: '10px 14px', fontSize: '14px',
                  fontFamily: "'Jost', sans-serif", fontWeight: 300,
                  border: `1.5px solid ${C.linen}`, borderRadius: '12px',
                  background: 'white', outline: 'none', boxSizing: 'border-box',
                  color: C.ink,
                }}
                onFocus={e => e.target.style.borderColor = C.sage}
                onBlur={e => e.target.style.borderColor = C.linen}
              />
            </div>

            {/* Recipe list */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '12px 22px',
              WebkitOverflowScrolling: 'touch',
            }}>
              {loading ? (
                <div style={{ fontSize: '13px', color: C.driftwood, fontStyle: 'italic', padding: '20px 0' }}>
                  Loading recipes...
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ fontSize: '13px', color: C.driftwood, fontStyle: 'italic', padding: '20px 0' }}>
                  {search ? 'No recipes match your search.' : 'No recipes yet.'}
                </div>
              ) : (
                filtered.map(r => {
                  const alreadyAdded = addedIds.has(r.id)
                  return (
                    <button
                      key={r.id}
                      onClick={() => { if (!alreadyAdded) { onSelect({ ...r, isQuick: r.recipe_type === 'quick', isDraft: r.status === 'draft' }); onClose() } }}
                      disabled={alreadyAdded}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        width: '100%', padding: '12px 0',
                        background: 'none', border: 'none', borderBottom: `1px solid ${C.linen}`,
                        cursor: alreadyAdded ? 'default' : 'pointer',
                        opacity: alreadyAdded ? 0.5 : 1,
                        textAlign: 'left', fontFamily: "'Jost', sans-serif",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontFamily: "'Playfair Display', serif", fontSize: '15px',
                            fontWeight: 500, color: C.ink,
                          }}>
                            {r.name}
                          </span>
                          {r.recipe_type === 'quick' && (
                            <span style={{
                              fontSize: '9px', fontWeight: 500, color: C.honey,
                              background: 'rgba(196,154,60,0.12)', borderRadius: '4px',
                              padding: '1px 5px',
                            }}>Quick</span>
                          )}
                        </div>
                        {(r.author || r.credited_to_name) && (
                          <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300, marginTop: '2px' }}>
                            {r.author || r.credited_to_name}
                          </div>
                        )}
                      </div>
                      {alreadyAdded && (
                        <svg viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  )
                })
              )}
            </div>

            {/* Quick add link */}
            <div style={{ padding: '8px 22px 0', borderTop: `1px solid ${C.linen}` }}>
              <button
                onClick={() => setView('quickadd')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '13px',
                  color: C.forest, fontWeight: 400, padding: '8px 0',
                }}
              >
                Don't see it? Add a quick item &rarr;
              </button>
            </div>
          </>
        ) : (
          /* ── Quick Add Form ──────────────────────────────────────────── */
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Back link */}
            <button
              onClick={() => { setView('list'); setQaSuggestions([]) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Jost', sans-serif", fontSize: '13px',
                color: C.driftwood, fontWeight: 400, padding: 0,
                textAlign: 'left',
              }}
            >
              &larr; Back to recipes
            </button>

            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: '20px',
              fontWeight: 500, color: C.ink,
            }}>
              Quick add
            </div>

            <div style={{ fontSize: '12px', color: C.driftwood, fontWeight: 300, marginTop: '-10px' }}>
              Type anything — we'll remember it for next time
            </div>

            {/* Recipe name with autofill */}
            <div>
              <input
                type="text"
                value={qaName}
                onChange={e => handleQaNameChange(e.target.value)}
                placeholder="E.g. Store Bought Rolls, Cereal, Rotisserie Chicken"
                style={{
                  width: '100%', padding: '12px 0', fontSize: '20px',
                  fontFamily: "'Playfair Display', serif", fontWeight: 500,
                  background: 'none', border: 'none', borderBottom: `1.5px solid ${C.linen}`,
                  outline: 'none', color: C.ink, boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.borderBottomColor = C.sage}
                onBlur={e => { e.target.style.borderBottomColor = C.linen }}
              />

              {/* Autofill suggestions */}
              {qaSuggestions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                  {qaSuggestions.filter(s => !addedIds.has(s.id)).map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleSuggestionTap(s)}
                      style={{
                        padding: '6px 12px', borderRadius: '20px',
                        border: `1px solid ${C.linen}`, background: 'white',
                        cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                        fontSize: '13px', fontWeight: 400, color: C.ink,
                        transition: 'all 0.15s',
                      }}
                    >
                      {s.name}
                      {s.recipe_type === 'quick' && (
                        <span style={{ fontSize: '9px', color: C.honey, marginLeft: '4px' }}>Quick</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type toggle */}
            <div>
              <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 400, marginBottom: '8px' }}>
                This is a...
              </div>
              <div style={{ display: 'flex', gap: '0', borderRadius: '10px', overflow: 'hidden', border: `1px solid ${C.linen}` }}>
                {[
                  { key: 'quick', label: 'Quick item' },
                  { key: 'draft', label: "Recipe I'll finish later" },
                ].map(opt => {
                  const sel = qaType === opt.key
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setQaType(opt.key)}
                      style={{
                        flex: 1, padding: '8px 10px',
                        background: sel ? (opt.key === 'quick' ? C.forest : C.honey) : 'white',
                        color: sel ? 'white' : C.ink,
                        border: 'none', cursor: 'pointer',
                        fontFamily: "'Jost', sans-serif", fontSize: '12px',
                        fontWeight: sel ? 500 : 300,
                        transition: 'all 0.15s',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {qaType === 'draft' && (
                <div style={{ fontSize: '10px', color: C.driftwood, fontWeight: 300, marginTop: '6px', fontStyle: 'italic' }}>
                  We'll remind you to add the details.
                </div>
              )}
            </div>

            {/* Source */}
            <input
              type="text"
              value={qaSource}
              onChange={e => setQaSource(e.target.value)}
              placeholder="Brandee · NYT Cooking · Mom's kitchen"
              style={{
                width: '100%', padding: '10px 0', fontSize: '14px',
                fontFamily: "'Jost', sans-serif", fontWeight: 300,
                background: 'none', border: 'none', borderBottom: `1.5px solid ${C.linen}`,
                outline: 'none', color: C.ink, boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderBottomColor = C.sage}
              onBlur={e => e.target.style.borderBottomColor = C.linen}
            />

            {/* Save button */}
            <button
              onClick={handleQuickSave}
              disabled={!qaName.trim() || qaSaving}
              style={{
                width: '100%', padding: '14px', borderRadius: '14px',
                background: qaName.trim() && !qaSaving ? C.forest : C.linen,
                color: qaName.trim() && !qaSaving ? 'white' : C.driftwood,
                border: 'none', cursor: qaName.trim() && !qaSaving ? 'pointer' : 'default',
                fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                boxShadow: qaName.trim() && !qaSaving ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
                transition: 'all 0.2s', marginTop: '4px',
              }}
            >
              {qaSaving ? 'Saving...' : 'Save and add'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function PlanMeal({ appUser }) {
  const navigate = useNavigate()
  const { id: editMealId } = useParams()
  const isEditMode = !!editMealId
  const tz = appUser?.timezone || 'America/Chicago'

  // Form state
  const [mealName, setMealName] = useState('')
  const [recipes, setRecipes] = useState([])
  const [addToWeek, setAddToWeek] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [notes, setNotes] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [altPickerSlot, setAltPickerSlot] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(isEditMode)

  // Reorder mode
  const [reordering, setReordering] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  // Weekly confirmation — { [slotIndex]: recipeId }
  const [weekChoices, setWeekChoices] = useState({})

  // Save state
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  const weekDates = getWeekDatesTZ(tz, 0)

  // ── Load existing meal in edit mode ─────────────────────────────────
  useEffect(() => {
    if (!editMealId) return
    async function load() {
      // Fetch meal
      const { data: meal, error: mealErr } = await supabase
        .from('meals')
        .select('id, name, description')
        .eq('id', editMealId)
        .maybeSingle()

      if (mealErr || !meal) { console.error('[Roux] Edit meal fetch error:', mealErr); setLoadingEdit(false); return }

      setMealName(meal.name)
      setNotes(meal.description || '')

      // Fetch meal_recipes with recipe details + alternatives
      const { data: mrs } = await supabase
        .from('meal_recipes')
        .select('id, recipe_id, sort_order, is_swappable, recipes(id, name, author, credited_to_name, recipe_type, status), meal_recipe_alternatives(id, recipe_id, recipes(id, name, author, credited_to_name, recipe_type, status))')
        .eq('meal_id', editMealId)
        .order('sort_order')

      if (mrs) {
        setRecipes(mrs.map(mr => {
          const r = mr.recipes
          const alts = (mr.meal_recipe_alternatives || []).map(a => {
            const ar = a.recipes
            return {
              id: ar.id, name: ar.name,
              credit: ar.author || ar.credited_to_name || '',
              isQuick: ar.recipe_type === 'quick',
              isDraft: ar.status === 'draft',
            }
          })
          return {
            id: r.id, name: r.name,
            credit: r.author || r.credited_to_name || '',
            isQuick: r.recipe_type === 'quick',
            isDraft: r.status === 'draft',
            alternatives: alts,
          }
        }))
      }

      // Check if meal is on the current week plan
      const weekStart = getWeekStartTZ(tz, 0)
      const { data: pm } = await supabase
        .from('planned_meals')
        .select('day_of_week, meal_plan_id, meal_plans!inner(week_start_date)')
        .eq('meal_id', editMealId)
        .eq('meal_plans.week_start_date', weekStart)
        .maybeSingle()

      if (pm) {
        setAddToWeek(true)
        const dayIdx = DAY_KEYS.indexOf(pm.day_of_week)
        if (dayIdx >= 0) setSelectedDay(dayIdx)
      }

      setLoadingEdit(false)
    }
    load()
  }, [editMealId, tz])

  // All recipe IDs currently in the meal (primaries + alternatives)
  const addedIds = new Set()
  recipes.forEach(r => {
    addedIds.add(r.id)
    if (r.alternatives) r.alternatives.forEach(a => addedIds.add(a.id))
  })

  const handleAddRecipe = useCallback((recipe) => {
    if (altPickerSlot !== null) {
      setRecipes(prev => prev.map((r, i) => {
        if (i !== altPickerSlot) return r
        const alts = r.alternatives || []
        if (alts.some(a => a.id === recipe.id)) return r
        return {
          ...r,
          alternatives: [...alts, {
            id: recipe.id, name: recipe.name,
            credit: recipe.author || recipe.credited_to_name || '',
            isQuick: recipe.isQuick || false,
            isDraft: recipe.isDraft || false,
          }],
        }
      }))
      setAltPickerSlot(null)
      return
    }

    setRecipes(prev => [...prev, {
      id: recipe.id, name: recipe.name,
      credit: recipe.author || recipe.credited_to_name || '',
      isQuick: recipe.isQuick || false,
      isDraft: recipe.isDraft || false,
      alternatives: [],
    }])
  }, [altPickerSlot])

  const handleRemoveRecipe = useCallback((recipeId) => {
    setRecipes(prev => prev.filter(r => r.id !== recipeId))
  }, [])

  const handleRemoveAlt = useCallback((slotIndex, altId) => {
    setRecipes(prev => prev.map((r, i) =>
      i === slotIndex ? { ...r, alternatives: r.alternatives.filter(a => a.id !== altId) } : r
    ))
  }, [])

  // ── Drag reorder handlers ───────────────────────────────────────────
  function handleDragStart(idx) { setDragIdx(idx) }
  function handleDragOver(e, idx) { e.preventDefault(); setOverIdx(idx) }
  function handleDrop(idx) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return }
    setRecipes(prev => {
      const arr = [...prev]
      const [moved] = arr.splice(dragIdx, 1)
      arr.splice(idx, 0, moved)
      return arr
    })
    setDragIdx(null)
    setOverIdx(null)
  }
  function handleDragEnd() { setDragIdx(null); setOverIdx(null) }

  // Touch-based drag
  const touchStartY = useRef(0)
  const touchIdx = useRef(null)
  const listRef = useRef(null)

  function handleTouchStart(e, idx) {
    touchStartY.current = e.touches[0].clientY
    touchIdx.current = idx
    setDragIdx(idx)
  }
  function handleTouchMove(e) {
    if (touchIdx.current === null || !listRef.current) return
    const y = e.touches[0].clientY
    const cards = listRef.current.children
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect()
      if (y >= rect.top && y <= rect.bottom && i !== touchIdx.current) {
        setOverIdx(i)
        break
      }
    }
  }
  function handleTouchEnd() {
    if (touchIdx.current !== null && overIdx !== null && touchIdx.current !== overIdx) {
      handleDrop(overIdx)
    }
    touchIdx.current = null
    setDragIdx(null)
    setOverIdx(null)
  }

  const canSave = mealName.trim().length > 0 && recipes.length > 0
    && (!addToWeek || selectedDay !== null)

  const slotsWithAlts = addToWeek ? recipes.filter(r => r.alternatives && r.alternatives.length > 0) : []

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)

    try {
      let mealId

      if (isEditMode) {
        // ── Update existing meal ──────────────────────────────────────
        const { error: mealErr } = await supabase
          .from('meals')
          .update({ name: mealName.trim(), description: notes.trim() || null })
          .eq('id', editMealId)

        if (mealErr) throw mealErr
        mealId = editMealId

        // Delete old meal_recipes (cascades to meal_recipe_alternatives)
        await supabase.from('meal_recipes').delete().eq('meal_id', editMealId)

      } else {
        // ── Insert new meal ───────────────────────────────────────────
        const { data: meal, error: mealErr } = await supabase
          .from('meals')
          .insert({
            name: mealName.trim(),
            household_id: appUser.household_id,
            created_by: appUser.id,
            description: notes.trim() || null,
          })
          .select('id')
          .single()

        if (mealErr) throw mealErr
        mealId = meal.id
      }

      // ── Insert meal_recipes (fresh for both create and edit) ──────
      const mealRecipeRows = recipes.map((r, i) => ({
        meal_id: mealId,
        recipe_id: r.id,
        role: null,
        sort_order: i,
        is_swappable: r.alternatives && r.alternatives.length > 0,
      }))

      const { data: insertedMR, error: mrErr } = await supabase
        .from('meal_recipes')
        .insert(mealRecipeRows)
        .select('id, recipe_id, sort_order')

      if (mrErr) throw mrErr

      const altRows = []
      for (const mr of insertedMR) {
        const slot = recipes[mr.sort_order]
        if (slot && slot.alternatives && slot.alternatives.length > 0) {
          for (const alt of slot.alternatives) {
            altRows.push({ meal_recipe_id: mr.id, recipe_id: alt.id })
          }
        }
      }

      if (altRows.length > 0) {
        const { error: altErr } = await supabase
          .from('meal_recipe_alternatives')
          .insert(altRows)
        if (altErr) throw altErr
      }

      if (addToWeek && selectedDay !== null) {
        const weekStart = getWeekStartTZ(tz, 0)
        const weekEnd = toLocalDateStr(weekDates[6])

        let { data: plan } = await supabase
          .from('meal_plans')
          .select('id')
          .eq('household_id', appUser.household_id)
          .eq('week_start_date', weekStart)
          .maybeSingle()

        if (!plan) {
          const { data: newPlan, error: planErr } = await supabase
            .from('meal_plans')
            .insert({
              household_id: appUser.household_id,
              created_by: appUser.id,
              week_start_date: weekStart,
              week_end_date: weekEnd,
              status: 'draft',
            })
            .select('id')
            .single()

          if (planErr) throw planErr
          plan = newPlan
        }

        // Remove any existing planned_meal for this meal on this week before re-adding
        if (isEditMode) {
          await supabase.from('planned_meals')
            .delete()
            .eq('meal_id', mealId)
            .eq('meal_plan_id', plan.id)
        }

        const { error: pmErr } = await supabase
          .from('planned_meals')
          .insert({
            household_id: appUser.household_id,
            meal_plan_id: plan.id,
            day_of_week: DAY_KEYS[selectedDay],
            meal_type: 'dinner',
            slot_type: 'meal',
            meal_id: mealId,
          })

        if (pmErr) throw pmErr

        for (const [slotIdx, chosenId] of Object.entries(weekChoices)) {
          const mr = insertedMR.find(m => m.sort_order === Number(slotIdx))
          if (!mr) continue
          await supabase
            .from('meal_recipe_alternatives')
            .update({ last_used_at: new Date().toISOString() })
            .eq('meal_recipe_id', mr.id)
            .eq('recipe_id', chosenId)
        }
      }

      setToast('Meal saved.')
      setTimeout(() => navigate(isEditMode ? '/meals/saved' : '/meals'), 1200)

    } catch (err) {
      console.error('[Roux] PlanMeal save error:', err)
      setToast('Something went wrong. Try again.')
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: C.cream, minHeight: '100vh', maxWidth: '430px',
      margin: '0 auto', fontFamily: "'Jost', sans-serif",
      paddingBottom: '140px',
    }}>
      <TopBar
        leftAction={{
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
              <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          ),
          onClick: () => navigate(isEditMode ? '/meals/saved' : '/meals'),
        }}
        centerContent={
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>
            {isEditMode ? 'Edit Meal' : 'Plan a Meal'}
          </span>
        }
      />

      {loadingEdit ? (
        <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="shimmer-block" style={{ height: '48px', borderRadius: '12px' }} />
          <div className="shimmer-block" style={{ height: '80px', borderRadius: '12px' }} />
          <div className="shimmer-block" style={{ height: '44px', borderRadius: '12px' }} />
        </div>
      ) : (
      <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Section 1: Meal Name ──────────────────────────────────────── */}
        <div style={{ opacity: 0, animation: 'fadeUp 0.4s ease 0.05s forwards' }}>
          <input
            type="text"
            value={mealName}
            onChange={e => setMealName(e.target.value)}
            placeholder="What are you calling this one?"
            style={{
              width: '100%', padding: '14px 0', fontSize: '26px',
              fontFamily: "'Playfair Display', serif", fontWeight: 500,
              background: 'none', border: 'none', borderBottom: `1.5px solid ${C.linen}`,
              outline: 'none', color: C.ink, boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderBottomColor = C.sage}
            onBlur={e => e.target.style.borderBottomColor = C.linen}
          />
        </div>

        {/* ── Section 2: Recipes ────────────────────────────────────────── */}
        <div style={{ opacity: 0, animation: 'fadeUp 0.4s ease 0.10s forwards' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '10px',
          }}>
            <div style={{
              fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
              color: C.driftwood, fontWeight: 500,
            }}>
              Recipes
            </div>
            {recipes.length >= 2 && (
              <button
                onClick={() => setReordering(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '11px',
                  color: reordering ? C.forest : C.driftwood,
                  fontWeight: reordering ? 500 : 400, padding: 0,
                }}
              >
                {reordering ? 'Done' : 'Reorder'}
              </button>
            )}
          </div>

          {/* Added recipes */}
          {recipes.length > 0 && (
            <div
              ref={listRef}
              onTouchMove={reordering ? handleTouchMove : undefined}
              onTouchEnd={reordering ? handleTouchEnd : undefined}
              style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}
            >
              {recipes.map((r, i) => {
                const hasAlts = r.alternatives && r.alternatives.length > 0
                const isDragging = dragIdx === i
                const isOver = overIdx === i && dragIdx !== i
                return (
                  <div
                    key={r.id}
                    draggable={reordering}
                    onDragStart={reordering ? () => handleDragStart(i) : undefined}
                    onDragOver={reordering ? (e) => handleDragOver(e, i) : undefined}
                    onDrop={reordering ? () => handleDrop(i) : undefined}
                    onDragEnd={reordering ? handleDragEnd : undefined}
                    onTouchStart={reordering ? (e) => handleTouchStart(e, i) : undefined}
                    style={{
                      background: 'white', borderRadius: '12px',
                      padding: '12px 14px',
                      border: `1px solid ${isOver ? C.forest : C.linen}`,
                      borderLeft: hasAlts ? `3px solid ${C.honey}` : `1px solid ${isOver ? C.forest : C.linen}`,
                      opacity: isDragging ? 0.5 : 1,
                      transition: 'border-color 0.15s, opacity 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Drag handle in reorder mode */}
                      {reordering && (
                        <span style={{
                          fontSize: '16px', color: C.driftwood, cursor: 'grab',
                          userSelect: 'none', lineHeight: 1, flexShrink: 0,
                        }}>
                          &#9776;
                        </span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {hasAlts && (
                            <span style={{ fontSize: '13px', color: C.honey, flexShrink: 0 }}>&#8597;</span>
                          )}
                          <span style={{
                            fontFamily: "'Playfair Display', serif", fontSize: '15px',
                            fontWeight: 600, color: C.ink,
                          }}>
                            {r.name}
                          </span>
                          {r.isQuick && !r.isDraft && (
                            <span style={{
                              fontSize: '9px', fontWeight: 500, color: C.honey,
                              background: 'rgba(196,154,60,0.12)', borderRadius: '4px',
                              padding: '1px 5px',
                            }}>Quick item</span>
                          )}
                          {r.isDraft && (
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate('/save-recipe') }}
                              style={{
                                fontSize: '9px', fontWeight: 500, color: C.honey,
                                background: 'rgba(196,154,60,0.12)', borderRadius: '4px',
                                padding: '1px 5px', border: 'none', cursor: 'pointer',
                                fontFamily: "'Jost', sans-serif",
                              }}
                            >Draft — tap to finish</button>
                          )}
                        </div>
                        {r.credit && (
                          <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300, marginTop: '1px' }}>
                            {r.credit}
                          </div>
                        )}
                      </div>
                      {/* Remove button — hidden in reorder mode */}
                      {!reordering && (
                        <button
                          onClick={() => handleRemoveRecipe(r.id)}
                          style={{
                            width: '30px', height: '30px', borderRadius: '50%',
                            background: 'none', border: `1px solid ${C.linen}`,
                            cursor: 'pointer', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, color: C.driftwood,
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Alternatives — only visible outside reorder mode */}
                    {!reordering && hasAlts && (
                      <div style={{ marginTop: '10px' }}>
                        {r.alternatives.map(alt => (
                          <div key={alt.id}>
                            {/* OR divider */}
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              margin: '6px 0',
                            }}>
                              <div style={{ flex: 1, height: '1px', background: C.linen }} />
                              <span style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 500 }}>
                                or
                              </span>
                              <div style={{ flex: 1, height: '1px', background: C.linen }} />
                            </div>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '8px',
                              paddingLeft: '10px',
                            }}>
                              <span style={{ fontSize: '14px', color: C.ink, fontWeight: 300, flex: 1 }}>
                                {alt.name}
                                {alt.isQuick && (
                                  <span style={{ fontSize: '9px', color: C.honey, marginLeft: '4px' }}>Quick</span>
                                )}
                              </span>
                              <button
                                onClick={() => handleRemoveAlt(i, alt.id)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: C.driftwood, padding: '2px', display: 'flex',
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add alternative link — hidden in reorder mode */}
                    {!reordering && (
                      <button
                        onClick={() => { setAltPickerSlot(i); setPickerOpen(true) }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontFamily: "'Jost', sans-serif", fontSize: '11px',
                          color: C.sage, fontWeight: 400,
                          padding: hasAlts ? '6px 0 0 10px' : '6px 0 0',
                          textAlign: 'left',
                        }}
                      >
                        + Add alternative
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Add recipe button — hidden in reorder mode */}
          {!reordering && (
            <button
              onClick={() => { setAltPickerSlot(null); setPickerOpen(true) }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 16px', borderRadius: '12px',
                border: `1.5px dashed ${C.linen}`, background: 'none',
                cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                fontSize: '14px', color: C.forest, fontWeight: 400,
                width: '100%',
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 18, height: 18 }}>
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add a recipe
            </button>
          )}
        </div>

        {/* ── Section 3: Add to This Week ──────────────────────────────── */}
        <div style={{ opacity: 0, animation: 'fadeUp 0.4s ease 0.14s forwards' }}>
          <button
            onClick={() => { setAddToWeek(v => !v); if (addToWeek) { setSelectedDay(null); setWeekChoices({}) } }}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, fontFamily: "'Jost', sans-serif",
            }}
          >
            <div style={{
              width: '40px', height: '22px', borderRadius: '11px',
              background: addToWeek ? C.forest : C.linen,
              position: 'relative', transition: 'background 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '50%',
                background: 'white',
                position: 'absolute', top: '2px',
                left: addToWeek ? '20px' : '2px',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </div>
            <span style={{ fontSize: '14px', color: C.ink, fontWeight: 400 }}>
              Add to this week's plan
            </span>
          </button>

          {/* Hint when toggle is off */}
          {!addToWeek && (
            <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300, marginTop: '6px', paddingLeft: '50px' }}>
              You can also add this to a week later
            </div>
          )}

          {addToWeek && (
            <>
              <div style={{
                display: 'flex', gap: '6px', marginTop: '14px',
                flexWrap: 'wrap',
              }}>
                {DAY_LABELS.map((label, idx) => {
                  const date = weekDates[idx]
                  const dayNum = date.getDate()
                  const sel = selectedDay === idx
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDay(idx)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: '2px', padding: '8px 0', width: '44px',
                        borderRadius: '10px', cursor: 'pointer',
                        border: sel ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                        background: sel ? 'rgba(61,107,79,0.08)' : 'white',
                        fontFamily: "'Jost', sans-serif",
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', color: sel ? C.forest : C.driftwood, fontWeight: 500 }}>
                        {label}
                      </span>
                      <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: sel ? C.forest : C.ink, fontWeight: 500 }}>
                        {dayNum}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Weekly confirmation picker for slots with alternatives */}
              {slotsWithAlts.length > 0 && selectedDay !== null && (
                <div style={{
                  marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px',
                }}>
                  {recipes.map((r, slotIdx) => {
                    if (!r.alternatives || r.alternatives.length === 0) return null
                    const options = [
                      { id: r.id, name: r.name },
                      ...r.alternatives.map(a => ({ id: a.id, name: a.name })),
                    ]
                    const chosen = weekChoices[slotIdx] || r.id
                    return (
                      <div key={slotIdx} style={{
                        background: 'white', borderRadius: '10px',
                        padding: '10px 14px', border: `1px solid ${C.linen}`,
                      }}>
                        <div style={{
                          fontSize: '12px', color: C.driftwood, fontWeight: 400,
                          marginBottom: '8px',
                        }}>
                          Which version this week?
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {options.map(opt => {
                            const sel = chosen === opt.id
                            return (
                              <button
                                key={opt.id}
                                onClick={() => setWeekChoices(prev => ({ ...prev, [slotIdx]: opt.id }))}
                                style={{
                                  padding: '6px 14px', borderRadius: '20px',
                                  border: sel ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                                  background: sel ? 'rgba(61,107,79,0.08)' : 'white',
                                  color: sel ? C.forest : C.ink,
                                  fontFamily: "'Jost', sans-serif", fontSize: '13px',
                                  fontWeight: sel ? 500 : 400,
                                  cursor: 'pointer', transition: 'all 0.15s',
                                }}
                              >
                                {opt.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Section 4: Notes ──────────────────────────────────────────── */}
        <div style={{ opacity: 0, animation: 'fadeUp 0.4s ease 0.18s forwards' }}>
          <div style={{
            fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
            color: C.driftwood, fontWeight: 500, marginBottom: '8px',
          }}>
            Notes
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything to remember about this one?"
            rows={3}
            style={{
              width: '100%', padding: '12px 14px', fontSize: '16px',
              fontFamily: "'Caveat', cursive", fontWeight: 500,
              border: `1.5px solid ${C.linen}`, borderRadius: '12px',
              background: 'white', outline: 'none', color: C.ink,
              resize: 'none', boxSizing: 'border-box',
            }}
            onFocus={e => e.target.style.borderColor = C.sage}
            onBlur={e => e.target.style.borderColor = C.linen}
          />
        </div>
      </div>
      )}

      {/* ── Pinned CTA ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: '66px', left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px',
        padding: '12px 18px 14px', background: C.cream,
        borderTop: `1px solid ${C.linen}`,
        zIndex: 50,
      }}>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          style={{
            width: '100%', padding: '16px', borderRadius: '14px',
            background: canSave && !saving ? C.forest : C.linen,
            color: canSave && !saving ? 'white' : C.driftwood,
            border: 'none', cursor: canSave && !saving ? 'pointer' : 'default',
            fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
            boxShadow: canSave && !saving ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'Saving...' : 'Save this meal'}
        </button>
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: toast.includes('wrong') ? C.red : C.forest,
          color: 'white', padding: '10px 22px', borderRadius: '10px',
          fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
          zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          opacity: 0, animation: 'fadeUp 0.3s ease forwards',
        }}>
          {toast}
        </div>
      )}

      {/* ── Recipe Picker Sheet ──────────────────────────────────────────── */}
      <RecipePickerSheet
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setAltPickerSlot(null) }}
        onSelect={handleAddRecipe}
        addedIds={addedIds}
        appUser={appUser}
      />

      <BottomNav activeTab="meals" />
    </div>
  )
}
