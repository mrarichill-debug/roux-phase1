/**
 * PantryTrip.jsx — In-store shopping trip screen.
 * Large tap targets, store shown prominently, grouped by grocery category.
 * Focused, distraction-free. No add item, no navigation complexity.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
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

export default function PantryTrip({ appUser }) {
  const { id: tripId } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [storeName, setStoreName] = useState('')
  const [tripItems, setTripItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (tripId) loadTrip()
  }, [tripId])

  async function loadTrip() {
    setLoading(true)
    try {
      const { data: tripData } = await supabase
        .from('shopping_trips')
        .select('*, grocery_stores(name)')
        .eq('id', tripId)
        .single()

      if (!tripData) { navigate('/pantry'); return }
      setTrip(tripData)
      setStoreName(tripData.grocery_stores?.name || 'Store')

      // Load trip items with their master list item details
      const { data: items } = await supabase
        .from('shopping_trip_items')
        .select('*, shopping_list_items(name, quantity, unit, grocery_category, item_type)')
        .eq('trip_id', tripId)
        .order('created_at')

      setTripItems((items || []).map(ti => ({
        ...ti,
        name: ti.shopping_list_items?.name || '',
        quantity: ti.shopping_list_items?.quantity || '',
        unit: ti.shopping_list_items?.unit || '',
        grocery_category: ti.shopping_list_items?.grocery_category || 'other',
      })))
    } catch (err) {
      console.error('[PantryTrip] Load error:', err)
    }
    setLoading(false)
  }

  const unchecked = tripItems.filter(i => !i.is_purchased)
  const checked = tripItems.filter(i => i.is_purchased)

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat, label: CATEGORY_LABELS[cat],
    items: unchecked.filter(i => i.grocery_category === cat),
  })).filter(g => g.items.length > 0)

  const totalItems = tripItems.length
  const checkedCount = checked.length
  const progress = totalItems > 0 ? checkedCount / totalItems : 0

  async function toggleItem(tripItem) {
    const wasPurchased = tripItem.is_purchased
    const now = new Date().toISOString()

    setTripItems(prev => prev.map(i =>
      i.id === tripItem.id ? { ...i, is_purchased: !wasPurchased, purchased_at: wasPurchased ? null : now } : i
    ))

    // Update trip item
    await supabase.from('shopping_trip_items').update({
      is_purchased: !wasPurchased,
      purchased_at: wasPurchased ? null : now,
      store_id: trip?.store_id || null,
    }).eq('id', tripItem.id)

    // Also update master list item
    if (!wasPurchased && tripItem.shopping_list_item_id) {
      await supabase.from('shopping_list_items').update({
        status: 'purchased', is_purchased: true, purchased_at: now, last_purchased_at: now,
        store_id: trip?.store_id || null,
      }).eq('id', tripItem.shopping_list_item_id)
    }
  }

  async function finishTrip() {
    await supabase.from('shopping_trips').update({
      status: 'completed', completed_at: new Date().toISOString(),
    }).eq('id', tripId)

    logActivity({ user: appUser, actionType: 'shopping_trip_completed', targetType: 'shopping_trip', targetId: tripId, targetName: trip?.name || 'Trip', metadata: { store: storeName, items_purchased: checkedCount } })

    navigate('/pantry')
  }

  if (loading) return (
    <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
      <div style={{ padding: '20px 22px' }}>
        {[60, 40, 40, 40, 40].map((h, i) => <div key={i} className="shimmer-block" style={{ height: `${h}px`, borderRadius: '12px', marginBottom: '10px' }} />)}
      </div>
    </div>
  )

  return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 8px))',
    }}>
      {/* ── Store header ─────────────────────────────────────────── */}
      <div style={{
        background: C.forest, padding: '20px 22px 16px',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <button onClick={() => navigate('/pantry')} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(250,247,242,0.7)', padding: '4px',
            display: 'flex', alignItems: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontSize: '12px', color: 'rgba(250,247,242,0.6)' }}>
            {checkedCount} of {totalItems}
          </span>
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>
          Shopping at {storeName}
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: '12px', height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px' }}>
          <div style={{
            height: '100%', background: 'rgba(250,247,242,0.7)', borderRadius: '2px',
            width: `${progress * 100}%`, transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* ── Items by category ────────────────────────────────────── */}
      <div style={{ padding: '16px 22px' }}>
        {grouped.length === 0 && checked.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: C.ink, marginBottom: '8px' }}>No items on this trip.</div>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.cat} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.sage, marginBottom: '8px' }}>
              {group.label}
            </div>
            {group.items.map(item => (
              <button key={item.id} onClick={() => toggleItem(item)} style={{
                display: 'flex', alignItems: 'center', gap: '14px', width: '100%',
                padding: '14px 0', borderBottom: '1px solid rgba(200,185,160,0.25)',
                background: 'none', border: 'none', borderBottom: '1px solid rgba(200,185,160,0.25)',
                cursor: 'pointer', textAlign: 'left', fontFamily: "'Jost', sans-serif",
                minHeight: '56px',
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px',
                  border: '2px solid rgba(200,185,160,0.7)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white',
                }} />
                <div>
                  <div style={{ fontSize: '16px', color: C.ink, fontWeight: 300 }}>{item.name}</div>
                  {(item.quantity || item.unit) && (
                    <div style={{ fontSize: '13px', color: C.driftwood }}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</div>
                  )}
                </div>
              </button>
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
              <button key={item.id} onClick={() => toggleItem(item)} style={{
                display: 'flex', alignItems: 'center', gap: '14px', width: '100%',
                padding: '10px 0', background: 'none', border: 'none',
                borderBottom: '1px solid rgba(200,185,160,0.15)',
                cursor: 'pointer', textAlign: 'left', fontFamily: "'Jost', sans-serif",
                opacity: 0.45,
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '8px', background: C.sage, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '14px', color: 'white',
                }}>✓</div>
                <div style={{ fontSize: '16px', color: C.ink, textDecoration: 'line-through', fontWeight: 300 }}>{item.name}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Done Shopping button ──────────────────────────────────── */}
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
        }}>
          Done Shopping
        </button>
      </div>

      <BottomNav activeTab="pantry" />
    </div>
  )
}
