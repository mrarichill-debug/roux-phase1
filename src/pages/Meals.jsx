/**
 * Meals.jsx — Meals history sub-tab.
 * Shows all unique meal names from planned_meals with plan count.
 * Tab strip at top: [ Recipes ] [ Meals ] — Meals is active here.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { useArc } from '../context/ArcContext'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0',
}

export default function Meals({ appUser }) {
  const navigate = useNavigate()
  const { color: arcColor } = useArc()
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!appUser?.household_id) return
    async function load() {
      const { data } = await supabase
        .from('planned_meals')
        .select('custom_name')
        .eq('household_id', appUser.household_id)
        .not('custom_name', 'is', null)
        .is('removed_at', null)
      if (data) {
        const counts = {}
        for (const m of data) {
          const key = String(m.custom_name).trim()
          if (!key) continue
          const lk = key.toLowerCase()
          if (!counts[lk]) counts[lk] = { name: key, count: 0 }
          counts[lk].count++
        }
        const sorted = Object.values(counts).sort((a, b) => b.count - a.count)
        setMeals(sorted)
      }
      setLoading(false)
    }
    load()
  }, [appUser?.household_id])

  return (
    <div style={{
      background: C.cream, minHeight: '100vh', maxWidth: '430px',
      margin: '0 auto', fontFamily: "'Jost', sans-serif",
      paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 8px))',
    }}>
      <TopBar />

      {/* Sub-tab strip */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px 22px 8px' }}>
        <button onClick={() => navigate('/meals/recipes')} style={{
          padding: '7px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: 400,
          border: `1px solid ${C.linen}`, background: 'white', color: C.ink,
          cursor: 'pointer', fontFamily: "'Jost', sans-serif",
        }}>Recipes</button>
        <button style={{
          padding: '7px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: 500,
          border: 'none', background: arcColor, color: 'white',
          cursor: 'default', fontFamily: "'Jost', sans-serif",
        }}>Meals</button>
      </div>

      <div style={{ padding: '8px 22px 0' }}>
        {loading ? (
          <div>
            {[1,2,3,4,5].map(i => <div key={i} className="shimmer-block" style={{ height: '40px', borderRadius: '10px', marginBottom: '8px' }} />)}
          </div>
        ) : meals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '16px', color: C.driftwood, lineHeight: 1.7 }}>
              No meals planned yet.
            </div>
            <div style={{ fontSize: '13px', color: C.driftwood, marginTop: '4px' }}>
              Meals you add to your weekly plan will show up here.
            </div>
          </div>
        ) : (
          <div>
            {meals.map((m, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 0',
                borderBottom: `1px solid rgba(200,185,160,0.25)`,
              }}>
                <span style={{ fontSize: '15px', fontWeight: 400, color: C.ink }}>{m.name}</span>
                <span style={{ fontSize: '12px', color: C.driftwood, fontWeight: 300 }}>
                  {m.count} time{m.count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav activeTab="meals" />
    </div>
  )
}
