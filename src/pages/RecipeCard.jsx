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
  const [sageSheetOpen, setSageSheetOpen] = useState(false)
  const [recipePhotos, setRecipePhotos] = useState([])
  const [lightboxPhoto, setLightboxPhoto] = useState(null)
  const [recipeTags, setRecipeTags] = useState([])
  const [ingAlts, setIngAlts] = useState({}) // { ingredientId: [alt, ...] }
  const [expandedAlts, setExpandedAlts] = useState(new Set())

  useEffect(() => { if (id) fetchAll() }, [id])

  async function fetchAll() {
    setLoading(true)
    const [recipeRes, ingRes, insRes, photosRes] = await Promise.all([
      supabase.from('recipes').select(`
        id, name, description, category, cuisine, method, difficulty,
        prep_time_minutes, cook_time_minutes, total_time_minutes,
        servings, is_family_favorite, diet, personal_notes, variations,
        credited_to_name, author, photo_url,
        sage_assist_content, sage_assist_status,
        household_id, times_planned, times_cooked
      `).eq('id', id).single(),
      supabase.from('ingredients').select('*').eq('recipe_id', id).order('sort_order'),
      supabase.from('instructions').select('*').eq('recipe_id', id).order('step_number'),
      supabase.from('recipe_photos').select('*').eq('recipe_id', id).order('sort_order'),
    ])
    const rec = recipeRes.data
    if (rec) {
      setRecipe(rec)
      setFavActive(rec.is_family_favorite)
      const parsed = parseInt(rec.servings)
      if (!isNaN(parsed) && parsed > 0) { setServes(parsed); setBaseServes(parsed) }
    }
    // Fetch recipe tags
    const { data: tagJoins } = await supabase.from('recipe_tags').select('tag_id, recipe_tag_definitions(name)').eq('recipe_id', id)
    setRecipeTags((tagJoins || []).map(t => t.recipe_tag_definitions?.name).filter(Boolean))

    const ings = ingRes.data ?? []
    setIngredients(ings)
    setInstructions(insRes.data ?? [])
    setRecipePhotos(photosRes.data ?? [])
    // Fetch ingredient alternatives
    const ingIds = ings.map(i => i.id)
    if (ingIds.length > 0) {
      const { data: altsData } = await supabase.from('ingredient_alternatives').select('*').in('primary_ingredient_id', ingIds).order('sort_order')
      const grouped = {}
      for (const alt of (altsData || [])) {
        if (!grouped[alt.primary_ingredient_id]) grouped[alt.primary_ingredient_id] = []
        grouped[alt.primary_ingredient_id].push(alt)
      }
      setIngAlts(grouped)
    }
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
  const primaryPhoto = recipePhotos.find(p => p.is_primary)
  const heroUrl = primaryPhoto?.url || recipe?.photo_url || null

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
    <div style={{ background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 8px))' }}>

      {/* ── Topbar ────────────────────────────────────────────────────── */}
      <TopBar slim
        leftAction={{ onClick: () => navigate(backTo), label: 'Back' }}
        rightActions={[
          { label: 'Add to Plan', onClick: () => setPlanSheetOpen(true), icon: <svg viewBox="0 0 24 24" fill="none" stroke="rgba(210,230,200,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg> },
          { label: favActive ? 'Unfavorite' : 'Favorite', onClick: toggleFav, icon: <span style={{ fontSize: '18px', color: favActive ? C.honey : 'rgba(210,230,200,0.55)' }}>{favActive ? '★' : '☆'}</span> },
        ]}
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      {heroUrl ? (
        <div style={{
          width: '100%', height: '220px',
          background: `url(${heroUrl}) center/cover no-repeat`,
          position: 'relative', overflow: 'hidden',
          animation: 'fadeUp 0.4s ease 0.05s both',
        }}>
          {/* Dark gradient for pill readability */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(transparent, rgba(0,0,0,0.25))' }} />
          {recipeTags.length > 0 && (
            <div style={{ position: 'absolute', bottom: '10px', left: '14px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {recipeTags.map(tag => (
                <div key={tag} style={{
                  background: 'rgba(255,255,255,0.85)', border: 'none',
                  borderRadius: '4px', padding: '3px 8px',
                  fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px',
                  textTransform: 'uppercase', color: C.driftwoodSm,
                }}>{tag}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        recipeTags.length > 0 && (
          <div style={{
            minHeight: '44px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap',
            padding: '8px 22px', borderBottom: '0.5px solid #E4DDD2',
          }}>
            {recipeTags.map(tag => (
              <div key={tag} style={{
                background: 'transparent', border: '0.5px solid #C4B8A8',
                borderRadius: '4px', padding: '3px 8px',
                fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px',
                textTransform: 'uppercase', color: C.driftwood,
              }}>{tag}</div>
            ))}
          </div>
        )
      )}

      {/* ── Photo Strip (secondary photos) ──────────────────────────── */}
      {recipePhotos.length > 1 && (
        <div style={{
          padding: '10px 22px 0', display: 'flex', gap: '8px',
          overflowX: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          {recipePhotos.filter(p => !p.is_primary).map(photo => (
            <button key={photo.id} onClick={() => setLightboxPhoto(photo.url)} style={{
              flexShrink: 0, width: '64px', height: '64px', borderRadius: '8px',
              overflow: 'hidden', border: `1px solid ${C.linen}`,
              padding: 0, cursor: 'pointer', background: 'none',
            }}>
              <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </button>
          ))}
        </div>
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

        {/* Sage ingredient nudge */}
        {recipe.sage_assist_status === 'pending' && (
          <button onClick={() => setSageSheetOpen(true)} style={{
            display: 'block', marginTop: '10px', padding: 0,
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: "'Jost', sans-serif", fontSize: '12px',
            fontWeight: 300, color: C.honey, textAlign: 'left',
          }}>
            Sage has a suggestion or two about your ingredients →
          </button>
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
              borderRadius: '10px', padding: '12px 16px', marginBottom: '4px',
            }}>
              <span style={{ fontSize: '13px', color: C.driftwood }}>Serves</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button onClick={() => adjustServes(-1)} style={servesBtn}>−</button>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', color: C.ink, minWidth: '24px', textAlign: 'center' }}>{serves}</span>
                <button onClick={() => adjustServes(1)} style={servesBtn}>+</button>
              </div>
            </div>
            <div style={{ fontSize: '11px', fontStyle: 'italic', color: C.driftwood, fontWeight: 300, marginBottom: '18px', paddingLeft: '2px' }}>
              Adjust to scale ingredients
            </div>

            {groupedIngredients.map(({ section, items }) => (
              <div key={section || '__default'} style={{ marginBottom: '20px' }}>
                {section && <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.sage, marginBottom: '8px' }}>{section}</div>}
                {items.map((ing, idx) => {
                  const isChecked = checked.has(ing.id)
                  const scaledQty = scaleQty(ing.quantity, scale)
                  const amountStr = [scaledQty, ing.unit].filter(Boolean).join(' ')
                  const nameStr = [ing.name, ing.preparation_note].filter(Boolean).join(', ')
                  const alts = ingAlts[ing.id] || []
                  const hasAlts = alts.length > 0
                  const isExpanded = expandedAlts.has(ing.id)
                  return (
                    <div key={ing.id} style={{ borderBottom: idx < items.length - 1 ? '1px solid rgba(200,185,160,0.4)' : 'none' }}>
                      <div onClick={() => hasAlts ? setExpandedAlts(prev => { const n = new Set(prev); n.has(ing.id) ? n.delete(ing.id) : n.add(ing.id); return n }) : toggleChecked(ing.id)} style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '11px 0',
                        cursor: 'pointer', opacity: isChecked ? 0.7 : 1, transition: 'opacity 0.15s',
                      }}>
                        <div onClick={e => { e.stopPropagation(); toggleChecked(ing.id) }} style={{
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
                        <div style={{ fontSize: '14px', color: isChecked ? C.linen : C.ink, lineHeight: 1.4, textDecoration: isChecked ? 'line-through' : 'none', transition: 'color 0.15s', flex: 1 }}>
                          {nameStr}
                          {ing.is_optional && <span style={{ fontSize: '11px', color: C.driftwoodSm, marginLeft: '6px' }}>(optional)</span>}
                        </div>
                        {hasAlts && (
                          <span style={{
                            fontSize: '10px', fontWeight: 500, color: C.honey,
                            background: 'rgba(196,154,60,0.1)', padding: '2px 6px', borderRadius: '4px',
                            flexShrink: 0,
                          }}>
                            +{alts.length} alt{alts.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {hasAlts && isExpanded && (
                        <div style={{ paddingLeft: '34px', paddingBottom: '8px' }}>
                          {alts.map(alt => (
                            <div key={alt.id} style={{ fontSize: '13px', color: C.driftwood, lineHeight: 1.6, padding: '2px 0' }}>
                              <span style={{ color: C.honey, fontWeight: 500, marginRight: '4px' }}>or</span>
                              {[alt.quantity, alt.unit, alt.name].filter(Boolean).join(' ')}
                            </div>
                          ))}
                        </div>
                      )}
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
        meal={{ id: recipe?.id, name: recipe?.name, servings: recipe?.servings }}
        appUser={appUser}
        onSuccess={() => setPlanSheetOpen(false)}
        itemType="recipe"
      />

      {/* ── Sage Review Sheet ─────────────────────────────────────────── */}
      <SageReviewSheet
        open={sageSheetOpen}
        onClose={() => setSageSheetOpen(false)}
        recipe={recipe}
        recipeId={id}
        appUser={appUser}
        onResolved={() => setRecipe(prev => ({ ...prev, sage_assist_status: 'resolved' }))}
      />

      {/* ── Photo Lightbox ─────────────────────────────────────────── */}
      {lightboxPhoto && (
        <>
          <div onClick={() => setLightboxPhoto(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <img src={lightboxPhoto} alt="" style={{
              maxWidth: '95vw', maxHeight: '85vh', objectFit: 'contain',
              borderRadius: '8px',
            }} />
            <button onClick={() => setLightboxPhoto(null)} style={{
              position: 'absolute', top: '16px', right: '16px',
              width: '36px', height: '36px', borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </>
      )}

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

// ── Sage Review Sheet ───────────────────────────────────────────────────────
function SageReviewSheet({ open, onClose, recipe, recipeId, appUser, onResolved }) {
  const [resolved, setResolved] = useState(new Set())

  if (!open || !recipe?.sage_assist_content) return null

  let suggestions = []
  try { suggestions = JSON.parse(recipe.sage_assist_content) } catch { return null }
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null

  const firstName = appUser?.name?.split(' ')[0] || 'there'
  const allResolved = suggestions.every((_, i) => resolved.has(i))

  async function accept(idx, suggestion) {
    // Update ingredient in DB
    const { data: ings } = await supabase.from('ingredients').select('id, name')
      .eq('recipe_id', recipeId).ilike('name', `%${suggestion.ingredient_name}%`).limit(1)
    if (ings?.[0]) {
      // Parse the suggestion to extract the recommended name
      await supabase.from('ingredients').update({ name: suggestion.suggestion }).eq('id', ings[0].id)
    }
    setResolved(prev => new Set([...prev, idx]))
    checkAllDone(new Set([...resolved, idx]))
  }

  function dismiss(idx) {
    setResolved(prev => new Set([...prev, idx]))
    checkAllDone(new Set([...resolved, idx]))
  }

  async function checkAllDone(res) {
    if (res.size >= suggestions.length) {
      await supabase.from('recipes').update({ sage_assist_status: 'resolved' }).eq('id', recipeId)
      // Mark related notification as acted on
      supabase.from('notifications').update({ is_acted_on: true, acted_on_at: new Date().toISOString() })
        .eq('target_id', recipeId).eq('type', 'sage_ingredient_review')
        .then(() => {})
      onResolved()
      setTimeout(onClose, 600)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
        padding: '0 0 40px', zIndex: 201, boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
        maxHeight: '75vh', overflowY: 'auto',
        animation: 'sheetRise 0.28s cubic-bezier(0.22,1,0.36,1) both',
      }}>
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
        <div style={{ padding: '16px 22px' }}>
          <div style={{
            fontSize: '13px', color: C.driftwood, fontWeight: 300, fontStyle: 'italic',
            lineHeight: 1.5, marginBottom: '16px',
          }}>
            Hey {firstName} — I noticed a few things while reviewing your ingredients. Mind if I clarify? It'll help your shopping list.
          </div>

          {suggestions.map((s, i) => {
            const done = resolved.has(i)
            return (
              <div key={i} style={{
                padding: '14px 0', borderBottom: i < suggestions.length - 1 ? `1px solid ${C.linen}` : 'none',
                opacity: done ? 0.4 : 1, transition: 'opacity 0.2s',
              }}>
                <div style={{ fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500, color: C.ink, marginBottom: '4px' }}>
                  {s.ingredient_name}
                </div>
                <div style={{ fontSize: '13px', color: C.driftwood, fontWeight: 300, marginBottom: '6px', lineHeight: 1.4 }}>
                  {s.issue}
                </div>
                <div style={{ fontSize: '13px', color: C.forest, fontWeight: 400, marginBottom: '8px' }}>
                  → {s.suggestion}
                </div>
                {!done && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => accept(i, s)} style={{
                      padding: '6px 14px', borderRadius: '8px', border: 'none',
                      background: C.forest, color: 'white', fontSize: '12px', fontWeight: 500,
                      fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                    }}>Accept</button>
                    <button onClick={() => dismiss(i)} style={{
                      padding: '6px 14px', borderRadius: '8px', border: 'none',
                      background: 'none', color: C.driftwood, fontSize: '12px', fontWeight: 300,
                      fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                    }}>Keep mine</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
