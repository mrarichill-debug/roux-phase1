/**
 * PantryList.jsx — Master Family List screen.
 * Always-on running list. Groups by grocery_category. No store context — that's the Trip screen.
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { categorizeIngredient } from '../lib/categorizeIngredient'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import SageNudgeCard from '../components/SageNudgeCard'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E', linen: '#E8E0D0',
  sage: '#7A8C6E', honey: '#C49A3C',
}

const CATEGORY_ORDER = ['produce','meat','seafood','dairy','bakery','pantry','frozen','beverages','household','personal_care','other']
const CATEGORY_LABELS = {
  produce: 'Produce', meat: 'Meat', seafood: 'Seafood', dairy: 'Dairy & Eggs',
  bakery: 'Bread & Bakery', pantry: 'Pantry & Canned', frozen: 'Frozen',
  beverages: 'Beverages', household: 'Household', personal_care: 'Personal Care', other: 'Other',
}
const TYPE_LABELS = { recipe: 'Recipe', manual: 'Added', staple: 'Staple', future: 'Upcoming', sale: 'Sale' }
const sentenceCase = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : ''

export default function PantryList({ appUser }) {
  const navigate = useNavigate()
  const [listId, setListId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [addInput, setAddInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addCategory, setAddCategory] = useState('other')
  const [showCatPicker, setShowCatPicker] = useState(false)
  const [manualCatPick, setManualCatPick] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [ghostMealsWithoutIngredients, setGhostMealsWithoutIngredients] = useState([])

  // Batch multipliers by meal name (case-insensitive)
  const [batchByMeal, setBatchByMeal] = useState({})

  // Trips + stores
  const [stores, setStores] = useState([])
  const [pendingTrips, setPendingTrips] = useState([])
  const [tripSheetOpen, setTripSheetOpen] = useState(false)
  const [tripSheetStep, setTripSheetStep] = useState(1) // 1 = store, 2 = items
  const [tripStore, setTripStore] = useState(null)
  const [tripStoreName, setTripStoreName] = useState('')
  const [selectedTripItems, setSelectedTripItems] = useState(new Set())
  const [creatingTrip, setCreatingTrip] = useState(false)
  const [addingStore, setAddingStore] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')

  // "In my kitchen" + reassignment
  const [kitchenExpanded, setKitchenExpanded] = useState(false)
  const [reassignItem, setReassignItem] = useState(null) // item for trip reassignment sheet

  // Completed trips this week
  const [completedTrips, setCompletedTrips] = useState([])
  const [completedTripItems, setCompletedTripItems] = useState({}) // tripId → items[]
  const [expandedTrip, setExpandedTrip] = useState(null)

  function handleAddInputChange(val) {
    setAddInput(val)
    if (!manualCatPick) setAddCategory(categorizeIngredient(val))
  }

  useEffect(() => {
    if (appUser?.household_id) loadList()
  }, [appUser?.household_id])

  async function loadList() {
    setLoading(true)
    try {
      // Load grocery stores + pending trips
      supabase.from('grocery_stores').select('id, name, is_primary, sort_order').eq('household_id', appUser.household_id).order('sort_order')
        .then(({ data }) => setStores(data || []))
      supabase.from('shopping_trips').select('id, name, store_name, status')
        .eq('household_id', appUser.household_id).in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .then(({ data }) => setPendingTrips(data || []))

      // Load completed trips this week (Monday–Sunday)
      const now = new Date()
      const dayOfWeek = now.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(now)
      monday.setDate(now.getDate() + mondayOffset)
      monday.setHours(0, 0, 0, 0)
      supabase.from('shopping_trips')
        .select('id, name, store_name, status, completed_at, receipt_photo_url, item_count')
        .eq('household_id', appUser.household_id).eq('status', 'completed')
        .gte('completed_at', monday.toISOString())
        .order('completed_at', { ascending: false })
        .then(({ data }) => setCompletedTrips(data || []))

      const { data: list } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('household_id', appUser.household_id)
        .eq('list_type', 'master')
        .neq('status', 'completed')
        .limit(1)
        .maybeSingle()

      if (list) {
        setListId(list.id)
        const { data } = await supabase
          .from('shopping_list_items')
          .select('*')
          .eq('shopping_list_id', list.id)
          .eq('approval_status', 'approved')
          .order('created_at')
        setItems(data || [])
        // Load batch multipliers for source meals — separate queries per LESSONS.md
        ;(async () => {
          const { data: pm } = await supabase.from('planned_meals')
            .select('custom_name, batch_multiplier, recipe_id')
            .eq('household_id', appUser.household_id)
            .is('removed_at', null).not('batch_multiplier', 'is', null)
          const map = {}
          const recipeIds = []
          for (const m of (pm || [])) {
            if (!m.batch_multiplier || m.batch_multiplier === 1) continue
            if (m.custom_name) map[m.custom_name.toLowerCase()] = m.batch_multiplier
            if (m.recipe_id) recipeIds.push(m.recipe_id)
          }
          if (recipeIds.length) {
            const { data: recipes } = await supabase.from('recipes').select('id, name').in('id', recipeIds)
            for (const r of (recipes || [])) {
              const meal = (pm || []).find(m => m.recipe_id === r.id && m.batch_multiplier !== 1)
              if (meal && r.name) map[r.name.toLowerCase()] = meal.batch_multiplier
            }
          }
          setBatchByMeal(map)
        })()
      } else {
        const { data: newList } = await supabase.from('shopping_lists').insert({
          household_id: appUser.household_id, list_type: 'master', status: 'draft',
        }).select('id').single()
        if (newList) setListId(newList.id)
        setItems([])
      }
    } catch (err) {
      console.error('[PantryList] Load error:', err)
    }
    setLoading(false)
  }

  // Show tutorial on first visit with items — verify against DB to avoid stale appUser
  useEffect(() => {
    if (loading || items.length === 0) return
    if (appUser?.has_seen_shopping_tutorial) { setShowTutorial(false); return }
    // Double-check DB in case appUser is stale
    supabase.from('users').select('has_seen_shopping_tutorial').eq('id', appUser.id).single()
      .then(({ data }) => {
        if (data?.has_seen_shopping_tutorial) setShowTutorial(false)
        else setShowTutorial(true)
      })
  }, [loading, items.length])

  // Check for ghost meals with no ingredients on the list
  useEffect(() => {
    if (loading || !appUser?.household_id || !listId) return
    async function checkGhosts() {
      const { data: ghosts } = await supabase.from('planned_meals')
        .select('id, custom_name')
        .eq('household_id', appUser.household_id)
        .eq('entry_type', 'ghost')
        .is('recipe_id', null)
        .is('removed_at', null)
        .neq('no_recipe_acknowledged', true)
      if (!ghosts?.length) { setGhostMealsWithoutIngredients([]); return }

      // Cross-reference meal_recipe_skips — exclude suppressed meals
      const { data: skips } = await supabase.from('meal_recipe_skips')
        .select('meal_name').eq('household_id', appUser.household_id).eq('suppressed', true)
      const suppressedNames = new Set((skips || []).map(s => (s.meal_name || '').toLowerCase()))

      const itemNames = new Set(items.map(i => (i.source_meal_name || '').toLowerCase()))
      const uncovered = ghosts.filter(g => {
        const name = (g.custom_name || '').toLowerCase()
        return !itemNames.has(name) && !suppressedNames.has(name)
      })
      setGhostMealsWithoutIngredients(uncovered)
    }
    checkGhosts()
  }, [loading, listId, items.length])

  async function dismissTutorial() {
    setShowTutorial(false)
    supabase.from('users').update({ has_seen_shopping_tutorial: true }).eq('id', appUser.id)
  }

  async function addToListManually(ghost) {
    if (!listId) return
    const mealName = ghost.custom_name
    // Insert item onto the master shopping list
    await supabase.from('shopping_list_items').insert({
      shopping_list_id: listId,
      household_id: appUser.household_id,
      name: mealName,
      grocery_category: 'other',
      source_meal_name: mealName,
      source_type: 'manual',
      status: 'active',
      item_type: 'manual',
      approval_status: 'approved',
    })
    // Mark the ghost meal as acknowledged
    await supabase.from('planned_meals').update({ no_recipe_acknowledged: true }).eq('id', ghost.id)
    // Track skip in meal_recipe_skips — upsert by household + meal name (case-insensitive)
    const skipKey = mealName.toLowerCase().trim()
    const { data: existing } = await supabase.from('meal_recipe_skips')
      .select('id, skip_count').eq('household_id', appUser.household_id)
      .ilike('meal_name', skipKey).maybeSingle()
    if (existing) {
      const newCount = (existing.skip_count || 0) + 1
      await supabase.from('meal_recipe_skips').update({
        skip_count: newCount, last_skipped_at: new Date().toISOString(),
        suppressed: newCount >= 3,
      }).eq('id', existing.id)
    } else {
      await supabase.from('meal_recipe_skips').insert({
        household_id: appUser.household_id, meal_name: mealName,
        skip_count: 1, last_skipped_at: new Date().toISOString(),
      })
    }
    // Dismiss the card immediately
    setGhostMealsWithoutIngredients(prev => prev.filter(g => g.id !== ghost.id))
    logActivity({ user: appUser, actionType: 'ghost_meal_added_manually', targetType: 'shopping_item', targetName: mealName })
    // Refresh the list to show the new item
    loadList()
  }

  async function markHaveIt(item) {
    // Update all consolidated item IDs
    const ids = item.ids || [item.id]
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, already_have: true } : i))
    for (const id of ids) {
      await supabase.from('shopping_list_items').update({ already_have: true }).eq('id', id)
    }
    logActivity({ user: appUser, actionType: 'item_marked_have_it', targetType: 'shopping_item', targetName: item.name })
  }

  async function markStillNeedIt(item) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, already_have: false } : i))
    await supabase.from('shopping_list_items').update({ already_have: false }).eq('id', item.id)
  }

  async function reassignToTrip(item, newTripId) {
    const itemId = item.ids?.[0] || item.id
    const oldTripId = item.assigned_trip_id
    // Remove from old trip
    if (oldTripId) {
      await supabase.from('shopping_trip_items').delete().eq('shopping_list_item_id', itemId).eq('trip_id', oldTripId)
    }
    // Add to new trip
    await supabase.from('shopping_trip_items').insert({ trip_id: newTripId, shopping_list_item_id: itemId })
    await supabase.from('shopping_list_items').update({ assigned_trip_id: newTripId }).eq('id', itemId)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, assigned_trip_id: newTripId } : i))
    setReassignItem(null)
  }

  async function removeFromTrip(item) {
    const itemId = item.ids?.[0] || item.id
    const tripId = item.assigned_trip_id
    if (tripId) {
      await supabase.from('shopping_trip_items').delete().eq('shopping_list_item_id', itemId).eq('trip_id', tripId)
    }
    await supabase.from('shopping_list_items').update({ assigned_trip_id: null }).eq('id', itemId)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, assigned_trip_id: null } : i))
    setReassignItem(null)
  }

  async function toggleExpandTrip(tripId) {
    if (expandedTrip === tripId) { setExpandedTrip(null); return }
    setExpandedTrip(tripId)
    if (completedTripItems[tripId]) return // already loaded
    // Load trip items — separate queries per LESSONS.md
    const { data: tripItemRows } = await supabase.from('shopping_trip_items')
      .select('id, shopping_list_item_id, is_purchased, actual_price').eq('trip_id', tripId).eq('is_purchased', true)
    if (!tripItemRows?.length) { setCompletedTripItems(prev => ({ ...prev, [tripId]: [] })); return }
    const itemIds = tripItemRows.map(r => r.shopping_list_item_id)
    const { data: listItems } = await supabase.from('shopping_list_items')
      .select('id, name, quantity, unit, grocery_category, source_meal_name').in('id', itemIds)
    const listMap = Object.fromEntries((listItems || []).map(i => [i.id, i]))
    const merged = tripItemRows.map(ti => ({ ...ti, ...(listMap[ti.shopping_list_item_id] || {}) }))
    setCompletedTripItems(prev => ({ ...prev, [tripId]: merged }))
  }

  // Trip creation — 2-step flow
  function openTripSheet() {
    setTripSheetStep(1)
    setTripStore(null)
    setTripStoreName('')
    setSelectedTripItems(new Set())
    setAddingStore(false)
    setNewStoreName('')
    setTripSheetOpen(true)
  }

  function selectStoreForTrip(store) {
    setTripStore(store.id)
    setTripStoreName(store.name)
    setTripSheetStep(2)
    // Pre-select all unassigned items
    const unassigned = activeItems.filter(i => !i.assigned_trip_id).map(i => i.id)
    setSelectedTripItems(new Set(unassigned))
  }

  async function addNewStore() {
    if (!newStoreName.trim()) return
    const { data } = await supabase.from('grocery_stores').insert({
      household_id: appUser.household_id, name: newStoreName.trim(), sort_order: stores.length,
    }).select('id, name, is_primary, sort_order').single()
    if (data) {
      setStores(prev => [...prev, data])
      selectStoreForTrip(data)
    }
    setAddingStore(false)
    setNewStoreName('')
  }

  function toggleTripItem(itemId) {
    setSelectedTripItems(prev => {
      const next = new Set(prev)
      next.has(itemId) ? next.delete(itemId) : next.add(itemId)
      return next
    })
  }

  function selectAllUnassigned() {
    const unassigned = activeItems.filter(i => !i.assigned_trip_id).map(i => i.id)
    setSelectedTripItems(new Set(unassigned))
  }

  async function saveTrip() {
    if (creatingTrip || !listId || !tripStore || selectedTripItems.size === 0) return
    setCreatingTrip(true)
    try {
      const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
      const { count } = await supabase.from('shopping_trips').select('id', { count: 'exact', head: true })
        .eq('household_id', appUser.household_id).eq('store_name', tripStoreName)
        .gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00')
      const tripName = (!count || count === 0) ? `${dayName} ${tripStoreName} run` : `${dayName} ${tripStoreName} run #${count + 1}`

      const { data: trip, error: tripErr } = await supabase.from('shopping_trips').insert({
        household_id: appUser.household_id, shopping_list_id: listId,
        name: tripName, store_id: tripStore, store_name: tripStoreName,
        status: 'pending', created_by_user_id: appUser.id,
      }).select('id').single()
      if (tripErr) throw tripErr

      const selectedIds = [...selectedTripItems]
      const { error: itemsErr } = await supabase.from('shopping_trip_items').insert(selectedIds.map(id => ({ trip_id: trip.id, shopping_list_item_id: id })))
      if (itemsErr) throw itemsErr

      // Assign items to this trip
      for (const id of selectedIds) {
        await supabase.from('shopping_list_items').update({ assigned_trip_id: trip.id }).eq('id', id)
      }

      logActivity({ user: appUser, actionType: 'shopping_trip_created', targetType: 'shopping_trip', targetId: trip.id, targetName: tripName })
      setTripSheetOpen(false)
      loadList() // Refresh to show trip card + store tags
    } catch (err) {
      console.error('[PantryList] Create trip error:', err)
    }
    setCreatingTrip(false)
  }

  const completedTripIds = new Set(completedTrips.map(t => t.id))
  const activeItems = items.filter(i => i.status === 'active' && !completedTripIds.has(i.assigned_trip_id) && !i.already_have)
  const kitchenItems = items.filter(i => i.status === 'active' && i.already_have)
  const purchasedItems = items.filter(i => i.status === 'purchased')

  // Consolidate duplicate ingredients by name (case-insensitive)
  function consolidateItems(itemList) {
    const map = new Map()
    for (const item of itemList) {
      const key = (item.name || '').toLowerCase().trim()
      if (!key) continue
      if (map.has(key)) {
        const existing = map.get(key)
        // Combine quantities if units match
        if (item.quantity && existing.unit === item.unit) {
          const a = parseFloat(existing.quantity) || 0
          const b = parseFloat(item.quantity) || 0
          if (a > 0 && b > 0) existing.quantity = String(a + b)
          else if (!existing.quantity) existing.quantity = item.quantity
        } else if (item.quantity && !existing.quantity) {
          existing.quantity = item.quantity
          existing.unit = item.unit
        }
        // Merge source meal names
        if (item.source_meal_name && !existing.sourceMeals.includes(item.source_meal_name)) {
          existing.sourceMeals.push(item.source_meal_name)
        }
        existing.ids.push(item.id)
      } else {
        map.set(key, {
          ...item,
          ids: [item.id],
          sourceMeals: item.source_meal_name ? [item.source_meal_name] : [],
        })
      }
    }
    return [...map.values()]
  }

  const consolidated = consolidateItems(activeItems)

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: consolidated.filter(i => (i.grocery_category || 'other') === cat),
  })).filter(g => g.items.length > 0)

  async function togglePurchased(item) {
    const wasPurchased = item.status === 'purchased'
    const newStatus = wasPurchased ? 'active' : 'purchased'
    const now = new Date().toISOString()

    setItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, status: newStatus, last_purchased_at: wasPurchased ? i.last_purchased_at : now } : i
    ))

    const update = { status: newStatus }
    if (!wasPurchased) { update.last_purchased_at = now; update.is_purchased = true; update.purchased_at = now }
    else { update.is_purchased = false }
    await supabase.from('shopping_list_items').update(update).eq('id', item.id)
  }

  async function addItem() {
    if (!addInput.trim() || !listId || adding) return
    setAdding(true)
    const name = addInput.trim()
    const isAdmin = appUser.role === 'admin' || appUser.role === 'co_admin'

    const { data, error } = await supabase.from('shopping_list_items').insert({
      shopping_list_id: listId, household_id: appUser.household_id,
      name, item_type: 'manual', status: 'active', grocery_category: addCategory,
      approval_status: isAdmin ? 'approved' : 'pending',
      suggested_by_user_id: isAdmin ? null : appUser.id,
    }).select('*').single()

    if (!error && data) {
      if (isAdmin) setItems(prev => [...prev, data])
      else {
        await supabase.from('home_notices').insert({
          household_id: appUser.household_id, type: 'family_addition',
          title: `${appUser.name?.split(' ')[0] || 'Someone'} added to the list`,
          body: name, source_user_id: appUser.id, target_item_id: data.id,
        })
      }
      logActivity({ user: appUser, actionType: 'shopping_list_added', targetType: 'shopping_item', targetId: data.id, targetName: name })
    }
    setAddInput('')
    setAddCategory('other')
    setShowCatPicker(false)
    setManualCatPick(false)
    setAdding(false)
    loadList()
  }

  if (loading) return (
    <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
      <TopBar centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Shopping List</span>} />
      <div style={{ padding: '20px 22px' }}>
        {[60, 40, 40, 40].map((h, i) => <div key={i} className="shimmer-block" style={{ height: `${h}px`, borderRadius: '12px', marginBottom: '10px' }} />)}
      </div>
    </div>
  )

  return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: 'calc(110px + env(safe-area-inset-bottom, 8px))',
    }}>
      <TopBar
        centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Shopping List</span>}
      />

      {/* ── Start a Trip + pending trip cards ─────────────────── */}
      <div style={{ padding: '10px 22px 6px', display: 'flex', gap: '10px', overflowX: 'auto' }}>
        <button onClick={openTripSheet} style={{
          padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
          background: C.forest, color: 'white', textAlign: 'left',
          border: 'none', fontFamily: "'Jost', sans-serif", flexShrink: 0,
          boxShadow: '0 2px 8px rgba(30,55,35,0.2)',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>+ Start a Trip</div>
        </button>
        {pendingTrips.map(trip => (
          <button key={trip.id} onClick={() => navigate(`/pantry/trip/${trip.id}`)} style={{
            padding: '10px 14px', borderRadius: '12px', cursor: 'pointer',
            background: 'white', color: C.ink, textAlign: 'left',
            border: `1px solid ${C.linen}`, fontFamily: "'Jost', sans-serif", flexShrink: 0,
          }}>
            <div style={{ fontSize: '12px', fontWeight: 500 }}>{trip.store_name || trip.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{
                fontSize: '9px', fontWeight: 500, padding: '1px 5px', borderRadius: '4px',
                background: trip.status === 'active' ? 'rgba(122,140,110,0.12)' : 'rgba(200,185,160,0.15)',
                color: trip.status === 'active' ? C.sage : C.driftwood,
              }}>{trip.status === 'active' ? 'In Progress' : 'Pending'}</span>
            </div>
          </button>
        ))}
      </div>

      <div style={{ padding: '12px 22px' }}>
        {/* Tutorial card */}
        {showTutorial && (
          <div style={{
            padding: '14px 16px', marginBottom: '14px', background: 'white',
            borderRadius: '12px', borderLeft: `3px solid ${C.sage}`,
            boxShadow: '0 1px 6px rgba(80,60,30,0.08)',
          }}>
            <div style={{ fontSize: '13px', color: C.ink, lineHeight: 1.6, marginBottom: '8px' }}>
              <span style={{ color: C.sage }}>✦</span> I've added ingredients from your week's recipes. Check items off as you shop — the more you use Roux, the smarter your list gets.
            </div>
            <button onClick={dismissTutorial} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: C.forest, fontWeight: 500, fontFamily: "'Jost', sans-serif", padding: 0,
            }}>Got it</button>
          </div>
        )}

        {grouped.length === 0 && purchasedItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: C.ink, marginBottom: '8px' }}>List is clear.</div>
            <div style={{ fontSize: '13px', color: C.driftwood, fontStyle: 'italic' }}>Add items below or plan meals to populate.</div>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.cat} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.forest, marginBottom: '6px', marginTop: '24px', borderLeft: `3px solid ${C.forest}`, paddingLeft: '10px' }}>
              {group.label}
            </div>
            {group.items.map(item => {
              // Find store name if assigned to a trip
              const assignedTrip = item.assigned_trip_id ? pendingTrips.find(t => t.id === item.assigned_trip_id) : null
              return (
                <div key={item.ids?.[0] || item.id} style={{
                  padding: '10px 0', borderBottom: '1px solid rgba(200,185,160,0.25)',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: C.ink }}>{sentenceCase(item.name)}</div>
                    {(item.quantity || item.unit) && (() => {
                      const batchVal = (item.sourceMeals || []).reduce((b, name) => batchByMeal[name.toLowerCase()] || b, null)
                      return (
                        <div style={{ fontSize: '11px', color: C.driftwood }}>
                          {[item.quantity, item.unit].filter(Boolean).join(' ')}
                          {batchVal && batchVal !== 1 && (
                            <span style={{ fontSize: '9px', fontWeight: 600, color: C.forest, marginLeft: '4px' }}>
                              {batchVal === 0.5 ? '×½' : batchVal === 1.5 ? '×1½' : `×${batchVal}`}
                            </span>
                          )}
                        </div>
                      )
                    })()}
                    {item.sourceMeals?.length > 0 && (
                      <div style={{ fontSize: '10px', color: C.driftwood, fontStyle: 'italic' }}>For {item.sourceMeals.join(', ')}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginTop: '2px' }}>
                    {assignedTrip && (
                      <button onClick={() => setReassignItem(item)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        fontSize: '10px', color: C.driftwood, fontStyle: 'italic',
                        fontFamily: "'Jost', sans-serif",
                      }}>{assignedTrip.store_name}</button>
                    )}
                    <button onClick={() => markHaveIt(item)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: '11px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontWeight: 300,
                    }}>Have it</button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* Purchased items hidden on manifest view — visible in Shopping Trip */}
      </div>

      {/* ── Ghost meal notices ────────────────────────────────────── */}
      {ghostMealsWithoutIngredients.map(ghost => (
        <SageNudgeCard
          key={ghost.id}
          message={`${ghost.custom_name} is on your menu but has no recipe yet — you'll need to add those ingredients manually.`}
          actionLabel="Add a recipe →"
          onAction={() => navigate('/save-recipe', { state: { mealName: ghost.custom_name } })}
          secondaryActionLabel="Add to list manually →"
          secondaryOnAction={() => addToListManually(ghost)}
        />
      ))}

      {/* ── In my kitchen (already have) ─────────────────────────── */}
      {kitchenItems.length > 0 && (
        <div style={{ padding: '0 22px 12px' }}>
          <button onClick={() => setKitchenExpanded(!kitchenExpanded)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0',
            fontFamily: "'Jost', sans-serif",
          }}>
            <span style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', color: C.driftwood }}>
              In my kitchen ({kitchenItems.length})
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, transform: kitchenExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {kitchenExpanded && (
            <div>
              {kitchenItems.map(item => (
                <div key={item.id} style={{
                  padding: '8px 0', borderBottom: '1px solid rgba(200,185,160,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: C.driftwood, fontWeight: 300 }}>{sentenceCase(item.name)}</div>
                    {(item.quantity || item.unit) && (
                      <div style={{ fontSize: '10px', color: C.driftwood, opacity: 0.6 }}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</div>
                    )}
                  </div>
                  <button onClick={() => markStillNeedIt(item)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '11px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontWeight: 300, fontStyle: 'italic',
                  }}>Still need it</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Completed trips this week ─────────────────────────────── */}
      {completedTrips.length > 0 && (
        <div style={{ padding: '0 22px 16px' }}>
          <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '10px', marginTop: '8px' }}>
            This Week
          </div>
          {completedTrips.map(ct => {
            const isExpanded = expandedTrip === ct.id
            const tripDate = ct.completed_at ? new Date(ct.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
            const hasReceipt = !!ct.receipt_photo_url
            const ctItems = completedTripItems[ct.id] || []
            const ctGrouped = isExpanded ? CATEGORY_ORDER.map(cat => ({
              cat, label: CATEGORY_LABELS[cat],
              items: ctItems.filter(i => (i.grocery_category || 'other') === cat),
            })).filter(g => g.items.length > 0) : []

            return (
              <div key={ct.id} style={{
                background: 'white', borderRadius: '12px', border: `1px solid ${C.linen}`,
                marginBottom: '8px', overflow: 'hidden',
              }}>
                <div onClick={() => toggleExpandTrip(ct.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', cursor: 'pointer',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 400, color: C.ink }}>
                      {ct.name || ct.store_name}
                      <span style={{ color: C.driftwood, fontWeight: 300 }}> · {ct.item_count || ctItems.length} item{(ct.item_count || ctItems.length) !== 1 ? 's' : ''} · {tripDate}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); if (!hasReceipt) navigate(`/pantry/trip/${ct.id}/receipt`) }} style={{
                      background: 'none', border: 'none', cursor: hasReceipt ? 'default' : 'pointer', padding: '2px',
                      display: 'flex', alignItems: 'center',
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={hasReceipt ? C.sage : C.linen} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                        <path d="M8 7h8M8 11h8M8 15h4" />
                      </svg>
                    </button>
                    <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.linen}` }}>
                    {ctItems.length === 0 && (
                      <div style={{ fontSize: '12px', color: C.driftwood, fontStyle: 'italic', padding: '10px 0' }}>Loading items...</div>
                    )}
                    {ctGrouped.map(group => (
                      <div key={group.cat} style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.forest, marginBottom: '4px', marginTop: '24px', borderLeft: `3px solid ${C.forest}`, paddingLeft: '10px' }}>
                          {group.label}
                        </div>
                        {group.items.map(item => (
                          <div key={item.id} style={{
                            padding: '6px 0', borderBottom: '1px solid rgba(200,185,160,0.15)',
                          }}>
                            <div style={{ fontSize: '13px', color: C.driftwood, fontWeight: 300 }}>{sentenceCase(item.name)}</div>
                            {(item.quantity || item.unit) && (
                              <div style={{ fontSize: '10px', color: C.driftwood, opacity: 0.7 }}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add item ─────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 'calc(48px + env(safe-area-inset-bottom, 8px))',
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', padding: '10px 22px',
        background: C.cream, borderTop: `1px solid ${C.linen}`, zIndex: 50, boxSizing: 'border-box',
      }}>
        {showCatPicker && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {CATEGORY_ORDER.map(cat => (
              <button key={cat} onClick={() => { setAddCategory(cat); setManualCatPick(true); setShowCatPicker(false) }} style={{
                padding: '3px 8px', borderRadius: '8px', fontSize: '10px',
                border: addCategory === cat ? `1px solid ${C.forest}` : `1px solid ${C.linen}`,
                background: addCategory === cat ? 'rgba(61,107,79,0.08)' : 'white',
                color: addCategory === cat ? C.forest : C.ink, cursor: 'pointer',
                fontFamily: "'Jost', sans-serif",
              }}>{CATEGORY_LABELS[cat]}</button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setShowCatPicker(!showCatPicker)} style={{
            padding: '6px 10px', borderRadius: '8px', border: `1px solid ${C.linen}`,
            background: 'white', cursor: 'pointer', fontSize: '10px', color: C.driftwood,
            fontFamily: "'Jost', sans-serif", flexShrink: 0, whiteSpace: 'nowrap',
          }}>{CATEGORY_LABELS[addCategory] || 'Other'}</button>
          <input type="text" value={addInput} onChange={e => handleAddInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem() }}
            placeholder="Add to list..." style={{
              flex: 1, padding: '10px 14px', fontSize: '14px', fontFamily: "'Jost', sans-serif", fontWeight: 300,
              border: `1.5px solid ${C.linen}`, borderRadius: '12px', outline: 'none', color: C.ink, background: 'white',
            }} />
          <button onClick={addItem} disabled={!addInput.trim() || adding} style={{
            width: '44px', height: '44px', borderRadius: '12px', border: 'none',
            background: addInput.trim() ? C.forest : C.linen, color: addInput.trim() ? 'white' : C.driftwood,
            cursor: addInput.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 300,
          }}>+</button>
        </div>
      </div>

      {/* ── Trip creation sheet — 2-step ────────────────────────── */}
      {tripSheetOpen && (
        <>
          <div onClick={() => setTripSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '0 0 env(safe-area-inset-bottom, 24px)', zIndex: 201,
            boxShadow: '0 -4px 32px rgba(44,36,23,0.18)', maxHeight: '75vh', overflowY: 'auto',
            animation: 'sheetRise 0.28s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
            <div style={{ padding: '20px 22px 24px' }}>

              {/* Step 1 — Store selection */}
              {tripSheetStep === 1 && (
                <>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '16px' }}>
                    Which store are we going to?
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {stores.map(s => (
                      <button key={s.id} onClick={() => selectStoreForTrip(s)} style={{
                        padding: '10px 18px', borderRadius: '12px', fontSize: '14px',
                        border: `1.5px solid ${C.linen}`, background: 'white', color: C.ink,
                        cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 400,
                      }}>{s.name}</button>
                    ))}
                  </div>
                  {addingStore ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="text" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} placeholder="Store name..."
                        autoFocus style={{ flex: 1, padding: '8px 12px', fontSize: '13px', fontFamily: "'Jost', sans-serif",
                          border: `1.5px solid ${C.linen}`, borderRadius: '10px', outline: 'none', color: C.ink }} />
                      <button onClick={addNewStore} disabled={!newStoreName.trim()} style={{
                        padding: '8px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: 500,
                        background: newStoreName.trim() ? C.forest : C.linen, color: newStoreName.trim() ? 'white' : C.driftwood,
                        cursor: newStoreName.trim() ? 'pointer' : 'default', fontFamily: "'Jost', sans-serif",
                      }}>Add</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingStore(true)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                      fontSize: '12px', color: C.driftwood, fontWeight: 300, fontFamily: "'Jost', sans-serif",
                    }}>+ Add a store</button>
                  )}
                </>
              )}

              {/* Step 2 — Item selection */}
              {tripSheetStep === 2 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <button onClick={() => setTripSheetStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.driftwood, fontSize: '12px', fontFamily: "'Jost', sans-serif", padding: 0 }}>← Back</button>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginTop: '4px' }}>
                        What are you picking up at {tripStoreName}?
                      </div>
                    </div>
                  </div>
                  <button onClick={selectAllUnassigned} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: '10px',
                    fontSize: '12px', color: C.forest, fontWeight: 500, fontFamily: "'Jost', sans-serif",
                  }}>Select all unassigned</button>

                  {CATEGORY_ORDER.map(cat => {
                    const catItems = activeItems.filter(i => (i.grocery_category || 'other') === cat)
                    if (catItems.length === 0) return null
                    return (
                      <div key={cat} style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.sage, marginBottom: '4px' }}>
                          {CATEGORY_LABELS[cat]}
                        </div>
                        {catItems.map(item => {
                          const isAssignedElsewhere = item.assigned_trip_id && item.assigned_trip_id !== tripStore
                          const assignedTo = isAssignedElsewhere ? pendingTrips.find(t => t.id === item.assigned_trip_id) : null
                          const isSelected = selectedTripItems.has(item.id)
                          return (
                            <div key={item.id} onClick={isAssignedElsewhere ? undefined : () => toggleTripItem(item.id)} style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '8px 0', borderBottom: '1px solid rgba(200,185,160,0.15)',
                              cursor: isAssignedElsewhere ? 'default' : 'pointer',
                              opacity: isAssignedElsewhere ? 0.4 : 1,
                            }}>
                              <div style={{
                                width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                                border: isSelected ? 'none' : '1.5px solid rgba(200,185,160,0.7)',
                                background: isSelected ? C.forest : 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', color: 'white',
                              }}>{isSelected ? '✓' : ''}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', color: C.ink }}>{sentenceCase(item.name)}</div>
                                {(item.quantity || item.unit) && (
                                  <div style={{ fontSize: '10px', color: C.driftwood }}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</div>
                                )}
                              </div>
                              {assignedTo && (
                                <span style={{ fontSize: '9px', color: C.driftwood, fontStyle: 'italic' }}>{assignedTo.store_name}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}

                  <div style={{ position: 'sticky', bottom: 0, background: 'white', padding: '12px 0 0' }}>
                    <div style={{ fontSize: '12px', color: C.driftwood, marginBottom: '8px', textAlign: 'center' }}>
                      {selectedTripItems.size} item{selectedTripItems.size !== 1 ? 's' : ''} selected
                    </div>
                    <button onClick={saveTrip} disabled={creatingTrip || selectedTripItems.size === 0} style={{
                      width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
                      background: selectedTripItems.size > 0 ? C.forest : C.linen,
                      color: selectedTripItems.size > 0 ? 'white' : C.driftwood,
                      cursor: selectedTripItems.size > 0 ? 'pointer' : 'default',
                      fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                      boxShadow: selectedTripItems.size > 0 ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
                    }}>{creatingTrip ? 'Saving...' : 'Save trip →'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Trip Reassignment Sheet ──────────────────────────────── */}
      {reassignItem && (() => {
        const currentTripId = reassignItem.assigned_trip_id
        const currentTrip = pendingTrips.find(t => t.id === currentTripId)
        const otherTrips = pendingTrips.filter(t => t.id !== currentTripId)
        return (
          <>
            <div onClick={() => setReassignItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
            <div onClick={e => e.stopPropagation()} style={{
              position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
              width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
              padding: '0 0 env(safe-area-inset-bottom, 24px)', zIndex: 201,
              boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
              animation: 'sheetRise 0.28s cubic-bezier(0.22,1,0.36,1) both',
            }}>
              <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
              <div style={{ padding: '16px 22px 20px' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '6px' }}>
                  {sentenceCase(reassignItem.name)}
                </div>
                {currentTrip && (
                  <div style={{ fontSize: '12px', color: C.driftwood, marginBottom: '16px' }}>
                    Currently on your {currentTrip.store_name} trip
                  </div>
                )}

                {otherTrips.length > 0 && (
                  <>
                    <div style={{ fontSize: '11px', color: C.driftwood, marginBottom: '8px' }}>Move to another trip</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                      {otherTrips.map(t => (
                        <button key={t.id} onClick={() => reassignToTrip(reassignItem, t.id)} style={{
                          padding: '8px 16px', borderRadius: '10px', fontSize: '13px',
                          border: `1.5px solid ${C.linen}`, background: 'white', color: C.ink,
                          cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 400,
                        }}>{t.store_name || t.name}</button>
                      ))}
                    </div>
                  </>
                )}

                <button onClick={() => setReassignItem(null)} style={{
                  width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                  background: C.forest, color: 'white', cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                  boxShadow: '0 4px 16px rgba(30,55,35,0.25)', marginBottom: '12px',
                }}>Done</button>

                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => removeFromTrip(reassignItem)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '13px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontWeight: 300,
                  }}>Remove from trip</button>
                </div>
              </div>
            </div>
          </>
        )
      })()}

      <style>{`@keyframes sheetRise { from { transform: translateX(-50%) translateY(100%); } to { transform: translateX(-50%) translateY(0); } }`}</style>

      <BottomNav activeTab="pantry" />
    </div>
  )
}
