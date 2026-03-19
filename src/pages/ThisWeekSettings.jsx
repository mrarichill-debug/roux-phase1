/**
 * ThisWeekSettings.jsx — Screen 1: This Week Settings.
 * Day types for current week, traditions toggle, template apply/save.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getWeekDatesTZ, getWeekStartTZ, toLocalDateStr } from '../lib/dateUtils'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E', linen: '#E8E0D0',
  honey: '#C49A3C',
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const DOW_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']

const DAY_TYPE_OPTIONS = [
  { key: 'no_school', label: 'No School', color: '#D4874A' },
  { key: 'school', label: 'School', color: '#5B8DD9' },
  { key: 'summer', label: 'Summer', color: '#C49A3C' },
  { key: 'weekend', label: 'Weekend', color: '#7A8C6E' },
]

const DEFAULT_DAY_TYPES = {
  monday:'school', tuesday:'school', wednesday:'school',
  thursday:'school', friday:'school', saturday:'weekend', sunday:'weekend',
}

const zoneLabel = {
  fontSize: '11px', letterSpacing: '1.2px', textTransform: 'uppercase',
  color: C.driftwood, fontWeight: 300, marginBottom: '10px',
}

export default function ThisWeekSettings({ appUser }) {
  const navigate = useNavigate()
  const tz = appUser?.timezone ?? 'America/Chicago'
  const weekDates = getWeekDatesTZ(tz, 0)

  const [plan, setPlan] = useState(null)
  const [dayTypes, setDayTypes] = useState({ ...DEFAULT_DAY_TYPES })
  const [traditions, setTraditions] = useState([])
  const [traditionToggles, setTraditionToggles] = useState({})
  const [savedTemplates, setSavedTemplates] = useState([])
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const [dtKeyToId, setDtKeyToId] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [dtPickerDow, setDtPickerDow] = useState(null)
  const [saveSheetOpen, setSaveSheetOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [previewingId, setPreviewingId] = useState(null)
  const [previousDayTypes, setPreviousDayTypes] = useState(null)
  const [confirmRemoveTemplate, setConfirmRemoveTemplate] = useState(false)

  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500) }

  useEffect(() => {
    if (appUser?.household_id) loadData()
  }, [appUser?.household_id])

  async function loadData() {
    setLoading(true)
    try {
      const hid = appUser.household_id
      const weekStart = getWeekStartTZ(tz, 0)

      const [planRes, tradRes, templatesRes, dayTypesRes] = await Promise.all([
        supabase.from('meal_plans').select('id, status, template_id')
          .eq('household_id', hid).eq('week_start_date', weekStart).maybeSingle(),
        supabase.from('household_traditions').select('id, name, day_of_week, tradition_type, occasion_month, occasion_date')
          .eq('household_id', hid),
        supabase.from('meal_plan_templates').select('id, name, source_plan_ids')
          .eq('household_id', hid).order('created_at', { ascending: false }),
        supabase.from('day_types').select('id, name').eq('household_id', hid),
      ])

      // Build key mappings
      const dtNameToKey = {}
      const keyToId = {}
      if (dayTypesRes.data) {
        for (const dt of dayTypesRes.data) {
          const key = dt.name === 'School Day' ? 'school' : dt.name === 'No School' ? 'no_school' : dt.name.toLowerCase()
          dtNameToKey[dt.id] = key
          keyToId[key] = dt.id
        }
      }
      setDtKeyToId(keyToId)

      // Filter traditions relevant to this week (within 14 days)
      if (tradRes.data) {
        const now = new Date()
        const weekEnd = new Date(weekDates[6])
        weekEnd.setDate(weekEnd.getDate() + 14)
        const relevant = tradRes.data.filter(t => {
          if (t.tradition_type === 'weekly') return true
          if (t.occasion_month && t.occasion_date) {
            const thisYear = now.getFullYear()
            const occDate = new Date(thisYear, t.occasion_month - 1, t.occasion_date)
            return occDate >= weekDates[0] && occDate <= weekEnd
          }
          return false
        })
        setTraditions(relevant)
        const toggles = {}
        relevant.forEach(t => { toggles[t.id] = false })
        setTraditionToggles(toggles)
      }

      if (templatesRes.data) setSavedTemplates([...templatesRes.data].sort((a, b) => a.name.localeCompare(b.name)))

      const activePlan = planRes.data
      setPlan(activePlan)

      if (activePlan) {
        // Load day types
        const { data: savedDT } = await supabase.from('meal_plan_day_types')
          .select('day_of_week, day_type_id').eq('meal_plan_id', activePlan.id)
        if (savedDT && savedDT.length > 0) {
          const restored = { ...DEFAULT_DAY_TYPES }
          savedDT.forEach(row => { const k = dtNameToKey[row.day_type_id]; if (k) restored[row.day_of_week] = k })
          setDayTypes(restored)
        }
        // Load traditions
        const { data: savedTrad } = await supabase.from('meal_plan_traditions')
          .select('tradition_id').eq('meal_plan_id', activePlan.id)
        if (savedTrad && tradRes.data) {
          const activeIds = new Set(savedTrad.map(r => r.tradition_id))
          const toggles = {}
          tradRes.data.forEach(t => { toggles[t.id] = activeIds.has(t.id) })
          setTraditionToggles(toggles)
        }
        if (activePlan.template_id) setActiveTemplateId(activePlan.template_id)
      }
    } catch (err) { console.error('[Roux] ThisWeekSettings load error:', err) }
    finally { setLoading(false) }
  }

  async function ensurePlan() {
    if (plan) return plan
    const hid = appUser.household_id
    const weekStart = getWeekStartTZ(tz, 0)
    const { data, error } = await supabase.from('meal_plans').insert({
      household_id: hid, created_by: appUser.id,
      week_start_date: weekStart, week_end_date: toLocalDateStr(weekDates[6]), status: 'draft',
    }).select('id, status').single()
    if (error) { console.error('[Roux] ensurePlan error:', error); return null }
    setPlan(data)
    return data
  }

  async function saveDayType(dowKey, typeKey) {
    setDayTypes(prev => ({ ...prev, [dowKey]: typeKey }))
    setDtPickerDow(null)
    const activePlan = await ensurePlan()
    if (!activePlan || !dtKeyToId[typeKey]) return
    await supabase.from('meal_plan_day_types').delete()
      .eq('meal_plan_id', activePlan.id).eq('day_of_week', dowKey)
    await supabase.from('meal_plan_day_types').insert({
      meal_plan_id: activePlan.id, day_of_week: dowKey, day_type_id: dtKeyToId[typeKey],
    })
  }

  async function toggleTradition(id) {
    const newVal = !traditionToggles[id]
    setTraditionToggles(prev => ({ ...prev, [id]: newVal }))
    const activePlan = await ensurePlan()
    if (!activePlan) return
    if (newVal) {
      await supabase.from('meal_plan_traditions').insert({ meal_plan_id: activePlan.id, tradition_id: id })
    } else {
      await supabase.from('meal_plan_traditions').delete()
        .eq('meal_plan_id', activePlan.id).eq('tradition_id', id)
    }
  }

  function handleTemplateTap(template) {
    // Tapping the already-applied template → offer to remove
    if (activeTemplateId === template.id && !previewingId) {
      setConfirmRemoveTemplate(true)
      return
    }
    // Undo any current preview first
    if (previewingId) {
      if (previousDayTypes) setDayTypes(previousDayTypes)
      setPreviousDayTypes(null)
      setPreviewingId(null)
    }
    // Start preview
    setPreviousDayTypes({ ...dayTypes })
    const config = template.source_plan_ids
    if (config?.day_types) setDayTypes(config.day_types)
    setPreviewingId(template.id)
  }

  function undoPreview() {
    if (previousDayTypes) setDayTypes(previousDayTypes)
    setPreviousDayTypes(null)
    setPreviewingId(null)
  }

  async function confirmApply() {
    const template = savedTemplates.find(t => t.id === previewingId)
    if (!template) return
    const activePlan = await ensurePlan()
    if (!activePlan) return
    const config = template.source_plan_ids
    if (config?.day_types) {
      await supabase.from('meal_plan_day_types').delete().eq('meal_plan_id', activePlan.id)
      const rows = DOW_KEYS.filter(dow => config.day_types[dow] && dtKeyToId[config.day_types[dow]])
        .map(dow => ({ meal_plan_id: activePlan.id, day_of_week: dow, day_type_id: dtKeyToId[config.day_types[dow]] }))
      if (rows.length > 0) await supabase.from('meal_plan_day_types').insert(rows)
    }
    if (config?.traditions) {
      const toggles = {}
      traditions.forEach(t => { toggles[t.id] = config.traditions.includes(t.id) })
      setTraditionToggles(toggles)
      await supabase.from('meal_plan_traditions').delete().eq('meal_plan_id', activePlan.id)
      const tradRows = config.traditions.map(tid => ({ meal_plan_id: activePlan.id, tradition_id: tid }))
      if (tradRows.length > 0) await supabase.from('meal_plan_traditions').insert(tradRows)
    }
    setActiveTemplateId(template.id)
    await supabase.from('meal_plans').update({ template_id: template.id }).eq('id', activePlan.id)
    setPreviewingId(null)
    setPreviousDayTypes(null)
    showToast(`Applied "${template.name}"`)
  }

  async function removeAppliedTemplate() {
    setConfirmRemoveTemplate(false)
    setActiveTemplateId(null)
    const activePlan = await ensurePlan()
    if (!activePlan) return
    await supabase.from('meal_plans').update({ template_id: null }).eq('id', activePlan.id)
    // Reset to household defaults
    const { data: pattern } = await supabase.from('household_weekly_pattern')
      .select('day_of_week, day_type_id').eq('household_id', appUser.household_id)
    if (pattern && pattern.length > 0) {
      await supabase.from('meal_plan_day_types').delete().eq('meal_plan_id', activePlan.id)
      await supabase.from('meal_plan_day_types').insert(
        pattern.map(p => ({ meal_plan_id: activePlan.id, day_of_week: p.day_of_week, day_type_id: p.day_type_id }))
      )
    }
    loadData()
    showToast('Template removed')
  }

  async function saveAsTemplate() {
    if (!templateName.trim() || savingTemplate) return
    setSavingTemplate(true)
    try {
      const activeTraditions = Object.entries(traditionToggles).filter(([,on]) => on).map(([id]) => id)
      const { data, error } = await supabase.from('meal_plan_templates').insert({
        household_id: appUser.household_id,
        name: templateName.trim(),
        source_plan_ids: { day_types: dayTypes, traditions: activeTraditions },
      }).select('id, name, source_plan_ids').single()
      if (error) throw error
      setSavedTemplates(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSaveSheetOpen(false)
      showToast('Template saved')
    } catch (err) { console.error('[Roux] saveAsTemplate error:', err) }
    finally { setSavingTemplate(false) }
  }

  async function resetToDefaults() {
    setConfirmReset(false)
    const activePlan = await ensurePlan()
    if (!activePlan) return
    // Load household defaults
    const { data: pattern } = await supabase.from('household_weekly_pattern')
      .select('day_of_week, day_type_id').eq('household_id', appUser.household_id)
    if (pattern && pattern.length > 0) {
      await supabase.from('meal_plan_day_types').delete().eq('meal_plan_id', activePlan.id)
      await supabase.from('meal_plan_day_types').insert(
        pattern.map(p => ({ meal_plan_id: activePlan.id, day_of_week: p.day_of_week, day_type_id: p.day_type_id }))
      )
    }
    setActiveTemplateId(null)
    await supabase.from('meal_plans').update({ template_id: null }).eq('id', activePlan.id)
    loadData()
    showToast('Reset to defaults')
  }

  return (
    <div style={{ background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', paddingBottom: '100px' }}>
      <TopBar leftAction={{ onClick: () => navigate('/thisweek'), icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="m15 18-6-6 6-6"/></svg>
      )}} centerContent={
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>This Week</span>
      } />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.driftwood }}>Loading...</div>
      ) : (
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ── Day Types ──────────────────────────────────────────────── */}
          <div>
            <div style={zoneLabel}>Day Types</div>
            {DAYS.map((day, i) => {
              const dowKey = DOW_KEYS[i]
              const activeOpt = DAY_TYPE_OPTIONS.find(o => o.key === dayTypes[dowKey])
              const date = weekDates[i]
              return (
                <div key={dowKey} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: i < 6 ? `1px solid rgba(200,185,160,0.20)` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', fontWeight: 500, color: C.ink, minWidth: '22px' }}>
                      {date.getDate()}
                    </span>
                    <span style={{ fontSize: '13px', color: C.driftwoodSm }}>{day}</span>
                  </div>
                  <button
                    onClick={() => setDtPickerDow(dtPickerDow === dowKey ? null : dowKey)}
                    style={{
                      padding: '3px 10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                      background: activeOpt ? `${activeOpt.color}18` : C.linen,
                      color: activeOpt?.color || C.ink,
                      fontSize: '11px', fontWeight: 500, fontFamily: "'Jost', sans-serif",
                    }}
                  >
                    {activeOpt?.label || 'Set'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* ── Traditions ─────────────────────────────────────────────── */}
          <div>
            <div style={zoneLabel}>Traditions</div>
            {traditions.length === 0 ? (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood }}>No traditions apply this week.</div>
            ) : traditions.map(t => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: `1px solid rgba(200,185,160,0.15)`,
              }}>
                <div>
                  <span style={{ fontSize: '14px', color: C.ink }}>{t.name}</span>
                  {t.day_of_week && <span style={{ fontSize: '11px', color: C.driftwoodSm, marginLeft: '8px' }}>{t.day_of_week.charAt(0).toUpperCase() + t.day_of_week.slice(1)}</span>}
                </div>
                <button onClick={() => toggleTradition(t.id)} style={{
                  width: '40px', height: '22px', borderRadius: '11px',
                  border: traditionToggles[t.id] ? 'none' : `1.5px solid ${C.linen}`,
                  background: traditionToggles[t.id] ? C.forest : C.cream,
                  cursor: 'pointer', position: 'relative', padding: 0, flexShrink: 0,
                }}>
                  <span style={{
                    position: 'absolute', top: '2px', left: traditionToggles[t.id] ? '20px' : '2px',
                    width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            ))}
          </div>

          {/* ── Templates ─────────────────────────────────────────────── */}
          <div>
            <div style={zoneLabel}>Templates</div>
            {savedTemplates.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {savedTemplates.map(t => {
                  const isApplied = activeTemplateId === t.id && !previewingId
                  const isPreviewing = previewingId === t.id
                  return (
                    <div key={t.id} onClick={() => !isPreviewing && handleTemplateTap(t)} style={{
                      padding: '12px 12px', borderRadius: '10px', minHeight: '44px',
                      border: isPreviewing ? `1.5px solid ${C.forest}` : isApplied ? `1.5px solid ${C.forest}` : `1px solid ${C.linen}`,
                      background: isPreviewing ? 'rgba(61,107,79,0.04)' : isApplied ? 'rgba(61,107,79,0.06)' : 'white',
                      cursor: isPreviewing ? 'default' : 'pointer',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontFamily: "'Jost', sans-serif", fontSize: '13px', textAlign: 'left',
                          color: isApplied || isPreviewing ? C.forest : C.ink,
                          fontWeight: isApplied || isPreviewing ? 500 : 400,
                        }}>
                          {t.name} {isApplied && '✓'}
                        </span>
                        {isPreviewing && (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={confirmApply} style={{
                              padding: '4px 12px', borderRadius: '8px', border: 'none',
                              background: C.forest, color: 'white', fontSize: '12px', fontWeight: 500,
                              fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                            }}>Apply</button>
                            <button onClick={undoPreview} style={{
                              padding: '4px 12px', borderRadius: '8px', border: 'none',
                              background: 'none', color: C.driftwood, fontSize: '12px', fontWeight: 400,
                              fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                            }}>Undo</button>
                          </div>
                        )}
                      </div>
                      {isPreviewing && (
                        <div style={{ fontSize: '11px', fontStyle: 'italic', color: C.driftwood, fontWeight: 300, marginTop: '4px' }}>
                          Previewing — not saved yet
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood, marginBottom: '4px' }}>No templates saved yet.</div>
            )}
            <button onClick={() => { setTemplateName(''); setSaveSheetOpen(true) }} style={{
              display: 'block', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', color: C.forest, fontWeight: 400, padding: '8px 0', marginTop: '4px',
              fontFamily: "'Jost', sans-serif", textAlign: 'left',
            }}>
              Save this week as a template &rarr;
            </button>
          </div>

          {/* ── Footer links ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', paddingTop: '12px' }}>
            <button onClick={() => setConfirmReset(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: C.driftwood, fontWeight: 300, fontFamily: "'Jost', sans-serif",
            }}>
              Reset to household defaults
            </button>
            <button onClick={() => navigate('/week/defaults')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: C.forest, fontWeight: 400, fontFamily: "'Jost', sans-serif",
            }}>
              Manage household defaults &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ── Day Type Picker Sheet ─────────────────────────────────────── */}
      {dtPickerDow && (
        <>
          <div onClick={() => setDtPickerDow(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '20px 22px 40px', zIndex: 201, boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '0 auto 16px' }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '14px' }}>
              {dtPickerDow.charAt(0).toUpperCase() + dtPickerDow.slice(1)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {DAY_TYPE_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => saveDayType(dtPickerDow, opt.key)} style={{
                  padding: '12px 16px', borderRadius: '10px', border: `1.5px solid ${opt.color}`,
                  background: dayTypes[dtPickerDow] === opt.key ? opt.color : 'white',
                  color: dayTypes[dtPickerDow] === opt.key ? 'white' : opt.color,
                  fontSize: '14px', fontWeight: 500, fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Save Template Sheet ───────────────────────────────────────── */}
      {saveSheetOpen && (
        <>
          <div onClick={() => setSaveSheetOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '20px 22px 40px', zIndex: 201,
          }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '14px' }}>Save as template</div>
            <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name"
              autoFocus style={{
                width: '100%', padding: '12px 14px', fontSize: '14px', fontFamily: "'Jost', sans-serif",
                border: `1.5px solid ${C.linen}`, borderRadius: '10px', outline: 'none', color: C.ink, boxSizing: 'border-box', marginBottom: '12px',
              }} />
            <button onClick={saveAsTemplate} disabled={!templateName.trim() || savingTemplate} style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              background: templateName.trim() ? C.forest : C.linen, color: templateName.trim() ? 'white' : C.driftwood,
              fontSize: '14px', fontWeight: 500, fontFamily: "'Jost', sans-serif", cursor: templateName.trim() ? 'pointer' : 'default',
            }}>
              {savingTemplate ? 'Saving...' : 'Save template'}
            </button>
          </div>
        </>
      )}

      {/* ── Reset Confirmation ────────────────────────────────────────── */}
      {confirmReset && (
        <>
          <div onClick={() => setConfirmReset(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '20px 22px 40px', zIndex: 201,
          }}>
            <div style={{ fontSize: '15px', color: C.ink, fontWeight: 400, marginBottom: '14px' }}>
              Reset all day types to your household defaults and clear the template?
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={resetToDefaults} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: C.forest, color: 'white', border: 'none', fontSize: '13px', fontWeight: 500, fontFamily: "'Jost', sans-serif", cursor: 'pointer' }}>Reset</button>
              <button onClick={() => setConfirmReset(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'none', color: C.driftwood, border: `1px solid ${C.linen}`, fontSize: '13px', fontWeight: 400, fontFamily: "'Jost', sans-serif", cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── Remove Template Confirmation ─────────────────────────────── */}
      {confirmRemoveTemplate && (
        <>
          <div onClick={() => setConfirmRemoveTemplate(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '20px 22px 40px', zIndex: 201,
          }}>
            <div style={{ fontSize: '15px', color: C.ink, fontWeight: 400, marginBottom: '14px' }}>
              Remove {savedTemplates.find(t => t.id === activeTemplateId)?.name || 'template'} and reset to defaults?
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={removeAppliedTemplate} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: C.forest, color: 'white', border: 'none', fontSize: '13px', fontWeight: 500, fontFamily: "'Jost', sans-serif", cursor: 'pointer' }}>Yes</button>
              <button onClick={() => setConfirmRemoveTemplate(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'none', color: C.driftwood, border: `1px solid ${C.linen}`, fontSize: '13px', fontWeight: 400, fontFamily: "'Jost', sans-serif", cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: C.forest, color: 'white', padding: '10px 22px', borderRadius: '10px',
          fontSize: '14px', fontWeight: 500, zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          opacity: 0, animation: 'fadeUp 0.3s ease forwards',
        }}>
          {toastMsg}
        </div>
      )}

      <BottomNav activeTab="week" />
    </div>
  )
}
