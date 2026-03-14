/**
 * WeekSettings.jsx — "Set Up This Week" screen.
 * Standalone: slim 58px topbar with back arrow, bottom nav, cream bg.
 * Configures day types, traditions, proteins, templates for the current week.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getWeekDatesTZ, getWeekStartTZ, toLocalDateStr } from '../lib/dateUtils'

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

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DOW_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const DAY_TYPE_OPTIONS = [
  { key: 'school',    label: 'School',    color: '#5B8DD9' },
  { key: 'weekend',   label: 'Weekend',   color: '#7A8C6E' },
  { key: 'no_school', label: 'No School', color: '#D4874A' },
  { key: 'summer',    label: 'Summer',    color: '#C49A3C' },
]

const DEFAULT_DAY_TYPES = {
  monday: 'school', tuesday: 'school', wednesday: 'school',
  thursday: 'school', friday: 'school', saturday: 'weekend', sunday: 'weekend',
}

function formatWeekRange(dates) {
  const opts = { month: 'short', day: 'numeric' }
  return `${dates[0].toLocaleDateString('en-US', opts)} — ${dates[6].toLocaleDateString('en-US', opts)}`
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const cardStyle = {
  background: 'white',
  border: '1px solid rgba(200,185,160,0.55)',
  borderRadius: '16px',
  padding: '18px',
  margin: '0 22px 14px',
}

const sectionHeaderStyle = {
  fontSize: '10px',
  fontWeight: 500,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: C.driftwood,
  marginBottom: '12px',
}

const backBtnStyle = {
  width: '36px', height: '36px', borderRadius: '50%',
  border: 'none', background: 'rgba(255,255,255,0.14)',
  color: 'rgba(250,247,242,0.9)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', flexShrink: 0,
  transition: 'background 0.15s',
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function WeekSettings({ appUser }) {
  const navigate = useNavigate()
  const tz = appUser?.timezone ?? 'America/Chicago'
  const weekDates = getWeekDatesTZ(tz, 0)

  const [plan, setPlan] = useState(null)
  const [weekLabel, setWeekLabel] = useState('')
  const [dayTypes, setDayTypes] = useState({ ...DEFAULT_DAY_TYPES })
  const [traditions, setTraditions] = useState([])
  const [traditionToggles, setTraditionToggles] = useState({})
  const [proteins, setProteins] = useState([])
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (appUser?.household_id) loadData()
  }, [appUser?.household_id])

  async function loadData() {
    setLoading(true)
    try {
      const hid = appUser.household_id
      const weekStart = getWeekStartTZ(tz, 0)

      const [planRes, tradRes, storeRes] = await Promise.all([
        supabase.from('meal_plans')
          .select('id, status, week_start_date, week_end_date, notes')
          .eq('household_id', hid)
          .eq('week_start_date', weekStart)
          .maybeSingle(),
        supabase.from('household_traditions')
          .select('id, name, day_of_week, tradition_type')
          .eq('household_id', hid),
        supabase.from('grocery_stores')
          .select('id, name')
          .eq('household_id', hid),
      ])

      if (tradRes.data) {
        setTraditions(tradRes.data)
        const toggles = {}
        tradRes.data.forEach(t => { toggles[t.id] = true })
        setTraditionToggles(toggles)
      }
      if (storeRes.data) setStores(storeRes.data)

      const activePlan = planRes.data
      setPlan(activePlan)

      // Pre-fill week label
      if (activePlan?.notes) {
        setWeekLabel(activePlan.notes)
      } else {
        setWeekLabel(formatWeekRange(weekDates))
      }

      // Load proteins if plan exists
      if (activePlan) {
        const { data: proteinData } = await supabase
          .from('weekly_proteins')
          .select('*, grocery_stores(name)')
          .eq('meal_plan_id', activePlan.id)
        if (proteinData) setProteins(proteinData)
      }
    } catch (err) {
      console.error('WeekSettings load error:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleLabelBlur() {
    if (!plan) return
    supabase.from('meal_plans')
      .update({ notes: weekLabel })
      .eq('id', plan.id)
      .then(() => {})
  }

  function setDayType(dowKey, type) {
    setDayTypes(prev => ({ ...prev, [dowKey]: type }))
  }

  function toggleTradition(id) {
    setTraditionToggles(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div style={{
      background: C.cream,
      fontFamily: "'Jost', sans-serif",
      fontWeight: 300,
      minHeight: '100vh',
      maxWidth: '430px',
      margin: '0 auto',
      paddingBottom: '140px',
      position: 'relative',
      overflowX: 'hidden',
    }}>

      {/* ── Slim Topbar ───────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', background: C.forest,
        boxShadow: '0 2px 0px rgba(20,40,25,0.55), 0 4px 8px rgba(20,40,25,0.40), 0 8px 24px rgba(30,55,35,0.28), 0 16px 40px rgba(30,55,35,0.14), 0 1px 0px rgba(255,255,255,0.06) inset',
      }}>
        <button onClick={() => navigate('/thisweek')} style={backBtnStyle} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 600, color: 'rgba(250,247,242,0.95)', userSelect: 'none' }}>
          Ro<em style={{ fontStyle: 'italic', color: 'rgba(188,218,178,0.82)' }}>ux</em>
        </div>
        {/* Spacer to balance back button */}
        <div style={{ width: '36px' }} />
      </header>

      {/* ── Screen Title ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '22px 24px 14px',
        animation: 'fadeUp 0.35s ease both',
      }}>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '24px',
          fontWeight: 600,
          color: C.ink,
          margin: 0,
        }}>
          Set Up This Week
        </h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.driftwood, fontSize: '14px' }}>
          Loading...
        </div>
      ) : (
        <>
          {/* ── Section 1: Week Label ─────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.04s both' }}>
            <div style={sectionHeaderStyle}>Week Label</div>
            <input
              type="text"
              value={weekLabel}
              onChange={e => setWeekLabel(e.target.value)}
              onBlur={handleLabelBlur}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '15px',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 400,
                color: C.ink,
                border: `1px solid ${C.linen}`,
                borderRadius: '10px',
                background: C.cream,
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = C.sage }}
              onBlurCapture={e => { e.target.style.borderColor = C.linen }}
            />
            <div style={{
              fontSize: '12px',
              color: C.driftwood,
              fontStyle: 'italic',
              marginTop: '8px',
              lineHeight: 1.4,
            }}>
              Name this week — 'Spring Break', 'Track Season'
            </div>
          </div>

          {/* ── Section 2: Day Types ──────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.08s both' }}>
            <div style={sectionHeaderStyle}>Day Types</div>
            {DAYS.map((day, i) => {
              const dowKey = DOW_KEYS[i]
              const activeType = dayTypes[dowKey]
              return (
                <div key={dowKey} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: i < 6 ? `1px solid rgba(200,185,160,0.25)` : 'none',
                }}>
                  <span style={{ fontSize: '14px', fontWeight: 400, color: C.ink, minWidth: '80px' }}>
                    {day}
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                    {DAY_TYPE_OPTIONS.map(opt => {
                      const isActive = activeType === opt.key
                      return (
                        <button
                          key={opt.key}
                          onClick={() => setDayType(dowKey, opt.key)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontFamily: "'Jost', sans-serif",
                            fontWeight: isActive ? 500 : 400,
                            borderRadius: '14px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            whiteSpace: 'nowrap',
                            border: `1.5px solid ${opt.color}`,
                            background: isActive ? opt.color : 'transparent',
                            color: isActive ? 'white' : opt.color,
                          }}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Section 3: Traditions ─────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.12s both' }}>
            <div style={sectionHeaderStyle}>Traditions</div>
            {traditions.length === 0 ? (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood }}>
                No traditions set up yet.
              </div>
            ) : (
              traditions.map(t => (
                <div key={t.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: `1px solid rgba(200,185,160,0.2)`,
                }}>
                  <span style={{ fontSize: '14px', color: C.ink }}>{t.name}</span>
                  <button
                    onClick={() => toggleTradition(t.id)}
                    style={{
                      width: '44px', height: '24px',
                      borderRadius: '12px',
                      border: traditionToggles[t.id] ? 'none' : `1.5px solid ${C.linen}`,
                      background: traditionToggles[t.id] ? C.forest : C.cream,
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.25s, border-color 0.25s',
                      padding: 0,
                      flexShrink: 0,
                    }}
                    aria-label={`Toggle ${t.name}`}
                  >
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      left: traditionToggles[t.id] ? '22px' : '2px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'white',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                      transition: 'left 0.25s',
                    }} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* ── Section 4: Protein Roster ─────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.16s both' }}>
            <div style={sectionHeaderStyle}>Protein Roster</div>
            {proteins.length === 0 ? (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood, marginBottom: '12px' }}>
                No proteins added yet.
              </div>
            ) : (
              proteins.map(p => (
                <div key={p.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: `1px solid rgba(200,185,160,0.2)`,
                }}>
                  <div>
                    <span style={{ fontSize: '14px', color: C.ink, fontWeight: 400 }}>
                      {p.protein_name || p.name}
                    </span>
                    {p.grocery_stores?.name && (
                      <span style={{ fontSize: '12px', color: C.driftwood, marginLeft: '8px' }}>
                        {p.grocery_stores.name}
                      </span>
                    )}
                  </div>
                  {p.on_sale && (
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                      color: 'white',
                      background: C.honey,
                      borderRadius: '8px',
                      padding: '2px 8px',
                      textTransform: 'uppercase',
                    }}>
                      Sale
                    </span>
                  )}
                </div>
              ))
            )}
            <button
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '8px',
                fontSize: '13px',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 500,
                color: C.forest,
                background: 'transparent',
                border: `1.5px dashed rgba(61,107,79,0.4)`,
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(61,107,79,0.04)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              + Add protein
            </button>
          </div>

          {/* ── Section 5: Templates ──────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.20s both' }}>
            <div style={sectionHeaderStyle}>Templates</div>
            <button
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '8px',
                fontSize: '14px',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 500,
                color: C.forest,
                background: 'transparent',
                border: `1.5px solid rgba(61,107,79,0.4)`,
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(61,107,79,0.04)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              Apply a template
            </button>
            <button
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '10px',
                fontSize: '14px',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 500,
                color: C.forest,
                background: 'transparent',
                border: `1.5px solid rgba(61,107,79,0.4)`,
                borderRadius: '10px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(61,107,79,0.04)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              Save this week as template
            </button>
            <div style={{
              fontSize: '12px',
              fontStyle: 'italic',
              color: C.driftwood,
              lineHeight: 1.4,
            }}>
              Templates save your day types and traditions for quick reuse.
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Nav ────────────────────────────────────────────────────── */}
      <BottomNav navigate={navigate} />
    </div>
  )
}

