/**
 * WeekSettings.jsx — "Set Up This Week" screen.
 * Standalone: slim 58px topbar with back arrow, bottom nav, cream bg.
 * Configures day types, traditions, proteins, templates for the current week.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getWeekDatesTZ, getWeekStartTZ, toLocalDateStr } from '../lib/dateUtils'
import TopBar from '../components/TopBar'

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
  const [dayTypes, setDayTypes] = useState({ ...DEFAULT_DAY_TYPES })
  const [traditions, setTraditions] = useState([])
  const [traditionToggles, setTraditionToggles] = useState({})
  const [loading, setLoading] = useState(true)
  const [saveSheetOpen, setSaveSheetOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedTemplates, setSavedTemplates] = useState([])
  const [applySheetOpen, setApplySheetOpen] = useState(false)
  const [addTradSheetOpen, setAddTradSheetOpen] = useState(false)
  const [newTradName, setNewTradName] = useState('')
  const [newTradDay, setNewTradDay] = useState('tuesday')
  const [newTradType, setNewTradType] = useState('weekly')
  const [savingTrad, setSavingTrad] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [savingWeek, setSavingWeek] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false)

  useEffect(() => {
    if (appUser?.household_id) loadData()
  }, [appUser?.household_id])

  async function loadData() {
    setLoading(true)
    try {
      const hid = appUser.household_id
      const weekStart = getWeekStartTZ(tz, 0)

      const [planRes, tradRes, templatesRes] = await Promise.all([
        supabase.from('meal_plans')
          .select('id, status, week_start_date, week_end_date, notes')
          .eq('household_id', hid)
          .eq('week_start_date', weekStart)
          .maybeSingle(),
        supabase.from('household_traditions')
          .select('id, name, day_of_week, tradition_type')
          .eq('household_id', hid),
        supabase.from('meal_plan_templates')
          .select('id, name, source_plan_ids')
          .eq('household_id', hid)
          .order('created_at', { ascending: false }),
      ])

      if (tradRes.data) {
        setTraditions(tradRes.data)
        // Default all traditions to on
        const toggles = {}
        tradRes.data.forEach(t => { toggles[t.id] = true })
        setTraditionToggles(toggles)
      }
      if (templatesRes.data) setSavedTemplates(templatesRes.data)

      const activePlan = planRes.data
      setPlan(activePlan)

      // Restore saved week settings from meal_plans.notes if available
      if (activePlan?.notes) {
        try {
          const config = JSON.parse(activePlan.notes)
          if (config.day_types) setDayTypes(config.day_types)
          if (config.active_traditions && tradRes.data) {
            const toggles = {}
            tradRes.data.forEach(t => { toggles[t.id] = config.active_traditions.includes(t.id) })
            setTraditionToggles(toggles)
          }
        } catch { /* notes is plain text, not JSON — ignore */ }
      }
    } catch (err) {
      console.error('WeekSettings load error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Smart template name suggestion based on day type pattern
  function suggestTemplateName() {
    const vals = Object.values(dayTypes)
    if (vals.every(v => v === 'summer'))    return 'Summer Week'
    if (vals.some(v => v === 'no_school'))  return 'No School Week'
    if (vals.filter(v => v === 'school').length >= 5) return 'School Week'
    return 'My Week Template'
  }

  function openSaveSheet() {
    setTemplateName(suggestTemplateName())
    setSaveSheetOpen(true)
  }

  async function saveTemplate() {
    if (!templateName.trim() || saving) return
    setSaving(true)
    try {
      const activeTraditions = Object.entries(traditionToggles)
        .filter(([, on]) => on)
        .map(([id]) => id)

      const insertPayload = {
        household_id: appUser.household_id,
        name: templateName.trim(),
        source_plan_ids: { day_types: dayTypes, traditions: activeTraditions },
      }
      console.log('[Roux] saveTemplate payload:', insertPayload)

      const { data, error } = await supabase
        .from('meal_plan_templates')
        .insert(insertPayload)
        .select('id, name, source_plan_ids')
        .single()

      if (error) {
        console.error('[Roux] saveTemplate Supabase error:', error.message, error.details, error.hint, error.code)
        throw error
      }
      console.log('[Roux] saveTemplate success:', data)
      setSavedTemplates(prev => [data, ...prev])
      setSaveSheetOpen(false)
    } catch (err) {
      console.error('[Roux] saveTemplate error:', err)
    } finally {
      setSaving(false)
    }
  }

  function applyTemplate(template) {
    const config = template.source_plan_ids
    if (config?.day_types) setDayTypes(config.day_types)
    if (config?.traditions) {
      const toggles = {}
      traditions.forEach(t => { toggles[t.id] = config.traditions.includes(t.id) })
      setTraditionToggles(toggles)
    }
    setHasChanges(true)
    setApplySheetOpen(false)
  }

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  function handleBack() {
    if (hasChanges) {
      setConfirmLeaveOpen(true)
    } else {
      navigate('/thisweek')
    }
  }

  async function saveWeekSettings() {
    if (savingWeek) return
    setSavingWeek(true)
    try {
      // Ensure a plan exists
      let activePlan = plan
      if (!activePlan) {
        const hid = appUser.household_id
        const weekStart = getWeekStartTZ(tz, 0)
        const { data: newPlan, error } = await supabase.from('meal_plans').insert({
          household_id: hid, created_by: appUser.id,
          week_start_date: weekStart, week_end_date: toLocalDateStr(weekDates[6]),
          status: 'draft',
        }).select('id, status, week_start_date, week_end_date, notes').single()
        if (error) throw error
        activePlan = newPlan
        setPlan(activePlan)
      }

      const activeTraditions = Object.entries(traditionToggles)
        .filter(([, on]) => on)
        .map(([id]) => id)

      // Save day types + active traditions to meal_plans.notes as JSON
      const weekConfig = { day_types: dayTypes, active_traditions: activeTraditions }
      const { error } = await supabase.from('meal_plans')
        .update({ notes: JSON.stringify(weekConfig) })
        .eq('id', activePlan.id)
      if (error) throw error

      setHasChanges(false)
      showToast('Week settings saved')
      setTimeout(() => navigate('/thisweek'), 800)
    } catch (err) {
      console.error('[Roux] saveWeekSettings error:', err)
    } finally {
      setSavingWeek(false)
    }
  }

  function setDayType(dowKey, type) {
    setDayTypes(prev => ({ ...prev, [dowKey]: type }))
    setHasChanges(true)
  }

  function toggleTradition(id) {
    setTraditionToggles(prev => ({ ...prev, [id]: !prev[id] }))
    setHasChanges(true)
  }

  function openAddTradSheet() {
    setNewTradName('')
    setNewTradDay('tuesday')
    setNewTradType('weekly')
    setAddTradSheetOpen(true)
  }

  async function saveTradition() {
    if (!newTradName.trim() || savingTrad) return
    setSavingTrad(true)
    try {
      const { data, error } = await supabase.from('household_traditions').insert({
        household_id: appUser.household_id,
        name: newTradName.trim(),
        day_of_week: newTradDay,
        tradition_type: newTradType,
      }).select('id, name, day_of_week, tradition_type').single()
      if (error) throw error
      setTraditions(prev => [...prev, data])
      setTraditionToggles(prev => ({ ...prev, [data.id]: true }))
      setAddTradSheetOpen(false)
    } catch (err) {
      console.error('[Roux] saveTradition error:', err)
    } finally {
      setSavingTrad(false)
    }
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

      <TopBar
        slim
        leftAction={{
          onClick: handleBack,
          icon: (
            <div style={{ position: 'relative' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                <path d="m15 18-6-6 6-6"/>
              </svg>
              {hasChanges && (
                <span style={{
                  position: 'absolute', top: '-6px', right: '-6px',
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: C.honey, border: `1.5px solid ${C.forest}`,
                }} />
              )}
            </div>
          ),
          label: 'Back',
        }}
      />

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
          {/* ── Section 1: Day Types ──────────────────────────────────────── */}
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
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood, marginBottom: '12px' }}>
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
                  <div>
                    <span style={{ fontSize: '14px', color: C.ink }}>{t.name}</span>
                    {t.day_of_week && (
                      <span style={{ fontSize: '11px', color: C.driftwood, marginLeft: '8px' }}>
                        {t.day_of_week.charAt(0).toUpperCase() + t.day_of_week.slice(1)}
                      </span>
                    )}
                  </div>
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
            <button
              onClick={openAddTradSheet}
              style={{
                width: '100%', padding: '12px', marginTop: '8px',
                fontSize: '13px', fontFamily: "'Jost', sans-serif", fontWeight: 500,
                color: C.forest, background: 'transparent',
                border: `1.5px dashed rgba(61,107,79,0.4)`, borderRadius: '10px',
                cursor: 'pointer', textAlign: 'center', transition: 'background 0.15s',
              }}
            >
              + Add tradition
            </button>
          </div>

          {/* ── Section 5: Templates ──────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.20s both' }}>
            <div style={sectionHeaderStyle}>Templates</div>
            <button
              onClick={() => setApplySheetOpen(true)}
              style={{
                width: '100%', padding: '12px', marginBottom: '8px',
                fontSize: '14px', fontFamily: "'Jost', sans-serif", fontWeight: 500,
                color: C.forest, background: 'transparent',
                border: `1.5px solid rgba(61,107,79,0.4)`, borderRadius: '10px',
                cursor: 'pointer', textAlign: 'center', transition: 'background 0.15s',
              }}
            >
              Apply a template
            </button>
            <button
              onClick={openSaveSheet}
              style={{
                width: '100%', padding: '12px', marginBottom: '10px',
                fontSize: '14px', fontFamily: "'Jost', sans-serif", fontWeight: 500,
                color: C.forest, background: 'transparent',
                border: `1.5px solid rgba(61,107,79,0.4)`, borderRadius: '10px',
                cursor: 'pointer', textAlign: 'center', transition: 'background 0.15s',
              }}
            >
              Save this week as template
            </button>
            <div style={{ fontSize: '12px', fontStyle: 'italic', color: C.driftwood, lineHeight: 1.4 }}>
              Templates save your day types and traditions for quick reuse.
            </div>
          </div>
          {/* ── Save Week Settings CTA ──────────────────────────────────── */}
          <div style={{ padding: '6px 22px 0', animation: 'fadeUp 0.35s ease 0.24s both' }}>
            <button
              onClick={saveWeekSettings}
              disabled={savingWeek}
              style={{
                width: '100%', background: C.forest, color: 'white', border: 'none',
                borderRadius: '12px', padding: '15px',
                fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
                letterSpacing: '0.5px', cursor: savingWeek ? 'default' : 'pointer',
                boxShadow: '0 2px 10px rgba(61,107,79,0.28)',
                opacity: savingWeek ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {savingWeek ? 'Saving…' : 'Save Week Settings'}
            </button>
          </div>
        </>
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
          background: C.forest, color: 'white', padding: '10px 20px',
          borderRadius: '10px', fontSize: '13px', fontWeight: 500,
          fontFamily: "'Jost', sans-serif", zIndex: 500,
          boxShadow: '0 4px 16px rgba(30,55,35,0.30)',
          animation: 'fadeUp 0.25s ease both',
        }}>
          {toastMsg}
        </div>
      )}

      {/* ── Confirm Leave Dialog ───────────────────────────────────────────── */}
      {confirmLeaveOpen && (
        <>
          <div
            onClick={() => setConfirmLeaveOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)',
              zIndex: 300, animation: 'fadeIn 0.2s ease',
            }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'calc(100% - 64px)', maxWidth: '340px',
            background: 'white', borderRadius: '20px',
            padding: '24px', zIndex: 301,
            boxShadow: '0 8px 32px rgba(44,36,23,0.18)',
          }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '8px' }}>
              Unsaved changes
            </div>
            <div style={{ fontSize: '14px', color: C.driftwood, fontWeight: 300, lineHeight: 1.5, marginBottom: '20px' }}>
              You have unsaved changes. Save before leaving?
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setConfirmLeaveOpen(false); navigate('/thisweek') }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: `1px solid ${C.linen}`, background: 'none',
                  fontFamily: "'Jost', sans-serif", fontSize: '13px',
                  fontWeight: 500, color: C.driftwood, cursor: 'pointer',
                }}
              >
                Discard
              </button>
              <button
                onClick={() => { setConfirmLeaveOpen(false); saveWeekSettings() }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: 'none', background: C.forest, color: 'white',
                  fontFamily: "'Jost', sans-serif", fontSize: '13px',
                  fontWeight: 500, cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Nav ────────────────────────────────────────────────────── */}
      <BottomNav navigate={navigate} />

      {/* ── Add Tradition Sheet overlay ──────────────────────────────── */}
      <div
        onClick={() => setAddTradSheetOpen(false)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)',
          zIndex: 200, opacity: addTradSheetOpen ? 1 : 0,
          pointerEvents: addTradSheetOpen ? 'all' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* ── Add Tradition Sheet ────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: addTradSheetOpen ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
        width: '100%', maxWidth: '430px',
        background: 'white', borderRadius: '20px 20px 0 0',
        padding: '0 0 40px', zIndex: 201,
        transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
      }}>
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '16px' }}>
            Add a tradition
          </div>

          {/* Name */}
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '6px' }}>
            Name
          </div>
          <input
            type="text"
            value={newTradName}
            onChange={e => setNewTradName(e.target.value)}
            placeholder="e.g. Taco Tuesday, Pizza Friday"
            autoFocus={addTradSheetOpen}
            style={{
              width: '100%', padding: '12px 14px',
              border: `1px solid ${C.linen}`, borderRadius: '10px',
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300,
              color: C.ink, outline: 'none', background: C.cream,
              boxSizing: 'border-box', marginBottom: '16px',
            }}
          />

          {/* Day of week */}
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '6px' }}>
            Day
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {DOW_KEYS.map((dow, i) => (
              <button
                key={dow}
                onClick={() => setNewTradDay(dow)}
                style={{
                  padding: '6px 12px', fontSize: '12px',
                  fontFamily: "'Jost', sans-serif", fontWeight: newTradDay === dow ? 500 : 400,
                  borderRadius: '14px', cursor: 'pointer',
                  border: `1.5px solid ${newTradDay === dow ? C.forest : C.linen}`,
                  background: newTradDay === dow ? C.forest : 'transparent',
                  color: newTradDay === dow ? 'white' : C.ink,
                  transition: 'all 0.15s',
                }}
              >
                {DAYS[i].slice(0, 3)}
              </button>
            ))}
          </div>

          {/* Save / Cancel */}
          <button
            onClick={saveTradition}
            disabled={!newTradName.trim() || savingTrad}
            style={{
              width: '100%', background: newTradName.trim() ? C.forest : C.linen,
              color: newTradName.trim() ? 'white' : C.driftwood,
              border: 'none', borderRadius: '12px', padding: '14px',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
              cursor: newTradName.trim() ? 'pointer' : 'default',
              marginBottom: '8px',
            }}
          >
            {savingTrad ? 'Saving…' : 'Save tradition'}
          </button>
          <button
            onClick={() => setAddTradSheetOpen(false)}
            style={{
              width: '100%', background: 'none', border: 'none', color: C.driftwood,
              fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300,
              padding: '10px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ── Save Template Sheet overlay ────────────────────────────────── */}
      <div
        onClick={() => setSaveSheetOpen(false)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)',
          zIndex: 200, opacity: saveSheetOpen ? 1 : 0,
          pointerEvents: saveSheetOpen ? 'all' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* ── Save Template Sheet ────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: saveSheetOpen ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
        width: '100%', maxWidth: '430px',
        background: 'white', borderRadius: '20px 20px 0 0',
        padding: '0 0 40px', zIndex: 201,
        transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
      }}>
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '16px' }}>
            Name this template
          </div>
          <input
            type="text"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            onFocus={e => e.target.select()}
            autoFocus={saveSheetOpen}
            style={{
              width: '100%', padding: '14px 16px',
              border: `1px solid ${C.linen}`, borderRadius: '12px',
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300,
              color: C.ink, outline: 'none', background: C.cream,
              boxSizing: 'border-box', marginBottom: '16px',
            }}
            onKeyDown={e => { if (e.key === 'Enter') saveTemplate() }}
          />
          <button
            onClick={saveTemplate}
            disabled={!templateName.trim() || saving}
            style={{
              width: '100%', background: templateName.trim() ? C.forest : C.linen,
              color: templateName.trim() ? 'white' : C.driftwood,
              border: 'none', borderRadius: '12px', padding: '14px',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
              cursor: templateName.trim() ? 'pointer' : 'default',
              marginBottom: '8px',
            }}
          >
            {saving ? 'Saving…' : 'Save template'}
          </button>
          <button
            onClick={() => setSaveSheetOpen(false)}
            style={{
              width: '100%', background: 'none', border: 'none', color: C.driftwood,
              fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300,
              padding: '10px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ── Apply Template Sheet overlay ───────────────────────────────── */}
      <div
        onClick={() => setApplySheetOpen(false)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)',
          zIndex: 200, opacity: applySheetOpen ? 1 : 0,
          pointerEvents: applySheetOpen ? 'all' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* ── Apply Template Sheet ───────────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: applySheetOpen ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
        width: '100%', maxWidth: '430px',
        background: 'white', borderRadius: '20px 20px 0 0',
        padding: '0 0 40px', zIndex: 201,
        transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
        boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
      }}>
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
        <div style={{ padding: '20px 22px 0' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '16px' }}>
            Apply a template
          </div>
          {savedTemplates.length === 0 ? (
            <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood, padding: '16px 0' }}>
              No saved templates yet. Save your current setup as a template first.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
              {savedTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderRadius: '12px',
                    border: '1px solid rgba(200,185,160,0.55)',
                    background: C.cream, cursor: 'pointer',
                    fontFamily: "'Jost', sans-serif", fontSize: '14px',
                    color: C.ink, fontWeight: 400, textAlign: 'left',
                  }}
                >
                  <span>{t.name}</span>
                  <span style={{ fontSize: '11px', color: C.sage, fontWeight: 500 }}>Apply →</span>
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setApplySheetOpen(false)}
            style={{
              width: '100%', background: 'none', border: 'none', color: C.driftwood,
              fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300,
              padding: '10px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
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
    key: 'recipes', label: 'Recipes', path: '/recipes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
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
