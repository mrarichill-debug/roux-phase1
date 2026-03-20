/**
 * SaveRecipe.jsx — Save a new recipe via Photo, URL, or Manual entry.
 * Photo supports multiple images (up to 6) — front/back of cards, cookbook pages.
 * Photos stored permanently in recipe_photos table after save.
 * After save: Sage ingredient review fires automatically (Haiku).
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getSageModel, SAGE_INGREDIENT_REVIEW } from '../lib/aiModels'
import { runSageIngredientReview } from '../lib/sageReview'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', forestDark: '#2E5038', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0', sage: '#7A8C6E', honey: '#C49A3C', red: '#A03030',
}

const METHOD_OPTIONS = ['Stovetop', 'Baked', 'Slow Cooker', 'No-Cook', 'Grilled', 'Other']
const DIFFICULTY_OPTIONS = [
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'advanced', label: 'Ambitious' },
]
const UNIT_OPTIONS = [
  { group: 'Volume', units: ['tsp','tbsp','cup','fl oz','ml','l'] },
  { group: 'Weight', units: ['oz','lb','g','kg'] },
  { group: 'Count', units: ['piece','clove','can','bag','bunch','package','slice','sheet','sprig','stalk','head','pinch','dash'] },
  { group: 'Other', units: ['to taste','as needed'] },
]
const ALL_UNITS = UNIT_OPTIONS.flatMap(g => g.units)

const labelStyle = { fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 500, marginBottom: '6px' }
const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: '14px', fontFamily: "'Jost', sans-serif", fontWeight: 300,
  border: `1.5px solid ${C.linen}`, borderRadius: '10px', outline: 'none', color: C.ink,
  boxSizing: 'border-box', background: 'white',
}

const MAX_PHOTOS = 6

let idCounter = 0
function tempId() { return `_new_${++idCounter}` }

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

const EXTRACTION_PROMPT = `You are Sage, a recipe extraction assistant for the Roux family meal planning app. Extract a structured recipe from the provided content. Return ONLY valid JSON with these fields:
{
  "name": "string (recipe title)",
  "description": "string (1-2 sentence summary, what makes it special)",
  "author": "string or null",
  "source_url": "string or null (original URL if provided)",
  "category": "string or null (e.g. Main, Side, Dessert, Appetizer, Breakfast, Soup, Salad, Snack, Drink, Bread, Sauce)",
  "cuisine": "string or null (e.g. Italian, Mexican, American)",
  "method": "string or null (one of: stovetop, baked, slow cooker, no-cook, grilled, other)",
  "difficulty": "string or null (one of: easy, medium, advanced)",
  "prep_time_minutes": "number or null",
  "cook_time_minutes": "number or null",
  "servings": "string or null (e.g. '4-6')",
  "ingredients": [{"quantity": "string", "unit": "string (tsp/tbsp/cup/oz/lb/g/piece/etc)", "name": "string"}],
  "instructions": [{"step_number": 1, "instruction": "string"}],
  "personal_notes": "string or null"
}
Be thorough with ingredients — include quantities and standard units. Convert vague measurements to standard units when possible. For instructions, break into clear numbered steps. If information is missing, use null rather than guessing.`

const MULTI_PHOTO_PROMPT = `You are Sage, a recipe extraction assistant for the Roux family meal planning app. These images are multiple pages or sides of the same recipe. Combine all ingredients and instructions across all images into a single unified recipe. Do not duplicate ingredients that appear on multiple pages. Return ONLY valid JSON with these fields:
{
  "name": "string (recipe title)",
  "description": "string (1-2 sentence summary, what makes it special)",
  "author": "string or null",
  "source_url": "string or null",
  "category": "string or null (e.g. Main, Side, Dessert, Appetizer, Breakfast, Soup, Salad, Snack, Drink, Bread, Sauce)",
  "cuisine": "string or null (e.g. Italian, Mexican, American)",
  "method": "string or null (one of: stovetop, baked, slow cooker, no-cook, grilled, other)",
  "difficulty": "string or null (one of: easy, medium, advanced)",
  "prep_time_minutes": "number or null",
  "cook_time_minutes": "number or null",
  "servings": "string or null (e.g. '4-6')",
  "ingredients": [{"quantity": "string", "unit": "string (tsp/tbsp/cup/oz/lb/g/piece/etc)", "name": "string"}],
  "instructions": [{"step_number": 1, "instruction": "string"}],
  "personal_notes": "string or null"
}
Be thorough with ingredients — include quantities and standard units. Convert vague measurements to standard units when possible. For instructions, break into clear numbered steps. If information is missing, use null rather than guessing.`

export default function SaveRecipe({ appUser }) {
  const navigate = useNavigate()

  // Flow state: 'choose' | 'url' | 'photo' | 'form'
  const [step, setStep] = useState('choose')
  const [sourceType, setSourceType] = useState('manual') // 'url' | 'photo' | 'manual'

  // Extraction state
  const [urlInput, setUrlInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState(null)

  // Multi-photo capture state
  const [capturedPhotos, setCapturedPhotos] = useState([]) // [{ file, preview, id }]
  const photoInputRef = useRef(null)

  // Recipe form fields
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
  const [ingredients, setIngredients] = useState([])
  const [instructions, setInstructions] = useState([])
  const [categories, setCategories] = useState([])

  // Form helpers
  const [unitPickerKey, setUnitPickerKey] = useState(null)
  const [unitSearch, setUnitSearch] = useState('')
  const [pantrySuggestions, setPantrySuggestions] = useState([])
  const [pantryFocusKey, setPantryFocusKey] = useState(null)
  const debounceRef = useRef(null)
  const fileRef = useRef(null)

  // Save state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)

  // Load dynamic categories
  useEffect(() => {
    if (!appUser?.household_id) return
    supabase.from('recipes').select('category').eq('household_id', appUser.household_id).eq('recipe_type', 'full')
      .then(({ data }) => {
        if (!data) return
        const cats = new Set()
        data.forEach(r => { if (r.category) cats.add(r.category) })
        setCategories([...cats].sort())
      })
  }, [appUser?.household_id])

  // ── Multi-photo capture ──────────────────────────────────────
  function handlePhotoCaptured(e) {
    const file = e.target.files?.[0]
    if (!file || capturedPhotos.length >= MAX_PHOTOS) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setCapturedPhotos(prev => [...prev, { file, preview: ev.target.result, id: tempId() }])
    }
    reader.readAsDataURL(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  function removePhoto(photoId) {
    setCapturedPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  // ── Extraction: URL ──────────────────────────────────────────
  async function handleUrlExtract() {
    if (!urlInput.trim() || extracting) return
    setExtracting(true)
    setExtractError(null)
    try {
      const model = await getSageModel()
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: EXTRACTION_PROMPT,
          messages: [{
            role: 'user',
            content: `Extract the recipe from this URL. Fetch and parse the page content:\n\n${urlInput.trim()}`,
          }],
        }),
      })
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      applyExtractedData(text, urlInput.trim())
    } catch (err) {
      console.error('[SaveRecipe] URL extraction error:', err)
      setExtractError("Couldn't extract that recipe. Try pasting the recipe text directly, or enter it manually.")
      setExtracting(false)
    }
  }

  // ── Extraction: Photo(s) ─────────────────────────────────────
  async function handlePhotoExtract() {
    if (!capturedPhotos.length || extracting) return
    setExtracting(true)
    setExtractError(null)
    try {
      // Convert all photos to base64
      const imageBlocks = await Promise.all(capturedPhotos.map(async (photo) => {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(photo.file)
        })
        return {
          type: 'image',
          source: { type: 'base64', media_type: photo.file.type || 'image/jpeg', data: base64 },
        }
      }))

      const isMulti = capturedPhotos.length > 1
      const systemPrompt = isMulti ? MULTI_PHOTO_PROMPT : EXTRACTION_PROMPT
      const userText = isMulti
        ? `Extract the recipe from these ${capturedPhotos.length} photos. They are multiple pages or sides of the same recipe.`
        : 'Extract the recipe from this photo of a recipe card or cookbook page.'

      const model = await getSageModel()
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [...imageBlocks, { type: 'text', text: userText }],
          }],
        }),
      })
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      applyExtractedData(text, null)
    } catch (err) {
      console.error('[SaveRecipe] Photo extraction error:', err)
      setExtractError("Couldn't read the photo clearly. Try a clearer photo, or enter the recipe manually.")
      setExtracting(false)
    }
  }

  // ── Apply extracted JSON to form ─────────────────────────────
  function applyExtractedData(text, url) {
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)

      setName(parsed.name || '')
      setDescription(parsed.description || '')
      setAuthor(parsed.author || '')
      setSourceUrl(url || parsed.source_url || '')
      setCategory(parsed.category || '')
      setCuisine(parsed.cuisine || '')
      setMethod(parsed.method || '')
      setDifficulty(parsed.difficulty || '')
      setPrepTime(parsed.prep_time_minutes ? String(parsed.prep_time_minutes) : '')
      setCookTime(parsed.cook_time_minutes ? String(parsed.cook_time_minutes) : '')
      setServings(parsed.servings || '')
      setPersonalNotes(parsed.personal_notes || '')

      if (Array.isArray(parsed.ingredients)) {
        setIngredients(parsed.ingredients.map((ing, i) => ({
          _key: tempId(),
          quantity: ing.quantity || '',
          unit: ing.unit || 'piece',
          name: ing.name || '',
          sort_order: i,
          pantry_item_id: null,
        })))
      }
      if (Array.isArray(parsed.instructions)) {
        setInstructions(parsed.instructions.map((ins) => ({
          _key: tempId(),
          instruction: ins.instruction || '',
          step_number: ins.step_number || 1,
        })))
      }

      setExtracting(false)
      setStep('form')
    } catch (err) {
      console.error('[SaveRecipe] Parse error:', err)
      setExtractError("Sage had trouble reading that. Try again or enter the recipe manually.")
      setExtracting(false)
    }
  }

  // ── Go to manual form ────────────────────────────────────────
  function startManual() {
    setSourceType('manual')
    setIngredients([{ _key: tempId(), quantity: '', unit: 'piece', name: '', sort_order: 0, pantry_item_id: null }])
    setInstructions([{ _key: tempId(), instruction: '', step_number: 1 }])
    setStep('form')
  }

  // ── Ingredient helpers ───────────────────────────────────────
  function addIngredient() {
    setIngredients(prev => [...prev, { _key: tempId(), quantity: '', unit: 'piece', name: '', sort_order: prev.length, pantry_item_id: null }])
  }
  function updateIngredient(key, field, value) {
    setIngredients(prev => prev.map(i => i._key === key ? { ...i, [field]: value } : i))
  }
  function removeIngredient(key) {
    setIngredients(prev => prev.filter(i => i._key !== key))
  }
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

  // ── Instruction helpers ──────────────────────────────────────
  function addInstruction() {
    setInstructions(prev => [...prev, { _key: tempId(), instruction: '', step_number: prev.length + 1 }])
  }
  function updateInstruction(key, value) {
    setInstructions(prev => prev.map(i => i._key === key ? { ...i, instruction: value } : i))
  }
  function removeInstruction(key) {
    setInstructions(prev => prev.filter(i => i._key !== key).map((i, idx) => ({ ...i, step_number: idx + 1 })))
  }

  // ── Photo upload for recipe form ─────────────────────────────
  async function handleRecipePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()
    const path = `recipes/new-${Date.now()}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('recipe-photos').upload(path, file)
    if (upErr) { console.error('[SaveRecipe] Photo upload error:', upErr); return }
    const { data } = supabase.storage.from('recipe-photos').getPublicUrl(path)
    if (data?.publicUrl) setPhotoUrl(data.publicUrl)
  }

  // ── Upload captured photos to Supabase Storage + recipe_photos table ──
  async function uploadCapturedPhotos(recipeId) {
    if (!capturedPhotos.length || !appUser?.household_id) return
    const basePath = `recipe-photos/${appUser.household_id}/${recipeId}`

    for (let i = 0; i < capturedPhotos.length; i++) {
      const photo = capturedPhotos[i]
      const ext = photo.file.name?.split('.').pop() || 'jpg'
      const fileName = `${Date.now()}-${i}.${ext}`
      const storagePath = `${basePath}/${fileName}`

      const { error: upErr } = await supabase.storage.from('recipe-photos').upload(storagePath, photo.file)
      if (upErr) {
        console.error('[SaveRecipe] Photo upload error:', upErr)
        continue
      }
      const { data: urlData } = supabase.storage.from('recipe-photos').getPublicUrl(storagePath)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) continue

      await supabase.from('recipe_photos').insert({
        recipe_id: recipeId,
        storage_path: storagePath,
        url: publicUrl,
        sort_order: i,
        is_primary: i === 0,
        source_type: 'camera',
      })

      // Set the first photo as the recipe's primary photo_url for backwards compat
      if (i === 0) {
        await supabase.from('recipes').update({ photo_url: publicUrl }).eq('id', recipeId)
      }
    }
  }

  // ── Save recipe ──────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const prep = parseInt(prepTime) || null
      const cook = parseInt(cookTime) || null

      // 1. Insert recipe
      const { data: newRecipe, error: recErr } = await supabase.from('recipes').insert({
        household_id: appUser.household_id,
        added_by: appUser.id,
        name: name.trim(),
        description: description.trim() || null,
        author: author.trim() || null,
        source_type: sourceType,
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
        recipe_type: 'full',
        status: 'complete',
        visibility: 'household',
      }).select('id').single()

      if (recErr) throw recErr
      const recipeId = newRecipe.id

      // 2. Ensure pantry items + insert ingredients
      const validIngs = ingredients.filter(i => i.name?.trim())
      for (const ing of validIngs) {
        if (!ing.pantry_item_id) {
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
        recipe_id: recipeId,
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

      // 3. Insert instructions
      const insRows = instructions.filter(i => i.instruction?.trim()).map((i, idx) => ({
        recipe_id: recipeId,
        step_number: idx + 1,
        instruction: i.instruction.trim(),
        tip: i.tip?.trim() || null,
      }))
      if (insRows.length > 0) {
        const { error: insErr } = await supabase.from('instructions').insert(insRows)
        if (insErr) throw insErr
      }

      // 4. Upload captured photos permanently to recipe_photos
      if (sourceType === 'photo' && capturedPhotos.length > 0) {
        await uploadCapturedPhotos(recipeId)
      }

      // 5. Fire-and-forget Sage ingredient review
      runSageIngredientReview(recipeId, validIngs, { recipeName: name.trim(), userId: appUser?.id })

      setToast('Recipe saved.')
      setTimeout(() => navigate(`/recipe/${recipeId}`), 1200)
    } catch (err) {
      console.error('[SaveRecipe] Save error:', err)
      setError('Something went wrong. Check your changes and try again.')
      setSaving(false)
    }
  }

  // ── Back handler ─────────────────────────────────────────────
  function handleBack() {
    if (step === 'form') {
      setStep('choose')
    } else if (step === 'url' || step === 'photo') {
      setStep('choose')
      setExtractError(null)
      setExtracting(false)
    } else {
      navigate('/meals/recipes')
    }
  }

  const topBarTitle = step === 'choose' ? 'Save a Recipe'
    : step === 'url' ? 'Paste a URL'
    : step === 'photo' ? 'Take a Photo'
    : 'New Recipe'

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div style={{ background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', paddingBottom: step === 'form' ? '140px' : '100px' }}>
      <TopBar slim
        leftAction={{ onClick: handleBack, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg> }}
        centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>{topBarTitle}</span>}
      />

      {/* ── STEP: Choose method ───────────────────────────────── */}
      {step === 'choose' && (
        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Sage greeting */}
          <div style={{
            padding: '14px 16px', background: 'white', borderRadius: '12px',
            borderLeft: `3px solid ${C.sage}`,
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: C.ink, lineHeight: 1.6, fontStyle: 'italic' }}>
              Share a recipe with me — snap a photo, paste a link, or type it in. I'll take care of the rest.
            </p>
          </div>

          {/* Photo card */}
          <button onClick={() => { setSourceType('photo'); setStep('photo') }} style={{
            padding: '20px', borderRadius: '14px', border: 'none', cursor: 'pointer',
            background: C.forest, color: 'white', textAlign: 'left',
            boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, marginBottom: '4px' }}>
                  Take a Photo
                </div>
                <div style={{ fontSize: '13px', opacity: 0.85, fontWeight: 300 }}>
                  Snap a recipe card or cookbook page
                </div>
              </div>
            </div>
          </button>

          {/* URL card */}
          <button onClick={() => { setSourceType('url'); setStep('url') }} style={{
            padding: '20px', borderRadius: '14px', cursor: 'pointer',
            background: 'white', color: C.ink, textAlign: 'left',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            border: `1.5px solid ${C.linen}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(61,107,79,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke={C.forest} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, marginBottom: '4px' }}>
                  Paste a URL
                </div>
                <div style={{ fontSize: '13px', color: C.driftwood, fontWeight: 300 }}>
                  Share a link and Sage grabs everything
                </div>
              </div>
            </div>
          </button>

          {/* Manual entry — subtle */}
          <button onClick={startManual} style={{
            padding: '14px 20px', borderRadius: '14px', border: `1px dashed ${C.linen}`,
            background: 'transparent', cursor: 'pointer', textAlign: 'center',
            color: C.driftwood, fontSize: '14px', fontFamily: "'Jost', sans-serif", fontWeight: 400,
          }}>
            Or type it in manually
          </button>
        </div>
      )}

      {/* ── STEP: URL input ───────────────────────────────────── */}
      {step === 'url' && (
        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={labelStyle}>Recipe URL</div>
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://..."
            autoFocus
            style={{ ...inputStyle, fontSize: '15px' }}
            onKeyDown={e => { if (e.key === 'Enter') handleUrlExtract() }}
          />

          {extractError && (
            <div style={{ fontSize: '13px', color: C.red, lineHeight: 1.5 }}>{extractError}</div>
          )}

          {extracting ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ display: 'inline-block', width: '32px', height: '32px', border: `3px solid ${C.linen}`, borderTop: `3px solid ${C.forest}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ marginTop: '12px', fontSize: '14px', color: C.driftwood, fontStyle: 'italic' }}>
                Sage is reading the recipe...
              </div>
            </div>
          ) : (
            <button onClick={handleUrlExtract} disabled={!urlInput.trim()} style={{
              padding: '16px', borderRadius: '14px', border: 'none', cursor: urlInput.trim() ? 'pointer' : 'default',
              background: urlInput.trim() ? C.forest : C.linen,
              color: urlInput.trim() ? 'white' : C.driftwood,
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
              boxShadow: urlInput.trim() ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
            }}>
              Let Sage extract it
            </button>
          )}

          <button onClick={startManual} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '13px', color: C.driftwood, fontWeight: 300,
            fontFamily: "'Jost', sans-serif", padding: '8px 0',
          }}>
            Or just type it in manually
          </button>
        </div>
      )}

      {/* ── STEP: Photo capture (multi-photo) ─────────────────── */}
      {step === 'photo' && (
        <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handlePhotoCaptured}
          />

          {capturedPhotos.length > 0 ? (
            <>
              {/* Thumbnail strip */}
              <div style={{
                display: 'flex', gap: '10px', overflowX: 'auto',
                padding: '4px 0', WebkitOverflowScrolling: 'touch',
              }}>
                {capturedPhotos.map((photo, i) => (
                  <div key={photo.id} style={{
                    position: 'relative', flexShrink: 0,
                    width: '100px', height: '100px', borderRadius: '10px',
                    overflow: 'hidden', border: `1.5px solid ${C.linen}`,
                  }}>
                    <img src={photo.preview} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => removePhoto(photo.id)} style={{
                      position: 'absolute', top: '4px', right: '4px',
                      width: '22px', height: '22px', borderRadius: '50%', border: 'none',
                      background: 'rgba(0,0,0,0.55)', color: 'white', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', padding: 0,
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                    {i === 0 && (
                      <div style={{
                        position: 'absolute', bottom: '4px', left: '4px',
                        background: C.forest, color: 'white', fontSize: '8px',
                        padding: '2px 5px', borderRadius: '4px', fontWeight: 500,
                        letterSpacing: '0.5px', textTransform: 'uppercase',
                      }}>Primary</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add another photo */}
              {capturedPhotos.length < MAX_PHOTOS && (
                <button onClick={() => photoInputRef.current?.click()} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px', borderRadius: '10px',
                  border: `1.5px dashed ${C.sage}`, background: 'rgba(122,140,110,0.04)',
                  cursor: 'pointer', color: C.forest,
                  fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 400,
                }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add another photo
                  <span style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300 }}>({capturedPhotos.length}/{MAX_PHOTOS})</span>
                </button>
              )}

              <div style={{ fontSize: '12px', color: C.driftwood, fontWeight: 300, textAlign: 'center', fontStyle: 'italic' }}>
                {capturedPhotos.length === 1
                  ? 'Got both sides? Add another photo.'
                  : `${capturedPhotos.length} photos — Sage will combine them into one recipe.`}
              </div>

              {extractError && (
                <div style={{ fontSize: '13px', color: C.red, lineHeight: 1.5 }}>{extractError}</div>
              )}

              {extracting ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ display: 'inline-block', width: '32px', height: '32px', border: `3px solid ${C.linen}`, borderTop: `3px solid ${C.forest}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <div style={{ marginTop: '12px', fontSize: '14px', color: C.driftwood, fontStyle: 'italic' }}>
                    Sage is reading {capturedPhotos.length > 1 ? `all ${capturedPhotos.length} photos` : 'the recipe'}...
                  </div>
                </div>
              ) : (
                <button onClick={handlePhotoExtract} style={{
                  padding: '16px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                  background: C.forest, color: 'white',
                  fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                  boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
                }}>
                  Scan recipe
                </button>
              )}
            </>
          ) : (
            <button onClick={() => photoInputRef.current?.click()} style={{
              width: '100%', height: '200px', borderRadius: '14px',
              border: `2px dashed ${C.sage}`, background: 'rgba(122,140,110,0.04)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '12px', cursor: 'pointer', color: C.forest,
              fontFamily: "'Jost', sans-serif",
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 36, height: 36, opacity: 0.7 }}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <div style={{ fontSize: '15px', fontWeight: 400 }}>Tap to take a photo</div>
              <div style={{ fontSize: '12px', color: C.driftwood, fontWeight: 300 }}>Recipe card, cookbook page, or handwritten note</div>
            </button>
          )}

          <button onClick={startManual} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '13px', color: C.driftwood, fontWeight: 300,
            fontFamily: "'Jost', sans-serif", padding: '8px 0',
          }}>
            Or just type it in manually
          </button>
        </div>
      )}

      {/* ── STEP: Recipe form ─────────────────────────────────── */}
      {step === 'form' && (
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Sage confirmation for extracted recipes */}
          {sourceType !== 'manual' && (
            <div style={{
              padding: '12px 14px', background: 'white', borderRadius: '10px',
              borderLeft: `3px solid ${C.sage}`, fontSize: '13px', color: C.driftwood, lineHeight: 1.5,
            }}>
              Sage filled in what she could. Review and adjust anything before saving.
            </div>
          )}

          {/* ── Photo ──────────────────────────────────────────── */}
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleRecipePhotoUpload} />
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
            ) : sourceType === 'photo' && capturedPhotos.length > 0 ? (
              /* Show captured photos as preview strip on form */
              <div>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0' }}>
                  {capturedPhotos.map((photo, i) => (
                    <div key={photo.id} style={{
                      flexShrink: 0, width: '80px', height: '80px', borderRadius: '10px',
                      overflow: 'hidden', border: i === 0 ? `2px solid ${C.forest}` : `1px solid ${C.linen}`,
                    }}>
                      <img src={photo.preview} alt={`Photo ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: C.driftwood, marginTop: '4px', fontWeight: 300 }}>
                  {capturedPhotos.length} photo{capturedPhotos.length > 1 ? 's' : ''} will be saved with this recipe
                </div>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} style={{
                width: '100%', height: '100px', borderRadius: '14px',
                border: `1.5px dashed ${C.linen}`, background: 'white',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '6px', cursor: 'pointer', color: C.driftwood,
                fontFamily: "'Jost', sans-serif", fontSize: '13px',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Add a photo
              </button>
            )}
          </div>

          {/* ── Basic Info ─────────────────────────────────────── */}
          <div>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Recipe name"
              style={{ ...inputStyle, fontSize: '20px', fontFamily: "'Playfair Display', serif", fontWeight: 500, padding: '12px 0', border: 'none', borderBottom: `1.5px solid ${C.linen}`, borderRadius: 0, background: 'transparent' }} />
          </div>
          <div>
            <div style={labelStyle}>Description</div>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What makes this recipe special?" rows={2}
              style={{ ...inputStyle, resize: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Author</div>
              <input type="text" value={author} onChange={e => setAuthor(e.target.value)} placeholder="Who created this?" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Source URL</div>
              <input type="text" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="Link (optional)" style={inputStyle} />
            </div>
          </div>

          {/* ── Details ────────────────────────────────────────── */}
          <div>
            <div style={labelStyle}>Category</div>
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
          <div>
            <div style={labelStyle}>Cuisine</div>
            <input type="text" value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="e.g. Italian" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Method</div>
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
            <div style={labelStyle}>Difficulty</div>
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

          {/* ── Timing & Servings ──────────────────────────────── */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Prep time</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="number" value={prepTime} onChange={e => setPrepTime(e.target.value)} placeholder="0" style={{ ...inputStyle, width: '70px', textAlign: 'center' }} />
                <span style={{ fontSize: '12px', color: C.driftwood }}>min</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Cook time</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="number" value={cookTime} onChange={e => setCookTime(e.target.value)} placeholder="0" style={{ ...inputStyle, width: '70px', textAlign: 'center' }} />
                <span style={{ fontSize: '12px', color: C.driftwood }}>min</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>Servings</div>
              <input type="text" value={servings} onChange={e => setServings(e.target.value)} placeholder="4–6" style={inputStyle} />
            </div>
          </div>

          {/* ── Ingredients ────────────────────────────────────── */}
          <div>
            <div style={labelStyle}>Ingredients</div>
            {ingredients.map((ing) => {
              const filteredUnits = unitSearch.trim() && unitPickerKey === ing._key
                ? ALL_UNITS.filter(u => u.includes(unitSearch.toLowerCase()))
                : ALL_UNITS
              return (
                <div key={ing._key} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input type="text" value={ing.quantity || ''} onChange={e => updateIngredient(ing._key, 'quantity', e.target.value)}
                      placeholder="Qty" style={{ ...inputStyle, width: '50px', textAlign: 'center', padding: '8px 4px', fontSize: '12px' }} />
                    <button onClick={() => { setUnitPickerKey(unitPickerKey === ing._key ? null : ing._key); setUnitSearch('') }}
                      style={{
                        ...inputStyle, width: '56px', padding: '8px 4px', fontSize: '11px', textAlign: 'center',
                        cursor: 'pointer', color: ing.unit ? C.ink : C.driftwood,
                        background: unitPickerKey === ing._key ? 'rgba(61,107,79,0.06)' : 'white',
                        border: unitPickerKey === ing._key ? `1.5px solid ${C.forest}` : `1.5px solid ${C.linen}`,
                      }}>
                      {ing.unit || 'unit'}
                    </button>
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

          {/* ── Instructions ───────────────────────────────────── */}
          <div>
            <div style={labelStyle}>Instructions</div>
            {instructions.map((s, i) => (
              <div key={s._key} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: C.forest, minWidth: '24px', paddingTop: '8px' }}>
                  {i + 1}
                </span>
                <textarea value={s.instruction || ''} onChange={e => updateInstruction(s._key, e.target.value)}
                  placeholder={`Step ${i + 1}...`} rows={2}
                  style={{ ...inputStyle, flex: 1, resize: 'none', fontSize: '13px' }} />
                <button onClick={() => removeInstruction(s._key)} style={{
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

          {/* ── Notes & Variations ─────────────────────────────── */}
          <div>
            <div style={labelStyle}>Personal notes</div>
            <textarea value={personalNotes} onChange={e => setPersonalNotes(e.target.value)}
              placeholder="My notes on this recipe..." rows={3}
              style={{ ...inputStyle, fontFamily: "'Caveat', cursive", fontSize: '16px', fontWeight: 500, resize: 'none' }} />
          </div>
          <div>
            <div style={labelStyle}>Variations</div>
            <textarea value={variations} onChange={e => setVariations(e.target.value)}
              placeholder="Ways to change it up..." rows={2}
              style={{ ...inputStyle, resize: 'none' }} />
          </div>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: '0 22px 10px', fontSize: '13px', color: C.red, textAlign: 'center' }}>{error}</div>
      )}

      {/* ── Pinned Save Button (form step only) ────────────────── */}
      {step === 'form' && (
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
            {saving ? 'Saving...' : 'Save recipe'}
          </button>
        </div>
      )}

      {/* ── Toast ──────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: C.forest, color: 'white', padding: '10px 22px', borderRadius: '10px',
          fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
          zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          animation: 'toastIn 0.25s cubic-bezier(0.22,1,0.36,1) forwards',
        }}>{toast}</div>
      )}

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(-8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
      `}</style>

      <BottomNav activeTab="meals" />
    </div>
  )
}
