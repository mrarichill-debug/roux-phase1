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
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'
import { color, alpha, elevation } from '../styles/tokens'

// ── Design tokens ──────────────────────────────────────────────────────────────
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DOW_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const DAY_TYPE_OPTIONS = [
  { key: 'school',    label: 'School',    color: '#5B8DD9' },
  { key: 'weekend',   label: 'Weekend',   color: color.sage },
  { key: 'no_school', label: 'No School', color: '#D4874A' },
  { key: 'summer',    label: 'Summer',    color: color.honey },
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
  color: color.inkSoft,
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
  const [activeTemplateId, setActiveTemplateId] = useState(null)
  const [dtKeyToId, setDtKeyToId] = useState({})
  const [defaultPattern, setDefaultPattern] = useState({ ...DEFAULT_DAY_TYPES })
  const [savingDefault, setSavingDefault] = useState(false)
  const [defaultPatternDirty, setDefaultPatternDirty] = useState(false)
  const [prevDayTypes, setPrevDayTypes] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [applyConfirmId, setApplyConfirmId] = useState(null)
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

      const [planRes, tradRes, templatesRes, dayTypesRes] = await Promise.all([
        supabase.from('meal_plans')
          .select('id, status, week_start_date, week_end_date, template_id')
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
        supabase.from('day_types')
          .select('id, name')
          .eq('household_id', hid),
      ])

      if (tradRes.data) {
        setTraditions(tradRes.data)
        // Default all traditions to on
        const toggles = {}
        tradRes.data.forEach(t => { toggles[t.id] = true })
        setTraditionToggles(toggles)
      }
      if (templatesRes.data) setSavedTemplates(templatesRes.data)

      // Build day type name→key mapping
      const dtNameToKey = {}
      const dtKeyToId = {}
      if (dayTypesRes.data) {
        for (const dt of dayTypesRes.data) {
          const key = dt.name === 'School Day' ? 'school' : dt.name === 'No School' ? 'no_school' : dt.name.toLowerCase()
          dtNameToKey[dt.id] = key
          dtKeyToId[key] = dt.id
        }
      }

      const activePlan = planRes.data
      setPlan(activePlan)

      // Restore day types from meal_plan_day_types table
      if (activePlan) {
        const { data: savedDT } = await supabase
          .from('meal_plan_day_types')
          .select('day_of_week, day_type_id')
          .eq('meal_plan_id', activePlan.id)
        if (savedDT && savedDT.length > 0) {
          const restored = { ...DEFAULT_DAY_TYPES }
          savedDT.forEach(row => {
            const key = dtNameToKey[row.day_type_id]
            if (key) restored[row.day_of_week] = key
          })
          setDayTypes(restored)
        }

        // Restore traditions from meal_plan_traditions table
        const { data: savedTrad } = await supabase
          .from('meal_plan_traditions')
          .select('tradition_id')
          .eq('meal_plan_id', activePlan.id)
        if (savedTrad && tradRes.data) {
          const activeIds = new Set(savedTrad.map(r => r.tradition_id))
          const toggles = {}
          tradRes.data.forEach(t => { toggles[t.id] = activeIds.has(t.id) })
          setTraditionToggles(toggles)
        }
      }

      setDtKeyToId(dtKeyToId)

      // Load household default weekly pattern
      const { data: patternRows } = await supabase
        .from('household_weekly_pattern')
        .select('day_of_week, day_type_id')
        .eq('household_id', hid)
      if (patternRows && patternRows.length > 0) {
        const pat = { ...DEFAULT_DAY_TYPES }
        patternRows.forEach(r => {
          const key = dtNameToKey[r.day_type_id]
          if (key) pat[r.day_of_week] = key
        })
        setDefaultPattern(pat)
      }

      // Restore active template from template_id column
      if (activePlan?.template_id) setActiveTemplateId(activePlan.template_id)
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

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 2500)
  }

  function handleBack() {
    if (hasChanges) {
      setConfirmLeaveOpen(true)
    } else {
      navigate('/plan')
    }
  }

  async function saveDefaultPattern() {
    if (savingDefault) return
    setSavingDefault(true)
    try {
      const hid = appUser.household_id
      const DOW_ALL = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
      await supabase.from('household_weekly_pattern').delete().eq('household_id', hid)
      const rows = DOW_ALL
        .filter(dow => defaultPattern[dow] && dtKeyToId[defaultPattern[dow]])
        .map(dow => ({ household_id: hid, day_of_week: dow, day_type_id: dtKeyToId[defaultPattern[dow]] }))
      if (rows.length > 0) {
        const { error } = await supabase.from('household_weekly_pattern').insert(rows)
        if (error) throw error
      }
      setDefaultPatternDirty(false)
      showToast('Default pattern saved')
    } catch (err) {
      console.error('[Roux] saveDefaultPattern error:', err)
    } finally {
      setSavingDefault(false)
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

      // Save template_id to meal_plans
      const { error } = await supabase.from('meal_plans')
        .update({ template_id: activeTemplateId || null })
        .eq('id', activePlan.id)
      if (error) throw error

      // Upsert day types to meal_plan_day_types
      const DOW_ALL = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
      const dtRows = DOW_ALL
        .filter(dow => dayTypes[dow] && dtKeyToId[dayTypes[dow]])
        .map(dow => ({
          meal_plan_id: activePlan.id,
          day_of_week: dow,
          day_type_id: dtKeyToId[dayTypes[dow]],
        }))
      if (dtRows.length > 0) {
        await supabase.from('meal_plan_day_types').delete().eq('meal_plan_id', activePlan.id)
        const { error: dtErr } = await supabase.from('meal_plan_day_types').insert(dtRows)
        if (dtErr) console.error('[Roux] save day types error:', dtErr)
      }

      // Save active traditions to meal_plan_traditions
      const activeTraditions = Object.entries(traditionToggles)
        .filter(([, on]) => on)
        .map(([id]) => id)
      await supabase.from('meal_plan_traditions').delete().eq('meal_plan_id', activePlan.id)
      if (activeTraditions.length > 0) {
        const tradRows = activeTraditions.map(tid => ({ meal_plan_id: activePlan.id, tradition_id: tid }))
        const { error: tradErr } = await supabase.from('meal_plan_traditions').insert(tradRows)
        if (tradErr) console.error('[Roux] save traditions error:', tradErr)
      }

      setHasChanges(false)
      showToast('Week settings saved')
      setTimeout(() => navigate('/plan'), 800)
    } catch (err) {
      console.error('[Roux] saveWeekSettings error:', err)
    } finally {
      setSavingWeek(false)
    }
  }

  function isDefaultDayTypes() {
    return DOW_KEYS.every((dow, i) => dayTypes[dow] === DEFAULT_DAY_TYPES[dow])
  }

  function toggleTemplate(templateId) {
    if (activeTemplateId === templateId) {
      // Turning off — revert to previous manual selections
      if (prevDayTypes) setDayTypes(prevDayTypes)
      setActiveTemplateId(null)
      setPrevDayTypes(null)
      setHasChanges(true)
      return
    }
    // Turning on — check if we need confirmation
    if (isDefaultDayTypes()) {
      applyTemplateById(templateId)
    } else {
      setApplyConfirmId(templateId)
    }
  }

  function applyTemplateById(templateId) {
    const template = savedTemplates.find(t => t.id === templateId)
    if (!template) return
    setPrevDayTypes({ ...dayTypes })
    setActiveTemplateId(templateId)
    const config = template.source_plan_ids
    if (config?.day_types) setDayTypes(config.day_types)
    if (config?.traditions) {
      const toggles = {}
      traditions.forEach(t => { toggles[t.id] = config.traditions.includes(t.id) })
      setTraditionToggles(toggles)
    }
    setHasChanges(true)
    setApplyConfirmId(null)
  }

  async function deleteTemplate(templateId) {
    try {
      await supabase.from('meal_plan_templates').delete().eq('id', templateId)
      setSavedTemplates(prev => prev.filter(t => t.id !== templateId))
      if (activeTemplateId === templateId) {
        if (prevDayTypes) setDayTypes(prevDayTypes)
        setActiveTemplateId(null)
        setPrevDayTypes(null)
      }
      setDeleteConfirmId(null)
      showToast('Template removed')
    } catch (err) {
      console.error('[Roux] deleteTemplate error:', err)
    }
  }

  function setDayType(dowKey, type) {
    setDayTypes(prev => ({ ...prev, [dowKey]: type }))
    // Manual change breaks any active template
    if (activeTemplateId) { setActiveTemplateId(null); setPrevDayTypes(null) }
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
      background: color.paper,
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
                  background: color.honey, border: `1.5px solid ${color.forest}`,
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
          color: color.ink,
          margin: 0,
        }}>
          Set Up This Week
        </h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: color.inkSoft, fontSize: '14px' }}>
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
                  <span style={{ fontSize: '14px', fontWeight: 400, color: color.ink, minWidth: '80px' }}>
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

          {/* ── Section 2: Default Week Pattern ──────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.10s both' }}>
            <div style={sectionHeaderStyle}>Default Week Pattern</div>
            <div style={{
              fontSize: '11px', color: color.inkSoft, fontWeight: 300, fontStyle: 'italic',
              marginBottom: '12px',
            }}>
              This is your default — changes apply to all future weeks.
            </div>
            {DAYS.map((day, i) => {
              const dowKey = DOW_KEYS[i]
              const activeType = defaultPattern[dowKey]
              return (
                <div key={`def-${dowKey}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: i < 6 ? '1px solid rgba(200,185,160,0.20)' : 'none',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 400, color: color.ink, minWidth: '80px' }}>
                    {day}
                  </span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {DAY_TYPE_OPTIONS.map(opt => {
                      const isActive = activeType === opt.key
                      return (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setDefaultPattern(prev => ({ ...prev, [dowKey]: opt.key }))
                            setDefaultPatternDirty(true)
                          }}
                          style={{
                            padding: '3px 8px', fontSize: '10px',
                            fontFamily: "'Jost', sans-serif", fontWeight: isActive ? 500 : 400,
                            borderRadius: '12px', cursor: 'pointer',
                            transition: 'all 0.15s', whiteSpace: 'nowrap',
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
            {defaultPatternDirty && (
              <button
                onClick={saveDefaultPattern}
                disabled={savingDefault}
                style={{
                  marginTop: '12px', width: '100%', padding: '10px',
                  borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: color.forest, color: 'white',
                  fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 500,
                }}
              >
                {savingDefault ? 'Saving...' : 'Save default pattern'}
              </button>
            )}
          </div>

          {/* ── Section 3: Traditions ─────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.12s both' }}>
            <div style={sectionHeaderStyle}>Traditions</div>
            {traditions.length === 0 ? (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: color.inkSoft, marginBottom: '12px' }}>
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
                    <span style={{ fontSize: '14px', color: color.ink }}>{t.name}</span>
                    {t.day_of_week && (
                      <span style={{ fontSize: '11px', color: color.inkSoft, marginLeft: '8px' }}>
                        {t.day_of_week.charAt(0).toUpperCase() + t.day_of_week.slice(1)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleTradition(t.id)}
                    style={{
                      width: '44px', height: '24px',
                      borderRadius: '12px',
                      border: traditionToggles[t.id] ? 'none' : `1.5px solid ${color.rule}`,
                      background: traditionToggles[t.id] ? color.forest : color.paper,
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
                color: color.forest, background: 'transparent',
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
            {savedTemplates.length === 0 ? (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: color.inkSoft, marginBottom: '12px' }}>
                No templates saved yet.
              </div>
            ) : (
              savedTemplates.map(t => (
                <div key={t.id} style={{ position: 'relative' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: `1px solid rgba(200,185,160,0.2)`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '14px', color: color.ink }}>{t.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      {/* Delete */}
                      <button
                        onClick={() => setDeleteConfirmId(t.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'rgba(160,48,48,0.5)', padding: '4px', display: 'flex',
                        }}
                        aria-label="Delete template"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
                          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        </svg>
                      </button>
                      {/* Toggle */}
                      <button
                        onClick={() => toggleTemplate(t.id)}
                        style={{
                          width: '44px', height: '24px', borderRadius: '12px',
                          border: activeTemplateId === t.id ? 'none' : `1.5px solid ${color.rule}`,
                          background: activeTemplateId === t.id ? color.forest : color.paper,
                          cursor: 'pointer', position: 'relative',
                          transition: 'background 0.25s, border-color 0.25s',
                          padding: 0, flexShrink: 0,
                        }}
                        aria-label={`Apply ${t.name}`}
                      >
                        <span style={{
                          position: 'absolute', top: '2px',
                          left: activeTemplateId === t.id ? '22px' : '2px',
                          width: '20px', height: '20px', borderRadius: '50%',
                          background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                          transition: 'left 0.25s',
                        }} />
                      </button>
                    </div>
                  </div>

                  {/* Delete confirmation */}
                  {deleteConfirmId === t.id && (
                    <div style={{
                      padding: '10px 0', display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: '8px',
                    }}>
                      <span style={{ fontSize: '12px', color: color.rust }}>Remove this template?</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          style={{
                            fontSize: '11px', fontFamily: "'Jost', sans-serif", fontWeight: 500,
                            color: color.inkSoft, background: 'none', border: `1px solid ${color.rule}`,
                            borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteTemplate(t.id)}
                          style={{
                            fontSize: '11px', fontFamily: "'Jost', sans-serif", fontWeight: 500,
                            color: 'white', background: color.rust, border: 'none',
                            borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            <button
              onClick={openSaveSheet}
              style={{
                width: '100%', padding: '12px', marginTop: '8px',
                fontSize: '13px', fontFamily: "'Jost', sans-serif", fontWeight: 500,
                color: color.forest, background: 'transparent',
                border: `1.5px dashed rgba(61,107,79,0.4)`, borderRadius: '10px',
                cursor: 'pointer', textAlign: 'center', transition: 'background 0.15s',
              }}
            >
              + Save this week as template
            </button>
          </div>
          {/* ── Save Week Settings CTA ──────────────────────────────────── */}
          <div style={{ padding: '6px 22px 0', animation: 'fadeUp 0.35s ease 0.24s both' }}>
            <button
              onClick={saveWeekSettings}
              disabled={savingWeek}
              style={{
                width: '100%', background: color.forest, color: 'white', border: 'none',
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
          background: color.forest, color: 'white', padding: '10px 20px',
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: color.ink, marginBottom: '8px' }}>
              Unsaved changes
            </div>
            <div style={{ fontSize: '14px', color: color.inkSoft, fontWeight: 300, lineHeight: 1.5, marginBottom: '20px' }}>
              You have unsaved changes. Save before leaving?
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setConfirmLeaveOpen(false); navigate('/plan') }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: `1px solid ${color.rule}`, background: 'none',
                  fontFamily: "'Jost', sans-serif", fontSize: '13px',
                  fontWeight: 500, color: color.inkSoft, cursor: 'pointer',
                }}
              >
                Discard
              </button>
              <button
                onClick={() => { setConfirmLeaveOpen(false); saveWeekSettings() }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: 'none', background: color.forest, color: 'white',
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
      <BottomNav activeTab="plan" />

      {/* ── Add Tradition Sheet ────────────────────────────────────────── */}
      {addTradSheetOpen && (
      <div style={{ position: 'fixed', inset: 0, background: color.paper, zIndex: 200, display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto' }}>
        <div style={{ background: color.forest, padding: '10px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setAddTradSheetOpen(false)} style={{ background: 'rgba(250,247,242,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <span style={{ fontFamily: "'Slabo 27px', serif", fontSize: 18, color: 'rgba(250,247,242,0.95)' }}>Add a tradition</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', paddingBottom: 120 }}>
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: color.inkSoft, marginBottom: '6px' }}>Name</div>
          <input type="text" value={newTradName} onChange={e => setNewTradName(e.target.value)}
            placeholder="e.g. Taco Tuesday, Pizza Friday" autoFocus
            style={{ width: '100%', padding: '12px 14px', border: `1px solid ${color.rule}`, borderRadius: '10px', fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: color.ink, outline: 'none', background: color.paper, boxSizing: 'border-box', marginBottom: '16px' }} />
          <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: color.inkSoft, marginBottom: '6px' }}>Day</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {DOW_KEYS.map((dow, i) => (
              <button key={dow} onClick={() => setNewTradDay(dow)} style={{
                padding: '6px 12px', fontSize: '12px', fontFamily: "'Jost', sans-serif", fontWeight: newTradDay === dow ? 500 : 400,
                borderRadius: '14px', cursor: 'pointer', border: `1.5px solid ${newTradDay === dow ? color.forest : color.rule}`,
                background: newTradDay === dow ? color.forest : 'transparent', color: newTradDay === dow ? 'white' : color.ink, transition: 'all 0.15s',
              }}>{DAYS[i].slice(0, 3)}</button>
            ))}
          </div>
          <button onClick={saveTradition} disabled={!newTradName.trim() || savingTrad} style={{
            width: '100%', background: newTradName.trim() ? color.forest : color.rule, color: newTradName.trim() ? 'white' : color.inkSoft,
            border: 'none', borderRadius: '12px', padding: '14px', fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
            cursor: newTradName.trim() ? 'pointer' : 'default', marginBottom: '8px',
          }}>{savingTrad ? 'Saving…' : 'Save tradition'}</button>
          <button onClick={() => setAddTradSheetOpen(false)} style={{
            width: '100%', background: 'none', border: 'none', color: color.inkSoft, fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300, padding: '10px', cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </div>
      )}

      {/* ── Save Template — full-page overlay (keyboard safe) ──── */}
      {saveSheetOpen && (
      <div style={{ position: 'fixed', inset: 0, background: color.paper, zIndex: 200, display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto' }}>
        <div style={{ background: color.forest, padding: '10px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setSaveSheetOpen(false)} style={{ background: 'rgba(250,247,242,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <span style={{ fontFamily: "'Slabo 27px', serif", fontSize: 18, color: 'rgba(250,247,242,0.95)' }}>Name this template</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', paddingBottom: 120 }}>
          <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
            onFocus={e => e.target.select()} autoFocus onKeyDown={e => { if (e.key === 'Enter') saveTemplate() }}
            style={{ width: '100%', padding: '14px 16px', border: `1px solid ${color.rule}`, borderRadius: '12px', fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: color.ink, outline: 'none', background: color.paper, boxSizing: 'border-box', marginBottom: '16px' }} />
          <button onClick={saveTemplate} disabled={!templateName.trim() || saving} style={{
            width: '100%', background: templateName.trim() ? color.forest : color.rule, color: templateName.trim() ? 'white' : color.inkSoft,
            border: 'none', borderRadius: '12px', padding: '14px', fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
            cursor: templateName.trim() ? 'pointer' : 'default', marginBottom: '8px',
          }}>{saving ? 'Saving…' : 'Save template'}</button>
          <button onClick={() => setSaveSheetOpen(false)} style={{
            width: '100%', background: 'none', border: 'none', color: color.inkSoft, fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300, padding: '10px', cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </div>
      )}

      {/* ── Apply Template Confirmation Sheet ───────────────────────────── */}
      <BottomSheet isOpen={!!applyConfirmId} onClose={() => setApplyConfirmId(null)} title="Apply this template?">
        <div style={{ padding: '6px 22px 40px' }}>
          <div style={{ fontSize: '14px', color: color.inkSoft, fontWeight: 300, lineHeight: 1.6, marginBottom: '22px' }}>
            {savedTemplates.find(t => t.id === applyConfirmId)?.name} will update your day types for this week. You can still adjust individual days after applying.
          </div>
          <button
            onClick={() => applyTemplateById(applyConfirmId)}
            style={{
              width: '100%', background: color.forest, color: 'white', border: 'none',
              borderRadius: '12px', padding: '14px',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
              cursor: 'pointer', marginBottom: '8px',
            }}
          >
            Apply
          </button>
          <button
            onClick={() => setApplyConfirmId(null)}
            style={{
              width: '100%', background: 'none', border: 'none', color: color.inkSoft,
              fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300,
              padding: '10px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
