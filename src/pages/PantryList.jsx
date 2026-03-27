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

  // Show tutorial on first visit with items
  useEffect(() => {
    if (!loading && !appUser?.has_seen_shopping_tutorial && items.length > 0) {
      setShowTutorial(true)
    }
  }, [loading, items.length])

  async function dismissTutorial() {
    setShowTutorial(false)
    supabase.from('users').update({ has_seen_shopping_tutorial: true }).eq('id', appUser.id)
  }

  const activeItems = items.filter(i => i.status === 'active')
  const purchasedItems = items.filter(i => i.status === 'purchased')

  const grouped = CATEGORY_ORDER.map(cat => ({
    cat,
    label: CATEGORY_LABELS[cat],
    items: activeItems.filter(i => (i.grocery_category || 'other') === cat),
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
      <TopBar slim leftAction={{ onClick: () => navigate('/pantry'), label: 'Back' }}
        centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Family List</span>} />
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
      <TopBar slim
        leftAction={{ onClick: () => navigate('/pantry'), icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg> }}
        centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Family List</span>}
      />

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
            <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.sage, marginBottom: '6px' }}>
              {group.label}
            </div>
            {group.items.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 0', borderBottom: '1px solid rgba(200,185,160,0.25)', cursor: 'pointer',
              }} onClick={() => togglePurchased(item)}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '6px',
                  border: '1.5px solid rgba(200,185,160,0.7)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white',
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', color: C.ink }}>{item.name}</div>
                  {(item.quantity || item.unit) && (
                    <div style={{ fontSize: '11px', color: C.driftwood }}>{[item.quantity, item.unit].filter(Boolean).join(' ')}</div>
                  )}
                  {item.source_meal_name && (
                    <div style={{ fontSize: '10px', color: C.driftwood, fontStyle: 'italic' }}>For {item.source_meal_name}</div>
                  )}
                </div>
                {item.item_type && item.item_type !== 'manual' && (
                  <span style={{ fontSize: '9px', color: C.driftwood, background: 'rgba(200,185,160,0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                    {TYPE_LABELS[item.item_type] || item.item_type}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}

        {purchasedItems.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '6px' }}>Purchased</div>
            {purchasedItems.map(item => (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '8px 0', borderBottom: '1px solid rgba(200,185,160,0.15)', cursor: 'pointer', opacity: 0.5,
              }} onClick={() => togglePurchased(item)}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '6px', background: C.sage, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'white',
                }}>✓</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', color: C.ink, textDecoration: 'line-through' }}>{item.name}</div>
                  {item.last_purchased_at && (
                    <div style={{ fontSize: '10px', color: C.driftwood }}>
                      {new Date(item.last_purchased_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
            padding: '6px 8px', borderRadius: '8px', border: `1px solid ${C.linen}`,
            background: 'white', cursor: 'pointer', fontSize: '9px', color: C.driftwood,
            fontFamily: "'Jost', sans-serif", flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>{CATEGORY_LABELS[addCategory]?.slice(0, 4) || 'Cat'}</button>
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

      <BottomNav activeTab="pantry" />
    </div>
  )
}
