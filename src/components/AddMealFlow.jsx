import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { sageMealMatch } from '../lib/sageMealMatch'
import { injectSingleMeal } from '../lib/injectSingleMeal'
import { toLocalDateStr } from '../lib/dateUtils'
import TopBar from './TopBar'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0',
  sage: '#7A8C6E', honey: '#C49A3C', honeyDark: '#7A5C14',
}

const DOW_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_ABBR = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const MEAL_TYPE_LABELS = { dinner: 'Dinner', lunch: 'Lunch', breakfast: 'Breakfast', snack: 'Snack', other: 'Other', leftovers: 'Leftovers', eating_out: 'Eating Out' }
const BATCH_OPTIONS = [0.5, 1, 1.5, 2, 3]
const BATCH_LABELS = { 0.5: '½', 1: '1', 1.5: '1½', 2: '2', 3: '3' }
const STEP_BACK = { name: 'type', confirm: 'name', details: 'confirm', 'left-source': 'type', 'left-details': 'left-source', 'eat-name': 'type', 'eat-cost': 'eat-name', 'eat-details': 'eat-cost' }

export default function AddMealFlow({
  isOpen, date, prefill, onClose, onMealsAdded,
  appUser, arcColor, weekDates,
  meals, planId, ensurePlan, shoppingInjected,
  familyMembers, dismissedMeals, setDismissedMeals,
  showToast, showHint, setShowHint,
  addSheetRecipes, setAddSheetRecipes,
  setAddSheetLinkOpen, openLinkSheet,
  onFirstMealAdded,
}) {
  const navigate = useNavigate()

  const [step, setStep] = useState('type')
  const [addInput, setAddInput] = useState('')
  const [addMealType, setAddMealType] = useState('dinner')
  const [addMealCategory, setAddMealCategory] = useState(null)
  const [recipeSuggestions, setRecipeSuggestions] = useState([])
  const [adding, setAdding] = useState(false)
  const [addBatchMultiplier, setAddBatchMultiplier] = useState(1.0)
  const [addEatingOutCost, setAddEatingOutCost] = useState('')
  const debounceRef = useRef(null)

  const [repeatDays, setRepeatDays] = useState(new Set())
  const [recentMeals, setRecentMeals] = useState([])
  const [selectedSourceMeal, setSelectedSourceMeal] = useState(null)
  const [leftoversFreeText, setLeftoversFreeText] = useState('')
  const [selectedMembers, setSelectedMembers] = useState(new Set())
  const [noRecipeNeeded, setNoRecipeNeeded] = useState(false)
  const [linkedRecipes, setLinkedRecipes] = useState([])

  // Sync internal linkedRecipes from parent prop (link sheet writes to parent)
  useEffect(() => { setLinkedRecipes(addSheetRecipes) }, [addSheetRecipes])

  useEffect(() => {
    if (!isOpen) return
    setStep('type')
    setAddInput(prefill?.name || '')
    setAddMealType(prefill?.mealType || 'dinner')
    setAddMealCategory(null)
    setRecipeSuggestions([])
    setAddBatchMultiplier(1.0)
    setAddEatingOutCost('')
    setRepeatDays(new Set())
    setSelectedSourceMeal(null)
    setLeftoversFreeText('')
    setRecentMeals([])
    setSelectedMembers(new Set())
    setNoRecipeNeeded(false)
    setAddSheetRecipes([])
    if (prefill?.name) {
      setStep('name')
      if (prefill.mealType) setAddMealType(prefill.mealType)
    }
  }, [isOpen, date])

  useEffect(() => {
    if (step !== 'left-source' || !appUser?.household_id) return
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    supabase.from('planned_meals')
      .select('id, custom_name, planned_date, meal_type')
      .eq('household_id', appUser.household_id)
      .neq('meal_type', 'leftovers').neq('meal_type', 'eating_out')
      .not('custom_name', 'ilike', 'Leftovers%')
      .is('removed_at', null)
      .gte('planned_date', twoWeeksAgo.toISOString().split('T')[0])
      .order('planned_date', { ascending: false }).limit(15)
      .then(({ data }) => {
        const seen = new Set()
        setRecentMeals((data ?? []).filter(m => {
          if (!m.custom_name || seen.has(m.custom_name)) return false
          seen.add(m.custom_name)
          return true
        }))
      })
  }, [step])

  function formatMealDate(dateStr) {
    if (!dateStr) return ''
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
    const diff = Math.floor((today - d) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'today'
    if (diff === 1) return 'yesterday'
    if (diff < 0) return 'upcoming'
    return `${diff} days ago`
  }

  function handleAddInputChange(val) {
    setAddInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setRecipeSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      let query = supabase.from('planned_meals')
        .select('id, custom_name, recipe_id, entry_type, meal_type')
        .eq('household_id', appUser.household_id)
        .not('custom_name', 'is', null)
        .ilike('custom_name', `%${val.trim()}%`)
        .order('created_at', { ascending: false }).limit(10)
      if (addMealCategory === 'eating_out') {
        query = query.eq('entry_type', 'eating_out')
      } else {
        query = query.neq('entry_type', 'eating_out')
      }
      const { data: historyData } = await query
      const seen = new Set()
      setRecipeSuggestions((historyData || []).filter(m => {
        const key = m.custom_name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      }).slice(0, 6).map(m => ({
        id: m.id, name: m.custom_name, recipe_id: m.recipe_id || null,
        entry_type: m.entry_type, meal_type: m.meal_type,
      })))
    }, 200)
  }

  function selectRecipeSuggestion(suggestion) {
    setAddInput(suggestion.name)
    const mealTimes = new Set(['breakfast', 'lunch', 'dinner', 'snack'])
    if (suggestion.meal_type && mealTimes.has(suggestion.meal_type)) setAddMealType(suggestion.meal_type)
    setRecipeSuggestions([])
    advanceFromName(suggestion.name)
  }

  async function advanceFromName(name) {
    const mealName = name || addInput.trim()
    if (!mealName) return
    const key = mealName.toLowerCase()
    const { data: pref } = await supabase.from('sage_meal_preferences')
      .select('recipe_id, no_recipe_needed')
      .eq('household_id', appUser.household_id)
      .eq('meal_name', key).maybeSingle()
    if (pref?.no_recipe_needed) {
      setNoRecipeNeeded(true)
      setDismissedMeals(prev => new Set([...prev, key]))
      setStep('details')
      return
    }
    if (pref?.recipe_id) {
      const { data: recipe } = await supabase.from('recipes').select('id, name, recipe_type').eq('id', pref.recipe_id).maybeSingle()
      if (recipe) {
        const linked = [{ recipe_id: recipe.id, recipe_name: recipe.name }]
        setLinkedRecipes(linked)
        setAddSheetRecipes(linked)
        if (recipe.recipe_type === 'quick') { setStep('details'); return }
      }
    }
    setStep('confirm')
  }

  // ── DB write — identical to previous implementation ──────────
  async function addMeal() {
    const isLeftovers = addMealCategory === 'leftovers'
    const leftoversSource = selectedSourceMeal?.custom_name || leftoversFreeText.trim()
    if (isLeftovers) { if (!leftoversSource || adding) return }
    else { if (!addInput.trim() || adding) return }

    setAdding(true)
    try {
      const mpId = await ensurePlan()
      if (!mpId) { setAdding(false); return }

      if (isLeftovers) {
        const dateStr = toLocalDateStr(date)
        const dowKey = DOW_KEYS[date.getDay() === 0 ? 6 : date.getDay() - 1]
        const customName = `Leftovers — ${leftoversSource}`
        const { data, error } = await supabase.from('planned_meals').insert({
          household_id: appUser.household_id, meal_plan_id: mpId,
          day_of_week: dowKey, meal_type: addMealType, planned_date: dateStr,
          custom_name: customName, recipe_id: null, entry_type: 'ghost',
          slot_type: 'note', status: 'planned',
          sort_order: meals.filter(m => m.day_of_week === dowKey).length,
          batch_multiplier: 1, source_meal_id: selectedSourceMeal?.id || null,
          source_meal_name: leftoversSource,
        }).select('*').single()
        if (error) throw error
        if (selectedMembers.size > 0) {
          await supabase.from('planned_meal_members').insert(
            Array.from(selectedMembers).map(n => ({ household_id: appUser.household_id, planned_meal_id: data.id, member_name: n }))
          )
        }
        onMealsAdded([{ ...data, linkedRecipes: [], recipes: null, members: Array.from(selectedMembers) }])
        onClose()
        showToast(`Added ${customName}`)
        logActivity({ user: appUser, actionType: 'meal_added_to_week', targetType: 'meal', targetId: data.id, targetName: customName, metadata: { entry_type: 'leftovers' } })
        if (showHint || !appUser.has_planned_first_meal) { setShowHint(false); supabase.from('users').update({ has_planned_first_meal: true }).eq('id', appUser.id) }
        setAdding(false)
        return
      }

      const isEatingOut = addMealCategory === 'eating_out'
      const hasRecipes = !isEatingOut && linkedRecipes.length > 0
      const eatingOutCost = isEatingOut && addEatingOutCost.trim() ? parseFloat(addEatingOutCost.replace(/[^0-9.]/g, '')) : null
      const datesToCreate = [date]
      if (repeatDays.size > 0) {
        for (const dowIdx of repeatDays) {
          const repeatDate = new Date(weekDates[dowIdx])
          if (toLocalDateStr(repeatDate) !== toLocalDateStr(date)) datesToCreate.push(repeatDate)
        }
      }
      const allEnriched = []
      let firstData = null
      for (const targetDate of datesToCreate) {
        const dateStr = toLocalDateStr(targetDate)
        const dowKey = DOW_KEYS[targetDate.getDay() === 0 ? 6 : targetDate.getDay() - 1]
        const { data, error } = await supabase.from('planned_meals').insert({
          household_id: appUser.household_id, meal_plan_id: mpId,
          day_of_week: dowKey, meal_type: addMealType, planned_date: dateStr,
          custom_name: addInput.trim(), recipe_id: null,
          entry_type: isEatingOut ? 'eating_out' : hasRecipes ? 'linked' : 'ghost',
          slot_type: isEatingOut ? 'note' : hasRecipes ? 'recipe' : 'note',
          status: 'planned', sort_order: meals.filter(m => m.day_of_week === dowKey).length,
          batch_multiplier: isEatingOut ? 1 : addBatchMultiplier,
          previous_batch_multiplier: isEatingOut ? 1 : addBatchMultiplier,
          eating_out_cost: eatingOutCost && !isNaN(eatingOutCost) ? eatingOutCost : null,
        }).select('*').single()
        if (error) throw error
        if (!firstData) firstData = data
        if (hasRecipes) await supabase.from('planned_meal_recipes').insert(linkedRecipes.map((r, i) => ({ planned_meal_id: data.id, recipe_id: r.recipe_id, sort_order: i })))
        if (selectedMembers.size > 0) await supabase.from('planned_meal_members').insert(Array.from(selectedMembers).map(n => ({ household_id: appUser.household_id, planned_meal_id: data.id, member_name: n })))
        allEnriched.push({ ...data, linkedRecipes: hasRecipes ? [...linkedRecipes] : [], recipes: null, members: Array.from(selectedMembers) })
        if (!hasRecipes && !isEatingOut && data === firstData) sageMealMatch({ mealId: data.id, mealName: addInput.trim(), householdId: appUser.household_id })
        if (hasRecipes && shoppingInjected && mpId) injectSingleMeal({ mealId: data.id, mealName: addInput.trim(), batchMultiplier: addBatchMultiplier, planId: mpId, householdId: appUser.household_id, legacyRecipeId: data.recipe_id || null })
      }
      if (hasRecipes && addInput.trim()) {
        const key = addInput.trim().toLowerCase()
        supabase.from('sage_meal_preferences').upsert({ household_id: appUser.household_id, meal_name: key, no_recipe_needed: false, recipe_id: linkedRecipes[0].recipe_id }, { onConflict: 'household_id,meal_name' })
        setDismissedMeals(prev => { const next = new Set(prev); next.delete(key); return next })
      }
      onMealsAdded(allEnriched)
      onClose()
      const dayCount = datesToCreate.length
      showToast(dayCount > 1 ? `Added ${addInput.trim()} to ${dayCount} days` : `Added ${addInput.trim()}`)
      logActivity({ user: appUser, actionType: 'meal_added_to_week', targetType: 'meal', targetId: firstData.id, targetName: addInput.trim(), metadata: { day_count: dayCount, entry_type: isEatingOut ? 'eating_out' : hasRecipes ? 'linked' : 'ghost' } })
      if (showHint || !appUser.has_planned_first_meal) { setShowHint(false); supabase.from('users').update({ has_planned_first_meal: true }).eq('id', appUser.id) }
      if (onFirstMealAdded) onFirstMealAdded()
    } catch (err) { console.error('[Menu] Add meal error:', err) }
    setAdding(false)
  }

  if (!isOpen || !date) return null

  const dateLabel = `${DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1]}, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  const stepBack = () => { const prev = STEP_BACK[step]; if (prev) setStep(prev); else onClose() }
  const canSave = addMealCategory === 'leftovers' ? !!(selectedSourceMeal || leftoversFreeText.trim()) : !!addInput.trim()

  const shell = (children) => (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: C.cream, overflowY: 'auto', maxWidth: '430px', margin: '0 auto' }}>
      <TopBar leftAction={{ onClick: step === 'type' ? onClose : stepBack, label: 'Back' }} />
      <div key={step} style={{ padding: '16px 22px 40px', animation: 'fadeUp 0.2s ease both' }}>
        {children}
      </div>
    </div>
  )

  const typeBtn = (label, sub, onClick) => (
    <button onClick={onClick} style={{
      padding: '18px 16px', borderRadius: '14px', border: `1px solid ${C.linen}`,
      background: 'white', cursor: 'pointer', textAlign: 'left', fontFamily: "'Jost', sans-serif", width: '100%',
    }}>
      <div style={{ fontSize: '15px', fontWeight: 500, color: C.ink }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300, marginTop: '2px' }}>{sub}</div>}
    </button>
  )

  const ctaBtn = (label, enabled, onClick) => (
    <button onClick={onClick} disabled={!enabled || adding} style={{
      width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
      background: enabled ? arcColor : C.linen, color: enabled ? 'white' : C.driftwood,
      cursor: enabled ? 'pointer' : 'default', fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
      boxShadow: enabled ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
    }}>{adding ? 'Adding...' : label}</button>
  )

  const sectionLabel = (text) => (
    <div style={{ fontSize: '11px', color: C.driftwood, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>{text}</div>
  )

  // ── Repeat days picker (shared by details steps) ──────────
  const renderRepeatDays = () => (
    <div style={{ marginBottom: '16px' }}>
      {sectionLabel('Repeat this week')}
      <div style={{ display: 'flex', gap: '6px' }}>
        {weekDates.map((d, i) => {
          const isCurrentDay = toLocalDateStr(d) === toLocalDateStr(date)
          const isSelected = repeatDays.has(i)
          return (
            <button key={i} onClick={() => {
              if (isCurrentDay) return
              setRepeatDays(prev => { const next = new Set(prev); if (next.has(i)) next.delete(i); else next.add(i); return next })
            }} style={{
              flex: 1, padding: '8px 0', borderRadius: '8px',
              border: `0.5px solid ${isSelected ? arcColor : C.linen}`,
              background: isCurrentDay ? C.linen : isSelected ? arcColor : 'white',
              color: isCurrentDay ? C.driftwood : isSelected ? 'white' : C.driftwood,
              fontSize: '11px', fontFamily: "'Jost', sans-serif",
              cursor: isCurrentDay ? 'default' : 'pointer', opacity: isCurrentDay ? 0.5 : 1,
            }}>{DAY_ABBR[i].charAt(0)}</button>
          )
        })}
      </div>
    </div>
  )

  // ── Member tags picker (shared by details steps) ──────────
  const renderMemberTags = () => familyMembers.length > 0 && (
    <div style={{ marginBottom: '16px' }}>
      {sectionLabel('For (optional)')}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {familyMembers.map(member => {
          const firstName = member.name.split(' ')[0]
          const isSelected = selectedMembers.has(member.name)
          return (
            <button key={member.id} onClick={() => {
              setSelectedMembers(prev => { const next = new Set(prev); if (next.has(member.name)) next.delete(member.name); else next.add(member.name); return next })
            }} style={{
              padding: '6px 12px', borderRadius: '20px',
              border: `0.5px solid ${isSelected ? arcColor : C.linen}`,
              background: isSelected ? `${arcColor}15` : 'white',
              color: isSelected ? arcColor : C.driftwood,
              fontSize: '12px', fontFamily: "'Jost', sans-serif", cursor: 'pointer',
            }}>{firstName}</button>
          )
        })}
      </div>
    </div>
  )

  // ═══════════════ STEP RENDERS ═══════════════

  // ── Step 1: Select Type ──
  if (step === 'type') return shell(
    <>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '6px' }}>{dateLabel}</div>
      <div style={{ fontSize: '13px', color: C.driftwood, marginBottom: '20px' }}>What kind of meal?</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {typeBtn('Breakfast', null, () => { setAddMealType('breakfast'); setAddMealCategory(null); setStep('name') })}
        {typeBtn('Lunch', null, () => { setAddMealType('lunch'); setAddMealCategory(null); setStep('name') })}
        {typeBtn('Dinner', null, () => { setAddMealType('dinner'); setAddMealCategory(null); setStep('name') })}
        {typeBtn('Snack', null, () => { setAddMealType('snack'); setAddMealCategory(null); setStep('name') })}
        {typeBtn('Other', null, () => { setAddMealType('dinner'); setAddMealCategory('other'); setStep('name') })}
        {typeBtn('Leftovers', 'From a previous meal', () => { setAddMealType('dinner'); setAddMealCategory('leftovers'); setStep('left-source') })}
      </div>
      <div style={{ marginTop: '10px' }}>
        {typeBtn('Eating Out', 'Restaurant or takeout', () => { setAddMealType('dinner'); setAddMealCategory('eating_out'); setStep('eat-name') })}
      </div>
    </>
  )

  // ── Step 2: Meal Name ──
  if (step === 'name') return shell(
    <>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '4px' }}>{dateLabel}</div>
      <div style={{ fontSize: '12px', color: C.driftwood, marginBottom: '16px' }}>{MEAL_TYPE_LABELS[addMealType] || 'Meal'}</div>
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <input type="text" value={addInput}
          onChange={e => handleAddInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && addInput.trim()) advanceFromName() }}
          placeholder="What are you making?" autoFocus
          style={{
            width: '100%', padding: '14px 16px', fontSize: '16px',
            fontFamily: "'Jost', sans-serif", fontWeight: 300,
            border: `1.5px solid ${C.linen}`, borderRadius: recipeSuggestions.length > 0 ? '0 0 12px 12px' : '12px',
            outline: 'none', color: C.ink, boxSizing: 'border-box',
          }}
        />
        {recipeSuggestions.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0,
            background: 'white', border: `0.5px solid ${C.linen}`, borderBottom: 'none',
            borderRadius: '10px 10px 0 0', boxShadow: '0 -4px 12px rgba(44,36,23,0.08)',
            zIndex: 50, maxHeight: 200, overflowY: 'auto',
          }}>
            {recipeSuggestions.map((r, idx) => (
              <div key={r.id} onMouseDown={() => selectRecipeSuggestion(r)} style={{
                padding: '12px 14px', fontSize: 14, color: C.ink,
                borderBottom: idx < recipeSuggestions.length - 1 ? `0.5px solid ${C.linen}` : 'none',
                cursor: 'pointer', fontFamily: "'Jost', sans-serif",
              }}>{r.name}</div>
            ))}
          </div>
        )}
      </div>
      {addInput.trim() && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ctaBtn('Next', true, () => advanceFromName())}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '4px' }}>
            <button onClick={() => { onClose(); navigate('/save-recipe', { state: { returnTo: 'week', mealName: addInput.trim() } }) }} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: C.driftwood, fontFamily: "'Jost', sans-serif",
            }}>Save as Recipe →</button>
            <button onClick={() => { onClose(); navigate('/meals/staples') }} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: C.driftwood, fontFamily: "'Jost', sans-serif",
            }}>Save as Staple →</button>
          </div>
        </div>
      )}
    </>
  )

  // ── Step 3: Confirm Link + Batch ──
  if (step === 'confirm') return shell(
    <>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '4px' }}>{addInput}</div>
      <div style={{ fontSize: '12px', color: C.driftwood, marginBottom: '20px' }}>{MEAL_TYPE_LABELS[addMealType]} · {dateLabel}</div>

      {linkedRecipes.length > 0 ? (
        <div style={{ marginBottom: '20px' }}>
          {sectionLabel('Linked recipe')}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {linkedRecipes.map(lr => (
              <span key={lr.recipe_id} style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '6px 12px', borderRadius: '8px', fontSize: '13px',
                background: 'rgba(61,107,79,0.08)', color: arcColor,
                fontFamily: "'Jost', sans-serif", fontWeight: 500,
              }}>
                {lr.recipe_name}
                <button onClick={() => { const next = linkedRecipes.filter(r => r.recipe_id !== lr.recipe_id); setLinkedRecipes(next); setAddSheetRecipes(next) }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: '14px', color: C.driftwood, lineHeight: 1, marginLeft: '2px',
                }}>×</button>
              </span>
            ))}
          </div>
          <button onClick={() => { setAddSheetLinkOpen(true); openLinkSheet({ id: '__add_sheet__', custom_name: addInput.trim(), linkedRecipes }) }} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: '12px', color: C.driftwood, fontFamily: "'Jost', sans-serif",
          }}>Change link</button>
        </div>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: C.driftwood, fontStyle: 'italic', marginBottom: '8px' }}>No recipe linked</div>
          <button onClick={() => { setAddSheetLinkOpen(true); openLinkSheet({ id: '__add_sheet__', custom_name: addInput.trim(), linkedRecipes }) }} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: '12px', color: arcColor, fontFamily: "'Jost', sans-serif",
          }}>+ Link a recipe</button>
        </div>
      )}

      {sectionLabel('Batch size')}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
        {BATCH_OPTIONS.map(val => (
          <button key={val} onClick={() => setAddBatchMultiplier(val)} style={{
            flex: 1, padding: '8px', borderRadius: '10px', fontSize: '13px',
            border: addBatchMultiplier === val ? `1.5px solid ${arcColor}` : `1px solid ${C.linen}`,
            background: addBatchMultiplier === val ? 'rgba(61,107,79,0.08)' : 'white',
            color: addBatchMultiplier === val ? arcColor : C.ink,
            cursor: 'pointer', fontFamily: "'Jost', sans-serif",
            fontWeight: addBatchMultiplier === val ? 600 : 400,
          }}>{BATCH_LABELS[val]}</button>
        ))}
      </div>

      {ctaBtn('Next', true, () => setStep('details'))}
    </>
  )

  // ── Step 4: Optional Details ──
  if (step === 'details' || step === 'left-details' || step === 'eat-details') return shell(
    <>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '4px' }}>
        {addMealCategory === 'leftovers' ? `Leftovers — ${selectedSourceMeal?.custom_name || leftoversFreeText}` : addInput}
      </div>
      <div style={{ fontSize: '12px', color: C.driftwood, marginBottom: '20px' }}>Optional details</div>

      {renderRepeatDays()}
      {renderMemberTags()}

      {ctaBtn('Add to Plan', canSave, addMeal)}
      <button onClick={addMeal} disabled={!canSave} style={{
        width: '100%', padding: '10px', marginTop: '8px', background: 'none', border: 'none',
        cursor: canSave ? 'pointer' : 'default', fontFamily: "'Jost', sans-serif",
        fontSize: '13px', color: C.driftwood, fontWeight: 300,
      }}>Skip details</button>
    </>
  )

  // ── Leftovers Branch: L1 ──
  if (step === 'left-source') return shell(
    <>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '6px' }}>{dateLabel}</div>
      {sectionLabel('What are these leftovers from?')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {recentMeals.map(meal => (
          <button key={meal.id} onClick={() => { setSelectedSourceMeal(meal); setLeftoversFreeText('') }} style={{
            padding: '12px 14px', borderRadius: '10px',
            border: `0.5px solid ${selectedSourceMeal?.id === meal.id ? arcColor : C.linen}`,
            background: selectedSourceMeal?.id === meal.id ? `${arcColor}15` : 'white',
            textAlign: 'left', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontFamily: "'Jost', sans-serif",
          }}>
            <span style={{ fontSize: '14px', color: C.ink }}>{meal.custom_name}</span>
            <span style={{ fontSize: '11px', color: C.driftwood }}>{formatMealDate(meal.planned_date)}</span>
          </button>
        ))}
        {recentMeals.length === 0 && (
          <div style={{ fontSize: '13px', color: C.driftwood, fontStyle: 'italic', padding: '8px 0' }}>No recent meals found</div>
        )}
      </div>
      <div style={{ fontSize: '11px', color: C.driftwood, marginBottom: '6px' }}>Or type the meal name:</div>
      <input type="text" placeholder="e.g. Birthday dinner leftovers" value={leftoversFreeText}
        onChange={e => { setLeftoversFreeText(e.target.value); setSelectedSourceMeal(null) }}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: '10px',
          border: `0.5px solid ${C.linen}`, fontSize: '14px',
          fontFamily: "'Jost', sans-serif", color: C.ink, background: 'white',
          outline: 'none', boxSizing: 'border-box', marginBottom: '20px',
        }} />
      {ctaBtn('Next', !!(selectedSourceMeal || leftoversFreeText.trim()), () => setStep('left-details'))}
    </>
  )

  // ── Eating Out Branch: E1 ──
  if (step === 'eat-name') return shell(
    <>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '4px' }}>{dateLabel}</div>
      <div style={{ fontSize: '12px', color: C.driftwood, marginBottom: '16px' }}>Eating Out</div>
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <input type="text" value={addInput}
          onChange={e => handleAddInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && addInput.trim()) setStep('eat-cost') }}
          placeholder="Restaurant name" autoFocus
          style={{
            width: '100%', padding: '14px 16px', fontSize: '16px',
            fontFamily: "'Jost', sans-serif", fontWeight: 300,
            border: `1.5px solid ${C.linen}`, borderRadius: recipeSuggestions.length > 0 ? '0 0 12px 12px' : '12px',
            outline: 'none', color: C.ink, boxSizing: 'border-box',
          }}
        />
        {recipeSuggestions.length > 0 && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 0, right: 0,
            background: 'white', border: `0.5px solid ${C.linen}`, borderBottom: 'none',
            borderRadius: '10px 10px 0 0', boxShadow: '0 -4px 12px rgba(44,36,23,0.08)',
            zIndex: 50, maxHeight: 200, overflowY: 'auto',
          }}>
            {recipeSuggestions.map((r, idx) => (
              <div key={r.id} onMouseDown={() => { setAddInput(r.name); setRecipeSuggestions([]); setStep('eat-cost') }} style={{
                padding: '12px 14px', fontSize: 14, color: C.ink,
                borderBottom: idx < recipeSuggestions.length - 1 ? `0.5px solid ${C.linen}` : 'none',
                cursor: 'pointer', fontFamily: "'Jost', sans-serif",
              }}>{r.name}</div>
            ))}
          </div>
        )}
      </div>
      {ctaBtn('Next', !!addInput.trim(), () => setStep('eat-cost'))}
    </>
  )

  // ── Eating Out Branch: E2 ──
  if (step === 'eat-cost') return shell(
    <>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '4px' }}>{addInput}</div>
      <div style={{ fontSize: '12px', color: C.driftwood, marginBottom: '16px' }}>Eating Out · {dateLabel}</div>
      {sectionLabel('Estimated spend (optional)')}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '15px', color: C.driftwood }}>$</span>
        <input type="text" inputMode="decimal" value={addEatingOutCost} onChange={e => setAddEatingOutCost(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') setStep('eat-details') }}
          placeholder="0.00" autoFocus style={{
            width: '100%', padding: '12px 14px 12px 28px', fontSize: '15px',
            fontFamily: "'Jost', sans-serif", fontWeight: 300,
            border: `1.5px solid ${C.linen}`, borderRadius: '12px',
            outline: 'none', color: C.ink, boxSizing: 'border-box',
          }} />
      </div>
      {ctaBtn('Next', true, () => setStep('eat-details'))}
    </>
  )

  return null
}
