/**
 * AddToPlanSheet.jsx — Reusable bottom sheet for adding a meal to the weekly plan.
 * Accepts a meal prop ({ id, name }). All state and DB logic lives here.
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getWeekDatesTZ, getWeekStartTZ, toLocalDateStr } from '../lib/dateUtils'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0', sage: '#7A8C6E',
  honey: '#C49A3C', red: '#A03030',
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const SLOT_OPTIONS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'other', label: 'Everything else' },
]

// Get Monday of the week containing a given date
function getMondayOf(d) {
  const dt = new Date(d)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  return dt
}

// Compute week offset from the current week's Monday
function weekOffsetFrom(targetMonday, tz) {
  const thisMonStr = getWeekStartTZ(tz, 0)
  const [y, m, d] = thisMonStr.split('-').map(Number)
  const thisMon = new Date(y, m - 1, d)
  const diff = Math.round((targetMonday - thisMon) / (7 * 86400000))
  return diff
}

export default function AddToPlanSheet({ open, onClose, meal, appUser, onSuccess }) {
  const tz = appUser?.timezone || 'America/Chicago'

  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)
  const [mealSlot, setMealSlot] = useState('dinner')
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(null)
  const [toast, setToast] = useState(null)

  // Calendar state
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calMonth, setCalMonth] = useState(null) // 0-11
  const [calYear, setCalYear] = useState(null)
  const [calSelectedDate, setCalSelectedDate] = useState(null) // Date object

  const weekDates = getWeekDatesTZ(tz, weekOffset)
  const weekStart = getWeekStartTZ(tz, weekOffset)

  // Today for reference
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Max calendar: 6 months out
  const maxMonth = (now.getMonth() + 6) % 12
  const maxYear = now.getFullYear() + Math.floor((now.getMonth() + 6) / 12)

  useEffect(() => {
    if (open) {
      setWeekOffset(0)
      setSelectedDay(null)
      setMealSlot('dinner')
      setConflict(null)
      setToast(null)
      setSaving(false)
      setCalendarOpen(false)
      setCalSelectedDate(null)
      setCalMonth(now.getMonth())
      setCalYear(now.getFullYear())
    }
  }, [open])

  function fmtMonday(offset) {
    const dates = getWeekDatesTZ(tz, offset)
    return dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function selectQuickWeek(offset) {
    setWeekOffset(offset)
    setSelectedDay(null)
    setConflict(null)
    setCalendarOpen(false)
    setCalSelectedDate(null)
  }

  function selectCalendarDate(date) {
    const mon = getMondayOf(date)
    const offset = weekOffsetFrom(mon, tz)
    if (offset < 0) return // no past weeks
    setWeekOffset(offset)
    setCalSelectedDate(new Date(date))
    setConflict(null)

    // Auto-select the day within the week
    const dayOfWeek = date.getDay()
    // Convert JS day (0=Sun) to our Mon-based index (0=Mon)
    const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    setSelectedDay(dayIdx)
  }

  // Format selected week range for confirmation line
  function fmtWeekRange() {
    const mon = weekDates[0]
    const sun = weekDates[6]
    const opts = { weekday: 'short', month: 'short', day: 'numeric' }
    return `Week of ${mon.toLocaleDateString('en-US', opts)} – ${sun.toLocaleDateString('en-US', opts)}`
  }

  // Build calendar grid for current calMonth/calYear
  function buildCalendarGrid() {
    const firstDay = new Date(calYear, calMonth, 1)
    const lastDay = new Date(calYear, calMonth + 1, 0)
    // Monday-based: Mon=0, Tue=1, ..., Sun=6
    let startDow = firstDay.getDay()
    startDow = startDow === 0 ? 6 : startDow - 1

    const cells = []
    // Fill leading blanks
    for (let i = 0; i < startDow; i++) cells.push(null)
    // Fill days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push(new Date(calYear, calMonth, d))
    }
    // Fill trailing blanks to complete last row
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  function canGoBack() {
    // Can't go to months before current
    return calYear > now.getFullYear() || (calYear === now.getFullYear() && calMonth > now.getMonth())
  }

  function canGoForward() {
    return calYear < maxYear || (calYear === maxYear && calMonth < maxMonth)
  }

  function navMonth(dir) {
    let m = calMonth + dir
    let y = calYear
    if (m > 11) { m = 0; y++ }
    if (m < 0) { m = 11; y-- }
    setCalMonth(m)
    setCalYear(y)
  }

  // Check if a date is in the same week as calSelectedDate
  function isInSelectedWeek(d) {
    if (!calSelectedDate || !d) return false
    const mon1 = getMondayOf(calSelectedDate)
    const mon2 = getMondayOf(d)
    return mon1.getTime() === mon2.getTime()
  }

  function isSameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  }

  function isToday(d) {
    return d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayStr
  }

  function isPastDate(d) {
    if (!d) return false
    const mon = getMondayOf(d)
    const offset = weekOffsetFrom(mon, tz)
    return offset < 0
  }

  async function checkAndSave(force = false) {
    if (selectedDay === null || !meal?.id || saving) return
    setSaving(true)
    setConflict(null)

    try {
      const weekEnd = toLocalDateStr(weekDates[6])
      const dayKey = DAY_KEYS[selectedDay]
      const dayLabel = DAY_LABELS[selectedDay]
      const slotLabel = SLOT_OPTIONS.find(s => s.key === mealSlot)?.label || mealSlot

      let { data: plan } = await supabase
        .from('meal_plans')
        .select('id')
        .eq('household_id', appUser.household_id)
        .eq('week_start_date', weekStart)
        .maybeSingle()

      if (!plan) {
        const { data: newPlan, error: planErr } = await supabase
          .from('meal_plans')
          .insert({
            household_id: appUser.household_id,
            created_by: appUser.id,
            week_start_date: weekStart,
            week_end_date: weekEnd,
            status: 'draft',
          })
          .select('id')
          .single()
        if (planErr) throw planErr
        plan = newPlan
      }

      if (!force) {
        const { data: existing } = await supabase
          .from('planned_meals')
          .select('id')
          .eq('meal_plan_id', plan.id)
          .eq('day_of_week', dayKey)
          .eq('meal_type', mealSlot)
          .limit(1)

        if (existing && existing.length > 0) {
          setConflict({ dayLabel, slotLabel })
          setSaving(false)
          return
        }
      }

      const { error: pmErr } = await supabase
        .from('planned_meals')
        .insert({
          household_id: appUser.household_id,
          meal_plan_id: plan.id,
          day_of_week: dayKey,
          meal_type: mealSlot,
          slot_type: 'meal',
          meal_id: meal.id,
        })

      if (pmErr) throw pmErr

      setToast(`Added to ${dayLabel} ${slotLabel.toLowerCase()}`)
      setTimeout(() => {
        onClose()
        if (onSuccess) onSuccess()
      }, 1000)

    } catch (err) {
      console.error('[Roux] AddToPlan error:', err)
      setToast('Something went wrong.')
      setSaving(false)
    }
  }

  const canConfirm = selectedDay !== null && !saving
  const calGrid = calendarOpen && calMonth !== null ? buildCalendarGrid() : []
  const monthLabel = calMonth !== null ? new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(44,36,23,0.45)',
          zIndex: 200,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />
      {/* Sheet */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', bottom: 0, left: '50%',
          transform: open ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
          width: '100%', maxWidth: '430px',
          background: 'white', borderRadius: '20px 20px 0 0',
          padding: '0 0 34px', zIndex: 201,
          boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
          transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />

        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Title */}
          <div style={{
            fontFamily: "'Playfair Display', serif", fontSize: '20px',
            fontWeight: 500, color: C.ink,
          }}>
            Add to plan
          </div>

          {/* Week selector */}
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 500, marginBottom: '8px' }}>
              Week
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { offset: 0, label: 'This week' },
                { offset: 1, label: 'Next week' },
              ].map(w => {
                const sel = weekOffset === w.offset && !calendarOpen
                return (
                  <button
                    key={w.offset}
                    onClick={() => selectQuickWeek(w.offset)}
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: '10px',
                      border: sel ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                      background: sel ? 'rgba(61,107,79,0.08)' : 'white',
                      cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: sel ? 500 : 400, color: sel ? C.forest : C.ink }}>
                      {w.label}
                    </div>
                    <div style={{ fontSize: '10px', color: C.driftwood, fontWeight: 300, marginTop: '2px' }}>
                      {fmtMonday(w.offset)}
                    </div>
                  </button>
                )
              })}
              {/* Further out */}
              <button
                onClick={() => setCalendarOpen(v => !v)}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: '10px',
                  border: calendarOpen ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                  background: calendarOpen ? 'rgba(61,107,79,0.08)' : 'white',
                  cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: calendarOpen ? 500 : 400, color: calendarOpen ? C.forest : C.ink }}>
                  Further out
                </div>
                <div style={{ fontSize: '10px', color: C.driftwood, fontWeight: 300, marginTop: '2px' }}>
                  Pick a week
                </div>
              </button>
            </div>
          </div>

          {/* ── Calendar ──────────────────────────────────────────────── */}
          {calendarOpen && (
            <div style={{
              background: C.cream, borderRadius: '12px', padding: '14px 12px',
              border: `1px solid ${C.linen}`,
            }}>
              {/* Month header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <button
                  onClick={() => canGoBack() && navMonth(-1)}
                  disabled={!canGoBack()}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    border: `1px solid ${C.linen}`, background: 'white',
                    cursor: canGoBack() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: canGoBack() ? 1 : 0.3,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="2" strokeLinecap="round" style={{ width: 12, height: 12 }}>
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <div style={{
                  fontFamily: "'Playfair Display', serif", fontSize: '15px',
                  fontWeight: 500, color: C.ink,
                }}>
                  {monthLabel}
                </div>
                <button
                  onClick={() => canGoForward() && navMonth(1)}
                  disabled={!canGoForward()}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    border: `1px solid ${C.linen}`, background: 'white',
                    cursor: canGoForward() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: canGoForward() ? 1 : 0.3,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="2" strokeLinecap="round" style={{ width: 12, height: 12 }}>
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>

              {/* Day-of-week headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0', marginBottom: '4px' }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <div key={i} style={{
                    textAlign: 'center', fontSize: '9px', fontWeight: 500,
                    letterSpacing: '0.5px', color: C.driftwood,
                    padding: '4px 0',
                  }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0' }}>
                {calGrid.map((d, i) => {
                  if (!d) return <div key={`blank-${i}`} style={{ padding: '6px 0' }} />
                  const past = isPastDate(d)
                  const sel = isSameDay(d, calSelectedDate)
                  const inWeek = isInSelectedWeek(d)
                  const td = isToday(d)
                  return (
                    <button
                      key={i}
                      onClick={() => !past && selectCalendarDate(d)}
                      disabled={past}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', gap: '2px',
                        padding: '6px 0', border: 'none', cursor: past ? 'default' : 'pointer',
                        background: inWeek ? '#E4DDD2' : 'transparent',
                        opacity: past ? 0.3 : 1,
                        fontFamily: "'Jost', sans-serif",
                        borderRadius: i % 7 === 0 && inWeek ? '6px 0 0 6px'
                          : i % 7 === 6 && inWeek ? '0 6px 6px 0' : '0',
                      }}
                    >
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: sel ? C.forest : 'transparent',
                        color: sel ? 'white' : C.ink,
                        fontSize: '13px', fontWeight: sel ? 500 : 400,
                        transition: 'all 0.15s',
                      }}>
                        {d.getDate()}
                      </div>
                      {td && !sel && (
                        <div style={{
                          width: '3px', height: '3px', borderRadius: '50%',
                          background: C.forest, marginTop: '-2px',
                        }} />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Selected week confirmation line */}
              {calSelectedDate && (
                <div style={{
                  marginTop: '10px', textAlign: 'center',
                  fontSize: '12px', color: C.driftwood, fontWeight: 300,
                }}>
                  {fmtWeekRange()}
                </div>
              )}
            </div>
          )}

          {/* Day tiles */}
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 500, marginBottom: '8px' }}>
              Day
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {DAY_LABELS.map((label, idx) => {
                const date = weekDates[idx]
                const dayNum = date.getDate()
                const sel = selectedDay === idx
                return (
                  <button
                    key={idx}
                    onClick={() => { setSelectedDay(idx); setConflict(null) }}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: '2px', padding: '8px 0',
                      borderRadius: '10px', cursor: 'pointer',
                      border: sel ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                      background: sel ? 'rgba(61,107,79,0.08)' : 'white',
                      fontFamily: "'Jost', sans-serif",
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px', color: sel ? C.forest : C.driftwood, fontWeight: 500 }}>
                      {label}
                    </span>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: sel ? C.forest : C.ink, fontWeight: 500 }}>
                      {dayNum}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Meal slot */}
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', color: C.driftwood, fontWeight: 500, marginBottom: '8px' }}>
              Meal
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {SLOT_OPTIONS.map(s => {
                const sel = mealSlot === s.key
                return (
                  <button
                    key={s.key}
                    onClick={() => { setMealSlot(s.key); setConflict(null) }}
                    style={{
                      flex: 1, padding: '8px 6px', borderRadius: '10px',
                      border: sel ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                      background: sel ? 'rgba(61,107,79,0.08)' : 'white',
                      cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                      fontSize: '12px', fontWeight: sel ? 500 : 400,
                      color: sel ? C.forest : C.ink,
                      transition: 'all 0.15s', textAlign: 'center',
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Conflict warning */}
          {conflict && (
            <div style={{
              background: 'rgba(196,154,60,0.08)', borderRadius: '10px',
              padding: '12px 14px', border: `1px solid rgba(196,154,60,0.25)`,
            }}>
              <div style={{ fontSize: '13px', color: C.ink, fontWeight: 400, marginBottom: '10px' }}>
                {conflict.dayLabel} {conflict.slotLabel.toLowerCase()} already has something planned.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => checkAndSave(true)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px',
                    background: C.forest, color: 'white', border: 'none',
                    fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >Add anyway</button>
                <button
                  onClick={() => { setConflict(null); setSelectedDay(null) }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px',
                    background: 'none', color: C.driftwood, border: `1px solid ${C.linen}`,
                    fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 400,
                    cursor: 'pointer',
                  }}
                >Pick a different day</button>
              </div>
            </div>
          )}

          {/* Toast */}
          {toast && (
            <div style={{
              textAlign: 'center', fontSize: '13px', fontWeight: 500,
              color: toast.includes('wrong') ? C.red : C.forest,
              padding: '4px 0',
            }}>
              {toast}
            </div>
          )}

          {/* Confirm button */}
          {!conflict && (
            <button
              onClick={() => checkAndSave(false)}
              disabled={!canConfirm}
              style={{
                width: '100%', padding: '16px', borderRadius: '14px',
                background: canConfirm ? C.forest : C.linen,
                color: canConfirm ? 'white' : C.driftwood,
                border: 'none', cursor: canConfirm ? 'pointer' : 'default',
                fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                boxShadow: canConfirm ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {saving ? 'Adding...' : 'Add to plan'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
