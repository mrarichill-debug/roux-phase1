/**
 * EditRecipe.jsx — Edit an existing recipe.
 * Full form: photo, basic info, details, timing, ingredients, instructions, notes.
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E',
  linen: '#E8E0D0', sage: '#7A8C6E', honey: '#C49A3C', red: '#A03030',
}

const METHOD_OPTIONS = ['Stovetop', 'Baked', 'Slow Cooker', 'No-Cook', 'Grilled', 'Other']
const DIFFICULTY_OPTIONS = [
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'advanced', label: 'Ambitious' },
]

const label = { fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 500, marginBottom: '6px' }
const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: '14px', fontFamily: "'Jost', sans-serif", fontWeight: 300,
  border: `1.5px solid ${C.linen}`, borderRadius: '10px', outline: 'none', color: C.ink,
  boxSizing: 'border-box', background: 'white',
}

const UNIT_OPTIONS = [
  { group: 'Volume', units: ['tsp','tbsp','cup','fl oz','ml','l'] },
  { group: 'Weight', units: ['oz','lb','g','kg'] },
  { group: 'Count', units: ['piece','clove','can','bag','bunch','package','slice','sheet','sprig','stalk','head','pinch','dash'] },
  { group: 'Other', units: ['to taste','as needed'] },
]
const ALL_UNITS = UNIT_OPTIONS.flatMap(g => g.units)

let idCounter = 0
function tempId() { return `_new_${++idCounter}` }

export default function EditRecipe({ appUser }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  // Recipe fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [category, setCategory] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [method, setMethod] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [servings, setServings] = useState('')
  const [personalNotes, setPersonalNotes] = useState('')
  const [variations, setVariations] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  // Ingredients & instructions
  const [ingredients, setIngredients] = useState([])
  const [instructions, setInstructions] = useState([])
  const [unitPickerKey, setUnitPickerKey] = useState(null) // _key of ingredient showing unit picker
  const [unitSearch, setUnitSearch] = useState('')
  const [pantrySuggestions, setPantrySuggestions] = useState([])
  const [pantryFocusKey, setPantryFocusKey] = useState(null)
  const debounceRef = useRef(null)
  const [categories, setCategories] = useState([])

  const fileRef = useRef(null)

  useEffect(() => { if (id && appUser?.household_id) loadRecipe() }, [id, appUser?.household_id])

  async function loadRecipe() {
    setLoading(true)
    const [recRes, ingRes, insRes, catRes] = await Promise.all([
      supabase.from('recipes').select('*').eq('id', id).single(),
      supabase.from('ingredients').select('*').eq('recipe_id', id).order('sort_order'),
      supabase.from('instructions').select('*').eq('recipe_id', id).order('step_number'),
      supabase.from('recipes').select('category').eq('household_id', appUser.household_id).eq('recipe_type', 'full'),
    ])
    const r = recRes.data
    if (r) {
      setName(r.name || '')
      setDescription(r.description || '')
      setAuthor(r.author || r.credited_to_name || '')
      setSourceUrl(r.source_url || '')
      setCategory(r.category || '')
      setCuisine(r.cuisine || '')
      setMethod(r.method || '')
      setDifficulty(r.difficulty || '')
      setPrepTime(r.prep_time_minutes ? String(r.prep_time_minutes) : '')
      setCookTime(r.cook_time_minutes ? String(r.cook_time_minutes) : '')
      setServings(r.servings || '')
      setPersonalNotes(r.personal_notes || '')
      setVariations(r.variations || '')
      setPhotoUrl(r.photo_url || '')
    }
    setIngredients((ingRes.data || []).map(i => ({ ...i, _key: i.id })))
    setInstructions((insRes.data || []).map(i => ({ ...i, _key: i.id })))
    // Build dynamic category list
    if (catRes.data) {
      const cats = new Set()
      catRes.data.forEach(r => { if (r.category) cats.add(r.category) })
      setCategories([...cats].sort())
    }
    setLoading(false)
  }

  // Photo upload
  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    const path = `recipes/${id}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('recipe-photos').upload(path, file)
    if (upErr) { console.error('[Roux] Photo upload error:', upErr); return }
    const { data } = supabase.storage.from('recipe-photos').getPublicUrl(path)
    if (data?.publicUrl) setPhotoUrl(data.publicUrl)
  }

  // Ingredient helpers
  function addIngredient() {
    setIngredients(prev => [...prev, { _key: tempId(), quantity: '', unit: 'piece', name: '', sort_order: prev.length, pantry_item_id: null }])
  }
  function updateIngredient(key, field, value) {
    setIngredients(prev => prev.map(i => i._key === key ? { ...i, [field]: value } : i))
  }
  function removeIngredient(key) {
    setIngredients(prev => prev.filter(i => i._key !== key))
  }

  // Pantry autofill
  function handleIngNameChange(key, value) {
    updateIngredient(key, 'name', value)
    setPantryFocusKey(key)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) { setPantrySuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase.from('pantry_items').select('id, name, default_unit')
        .ilike('name', `%${value.trim()}%`).limit(6)
      setPantrySuggestions(data || [])
    }, 200)
  }

  function selectPantryItem(key, item) {
    setIngredients(prev => prev.map(i => {
      if (i._key !== key) return i
      return { ...i, name: item.name, pantry_item_id: item.id, unit: i.unit === 'piece' && item.default_unit ? item.default_unit : i.unit }
    }))
    setPantrySuggestions([])
    setPantryFocusKey(null)
  }

  // Instruction helpers
  function addInstruction() {
    setInstructions(prev => [...prev, { _key: tempId(), instruction: '', step_number: prev.length + 1 }])
  }
  function updateInstruction(key, value) {
    setInstructions(prev => prev.map(i => i._key === key ? { ...i, instruction: value } : i))
  }
  function removeInstruction(key) {
    setInstructions(prev => prev.filter(i => i._key !== key).map((i, idx) => ({ ...i, step_number: idx + 1 })))
  }

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      // 1. Update recipe
      const prep = parseInt(prepTime) || null
      const cook = parseInt(cookTime) || null
      const { error: recErr } = await supabase.from('recipes').update({
        name: name.trim(),
        description: description.trim() || null,
        author: author.trim() || null,
        source_url: sourceUrl.trim() || null,
        category: category.trim() || null,
        cuisine: cuisine.trim() || null,
        method: method || null,
        difficulty: difficulty || null,
        prep_time_minutes: prep,
        cook_time_minutes: cook,
        total_time_minutes: (prep || 0) + (cook || 0) || null,
        servings: servings.trim() || null,
        personal_notes: personalNotes.trim() || null,
        variations: variations.trim() || null,
        photo_url: photoUrl || null,
      }).eq('id', id)
      if (recErr) throw recErr

      // 2. Ensure pantry items exist for all ingredients, then upsert ingredients
      await supabase.from('ingredients').delete().eq('recipe_id', id)
      const validIngs = ingredients.filter(i => i.name?.trim())
      for (const ing of validIngs) {
        if (!ing.pantry_item_id) {
          // Find or create pantry item
          const nameLower = ing.name.trim().toLowerCase()
          let { data: existing } = await supabase.from('pantry_items').select('id')
            .eq('household_id', appUser.household_id).ilike('name', nameLower).maybeSingle()
          if (existing) {
            ing.pantry_item_id = existing.id
          } else {
            const { data: created } = await supabase.from('pantry_items').insert({
              household_id: appUser.household_id, name: nameLower, default_unit: ing.unit || 'piece',
            }).select('id').single()
            if (created) ing.pantry_item_id = created.id
          }
        }
      }
      const ingRows = validIngs.map((i, idx) => ({
        recipe_id: id,
        sort_order: idx,
        name: i.name.trim(),
        quantity: i.quantity?.trim() || null,
        unit: i.unit?.trim() || null,
        pantry_item_id: i.pantry_item_id || null,
        preparation_note: i.preparation_note?.trim() || null,
        is_optional: i.is_optional || false,
      }))
      if (ingRows.length > 0) {
        const { error: ingErr } = await supabase.from('ingredients').insert(ingRows)
        if (ingErr) throw ingErr
      }

      // 3. Upsert instructions — delete all, re-insert
      await supabase.from('instructions').delete().eq('recipe_id', id)
      const insRows = instructions.filter(i => i.instruction?.trim()).map((i, idx) => ({
        recipe_id: id,
        step_number: idx + 1,
        instruction: i.instruction.trim(),
        tip: i.tip?.trim() || null,
      }))
      if (insRows.length > 0) {
        const { error: insErr } = await supabase.from('instructions').insert(insRows)
        if (insErr) throw insErr
      }

      setToast('Recipe saved.')
      setTimeout(() => navigate(`/recipe/${id}`), 1200)
    } catch (err) {
      console.error('[Roux] EditRecipe save error:', err)
      setError('Something went wrong. Check your changes and try again.')
      setSaving(false)
    }
  }

  if (loading) return (
    <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
      <TopBar slim leftAction={{ onClick: () => navigate(`/recipe/${id}`), label: 'Back' }}
        centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Edit Recipe</span>} />
      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[180, 100, 60, 60].map((h, i) => <div key={i} className="shimmer-block" style={{ height: `${h}px`, borderRadius: '12px' }} />)}
      </div>
    </div>
  )

  return (
    <div style={{ background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', paddingBottom: '140px' }}>
      <TopBar slim
        leftAction={{ onClick: () => navigate(`/recipe/${id}`), icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg> }}
        centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Edit Recipe</span>}
      />

      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ── 1. Photo ──────────────────────────────────────────────── */}
        <div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          {photoUrl ? (
            <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', height: '180px' }}>
              <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => fileRef.current?.click()} style={{
                position: 'absolute', bottom: '10px', right: '10px',
                padding: '6px 14px', borderRadius: '20px', border: 'none',
                background: 'rgba(255,255,255,0.9)', color: C.ink,
                fontSize: '12px', fontWeight: 400, cursor: 'pointer',
                fontFamily: "'Jost', sans-serif",
              }}>Change photo</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} style={{
              width: '100%', height: '120px', borderRadius: '14px',
              border: `1.5px dashed ${C.linen}`, background: 'white',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '6px', cursor: 'pointer', color: C.driftwood,
              fontFamily: "'Jost', sans-serif", fontSize: '13px',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Add a photo
            </button>
          )}
        </div>

        {/* ── 2. Basic Info ─────────────────────────────────────────── */}
        <div>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Recipe name"
            style={{ ...inputStyle, fontSize: '20px', fontFamily: "'Playfair Display', serif", fontWeight: 500, padding: '12px 0', border: 'none', borderBottom: `1.5px solid ${C.linen}`, borderRadius: 0, background: 'transparent' }} />
        </div>
        <div>
          <div style={label}>Description</div>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What makes this recipe special?" rows={2}
            style={{ ...inputStyle, resize: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={label}>Author</div>
            <input type="text" value={author} onChange={e => setAuthor(e.target.value)} placeholder="Who created this?" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={label}>Source URL</div>
            <input type="text" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="Link (optional)" style={inputStyle} />
          </div>
        </div>

        {/* ── 3. Details ────────────────────────────────────────────── */}
        <div>
          <div style={label}>Category</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{
                padding: '5px 12px', borderRadius: '16px', fontSize: '12px',
                border: category === c ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                background: category === c ? 'rgba(61,107,79,0.08)' : 'white',
                color: category === c ? C.forest : C.ink, cursor: 'pointer',
                fontFamily: "'Jost', sans-serif", fontWeight: category === c ? 500 : 400,
              }}>{c.charAt(0).toUpperCase() + c.slice(1)}</button>
            ))}
          </div>
          <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="Or type a new category" style={{ ...inputStyle, fontSize: '12px' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={label}>Cuisine</div>
            <input type="text" value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="e.g. Italian" style={inputStyle} />
          </div>
        </div>
        <div>
          <div style={label}>Method</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {METHOD_OPTIONS.map(m => (
              <button key={m} onClick={() => setMethod(method === m.toLowerCase() ? '' : m.toLowerCase())} style={{
                padding: '5px 12px', borderRadius: '16px', fontSize: '12px',
                border: method === m.toLowerCase() ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                background: method === m.toLowerCase() ? 'rgba(61,107,79,0.08)' : 'white',
                color: method === m.toLowerCase() ? C.forest : C.ink, cursor: 'pointer',
                fontFamily: "'Jost', sans-serif",
              }}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={label}>Difficulty</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {DIFFICULTY_OPTIONS.map(d => (
              <button key={d.key} onClick={() => setDifficulty(difficulty === d.key ? '' : d.key)} style={{
                flex: 1, padding: '8px', borderRadius: '10px', fontSize: '13px',
                border: difficulty === d.key ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                background: difficulty === d.key ? 'rgba(61,107,79,0.08)' : 'white',
                color: difficulty === d.key ? C.forest : C.ink, cursor: 'pointer',
                fontFamily: "'Jost', sans-serif", fontWeight: difficulty === d.key ? 500 : 400,
              }}>{d.label}</button>
            ))}
          </div>
        </div>

        {/* ── 4. Timing & Servings ──────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <div style={label}>Prep time</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="0" style={{ ...inputStyle, width: '70px', textAlign: 'center' }} />
              <span style={{ fontSize: '12px', color: C.driftwood }}>min</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={label}>Cook time</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="number" value={cookTime} onChange={e => setCookTime(e.target.value)} placeholder="0" style={{ ...inputStyle, width: '70px', textAlign: 'center' }} />
              <span style={{ fontSize: '12px', color: C.driftwood }}>min</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={label}>Servings</div>
            <input type="text" value={servings} onChange={e => setServings(e.target.value)} placeholder="4–6" style={inputStyle} />
          </div>
        </div>

        {/* ── 5. Ingredients ─────────────────────────────────────────── */}
        <div>
          <div style={label}>Ingredients</div>
          {ingredients.map((ing, i) => {
            const filteredUnits = unitSearch.trim() && unitPickerKey === ing._key
              ? ALL_UNITS.filter(u => u.includes(unitSearch.toLowerCase()))
              : ALL_UNITS
            return (
              <div key={ing._key} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input type="text" value={ing.quantity || ''} onChange={e => updateIngredient(ing._key, 'quantity', e.target.value)}
                    placeholder="Qty" style={{ ...inputStyle, width: '50px', textAlign: 'center', padding: '8px 4px', fontSize: '12px' }} />
                  {/* Unit picker button */}
                  <button onClick={() => { setUnitPickerKey(unitPickerKey === ing._key ? null : ing._key); setUnitSearch('') }}
                    style={{
                      ...inputStyle, width: '56px', padding: '8px 4px', fontSize: '11px', textAlign: 'center',
                      cursor: 'pointer', color: ing.unit ? C.ink : C.driftwood,
                      background: unitPickerKey === ing._key ? 'rgba(61,107,79,0.06)' : 'white',
                      border: unitPickerKey === ing._key ? `1.5px solid ${C.forest}` : `1.5px solid ${C.linen}`,
                    }}>
                    {ing.unit || 'unit'}
                  </button>
                  {/* Name with pantry autofill */}
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input type="text" value={ing.name || ''} onChange={e => handleIngNameChange(ing._key, e.target.value)}
                      onFocus={() => setPantryFocusKey(ing._key)} onBlur={() => setTimeout(() => setPantryFocusKey(null), 200)}
                      placeholder="Ingredient name" style={{ ...inputStyle, padding: '8px 10px', fontSize: '13px' }} />
                    {pantryFocusKey === ing._key && pantrySuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                        background: 'white', border: `1px solid ${C.linen}`, borderRadius: '0 0 8px 8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)', maxHeight: '160px', overflowY: 'auto',
                      }}>
                        {pantrySuggestions.map(p => (
                          <button key={p.id} onMouseDown={() => selectPantryItem(ing._key, p)} style={{
                            display: 'block', width: '100%', padding: '8px 10px', background: 'none',
                            border: 'none', borderTop: `1px solid ${C.linen}`, cursor: 'pointer',
                            textAlign: 'left', fontSize: '13px', color: C.ink, fontFamily: "'Jost', sans-serif",
                          }}>
                            {p.name}
                            {p.default_unit && <span style={{ fontSize: '10px', color: C.driftwood, marginLeft: '6px' }}>{p.default_unit}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => removeIngredient(ing._key)} style={{
                    width: '26px', height: '26px', borderRadius: '50%', border: `1px solid ${C.linen}`,
                    background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: C.driftwood, flexShrink: 0,
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
                {/* Unit picker dropdown */}
                {unitPickerKey === ing._key && (
                  <div style={{ marginTop: '4px', padding: '8px', background: 'white', border: `1px solid ${C.linen}`, borderRadius: '8px' }}>
                    <input type="text" value={unitSearch} onChange={e => setUnitSearch(e.target.value)} placeholder="Search units..."
                      autoFocus style={{ ...inputStyle, fontSize: '12px', padding: '6px 10px', marginBottom: '6px' }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                      {filteredUnits.map(u => (
                        <button key={u} onClick={() => { updateIngredient(ing._key, 'unit', u); setUnitPickerKey(null) }} style={{
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px',
                          border: ing.unit === u ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                          background: ing.unit === u ? 'rgba(61,107,79,0.08)' : 'white',
                          color: ing.unit === u ? C.forest : C.ink, cursor: 'pointer',
                          fontFamily: "'Jost', sans-serif",
                        }}>{u}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={addIngredient} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '13px', color: C.forest, fontWeight: 400, padding: '6px 0',
            fontFamily: "'Jost', sans-serif",
          }}>+ Add ingredient</button>
        </div>

        {/* ── 6. Instructions ────────────────────────────────────────── */}
        <div>
          <div style={label}>Instructions</div>
          {instructions.map((step, i) => (
            <div key={step._key} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: C.forest, minWidth: '24px', paddingTop: '8px' }}>
                {i + 1}
              </span>
              <textarea value={step.instruction || ''} onChange={e => updateInstruction(step._key, e.target.value)}
                placeholder={`Step ${i + 1}...`} rows={2}
                style={{ ...inputStyle, flex: 1, resize: 'none', fontSize: '13px' }} />
              <button onClick={() => removeInstruction(step._key)} style={{
                width: '26px', height: '26px', borderRadius: '50%', border: `1px solid ${C.linen}`,
                background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.driftwood, flexShrink: 0, marginTop: '6px',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
          <button onClick={addInstruction} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '13px', color: C.forest, fontWeight: 400, padding: '6px 0',
            fontFamily: "'Jost', sans-serif",
          }}>+ Add step</button>
        </div>

        {/* ── 7. Notes & Variations ──────────────────────────────────── */}
        <div>
          <div style={label}>Personal notes</div>
          <textarea value={personalNotes} onChange={e => setPersonalNotes(e.target.value)}
            placeholder="My notes on this recipe..." rows={3}
            style={{ ...inputStyle, fontFamily: "'Caveat', cursive", fontSize: '16px', fontWeight: 500, resize: 'none' }} />
        </div>
        <div>
          <div style={label}>Variations</div>
          <textarea value={variations} onChange={e => setVariations(e.target.value)}
            placeholder="Ways to change it up..." rows={2}
            style={{ ...inputStyle, resize: 'none' }} />
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '0 22px 10px', fontSize: '13px', color: C.red, textAlign: 'center' }}>{error}</div>
      )}

      {/* ── Pinned Save Button ────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom, 8px))', left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', padding: '12px 22px', background: C.cream,
        borderTop: `1px solid ${C.linen}`, zIndex: 50, boxSizing: 'border-box',
      }}>
        <button onClick={handleSave} disabled={!name.trim() || saving} style={{
          width: '100%', padding: '16px', borderRadius: '14px',
          background: name.trim() && !saving ? C.forest : C.linen,
          color: name.trim() && !saving ? 'white' : C.driftwood,
          border: 'none', cursor: name.trim() && !saving ? 'pointer' : 'default',
          fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
          boxShadow: name.trim() && !saving ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
        }}>
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%',
          background: C.forest, color: 'white', padding: '10px 22px', borderRadius: '10px',
          fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
          zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          animation: 'toastIn 0.25s cubic-bezier(0.22,1,0.36,1) forwards',
        }}>{toast}</div>
      )}

      <BottomNav activeTab="meals" />
    </div>
  )
}
