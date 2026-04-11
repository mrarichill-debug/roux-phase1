/**
 * Meals.jsx — Meals history sub-tab.
 * Shows unique meal names from planned_meals with week count.
 * Tab strip at top: [ Recipes ] [ Meals ] — Meals is active here.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import TopBar from '../components/TopBar'
import BottomSheet from '../components/BottomSheet'
import BottomNav from '../components/BottomNav'
import { useArc } from '../context/ArcContext'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0',
}

const MEAL_TYPE_LABELS = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner',
  snack: 'Snack', other: 'Other',
}

export default function Meals({ appUser }) {
  const navigate = useNavigate()
  const { color: arcColor } = useArc()
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMeal, setSelectedMeal] = useState(null) // { name, meal_type }

  useEffect(() => {
    if (!appUser?.household_id) return
    async function load() {
      const { data } = await supabase
        .from('planned_meals')
        .select('custom_name, meal_type, meal_plan_id, planned_date')
        .eq('household_id', appUser.household_id)
        .not('custom_name', 'is', null)
        .is('removed_at', null)
        .not('meal_type', 'in', '("eating_out","leftovers")')
        .neq('entry_type', 'eating_out')
      if (data) {
        const grouped = {}
        for (const m of data) {
          const name = String(m.custom_name).trim()
          if (!name) continue
          const lk = name.toLowerCase()
          if (!grouped[lk]) grouped[lk] = { name, meal_type: m.meal_type || 'dinner', plans: new Set(), dates: new Set(), lastDate: null }
          if (m.meal_plan_id) grouped[lk].plans.add(m.meal_plan_id)
          if (m.planned_date) grouped[lk].dates.add(m.planned_date)
          if (m.planned_date && (!grouped[lk].lastDate || m.planned_date > grouped[lk].lastDate)) {
            grouped[lk].lastDate = m.planned_date
            grouped[lk].meal_type = m.meal_type || grouped[lk].meal_type
          }
        }
        const sorted = Object.values(grouped)
          .map(g => ({ name: g.name, meal_type: g.meal_type, weekCount: g.plans.size || g.dates.size, lastDate: g.lastDate }))
          .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
        setMeals(sorted)
      }
      setLoading(false)
    }
    load()
  }, [appUser?.household_id])

  function formatLastDate(dateStr) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function addToWeek(meal) {
    setSelectedMeal(null)
    logActivity({ user: appUser, actionType: 'meal_reuse_from_history', targetType: 'meal', targetName: meal.name })
    navigate('/plan', { state: { prefillMeal: meal.name, prefillType: meal.meal_type } })
  }

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
            {[1,2,3,4,5].map(i => <div key={i} className="shimmer-block" style={{ height: '72px', borderRadius: '14px', marginBottom: '10px' }} />)}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {meals.map((m, i) => (
              <button key={i} onClick={() => setSelectedMeal(m)} style={{
                background: 'white', borderRadius: '14px', padding: '14px 16px',
                border: `1px solid ${C.linen}`, cursor: 'pointer',
                textAlign: 'left', width: '100%',
                opacity: 0, animation: `fadeUp 0.4s ease ${0.03 * i}s forwards`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Playfair Display', serif", fontSize: '16px',
                      fontWeight: 500, color: C.ink, marginBottom: '6px',
                    }}>
                      {m.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {MEAL_TYPE_LABELS[m.meal_type] && (
                        <span style={{
                          fontSize: '10px', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: '4px',
                          background: `${arcColor}12`, color: arcColor,
                          fontFamily: "'Jost', sans-serif",
                        }}>{MEAL_TYPE_LABELS[m.meal_type]}</span>
                      )}
                      <span style={{ fontSize: '12px', color: C.driftwood, fontWeight: 300 }}>
                        {m.weekCount} week{m.weekCount !== 1 ? 's' : ''}
                      </span>
                      {m.lastDate && (
                        <span style={{ fontSize: '12px', color: C.driftwood, fontWeight: 300 }}>
                          · Last {formatLastDate(m.lastDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tap-to-add bottom sheet */}
      <BottomSheet isOpen={!!selectedMeal} onClose={() => setSelectedMeal(null)}>
        <div style={{ padding: '20px 22px 24px' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '16px' }}>
            {selectedMeal?.name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => addToWeek(selectedMeal)} style={{
              width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
              background: arcColor, color: 'white', cursor: 'pointer',
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
              boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
            }}>Add to this week</button>
            <button onClick={() => setSelectedMeal(null)} style={{
              width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
              background: 'none', color: C.driftwood, cursor: 'pointer',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 300,
            }}>Close</button>
          </div>
        </div>
      </BottomSheet>

      <BottomNav activeTab="meals" />
    </div>
  )
}
