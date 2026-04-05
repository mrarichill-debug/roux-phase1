/**
 * Pantry.jsx — Pantry hub screen. Action center layout like Meals.
 * Three action tiles + Sage-managed sections below.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'
import { useArc } from '../context/ArcContext'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E', linen: '#E8E0D0',
  sage: '#7A8C6E', honey: '#C49A3C',
}

const sectionHeader = {
  fontSize: '10px', fontWeight: 500, letterSpacing: '2px',
  textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '10px',
}

export default function Pantry({ appUser }) {
  const { color: arcColor } = useArc()
  const navigate = useNavigate()
  const [freezerItems, setFreezerItems] = useState([])
  const [pendingItems, setPendingItems] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  // Trip creation sheet
  const [tripSheetOpen, setTripSheetOpen] = useState(false)
  const [tripStore, setTripStore] = useState(null)
  const [tripName, setTripName] = useState('')
  const [creatingTrip, setCreatingTrip] = useState(false)

  useEffect(() => {
    if (appUser?.household_id) loadPantryHub()
  }, [appUser?.household_id])

  async function loadPantryHub() {
    if (!appUser?.household_id) return
    setLoading(true)
    try {
      // Get stores
      const { data: storesData } = await supabase.from('grocery_stores')
        .select('id, name, is_primary').eq('household_id', appUser.household_id).order('name')
      setStores(storesData || [])
      const primaryStore = (storesData || []).find(s => s.is_primary)

      // Get master list
      const { data: lists } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('household_id', appUser.household_id)
        .eq('list_type', 'master')
        .limit(1)
        .maybeSingle()

      if (lists?.id) {
        const [freezerRes, pendingRes] = await Promise.all([
          supabase.from('shopping_list_items')
            .select('id, name, quantity, unit, last_purchased_at')
            .eq('shopping_list_id', lists.id)
            .eq('item_type', 'sale')
            .eq('status', 'purchased')
            .order('last_purchased_at', { ascending: false })
            .limit(10),
          supabase.from('shopping_list_items')
            .select('id, name, quantity, unit, suggested_by_user_id')
            .eq('shopping_list_id', lists.id)
            .eq('approval_status', 'pending')
            .order('created_at', { ascending: false }),
        ])
        setFreezerItems(freezerRes.data || [])
        setPendingItems(pendingRes.data || [])
      }
    } catch (err) {
      console.error('[Pantry] Load error:', err)
    }
    setLoading(false)
  }

  async function approvePending(itemId) {
    await supabase.from('shopping_list_items').update({ approval_status: 'approved' }).eq('id', itemId)
    setPendingItems(prev => prev.filter(i => i.id !== itemId))
  }

  async function removePending(itemId) {
    await supabase.from('shopping_list_items').delete().eq('id', itemId)
    setPendingItems(prev => prev.filter(i => i.id !== itemId))
  }

  function openTripSheet() {
    const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    const primaryStore = stores.find(s => s.is_primary)
    setTripStore(primaryStore?.id || null)
    setTripName(`${dayName} ${primaryStore?.name || ''} run`.trim())
    setTripSheetOpen(true)
  }

  async function createTrip() {
    if (creatingTrip || !appUser?.household_id) return
    setCreatingTrip(true)
    try {
      // Get master list
      const { data: list } = await supabase.from('shopping_lists').select('id')
        .eq('household_id', appUser.household_id).eq('list_type', 'master').neq('status', 'completed').limit(1).maybeSingle()
      if (!list) { setCreatingTrip(false); return }

      // Create trip
      const { data: trip, error: tripErr } = await supabase.from('shopping_trips').insert({
        household_id: appUser.household_id, shopping_list_id: list.id,
        name: tripName.trim() || 'Shopping trip', store_id: tripStore || null,
        status: 'planned', created_by_user_id: appUser.id,
      }).select('id').single()
      if (tripErr) throw tripErr

      // Pull active items from master list into trip
      const { data: activeItems } = await supabase.from('shopping_list_items').select('id')
        .eq('shopping_list_id', list.id).eq('status', 'active').eq('approval_status', 'approved')
      if (activeItems?.length) {
        await supabase.from('shopping_trip_items').insert(
          activeItems.map(item => ({ trip_id: trip.id, shopping_list_item_id: item.id }))
        )
      }

      // Start the trip
      await supabase.from('shopping_trips').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', trip.id)

      logActivity({ user: appUser, actionType: 'shopping_trip_started', targetType: 'shopping_trip', targetId: trip.id, targetName: tripName.trim(), metadata: { store_id: tripStore } })

      setTripSheetOpen(false)
      navigate(`/pantry/trip/${trip.id}`)
    } catch (err) {
      console.error('[Pantry] Create trip error:', err)
    }
    setCreatingTrip(false)
  }

  function daysAgo(dateStr) {
    if (!dateStr) return null
    const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
    return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
  }

  return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 8px))',
    }}>
      <TopBar centerContent={
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>
          Pantry
        </span>
      } />

      <div style={{ padding: '20px 22px' }}>
        {/* ── Action Tiles ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {/* Family List — primary */}
          <button onClick={() => navigate('/pantry/list')} style={{
            padding: '20px', borderRadius: '14px', border: 'none', cursor: 'pointer',
            background: arcColor, color: 'white', textAlign: 'left',
            boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
            fontFamily: "'Jost', sans-serif", width: '100%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
                  <line x1="9" x2="21" y1="6" y2="6"/><line x1="9" x2="21" y1="12" y2="12"/><line x1="9" x2="21" y1="18" y2="18"/>
                  <circle cx="4" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.3" fill="currentColor" stroke="none"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '17px', fontWeight: 500, marginBottom: '2px' }}>Family List</div>
                <div style={{ fontSize: '12px', opacity: 0.8, fontWeight: 300 }}>Your running household list</div>
              </div>
            </div>
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Start a Trip */}
            <button onClick={openTripSheet} style={{
              padding: '16px', borderRadius: '14px', cursor: 'pointer',
              background: '#F0EBE3', color: C.ink, textAlign: 'left',
              border: 'none', fontFamily: "'Jost', sans-serif",
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={arcColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, marginBottom: '8px' }}>
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 500, marginBottom: '2px' }}>Start a Trip</div>
              <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300 }}>Head to the store</div>
            </button>

            {/* Meal Prep */}
            <button onClick={() => {}} style={{
              padding: '16px', borderRadius: '14px', cursor: 'pointer',
              background: '#F0EBE3', color: C.ink, textAlign: 'left',
              border: 'none', fontFamily: "'Jost', sans-serif",
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={C.honey} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, marginBottom: '8px' }}>
                <path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/>
              </svg>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 500, marginBottom: '2px' }}>Meal Prep</div>
              <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300 }}>Plan a batch cook</div>
            </button>
          </div>
        </div>

        {/* ── Tagline ──────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '14px', fontStyle: 'italic', color: C.driftwood, lineHeight: 1.6 }}>
            Between the kitchen and the store and back again.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '8px' }}>
            {['#E4DDD2','#C4B8A8','#E4DDD2'].map((c, i) => (
              <span key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: c }} />
            ))}
          </div>
        </div>

        {/* ── Pending from Family ────────────────────────────────────── */}
        {pendingItems.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={sectionHeader}>Pending from Family</div>
            <div style={{
              background: 'white', border: '1px solid rgba(200,185,160,0.55)',
              borderRadius: '14px', overflow: 'hidden',
            }}>
              {pendingItems.map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderBottom: i < pendingItems.length - 1 ? '1px solid rgba(200,185,160,0.2)' : 'none',
                  borderLeft: `3px solid ${C.honey}`,
                }}>
                  <div>
                    <div style={{ fontSize: '14px', color: C.ink }}>{item.name}</div>
                    {item.quantity && <div style={{ fontSize: '11px', color: C.driftwood }}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => approvePending(item.id)} style={{
                      padding: '5px 10px', borderRadius: '8px', border: 'none',
                      background: arcColor, color: 'white', fontSize: '11px', fontWeight: 500,
                      cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                    }}>Approve</button>
                    <button onClick={() => removePending(item.id)} style={{
                      padding: '5px 10px', borderRadius: '8px', border: `1px solid ${C.linen}`,
                      background: 'none', color: C.driftwood, fontSize: '11px',
                      cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                    }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── In the Freezer ────────────────────────────────────────── */}
        {freezerItems.length > 0 && (
          <div>
            <div style={sectionHeader}>In the Freezer</div>
            <div style={{
              background: 'white', border: '1px solid rgba(200,185,160,0.55)',
              borderRadius: '14px', overflow: 'hidden',
            }}>
              {freezerItems.map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderBottom: i < freezerItems.length - 1 ? '1px solid rgba(200,185,160,0.2)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: '14px', color: C.ink }}>{item.name}</div>
                    {item.quantity && <div style={{ fontSize: '11px', color: C.driftwood }}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</div>}
                  </div>
                  <div style={{ fontSize: '10px', color: C.driftwood }}>{daysAgo(item.last_purchased_at)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Trip creation sheet ──────────────────────────────────── */}
      <BottomSheet isOpen={tripSheetOpen} onClose={() => setTripSheetOpen(false)} title="Start a Trip">
        <div style={{ padding: '4px 22px 24px' }}>
          {/* Trip name */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', color: C.driftwoodSm, fontWeight: 500, marginBottom: '6px' }}>Trip name</div>
            <input type="text" value={tripName} onChange={e => setTripName(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '14px', fontFamily: "'Jost', sans-serif", fontWeight: 300,
                border: `1.5px solid ${C.linen}`, borderRadius: '10px', outline: 'none', color: C.ink, boxSizing: 'border-box',
              }} />
          </div>

          {/* Store picker */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', color: C.driftwoodSm, fontWeight: 500, marginBottom: '6px' }}>Store</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {stores.map(s => (
                <button key={s.id} onClick={() => {
                  setTripStore(s.id)
                  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
                  setTripName(`${dayName} ${s.name} run`)
                }} style={{
                  padding: '6px 14px', borderRadius: '10px', fontSize: '13px',
                  border: tripStore === s.id ? `1.5px solid ${arcColor}` : `1px solid ${C.linen}`,
                  background: tripStore === s.id ? 'rgba(61,107,79,0.08)' : 'white',
                  color: tripStore === s.id ? arcColor : C.ink,
                  cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: tripStore === s.id ? 500 : 400,
                }}>{s.name}</button>
              ))}
            </div>
          </div>

          {/* Confirm */}
          <button onClick={createTrip} disabled={creatingTrip} style={{
            width: '100%', padding: '15px', borderRadius: '14px', border: 'none',
            background: arcColor, color: 'white', cursor: 'pointer',
            fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
            boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
          }}>
            {creatingTrip ? 'Starting...' : 'Start shopping'}
          </button>
        </div>
      </BottomSheet>

      <BottomNav activeTab="pantry" />
    </div>
  )
}
