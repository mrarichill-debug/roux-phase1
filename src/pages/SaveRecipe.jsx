/**
 * SaveRecipe.jsx — Save a new recipe via Photo, URL, or Manual entry.
 * Photo supports multiple images (up to 6) — front/back of cards, cookbook pages.
 * Photos stored permanently in recipe_photos table after save.
 * After save: Sage ingredient review fires automatically (Haiku).
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { runSageIngredientReview } from '../lib/sageReview'
import { categorizeIngredientsWithSage } from '../lib/categorizeIngredientsWithSage'
import { sageReverseMatch } from '../lib/sageReverseMatch'
import { logActivity } from '../lib/activityLog'
import useUnsavedChanges from '../hooks/useUnsavedChanges'
import UnsavedChangesSheet from '../components/UnsavedChangesSheet'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', forestDark: '#2E5038', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0', sage: '#7A8C6E', honey: '#C49A3C', red: '#A03030',
}

// METHOD_OPTIONS retired — methods now loaded from recipe_method_definitions
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

export default function SaveRecipe({ appUser }) {
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = location.state?.returnTo
  const plannedMealId = location.state?.plannedMealId
  const prefillName = location.state?.mealName

  // Flow state: 'choose' | 'url' | 'photo' | 'form'
  const [step, setStep] = useState('choose')
  const [sourceType, setSourceType] = useState('manual') // 'url' | 'photo' | 'manual'

  // Extraction state
  const [urlInput, setUrlInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState(null)
  // Typed URL error: null | { type: 'blocked_domain', site } | { type: 'fetch_failed' } | { type: 'parse_failed' } | { type: 'timeout' }
  const [urlError, setUrlError] = useState(null)
  const [extractMessage, setExtractMessage] = useState('')
  const extractTimersRef = useRef(null)

  // Multi-photo capture state
  const [capturedPhotos, setCapturedPhotos] = useState([]) // [{ file, preview, id }]
  const photoInputRef = useRef(null)

  // Recipe form fields
  const [name, setName] = useState(prefillName || '')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [category, setCategory] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [method, setMethod] = useState('') // deprecated text column — kept for read, no longer written
  const [difficulty, setDifficulty] = useState('')
  const [prepTime, setPrepTime] = useState('')
  const [cookTime, setCookTime] = useState('')
  const [servings, setServings] = useState('')
  const [personalNotes, setPersonalNotes] = useState('')
  const [variations, setVariations] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [ingredients, setIngredients] = useState([])
  const [instructions, setInstructions] = useState([])
  const [tagDefs, setTagDefs] = useState([])
  const [selectedTagIds, setSelectedTagIds] = useState(new Set())
  const [newTagOpen, setNewTagOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [methodDefs, setMethodDefs] = useState([])
  const [selectedMethodIds, setSelectedMethodIds] = useState(new Set())
  const [newMethodOpen, setNewMethodOpen] = useState(false)
  const [newMethodName, setNewMethodName] = useState('')

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

  // Unsaved changes guard
  const dirty = useUnsavedChanges()

  // Load tag definitions
  useEffect(() => {
    if (!appUser?.household_id) return
    supabase.from('recipe_tag_definitions').select('*').eq('household_id', appUser.household_id).order('sort_order')
      .then(({ data }) => setTagDefs(data || []))
    supabase.from('recipe_method_definitions').select('*').eq('household_id', appUser.household_id).order('name')
      .then(async ({ data }) => {
        if (data?.length) { setMethodDefs(data); return }
        // Seed defaults if none exist for this household
        const defaults = ['Stovetop', 'Baked', 'Slow Cooker', 'Instant Pot', 'Air Fryer', 'Grilled', 'No-Cook', 'Other']
        const { data: seeded } = await supabase.from('recipe_method_definitions')
          .insert(defaults.map(name => ({ household_id: appUser.household_id, name, is_default: true })))
          .select('*')
        setMethodDefs(seeded || [])
      })
  }, [appUser?.household_id])

  // ── Multi-photo capture ──────────────────────────────────────
  function handlePhotoCaptured(e) {
    const file = e.target.files?.[0]
    if (!file || capturedPhotos.length >= MAX_PHOTOS) return
    dirty.markDirty()
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
  function clearExtractTimers() {
    if (extractTimersRef.current) {
      clearInterval(extractTimersRef.current.interval)
      clearTimeout(extractTimersRef.current.timeout)
      extractTimersRef.current = null
    }
  }

  function startExtractTimers() {
    const messages = [
      'Reading the page...',
      'Pulling out the ingredients...',
      "Almost there — this one's a bit complex...",
      'Still working — some sites take a little longer...',
    ]
    let idx = 0
    setExtractMessage(messages[0])
    const interval = setInterval(() => {
      idx = Math.min(idx + 1, messages.length - 1)
      setExtractMessage(messages[idx])
    }, 6000)
    // Hard client-side timeout: 28s (3s buffer after 25s server timeout)
    const timeout = setTimeout(() => {
      clearInterval(interval)
      setExtracting(false)
      setUrlError({ type: 'timeout' })
    }, 28000)
    extractTimersRef.current = { interval, timeout }
  }

  async function handleUrlExtract() {
    if (!urlInput.trim() || extracting) return
    setExtracting(true)
    setExtractError(null)
    setUrlError(null)
    clearExtractTimers()
    startExtractTimers()
    try {
      const response = await fetch('/api/extract-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      const data = await response.json()
      clearExtractTimers()
      if (!response.ok || !data.success) {
        const errType = data.error
        if (errType === 'fetch_failed' || errType === 'parse_failed' || errType === 'timeout') {
          setUrlError({ type: errType })
          setExtracting(false)
          return
        }
        throw new Error(data.error || 'Extraction failed')
      }
      applyExtractedRecipe(data.recipe, urlInput.trim())
    } catch (err) {
      console.error('[SaveRecipe] URL extraction error:', err)
      clearExtractTimers()
      setUrlError({ type: 'fetch_failed' })
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
      const images = []
      const mediaTypes = []
      for (const photo of capturedPhotos) {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(photo.file)
        })
        images.push(base64)
        mediaTypes.push(photo.file.type || 'image/jpeg')
      }

      const response = await fetch('/api/extract-recipe-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, mediaTypes }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Photo extraction failed')
      }
      applyExtractedRecipe(data.recipe, null)
    } catch (err) {
      console.error('[SaveRecipe] Photo extraction error:', err)
      setExtractError("Couldn't read the photo clearly. Try a clearer photo, or enter the recipe manually.")
      setExtracting(false)
    }
  }

  // ── Apply extracted recipe object to form ────────────────────
  function applyExtractedRecipe(recipe, url) {
    setName(recipe.name || '')
    setDescription(recipe.description || '')
    setAuthor(recipe.author || '')
    setSourceUrl(url || recipe.source_url || '')
    // Match category to tag system
    if (recipe.category) matchCategoryToTags(recipe.category)
    setCuisine(recipe.cuisine || '')
    setMethod(recipe.method || '')
    setDifficulty(recipe.difficulty || '')
    setPrepTime(recipe.prep_time_minutes ? String(recipe.prep_time_minutes) : '')
    setCookTime(recipe.cook_time_minutes ? String(recipe.cook_time_minutes) : '')
    setServings(recipe.servings || '')
    setPersonalNotes(recipe.personal_notes || '')

    if (Array.isArray(recipe.ingredients)) {
      setIngredients(recipe.ingredients.map((ing, i) => {
        const rawName = String(ing.name || '')
        // Parse "X or Y" into primary + alternative
        const orMatch = rawName.match(/^(.+?)\s+or\s+(.+)$/i)
        const alternatives = orMatch ? [{
          _key: tempId(), quantity: ing.quantity || '', unit: ing.unit || 'piece',
          name: orMatch[2].trim(), sort_order: 0,
        }] : []
        return {
          _key: tempId(),
          quantity: ing.quantity || '',
          unit: ing.unit || 'piece',
          name: orMatch ? orMatch[1].trim() : rawName,
          sort_order: i,
          pantry_item_id: null,
          alternatives,
        }
      }))
    }
    if (Array.isArray(recipe.instructions)) {
      setInstructions(recipe.instructions.map((ins) => ({
        _key: tempId(),
        instruction: ins.instruction || '',
        step_number: ins.step_number || 1,
      })))
    }

    setExtracting(false)
    setStep('form')
    dirty.markDirty()
  }

  // ── Tag helpers ───────────────────────────────────────────────
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
    }
    setNewTagName('')
    setNewTagOpen(false)
  }

  // ── Method helpers ─────────────────────────────────────────────
  async function handleCreateMethod() {
    if (!newMethodName.trim()) return
    const { data } = await supabase.from('recipe_method_definitions').insert({
      household_id: appUser.household_id,
      name: newMethodName.trim(),
      is_default: false,
    }).select('*').single()
    if (data) {
      setMethodDefs(prev => [...prev, data])
      setSelectedMethodIds(prev => new Set([...prev, data.id]))
    }
    setNewMethodName('')
    setNewMethodOpen(false)
  }

  async function matchCategoryToTags(categoryStr) {
    if (!categoryStr) return
    const cat = String(categoryStr).trim().toLowerCase()
    // Check existing tags for a case-insensitive match
    const match = tagDefs.find(t => t.name.toLowerCase() === cat)
    if (match) {
      setSelectedTagIds(prev => new Set([...prev, match.id]))
      return
    }
    // Create a new tag definition
    const { data } = await supabase.from('recipe_tag_definitions').insert({
      household_id: appUser.household_id,
      name: categoryStr.trim(),
      sort_order: tagDefs.length + 1,
    }).select('*').single()
    if (data) {
      setTagDefs(prev => [...prev, data])
      setSelectedTagIds(prev => new Set([...prev, data.id]))
    }
  }

  // ── Go to manual form ────────────────────────────────────────
  function startManual() {
    setSourceType('manual')
    setIngredients([{ _key: tempId(), quantity: '', unit: 'piece', name: '', sort_order: 0, pantry_item_id: null }])
    setInstructions([{ _key: tempId(), instruction: '', step_number: 1 }])
    setStep('form')
    dirty.markDirty()
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
  // Safe string coercion — Sage may return numbers or null for string fields
  const s = (val) => (val == null ? '' : String(val).trim())

  async function handleSave() {
    const safeName = s(name)
    if (!safeName || saving) return
    setSaving(true)
    setError(null)
    try {
      const prep = parseInt(prepTime) || null
      const cook = parseInt(cookTime) || null

      // 1. Insert recipe
      const { data: newRecipe, error: recErr } = await supabase.from('recipes').insert({
        household_id: appUser.household_id,
        added_by: appUser.id,
        name: s(name),
        description: s(description) || null,
        author: s(author) || null,
        source_type: sourceType,
        source_url: s(sourceUrl) || null,
        category: s(category) || null,
        cuisine: s(cuisine) || null,
        difficulty: s(difficulty) || null,
        prep_time_minutes: prep,
        cook_time_minutes: cook,
        total_time_minutes: (prep || 0) + (cook || 0) || null,
        servings: s(servings) || null,
        personal_notes: s(personalNotes) || null,
        variations: s(variations) || null,
        photo_url: photoUrl || null,
        recipe_type: 'full',
        status: 'complete',
        visibility: 'household',
      }).select('id').single()

      if (recErr) throw recErr
      const recipeId = newRecipe.id

      // 2. Ensure pantry items + insert ingredients
      const validIngs = ingredients.filter(i => s(i.name))
      for (const ing of validIngs) {
        if (!ing.pantry_item_id) {
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
        recipe_id: recipeId,
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
      const altsForIngs = validIngs.filter(i => (i.alternatives || []).length > 0)
      if (altsForIngs.length > 0) {
        const { data: savedIngs } = await supabase.from('ingredients').select('id, name').eq('recipe_id', recipeId)
        if (savedIngs) {
          const altRows = []
          for (const orig of altsForIngs) {
            const match = savedIngs.find(si => s(si.name).toLowerCase() === s(orig.name).toLowerCase())
            if (!match) continue
            for (const alt of orig.alternatives) {
              altRows.push({
                primary_ingredient_id: match.id,
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

      // 3. Insert instructions
      const insRows = instructions.filter(i => s(i.instruction)).map((i, idx) => ({
        recipe_id: recipeId,
        step_number: idx + 1,
        instruction: s(i.instruction),
        tip: s(i.tip) || null,
      }))
      if (insRows.length > 0) {
        const { error: insErr } = await supabase.from('instructions').insert(insRows)
        if (insErr) throw insErr
      }

      // 3b. Save tags
      if (selectedTagIds.size > 0) {
        await supabase.from('recipe_tags').insert(
          [...selectedTagIds].map(tagId => ({ recipe_id: recipeId, tag_id: tagId }))
        )
      }

      // 3c. Save methods
      if (selectedMethodIds.size > 0) {
        await supabase.from('recipe_methods').insert(
          [...selectedMethodIds].map(mid => ({ recipe_id: recipeId, method_definition_id: mid, household_id: appUser.household_id }))
        )
      }

      // 4. Upload captured photos permanently to recipe_photos
      if (sourceType === 'photo' && capturedPhotos.length > 0) {
        await uploadCapturedPhotos(recipeId)
      }

      // 5. Fire-and-forget Sage ingredient review + categorization
      runSageIngredientReview(recipeId, validIngs, { recipeName: s(name), userId: appUser?.id })
      // Fetch inserted ingredient IDs for categorization
      supabase.from('ingredients').select('id, name, grocery_category, categorization_status').eq('recipe_id', recipeId)
        .then(({ data }) => { if (data?.length) categorizeIngredientsWithSage(data, { recipeName: s(name), recipeId, appUser }) })
      logActivity({ user: appUser, actionType: 'recipe_saved', targetType: 'recipe', targetId: recipeId, targetName: s(name), metadata: { source_type: sourceType } })

      // If coming from week view, link recipe to the planned meal via junction table
      if (returnTo === 'week' && plannedMealId) {
        await supabase.from('planned_meal_recipes').upsert(
          { planned_meal_id: plannedMealId, recipe_id: recipeId, sort_order: 0 },
          { onConflict: 'planned_meal_id,recipe_id' }
        )
        await supabase.from('planned_meals').update({
          entry_type: 'linked', sage_match_status: 'resolved',
        }).eq('id', plannedMealId)
      } else {
        // Reverse match — check if any ghost meals match this new recipe name
        sageReverseMatch({ recipeId, recipeName: s(name), appUser })
      }

      dirty.markClean()
      setToast('Recipe saved.')
      setTimeout(() => navigate(returnTo === 'week' ? '/plan' : `/recipe/${recipeId}`), 1200)
    } catch (err) {
      console.error('[SaveRecipe] Save error:', err)
      setError('Something went wrong. Check your changes and try again.')
      setSaving(false)
    }
  }

  // ── Back handler ─────────────────────────────────────────────
  function doBack() {
    if (step === 'form') {
      setStep('choose')
    } else if (step === 'url' || step === 'photo') {
      setStep('choose')
      setExtractError(null)
      setExtracting(false)
      setUrlError(null)
    } else {
      navigate('/meals/recipes')
    }
  }
  function handleBack() {
    dirty.guardNavigation(doBack)
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
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, marginBottom: '4px' }}>
                  Paste a URL
                </div>
                <div style={{ fontSize: '13px', color: C.driftwood, fontWeight: 300 }}>
                  Share a link and Roux reads it for you
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
            onChange={e => { setUrlInput(e.target.value); setUrlError(null) }}
            placeholder="https://..."
            autoFocus
            style={{ ...inputStyle, fontSize: '15px' }}
            onKeyDown={e => { if (e.key === 'Enter') handleUrlExtract() }}
          />
          {!urlError && !extracting && (
            <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300, fontStyle: 'italic', marginTop: '-10px' }}>
              Works best with food blogs and smaller recipe sites. Major sites like AllRecipes block direct import.
            </div>
          )}

          {extractError && (
            <div style={{ fontSize: '13px', color: C.red, lineHeight: 1.5 }}>{extractError}</div>
          )}

          {/* Typed error messages with quick actions */}
          {urlError && (
            <div style={{
              padding: '16px', background: 'white', borderRadius: '12px',
              borderLeft: `3px solid ${C.honey}`,
            }}>
              {urlError.type === 'timeout' ? (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '24px', color: C.driftwood }}>✦</span>
                    <div style={{ fontSize: '14px', color: C.ink, lineHeight: 1.6, marginTop: '8px' }}>
                      Had trouble reading that page — the site may be blocking access or took too long to respond.
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={() => { setUrlError(null); handleUrlExtract() }} style={{
                      padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                      background: C.forest, color: 'white',
                      fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                    }}>
                      Try again
                    </button>
                    <button onClick={() => { setUrlError(null); startManual() }} style={{
                      padding: '12px', borderRadius: '10px', cursor: 'pointer',
                      background: 'transparent', color: C.forest,
                      border: `1.5px solid ${C.forest}`,
                      fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                    }}>
                      Add manually instead
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '14px', color: C.ink, lineHeight: 1.6, marginBottom: '14px' }}>
                    {urlError.type === 'fetch_failed' && (
                      <>Couldn't reach that page — the link may be broken or the site may be temporarily down. Double-check the URL and try again, or use one of these instead:</>
                    )}
                    {urlError.type === 'parse_failed' && (
                      <>Found the page but had trouble reading the recipe format. Try a photo of the recipe or enter it manually.</>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => { setSourceType('photo'); setUrlError(null); setStep('photo') }} style={{
                      flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                      background: C.forest, color: 'white',
                      fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 500,
                    }}>
                      Take a photo →
                    </button>
                    <button onClick={() => { setUrlError(null); startManual() }} style={{
                      flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer',
                      background: 'transparent', color: C.forest,
                      border: `1.5px solid ${C.forest}`,
                      fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 500,
                    }}>
                      Enter it manually →
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {extracting ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ display: 'inline-block', width: '32px', height: '32px', border: `3px solid ${C.linen}`, borderTop: `3px solid ${C.forest}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ marginTop: '12px', fontSize: '14px', color: C.driftwood, fontStyle: 'italic' }}>
                {extractMessage}
              </div>
            </div>
          ) : !urlError && (
            <button onClick={handleUrlExtract} disabled={!urlInput.trim()} style={{
              padding: '16px', borderRadius: '14px', border: 'none', cursor: urlInput.trim() ? 'pointer' : 'default',
              background: urlInput.trim() ? C.forest : C.linen,
              color: urlInput.trim() ? 'white' : C.driftwood,
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
              boxShadow: urlInput.trim() ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
            }}>
              Let Roux read it for you
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
                  : `${capturedPhotos.length} photos — Roux will combine them into one recipe.`}
              </div>

              {extractError && (
                <div style={{ fontSize: '13px', color: C.red, lineHeight: 1.5 }}>{extractError}</div>
              )}

              {extracting ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ display: 'inline-block', width: '32px', height: '32px', border: `3px solid ${C.linen}`, borderTop: `3px solid ${C.forest}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <div style={{ marginTop: '12px', fontSize: '14px', color: C.driftwood, fontStyle: 'italic' }}>
                    Reading {capturedPhotos.length > 1 ? `all ${capturedPhotos.length} photos` : 'the recipe'}...
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
              Here's what was found. Review and adjust anything before saving.
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
            <div style={labelStyle}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: tagDefs.some(t => !t.is_default) ? '0' : '6px' }}>
              {tagDefs.filter(t => t.is_default).map(tag => {
                const active = selectedTagIds.has(tag.id)
                return (
                  <button key={tag.id} onClick={() => setSelectedTagIds(prev => { const n = new Set(prev); n.has(tag.id) ? n.delete(tag.id) : n.add(tag.id); return n })} style={{
                    padding: '5px 12px', borderRadius: '16px', fontSize: '12px',
                    border: active ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                    background: active ? 'rgba(61,107,79,0.08)' : 'white',
                    color: active ? C.forest : C.ink, cursor: 'pointer',
                    fontFamily: "'Jost', sans-serif", fontWeight: active ? 500 : 400,
                  }}>{tag.name}</button>
                )
              })}
            </div>
            {tagDefs.some(t => !t.is_default) && (
              <>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 300, margin: '10px 0 6px', fontFamily: "'Jost', sans-serif" }}>Your tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                  {tagDefs.filter(t => !t.is_default).map(tag => {
                    const active = selectedTagIds.has(tag.id)
                    return (
                      <button key={tag.id} onClick={() => setSelectedTagIds(prev => { const n = new Set(prev); n.has(tag.id) ? n.delete(tag.id) : n.add(tag.id); return n })} style={{
                        padding: '5px 12px', borderRadius: '16px', fontSize: '12px',
                        border: active ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                        background: active ? 'rgba(61,107,79,0.08)' : 'white',
                        color: active ? C.forest : C.ink, cursor: 'pointer',
                        fontFamily: "'Jost', sans-serif", fontWeight: active ? 500 : 400,
                      }}>{tag.name}</button>
                    )
                  })}
                </div>
              </>
            )}
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
          <div>
            <div style={labelStyle}>Cuisine</div>
            <input type="text" value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="e.g. Italian" style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>Method</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: methodDefs.some(m => !m.is_default) ? '0' : '6px' }}>
              {methodDefs.filter(m => m.is_default).map(md => {
                const active = selectedMethodIds.has(md.id)
                return (
                  <button key={md.id} onClick={() => setSelectedMethodIds(prev => { const n = new Set(prev); n.has(md.id) ? n.delete(md.id) : n.add(md.id); return n })} style={{
                    padding: '5px 12px', borderRadius: '16px', fontSize: '12px',
                    border: active ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                    background: active ? 'rgba(61,107,79,0.08)' : 'white',
                    color: active ? C.forest : C.ink, cursor: 'pointer',
                    fontFamily: "'Jost', sans-serif", fontWeight: active ? 500 : 400,
                  }}>{md.name}</button>
                )
              })}
            </div>
            {methodDefs.some(m => !m.is_default) && (
              <>
                <div style={{ fontSize: '9px', letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 300, margin: '10px 0 6px', fontFamily: "'Jost', sans-serif" }}>Your methods</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                  {methodDefs.filter(m => !m.is_default).map(md => {
                    const active = selectedMethodIds.has(md.id)
                    return (
                      <button key={md.id} onClick={() => setSelectedMethodIds(prev => { const n = new Set(prev); n.has(md.id) ? n.delete(md.id) : n.add(md.id); return n })} style={{
                        padding: '5px 12px', borderRadius: '16px', fontSize: '12px',
                        border: active ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                        background: active ? 'rgba(61,107,79,0.08)' : 'white',
                        color: active ? C.forest : C.ink, cursor: 'pointer',
                        fontFamily: "'Jost', sans-serif", fontWeight: active ? 500 : 400,
                      }}>{md.name}</button>
                    )
                  })}
                </div>
              </>
            )}
            {newMethodOpen ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="text" value={newMethodName} onChange={e => setNewMethodName(e.target.value)}
                  placeholder="Type a method name..." autoFocus
                  style={{ ...inputStyle, fontSize: '12px', flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateMethod() }} />
                <button onClick={handleCreateMethod} disabled={!newMethodName.trim()} style={{
                  padding: '6px 12px', borderRadius: '8px', border: 'none', fontSize: '11px', fontWeight: 500,
                  background: newMethodName.trim() ? C.forest : C.linen,
                  color: newMethodName.trim() ? 'white' : C.driftwood,
                  cursor: newMethodName.trim() ? 'pointer' : 'default', fontFamily: "'Jost', sans-serif",
                }}>Add</button>
              </div>
            ) : (
              <button onClick={() => setNewMethodOpen(true)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                fontSize: '12px', color: C.driftwood, fontWeight: 300, fontFamily: "'Jost', sans-serif",
              }}>+ Add a method</button>
            )}
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

      <UnsavedChangesSheet
        open={dirty.showConfirm}
        onStay={dirty.cancelLeave}
        onLeave={dirty.confirmLeave}
        title="Step away from the stove?"
        message="You found a recipe — want to save it first?"
        stayLabel="Keep cooking"
        leaveLabel="Leave anyway"
      />

      <BottomNav activeTab="meals" onBeforeNavigate={dirty.guardNavigation} />
    </div>
  )
}
