/**
 * ShoppingTrip.jsx — In-store shopping trip screen.
 * Items from a specific trip, grouped by category, with checkboxes.
 * Shows inline completion screen after "Done shopping" instead of immediate bounce.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { getIngredientCostEstimate } from '../lib/getIngredientCostEstimate'
import { hasSeenTooltip, dismissTooltip } from '../lib/tooltips'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0', sage: '#7A8C6E', honey: '#C49A3C',
}

const CATEGORY_ORDER = ['produce','meat','seafood','dairy','bakery','pantry','frozen','beverages','household','personal_care','other']
const CATEGORY_LABELS = {
  produce: 'Produce', meat: 'Meat', seafood: 'Seafood', dairy: 'Dairy & Eggs',
  bakery: 'Bread & Bakery', pantry: 'Pantry & Canned', frozen: 'Frozen',
  beverages: 'Beverages', household: 'Household', personal_care: 'Personal Care', other: 'Other',
}
const sentenceCase = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : ''

export default function ShoppingTrip({ appUser }) {
  const { id: tripId } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [tripItems, setTripItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [costEstimates, setCostEstimates] = useState({}) // name → estimate obj
  const [receiptTipDismissed, setReceiptTipDismissed] = useState(() => hasSeenTooltip(appUser, 'receipt_value'))

  useEffect(() => { if (tripId) loadTrip() }, [tripId])

  async function loadTrip() {
    setLoading(true)
    try {
      const { data: tripData } = await supabase.from('shopping_trips')
        .select('id, name, store_name, status, companion_trip_id, is_companion').eq('id', tripId).single()
      if (!tripData) { navigate('/shop'); return }
      setTrip(tripData)

      // Determine all trip IDs to load (primary + companion)
      const tripIds = [tripId]
      if (tripData.companion_trip_id) tripIds.push(tripData.companion_trip_id)

      // Load trip items from all trips — separate queries per LESSONS.md
      const { data: tripItemRows } = await supabase.from('shopping_trip_items')
        .select('id, trip_id, shopping_list_item_id, is_purchased, purchased_at').in('trip_id', tripIds)
      if (!tripItemRows?.length) { setTripItems([]); setLoading(false); return }

      const itemIds = tripItemRows.map(r => r.shopping_list_item_id)
      const { data: listItems } = await supabase.from('shopping_list_items')
        .select('id, name, quantity, unit, grocery_category, source_meal_name').in('id', itemIds)

      const listMap = Object.fromEntries((listItems || []).map(i => [i.id, i]))
      setTripItems(tripItemRows.map(ti => ({
        ...ti,
        ...(listMap[ti.shopping_list_item_id] || {}),
        tripItemId: ti.id,
        _isCompanion: ti.trip_id !== tripId,
      })))
    } catch (err) {
      console.error('[ShoppingTrip] Load error:', err)
    }
    setLoading(false)
  }

  // Load cost estimates in parallel — never blocks trip loading
  useEffect(() => {
    if (!tripItems.length || !trip?.store_name || !appUser?.household_id) return
    const BULK_STORES = ['costco', "sam's club", 'sams club', "bj's", 'bjs wholesale']
    const storeType = BULK_STORES.some(s => trip.store_name.toLowerCase().includes(s)) ? 'bulk' : 'standard'
    const names = [...new Set(tripItems.map(i => i.name).filter(Boolean))]
    Promise.all(names.map(async name => {
      const est = await getIngredientCostEstimate(name, storeType, appUser.household_id)
      return [name.toLowerCase(), est]
    })).then(results => {
      const map = {}
      for (const [key, est] of results) { if (est) map[key] = est }
      setCostEstimates(map)
    })
  }, [tripItems.length, trip?.store_name])

  const unchecked = tripItems.filter(i => !i.is_purchased)
  const checked = tripItems.filter(i => i.is_purchased)
  const total = tripItems.length
  const checkedCount = checked.length
  const progress = total > 0 ? checkedCount / total : 0

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat, label: CATEGORY_LABELS[cat],
    items: unchecked.filter(i => (i.grocery_category || 'other') === cat),
  })).filter(g => g.items.length > 0)

  async function toggleItem(item) {
    const wasPurchased = item.is_purchased
    const now = new Date().toISOString()

    setTripItems(prev => prev.map(i =>
      i.tripItemId === item.tripItemId ? { ...i, is_purchased: !wasPurchased, purchased_at: wasPurchased ? null : now } : i
    ))

    await supabase.from('shopping_trip_items').update({
      is_purchased: !wasPurchased, purchased_at: wasPurchased ? null : now,
    }).eq('id', item.tripItemId)

    if (item.shopping_list_item_id) {
      if (!wasPurchased) {
        // Mark as purchased + pending pantry
        await supabase.from('shopping_list_items').update({
          is_purchased: true, purchased_at: now, last_purchased_at: now, status: 'purchased',
          pantry_status: 'pending',
        }).eq('id', item.shopping_list_item_id)

        // Look up storage_type from ingredients table
        let storageType = 'dry'
        if (item.name) {
          const { data: ing } = await supabase.from('ingredients')
            .select('storage_type').ilike('name', item.name).not('storage_type', 'is', null).limit(1).maybeSingle()
          if (ing?.storage_type) storageType = ing.storage_type
        }

        // Create pantry_inventory row
        const qtyNum = item.quantity ? parseFloat(item.quantity) : null
        await supabase.from('pantry_inventory').insert({
          household_id: appUser.household_id,
          name: item.name,
          quantity: qtyNum && !isNaN(qtyNum) ? qtyNum : null,
          unit: item.unit || null,
          storage_type: storageType,
          status: 'pending',
          source: 'shopping_trip',
          shopping_trip_id: tripId,
          shopping_list_item_id: item.shopping_list_item_id,
          meal_plan_context: item.source_meal_name ? `For ${item.source_meal_name}` : null,
          purchased_date: now.split('T')[0],
        })
      } else {
        // Uncheck — revert pantry status + remove pantry_inventory
        await supabase.from('shopping_list_items').update({
          is_purchased: false, purchased_at: null, status: 'active',
          pantry_status: null,
        }).eq('id', item.shopping_list_item_id)

        await supabase.from('pantry_inventory').delete()
          .eq('shopping_list_item_id', item.shopping_list_item_id)
      }
    }
  }

  async function removeFromTrip(item) {
    // Remove from local state immediately
    setTripItems(prev => prev.filter(i => i.tripItemId !== item.tripItemId))
    // Delete trip item row
    await supabase.from('shopping_trip_items').delete().eq('id', item.tripItemId)
    // Fully reset item so it returns to manifest as active + unassigned
    if (item.shopping_list_item_id) {
      await supabase.from('shopping_list_items').update({
        assigned_trip_id: null, is_purchased: false, purchased_at: null, status: 'active',
        pantry_status: null,
      }).eq('id', item.shopping_list_item_id)
      // Clean up any pantry_inventory row created for this item
      await supabase.from('pantry_inventory').delete()
        .eq('shopping_list_item_id', item.shopping_list_item_id)
    }
    logActivity({ user: appUser, actionType: 'trip_item_removed', targetType: 'shopping_item', targetName: item.name })
  }

  async function finishTrip() {
    const now = new Date().toISOString()

    // Flip checked items from pending → on_hand in pantry
    const checkedItemIds = checked.map(i => i.shopping_list_item_id).filter(Boolean)
    if (checkedItemIds.length > 0) {
      await supabase.from('shopping_list_items')
        .update({ pantry_status: 'on_hand' })
        .in('id', checkedItemIds)
      await supabase.from('pantry_inventory')
        .update({ status: 'on_hand' })
        .in('shopping_list_item_id', checkedItemIds)
    }

    // Unassign unchecked items so they return to manifest
    for (const item of unchecked) {
      if (item.shopping_list_item_id) {
        await supabase.from('shopping_list_items').update({ assigned_trip_id: null, pantry_status: null }).eq('id', item.shopping_list_item_id)
      }
    }
    // Remove pantry_inventory rows for unchecked items
    const uncheckedItemIds = unchecked.map(i => i.shopping_list_item_id).filter(Boolean)
    if (uncheckedItemIds.length > 0) {
      await supabase.from('pantry_inventory').delete().in('shopping_list_item_id', uncheckedItemIds)
    }

    // Complete primary trip
    await supabase.from('shopping_trips').update({ status: 'completed', completed_at: now }).eq('id', tripId)
    // Complete companion trip if present
    if (trip?.companion_trip_id) {
      await supabase.from('shopping_trips').update({ status: 'completed', completed_at: now }).eq('id', trip.companion_trip_id)
    }
    logActivity({ user: appUser, actionType: 'shopping_trip_completed', targetType: 'shopping_trip', targetId: tripId, targetName: trip?.name, metadata: { items_purchased: checkedCount, items_total: total, multi_week: !!trip?.companion_trip_id } })
    setCompleted(true)
  }

  if (loading) return (
    <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
      <div style={{ padding: '20px 22px' }}>
        {[60, 40, 40, 40].map((h, i) => <div key={i} className="shimmer-block" style={{ height: `${h}px`, borderRadius: '12px', marginBottom: '10px' }} />)}
      </div>
    </div>
  )

  // ── Completion screen ──────────────────────────────────
  if (completed) return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 22px',
    }}>
      {/* Forest green checkmark */}
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%', background: C.forest,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(61,107,79,0.3)',
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 36, height: 36 }}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500, color: C.ink, textAlign: 'center', marginBottom: '8px' }}>
        {trip?.name || 'Shopping trip'} — complete.
      </div>
      <div style={{ fontSize: '14px', color: C.driftwood, marginBottom: '40px' }}>
        {checkedCount} item{checkedCount !== 1 ? 's' : ''} picked up
      </div>

      {/* Receipt value education tooltip */}
      {!receiptTipDismissed && (
        <div style={{
          width: '100%', maxWidth: '320px', padding: '14px 16px', marginBottom: '16px',
          background: 'white', borderRadius: '12px', borderLeft: `3px solid ${C.sage}`,
          border: '1px solid rgba(200,185,160,0.4)',
        }}>
          <div style={{ fontSize: '13px', color: C.ink, lineHeight: 1.6, marginBottom: '10px' }}>
            <span style={{ color: C.sage }}>✦</span> <strong>Why scan your receipt?</strong> The more you scan, the smarter Sage gets — she'll learn what things cost at each store, when you're running low on staples, and how much you're spending vs eating out. It only takes a few seconds.
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={async () => {
              const updated = await dismissTooltip(appUser.id, appUser.dismissed_tooltips, 'receipt_value')
              appUser.dismissed_tooltips = updated
              setReceiptTipDismissed(true)
            }} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: '12px', color: C.forest, fontWeight: 500, fontFamily: "'Jost', sans-serif",
            }}>Got it</button>
            <button onClick={() => setReceiptTipDismissed(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: '12px', color: C.driftwood, fontWeight: 300, fontFamily: "'Jost', sans-serif",
            }}>Remind me next time</button>
          </div>
        </div>
      )}

      <button onClick={() => navigate(`/pantry/trip/${tripId}/receipt`)} style={{
        width: '100%', maxWidth: '320px', padding: '16px', borderRadius: '14px', border: 'none',
        background: C.forest, color: 'white', cursor: 'pointer',
        fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
        boxShadow: '0 4px 16px rgba(30,55,35,0.25)', marginBottom: '12px',
      }}>Scan your receipt →</button>

      <button onClick={() => navigate('/shop')} style={{
        width: '100%', maxWidth: '320px', padding: '16px', borderRadius: '14px',
        border: `1.5px solid ${C.linen}`, background: 'white', color: C.ink, cursor: 'pointer',
        fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
      }}>Skip for now</button>
    </div>
  )

  // ── Active shopping screen ─────────────────────────────
  return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 8px))',
    }}>
      {/* Header */}
      <div style={{ background: C.forest, padding: '20px 22px 16px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <button onClick={() => navigate('/shop')} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(250,247,242,0.7)', padding: '4px', display: 'flex', alignItems: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontSize: '12px', color: 'rgba(250,247,242,0.6)' }}>{checkedCount} of {total}</span>
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500, color: 'rgba(250,247,242,0.95)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {trip?.name || trip?.store_name || 'Shopping Trip'}
          {trip?.companion_trip_id && <span style={{ fontSize: '10px', fontFamily: "'Jost', sans-serif", fontWeight: 500, padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.15)', color: 'rgba(250,247,242,0.7)' }}>2 weeks</span>}
        </div>
        <div style={{ marginTop: '12px', height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }}>
          <div style={{ height: '100%', background: 'rgba(250,247,242,0.7)', borderRadius: '2px', width: `${progress * 100}%`, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Items by category */}
      <div style={{ padding: '16px 22px' }}>
        {grouped.map(group => (
          <div key={group.cat} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.forest, marginBottom: '8px', marginTop: '24px', borderLeft: `3px solid ${C.forest}`, paddingLeft: '10px' }}>
              {group.label}
            </div>
            {group.items.map(item => (
              <div key={item.tripItemId} style={{
                display: 'flex', alignItems: 'center', gap: '14px', minHeight: '56px',
                padding: '10px 0', borderBottom: '1px solid rgba(200,185,160,0.25)',
              }}>
                <button onClick={() => toggleItem(item)} style={{
                  width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                  border: '2px solid rgba(200,185,160,0.7)', background: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', color: C.ink, fontWeight: 300 }}>{sentenceCase(item.name)}</div>
                  {(item.quantity || item.unit) && (
                    <div style={{ fontSize: '13px', color: C.driftwood }}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</div>
                  )}
                  {item.source_meal_name && (
                    <div style={{ fontSize: '10px', color: C.driftwood, fontStyle: 'italic' }}>For {item.source_meal_name}</div>
                  )}
                  {trip?.companion_trip_id && (
                    <div style={{ fontSize: '9px', color: C.driftwood, fontStyle: 'italic' }}>{item._isCompanion ? 'Next week' : 'This week'}</div>
                  )}
                  {costEstimates[(item.name || '').toLowerCase()] && (
                    <div style={{ fontSize: '10px', color: C.driftwood, fontStyle: 'italic' }}>
                      {costEstimates[(item.name || '').toLowerCase()].label}
                    </div>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); removeFromTrip(item) }} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
                  fontSize: '10px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontWeight: 300,
                }}>Remove</button>
              </div>
            ))}
          </div>
        ))}

        {/* Checked items */}
        {checked.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '8px' }}>
              Got it ({checked.length})
            </div>
            {checked.map(item => (
              <button key={item.tripItemId} onClick={() => toggleItem(item)} style={{
                display: 'flex', alignItems: 'center', gap: '14px', width: '100%',
                padding: '8px 0', background: 'none', border: 'none',
                borderBottom: '1px solid rgba(200,185,160,0.15)',
                cursor: 'pointer', textAlign: 'left', fontFamily: "'Jost', sans-serif", opacity: 0.45,
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px', background: C.sage, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'white',
                }}>✓</div>
                <div style={{ fontSize: '16px', color: C.ink, textDecoration: 'line-through', fontWeight: 300 }}>{sentenceCase(item.name)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Done shopping button */}
      <div style={{
        position: 'fixed', bottom: 'calc(48px + env(safe-area-inset-bottom, 8px))',
        left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px', padding: '10px 22px',
        background: C.cream, borderTop: `1px solid ${C.linen}`, zIndex: 50, boxSizing: 'border-box',
      }}>
        <button onClick={finishTrip} style={{
          width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
          background: C.forest, color: 'white', cursor: 'pointer',
          fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
          boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
        }}>Done shopping →</button>
      </div>

      <BottomNav activeTab="shop" />
    </div>
  )
}
