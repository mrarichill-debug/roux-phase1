/**
 * RecipeCard.jsx — Recipe detail screen.
 * The most important screen in the app.
 */
import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import AddToPlanSheet from '../components/AddToPlanSheet'

const C = {
  forest: '#3D6B4F', sage: '#7A8C6E', honey: '#C49A3C',
  cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E',
  linen: '#E8E0D0', walnut: '#8B6F52',
}

const DIET_LABELS = {
  gluten_free: 'Gluten Free', dairy_free: 'Dairy Free',
  vegetarian: 'Vegetarian', vegan: 'Vegan',
  nut_free: 'Nut Free', egg_free: 'Egg Free',
}

const DIFFICULTY = { easy: 'Easy', medium: 'Med', advanced: 'Adv' }

// ── Quantity helpers ────────────────────────────────────────────────────────
const UNICODE_FRAC = { '½':1/2,'¼':1/4,'¾':3/4,'⅓':1/3,'⅔':2/3,'⅛':1/8,'⅜':3/8,'⅝':5/8,'⅞':7/8 }
const NICE_FRAC = [[1/8,'⅛'],[1/4,'¼'],[1/3,'⅓'],[3/8,'⅜'],[1/2,'½'],[5/8,'⅝'],[2/3,'⅔'],[3/4,'¾'],[7/8,'⅞']]

function parseQty(str) {
  if (!str) return null
  let s = str.trim(), val = 0
  for (const [ch, num] of Object.entries(UNICODE_FRAC)) { if (s.includes(ch)) { val += num; s = s.replace(ch, '').trim(); break } }
  if (s) { if (s.includes('/')) { const [n,d] = s.split('/').map(x => parseFloat(x.trim())); if (!isNaN(n) && !isNaN(d) && d !== 0) val += n/d; else return null } else { const n = parseFloat(s); if (!isNaN(n)) val += n; else return null } }
  return val > 0 ? val : null
}
function formatQtyNice(n) {
  if (!n || n <= 0) return '0'
  const whole = Math.floor(n), frac = n - whole
  if (frac < 0.04) return `${whole || 0}`
  if (frac > 0.96) return `${whole + 1}`
  let bestStr = '', bestDiff = Infinity
  for (const [val, str] of NICE_FRAC) { const diff = Math.abs(frac - val); if (diff < bestDiff) { bestDiff = diff; bestStr = str } }
  return whole > 0 ? `${whole}${bestStr}` : bestStr
}
function scaleQty(qtyStr, scale) {
  if (!qtyStr || scale === 1) return qtyStr
  const val = parseQty(qtyStr); return val === null ? qtyStr : (formatQtyNice(val * scale) || qtyStr)
}
function formatTime(m) { if (!m) return null; if (m < 60) return `${m}m`; const h = Math.floor(m/60); const r = m%60; return r ? `${h}h ${r}m` : `${h}h` }
function displayCategory(cat) { return cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : null }

// ── SVG Icons ───────────────────────────────────────────────────────────────
const ClockIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
const FlameIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
const PeopleIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const SignalIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><rect x="4" y="14" width="4" height="6" rx="1"/><rect x="10" y="10" width="4" height="10" rx="1"/><rect x="16" y="6" width="4" height="14" rx="1"/></svg>

