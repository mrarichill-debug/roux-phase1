/**
 * ShoppingList.jsx — Shopping List screen, Phase 2.
 * Standalone page: own topbar + bottom nav (no Shell wrapper).
 * Three states: Building → Shopping → Complete.
 * Matches prototypes/roux-shopping-style1.html exactly.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import WatermarkLayer from '../components/WatermarkLayer'
import { getWeekStartTZ } from '../lib/dateUtils'

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  forest:    '#3D6B4F',
  forestDk:  '#2E5038',
  sage:      '#7A8C6E',
  honey:     '#C49A3C',
  cream:     '#FAF7F2',
  ink:       '#2C2417',
  driftwood: '#8C7B6B',
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
  "Check your pantry for olive oil — it's used in 3 recipes this week.",
  "You might want to grab an extra dozen eggs. Baking days are coming.",
  "Costco run? Chicken thighs are cheaper there this time of year.",
]

// ── Main component ─────────────────────────────────────────────────────────────
export default function ShoppingList({ appUser }) {
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
  const [startBtnPressed,  setStartBtnPressed]  = useState(false)
  const [inCartPulsing,    setInCartPulsing]    = useState(false)
  const [completeVisible,  setCompleteVisible]  = useState(false)
  const [receiptSheetOpen, setReceiptSheetOpen] = useState(false)
  const [receiptOverlay,   setReceiptOverlay]   = useState(false)

  const inCartRef = useRef(null)

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (appUser) loadShoppingList()
  }, [appUser])

  async function loadShoppingList() {
    setLoading(true)
    const tz = appUser?.timezone ?? 'America/Chicago'
    const ws = getWeekStartTZ(tz)
    setWeekStart(ws)

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
    setTimeout(() => setReceiptOverlay(true), 40)
  }
  function closeReceiptSheet() {
    setReceiptOverlay(false)
    setTimeout(() => setReceiptSheetOpen(false), 320)
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
        <Topbar shoppingState="building" estimatedTotal={null} inCartTotal={0} activeStoreFilter="all" onStoreFilter={() => {}} onStartShopping={() => {}} onDoneShopping={() => {}} startBtnPressed={false} loading />
        <div style={{ padding: '20px 24px' }}>
          <div className="shimmer-block" style={{ height: '72px', borderRadius: '12px', marginBottom: '12px' }} />
          <div className="shimmer-block" style={{ height: '44px', borderRadius: '10px', marginBottom: '20px' }} />
          <div className="shimmer-block" style={{ height: '160px', borderRadius: '14px', marginBottom: '12px' }} />
          <div className="shimmer-block" style={{ height: '120px', borderRadius: '14px', marginBottom: '12px' }} />
          <div className="shimmer-block" style={{ height: '100px', borderRadius: '14px' }} />
        </div>
        <BottomNav navigate={navigate} />
      </div>
    )
  }

  // ── No list state ────────────────────────────────────────────────────────────
  if (noList) {
    return (
      <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif", paddingBottom: '96px' }}>
        <WatermarkLayer />
        <Topbar shoppingState="building" estimatedTotal={null} inCartTotal={0} activeStoreFilter="all" onStoreFilter={() => {}} onStartShopping={() => {}} onDoneShopping={() => {}} startBtnPressed={false} />
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
              background: C.forest, color: 'white', border: 'none',
              borderRadius: '12px', padding: '14px 28px',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
              cursor: 'pointer', boxShadow: '0 3px 10px rgba(30,55,35,0.22)',
            }}
          >
            Go to This Week
          </button>
        </div>
        <BottomNav navigate={navigate} />
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
      paddingBottom: '96px', position: 'relative', overflowX: 'hidden',
    }}>

      <WatermarkLayer />

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <Topbar
        shoppingState={shoppingState}
        estimatedTotal={estimatedTotal}
        inCartTotal={inCartTotal}
        weekStart={weekStart}
        activeStoreFilter={activeStoreFilter}
        onStoreFilter={setActiveStoreFilter}
        onStartShopping={startShopping}
        onDoneShopping={doneShopping}
        startBtnPressed={startBtnPressed}
      />

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
            All done, {appUser?.first_name || 'Lauren'}.
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
                background: C.forest, color: 'white',
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
            <div style={{ fontSize: '11px', color: C.driftwood, marginTop: '10px', lineHeight: 1.5, opacity: 0.75 }}>
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
                textTransform: 'uppercase', color: C.driftwood,
                display: 'flex', alignItems: 'center', gap: '7px',
              }}>
                <span>{emoji}</span>
                {label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: C.driftwood, fontWeight: 300, opacity: 0.7 }}>
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
              <span style={{ fontSize: '10px', color: C.driftwood, fontWeight: 300 }}>
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
      <BottomNav navigate={navigate} />

      {/* ── Receipt capture overlay ──────────────────────────────────────────── */}
      {receiptSheetOpen && (
        <>
          <div
            onClick={closeReceiptSheet}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(30,20,10,0.55)',
              zIndex: 200,
              opacity: receiptOverlay ? 1 : 0,
              transition: 'opacity 0.25s ease',
              backdropFilter: 'blur(2px)',
            }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%',
            transform: receiptSheetOpen ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
            width: '100%', maxWidth: '430px',
            background: C.cream, borderRadius: '24px 24px 0 0',
            maxHeight: '92vh', overflowY: 'auto',
            zIndex: 201,
            animation: 'sheetRise 0.32s cubic-bezier(0.32,0.72,0,1) both',
          }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(140,123,107,0.28)', margin: '14px auto 0' }} />
            <div style={{
              padding: '20px 24px 16px', borderBottom: `1px solid ${C.linen}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink }}>
                Add your receipt
              </div>
              <button
                onClick={closeReceiptSheet}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  border: 'none', background: 'rgba(140,123,107,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: C.driftwood,
                }}
              >
                <CloseIcon />
              </button>
            </div>
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
          </div>
        </>
      )}

    </div>
  )
}

// ── Topbar component ───────────────────────────────────────────────────────────
function Topbar({
  shoppingState, estimatedTotal, inCartTotal, weekStart,
  activeStoreFilter, onStoreFilter,
  onStartShopping, onDoneShopping,
  startBtnPressed, loading,
}) {
  const pillStyle = shoppingState === 'complete'
    ? { background: 'rgba(122,140,110,0.12)', color: '#7A8C6E', border: '1px solid rgba(122,140,110,0.28)' }
    : shoppingState === 'shopping'
    ? { background: 'rgba(61,107,79,0.12)', color: '#3D6B4F', border: '1px solid rgba(61,107,79,0.28)' }
    : { background: 'rgba(196,154,60,0.12)', color: '#C49A3C', border: '1px solid rgba(196,154,60,0.3)' }

  const pillLabel = shoppingState === 'complete' ? 'Complete'
    : shoppingState === 'shopping' ? 'Shopping'
    : 'Building'

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: '#3D6B4F',
      boxShadow: '0 2px 0px rgba(20,40,25,0.55), 0 4px 8px rgba(20,40,25,0.40), 0 8px 24px rgba(30,55,35,0.28), 0 16px 40px rgba(30,55,35,0.14), 0 1px 0px rgba(255,255,255,0.06) inset',
    }}>
      {/* Row 1: logo / status pill / estimated total */}
      <div style={{
        height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        <div style={{
          fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 600,
          color: 'rgba(250,247,242,0.95)', userSelect: 'none',
        }}>
          R<em style={{ fontStyle: 'italic', color: 'rgba(188,218,178,0.82)' }}>oux</em>
        </div>

        {/* Status pill */}
        <div style={{
          ...pillStyle,
          fontSize: '10px', fontWeight: 500, letterSpacing: '1px',
          textTransform: 'uppercase', padding: '5px 11px', borderRadius: '20px',
          transition: 'all 0.3s',
        }}>
          {pillLabel}
        </div>

        {/* Estimated total */}
        <div style={{
          fontSize: '13px', color: 'rgba(210,230,200,0.75)', fontWeight: 300,
          textAlign: 'right', minWidth: '48px',
        }}>
          {!loading && estimatedTotal ? `$${estimatedTotal.toFixed(0)} est` : ''}
        </div>
      </div>

      {/* Row 2: store filter pills (Building state only) */}
      {shoppingState === 'building' && (
        <div style={{
          display: 'flex', gap: '8px', padding: '0 20px 10px',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}
          className="no-scrollbar"
        >
          {[
            { id: 'all', label: 'All Stores' },
            { id: 'kroger', label: 'Kroger' },
            { id: 'costco', label: 'Costco' },
          ].map(store => (
            <button
              key={store.id}
              onClick={() => onStoreFilter(store.id)}
              style={{
                fontSize: '11px', fontWeight: 500, padding: '6px 14px',
                borderRadius: '20px', whiteSpace: 'nowrap', cursor: 'pointer',
                flexShrink: 0,
                background: activeStoreFilter === store.id ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.10)',
                border: activeStoreFilter === store.id ? '1.5px solid rgba(255,255,255,0.35)' : '1.5px solid rgba(255,255,255,0.15)',
                color: activeStoreFilter === store.id ? 'white' : 'rgba(210,230,200,0.7)',
                transition: 'all 0.15s',
              }}
            >
              {store.label}
            </button>
          ))}
        </div>
      )}

      {/* Row 3: Start/Done Shopping CTA (Building or Shopping state) */}
      {shoppingState !== 'complete' && (
        <div style={{ padding: '0 20px 14px' }}>
          {shoppingState === 'building' ? (
            <button
              onClick={onStartShopping}
              style={{
                width: '100%', padding: '13px 20px', borderRadius: '11px',
                background: startBtnPressed ? '#2E5038' : 'rgba(255,255,255,0.18)',
                color: 'white',
                fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                border: '1.5px solid rgba(255,255,255,0.25)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                transition: 'background 0.15s',
                transform: startBtnPressed ? 'scale(0.97)' : 'scale(1)',
                letterSpacing: '0.3px',
              }}
            >
              <CartIcon size={17} />
              Start Shopping
            </button>
          ) : (
            <button
              onClick={onDoneShopping}
              style={{
                width: '100%', padding: '13px 20px', borderRadius: '11px',
                background: 'rgba(255,255,255,0.18)', color: 'white',
                fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                border: '1.5px solid rgba(255,255,255,0.25)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
                transition: 'background 0.15s',
                letterSpacing: '0.3px',
              }}
            >
              <CheckIcon size={17} />
              Done Shopping
            </button>
          )}
        </div>
      )}
    </header>
  )
}

// ── Budget column ──────────────────────────────────────────────────────────────
function BudgetCol({ label, value, muted, color, pulsing }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.8px', textTransform: 'uppercase', color: '#8C7B6B', marginBottom: '3px' }}>
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
            <div style={{ fontSize: '11px', color: '#8C7B6B', fontWeight: 300 }}>
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
              background: 'rgba(61,107,79,0.1)', color: '#3D6B4F',
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
          background: '#3D6B4F', border: 'none', flexShrink: 0,
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
        <div style={{ fontSize: '11px', color: '#8C7B6B', fontWeight: 300, textAlign: 'right' }}>
          {qtyStr && <div>{qtyStr}</div>}
          {item.estimated_price && <div>{formatPrice(item.estimated_price)}</div>}
        </div>
      )}
    </div>
  )
}

// ── Bottom nav ─────────────────────────────────────────────────────────────────
function BottomNav({ navigate }) {
  const tabs = [
    {
      label: 'Home', path: '/',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>,
    },
    {
      label: 'Recipes', path: '/recipes',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></svg>,
    },
    {
      label: 'This Week', path: '/thisweek',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    },
    {
      label: 'Shopping', path: '/shopping', active: true,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>,
    },
  ]

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '430px', height: '80px',
      background: '#FAF7F2', borderTop: '1px solid #E8E0D0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '0 8px 12px', zIndex: 100,
      boxShadow: '0 -2px 12px rgba(80,60,30,0.08)',
    }}>
      {tabs.map(tab => (
        <button
          key={tab.path}
          onClick={() => navigate(tab.path)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '4px', flex: 1, cursor: 'pointer', padding: '8px 4px',
            background: 'none', border: 'none',
            color: tab.active ? '#3D6B4F' : '#8C7B6B',
            position: 'relative',
          }}
        >
          {tab.icon}
          <span style={{
            fontSize: '10px', fontWeight: tab.active ? 600 : 400,
            letterSpacing: '0.3px',
            color: tab.active ? '#3D6B4F' : '#8C7B6B',
          }}>
            {tab.label}
          </span>
          {tab.active && (
            <div style={{
              position: 'absolute', bottom: '2px',
              width: '4px', height: '4px', borderRadius: '50%',
              background: '#3D6B4F',
            }} />
          )}
        </button>
      ))}
    </nav>
  )
}

// ── Small icon components ──────────────────────────────────────────────────────
function SmallCheck({ color = '#3D6B4F' }) {
  return (
    <svg viewBox="0 0 14 11" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 10 }}>
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
