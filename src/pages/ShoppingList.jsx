/**
 * ShoppingList.jsx — Shopping List screen, Phase 2.
 * Standalone page: own topbar + bottom nav (no Shell wrapper).
 * Three states: Building → Shopping → Complete.
 * Matches prototypes/roux-shopping-style1.html exactly.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'
import WatermarkLayer from '../components/WatermarkLayer'
import { getWeekStartTZ } from '../lib/dateUtils'
import { useArc } from '../context/ArcContext'

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

// ── Aisle sections in canonical order ─────────────────────────────────────────
const AISLE_SECTIONS = [
  { key: 'protein',  label: 'Meat & Seafood',    emoji: '🥩' },
  { key: 'produce',  label: 'Produce',            emoji: '🥬' },
  { key: 'dairy',    label: 'Dairy & Eggs',       emoji: '🧀' },
  { key: 'deli',     label: 'Deli',               emoji: '🥗' },
  { key: 'pantry',   label: 'Pantry & Canned',    emoji: '🥫' },
  { key: 'bakery',   label: 'Bread & Bakery',     emoji: '🍞' },
  { key: 'frozen',   label: 'Frozen',             emoji: '❄️' },
  { key: 'other',    label: 'Household & Other',  emoji: '🛒' },
]

// ── Week start helper is now timezone-aware (see dateUtils.js) ────────────────

function formatWeekLabel(weekStart) {
  if (!weekStart) return ''
  const d    = new Date(weekStart + 'T00:00:00')
  const opts = { month: 'long', day: 'numeric' }
  return d.toLocaleDateString('en-US', opts)
}

function formatPrice(n) {
  if (n == null || isNaN(n)) return null
  return `$${parseFloat(n).toFixed(2)}`
}

// ── Sage nudge copy (static for now) ──────────────────────────────────────────
const SAGE_NUDGES = [
  "Check your pantry for olive oil — it shows up in several recipes this week.",
  "You might want to grab an extra dozen eggs. Baking days are coming.",
  "Buying in bulk? Chicken thighs are usually cheaper at warehouse stores.",
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function ShoppingList({ appUser }) {
  const { color: arcColor } = useArc()
  const navigate = useNavigate()

  // ── Data state ───────────────────────────────────────────────────────────────
  const [loading,       setLoading]       = useState(true)
  const [noList,        setNoList]        = useState(false)
  const [shoppingList,  setShoppingList]  = useState(null)
  const [items,         setItems]         = useState([])
  const [weekStart,     setWeekStart]     = useState('')

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [shoppingState,    setShoppingState]    = useState('building')  // building | shopping | complete
  const [expandedItem,     setExpandedItem]     = useState(null)        // id of item with actions visible
  const [collapsedSections, setCollapsedSections] = useState(new Set()) // section keys that are collapsed
  const [gotItExpanded,    setGotItExpanded]    = useState(false)
  const [sageVisible,      setSageVisible]      = useState(true)
  const [sageNudgeIdx,     setSageNudgeIdx]     = useState(0)
  const [activeStoreFilter, setActiveStoreFilter] = useState('all')
  const [stores,           setStores]           = useState([])
  const [addingStore,      setAddingStore]      = useState(false)
  const [newStoreName,     setNewStoreName]     = useState('')
  const [startBtnPressed,  setStartBtnPressed]  = useState(false)
  const [inCartPulsing,    setInCartPulsing]    = useState(false)
  const [completeVisible,  setCompleteVisible]  = useState(false)
  const [receiptSheetOpen, setReceiptSheetOpen] = useState(false)

  const inCartRef = useRef(null)

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (appUser) loadShoppingList()
  }, [appUser])

  async function loadShoppingList() {
    if (!appUser?.household_id) return
    setLoading(true)
    const tz = appUser?.timezone ?? 'America/Chicago'
    const ws = getWeekStartTZ(tz)
    setWeekStart(ws)

    // Load grocery stores for filter pills
    const { data: storeData } = await supabase
      .from('grocery_stores')
      .select('id, name, is_primary')
      .eq('household_id', appUser.household_id)
      .order('is_primary', { ascending: false })
    if (storeData) setStores(storeData)

    // 1. Find this week's meal plan
    const { data: plan } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('household_id', appUser.household_id)
      .eq('week_start_date', ws)
      .maybeSingle()

    if (!plan) { setNoList(true); setLoading(false); return }

    // 2. Find shopping list for this plan
    const { data: list } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('meal_plan_id', plan.id)
      .eq('household_id', appUser.household_id)
      .maybeSingle()

    if (!list) { await autoGenerateList(plan); return }

    setShoppingList(list)
    // Map DB status to UI state
    const uiState = list.status === 'finalized' ? 'shopping'
                  : list.status === 'completed' ? 'complete'
                  : 'building'
    setShoppingState(uiState)
    if (uiState === 'complete') setCompleteVisible(true)

    // 3. Load items
    const { data: rawItems } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('shopping_list_id', list.id)
      .order('category')
      .order('name')

    setItems(rawItems ?? [])
    setLoading(false)
  }

  async function autoGenerateList(plan) {
    if (!appUser?.household_id) return
    try {
      // Create shopping list record
      const { data: newList, error: listErr } = await supabase
        .from('shopping_lists')
        .insert({ household_id: appUser.household_id, meal_plan_id: plan.id, status: 'draft' })
        .select()
        .single()

      if (listErr || !newList) { setNoList(true); setLoading(false); return }

      // Get recipe_ids from planned meals this week
      const { data: meals } = await supabase
        .from('planned_meals')
        .select('recipe_id')
        .eq('meal_plan_id', plan.id)
        .eq('slot_type', 'recipe')
        .not('recipe_id', 'is', null)

      const recipeIds = [...new Set((meals ?? []).map(m => m.recipe_id))]

      if (recipeIds.length > 0) {
        const { data: ingredients } = await supabase
          .from('ingredients')
          .select('name, quantity, unit, recipe_id, is_perishable, perishable_days')
          .in('recipe_id', recipeIds)

        if (ingredients?.length > 0) {
          await supabase.from('shopping_list_items').insert(
            ingredients.map(ing => ({
              shopping_list_id: newList.id,
              household_id:     appUser.household_id,
              name:             ing.name,
              quantity:         ing.quantity,
              unit:             ing.unit,
              source_type:      'recipe',
              recipe_id:        ing.recipe_id,
              category:         'other',
              is_perishable:    ing.is_perishable,
              perishable_days:  ing.perishable_days,
            }))
          )
        }
      }

      setShoppingList(newList)
      setShoppingState('building')

      const { data: rawItems } = await supabase
        .from('shopping_list_items')
        .select('*')
        .eq('shopping_list_id', newList.id)
        .order('category')
        .order('name')

      setItems(rawItems ?? [])
    } catch (err) {
      console.error('Auto-generate shopping list failed:', err)
      setNoList(true)
    }
    setLoading(false)
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const activeItems   = items.filter(i => !i.is_purchased && !i.already_have)
  const gotItItems    = items.filter(i => i.is_purchased)
  const alreadyHaveItems = items.filter(i => i.already_have && !i.is_purchased)

  const estimatedTotal = shoppingList?.estimated_cost
    ? parseFloat(shoppingList.estimated_cost)
    : activeItems.reduce((sum, i) => sum + (parseFloat(i.estimated_price) || 0), 0)

  const inCartTotal  = gotItItems.reduce((sum, i) => sum + (parseFloat(i.estimated_price) || 0), 0)
  const remaining    = estimatedTotal - inCartTotal
  const remainingPct = estimatedTotal > 0 ? remaining / estimatedTotal : 1
  const remainingColor = remainingPct < 0.2 ? C.honey : C.forest

  // ── In Cart pulse ────────────────────────────────────────────────────────────
  function triggerInCartPulse() {
    setInCartPulsing(true)
    setTimeout(() => setInCartPulsing(false), 200)
  }

  // ── Item tap — show/hide action buttons ──────────────────────────────────────
  function tapItem(itemId) {
    setExpandedItem(prev => prev === itemId ? null : itemId)
  }

  // ── Got It ───────────────────────────────────────────────────────────────────
  async function handleGotIt(item) {
    setExpandedItem(null)
    setItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, is_purchased: true, purchased_at: new Date().toISOString() } : i
    ))
    triggerInCartPulse()

    await supabase.from('shopping_list_items')
      .update({ is_purchased: true, purchased_at: new Date().toISOString() })
      .eq('id', item.id)
  }

  // ── Already Have ─────────────────────────────────────────────────────────────
  async function handleAlreadyHave(item) {
    setExpandedItem(null)
    setItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, already_have: true } : i
    ))

    await supabase.from('shopping_list_items')
      .update({ already_have: true })
      .eq('id', item.id)
  }

  // ── Undo Got It (tap checked item) ──────────────────────────────────────────
  async function handleUndoGotIt(item) {
    setItems(prev => prev.map(i =>
      i.id === item.id ? { ...i, is_purchased: false, purchased_at: null } : i
    ))
    triggerInCartPulse()

    await supabase.from('shopping_list_items')
      .update({ is_purchased: false, purchased_at: null })
      .eq('id', item.id)
  }

  // ── State transitions ────────────────────────────────────────────────────────
  async function saveNewStore() {
    if (!newStoreName.trim() || !appUser?.household_id) return
    try {
      const { data, error } = await supabase.from('grocery_stores').insert({
        household_id: appUser.household_id,
        name: newStoreName.trim(),
      }).select('id, name').single()
      if (error) throw error
      setStores(prev => [...prev, data])
      setNewStoreName('')
      setAddingStore(false)
    } catch (err) {
      console.error('[Roux] saveNewStore error:', err)
    }
  }

  async function startShopping() {
    setStartBtnPressed(true)
    setTimeout(() => setStartBtnPressed(false), 150)
    setSageVisible(false)
    await supabase.from('shopping_lists')
      .update({ status: 'finalized' })
      .eq('id', shoppingList.id)
    setShoppingState('shopping')
  }

  async function doneShopping() {
    await supabase.from('shopping_lists')
      .update({ status: 'completed', actual_cost: inCartTotal })
      .eq('id', shoppingList.id)
    setShoppingState('complete')
    setCompleteVisible(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Section collapse ─────────────────────────────────────────────────────────
  function toggleSection(key) {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // ── Receipt sheet ────────────────────────────────────────────────────────────
  function openReceiptSheet() {
    setReceiptSheetOpen(true)
  }
  function closeReceiptSheet() {
    setReceiptSheetOpen(false)
  }

  // ── Store filter (client side) ───────────────────────────────────────────────
  function filteredItems(sectionItems) {
    if (activeStoreFilter === 'all') return sectionItems
    return sectionItems.filter(i => {
      if (!i.store_id) return false
      // We don't have store names here without joining; just return all for now
      return true
    })
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
        <TopBar />
        <div style={{ padding: '20px 24px' }}>
          <div className="shimmer-block" style={{ height: '72px', borderRadius: '12px', marginBottom: '12px' }} />
          <div className="shimmer-block" style={{ height: '44px', borderRadius: '10px', marginBottom: '20px' }} />
          <div className="shimmer-block" style={{ height: '160px', borderRadius: '14px', marginBottom: '12px' }} />
          <div className="shimmer-block" style={{ height: '120px', borderRadius: '14px', marginBottom: '12px' }} />
          <div className="shimmer-block" style={{ height: '100px', borderRadius: '14px' }} />
        </div>
        <BottomNav activeTab="pantry" />
      </div>
    )
  }

  // ── No list state ────────────────────────────────────────────────────────────
  if (noList) {
    return (
      <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif", paddingBottom: '64px' }}>
        <WatermarkLayer />
        <TopBar />
        <div style={{ padding: '48px 32px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🛒</div>
          <div style={{
            fontFamily: "'Playfair Display', serif", fontSize: '26px',
            fontWeight: 500, color: C.ink, marginBottom: '12px',
          }}>
            No list yet
          </div>
          <div style={{ fontSize: '14px', color: C.driftwood, lineHeight: 1.65, marginBottom: '32px', fontWeight: 300 }}>
            Your shopping list will appear here once you've published this week's plan.
          </div>
          <button
            onClick={() => navigate('/thisweek')}
            style={{
              background: arcColor, color: 'white', border: 'none',
              borderRadius: '12px', padding: '14px 28px',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
              cursor: 'pointer', boxShadow: '0 3px 10px rgba(30,55,35,0.22)',
            }}
          >
            Go to This Week
          </button>
        </div>
        <BottomNav activeTab="pantry" />
      </div>
    )
  }

  // ── Variance for Complete card ───────────────────────────────────────────────
  const variance    = estimatedTotal - inCartTotal
  const underBudget = variance >= 0

  return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: '64px', position: 'relative', overflowX: 'hidden',
    }}>

      <WatermarkLayer />

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <TopBar />

      {/* ── Sticky page header ──────────────────────────────────────── */}
      <div style={{
        position: 'sticky',
        top: '66px',
        zIndex: 10,
        background: C.cream,
        boxShadow: '0 1px 0 #E4DDD2',
        padding: '12px 18px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink }}>
          Shopping List
        </div>
      </div>

      {/* ── Start/Done Shopping CTA (cream body, before budget strip) ──────── */}
      {shoppingState !== 'complete' && (
        <div style={{ padding: '14px 24px 0', position: 'relative', zIndex: 1, animation: 'fadeUp 0.3s ease both' }}>
          <button
            onClick={shoppingState === 'building' ? startShopping : doneShopping}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              background: arcColor, color: 'white', border: 'none',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
              cursor: 'pointer', letterSpacing: '0.3px',
              boxShadow: '0 2px 10px rgba(61,107,79,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
            }}
          >
            {shoppingState === 'building' ? <><CartIcon size={17} /> Start Shopping</> : <><CheckIcon size={17} /> Done Shopping</>}
          </button>

          {/* Store filter pills */}
          {shoppingState === 'building' && (
            <div className="no-scrollbar" style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginTop: '10px', alignItems: 'center' }}>
              {[{ id: 'all', name: 'All Stores' }, ...stores].map(store => {
                const isActive = activeStoreFilter === (store.id === 'all' ? 'all' : store.id)
                return (
                  <button
                    key={store.id}
                    onClick={() => setActiveStoreFilter(store.id === 'all' ? 'all' : store.id)}
                    style={{
                      fontSize: '11px', fontWeight: 500, padding: '6px 14px',
                      borderRadius: '20px', whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                      background: isActive ? 'rgba(122,140,110,0.10)' : 'white',
                      border: isActive ? `1px solid ${C.sage}` : '1px solid rgba(200,185,160,0.55)',
                      color: isActive ? arcColor : C.driftwood,
                      fontFamily: "'Jost', sans-serif", transition: 'all 0.15s',
                      boxShadow: '0 1px 3px rgba(80,60,30,0.06)',
                    }}
                  >
                    {store.name}
                  </button>
                )
              })}
              {addingStore ? (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
                  <input
                    type="text"
                    value={newStoreName}
                    onChange={e => setNewStoreName(e.target.value)}
                    placeholder="Store name"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveNewStore() }}
                    style={{
                      padding: '5px 10px', fontSize: '11px', width: '110px',
                      border: `1px solid ${C.sage}`, borderRadius: '20px',
                      fontFamily: "'Jost', sans-serif", color: C.ink,
                      outline: 'none', background: 'white',
                    }}
                  />
                  <button
                    onClick={saveNewStore}
                    disabled={!newStoreName.trim()}
                    style={{
                      padding: '5px 10px', fontSize: '10px', fontWeight: 500,
                      borderRadius: '20px', cursor: newStoreName.trim() ? 'pointer' : 'default',
                      border: 'none', background: arcColor, color: 'white',
                      fontFamily: "'Jost', sans-serif", flexShrink: 0,
                    }}
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingStore(true); setNewStoreName('') }}
                  style={{
                    fontSize: '11px', fontWeight: 400, padding: '6px 14px',
                    borderRadius: '20px', whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                    border: '1px dashed rgba(200,185,160,0.6)',
                    background: 'transparent', color: C.driftwood,
                    fontFamily: "'Jost', sans-serif",
                  }}
                >
                  + Add store
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Complete card ────────────────────────────────────────────────────── */}
      {completeVisible && shoppingState === 'complete' && (
        <div style={{
          margin: '20px 24px', background: 'white',
          border: '1px solid rgba(61,107,79,0.2)', borderRadius: '16px',
          padding: '24px 20px', textAlign: 'center',
          boxShadow: '0 4px 20px rgba(61,107,79,0.10)',
          position: 'relative', zIndex: 1,
          animation: 'fadeUp 0.35s ease both',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🛒</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500, color: C.ink, marginBottom: '8px' }}>
            All done{appUser?.name ? `, ${appUser.name.split(' ')[0]}` : ''}.
          </div>
          <div style={{ fontSize: '14px', color: C.driftwood, fontWeight: 300, lineHeight: 1.6, marginBottom: '20px' }}>
            {formatPrice(inCartTotal)} spent this week
            {variance !== 0 && (
              <> — <strong style={{ color: underBudget ? C.forest : C.honey }}>
                {underBudget
                  ? `${formatPrice(Math.abs(variance))} under estimate. Nice work.`
                  : `${formatPrice(Math.abs(variance))} over estimate.`
                }
              </strong></>
            )}
          </div>

          <div style={{ paddingTop: '18px', borderTop: `1px solid ${C.linen}` }}>
            <div style={{
              fontSize: '10px', fontWeight: 500, letterSpacing: '2px',
              textTransform: 'uppercase', color: C.driftwood, marginBottom: '12px',
            }}>
              Lock in the numbers
            </div>
            <button
              onClick={openReceiptSheet}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px',
                background: arcColor, color: 'white',
                fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                marginBottom: '10px', boxShadow: '0 3px 10px rgba(30,55,35,0.20)',
              }}
            >
              <CameraIcon size={18} />
              Photograph my receipt
            </button>
            <button
              onClick={() => {}}
              style={{
                width: '100%', padding: '11px', borderRadius: '12px',
                background: 'none', color: C.driftwood,
                fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 400,
                border: `1px solid ${C.linen}`, cursor: 'pointer',
              }}
            >
              I'll do this later
            </button>
            <div style={{ fontSize: '11px', color: C.driftwoodSm, marginTop: '10px', lineHeight: 1.5, opacity: 0.75 }}>
              Sage reads your receipt and matches each item automatically. Takes about 10 seconds.
            </div>
          </div>
        </div>
      )}

      {/* ── Budget strip ────────────────────────────────────────────────────── */}
      <div style={{
        margin: '16px 24px 14px', background: 'white',
        border: '1px solid rgba(200,185,160,0.5)', borderRadius: '12px',
        padding: '12px 16px', display: 'flex', alignItems: 'center',
        boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
        position: 'relative', zIndex: 1,
        animation: 'fadeUp 0.35s ease 0.05s both',
      }}>
        <BudgetCol label="Estimated" value={estimatedTotal ? formatPrice(estimatedTotal) : '—'} muted />
        <div style={{ width: '1px', background: C.linen, alignSelf: 'stretch' }} />
        <BudgetCol
          label="In Cart"
          value={formatPrice(inCartTotal) || '$0.00'}
          color={C.forest}
          pulsing={inCartPulsing}
        />
        <div style={{ width: '1px', background: C.linen, alignSelf: 'stretch' }} />
        <BudgetCol
          label="Remaining"
          value={estimatedTotal ? formatPrice(remaining) : '—'}
          color={remainingColor}
        />
      </div>

      {/* ── Sage nudge (Building state only) ────────────────────────────────── */}
      {shoppingState === 'building' && sageVisible && (
        <div style={{
          margin: '0 24px 14px',
          borderLeft: `3px solid ${C.sage}`,
          background: 'white',
          borderRadius: '0 10px 10px 0',
          padding: '11px 14px',
          boxShadow: '0 1px 4px rgba(80,60,30,0.06)',
          position: 'relative', zIndex: 1,
          animation: 'fadeUp 0.35s ease 0.09s both',
          transition: 'opacity 0.2s',
          opacity: sageVisible ? 1 : 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div className="sage-pulse-dot" style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: C.sage, flexShrink: 0, marginTop: '5px',
            }} />
            <div style={{ flex: 1, fontSize: '12.5px', color: C.ink, lineHeight: 1.5 }}>
              {SAGE_NUDGES[sageNudgeIdx]}
            </div>
            <button
              onClick={() => setSageVisible(false)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.driftwood, fontSize: '14px', lineHeight: 1,
                padding: '0 0 0 8px', flexShrink: 0,
              }}
              aria-label="Dismiss Sage nudge"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── List sections ───────────────────────────────────────────────────── */}
      {AISLE_SECTIONS.map(({ key, label, emoji }, sectionIdx) => {
        const sectionItems = activeItems.filter(i => (i.category || 'other') === key)
        if (sectionItems.length === 0) return null
        const isCollapsed = collapsedSections.has(key)
        const delay = 0.08 + sectionIdx * 0.03

        return (
          <div key={key} style={{ animation: `fadeUp 0.35s ease ${delay}s both` }}>
            {/* Section header */}
            <button
              onClick={() => toggleSection(key)}
              style={{
                width: '100%', padding: '14px 24px 8px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'none', border: 'none', cursor: 'pointer',
                position: 'relative', zIndex: 1,
              }}
            >
              <div style={{
                fontSize: '10px', fontWeight: 500, letterSpacing: '2px',
                textTransform: 'uppercase', color: C.driftwoodSm,
                display: 'flex', alignItems: 'center', gap: '7px',
              }}>
                <span>{emoji}</span>
                {label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: C.driftwoodSm, fontWeight: 300, opacity: 0.7 }}>
                  {sectionItems.length} item{sectionItems.length !== 1 ? 's' : ''}
                </span>
                <svg
                  viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    width: '12px', height: '12px', flexShrink: 0,
                    transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                    transition: 'transform 0.22s ease',
                  }}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </button>

            {/* Section items */}
            {!isCollapsed && (
              <div style={{
                margin: '0 24px 4px', background: 'white',
                borderRadius: '14px', border: '1px solid rgba(200,185,160,0.4)',
                boxShadow: '0 1px 4px rgba(80,60,30,0.05)',
                overflow: 'hidden', position: 'relative', zIndex: 1,
              }}>
                {sectionItems.map((item, idx) => (
                  <ListItem
                    key={item.id}
                    item={item}
                    isLast={idx === sectionItems.length - 1}
                    isExpanded={expandedItem === item.id}
                    shoppingState={shoppingState}
                    onTap={() => tapItem(item.id)}
                    onGotIt={() => handleGotIt(item)}
                    onAlreadyHave={() => handleAlreadyHave(item)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* ── Got It section ──────────────────────────────────────────────────── */}
      {gotItItems.length > 0 && (
        <div style={{ animation: 'fadeUp 0.35s ease 0.2s both' }}>
          <div style={{
            padding: '18px 24px 8px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', position: 'relative', zIndex: 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '10px', fontWeight: 500, letterSpacing: '2px',
                textTransform: 'uppercase', color: C.sage,
              }}>
                Got It
              </span>
              <span style={{ fontSize: '10px', color: C.driftwoodSm, fontWeight: 300 }}>
                {gotItItems.length} item{gotItItems.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div style={{
            margin: '0 24px 4px', background: 'white',
            borderRadius: '14px', border: '1px solid rgba(200,185,160,0.4)',
            boxShadow: '0 1px 4px rgba(80,60,30,0.05)',
            overflow: 'hidden', position: 'relative', zIndex: 1,
            opacity: 0.55,
          }}>
            {/* Show max 3 by default */}
            {(gotItExpanded ? gotItItems : gotItItems.slice(0, 3)).map((item, idx) => (
              <GotItItem
                key={item.id}
                item={item}
                isLast={idx === (gotItExpanded ? gotItItems.length - 1 : Math.min(3, gotItItems.length) - 1)}
                onUndo={() => handleUndoGotIt(item)}
              />
            ))}
          </div>

          {/* "Show all" chip */}
          {gotItItems.length > 3 && !gotItExpanded && (
            <div
              onClick={() => setGotItExpanded(true)}
              style={{
                margin: '4px 24px 8px', padding: '9px 14px',
                background: 'rgba(122,140,110,0.07)',
                border: '1px solid rgba(122,140,110,0.2)',
                borderRadius: '8px', fontSize: '12px', color: C.sage,
                textAlign: 'center', cursor: 'pointer',
                transition: 'background 0.15s',
                position: 'relative', zIndex: 1,
              }}
            >
              Show all {gotItItems.length} got-it items ↓
            </div>
          )}
          {gotItExpanded && gotItItems.length > 3 && (
            <div
              onClick={() => setGotItExpanded(false)}
              style={{
                margin: '4px 24px 8px', padding: '9px 14px',
                background: 'rgba(122,140,110,0.07)',
                border: '1px solid rgba(122,140,110,0.2)',
                borderRadius: '8px', fontSize: '12px', color: C.sage,
                textAlign: 'center', cursor: 'pointer',
                transition: 'background 0.15s',
                position: 'relative', zIndex: 1,
              }}
            >
              Show less ↑
            </div>
          )}
        </div>
      )}

      {/* ── Empty list state (all items checked) ────────────────────────────── */}
      {activeItems.length === 0 && !loading && !noList && shoppingState !== 'complete' && (
        <div style={{ textAlign: 'center', padding: '32px 24px', position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: C.ink, marginBottom: '6px' }}>
            All items accounted for.
          </div>
          <div style={{ fontSize: '13px', color: C.driftwood }}>
            Tap "Done Shopping" when you're ready to wrap up.
          </div>
        </div>
      )}

      {/* ── Bottom nav ──────────────────────────────────────────────────────── */}
      <BottomNav activeTab="pantry" />

      {/* ── Receipt capture overlay ──────────────────────────────────────────── */}
      <BottomSheet isOpen={receiptSheetOpen} onClose={() => setReceiptSheetOpen(false)} title="Add your receipt">
        <div style={{ padding: '20px 24px 40px' }}>
          <div style={{ textAlign: 'center', padding: '24px 0', color: C.driftwood, fontSize: '14px' }}>
            Receipt capture coming soon.
          </div>
          <button
            onClick={closeReceiptSheet}
            style={{
              width: '100%', padding: '12px', borderRadius: '10px',
              background: 'none', color: C.driftwood,
              fontFamily: "'Jost', sans-serif", fontSize: '13px',
              border: `1px solid ${C.linen}`, cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </BottomSheet>

    </div>
  )
}

// ── Budget column ──────────────────────────────────────────────────────────────
function BudgetCol({ label, value, muted, color, pulsing }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.8px', textTransform: 'uppercase', color: '#6B5B4E', marginBottom: '3px' }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: muted ? '15px' : '18px',
        color: muted ? '#8C7B6B' : (color || '#2C2417'),
        display: 'inline-block',
        transition: 'color 0.3s',
        animation: pulsing ? 'inCartPulse 0.18s ease' : 'none',
      }}>
        {value}
      </div>
    </div>
  )
}

// ── List item ──────────────────────────────────────────────────────────────────
function ListItem({ item, isLast, isExpanded, shoppingState, onTap, onGotIt, onAlreadyHave }) {
  const { color: arcColor } = useArc()
  const isShopping    = shoppingState === 'shopping'
  const cbSize        = isShopping ? '30px' : '26px'
  const cbRadius      = isShopping ? '10px' : '8px'
  const itemMinHeight = isShopping ? '64px' : '56px'

  const qtyStr = [item.quantity, item.unit].filter(Boolean).join(' ')

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: '12px 14px 10px',
      borderBottom: isLast ? 'none' : '1px solid rgba(200,185,160,0.2)',
      minHeight: itemMinHeight,
      transition: 'opacity 0.25s',
    }}>
      {/* Main row — tap to expand */}
      <div
        onClick={onTap}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          width: '100%', cursor: 'pointer',
        }}
      >
        {/* Checkbox */}
        <div style={{
          width: cbSize, height: cbSize, borderRadius: cbRadius,
          border: '2px solid #E8E0D0', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'white', transition: 'all 0.18s',
        }}>
          {/* Empty checkbox — checkmark appears after Got It */}
        </div>

        {/* Item body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: isShopping ? '15px' : '14px', fontWeight: 400, color: '#2C2417', lineHeight: 1.3, marginBottom: '2px' }}>
            {item.name}
            {item.is_recurring && (
              <span style={{ fontSize: '11px', color: '#7A8C6E', opacity: 0.7, marginLeft: '6px' }}>↻</span>
            )}
          </div>
          {!isShopping && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {item.notes && (
                <span style={{ fontSize: '11px', color: '#8B6F52', fontWeight: 300, fontStyle: 'italic' }}>
                  {item.notes}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: qty + price */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
          {qtyStr && (
            <div style={{ fontSize: '13px', color: '#2C2417', fontWeight: 400 }}>
              {qtyStr}
            </div>
          )}
          {item.estimated_price && (
            <div style={{ fontSize: '11px', color: '#6B5B4E', fontWeight: 300 }}>
              ~{formatPrice(item.estimated_price)}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons — visible on tap */}
      {isExpanded && (
        <div style={{
          display: 'flex', gap: '8px', paddingTop: '8px', width: '100%',
          animation: 'gotItEntrance 0.22s ease forwards',
        }}>
          <button
            onClick={e => { e.stopPropagation(); onGotIt() }}
            style={{
              flex: 1, padding: '8px 0', borderRadius: '9px',
              fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              background: 'rgba(61,107,79,0.1)', color: arcColor,
              border: '1px solid rgba(61,107,79,0.18)',
              transition: 'all 0.15s',
              fontFamily: "'Jost', sans-serif",
            }}
          >
            <SmallCheck /> Got it
          </button>
          <button
            onClick={e => { e.stopPropagation(); onAlreadyHave() }}
            style={{
              flex: 1, padding: '8px 0', borderRadius: '9px',
              fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              background: 'rgba(196,154,60,0.08)', color: '#C49A3C',
              border: '1px solid rgba(196,154,60,0.2)',
              transition: 'all 0.15s',
              fontFamily: "'Jost', sans-serif",
            }}
          >
            <HomeIcon size={12} /> Already have
          </button>
        </div>
      )}
    </div>
  )
}

// ── Got It item (checked, dimmed) ─────────────────────────────────────────────
function GotItItem({ item, isLast, onUndo }) {
  const { color: arcColor } = useArc()
  const qtyStr = [item.quantity, item.unit].filter(Boolean).join(' ')
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 14px',
      borderBottom: isLast ? 'none' : '1px solid rgba(200,185,160,0.2)',
      minHeight: '48px',
      animation: 'gotItEntrance 0.22s ease both',
    }}>
      {/* Checked checkbox */}
      <div
        onClick={onUndo}
        title="Undo"
        style={{
          width: '26px', height: '26px', borderRadius: '8px',
          background: arcColor, border: 'none', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <SmallCheck color="white" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 400, color: '#8C7B6B', textDecoration: 'line-through' }}>
          {item.name}
        </div>
      </div>

      {(qtyStr || item.estimated_price) && (
        <div style={{ fontSize: '11px', color: '#6B5B4E', fontWeight: 300, textAlign: 'right' }}>
          {qtyStr && <div>{qtyStr}</div>}
          {item.estimated_price && <div>{formatPrice(item.estimated_price)}</div>}
        </div>
      )}
    </div>
  )
}

// ── Small icon components ──────────────────────────────────────────────────────
function SmallCheck({ color }) {
  const { color: arcColor } = useArc()
  const fill = color || arcColor
  return (
    <svg viewBox="0 0 14 11" fill="none" stroke={fill} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 10 }}>
      <path d="M1 5.5L5 9.5L13 1.5" />
    </svg>
  )
}

function HomeIcon({ size = 12 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  )
}

function CartIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  )
}

function CheckIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function CameraIcon({ size = 18 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
