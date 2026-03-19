/**
 * RecipeCard.jsx — Recipe Card Phase 2.
 * Standalone: slim 58px topbar, pinned CTA, no bottom nav.
 * Matches prototypes/roux-recipe-card-style1-objects.html exactly.
 */

import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import WatermarkLayer from '../components/WatermarkLayer'
import { toLocalDateStr, getWeekStartTZ } from '../lib/dateUtils'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import AddToPlanSheet from '../components/AddToPlanSheet'

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

const DIET_LABELS = {
  gluten_free:  'Gluten Free',
  dairy_free:   'Dairy Free',
  vegetarian:   'Vegetarian',
  vegan:        'Vegan',
  nut_free:     'Nut Free',
  egg_free:     'Egg Free',
}

const DIFFICULTY = { easy: 'Easy', medium: 'Med', advanced: 'Adv' }

const CAT_DISPLAY = {
  main: 'Dinner', pasta: 'Pasta', soup: 'Soup', dessert: 'Dessert',
  bread: 'Bread', sauce: 'Sauce', appetizer: 'Appetizer',
  breakfast: 'Breakfast', lunch: 'Lunch', salad: 'Salad', side: 'Side',
}

const DAYS     = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DOW_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

// ── Quantity helpers ───────────────────────────────────────────────────────────
const UNICODE_FRAC = { '½': 1/2, '¼': 1/4, '¾': 3/4, '⅓': 1/3, '⅔': 2/3, '⅛': 1/8, '⅜': 3/8, '⅝': 5/8, '⅞': 7/8 }
const NICE_FRAC    = [[1/8,'⅛'],[1/4,'¼'],[1/3,'⅓'],[3/8,'⅜'],[1/2,'½'],[5/8,'⅝'],[2/3,'⅔'],[3/4,'¾'],[7/8,'⅞']]

function parseQty(str) {
  if (!str) return null
  let s = str.trim()
  let val = 0
  for (const [ch, num] of Object.entries(UNICODE_FRAC)) {
    if (s.includes(ch)) { val += num; s = s.replace(ch, '').trim(); break }
  }
  if (s) {
    if (s.includes('/')) {
      const [n, d] = s.split('/').map(x => parseFloat(x.trim()))
      if (!isNaN(n) && !isNaN(d) && d !== 0) val += n / d
      else return null
    } else {
      const n = parseFloat(s)
      if (!isNaN(n)) val += n
      else return null
    }
  }
  return val > 0 ? val : null
}

function formatQtyNice(n) {
  if (!n || n <= 0) return '0'
  const whole = Math.floor(n)
  const frac  = n - whole
  if (frac < 0.04) return `${whole || 0}`
  if (frac > 0.96) return `${whole + 1}`
  let bestStr = '', bestDiff = Infinity
  for (const [val, str] of NICE_FRAC) {
    const diff = Math.abs(frac - val)
    if (diff < bestDiff) { bestDiff = diff; bestStr = str }
  }
  return whole > 0 ? `${whole}${bestStr}` : bestStr
}

function scaleQty(qtyStr, scale) {
  if (!qtyStr || scale === 1) return qtyStr
  const val = parseQty(qtyStr)
  if (val === null) return qtyStr
  return formatQtyNice(val * scale) || qtyStr
}