// ── Main ────────────────────────────────────────────────────────────────────
export default function RecipeCard({ appUser }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const backTo = location.state?.from || '/meals/recipes'

  const [recipe, setRecipe] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [instructions, setInstructions] = useState([])
  const [loading, setLoading] = useState(true)

  const [activeTab, setActiveTab] = useState('ingredients')
  const [serves, setServes] = useState(4)
  const [baseServes, setBaseServes] = useState(4)
  const [checked, setChecked] = useState(new Set())
  const [stepStates, setStepStates] = useState({})
  const [favActive, setFavActive] = useState(false)
  const [planSheetOpen, setPlanSheetOpen] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  useEffect(() => { if (id) fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const [recipeRes, ingRes, insRes] = await Promise.all([
      supabase.from('recipes').select(`
        id, name, description, category, cuisine, method, difficulty,
        prep_time_minutes, cook_time_minutes, total_time_minutes,
        servings, is_family_favorite, diet, personal_notes, variations,
        credited_to_name, author, photo_url, sage_assist_content,
        household_id, times_planned, times_cooked
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
    }
    setIngredients(ingRes.data ?? [])
    setInstructions(insRes.data ?? [])
    setLoading(false)
  }

  async function toggleFav() { const next = !favActive; setFavActive(next); await supabase.from('recipes').update({ is_family_favorite: next }).eq('id', id) }
  const scale = baseServes > 0 ? serves / baseServes : 1
  function adjustServes(d) { setServes(prev => Math.max(1, Math.min(24, prev + d))) }
  function toggleChecked(ingId) { setChecked(prev => { const n = new Set(prev); n.has(ingId) ? n.delete(ingId) : n.add(ingId); return n }) }
  function cycleStep(stepId) {
    const s = stepStates[stepId] || 'idle'
    if (s === 'idle') setStepStates(p => ({ ...p, [stepId]: 'active' }))
    else if (s === 'active') { setStepStates(p => ({ ...p, [stepId]: 'completing' })); setTimeout(() => setStepStates(p => ({ ...p, [stepId]: 'done' })), 180) }
    else if (s === 'done') setStepStates(p => ({ ...p, [stepId]: 'idle' }))
  }

  const groupedIngredients = useMemo(() => {
    const groups = [], seen = {}
    for (const ing of ingredients) { const k = ing.section_name || ''; if (!seen[k]) { seen[k] = []; groups.push({ section: ing.section_name || null, items: seen[k] }) }; seen[k].push(ing) }
    return groups
  }, [ingredients])

  const prepStr = recipe ? formatTime(recipe.prep_time_minutes) : null
  const cookStr = recipe ? formatTime(recipe.cook_time_minutes) : null
  const diffLabel = recipe ? (DIFFICULTY[recipe.difficulty] || '—') : '—'
  const catLabel = recipe ? displayCategory(recipe.category) : null
  const attribution = recipe?.author || recipe?.credited_to_name || null
  const hasHistory = recipe && ((recipe.times_planned || 0) > 0 || (recipe.times_cooked || 0) > 0)

  if (loading) return (
    <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
      <TopBar slim leftAction={{ onClick: () => navigate(backTo), label: 'Back' }} />
      <div style={{ padding: '20px 22px' }}>
        <div className="shimmer-block" style={{ height: '220px', borderRadius: '16px', marginBottom: '12px' }} />
        <div className="shimmer-block" style={{ height: '120px', borderRadius: '16px', marginBottom: '12px' }} />
        <div className="shimmer-block" style={{ height: '44px', borderRadius: '10px' }} />
      </div>
    </div>
  )

  if (!recipe) return (
    <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: C.ink, marginBottom: '8px' }}>Recipe not found</div>
      <button onClick={() => navigate(backTo)} style={{ fontSize: '13px', color: C.sage, background: 'none', border: 'none', cursor: 'pointer' }}>← Back</button>
    </div>
  )

  return (
    <div style={{ background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 8px))' }}>

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      <TopBar slim
        leftAction={{ onClick: () => navigate(backTo), label: 'Back' }}
        rightActions={[
          { label: 'Add to Plan', onClick: () => setPlanSheetOpen(true), icon: <svg viewBox="0 0 24 24" fill="none" stroke="rgba(210,230,200,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg> },
          { label: favActive ? 'Unfavorite' : 'Favorite', onClick: toggleFav, icon: <span style={{ fontSize: '18px', color: favActive ? C.honey : 'rgba(210,230,200,0.55)' }}>{favActive ? '★' : '☆'}</span> },
        ]}
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      {recipe.photo_url ? (
        <div style={{
          width: '100%', height: '220px',
          background: `url(${recipe.photo_url}) center/cover no-repeat`,
          position: 'relative', overflow: 'hidden',
          animation: 'fadeUp 0.4s ease 0.05s both',
        }}>
          {/* Dark gradient for pill readability */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(transparent, rgba(0,0,0,0.25))' }} />
          {catLabel && (
            <div style={{
              position: 'absolute', bottom: '12px', left: '14px',
              background: 'rgba(255,255,255,0.85)', border: 'none',
              borderRadius: '4px', padding: '3px 8px',
              fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px',
              textTransform: 'uppercase', color: C.driftwoodSm,
            }}>
              {catLabel}
            </div>
          )}
        </div>
      ) : (
        catLabel && (
          <div style={{
            height: '44px', display: 'flex', alignItems: 'center',
            padding: '0 22px', borderBottom: '0.5px solid #E4DDD2',
          }}>
            <div style={{
              background: 'transparent', border: '0.5px solid #C4B8A8',
              borderRadius: '4px', padding: '3px 8px',
              fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px',
              textTransform: 'uppercase', color: C.driftwood,
            }}>
              {catLabel}
            </div>
          </div>
        )
      )}

      {/* ── Header Card ───────────────────────────────────────────────── */}
      <div style={{ padding: '20px 22px 0', animation: 'fadeUp 0.4s ease 0.10s both' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500, color: C.ink, lineHeight: 1.25, marginBottom: '4px' }}>
          {recipe.name}
        </div>
        {attribution && (
          <div style={{ fontSize: '12px', color: C.driftwood, fontWeight: 300, marginBottom: '4px' }}>
            By {attribution}
          </div>
        )}
        {recipe.description && (
          <div style={{ fontSize: '13px', color: C.driftwood, fontWeight: 300, lineHeight: 1.5, marginBottom: '4px' }}>
            {descExpanded || recipe.description.length <= 100 ? recipe.description : (
              <>
                {recipe.description.slice(0, 100)}…{' '}
                <button onClick={() => setDescExpanded(true)} style={{ background: 'none', border: 'none', color: C.forest, cursor: 'pointer', fontSize: '12px', padding: 0, fontFamily: "'Jost', sans-serif" }}>more</button>
              </>
            )}
          </div>
        )}

        {/* Dietary tags */}
        {(recipe.diet?.length > 0) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {recipe.diet.map(d => (
              <span key={d} style={{ background: 'transparent', border: '0.5px solid #C4B8A8', color: C.driftwood, padding: '2px 8px', borderRadius: '10px', fontSize: '10px' }}>
                {DIET_LABELS[d] || d}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Stat Row ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0',
        margin: '16px 22px 0', background: 'white',
        border: '1px solid rgba(200,185,160,0.45)', borderRadius: '12px',
        overflow: 'hidden', animation: 'fadeUp 0.4s ease 0.14s both',
      }}>
        {[
          { icon: <ClockIcon />, val: prepStr || '—', label: 'Prep' },
          { icon: <FlameIcon />, val: cookStr || '—', label: 'Cook' },
          { icon: <PeopleIcon />, val: recipe.servings || '—', label: 'Serves' },
          { icon: <SignalIcon />, val: diffLabel, label: 'Level' },
        ].map((stat, i) => (
          <div key={stat.label} style={{
            padding: '12px 6px', textAlign: 'center',
            borderRight: i < 3 ? '1px solid rgba(200,185,160,0.35)' : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>{stat.icon}</div>
            <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '15px', color: C.ink, fontWeight: 400 }}>{stat.val}</div>
            <div style={{ fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 300 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Action Row ────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 22px 0' }}>
        <button onClick={() => {}} style={{
          width: '100%', background: 'none', color: C.ink,
          border: '1px solid rgba(200,185,160,0.6)', borderRadius: '10px',
          padding: '12px', fontFamily: "'Jost', sans-serif", fontSize: '12px',
          cursor: 'pointer', letterSpacing: '0.3px',
        }}>
          + Add to Shopping List
        </button>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        margin: '16px 22px 0', position: 'sticky', top: '58px', zIndex: 50,
        background: C.cream,
      }}>
        {['ingredients', 'directions'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '14px', textAlign: 'center',
            fontFamily: "'Jost', sans-serif", fontSize: '12px',
            fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase',
            color: activeTab === tab ? C.forest : C.driftwood,
            cursor: 'pointer', border: 'none', background: 'none',
            borderBottom: activeTab === tab ? `2px solid ${C.forest}` : '2px solid transparent',
            transition: 'color 0.2s cubic-bezier(0.22,1,0.36,1), border-color 0.2s cubic-bezier(0.22,1,0.36,1)',
          }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Panels ────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1 }}>

        {activeTab === 'ingredients' && (
          <div style={{ padding: '16px 22px', animation: 'panelFade 0.2s ease both' }}>
            {/* Serves adjuster */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'white', border: '1px solid rgba(200,185,160,0.55)',
              borderRadius: '10px', padding: '12px 16px', marginBottom: '18px',
            }}>
              <span style={{ fontSize: '13px', color: C.driftwood }}>Serves</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button onClick={() => adjustServes(-1)} style={servesBtn}>−</button>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', color: C.ink, minWidth: '24px', textAlign: 'center' }}>{serves}</span>
                <button onClick={() => adjustServes(1)} style={servesBtn}>+</button>
              </div>
            </div>

            {groupedIngredients.map(({ section, items }) => (
              <div key={section || '__default'} style={{ marginBottom: '20px' }}>
                {section && <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.sage, marginBottom: '8px' }}>{section}</div>}
                {items.map((ing, idx) => {
                  const isChecked = checked.has(ing.id)
                  const scaledQty = scaleQty(ing.quantity, scale)
                  const amountStr = [scaledQty, ing.unit].filter(Boolean).join(' ')
                  const nameStr = [ing.name, ing.preparation_note].filter(Boolean).join(', ')
                  return (
                    <div key={ing.id} onClick={() => toggleChecked(ing.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '11px 0', borderBottom: idx < items.length - 1 ? '1px solid rgba(200,185,160,0.4)' : 'none',
                      cursor: 'pointer', opacity: isChecked ? 0.7 : 1, transition: 'opacity 0.15s',
                    }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '6px',
                        border: isChecked ? 'none' : '1.5px solid rgba(200,185,160,0.7)',
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isChecked ? C.sage : 'white', fontSize: '12px', color: 'white',
                        animation: isChecked ? 'checkPulse 0.2s ease' : 'none',
                        transition: 'background 0.15s, transform 0.1s',
                      }}>
                        {isChecked ? '✓' : ''}
                      </div>
                      {amountStr && <div style={{ fontSize: '13px', fontWeight: 500, color: C.forest, minWidth: '58px', flexShrink: 0 }}>{amountStr}</div>}
                      <div style={{ fontSize: '14px', color: isChecked ? C.linen : C.ink, lineHeight: 1.4, textDecoration: isChecked ? 'line-through' : 'none', transition: 'color 0.15s' }}>
                        {nameStr}
                        {ing.is_optional && <span style={{ fontSize: '11px', color: C.driftwoodSm, marginLeft: '6px' }}>(optional)</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
            {ingredients.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: C.driftwood, fontSize: '13px', fontStyle: 'italic' }}>No ingredients listed yet.</div>}
          </div>
        )}

        {activeTab === 'directions' && (
          <div style={{ padding: '16px 22px', animation: 'panelFade 0.2s ease both' }}>
            {instructions.map(step => {
              const state = stepStates[step.id] || 'idle'
              return (
                <div key={step.id} onClick={() => cycleStep(step.id)} style={{
                  display: 'flex', gap: '14px', padding: '14px 0',
                  borderBottom: '1px solid rgba(200,185,160,0.3)',
                  cursor: 'pointer', opacity: state === 'completing' ? 0.15 : state === 'done' ? 0.48 : 1,
                  transition: 'opacity 0.18s ease',
                }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 400, color: C.forest, flexShrink: 0, minWidth: '28px' }}>
                    {step.step_number}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: C.ink, lineHeight: 1.7, fontWeight: 300 }}>{step.instruction}</div>
                    {step.tip && (
                      <div style={{ marginTop: '8px', fontSize: '13px', color: C.walnut, fontStyle: 'italic', fontFamily: "'Playfair Display', serif", padding: '8px 12px', background: 'rgba(139,111,82,0.06)', borderRadius: '8px', borderLeft: `2px solid rgba(139,111,82,0.3)`, lineHeight: 1.5 }}>
                        {step.tip}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {instructions.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: C.driftwood, fontSize: '13px', fontStyle: 'italic' }}>No directions listed yet.</div>}
          </div>
        )}
      </div>

      {/* ── Additional sections (below tabs) ──────────────────────────── */}
      <div style={{ padding: '0 22px 20px' }}>
        {/* Personal notes */}
        {recipe.personal_notes && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: '18px', color: C.walnut, marginBottom: '6px' }}>My notes</div>
            <div style={{ fontSize: '13px', color: C.driftwood, lineHeight: 1.6 }}>{recipe.personal_notes}</div>
          </div>
        )}

        {/* Variations */}
        {recipe.variations && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '6px' }}>Variations</div>
            <div style={{ fontSize: '13px', color: C.driftwood, lineHeight: 1.6 }}>{recipe.variations}</div>
          </div>
        )}

        {/* Recipe history */}
        {hasHistory && (
          <div style={{ marginTop: '16px', fontSize: '11px', color: C.driftwood, fontWeight: 300 }}>
            {[
              recipe.times_planned > 0 && `Planned ${recipe.times_planned} time${recipe.times_planned !== 1 ? 's' : ''}`,
              recipe.times_cooked > 0 && `Cooked ${recipe.times_cooked} time${recipe.times_cooked !== 1 ? 's' : ''}`,
            ].filter(Boolean).join(' · ')}
          </div>
        )}

        {/* Edit link */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <button onClick={() => navigate(`/recipe/${id}/edit`)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: "'Jost', sans-serif", fontSize: '13px',
            color: C.forest, fontWeight: 300,
          }}>
            Edit recipe
          </button>
        </div>
      </div>

      <AddToPlanSheet
        open={planSheetOpen}
        onClose={() => setPlanSheetOpen(false)}
        meal={{ id: recipe?.id, name: recipe?.name }}
        appUser={appUser}
        onSuccess={() => setPlanSheetOpen(false)}
        itemType="recipe"
      />

      <BottomNav activeTab="meals" />
    </div>
  )
}

const servesBtn = {
  width: '30px', height: '30px', borderRadius: '50%',
  border: '1px solid rgba(200,185,160,0.6)',
  background: '#FAF7F2', cursor: 'pointer',
  fontSize: '16px', color: '#2C2417',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
