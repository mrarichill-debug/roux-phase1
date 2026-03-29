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

  useEffect(() => { if (tripId) loadTrip() }, [tripId])

  async function loadTrip() {
    setLoading(true)
    try {
      const { data: tripData } = await supabase.from('shopping_trips')
        .select('id, name, store_name, status').eq('id', tripId).single()
      if (!tripData) { navigate('/pantry'); return }
      setTrip(tripData)

      // Load trip items — separate queries per LESSONS.md
      const { data: tripItemRows } = await supabase.from('shopping_trip_items')
        .select('id, shopping_list_item_id, is_purchased, purchased_at').eq('trip_id', tripId)
      if (!tripItemRows?.length) { setTripItems([]); setLoading(false); return }

      const itemIds = tripItemRows.map(r => r.shopping_list_item_id)
      const { data: listItems } = await supabase.from('shopping_list_items')
        .select('id, name, quantity, unit, grocery_category, source_meal_name').in('id', itemIds)

      const listMap = Object.fromEntries((listItems || []).map(i => [i.id, i]))
      setTripItems(tripItemRows.map(ti => ({
        ...ti,
        ...(listMap[ti.shopping_list_item_id] || {}),
        tripItemId: ti.id,
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
        await supabase.from('shopping_list_items').update({
          is_purchased: true, purchased_at: now, last_purchased_at: now, status: 'purchased',
        }).eq('id', item.shopping_list_item_id)
      } else {
        await supabase.from('shopping_list_items').update({
          is_purchased: false, purchased_at: null, status: 'active',
        }).eq('id', item.shopping_list_item_id)
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
      }).eq('id', item.shopping_list_item_id)
    }
    logActivity({ user: appUser, actionType: 'trip_item_removed', targetType: 'shopping_item', targetName: item.name })
  }

  async function finishTrip() {
    // Unassign unchecked items so they return to manifest
    for (const item of unchecked) {
      if (item.shopping_list_item_id) {
        await supabase.from('shopping_list_items').update({ assigned_trip_id: null }).eq('id', item.shopping_list_item_id)
      }
    }
    await supabase.from('shopping_trips').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', tripId)
    logActivity({ user: appUser, actionType: 'shopping_trip_completed', targetType: 'shopping_trip', targetId: tripId, targetName: trip?.name, metadata: { items_purchased: checkedCount, items_total: total } })
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

      <button onClick={() => navigate(`/pantry/trip/${tripId}/receipt`)} style={{
        width: '100%', maxWidth: '320px', padding: '16px', borderRadius: '14px', border: 'none',
        background: C.forest, color: 'white', cursor: 'pointer',
        fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
        boxShadow: '0 4px 16px rgba(30,55,35,0.25)', marginBottom: '12px',
      }}>Scan your receipt →</button>

      <button onClick={() => navigate('/pantry')} style={{
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
          <button onClick={() => navigate('/pantry')} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(250,247,242,0.7)', padding: '4px', display: 'flex', alignItems: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontSize: '12px', color: 'rgba(250,247,242,0.6)' }}>{checkedCount} of {total}</span>
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>
          {trip?.name || trip?.store_name || 'Shopping Trip'}
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

      <BottomNav activeTab="pantry" />
    </div>
  )
}
