/**
 * HouseholdDefaults.jsx — Screen 2: Household Defaults.
 * Default weekly pattern, manage day types, manage templates.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E', linen: '#E8E0D0',
  honey: '#C49A3C', red: '#A03030',
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

export default function HouseholdDefaults({ appUser }) {
  const navigate = useNavigate()

  const [defaultPattern, setDefaultPattern] = useState({ ...DEFAULT_DAY_TYPES })
  const [dtKeyToId, setDtKeyToId] = useState({})
  const [dayTypeRecords, setDayTypeRecords] = useState([])
  const [savedTemplates, setSavedTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [dtPickerDow, setDtPickerDow] = useState(null)
  const [addDtOpen, setAddDtOpen] = useState(false)
  const [newDtName, setNewDtName] = useState('')
  const [newDtColor, setNewDtColor] = useState('#7A8C6E')
  const [savingDt, setSavingDt] = useState(false)

  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500) }

  useEffect(() => {
    if (appUser?.household_id) loadData()
  }, [appUser?.household_id])

  async function loadData() {
    setLoading(true)
    try {
      const hid = appUser.household_id

      const [dayTypesRes, patternRes, templatesRes] = await Promise.all([
        supabase.from('day_types').select('id, name, color').eq('household_id', hid),
        supabase.from('household_weekly_pattern').select('day_of_week, day_type_id').eq('household_id', hid),
        supabase.from('meal_plan_templates').select('id, name').eq('household_id', hid).order('created_at', { ascending: false }),
      ])

      const dtNameToKey = {}
      const keyToId = {}
      if (dayTypesRes.data) {
        setDayTypeRecords([...dayTypesRes.data].sort((a, b) => a.name.localeCompare(b.name)))
        for (const dt of dayTypesRes.data) {
          const key = dt.name === 'School Day' ? 'school' : dt.name === 'No School' ? 'no_school' : dt.name.toLowerCase()
          dtNameToKey[dt.id] = key
          keyToId[key] = dt.id
        }
      }
      setDtKeyToId(keyToId)

      if (patternRes.data && patternRes.data.length > 0) {
        const pat = { ...DEFAULT_DAY_TYPES }
        patternRes.data.forEach(r => { const k = dtNameToKey[r.day_type_id]; if (k) pat[r.day_of_week] = k })
        setDefaultPattern(pat)
      }

      if (templatesRes.data) setSavedTemplates([...templatesRes.data].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) { console.error('[Roux] HouseholdDefaults load error:', err) }
    finally { setLoading(false) }
  }

  async function savePatternDay(dowKey, typeKey) {
    setDefaultPattern(prev => ({ ...prev, [dowKey]: typeKey }))
    setDtPickerDow(null)
    const hid = appUser.household_id
    const dtId = dtKeyToId[typeKey]
    if (!dtId) return
    await supabase.from('household_weekly_pattern').delete().eq('household_id', hid).eq('day_of_week', dowKey)
    await supabase.from('household_weekly_pattern').insert({ household_id: hid, day_of_week: dowKey, day_type_id: dtId })
    showToast('Default updated')
  }

  async function saveNewDayType() {
    if (!newDtName.trim() || savingDt) return
    setSavingDt(true)
    try {
      const { data, error } = await supabase.from('day_types').insert({
        household_id: appUser.household_id,
        name: newDtName.trim(),
        color: newDtColor,
      }).select('id, name, color').single()
      if (error) throw error
      setDayTypeRecords(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      // Update key mapping
      const key = data.name.toLowerCase().replace(/\s+/g, '_')
      setDtKeyToId(prev => ({ ...prev, [key]: data.id }))
      setAddDtOpen(false)
      setNewDtName('')
      showToast('Day type added')
    } catch (err) { console.error('[Roux] saveNewDayType error:', err) }
    finally { setSavingDt(false) }
  }

  async function deleteTemplate(id) {
    await supabase.from('meal_plan_templates').delete().eq('id', id)
    setSavedTemplates(prev => prev.filter(t => t.id !== id))
    setDeleteConfirmId(null)
    showToast('Template removed')
  }

  return (
    <div style={{ background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', paddingBottom: '100px' }}>
      <TopBar leftAction={{ onClick: () => navigate('/week-settings'), icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="m15 18-6-6 6-6"/></svg>
      )}} centerContent={
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Household Defaults</span>
      } />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.driftwood }}>Loading...</div>
      ) : (
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ fontSize: '12px', fontStyle: 'italic', color: C.driftwood, fontWeight: 300 }}>
            These settings apply to all future weeks.
          </div>

          {/* ── Default Week ──────────────────────────────────────────── */}
          <div>
            <div style={zoneLabel}>Default Week</div>
            {DAYS.map((day, i) => {
              const dowKey = DOW_KEYS[i]
              const activeOpt = DAY_TYPE_OPTIONS.find(o => o.key === defaultPattern[dowKey])
              return (
                <div key={dowKey} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: i < 6 ? `1px solid rgba(200,185,160,0.20)` : 'none',
                }}>
                  <span style={{ fontSize: '13px', color: C.ink }}>{day}</span>
                  <button onClick={() => setDtPickerDow(dtPickerDow === dowKey ? null : dowKey)} style={{
                    padding: '3px 10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: activeOpt ? `${activeOpt.color}18` : C.linen,
                    color: activeOpt?.color || C.ink,
                    fontSize: '11px', fontWeight: 500, fontFamily: "'Jost', sans-serif",
                  }}>
                    {activeOpt?.label || 'Set'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* ── Day Types ─────────────────────────────────────────────── */}
          <div>
            <div style={zoneLabel}>Day Types</div>
            {dayTypeRecords.map(dt => (
              <div key={dt.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: `1px solid rgba(200,185,160,0.15)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: dt.color || C.driftwood, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '14px', color: C.ink }}>{dt.name}</span>
                </div>
              </div>
            ))}
            <button onClick={() => { setNewDtName(''); setNewDtColor('#7A8C6E'); setAddDtOpen(true) }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', color: C.forest, fontWeight: 400, padding: '10px 0',
              fontFamily: "'Jost', sans-serif", textAlign: 'left',
            }}>
              + Add a day type
            </button>
          </div>

          {/* ── Templates ─────────────────────────────────────────────── */}
          <div>
            <div style={zoneLabel}>Templates</div>
            {savedTemplates.length === 0 ? (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood }}>No templates saved yet.</div>
            ) : savedTemplates.map(t => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: `1px solid rgba(200,185,160,0.15)`,
              }}>
                <span style={{ fontSize: '14px', color: C.ink }}>{t.name}</span>
                {deleteConfirmId === t.id ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => deleteTemplate(t.id)} style={{ fontSize: '11px', color: C.red, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 500 }}>Remove</button>
                    <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: '11px', color: C.driftwood, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirmId(t.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: C.driftwood, padding: '4px',
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
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
            padding: '20px 22px 40px', zIndex: 201,
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '0 auto 16px' }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '14px' }}>
              {dtPickerDow.charAt(0).toUpperCase() + dtPickerDow.slice(1)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {DAY_TYPE_OPTIONS.map(opt => (
                <button key={opt.key} onClick={() => savePatternDay(dtPickerDow, opt.key)} style={{
                  padding: '12px 16px', borderRadius: '10px', border: `1.5px solid ${opt.color}`,
                  background: defaultPattern[dtPickerDow] === opt.key ? opt.color : 'white',
                  color: defaultPattern[dtPickerDow] === opt.key ? 'white' : opt.color,
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

      {/* ── Add Day Type Sheet ──────────────────────────────────────── */}
      {addDtOpen && (
        <>
          <div onClick={() => setAddDtOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '20px 22px 40px', zIndex: 201,
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '0 auto 16px' }} />
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: C.ink, marginBottom: '14px' }}>
              New day type
            </div>
            <input type="text" value={newDtName} onChange={e => setNewDtName(e.target.value)} placeholder="Day type name"
              autoFocus style={{
                width: '100%', padding: '12px 14px', fontSize: '14px', fontFamily: "'Jost', sans-serif",
                border: `1.5px solid ${C.linen}`, borderRadius: '10px', outline: 'none', color: C.ink,
                boxSizing: 'border-box', marginBottom: '12px',
              }} />
            <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300, marginBottom: '8px' }}>Color</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {['#5B8DD9','#7A8C6E','#D4874A','#C49A3C','#8B6F52','#A03030','#3D6B4F'].map(c => (
                <button key={c} onClick={() => setNewDtColor(c)} style={{
                  width: '28px', height: '28px', borderRadius: '50%', border: newDtColor === c ? '2px solid ' + C.ink : '2px solid transparent',
                  background: c, cursor: 'pointer',
                }} />
              ))}
            </div>
            <button onClick={saveNewDayType} disabled={!newDtName.trim() || savingDt} style={{
              width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
              background: newDtName.trim() ? C.forest : C.linen, color: newDtName.trim() ? 'white' : C.driftwood,
              fontSize: '14px', fontWeight: 500, fontFamily: "'Jost', sans-serif", cursor: newDtName.trim() ? 'pointer' : 'default',
            }}>
              {savingDt ? 'Saving...' : 'Add day type'}
            </button>
          </div>
        </>
      )}

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
