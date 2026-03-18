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
  { key: 'snack', label: 'Snack' },
  { key: 'other', label: 'Everything else' },
]

export default function AddToPlanSheet({ open, onClose, meal, appUser, onSuccess }) {
  const tz = appUser?.timezone || 'America/Chicago'

  const [weekOffset, setWeekOffset] = useState(0) // 0 = this week, 1 = next week, 2+ = further
  const [selectedDay, setSelectedDay] = useState(null)
  const [mealSlot, setMealSlot] = useState('dinner')
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(null) // { dayLabel, slotLabel }
  const [toast, setToast] = useState(null)

  const weekDates = getWeekDatesTZ(tz, weekOffset)
  const weekStart = getWeekStartTZ(tz, weekOffset)

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setWeekOffset(0)
      setSelectedDay(null)
      setMealSlot('dinner')
      setConflict(null)
      setToast(null)
      setSaving(false)
    }
  }, [open])

  // Format a Monday date label like "Mar 17"
  function fmtMonday(offset) {
    const dates = getWeekDatesTZ(tz, offset)
    const d = dates[0]
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

      // Find or create meal plan
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

      // Check for existing planned meal in this slot
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

      // Insert planned meal
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
                const sel = weekOffset === w.offset
                return (
                  <button
                    key={w.offset}
                    onClick={() => { setWeekOffset(w.offset); setSelectedDay(null); setConflict(null) }}
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
            </div>
          </div>

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
