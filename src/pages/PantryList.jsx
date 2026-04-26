/**
 * PantryList.jsx — Week-scoped Shopping screen.
 * Shows the shopping list for a specific week's meal plan. Groups by grocery_category.
 * Week navigation lets Lauren move between weeks. No store context — that's the Trip screen.
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { categorizeIngredient } from '../lib/categorizeIngredient'
import { getOrCreateShoppingList } from '../lib/getOrCreateShoppingList'
import { injectMealPlanToList } from '../lib/injectMealPlanToList'
import { getWeekDatesTZ, getWeekStartTZ } from '../lib/dateUtils'
import { hasSeenTooltip, dismissTooltip } from '../lib/tooltips'
import TopBar from '../components/TopBar'
import BottomSheet from '../components/BottomSheet'
import BottomNav from '../components/BottomNav'
import SageNudgeCard from '../components/SageNudgeCard'
import ShoppingOnboarding from '../components/ShoppingOnboarding'
import { useArc } from '../context/ArcContext'
import { color, alpha, elevation } from '../styles/tokens'

const CATEGORY_ORDER = ['produce','meat','seafood','dairy','bakery','pantry','frozen','beverages','household','personal_care','other']
const CATEGORY_LABELS = {
  produce: 'Produce', meat: 'Meat', seafood: 'Seafood', dairy: 'Dairy & Eggs',
  bakery: 'Bread & Bakery', pantry: 'Pantry & Canned', frozen: 'Frozen',
  beverages: 'Beverages', household: 'Household', personal_care: 'Personal Care', other: 'Other',
}
const TYPE_LABELS = { recipe: 'Recipe', manual: 'Added', staple: 'Staple', future: 'Upcoming', sale: 'Sale' }
const sentenceCase = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : ''

export default function PantryList({ appUser }) {
  const { color: arcColor } = useArc()
  const navigate = useNavigate()
  const tz = appUser?.timezone || 'America/Chicago'

  const [shopTab, setShopTab] = useState('items') // 'items' | 'on-hand' | 'trips'

  const [selectedMealPlanId, setSelectedMealPlanId] = useState(null)
  const [noMealPlan, setNoMealPlan] = useState(false)

  const [listId, setListId] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [addInput, setAddInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addCategory, setAddCategory] = useState('other')
  const [showCatPicker, setShowCatPicker] = useState(false)
  const [manualCatPick, setManualCatPick] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [shoppingTipDismissed, setShoppingTipDismissed] = useState(() => hasSeenTooltip(appUser, 'shopping_workflow'))
  const [ghostMealsWithoutIngredients, setGhostMealsWithoutIngredients] = useState([])

  // Batch multipliers by meal name (case-insensitive)

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
  // Multi-week trip state
  const [secondWeek, setSecondWeek] = useState(null) // { planId, listId, label, items: [] }
  const [secondWeekLoading, setSecondWeekLoading] = useState(false)

  // Pantry staples + "Have it" interaction
  const [reassignItem, setReassignItem] = useState(null) // item for trip reassignment sheet
  const [pantryStaples, setPantryStaples] = useState([]) // household-level staples
  const [haveItExpansion, setHaveItExpansion] = useState(null) // item id showing inline choice
  const [stapleSheetItem, setStapleSheetItem] = useState(null) // item for staple type bottom sheet
  const [haveThisWeekExpanded, setHaveThisWeekExpanded] = useState(true)

  // Completed trips this week
  const [completedTrips, setCompletedTrips] = useState([])
  const [completedTripItems, setCompletedTripItems] = useState({}) // tripId → items[]
  const [expandedTrip, setExpandedTrip] = useState(null)

  // Pull-to-refresh
  const pullStartY = useRef(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [pullRefreshing, setPullRefreshing] = useState(false)

  function handleAddInputChange(val) {
    setAddInput(val)
    if (!manualCatPick) setAddCategory(categorizeIngredient(val))
  }

  // Load all active lists on mount
  useEffect(() => {
    if (appUser?.household_id) loadAllActiveLists()
  }, [appUser?.household_id])

  async function loadAllActiveLists() {
    if (!appUser?.household_id) return
    setLoading(true)
    setNoMealPlan(false)
    setItems([])
    setListId(null)
    setSelectedMealPlanId(null)
    setGhostMealsWithoutIngredients([])

    try {
      // Current Monday
      const now = new Date()
      const dayOfWeek = now.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      const currentMonday = new Date(now)
      currentMonday.setDate(now.getDate() - daysToMonday)
      currentMonday.setHours(0, 0, 0, 0)
      const currentMondayStr = currentMonday.toISOString().split('T')[0]

      // All active meal plans (current + future weeks, plus any un-reviewed past weeks)
      const { data: activePlans } = await supabase
        .from('meal_plans')
        .select('id, week_start_date')
        .eq('household_id', appUser.household_id)
        .or(`week_start_date.gte.${currentMondayStr},reviewed_at.is.null`)
        .order('week_start_date')

      if (!activePlans?.length) {
        setNoMealPlan(true)
        supabase.from('grocery_stores').select('id, name, is_primary, sort_order').eq('household_id', appUser.household_id).order('sort_order')
          .then(({ data }) => setStores(data || []))
        setLoading(false)
        return
      }

      // Use current week's plan as primary (for writes, ghosts, refresh)
      const currentWeekPlan = activePlans.find(p => p.week_start_date === currentMondayStr) || activePlans[0]
      setSelectedMealPlanId(currentWeekPlan.id)

      // Get all shopping lists for active plans
      const planIds = activePlans.map(p => p.id)
      const { data: activeLists } = await supabase
        .from('shopping_lists')
        .select('id, meal_plan_id')
        .in('meal_plan_id', planIds)

      if (!activeLists?.length) {
        // Try to create list for current week's plan
        await loadList(currentWeekPlan.id)
        return
      }

      // Use current week's list as primary (for writes)
      const currentWeekList = activeLists.find(l => l.meal_plan_id === currentWeekPlan.id) || activeLists[0]
      setListId(currentWeekList.id)

      // Load items from all active lists
      const listIds = activeLists.map(l => l.id)
      const { data: allItems } = await supabase
        .from('shopping_list_items')
        .select('*')
        .in('shopping_list_id', listIds)
        .eq('approval_status', 'approved')
        .order('name')

      setItems(allItems || [])

      // Cleanup: remove stale items from old weeks (> 2 weeks past)
      const twoWeeksAgo = new Date(currentMonday)
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
      const cutoff = twoWeeksAgo.toISOString().split('T')[0]
      const { data: stalePlans } = await supabase
        .from('meal_plans').select('id')
        .eq('household_id', appUser.household_id)
        .lt('week_start_date', cutoff)
      if (stalePlans?.length) {
        const stalePlanIds = stalePlans.map(p => p.id)
        const { data: staleLists } = await supabase
          .from('shopping_lists').select('id').in('meal_plan_id', stalePlanIds)
        if (staleLists?.length) {
          const staleListIds = staleLists.map(l => l.id)
          await supabase.from('shopping_list_items').delete()
            .in('shopping_list_id', staleListIds).eq('status', 'active')
        }
      }

      // Load stores, trips, staples in parallel (household-level)
      supabase.from('grocery_stores').select('id, name, is_primary, sort_order').eq('household_id', appUser.household_id).order('sort_order')
        .then(({ data }) => setStores(data || []))
      supabase.from('shopping_trips').select('id, name, store_name, status, companion_trip_id, is_companion')
        .eq('shopping_list_id', currentWeekList.id).in('status', ['pending', 'active'])
        .order('created_at', { ascending: false })
        .then(({ data }) => setPendingTrips(data || []))
      supabase.from('shopping_trips').select('id, name, store_name, status, completed_at, receipt_photo_url, item_count')
        .eq('shopping_list_id', currentWeekList.id).eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .then(({ data }) => setCompletedTrips(data || []))
      supabase.from('pantry_staples').select('id, name, category, staple_type, sage_tracks')
        .eq('household_id', appUser.household_id)
        .then(({ data: staples }) => setPantryStaples(staples || []))


      setLoading(false)
    } catch (err) {
      console.error('[PantryList] Load error:', err)
      setLoading(false)
    }
  }

  async function loadList(mealPlanId) {
    // Lightweight refresh — ensures current week's list exists, then reloads everything
    const mpId = mealPlanId || selectedMealPlanId
    if (mpId && appUser?.household_id) {
      await getOrCreateShoppingList(mpId, appUser.household_id)
    }
    await loadAllActiveLists()
  }

  // Show onboarding on first visit with items — before tutorial
  useEffect(() => {
    if (loading || items.length === 0) return
    if (appUser?.has_seen_shopping_onboarding) return
    supabase.from('users').select('has_seen_shopping_onboarding').eq('id', appUser.id).single()
      .then(({ data }) => {
        if (!data?.has_seen_shopping_onboarding) setShowOnboarding(true)
      })
  }, [loading, items.length])

  // Check for ghost meals with no ingredients on the list — scoped to selected meal plan
  useEffect(() => {
    if (loading || !appUser?.household_id || !listId || !selectedMealPlanId) return
    async function checkGhosts() {
      const { data: ghosts } = await supabase.from('planned_meals')
        .select('id, custom_name')
        .eq('meal_plan_id', selectedMealPlanId)
        .eq('entry_type', 'ghost')
        .is('recipe_id', null)
        .is('removed_at', null)
        .neq('no_recipe_acknowledged', true)
      if (!ghosts?.length) { setGhostMealsWithoutIngredients([]); return }

      // Cross-reference meal_recipe_skips — exclude suppressed meals
      const { data: skips } = await supabase.from('meal_recipe_skips')
        .select('meal_name').eq('household_id', appUser.household_id).eq('suppressed', true)
      const suppressedNames = new Set((skips || []).map(s => (s.meal_name || '').toLowerCase()))

      // Cross-reference sage_meal_preferences — exclude keep-as-is meals
      const { data: prefs } = await supabase.from('sage_meal_preferences')
        .select('meal_name').eq('household_id', appUser.household_id).eq('no_recipe_needed', true)
      for (const p of (prefs || [])) suppressedNames.add((p.meal_name || '').toLowerCase())

      const itemNames = new Set(items.map(i => (i.source_meal_name || '').toLowerCase()))
      const uncovered = ghosts.filter(g => {
        const name = (g.custom_name || '').toLowerCase()
        return !itemNames.has(name) && !suppressedNames.has(name)
      })
      setGhostMealsWithoutIngredients(uncovered)
    }
    checkGhosts()
  }, [loading, listId, items.length, selectedMealPlanId])

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

  // "Just this week" — sets have_it_this_week on shopping_list_items
  async function markHaveItThisWeek(item) {
    const ids = item.ids || [item.id]
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, have_it_this_week: true } : i))
    setHaveItExpansion(null)
    for (const id of ids) {
      await supabase.from('shopping_list_items').update({ have_it_this_week: true }).eq('id', id)
    }

    // Create pantry_inventory row — source 'manual', on_hand immediately
    let storageType = 'dry'
    try {
      const { data: ing } = await supabase.from('ingredients')
        .select('storage_type').ilike('name', item.name).not('storage_type', 'is', null).limit(1).maybeSingle()
      if (ing?.storage_type) storageType = ing.storage_type
    } catch {}
    const qtyNum = item.quantity ? parseFloat(item.quantity) : null
    await supabase.from('pantry_inventory').insert({
      household_id: appUser.household_id,
      name: item.name,
      quantity: qtyNum && !isNaN(qtyNum) ? qtyNum : null,
      unit: item.unit || null,
      storage_type: storageType,
      status: 'on_hand',
      source: 'manual',
      shopping_list_item_id: ids[0],
      meal_plan_context: (item.sourceMeals?.length ? `For ${item.sourceMeals.join(', ')}` : null),
      purchased_date: new Date().toISOString().split('T')[0],
    })

    logActivity({ user: appUser, actionType: 'item_have_it_this_week', targetType: 'shopping_item', targetName: item.name })
  }

  // "Actually need it" — resets have_it_this_week
  async function markActuallyNeedIt(item) {
    const ids = item.ids || [item.id]
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, have_it_this_week: false } : i))
    for (const id of ids) {
      await supabase.from('shopping_list_items').update({ have_it_this_week: false }).eq('id', id)
    }
  }

  // "It's a staple" — insert into pantry_staples with chosen type
  async function markAsStaple(item, stapleType) {
    const name = (item.name || '').trim()
    if (!name) return
    const sageTracksVal = stapleType === 'perishable'
    const newStaple = { name, category: item.grocery_category || 'other', staple_type: stapleType, sage_tracks: sageTracksVal }
    setPantryStaples(prev => [...prev, newStaple])
    setStapleSheetItem(null)
    setHaveItExpansion(null)
    await supabase.from('pantry_staples').upsert(
      { household_id: appUser.household_id, name, category: item.grocery_category || 'other', staple_type: stapleType, sage_tracks: sageTracksVal },
      { onConflict: 'household_id,name', ignoreDuplicates: false }
    )
    logActivity({ user: appUser, actionType: 'item_marked_staple', targetType: 'shopping_item', targetName: name, metadata: { staple_type: stapleType } })
  }

  // Staple inline: "Have it" — mark have_it_this_week (item stays visible but dimmed)
  async function markStapleHaveIt(item) {
    const ids = item.ids || [item.id]
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, have_it_this_week: true } : i))
    for (const id of ids) {
      await supabase.from('shopping_list_items').update({ have_it_this_week: true }).eq('id', id)
    }
    logActivity({ user: appUser, actionType: 'staple_have_it', targetType: 'shopping_item', targetName: item.name })
  }

  // Remove from pantry staples — item returns to normal active manifest
  async function removeStaple(item) {
    const name = (item.name || '').trim()
    setPantryStaples(prev => prev.filter(s => s.name.toLowerCase() !== name.toLowerCase()))
    await supabase.from('pantry_staples')
      .delete()
      .eq('household_id', appUser.household_id)
      .ilike('name', name)
  }

  async function removeItem(item) {
    const ids = item.ids || [item.id]
    // Remove from local state immediately
    setItems(prev => prev.filter(i => !ids.includes(i.id)))
    // If assigned to a trip, clean up trip items and reset state before deleting
    for (const id of ids) {
      if (item.assigned_trip_id) {
        await supabase.from('shopping_trip_items').delete().eq('shopping_list_item_id', id)
        await supabase.from('shopping_list_items').update({
          assigned_trip_id: null, is_purchased: false, purchased_at: null, status: 'active',
        }).eq('id', id)
      }
      await supabase.from('shopping_list_items').delete().eq('id', id)
    }
    logActivity({ user: appUser, actionType: 'shopping_item_removed', targetType: 'shopping_item', targetName: item.name })
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

  // Trip creation — multi-step flow (1=store, 2=items, optionally includes second week)
  function openTripSheet() {
    setTripSheetStep(1)
    setTripStore(null)
    setTripStoreName('')
    setSelectedTripItems(new Set())
    setAddingStore(false)
    setNewStoreName('')
    setSecondWeek(null)
    setTripSheetOpen(true)
  }

  function selectStoreForTrip(store) {
    setTripStore(store.id)
    setTripStoreName(store.name)
    goToItemSelection()
  }

  function goToItemSelection() {
    setTripSheetStep(2)
    // Pre-select all unassigned items from current week
    const unassigned = manifestItems.filter(i => !i.assigned_trip_id).map(i => i.id)
    // Also pre-select second week items if loaded
    const secondIds = (secondWeek?.items || []).filter(i => !i.assigned_trip_id).map(i => i.id)
    setSelectedTripItems(new Set([...unassigned, ...secondIds]))
  }

  async function toggleSecondWeek(offset) {
    if (secondWeek) { setSecondWeek(null); return }
    if (!appUser?.household_id) return
    setSecondWeekLoading(true)
    try {
      const ws = getWeekStartTZ(tz, offset)
      const { data: plan } = await supabase.from('meal_plans')
        .select('id').eq('household_id', appUser.household_id).eq('week_start_date', ws).maybeSingle()
      if (!plan) { setSecondWeekLoading(false); return }
      const swListId = await getOrCreateShoppingList(plan.id, appUser.household_id)
      if (!swListId) { setSecondWeekLoading(false); return }
      const { data: swItems } = await supabase.from('shopping_list_items')
        .select('*').eq('shopping_list_id', swListId).eq('approval_status', 'approved').eq('status', 'active')
      if (!swItems?.length) { setSecondWeekLoading(false); return }
      const dates = getWeekDatesTZ(tz, offset)
      const label = `${dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${dates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      setSecondWeek({ planId: plan.id, listId: swListId, label, items: swItems, offset })
    } catch (err) { console.error('[PantryList] Load second week error:', err) }
    setSecondWeekLoading(false)
  }

  async function addNewStore() {
    if (!newStoreName.trim() || !appUser?.household_id) return
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
    const unassigned = manifestItems.filter(i => !i.assigned_trip_id).map(i => i.id)
    const secondIds = (secondWeek?.items || []).filter(i => !i.assigned_trip_id).map(i => i.id)
    setSelectedTripItems(new Set([...unassigned, ...secondIds]))
  }

  async function saveTrip() {
    if (creatingTrip || !listId || !tripStore || selectedTripItems.size === 0 || !appUser?.household_id) return
    setCreatingTrip(true)
    try {
      const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
      const { count } = await supabase.from('shopping_trips').select('id', { count: 'exact', head: true })
        .eq('household_id', appUser.household_id).eq('store_name', tripStoreName)
        .gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00')
      const tripName = (!count || count === 0) ? `${dayName} ${tripStoreName} run` : `${dayName} ${tripStoreName} run #${count + 1}`

      // Split selected items by week
      const secondWeekItemIds = new Set((secondWeek?.items || []).map(i => i.id))
      const selectedIds = [...selectedTripItems]
      const primaryIds = selectedIds.filter(id => !secondWeekItemIds.has(id))
      const companionIds = selectedIds.filter(id => secondWeekItemIds.has(id))

      // Create primary trip
      const { data: trip, error: tripErr } = await supabase.from('shopping_trips').insert({
        household_id: appUser.household_id, shopping_list_id: listId,
        name: tripName, store_id: tripStore, store_name: tripStoreName,
        status: 'pending', created_by_user_id: appUser.id,
      }).select('id').single()
      if (tripErr) throw tripErr

      // Assign primary week items
      if (primaryIds.length > 0) {
        await supabase.from('shopping_trip_items').insert(primaryIds.map(id => ({ trip_id: trip.id, shopping_list_item_id: id })))
        for (const id of primaryIds) {
          await supabase.from('shopping_list_items').update({ assigned_trip_id: trip.id }).eq('id', id)
        }
      }

      // Create companion trip for second week if items were selected
      if (secondWeek && companionIds.length > 0) {
        const { data: companion, error: compErr } = await supabase.from('shopping_trips').insert({
          household_id: appUser.household_id, shopping_list_id: secondWeek.listId,
          name: tripName + ' (week 2)', store_id: tripStore, store_name: tripStoreName,
          status: 'pending', created_by_user_id: appUser.id,
          is_companion: true, companion_trip_id: trip.id,
        }).select('id').single()
        if (compErr) throw compErr

        // Link primary → companion
        await supabase.from('shopping_trips').update({ companion_trip_id: companion.id }).eq('id', trip.id)

        // Assign second week items to companion trip
        await supabase.from('shopping_trip_items').insert(companionIds.map(id => ({ trip_id: companion.id, shopping_list_item_id: id })))
        for (const id of companionIds) {
          await supabase.from('shopping_list_items').update({ assigned_trip_id: companion.id }).eq('id', id)
        }
      }

      logActivity({ user: appUser, actionType: 'shopping_trip_created', targetType: 'shopping_trip', targetId: trip.id, targetName: tripName, metadata: { multi_week: !!secondWeek && companionIds.length > 0 } })
      setTripSheetOpen(false)
      loadList() // Refresh to show trip card + store tags
    } catch (err) {
      console.error('[PantryList] Create trip error:', err)
    }
    setCreatingTrip(false)
  }

  const completedTripIds = new Set(completedTrips.map(t => t.id))
  const stapleMap = new Map(pantryStaples.map(s => [(s.name || '').toLowerCase().trim(), s]))
  // Active manifest items: not completed-trip, not have_it_this_week — includes staples inline
  const manifestItems = items.filter(i => i.status === 'active' && !completedTripIds.has(i.assigned_trip_id) && !i.have_it_this_week)
  // "Already have it" section: have_it_this_week = true
  const haveThisWeekItems = items.filter(i => i.status === 'active' && i.have_it_this_week)
  const purchasedItems = items.filter(i => i.status === 'purchased')

  // Consolidate duplicate ingredients by name (case-insensitive)
  function consolidateItems(itemList) {
    const map = new Map()
    for (const item of itemList) {
      const key = (item.name || '').toLowerCase().trim()
      if (!key) continue
      if (map.has(key)) {
        const existing = map.get(key)
        // Sum quantities when units match (or both null)
        if (item.quantity && (existing.unit || null) === (item.unit || null)) {
          const a = parseFloat(existing.quantity) || 0
          const b = parseFloat(item.quantity) || 0
          existing.quantity = String(Math.round((a + b) * 100) / 100)
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

  const consolidated = consolidateItems(manifestItems)

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
    if (!addInput.trim() || !listId || adding || !appUser?.household_id) return
    setAdding(true)
    const name = addInput.trim()
    const isAdmin = appUser?.role === 'admin' || appUser?.role === 'co_admin'

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

  function handlePullStart(e) {
    if (window.scrollY <= 0) {
      pullStartY.current = e.touches[0].clientY
    }
  }
  function handlePullMove(e) {
    if (pullStartY.current === null || pullRefreshing) return
    const delta = e.touches[0].clientY - pullStartY.current
    if (delta > 0) setPullDistance(Math.min(delta * 0.5, 80))
  }
  async function handlePullEnd() {
    if (pullDistance > 60 && !pullRefreshing) {
      setPullRefreshing(true)
      setPullDistance(0)
      await loadAllActiveLists()
      setPullRefreshing(false)
    } else {
      setPullDistance(0)
    }
    pullStartY.current = null
  }

  async function refreshList() {
    if (refreshing || !selectedMealPlanId || !appUser?.household_id) return
    setRefreshing(true)
    await injectMealPlanToList({ planId: selectedMealPlanId, householdId: appUser.household_id })
    await loadList()
    setRefreshing(false)
  }


  if (loading) return (
    <div style={{ background: color.paper, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
      <TopBar />
      <div style={{ padding: '20px 22px' }}>
        {[60, 40, 40, 40].map((h, i) => <div key={i} className="shimmer-block" style={{ height: `${h}px`, borderRadius: '12px', marginBottom: '10px' }} />)}
      </div>
    </div>
  )

  return (
    <div
      className="page-scroll-container"
      onTouchStart={handlePullStart}
      onTouchMove={handlePullMove}
      onTouchEnd={handlePullEnd}
      style={{
        background: color.paper, fontFamily: "'Jost', sans-serif", fontWeight: 300,
        minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
        paddingBottom: 'calc(110px + env(safe-area-inset-bottom, 8px))',
      }}>
      <TopBar />

      {/* Sub-tab strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', margin: '0 22px' }}>
        {[['Items to Buy', 'items'], ['On Hand', 'on-hand'], ['Trips', 'trips']].map(([label, key]) => {
          const active = shopTab === key
          return (
            <button key={key} onClick={() => setShopTab(key)} style={{
              padding: '14px', textAlign: 'center',
              fontFamily: "'Jost', sans-serif", fontSize: '12px',
              fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase',
              color: active ? arcColor : color.inkSoft,
              cursor: active ? 'default' : 'pointer', border: 'none', background: 'none',
              borderBottom: active ? `2px solid ${arcColor}` : '2px solid transparent',
              transition: 'color 0.2s cubic-bezier(0.22,1,0.36,1), border-color 0.2s cubic-bezier(0.22,1,0.36,1)',
            }}>{label}</button>
          )
        })}
      </div>

      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || pullRefreshing) && (
        <div style={{
          display: 'flex', justifyContent: 'center',
          padding: pullRefreshing ? '12px 0' : `${Math.max(pullDistance * 0.3, 4)}px 0`,
          transition: pullRefreshing ? 'none' : 'padding 0.1s',
        }}>
          <div style={{
            width: 20, height: 20, border: '2px solid transparent',
            borderTopColor: arcColor, borderRadius: '50%',
            animation: pullRefreshing ? 'spin 0.8s linear infinite' : 'none',
            opacity: pullDistance > 30 || pullRefreshing ? 1 : pullDistance / 30,
            transform: pullRefreshing ? 'none' : `rotate(${pullDistance * 4}deg)`,
          }} />
        </div>
      )}


      {/* ═══ ITEMS TO BUY TAB ═══ */}
      {shopTab === 'items' && <>
      {/* View Pantry link */}
      <div style={{ padding: '8px 22px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => navigate('/pantry')} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: '12px', color: arcColor, fontWeight: 400,
          fontFamily: "'Jost', sans-serif",
        }}>View Pantry →</button>
      </div>

      {/* No meal plan for this week */}
      {noMealPlan && (
        <div style={{ textAlign: 'center', padding: '48px 22px' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: color.ink, marginBottom: '8px' }}>No meals planned for this week</div>
          <button onClick={() => navigate('/plan')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '14px', color: arcColor, fontWeight: 500, fontFamily: "'Jost', sans-serif",
          }}>Plan your week →</button>
        </div>
      )}

      </>}

      {!noMealPlan && <>

      {/* ═══ TRIPS TAB — Start a Trip + pending + completed ═══ */}
      {shopTab === 'trips' && <>
      {/* ── Pending trip cards (Start a Trip is now a FAB below) ── */}
      {pendingTrips.filter(t => !t.is_companion).length > 0 && (
      <div style={{ padding: '10px 22px 6px', display: 'flex', gap: '10px', overflowX: 'auto' }}>
        {pendingTrips.filter(t => !t.is_companion).map(trip => (
          <button key={trip.id} onClick={() => navigate(`/pantry/trip/${trip.id}`)} style={{
            padding: '10px 14px', borderRadius: '12px', cursor: 'pointer',
            background: 'white', color: color.ink, textAlign: 'left',
            border: `1px solid ${color.rule}`, fontFamily: "'Jost', sans-serif", flexShrink: 0,
          }}>
            <div style={{ fontSize: '12px', fontWeight: 500 }}>{trip.store_name || trip.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{
                fontSize: '9px', fontWeight: 500, padding: '1px 5px', borderRadius: '4px',
                background: trip.status === 'active' ? 'rgba(122,140,110,0.12)' : 'rgba(200,185,160,0.15)',
                color: trip.status === 'active' ? color.sage : color.inkSoft,
              }}>{trip.status === 'active' ? 'In Progress' : 'Pending'}</span>
              {trip.companion_trip_id && (
                <span style={{ fontSize: '9px', color: color.inkSoft }}>2 weeks</span>
              )}
            </div>
          </button>
        ))}
      </div>
      )}

      {/* ── Shopping workflow education tooltip ─────────────────────── */}
      {!shoppingTipDismissed && items.length > 0 && (
        <SageNudgeCard
          tier="teaching"
          message="How shopping works: your ingredient list is built from your planned meals. Mark things you already have, then start a trip for each store you're visiting. Check items off as you shop, then scan your receipt when you're done."
          actionLabel="Got it, don't show again"
          onAction={async () => {
            const updated = await dismissTooltip(appUser.id, appUser.dismissed_tooltips, 'shopping_workflow')
            appUser.dismissed_tooltips = updated
            setShoppingTipDismissed(true)
          }}
        />
      )}

      {/* ── Ghost meal notice (consolidated) ─────────────────────── */}
      {ghostMealsWithoutIngredients.length > 0 && (() => {
        const ghosts = ghostMealsWithoutIngredients
        const names = ghosts.map(g => g.custom_name || 'Untitled')
        let label
        if (names.length === 1) {
          label = `${names[0]} doesn't have a recipe yet — add one so your shopping list stays complete.`
        } else if (names.length === 2) {
          label = `${names[0]} and ${names[1]} don't have recipes yet — add them so your shopping list stays complete.`
        } else if (names.length === 3) {
          label = `${names[0]}, ${names[1]}, and ${names[2]} don't have recipes yet — add them so your shopping list stays complete.`
        } else {
          label = `${names[0]}, ${names[1]}, and ${names.length - 2} other${names.length - 2 > 1 ? 's' : ''} don't have recipes yet — add them so your shopping list stays complete.`
        }
        return (
          <div style={{
            margin: '0 22px 14px', background: 'white',
            border: `0.5px solid ${color.rule}`, borderLeft: `3px solid ${color.honey}`,
            borderRadius: '12px', padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={color.honey} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1 }}>
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: color.ink, lineHeight: 1.55, marginBottom: '8px' }}>
                  {label}
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button onClick={() => navigate('/meals')} style={{
                    fontSize: '12px', color: arcColor, background: 'none', border: 'none',
                    padding: 0, cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 500,
                  }}>
                    Add recipes →
                  </button>
                  {ghosts.length === 1 && (
                    <button onClick={() => addToListManually(ghosts[0])} style={{
                      fontSize: '12px', color: color.inkSoft, background: 'none', border: 'none',
                      padding: 0, cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontStyle: 'italic',
                    }}>
                      Add to list manually →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
      </>}

      {/* ═══ ITEMS TO BUY — main grouped list ═══ */}
      {shopTab === 'items' && <>
      <div style={{ padding: '12px 22px' }}>
        {grouped.length === 0 && purchasedItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '16px', color: color.inkSoft, marginBottom: '8px' }}>
              Your list is empty.
            </div>
            <div style={{ fontSize: '13px', color: color.inkSoft }}>
              Tap day tiles on your plan to add meals to your list.
            </div>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.cat} style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: arcColor, marginBottom: '6px', marginTop: '24px', borderLeft: `3px solid ${arcColor}`, paddingLeft: '10px' }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const assignedTrip = item.assigned_trip_id ? pendingTrips.find(t => t.id === item.assigned_trip_id) : null
              const isStaple = stapleMap.has((item.name || '').toLowerCase().trim())
              const stapleInfo = isStaple ? stapleMap.get((item.name || '').toLowerCase().trim()) : null
              const isExpanding = haveItExpansion === (item.ids?.[0] || item.id)
              const isManual = item.item_type === 'manual' || !item.source_meal_name

              return (
                <div key={item.ids?.[0] || item.id} style={{
                  padding: '10px 0', borderBottom: '1px solid rgba(200,185,160,0.25)',
                  borderLeft: isStaple ? '2px solid rgba(122,140,110,0.4)' : 'none',
                  paddingLeft: isStaple ? '10px' : 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', lineHeight: 1.3 }}>
                        <span style={{ fontSize: '14px', color: color.ink }}>{sentenceCase(item.name)}</span>
                        {(item.quantity || item.unit) ? (() => {
                          const qtyStr = [item.quantity, item.unit].filter(Boolean).join(' ')
                          return (
                            <span style={{ fontSize: '12px', color: color.inkSoft }}>
                              ({qtyStr})
                            </span>
                          )
                        })() : item.ids?.length > 1 ? (
                          <span style={{ fontSize: '12px', color: color.inkSoft }}>({item.ids.length} each)</span>
                        ) : null}
                      </div>
                      {isStaple && (
                        <div style={{ fontSize: '11px', color: color.inkSoft, fontStyle: 'italic' }}>Pantry staple</div>
                      )}
                      {item.sourceMeals?.length > 0 && (
                        <div style={{ fontSize: '11px', color: color.inkSoft, fontStyle: 'italic' }}>For {item.sourceMeals.join(', ')}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: assignedTrip ? 'column' : 'row', alignItems: assignedTrip ? 'flex-end' : 'center', gap: assignedTrip ? '4px' : '8px', flexShrink: 0, marginTop: '2px' }}>
                      {assignedTrip && (
                        <button onClick={() => setReassignItem(item)} style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          fontSize: '13px', color: color.inkSoft, fontStyle: 'italic',
                          fontFamily: "'Jost', sans-serif",
                        }}>{assignedTrip.store_name}</button>
                      )}
                      {item.pantry_status === 'pending' ? (
                        <span style={{ fontSize: '11px', color: color.inkSoft, fontStyle: 'italic', fontFamily: "'Jost', sans-serif" }}>In cart</span>
                      ) : isStaple ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => markStapleHaveIt(item)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontSize: '13px', color: color.sage, fontFamily: "'Jost', sans-serif", fontWeight: 400,
                          }}>✓ Have it</button>
                          {isManual && <button onClick={() => removeItem(item)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontSize: '13px', color: color.inkSoft, fontFamily: "'Jost', sans-serif", fontWeight: 300,
                          }}>Remove</button>}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button onClick={() => setHaveItExpansion(isExpanding ? null : (item.ids?.[0] || item.id))} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontSize: '13px', color: color.inkSoft, fontFamily: "'Jost', sans-serif", fontWeight: 300,
                          }}>Have it</button>
                          {isManual && <button onClick={() => removeItem(item)} style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            fontSize: '13px', color: color.inkSoft, fontFamily: "'Jost', sans-serif", fontWeight: 300,
                          }}>Remove</button>}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Inline "Have it" expansion — two choices */}
                  {isExpanding && (
                    <div style={{
                      marginTop: '8px', padding: '8px 10px', background: 'rgba(250,247,242,0.6)',
                      borderRadius: '8px', display: 'flex', gap: '8px',
                    }}>
                      <button onClick={() => markHaveItThisWeek(item)} style={{
                        flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px',
                        border: `1px solid ${color.rule}`, background: 'white', color: color.ink, cursor: 'pointer',
                        fontFamily: "'Jost', sans-serif", fontWeight: 400,
                      }}>Just this week</button>
                      <button onClick={() => { setStapleSheetItem(item); setHaveItExpansion(null) }} style={{
                        flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px',
                        border: `1px solid ${color.sage}`, background: 'rgba(122,140,110,0.06)', color: arcColor, cursor: 'pointer',
                        fontFamily: "'Jost', sans-serif", fontWeight: 500,
                      }}>It's a staple</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      </>}

      {/* ═══ ON HAND TAB ═══ */}
      {shopTab === 'on-hand' && <>
      {haveThisWeekItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '16px', color: color.inkSoft, lineHeight: 1.7 }}>
            Nothing on hand yet.
          </div>
          <div style={{ fontSize: '13px', color: color.inkSoft, marginTop: '4px' }}>
            Tap "Have it" on an item to move it here.
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 22px 12px' }}>
          <button onClick={() => setHaveThisWeekExpanded(!haveThisWeekExpanded)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0',
            fontFamily: "'Jost', sans-serif",
          }}>
            <span style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', color: color.inkSoft }}>
              Already have it ({haveThisWeekItems.length})
            </span>
            <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, transform: haveThisWeekExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {haveThisWeekExpanded && (
            <div>
              {haveThisWeekItems.map(item => (
                <div key={item.id} style={{
                  padding: '8px 0', borderBottom: '1px solid rgba(200,185,160,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: color.inkSoft, fontWeight: 300 }}>{sentenceCase(item.name)}</div>
                    {(item.quantity || item.unit) && (
                      <div style={{ fontSize: '13px', color: color.inkSoft, opacity: 0.6 }}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</div>
                    )}
                  </div>
                  <button onClick={() => markActuallyNeedIt(item)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '13px', color: color.inkSoft, fontFamily: "'Jost', sans-serif", fontWeight: 300, fontStyle: 'italic',
                  }}>Actually need it</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      </>}

      {/* ═══ TRIPS TAB — completed ═══ */}
      {/* (Also add empty state for trips tab) */}
      {shopTab === 'trips' && <>
      {/* ── Completed trips this week ─────────────────────────────── */}
      {completedTrips.length > 0 && (
        <div style={{ padding: '0 22px 16px' }}>
          <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: color.inkSoft, marginBottom: '10px', marginTop: '8px' }}>
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
                background: 'white', borderRadius: '12px', border: `1px solid ${color.rule}`,
                marginBottom: '8px', overflow: 'hidden',
              }}>
                <div onClick={() => toggleExpandTrip(ct.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', cursor: 'pointer',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 400, color: color.ink }}>
                      {ct.name || ct.store_name}
                      <span style={{ color: color.inkSoft, fontWeight: 300 }}> · {ct.item_count || ctItems.length} item{(ct.item_count || ctItems.length) !== 1 ? 's' : ''} · {tripDate}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); if (!hasReceipt) navigate(`/pantry/trip/${ct.id}/receipt`) }} style={{
                      background: 'none', border: 'none', cursor: hasReceipt ? 'default' : 'pointer', padding: '2px',
                      display: 'flex', alignItems: 'center',
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={hasReceipt ? color.sage : color.rule} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
                        <path d="M8 7h8M8 11h8M8 15h4" />
                      </svg>
                    </button>
                    <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${color.rule}` }}>
                    {ctItems.length === 0 && (
                      <div style={{ fontSize: '12px', color: color.inkSoft, fontStyle: 'italic', padding: '10px 0' }}>Loading items...</div>
                    )}
                    {ctGrouped.map(group => (
                      <div key={group.cat} style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: arcColor, marginBottom: '4px', marginTop: '24px', borderLeft: `3px solid ${arcColor}`, paddingLeft: '10px' }}>
                          {group.label}
                        </div>
                        {group.items.map(item => (
                          <div key={item.id} style={{
                            padding: '6px 0', borderBottom: '1px solid rgba(200,185,160,0.15)',
                          }}>
                            <div style={{ fontSize: '13px', color: color.inkSoft, fontWeight: 300 }}>{sentenceCase(item.name)}</div>
                            {(item.quantity || item.unit) && (
                              <div style={{ fontSize: '10px', color: color.inkSoft, opacity: 0.7 }}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</div>
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

      </>}

      {/* ── Add item (Items to Buy tab only) ────────────────────── */}
      {shopTab === 'items' && <>
      <div style={{
        position: 'fixed', bottom: 'calc(48px + env(safe-area-inset-bottom, 8px))',
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', padding: '10px 22px',
        background: color.paper, borderTop: `1px solid ${color.rule}`, zIndex: 50, boxSizing: 'border-box',
      }}>
        {showCatPicker && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
            {CATEGORY_ORDER.map(cat => (
              <button key={cat} onClick={() => { setAddCategory(cat); setManualCatPick(true); setShowCatPicker(false) }} style={{
                padding: '3px 8px', borderRadius: '8px', fontSize: '10px',
                border: addCategory === cat ? `1px solid ${arcColor}` : `1px solid ${color.rule}`,
                background: addCategory === cat ? 'rgba(61,107,79,0.08)' : 'white',
                color: addCategory === cat ? arcColor : color.ink, cursor: 'pointer',
                fontFamily: "'Jost', sans-serif",
              }}>{CATEGORY_LABELS[cat]}</button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={() => setShowCatPicker(!showCatPicker)} style={{
            padding: '6px 10px', borderRadius: '8px', border: `1px solid ${color.rule}`,
            background: 'white', cursor: 'pointer', fontSize: '10px', color: color.inkSoft,
            fontFamily: "'Jost', sans-serif", flexShrink: 0, whiteSpace: 'nowrap',
          }}>{CATEGORY_LABELS[addCategory] || 'Other'}</button>
          <input type="text" value={addInput} onChange={e => handleAddInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addItem() }}
            placeholder="Add to list..." style={{
              flex: 1, padding: '10px 14px', fontSize: '14px', fontFamily: "'Jost', sans-serif", fontWeight: 300,
              border: `1.5px solid ${color.rule}`, borderRadius: '12px', outline: 'none', color: color.ink, background: 'white',
            }} />
          <button onClick={addItem} disabled={!addInput.trim() || adding} style={{
            width: '44px', height: '44px', borderRadius: '12px', border: 'none',
            background: addInput.trim() ? arcColor : color.rule, color: addInput.trim() ? 'white' : color.inkSoft,
            cursor: addInput.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 300,
          }}>+</button>
        </div>
      </div>

      </>}

      {/* ── FAB: Start a Trip (Trips tab only) ──────────────────── */}
      {shopTab === 'trips' && (
        <button onClick={openTripSheet} style={{
          position: 'fixed', bottom: 'calc(58px + env(safe-area-inset-bottom, 8px))', right: '20px',
          width: '56px', height: '56px', borderRadius: '50%',
          background: arcColor, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 50,
          animation: 'fabIn 0.35s cubic-bezier(0.22,1,0.36,1) 0.1s both',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" style={{ width: 24, height: 24 }}>
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      )}

      {/* ── Trip creation sheet — 2-step ────────────────────────── */}
      <BottomSheet isOpen={tripSheetOpen} onClose={() => { setTripSheetOpen(false); setTripSheetStep(1) }} maxHeight="75vh">
            <div style={{ padding: '20px 22px 24px' }}>

              {/* Step 1 — Store selection */}
              {tripSheetStep === 1 && (
                <>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: color.ink, marginBottom: '16px' }}>
                    Which store are we going to?
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {stores.map(s => (
                      <button key={s.id} onClick={() => selectStoreForTrip(s)} style={{
                        padding: '10px 18px', borderRadius: '12px', fontSize: '14px',
                        border: `1.5px solid ${color.rule}`, background: 'white', color: color.ink,
                        cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 400,
                      }}>{s.name}</button>
                    ))}
                  </div>
                  {addingStore ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <input type="text" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} placeholder="Store name..."
                        autoFocus style={{ flex: 1, padding: '8px 12px', fontSize: '13px', fontFamily: "'Jost', sans-serif",
                          border: `1.5px solid ${color.rule}`, borderRadius: '10px', outline: 'none', color: color.ink }} />
                      <button onClick={addNewStore} disabled={!newStoreName.trim()} style={{
                        padding: '8px 14px', borderRadius: '10px', border: 'none', fontSize: '12px', fontWeight: 500,
                        background: newStoreName.trim() ? arcColor : color.rule, color: newStoreName.trim() ? 'white' : color.inkSoft,
                        cursor: newStoreName.trim() ? 'pointer' : 'default', fontFamily: "'Jost', sans-serif",
                      }}>Add</button>
                    </div>
                  ) : (
                    <button onClick={() => setAddingStore(true)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                      fontSize: '12px', color: color.inkSoft, fontWeight: 300, fontFamily: "'Jost', sans-serif",
                    }}>+ Add a store</button>
                  )}
                </>
              )}

              {/* Step 2 — Item selection (optionally multi-week) */}
              {tripSheetStep === 2 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                      <button onClick={() => { setTripSheetStep(1); setSecondWeek(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: color.inkSoft, fontSize: '12px', fontFamily: "'Jost', sans-serif", padding: 0 }}>← Back</button>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: color.ink, marginTop: '4px' }}>
                        {tripStoreName || 'Shopping'} Trip
                      </div>
                    </div>
                  </div>

                  {/* Multi-week toggle */}
                  <div style={{ marginBottom: '12px', padding: '10px 12px', background: color.paper, borderRadius: '10px' }}>
                    <div style={{ fontSize: '11px', color: color.inkSoft, marginBottom: '6px' }}>Also shop for another week?</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => toggleSecondWeek(1)} disabled={secondWeekLoading} style={{
                        padding: '6px 12px', borderRadius: '8px', fontSize: '12px',
                        border: secondWeek?.offset === 1 ? `1.5px solid ${arcColor}` : `1px solid ${color.rule}`,
                        background: secondWeek?.offset === 1 ? 'rgba(61,107,79,0.08)' : 'white',
                        color: secondWeek?.offset === 1 ? arcColor : color.ink,
                        cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: secondWeek?.offset === 1 ? 500 : 400,
                      }}>{secondWeekLoading ? '...' : secondWeek?.offset === 1 ? `✓ Next week` : '+ Next week'}</button>
                      <button onClick={() => toggleSecondWeek(-1)} disabled={secondWeekLoading} style={{
                        padding: '6px 12px', borderRadius: '8px', fontSize: '12px',
                        border: secondWeek?.offset === -1 ? `1.5px solid ${arcColor}` : `1px solid ${color.rule}`,
                        background: secondWeek?.offset === -1 ? 'rgba(61,107,79,0.08)' : 'white',
                        color: secondWeek?.offset === -1 ? arcColor : color.ink,
                        cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: secondWeek?.offset === -1 ? 500 : 400,
                      }}>{secondWeek?.offset === -1 ? `✓ Last week` : '+ Last week'}</button>
                    </div>
                    {secondWeek && (
                      <div style={{ fontSize: '10px', color: color.sage, marginTop: '4px' }}>Including {secondWeek.label} ({secondWeek.items.length} items)</div>
                    )}
                  </div>

                  <button onClick={selectAllUnassigned} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', marginBottom: '10px',
                    fontSize: '12px', color: arcColor, fontWeight: 500, fontFamily: "'Jost', sans-serif",
                  }}>Select all unassigned</button>

                  {CATEGORY_ORDER.map(cat => {
                    // Combine current week + second week items by category
                    const secondWeekItems = (secondWeek?.items || []).map(i => ({ ...i, _secondWeek: true }))
                    const allItems = [...manifestItems, ...secondWeekItems]
                    const catItems = allItems.filter(i => (i.grocery_category || 'other') === cat)
                    if (catItems.length === 0) return null
                    return (
                      <div key={cat} style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: color.sage, marginBottom: '4px' }}>
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
                                background: isSelected ? arcColor : 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', color: 'white',
                              }}>{isSelected ? '✓' : ''}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '13px', color: color.ink }}>{sentenceCase(item.name)}</div>
                                {(item.quantity || item.unit) && (
                                  <div style={{ fontSize: '10px', color: color.inkSoft }}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</div>
                                )}
                                {secondWeek && (
                                  <div style={{ fontSize: '9px', color: color.inkSoft, fontStyle: 'italic' }}>{item._secondWeek ? (secondWeek.offset === 1 ? 'Next week' : 'Last week') : 'This week'}</div>
                                )}
                              </div>
                              {assignedTo && (
                                <span style={{ fontSize: '9px', color: color.inkSoft, fontStyle: 'italic' }}>{assignedTo.store_name}</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}

                  <div style={{ position: 'sticky', bottom: 0, background: 'white', padding: '12px 0 0' }}>
                    <div style={{ fontSize: '12px', color: color.inkSoft, marginBottom: '8px', textAlign: 'center' }}>
                      {selectedTripItems.size} item{selectedTripItems.size !== 1 ? 's' : ''} selected
                    </div>
                    <button onClick={saveTrip} disabled={creatingTrip || selectedTripItems.size === 0} style={{
                      width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
                      background: selectedTripItems.size > 0 ? arcColor : color.rule,
                      color: selectedTripItems.size > 0 ? 'white' : color.inkSoft,
                      cursor: selectedTripItems.size > 0 ? 'pointer' : 'default',
                      fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                      boxShadow: selectedTripItems.size > 0 ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
                    }}>{creatingTrip ? 'Saving...' : 'Save trip →'}</button>
                  </div>
                </>
              )}
            </div>
      </BottomSheet>

      {/* ── Trip Reassignment Sheet ──────────────────────────────── */}
      {reassignItem && (() => {
        const currentTripId = reassignItem.assigned_trip_id
        const currentTrip = pendingTrips.find(t => t.id === currentTripId)
        const otherTrips = pendingTrips.filter(t => t.id !== currentTripId)
        return (
          <BottomSheet isOpen={!!reassignItem} onClose={() => setReassignItem(null)}>
              <div style={{ padding: '16px 22px 20px' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: color.ink, marginBottom: '6px' }}>
                  {sentenceCase(reassignItem.name)}
                </div>
                {currentTrip && (
                  <div style={{ fontSize: '12px', color: color.inkSoft, marginBottom: '16px' }}>
                    Currently on your {currentTrip.store_name} trip
                  </div>
                )}

                {otherTrips.length > 0 && (
                  <>
                    <div style={{ fontSize: '11px', color: color.inkSoft, marginBottom: '8px' }}>Move to another trip</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                      {otherTrips.map(t => (
                        <button key={t.id} onClick={() => reassignToTrip(reassignItem, t.id)} style={{
                          padding: '8px 16px', borderRadius: '10px', fontSize: '13px',
                          border: `1.5px solid ${color.rule}`, background: 'white', color: color.ink,
                          cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 400,
                        }}>{t.store_name || t.name}</button>
                      ))}
                    </div>
                  </>
                )}

                <button onClick={() => setReassignItem(null)} style={{
                  width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                  background: arcColor, color: 'white', cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                  boxShadow: '0 4px 16px rgba(30,55,35,0.25)', marginBottom: '12px',
                }}>Done</button>

                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => removeFromTrip(reassignItem)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: '13px', color: color.inkSoft, fontFamily: "'Jost', sans-serif", fontWeight: 300,
                  }}>Remove from trip</button>
                </div>
              </div>
          </BottomSheet>
        )
      })()}

      {/* ── Staple type picker sheet ────────────────────────────── */}
      <BottomSheet isOpen={!!stapleSheetItem} onClose={() => setStapleSheetItem(null)} title="What kind of staple?">
            <div style={{ padding: '20px 22px 24px' }}>
              <div style={{ fontSize: '12px', color: color.inkSoft, marginBottom: '16px' }}>
                {sentenceCase(stapleSheetItem?.name)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { type: 'perishable', emoji: '\uD83E\uDD5B', label: 'Perishable', desc: 'Dairy, meat, fresh produce' },
                  { type: 'non_perishable', emoji: '\uD83E\uDDC2', label: 'Non-perishable', desc: 'Seasonings, oils, canned goods' },
                  { type: 'household', emoji: '\uD83E\uDDF1', label: 'Household', desc: 'Cleaning supplies, paper goods' },
                ].map(opt => (
                  <button key={opt.type} onClick={() => markAsStaple(stapleSheetItem, opt.type)} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                    borderRadius: '12px', border: `1.5px solid ${color.rule}`, background: 'white',
                    cursor: 'pointer', textAlign: 'left', fontFamily: "'Jost', sans-serif",
                  }}>
                    <span style={{ fontSize: '20px' }}>{opt.emoji}</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: color.ink }}>{opt.label}</div>
                      <div style={{ fontSize: '11px', color: color.inkSoft, fontWeight: 300 }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
      </BottomSheet>

      </>}

      {showOnboarding && (
        <ShoppingOnboarding
          appUser={appUser}
          onComplete={() => setShowOnboarding(false)}
        />
      )}

      <BottomNav activeTab="shop" />
    </div>
  )
}