// ── Bottom Navigation ──────────────────────────────────────────────────────────
const NAV_TABS = [
  {
    key: 'home', label: 'Home', path: '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    key: 'recipes', label: 'Recipes', path: '/recipes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
  },
  {
    key: 'thisweek', label: 'This Week', path: '/thisweek',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
        <line x1="16" x2="16" y1="2" y2="6"/>
        <line x1="8" x2="8" y1="2" y2="6"/>
        <line x1="3" x2="21" y1="10" y2="10"/>
      </svg>
    ),
  },
  {
    key: 'shopping', label: 'Shopping', path: '/shopping',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
        <line x1="3" x2="21" y1="6" y2="6"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    ),
  },
]

function BottomNav({ navigate }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '430px', height: '80px',
      padding: '10px 0 22px',
      display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
      zIndex: 100, background: C.cream,
      borderTop: `1px solid ${C.linen}`,
      boxShadow: '0 -2px 12px rgba(80,60,30,0.08)',
    }}>
      {NAV_TABS.map(tab => (
        <button
          key={tab.key}
          onClick={() => navigate(tab.path)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
            cursor: 'pointer', padding: '4px 0',
            background: 'none', border: 'none',
            color: C.driftwood,
            transition: 'color 0.15s',
            position: 'relative',
            fontFamily: "'Jost', sans-serif",
          }}
        >
          {tab.icon}
          <span style={{ fontSize: '10px', fontWeight: 400, letterSpacing: '0.3px' }}>
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  )
}