function formatTime(minutes) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function RecipeCard({ appUser }) {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const location  = useLocation()
  const backTo    = location.state?.from || '/meals/recipes'

  const [recipe,       setRecipe]       = useState(null)
  const [ingredients,  setIngredients]  = useState([])
  const [instructions, setInstructions] = useState([])
  const [related,      setRelated]      = useState([])
  const [loading,      setLoading]      = useState(true)

  const [activeTab,    setActiveTab]    = useState('ingredients')
  const [serves,       setServes]       = useState(4)
  const [baseServes,   setBaseServes]   = useState(4)
  const [checked,      setChecked]      = useState(new Set())
  const [stepStates,   setStepStates]   = useState({})
  const [sageExpanded, setSageExpanded] = useState(false)
  const [favActive,    setFavActive]    = useState(false)

  const [plannedThisWeek,   setPlannedThisWeek]   = useState(false)
  const [planSheetOpen,     setPlanSheetOpen]     = useState(false)
  const [weekPickerOpen,    setWeekPickerOpen]    = useState(false)
  const [weekPickerOverlay, setWeekPickerOverlay] = useState(false)
  const overlayTimer = useRef(null)

  // ── Data fetch ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (id) fetchAll()
  }, [id])

  async function fetchAll() {
    setLoading(true)
    const [recipeRes, ingRes, insRes] = await Promise.all([
      supabase.from('recipes').select(`
        id, name, description, category, cuisine, method, difficulty,
        prep_time_minutes, cook_time_minutes, total_time_minutes,
        servings, is_family_favorite, diet, personal_notes,
        credited_to_name, photo_url, sage_assist_content,
        household_id
      `).eq('id', id).single(),
      supabase.from('ingredients').select('*').eq('recipe_id', id).order('sort_order'),
      supabase.from('instructions').select('*').eq('recipe_id', id).order('step_number'),
    ])

    const rec = recipeRes.data
    if (rec) {
      setRecipe(rec)
      setFavActive(rec.is_family_favorite)
      const parsed = parseInt(rec.servings)
      if (!isNaN(parsed) && parsed > 0) { setServes(parsed); setBaseServes(parsed) }

      // Fetch related recipes
      if (rec.category && rec.household_id) {
        const { data: rel } = await supabase
          .from('recipes')
          .select('id, name, category, prep_time_minutes, cook_time_minutes, total_time_minutes')
          .eq('household_id', rec.household_id)
          .eq('category', rec.category)
          .neq('id', id)
          .limit(4)
        setRelated(rel ?? [])
      }
    }

    setIngredients(ingRes.data ?? [])
    setInstructions(insRes.data ?? [])

    // Check if this recipe is already planned for the current week
    if (rec?.household_id) {
      const tz = appUser?.timezone ?? 'America/Chicago'
      const weekStart = getWeekStartTZ(tz)
      const { data: plan } = await supabase
        .from('meal_plans')
        .select('id')
        .eq('household_id', rec.household_id)
        .eq('week_start_date', weekStart)
        .maybeSingle()
      if (plan) {
        const { count } = await supabase
          .from('planned_meals')
          .select('id', { count: 'exact', head: true })
          .eq('meal_plan_id', plan.id)
          .eq('recipe_id', id)
        setPlannedThisWeek((count ?? 0) > 0)
      }
    }

    setLoading(false)
  }

  // ── Favorite toggle ──────────────────────────────────────────────────────────
  async function toggleFav() {
    const next = !favActive
    setFavActive(next)
    await supabase.from('recipes').update({ is_family_favorite: next }).eq('id', id)
  }

  // ── Serves adjuster ─────────────────────────────────────────────────────────
  const scale = baseServes > 0 ? serves / baseServes : 1
  function adjustServes(delta) {
    setServes(prev => Math.max(1, Math.min(24, prev + delta)))
  }

  // ── Ingredient check toggle ──────────────────────────────────────────────────
  function toggleChecked(ingId) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(ingId) ? next.delete(ingId) : next.add(ingId)
      return next
    })
  }

  // ── Step state cycling ───────────────────────────────────────────────────────
  function cycleStep(stepId) {
    const state = stepStates[stepId] || 'idle'
    if (state === 'idle') {
      setStepStates(prev => ({ ...prev, [stepId]: 'active' }))
    } else if (state === 'active') {
      setStepStates(prev => ({ ...prev, [stepId]: 'completing' }))
      setTimeout(() => setStepStates(prev => ({ ...prev, [stepId]: 'done' })), 180)
    } else if (state === 'done') {
      setStepStates(prev => ({ ...prev, [stepId]: 'idle' }))
    }
  }

  // ── Week picker ─────────────────────────────────────────────────────────────
  function openWeekPicker() {
    setWeekPickerOpen(true)
    overlayTimer.current = setTimeout(() => setWeekPickerOverlay(true), 40)
  }
  function closeWeekPicker() {
    setWeekPickerOverlay(false)
    setTimeout(() => setWeekPickerOpen(false), 320)
  }

  // ── Grouped ingredients ──────────────────────────────────────────────────────
  const groupedIngredients = useMemo(() => {
    const groups = []
    const seen   = {}
    for (const ing of ingredients) {
      const key = ing.section_name || ''
      if (!seen[key]) { seen[key] = []; groups.push({ section: ing.section_name || null, items: seen[key] }) }
      seen[key].push(ing)
    }
    return groups
  }, [ingredients])

  // ── Derived display values ───────────────────────────────────────────────────
  const catLabel   = recipe ? (CAT_DISPLAY[recipe.category] || recipe.category || 'Recipe') : ''
  const prepStr    = recipe ? formatTime(recipe.prep_time_minutes)  : null
  const cookStr    = recipe ? formatTime(recipe.cook_time_minutes)  : null
  const diffLabel  = recipe ? (DIFFICULTY[recipe.difficulty] || '—') : '—'
  const dietTags   = recipe?.diet ?? []
  const sageMsg    = recipe?.sage_assist_content || null
  const sagePreview = sageMsg ? sageMsg.slice(0, 60) + (sageMsg.length > 60 ? '…' : '') : null

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
        <TopBar slim leftAction={{ onClick: () => navigate(backTo), label: 'Back' }} />
        <div style={{ padding: '20px 22px' }}>
          <div className="shimmer-block" style={{ height: '220px', borderRadius: '16px', marginBottom: '12px' }} />
          <div className="shimmer-block" style={{ height: '160px', borderRadius: '16px', marginBottom: '12px' }} />
          <div className="shimmer-block" style={{ height: '44px', borderRadius: '10px' }} />
        </div>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: C.ink, marginBottom: '8px' }}>Recipe not found</div>
        <button onClick={() => navigate(backTo)} style={{ fontSize: '13px', color: C.sage, background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
      </div>
    )
  }

  return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: '170px', position: 'relative', overflowX: 'hidden',
    }}>

      <WatermarkLayer />

      <TopBar
        slim
        leftAction={{ onClick: () => navigate(backTo), label: 'Back' }}
        rightActions={[
          { label: favActive ? 'Unfavorite' : 'Favorite', onClick: toggleFav, icon: <span style={{ fontSize: '18px', color: favActive ? C.honey : 'rgba(210,230,200,0.55)' }}>{favActive ? '★' : '☆'}</span> },
        ]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div style={{
        margin: '14px 22px 0',
        height: '220px',
        borderRadius: '16px',
        background: recipe.photo_url
          ? `url(${recipe.photo_url}) center/cover no-repeat`
          : 'linear-gradient(150deg, #deebd8 0%, #b8d4ae 100%)',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(80,60,30,0.10)',
        animation: 'fadeUp 0.4s ease 0.05s both',
      }}>
        {!recipe.photo_url && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', opacity: 0.6 }}>
            {getCategoryEmoji(recipe.category)}
          </div>
        )}
        <div style={{
          position: 'absolute', bottom: '12px', left: '12px',
          background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)',
          borderRadius: '6px', padding: '4px 10px',
          fontSize: '10px', fontWeight: 500, letterSpacing: '2px',
          textTransform: 'uppercase', color: C.forest,
        }}>
          {catLabel}
        </div>
      </div>

      {/* ── Title Card ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'white', padding: '20px 22px 16px',
        margin: '12px 22px 0', borderRadius: '16px',
        border: '1px solid rgba(200,185,160,0.45)',
        boxShadow: '0 2px 8px rgba(80,60,30,0.07)',
        position: 'relative', zIndex: 1,
        animation: 'fadeUp 0.4s ease 0.10s both',
      }}>
        {/* Recipe name */}
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 500, color: C.ink, lineHeight: 1.2, marginBottom: '6px' }}>
          {recipe.name}
        </div>

        {/* Handwritten note */}
        {recipe.personal_notes && (
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: '15px', color: C.walnut, opacity: 0.85, marginBottom: '14px' }}>
            {recipe.personal_notes}
          </div>
        )}
        {!recipe.personal_notes && recipe.credited_to_name && (
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: '15px', color: C.walnut, opacity: 0.85, marginBottom: '14px' }}>
            {recipe.credited_to_name}'s recipe ✦
          </div>
        )}

        {/* 4-stat grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
          border: '1px solid rgba(200,185,160,0.55)', borderRadius: '12px',
          overflow: 'hidden', marginBottom: '14px',
        }}>
          {[
            { icon: '⏱', val: prepStr || '—', label: 'Prep' },
            { icon: '🔥', val: cookStr || '—', label: 'Cook' },
            { icon: '👥', val: recipe.servings || '—', label: 'Serves' },
            { icon: '📊', val: diffLabel, label: 'Level' },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              padding: '10px 6px', textAlign: 'center',
              borderRight: i < 3 ? '1px solid rgba(200,185,160,0.45)' : 'none',
            }}>
              <div style={{ fontSize: '13px', marginBottom: '2px' }}>{stat.icon}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: C.ink, fontWeight: 400 }}>{stat.val}</div>
              <div style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: C.driftwoodSm, fontWeight: 500 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Dietary tags */}
        {dietTags.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {dietTags.map(d => (
              <span key={d} style={{
                background: 'rgba(122,140,110,0.10)',
                border: '1px solid rgba(122,140,110,0.2)',
                color: C.forest, padding: '4px 10px',
                borderRadius: '20px', fontSize: '11px',
              }}>
                {DIET_LABELS[d] || d}
              </span>
            ))}
            {recipe.is_family_favorite && (
              <span style={{
                background: 'rgba(139,111,82,0.08)', border: '1px solid rgba(139,111,82,0.2)',
                color: C.walnut, padding: '4px 10px', borderRadius: '20px', fontSize: '11px',
              }}>
                Family Favourite
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Action Row ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 22px 0', position: 'relative', zIndex: 1 }}>
        <OutlineButton label="+ Add to Shopping List" onClick={() => {}} />
      </div>

      {/* ── Sage Strip ──────────────────────────────────────────────────────── */}
      {sageMsg && (
        <SageStrip
          preview={sagePreview}
          fullText={sageMsg}
          expanded={sageExpanded}
          onToggle={() => setSageExpanded(x => !x)}
        />
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        background: 'white', margin: '14px 22px 0',
        borderRadius: '12px', border: '1px solid rgba(200,185,160,0.45)',
        overflow: 'hidden',
        position: 'sticky', top: '58px', zIndex: 50,
        boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
      }}>
        {['ingredients', 'directions'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '14px', textAlign: 'center',
              fontFamily: "'Jost', sans-serif", fontSize: '12px',
              fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase',
              color: activeTab === tab ? C.forest : C.driftwoodSm,
              cursor: 'pointer', border: 'none', background: 'none',
              borderBottom: activeTab === tab ? `2px solid ${C.forest}` : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Panels ──────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Ingredients Panel */}
        {activeTab === 'ingredients' && (
          <div style={{ padding: '16px 22px', animation: 'panelFade 0.2s ease both' }}>

            {/* Serves adjuster */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'white', border: '1px solid rgba(200,185,160,0.55)',
              borderRadius: '10px', padding: '12px 16px', marginBottom: '18px',
              boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
            }}>
              <span style={{ fontSize: '13px', color: C.driftwood }}>Serves</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button onClick={() => adjustServes(-1)} style={STYLES.servesBtn}>−</button>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', color: C.ink, minWidth: '24px', textAlign: 'center' }}>
                  {serves}
                </span>
                <button onClick={() => adjustServes(1)} style={STYLES.servesBtn}>+</button>
              </div>
            </div>

            {/* Ingredient groups */}
            {groupedIngredients.map(({ section, items }) => (
              <div key={section || '__default'} style={{ marginBottom: '20px' }}>
                {section && (
                  <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.sage, marginBottom: '8px' }}>
                    {section}
                  </div>
                )}
                {items.map((ing, idx) => {
                  const isChecked = checked.has(ing.id)
                  const scaledQty = scaleQty(ing.quantity, scale)
                  const amountStr = [scaledQty, ing.unit].filter(Boolean).join(' ')
                  const nameStr   = [ing.name, ing.preparation_note].filter(Boolean).join(', ')
                  return (
                    <div
                      key={ing.id}
                      onClick={() => toggleChecked(ing.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '11px 0',
                        borderBottom: idx < items.length - 1 ? '1px solid rgba(200,185,160,0.4)' : 'none',
                        cursor: 'pointer',
                        opacity: isChecked ? 0.7 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '6px',
                        border: isChecked ? 'none' : '1.5px solid rgba(200,185,160,0.7)',
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isChecked ? C.sage : 'white',
                        fontSize: '12px', color: 'white',
                        animation: isChecked ? 'checkPulse 0.2s ease' : 'none',
                        transition: 'background 0.15s, border-color 0.15s',
                      }}>
                        {isChecked ? '✓' : ''}
                      </div>
                      {amountStr && (
                        <div style={{ fontSize: '13px', fontWeight: 500, color: C.forest, minWidth: '58px', flexShrink: 0 }}>
                          {amountStr}
                        </div>
                      )}
                      <div style={{
                        fontSize: '14px', color: isChecked ? C.linen : C.ink,
                        lineHeight: 1.4,
                        textDecoration: isChecked ? 'line-through' : 'none',
                        transition: 'color 0.15s',
                      }}>
                        {nameStr}
                        {ing.is_optional && <span style={{ fontSize: '11px', color: C.driftwoodSm, marginLeft: '6px' }}>(optional)</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            {ingredients.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: C.driftwood, fontSize: '13px', fontStyle: 'italic' }}>
                No ingredients listed yet.
              </div>
            )}
          </div>
        )}

        {/* Directions Panel */}
        {activeTab === 'directions' && (
          <div style={{ padding: '16px 22px', animation: 'panelFade 0.2s ease both' }}>

            {instructions.map((step, i) => {
              const state = stepStates[step.id] || 'idle'
              return (
                <div
                  key={step.id}
                  onClick={() => cycleStep(step.id)}
                  style={{
                    background: state === 'active' ? '#f4f8f3' : 'white',
                    border: state === 'active'
                      ? `1px solid ${C.sage}`
                      : '1px solid rgba(200,185,160,0.55)',
                    borderRadius: '14px', padding: '16px', marginBottom: '12px',
                    cursor: 'pointer',
                    opacity: state === 'completing' ? 0.15 : state === 'done' ? 0.48 : 1,
                    transition: 'opacity 0.18s ease, border-color 0.2s, background 0.2s',
                    boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div style={{
                      fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 400,
                      color: state === 'active' ? C.sage : C.linen, lineHeight: 1, flexShrink: 0,
                    }}>
                      {String(step.step_number).padStart(2, '0')}
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        border: state === 'done' ? 'none' : '1.5px solid rgba(200,185,160,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px',
                        background: state === 'done' ? C.sage : C.cream,
                        color: state === 'done' ? 'white' : 'transparent',
                        transition: 'all 0.15s',
                      }}>
                        ✓
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', color: C.ink, lineHeight: 1.75, fontWeight: 300 }}>
                    {step.instruction}
                  </div>
                  {step.tip && (
                    <em style={{
                      display: 'block', marginTop: '10px',
                      fontSize: '13px', color: C.walnut,
                      fontStyle: 'italic', fontFamily: "'Playfair Display', serif",
                      padding: '8px 12px',
                      background: 'rgba(139,111,82,0.06)',
                      borderRadius: '8px', borderLeft: '2px solid rgba(139,111,82,0.3)',
                      lineHeight: 1.5,
                    }}>
                      {step.tip}
                    </em>
                  )}
                </div>
              )
            })}

            {instructions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: C.driftwood, fontSize: '13px', fontStyle: 'italic' }}>
                No directions listed yet.
              </div>
            )}

            {/* Family Notes */}
            {recipe.personal_notes && (
              <div style={{
                background: 'white', border: '1px solid rgba(200,185,160,0.55)',
                borderRadius: '14px', padding: '16px', marginBottom: '12px',
                boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
              }}>
                <div style={{ fontFamily: "'Caveat', cursive", fontSize: '20px', color: C.walnut, marginBottom: '12px' }}>
                  Family Notes
                </div>
                <div style={{
                  padding: '8px 0', fontSize: '13px', color: C.driftwood,
                  lineHeight: 1.65, display: 'flex', gap: '8px',
                }}>
                  <span style={{ color: C.honey, flexShrink: 0 }}>★</span>
                  {recipe.personal_notes}
                </div>
              </div>
            )}

            {/* Goes Well With */}
            {related.length > 0 && (
              <div style={{ marginTop: '4px', marginBottom: '8px' }}>
                <div style={{
                  fontSize: '10px', fontWeight: 500, letterSpacing: '2px',
                  textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '10px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  Goes Well With
                  <span style={{ flex: 1, height: '1px', background: 'rgba(200,185,160,0.5)', display: 'inline-block' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {related.map(rel => {
                    const relCat  = CAT_DISPLAY[rel.category] || rel.category || 'Recipe'
                    const relTime = formatTime(rel.total_time_minutes || (rel.prep_time_minutes || 0) + (rel.cook_time_minutes || 0))
                    return (
                      <div
                        key={rel.id}
                        onClick={() => navigate(`/recipe/${rel.id}`, { state: { from: `/recipe/${id}` } })}
                        style={{
                          background: 'white', border: '1px solid rgba(200,185,160,0.55)',
                          borderRadius: '12px', padding: '14px',
                          display: 'flex', alignItems: 'center', gap: '12px',
                          cursor: 'pointer', boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
                          transition: 'transform 0.15s',
                        }}
                      >
                        <div style={{ fontSize: '24px', width: '40px', textAlign: 'center', flexShrink: 0 }}>
                          {getCategoryEmoji(rel.category)}
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', color: C.ink, marginBottom: '2px' }}>
                            {rel.name}
                          </div>
                          <div style={{ fontSize: '11px', color: C.driftwoodSm }}>
                            {[relTime, relCat].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        <div style={{ marginLeft: 'auto', color: C.linen, fontSize: '16px' }}>›</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Week picker overlay ──────────────────────────────────────────────── */}
      {weekPickerOpen && (
        <div
          onClick={closeWeekPicker}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(44,36,23,0.45)',
            zIndex: 200,
            opacity: weekPickerOverlay ? 1 : 0,
            transition: 'opacity 0.25s ease',
          }}
        />
      )}

      {/* ── Pinned CTA ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px',
        padding: '10px 22px 12px', zIndex: 90,
        background: C.cream, borderTop: `1px solid ${C.linen}`,
        boxShadow: '0 -2px 12px rgba(80,60,30,0.08)',
      }}>
        <button
          onClick={() => setPlanSheetOpen(true)}
          style={{
            width: '100%', background: C.forest, color: 'white', border: 'none',
            borderRadius: '12px', padding: '14px',
            fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
            letterSpacing: '0.5px', cursor: 'pointer',
            boxShadow: '0 2px 10px rgba(61,107,79,0.28)',
            transition: 'background 0.15s',
            animation: 'ctaSettle 0.35s ease-out 0.3s both',
          }}
        >
          Add to Plan
        </button>
      </div>

      {/* ── Add to Plan Sheet ──────────────────────────────────────────────── */}
      <AddToPlanSheet
        open={planSheetOpen}
        onClose={() => setPlanSheetOpen(false)}
        meal={{ id: recipe?.id, name: recipe?.name }}
        appUser={appUser}
        onSuccess={() => setPlanSheetOpen(false)}
        itemType="recipe"
      />

      {/* ── Bottom Nav ────────────────────────────────────────────────────── */}
      <BottomNav activeTab="meals" />

    </div>
  )
}

// ── Sage Strip ─────────────────────────────────────────────────────────────────
function SageStrip({ preview, fullText, expanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        background: C.forest, margin: '14px 22px',
        borderRadius: '14px', padding: '14px 16px',
        display: 'flex', gap: '12px', alignItems: 'flex-start',
        boxShadow: '0 3px 12px rgba(61,107,79,0.2)',
        position: 'relative', zIndex: 1,
        cursor: 'pointer',
        animation: 'fadeUp 0.4s ease 0.08s both',
      }}
    >
      {/* Sparkle icon */}
      <div style={{ fontSize: '18px', flexShrink: 0, marginTop: '2px', color: 'rgba(188,218,178,0.9)' }}>✦</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Label row */}
        <div style={{
          fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase',
          color: 'rgba(188,218,178,0.75)', fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className="sage-pulse-dot" style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'rgba(188,218,178,0.75)', flexShrink: 0 }} />
            Sage
          </div>
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              width: '13px', height: '13px', color: 'rgba(188,218,178,0.6)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.28s ease', flexShrink: 0,
            }}
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>

        {/* Preview (collapsed) */}
        {!expanded && (
          <div style={{
            fontSize: '13px', color: 'rgba(255,255,255,0.7)', fontWeight: 300,
            marginTop: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {preview}
          </div>
        )}

        {/* Expanded body */}
        <div style={{
          maxHeight: expanded ? '100px' : '0',
          overflow: 'hidden',
          opacity: expanded ? 1 : 0,
          transition: 'max-height 0.35s ease, opacity 0.25s ease',
        }}>
          <p style={{
            fontFamily: "'Playfair Display', serif", fontSize: '14px',
            fontStyle: 'italic', color: 'rgba(255,255,255,0.92)',
            lineHeight: 1.55, marginTop: '8px',
          }}>
            {fullText}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Week Day Picker Sheet ──────────────────────────────────────────────────────
function WeekDayPickerSheet({ isOpen, overlayVisible, recipe, appUser, onClose }) {
  const [adding, setAdding] = useState(null)
  const [added,  setAdded]  = useState(null)

  useEffect(() => {
    if (!isOpen) setTimeout(() => { setAdded(null); setAdding(null) }, 320)
  }, [isOpen])

  async function addToDay(dayLabel, dowKey) {
    if (adding) return
    setAdding(dayLabel)
    try {
      const today   = new Date()
      const jsDay   = today.getDay()
      const diff    = jsDay === 0 ? -6 : 1 - jsDay
      const mon     = new Date(today)
      mon.setDate(today.getDate() + diff)
      const weekStart = toLocalDateStr(mon)

      const { data: plan } = await supabase
        .from('meal_plans')
        .select('id')
        .eq('household_id', appUser.household_id)
        .eq('week_start_date', weekStart)
        .maybeSingle()

      if (!plan) { setAdded('no-plan'); return }

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
      console.error('Add to week error:', err)
      setAdded('error')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%',
      transform: isOpen ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
      width: '100%', maxWidth: '430px',
      background: 'white', borderRadius: '20px 20px 0 0',
      padding: '0 0 40px', zIndex: 201,
      transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
      boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
    }}>
      {/* Handle */}
      <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />

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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: C.ink, marginBottom: '8px' }}>No plan for this week yet.</div>
            <div style={{ fontSize: '13px', color: C.driftwood }}>Visit This Week to start planning.</div>
          </div>
        ) : added === 'error' ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: '13px', color: '#A03030' }}>Something went wrong. Try again.</div>
        ) : added ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: C.forest, marginBottom: '4px' }}>Added to {added} ✓</div>
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
                  fontFamily: "'Jost', sans-serif", fontSize: '14px', color: C.ink, fontWeight: 400,
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
    </div>
  )
}

// ── Small reusable components ──────────────────────────────────────────────────
function OutlineButton({ label, onClick }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        width: '100%', background: pressed ? 'rgba(200,185,160,0.15)' : 'none',
        color: C.ink, border: '1px solid rgba(200,185,160,0.7)',
        borderRadius: '10px', padding: '13px',
        fontFamily: "'Jost', sans-serif", fontSize: '12px', cursor: 'pointer',
        transition: 'background 0.15s', letterSpacing: '0.3px',
      }}
    >
      {label}
    </button>
  )
}

function BackArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <path d="m15 18-6-6 6-6"/>
    </svg>
  )
}

// ── Category emoji helper ──────────────────────────────────────────────────────
function getCategoryEmoji(cat) {
  const map = {
    main: '🍽️', pasta: '🍝', soup: '🍲', dessert: '🍰',
    bread: '🍞', sauce: '🫙', appetizer: '🥗',
    breakfast: '🍳', lunch: '🥪', salad: '🥗', side: '🥦',
  }
  return map[cat] || '🍴'
}

// ── Shared inline style objects ────────────────────────────────────────────────
const STYLES = {
  backBtn: {
    width: '36px', height: '36px', borderRadius: '50%',
    border: 'none', background: 'rgba(255,255,255,0.14)',
    color: 'rgba(250,247,242,0.9)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
    transition: 'background 0.15s',
  },
  iconBtn: {
    width: '36px', height: '36px', borderRadius: '50%',
    border: 'none', background: 'rgba(255,255,255,0.14)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
    transition: 'background 0.15s',
  },
  servesBtn: {
    width: '30px', height: '30px', borderRadius: '50%',
    border: '1px solid rgba(200,185,160,0.6)',
    background: '#FAF7F2', cursor: 'pointer',
    fontSize: '16px', color: '#2C2417',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}
