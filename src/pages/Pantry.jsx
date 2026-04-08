/**
 * Pantry.jsx — Pantry inventory screen.
 * Shows on_hand items from pantry_inventory grouped by storage_type (cold/dry/frozen).
 * Accessible via "View Pantry →" link on PantryList.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { useArc } from '../context/ArcContext'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0', sage: '#7A8C6E',
}

const SECTION_ORDER = [
  { key: 'cold', label: 'Cold Storage' },
  { key: 'dry', label: 'Dry Goods' },
  { key: 'frozen', label: 'Frozen' },
]

function getDaysAgo(dateStr) {
  if (!dateStr) return ''
  const days = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'bought today'
  if (days === 1) return 'bought yesterday'
  return `bought ${days} days ago`
}

const sentenceCase = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : ''

export default function Pantry({ appUser }) {
  const navigate = useNavigate()
  const { color: arcColor } = useArc()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!appUser?.household_id) return
    async function load() {
      const { data } = await supabase
        .from('pantry_inventory')
        .select('*')
        .eq('household_id', appUser.household_id)
        .eq('status', 'on_hand')
        .order('purchased_date', { ascending: false })
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [appUser?.household_id])

  const grouped = {
    cold: items.filter(i => i.storage_type === 'cold'),
    dry: items.filter(i => i.storage_type === 'dry'),
    frozen: items.filter(i => i.storage_type === 'frozen'),
  }
  const hasItems = items.length > 0

  return (
    <div className="page-scroll-container" style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 8px))',
    }}>
      <TopBar leftAction={{ onClick: () => navigate('/shop'), label: 'Back' }} />

      {loading ? (
        <div style={{ padding: '20px 22px' }}>
          {[1,2,3,4].map(i => <div key={i} className="shimmer-block" style={{ height: '40px', borderRadius: '10px', marginBottom: '8px' }} />)}
        </div>
      ) : !hasItems ? (
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Playfair Display', serif", fontStyle: 'italic',
            fontSize: '16px', color: C.driftwood, lineHeight: 1.7,
          }}>
            Your pantry is empty.
          </div>
          <div style={{ fontSize: '13px', color: C.driftwood, marginTop: '8px' }}>
            Items you check off while shopping will appear here.
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 22px' }}>
          {SECTION_ORDER.map(({ key, label }) => {
            const sectionItems = grouped[key]
            if (!sectionItems?.length) return null
            return (
              <div key={key} style={{ marginBottom: '20px' }}>
                <div style={{
                  fontSize: '11px', fontWeight: 600, letterSpacing: '1.5px',
                  textTransform: 'uppercase', color: arcColor,
                  marginBottom: '6px', marginTop: '16px',
                  borderLeft: `3px solid ${arcColor}`, paddingLeft: '10px',
                }}>
                  {label}
                </div>
                {sectionItems.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '10px 0', borderBottom: `0.5px solid ${C.linen}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', color: C.ink }}>{sentenceCase(item.name)}</div>
                      {(item.meal_plan_context || item.purchased_date) && (
                      <div style={{ fontSize: '11px', color: C.driftwood, marginTop: '2px' }}>
                        {item.meal_plan_context && `${item.meal_plan_context} · `}
                        {getDaysAgo(item.purchased_date)}
                      </div>
                      )}
                    </div>
                    {(item.quantity || item.unit) && (
                      <div style={{ fontSize: '13px', color: C.driftwood, textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                        {[item.quantity, item.unit].filter(Boolean).join(' ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      <BottomNav activeTab="shop" />
    </div>
  )
}
