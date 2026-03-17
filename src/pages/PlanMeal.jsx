/**
 * PlanMeal.jsx — Plan a Meal screen.
 * Name a meal, add one or more recipes, optionally assign to a day this week.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [qaSaving, setQaSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setView('list')
    setQaName('')
    setQaSource('')
    setLoading(true)
    supabase
      .from('recipes')
      .select('id, name, author, credited_to_name, source_type')
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

  async function handleQuickSave() {
    if (!qaName.trim() || qaSaving) return
    setQaSaving(true)
    try {
      const { data, error } = await supabase
        .from('recipes')
        .insert({
          name: qaName.trim(),
          author: qaSource.trim() || null,
          household_id: appUser.household_id,
          added_by: appUser.id,
        })
        .select('id, name, author, credited_to_name, source_type')
        .single()

      if (error) throw error

      // Pass the new recipe back with isDraft flag
      onSelect({ ...data, isDraft: true })
      onClose()
    } catch (err) {
      console.error('[Roux] Quick add recipe error:', err)
    } finally {
      setQaSaving(false)
    }
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
                      onClick={() => { if (!alreadyAdded) { onSelect(r); onClose() } }}
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
                        <div style={{
                          fontFamily: "'Playfair Display', serif", fontSize: '15px',
                          fontWeight: 500, color: C.ink,
                        }}>
                          {r.name}
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
                Don't see it? Add a quick recipe &rarr;
              </button>
            </div>
          </>
        ) : (
          /* ── Quick Add Form ──────────────────────────────────────────── */
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Back link */}
            <button
              onClick={() => setView('list')}
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

            {/* Recipe name */}
            <input
              type="text"
              value={qaName}
              onChange={e => setQaName(e.target.value)}
              placeholder="What do you call this one?"
              style={{
                width: '100%', padding: '12px 0', fontSize: '20px',
                fontFamily: "'Playfair Display', serif", fontWeight: 500,
                background: 'none', border: 'none', borderBottom: `1.5px solid ${C.linen}`,
                outline: 'none', color: C.ink, boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderBottomColor = C.sage}
              onBlur={e => e.target.style.borderBottomColor = C.linen}
            />

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
  const tz = appUser?.timezone || 'America/Chicago'

  // Form state
  const [mealName, setMealName] = useState('')
  const [recipes, setRecipes] = useState([]) // { id, name, source, role }
  const [addToWeek, setAddToWeek] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [notes, setNotes] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  // Save state
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // Week dates for day picker
  const weekDates = getWeekDatesTZ(tz, 0)

  const addedIds = new Set(recipes.map(r => r.id))

  const handleAddRecipe = useCallback((recipe) => {
    setRecipes(prev => [...prev, {
      id: recipe.id, name: recipe.name,
      credit: recipe.author || recipe.credited_to_name || '',
      role: '', isDraft: recipe.isDraft || false,
    }])
  }, [])

  const handleRemoveRecipe = useCallback((recipeId) => {
    setRecipes(prev => prev.filter(r => r.id !== recipeId))
  }, [])

  const handleRoleChange = useCallback((recipeId, role) => {
    setRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, role } : r))
  }, [])

  const canSave = mealName.trim().length > 0 && recipes.length > 0
    && (!addToWeek || selectedDay !== null)

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)

    try {
      // 1. Insert meal
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

      // 2. Insert meal_recipes
      const mealRecipeRows = recipes.map((r, i) => ({
        meal_id: meal.id,
        recipe_id: r.id,
        role: r.role.trim() || null,
        sort_order: i,
      }))

      const { error: mrErr } = await supabase
        .from('meal_recipes')
        .insert(mealRecipeRows)

      if (mrErr) throw mrErr

      // 3. If adding to this week — find or create meal plan, then insert planned_meal
      if (addToWeek && selectedDay !== null) {
        const weekStart = getWeekStartTZ(tz, 0)
        const weekEnd = toLocalDateStr(weekDates[6])

        // Find existing plan for this week
        let { data: plan } = await supabase
          .from('meal_plans')
          .select('id')
          .eq('household_id', appUser.household_id)
          .eq('week_start_date', weekStart)
          .maybeSingle()

        // Create one if it doesn't exist
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

        // Insert planned meal
        const { error: pmErr } = await supabase
          .from('planned_meals')
          .insert({
            household_id: appUser.household_id,
            meal_plan_id: plan.id,
            day_of_week: DAY_KEYS[selectedDay],
            meal_type: 'dinner',
            slot_type: 'meal',
            meal_id: meal.id,
          })

        if (pmErr) throw pmErr
      }

      // Show toast, then navigate
      setToast('Meal saved.')
      setTimeout(() => navigate('/meals'), 1200)

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
      {/* Topbar */}
      <TopBar
        leftAction={{
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
              <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          ),
          onClick: () => navigate('/meals'),
        }}
        centerContent={
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>
            Plan a Meal
          </span>
        }
      />

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
            fontSize: '10px', letterSpacing: '1.5px', textTransform: 'uppercase',
            color: C.driftwood, fontWeight: 500, marginBottom: '10px',
          }}>
            Recipes
          </div>

          {/* Added recipes */}
          {recipes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {recipes.map((r, i) => (
                <div key={r.id} style={{
                  background: 'white', borderRadius: '12px',
                  padding: '12px 14px',
                  border: `1px solid ${C.linen}`,
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Playfair Display', serif", fontSize: '15px',
                      fontWeight: 500, color: C.ink,
                    }}>
                      {r.name}
                    </div>
                    {r.credit && (
                      <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300, marginTop: '1px' }}>
                        {r.credit}
                      </div>
                    )}
                    {r.isDraft && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('/save-recipe') }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          marginTop: '4px', padding: '2px 8px', borderRadius: '6px',
                          background: 'rgba(196,154,60,0.12)', border: 'none',
                          cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                          fontSize: '10px', fontWeight: 500, color: C.honey,
                        }}
                      >
                        Draft — tap to complete
                      </button>
                    )}
                    {/* Role input — only show when 2+ recipes */}
                    {recipes.length >= 2 && (
                      <input
                        type="text"
                        value={r.role}
                        onChange={e => handleRoleChange(r.id, e.target.value)}
                        placeholder="role (optional)"
                        style={{
                          marginTop: '6px', padding: '4px 0',
                          fontSize: '12px', fontFamily: "'Jost', sans-serif", fontWeight: 300,
                          background: 'none', border: 'none',
                          borderBottom: `1px solid ${C.linen}`,
                          outline: 'none', color: C.driftwoodSm,
                          width: '120px',
                        }}
                      />
                    )}
                  </div>
                  {/* Remove button */}
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
                </div>
              ))}
            </div>
          )}

          {/* Add recipe button */}
          <button
            onClick={() => setPickerOpen(true)}
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
        </div>

        {/* ── Section 3: Add to This Week ──────────────────────────────── */}
        <div style={{ opacity: 0, animation: 'fadeUp 0.4s ease 0.14s forwards' }}>
          {/* Toggle */}
          <button
            onClick={() => { setAddToWeek(v => !v); if (addToWeek) setSelectedDay(null) }}
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

          {/* Day picker */}
          {addToWeek && (
            <div style={{
              display: 'flex', gap: '6px', marginTop: '14px',
              flexWrap: 'wrap',
            }}>
              {DAY_LABELS.map((label, i) => {
                const date = weekDates[i]
                const dayNum = date.getDate()
                const sel = selectedDay === i
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(i)}
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
        onClose={() => setPickerOpen(false)}
        onSelect={handleAddRecipe}
        addedIds={addedIds}
        appUser={appUser}
      />

      <BottomNav activeTab="meals" />
    </div>
  )
}
