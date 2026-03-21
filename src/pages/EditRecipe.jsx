/**
 * EditRecipe.jsx — Edit an existing recipe.
 * Full form: photo, basic info, details, timing, ingredients, instructions, notes.
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { runSageIngredientReview } from '../lib/sageReview'
import useUnsavedChanges from '../hooks/useUnsavedChanges'
import UnsavedChangesSheet from '../components/UnsavedChangesSheet'
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
  const [tagDefs, setTagDefs] = useState([]) // all tag definitions for household
  const [selectedTagIds, setSelectedTagIds] = useState(new Set())
  const [newTagOpen, setNewTagOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [altFormKey, setAltFormKey] = useState(null) // _key of ingredient showing alt form
  const [altQty, setAltQty] = useState('')
  const [altUnit, setAltUnit] = useState('piece')
  const [altName, setAltName] = useState('')

  const fileRef = useRef(null)
  const dirty = useUnsavedChanges()

  useEffect(() => { if (id && appUser?.household_id) loadRecipe() }, [id, appUser?.household_id])

  async function loadRecipe() {
    setLoading(true)
    const [recRes, ingRes, insRes, tagDefsRes, recipeTagsRes] = await Promise.all([
      supabase.from('recipes').select('*').eq('id', id).single(),
      supabase.from('ingredients').select('*').eq('recipe_id', id).order('sort_order'),
      supabase.from('instructions').select('*').eq('recipe_id', id).order('step_number'),
      supabase.from('recipe_tag_definitions').select('*').eq('household_id', appUser.household_id).order('sort_order'),
      supabase.from('recipe_tags').select('tag_id').eq('recipe_id', id),
    ])
    // Fetch alternatives for all ingredients
    const ingIds = (ingRes.data || []).map(i => i.id)
    const altRes = ingIds.length > 0
      ? await supabase.from('ingredient_alternatives').select('*').in('primary_ingredient_id', ingIds).order('sort_order')
      : { data: [] }
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
    const altsByIng = {}
    for (const alt of (altRes.data || [])) {
      if (!altsByIng[alt.primary_ingredient_id]) altsByIng[alt.primary_ingredient_id] = []
      altsByIng[alt.primary_ingredient_id].push({ ...alt, _key: alt.id })
    }
    setIngredients((ingRes.data || []).map(i => ({ ...i, _key: i.id, alternatives: altsByIng[i.id] || [] })))
    setInstructions((insRes.data || []).map(i => ({ ...i, _key: i.id })))
    setTagDefs(tagDefsRes.data || [])
    setSelectedTagIds(new Set((recipeTagsRes.data || []).map(t => t.tag_id)))
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
    setIngredients(prev => [...prev, { _key: tempId(), quantity: '', unit: 'piece', name: '', sort_order: prev.length, pantry_item_id: null, alternatives: [] }])
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

  // Alternative helpers
  function addAlternative(ingKey) {
    if (!s(altName)) return
    setIngredients(prev => prev.map(i => {
      if (i._key !== ingKey) return i
      const alts = i.alternatives || []
      return { ...i, alternatives: [...alts, { _key: tempId(), quantity: altQty, unit: altUnit, name: altName, sort_order: alts.length }] }
    }))
    setAltQty(''); setAltUnit('piece'); setAltName(''); setAltFormKey(null)
    dirty.markDirty()
  }
  function removeAlternative(ingKey, altKey) {
    setIngredients(prev => prev.map(i => {
      if (i._key !== ingKey) return i
      return { ...i, alternatives: (i.alternatives || []).filter(a => a._key !== altKey) }
    }))
    dirty.markDirty()
  }

  // Tag helpers
  async function handleCreateTag() {
    if (!newTagName.trim()) return
    const { data } = await supabase.from('recipe_tag_definitions').insert({
      household_id: appUser.household_id,
      name: newTagName.trim(),
      sort_order: tagDefs.length + 1,
    }).select('*').single()
    if (data) {
      setTagDefs(prev => [...prev, data])
      setSelectedTagIds(prev => new Set([...prev, data.id]))
      dirty.markDirty()
    }
    setNewTagName('')
    setNewTagOpen(false)
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

  // Safe string coercion — fields may be non-string types
  const s = (val) => (val == null ? '' : String(val).trim())

  async function handleSave() {
    if (!s(name) || saving) return
    setSaving(true)
    setError(null)
    try {
      // 1. Update recipe
      const prep = parseInt(prepTime) || null
      const cook = parseInt(cookTime) || null
      const { error: recErr } = await supabase.from('recipes').update({
        name: s(name),
        description: s(description) || null,
        author: s(author) || null,
        source_url: s(sourceUrl) || null,
        category: s(category) || null,
        cuisine: s(cuisine) || null,
        method: s(method) || null,
        difficulty: s(difficulty) || null,
        prep_time_minutes: prep,
        cook_time_minutes: cook,
        total_time_minutes: (prep || 0) + (cook || 0) || null,
        servings: s(servings) || null,
        personal_notes: s(personalNotes) || null,
        variations: s(variations) || null,
        photo_url: photoUrl || null,
      }).eq('id', id)
      if (recErr) throw recErr

      // 2. Ensure pantry items exist for all ingredients, then upsert ingredients
      await supabase.from('ingredients').delete().eq('recipe_id', id)
      const validIngs = ingredients.filter(i => s(i.name))
      for (const ing of validIngs) {
        if (!ing.pantry_item_id) {
          // Find or create pantry item
          const nameLower = s(ing.name).toLowerCase()
          let { data: existing } = await supabase.from('pantry_items').select('id')
            .eq('household_id', appUser.household_id).ilike('name', nameLower).maybeSingle()
          if (existing) {
            ing.pantry_item_id = existing.id
          } else {
            const { data: created } = await supabase.from('pantry_items').insert({
              household_id: appUser.household_id, name: nameLower, default_unit: s(ing.unit) || 'piece',
            }).select('id').single()
            if (created) ing.pantry_item_id = created.id
          }
        }
      }
      const ingRows = validIngs.map((i, idx) => ({
        recipe_id: id,
        sort_order: idx,
        name: s(i.name),
        quantity: s(i.quantity) || null,
        unit: s(i.unit) || null,
        pantry_item_id: i.pantry_item_id || null,
        preparation_note: s(i.preparation_note) || null,
        is_optional: i.is_optional || false,
      }))
      if (ingRows.length > 0) {
        const { error: ingErr } = await supabase.from('ingredients').insert(ingRows)
        if (ingErr) throw ingErr
      }

      // 2b. Save ingredient alternatives
      // Collect alt data keyed by ingredient name for re-linking after insert
      const altsByIngName = {}
      for (const ing of validIngs) {
        if (ing.alternatives?.length > 0) {
          altsByIngName[s(ing.name).toLowerCase()] = ing.alternatives
        }
      }
      // Fetch newly inserted ingredient IDs to link alternatives
      if (Object.keys(altsByIngName).length > 0) {
        const { data: newIngs } = await supabase.from('ingredients').select('id, name').eq('recipe_id', id)
        if (newIngs) {
          const altRows = []
          for (const ni of newIngs) {
            const alts = altsByIngName[s(ni.name).toLowerCase()]
            if (!alts) continue
            for (const alt of alts) {
              altRows.push({
                primary_ingredient_id: ni.id,
                name: s(alt.name),
                quantity: s(alt.quantity) || null,
                unit: s(alt.unit) || null,
                preparation_note: s(alt.preparation_note) || null,
                sort_order: alt.sort_order || 0,
              })
            }
          }
          if (altRows.length > 0) {
            await supabase.from('ingredient_alternatives').insert(altRows)
          }
        }
      }

      // 3. Upsert instructions — delete all, re-insert
      await supabase.from('instructions').delete().eq('recipe_id', id)
      const insRows = instructions.filter(i => s(i.instruction)).map((i, idx) => ({
        recipe_id: id,
        step_number: idx + 1,
        instruction: s(i.instruction),
        tip: s(i.tip) || null,
      }))
      if (insRows.length > 0) {
        const { error: insErr } = await supabase.from('instructions').insert(insRows)
        if (insErr) throw insErr
      }

      // 4. Save tags — delete and re-insert
      await supabase.from('recipe_tags').delete().eq('recipe_id', id)
      if (selectedTagIds.size > 0) {
        await supabase.from('recipe_tags').insert(
          [...selectedTagIds].map(tagId => ({ recipe_id: id, tag_id: tagId }))
        )
      }

      // Fire-and-forget Sage ingredient review
      runSageIngredientReview(id, validIngs, { recipeName: s(name), userId: appUser?.id })

      dirty.markClean()
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
        leftAction={{ onClick: () => dirty.guardNavigation(() => navigate(`/recipe/${id}`)), icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg> }}
        centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Edit Recipe</span>}
      />

      <div onChangeCapture={dirty.markDirty} style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

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
          <div style={label}>Tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
            {tagDefs.map(tag => {
              const active = selectedTagIds.has(tag.id)
              return (
                <button key={tag.id} onClick={() => { setSelectedTagIds(prev => { const n = new Set(prev); n.has(tag.id) ? n.delete(tag.id) : n.add(tag.id); return n }); dirty.markDirty() }} style={{
                  padding: '5px 12px', borderRadius: '16px', fontSize: '12px',
                  border: active ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                  background: active ? 'rgba(61,107,79,0.08)' : 'white',
                  color: active ? C.forest : C.ink, cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontWeight: active ? 500 : 400,
                }}>{tag.name}</button>
              )
            })}
          </div>
          {newTagOpen ? (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)}
                placeholder="Type a tag name..." autoFocus
                style={{ ...inputStyle, fontSize: '12px', flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateTag() }} />
              <button onClick={handleCreateTag} disabled={!newTagName.trim()} style={{
                padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: 500,
                background: newTagName.trim() ? C.forest : C.linen,
                color: newTagName.trim() ? 'white' : C.driftwood,
                cursor: newTagName.trim() ? 'pointer' : 'default', fontFamily: "'Jost', sans-serif",
              }}>Add</button>
            </div>
          ) : (
            <button onClick={() => setNewTagOpen(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
              fontSize: '12px', color: C.driftwood, fontWeight: 300, fontFamily: "'Jost', sans-serif",
            }}>+ Add a tag</button>
          )}
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
                {/* Alternatives */}
                {(ing.alternatives || []).map(alt => (
                  <div key={alt._key} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', paddingLeft: '16px', borderLeft: `2px solid ${C.honey}` }}>
                    <span style={{ fontSize: '11px', color: C.honey, fontWeight: 500, flexShrink: 0 }}>or</span>
                    <span style={{ fontSize: '12px', color: C.driftwood, flex: 1 }}>
                      {[alt.quantity, alt.unit, alt.name].filter(Boolean).join(' ')}
                    </span>
                    <button onClick={() => removeAlternative(ing._key, alt._key)} style={{
                      width: '20px', height: '20px', borderRadius: '50%', border: `1px solid ${C.linen}`,
                      background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: C.driftwood, flexShrink: 0,
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ))}
                {altFormKey === ing._key ? (
                  <div style={{ marginTop: '6px', paddingLeft: '16px', borderLeft: `2px solid ${C.honey}` }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="text" value={altQty} onChange={e => setAltQty(e.target.value)} placeholder="Qty"
                        style={{ ...inputStyle, width: '44px', textAlign: 'center', padding: '6px 4px', fontSize: '11px' }} />
                      <input type="text" value={altUnit} onChange={e => setAltUnit(e.target.value)} placeholder="unit"
                        style={{ ...inputStyle, width: '50px', padding: '6px 4px', fontSize: '11px' }} />
                      <input type="text" value={altName} onChange={e => setAltName(e.target.value)} placeholder="Alternative ingredient"
                        autoFocus style={{ ...inputStyle, flex: 1, padding: '6px 8px', fontSize: '12px' }} />
                      <button onClick={() => addAlternative(ing._key)} disabled={!altName.trim()} style={{
                        padding: '6px 10px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: 500,
                        background: altName.trim() ? C.forest : C.linen, color: altName.trim() ? 'white' : C.driftwood,
                        cursor: altName.trim() ? 'pointer' : 'default', fontFamily: "'Jost', sans-serif",
                      }}>Add</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAltFormKey(ing._key); setAltQty(''); setAltUnit('piece'); setAltName('') }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0 16px',
                    fontSize: '11px', color: C.driftwood, fontWeight: 300, fontFamily: "'Jost', sans-serif",
                  }}>
                    {(ing.alternatives || []).length > 0 ? '+ Add another alternative' : '+ Add alternative'}
                  </button>
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
        position: 'fixed', bottom: 'calc(48px + env(safe-area-inset-bottom, 8px))', left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', padding: '12px 22px', background: C.cream,
        borderTop: `1px solid ${C.linen}`, zIndex: 50, boxSizing: 'border-box',
      }}>
        <button onClick={handleSave} disabled={!s(name) || saving} style={{
          width: '100%', padding: '16px', borderRadius: '14px',
          background: s(name) && !saving ? C.forest : C.linen,
          color: s(name) && !saving ? 'white' : C.driftwood,
          border: 'none', cursor: s(name) && !saving ? 'pointer' : 'default',
          fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
          boxShadow: s(name) && !saving ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
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

      <UnsavedChangesSheet
        open={dirty.showConfirm}
        onStay={dirty.cancelLeave}
        onLeave={dirty.confirmLeave}
        title="Unsaved changes"
        message="Your edits haven't been saved yet."
        stayLabel="Keep editing"
        leaveLabel="Leave anyway"
      />

      <BottomNav activeTab="meals" onBeforeNavigate={dirty.guardNavigation} />
    </div>
  )
}
