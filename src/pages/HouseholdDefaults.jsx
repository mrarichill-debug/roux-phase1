/**
 * HouseholdDefaults.jsx — Screen 2: Household Defaults.
 * Default weekly pattern, manage day types, manage templates.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import AddDayTypeSheet from '../components/AddDayTypeSheet'

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

const sectionHeader = {
  fontSize: '10px', fontWeight: 500, letterSpacing: '2px',
  textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '12px',
}

const cardStyle = {
  background: 'white', border: '1px solid rgba(200,185,160,0.55)',
  borderRadius: '16px', padding: '18px', margin: '0 22px 14px',
}

const rowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 0', borderBottom: '1px solid rgba(200,185,160,0.2)',
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

  // Tags
  const [tagDefs, setTagDefs] = useState([])
  const [editingTagId, setEditingTagId] = useState(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [deleteTagConfirm, setDeleteTagConfirm] = useState(null)

  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500) }

  useEffect(() => {
    if (appUser?.household_id) loadData()
  }, [appUser?.household_id])

  async function loadData() {
    setLoading(true)
    try {
      const hid = appUser.household_id

      const [dayTypesRes, patternRes, templatesRes, tagDefsRes] = await Promise.all([
        supabase.from('day_types').select('id, name, color').eq('household_id', hid),
        supabase.from('household_weekly_pattern').select('day_of_week, day_type_id').eq('household_id', hid),
        supabase.from('meal_plan_templates').select('id, name').eq('household_id', hid).order('created_at', { ascending: false }),
        supabase.from('recipe_tag_definitions').select('*').eq('household_id', hid).order('sort_order'),
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
      setTagDefs(tagDefsRes.data || [])
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

  function handleDayTypeSaved(dt) {
    setDayTypeRecords(prev => [...prev, dt].sort((a, b) => a.name.localeCompare(b.name)))
    const key = dt.name.toLowerCase().replace(/\s+/g, '_')
    setDtKeyToId(prev => ({ ...prev, [key]: dt.id }))
    showToast('Day type added')
  }

  async function deleteTemplate(id) {
    await supabase.from('meal_plan_templates').delete().eq('id', id)
    setSavedTemplates(prev => prev.filter(t => t.id !== id))
    setDeleteConfirmId(null)
    showToast('Template removed')
  }

  async function renameTag(tagId) {
    if (!editingTagName.trim()) return
    await supabase.from('recipe_tag_definitions').update({ name: editingTagName.trim() }).eq('id', tagId)
    setTagDefs(prev => prev.map(t => t.id === tagId ? { ...t, name: editingTagName.trim() } : t))
    setEditingTagId(null)
    setEditingTagName('')
    showToast('Tag renamed')
  }

  async function deleteTag(tagId) {
    await supabase.from('recipe_tag_definitions').delete().eq('id', tagId)
    setTagDefs(prev => prev.filter(t => t.id !== tagId))
    setDeleteTagConfirm(null)
    showToast('Tag removed')
  }

  return (
    <div style={{ background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', paddingBottom: '100px' }}>
      <TopBar leftAction={{ onClick: () => navigate('/profile'), icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}><path d="m15 18-6-6 6-6"/></svg>
      )}} centerContent={
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Household Defaults</span>
      } />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.driftwood }}>Loading...</div>
      ) : (
        <div style={{ padding: '18px 0' }}>
          <div style={{ fontSize: '12px', fontStyle: 'italic', color: C.driftwood, fontWeight: 300, padding: '0 22px 14px' }}>
            These settings apply to all future weeks.
          </div>

          {/* ── Default Week ──────────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease both' }}>
            <div style={sectionHeader}>Default Week</div>
            {DAYS.map((day, i) => {
              const dowKey = DOW_KEYS[i]
              const activeOpt = DAY_TYPE_OPTIONS.find(o => o.key === defaultPattern[dowKey])
              return (
                <div key={dowKey} style={{ ...rowStyle, borderBottom: i < 6 ? rowStyle.borderBottom : 'none' }}>
                  <span style={{ fontSize: '14px', color: C.ink }}>{day}</span>
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
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.04s both' }}>
            <div style={sectionHeader}>Day Types</div>
            {dayTypeRecords.map(dt => (
              <div key={dt.id} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: dt.color || C.driftwood, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '14px', color: C.ink }}>{dt.name}</span>
                </div>
              </div>
            ))}
            <button onClick={() => setAddDtOpen(true)} style={{
              width: '100%', padding: '12px', marginTop: '8px', fontSize: '13px',
              fontFamily: "'Jost', sans-serif", fontWeight: 500, color: C.forest,
              background: 'transparent', border: `1.5px dashed rgba(61,107,79,0.4)`,
              borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
            }}>
              + Add a day type
            </button>
          </div>

          {/* ── Templates ─────────────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.08s both' }}>
            <div style={sectionHeader}>Templates</div>
            {savedTemplates.length === 0 ? (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood }}>No templates saved yet.</div>
            ) : savedTemplates.map(t => (
              <div key={t.id} style={rowStyle}>
                <span style={{ fontSize: '14px', color: C.ink }}>{t.name}</span>
                {deleteConfirmId === t.id ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button onClick={() => deleteTemplate(t.id)} style={{ fontSize: '11px', color: 'white', background: C.red, border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 500 }}>Remove</button>
                    <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: '11px', color: C.driftwoodSm, background: 'none', border: `1px solid ${C.linen}`, borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirmId(t.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(140,123,107,0.55)', padding: '3px', display: 'flex',
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* ── Recipe & Meal Tags ──────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.12s both' }}>
            <div style={sectionHeader}>Recipe & Meal Tags</div>

            {/* Default tags — locked */}
            {tagDefs.filter(t => t.is_default).map(tag => (
              <div key={tag.id} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, flexShrink: 0, opacity: 0.5 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span style={{ fontSize: '14px', color: C.ink }}>{tag.name}</span>
                </div>
                <span style={{ fontSize: '10px', color: C.driftwood, fontWeight: 300 }}>Default</span>
              </div>
            ))}

            {/* Custom tags — editable */}
            {tagDefs.filter(t => !t.is_default).map(tag => (
              <div key={tag.id} style={rowStyle}>
                {editingTagId === tag.id ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 1 }}>
                    <input type="text" value={editingTagName} onChange={e => setEditingTagName(e.target.value)}
                      autoFocus onKeyDown={e => { if (e.key === 'Enter') renameTag(tag.id); if (e.key === 'Escape') { setEditingTagId(null); setEditingTagName('') } }}
                      style={{
                        flex: 1, padding: '6px 10px', fontSize: '14px', fontFamily: "'Jost', sans-serif",
                        border: `1px solid ${C.forest}`, borderRadius: '8px', outline: 'none', color: C.ink, background: C.cream,
                      }} />
                    <button onClick={() => renameTag(tag.id)} style={{ fontSize: '12px', color: C.forest, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Save</button>
                    <button onClick={() => { setEditingTagId(null); setEditingTagName('') }} style={{ fontSize: '12px', color: C.driftwoodSm, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Cancel</button>
                  </div>
                ) : deleteTagConfirm === tag.id ? (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: C.ink, marginBottom: '6px' }}>
                      Remove '{tag.name}'? It will be removed from all recipes and meals.
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => deleteTag(tag.id)} style={{ fontSize: '11px', color: 'white', background: C.red, border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 500 }}>Remove</button>
                      <button onClick={() => setDeleteTagConfirm(null)} style={{ fontSize: '11px', color: C.driftwoodSm, background: 'none', border: `1px solid ${C.linen}`, borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: '14px', color: C.ink }}>{tag.name}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button onClick={() => { setEditingTagId(tag.id); setEditingTagName(tag.name) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.driftwood, padding: '4px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </button>
                      <button onClick={() => setDeleteTagConfirm(tag.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.driftwood, padding: '4px' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Empty state for custom tags */}
            {tagDefs.filter(t => !t.is_default).length === 0 && (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood, padding: '8px 0' }}>
                Tags you create in recipes and meals will appear here.
              </div>
            )}
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

      <AddDayTypeSheet
        open={addDtOpen}
        onClose={() => setAddDtOpen(false)}
        householdId={appUser?.household_id}
        onSaved={handleDayTypeSaved}
      />

      {toastMsg && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%',
          background: C.forest, color: 'white', padding: '10px 22px', borderRadius: '10px',
          fontSize: '14px', fontWeight: 500, zIndex: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          animation: 'toastIn 0.25s cubic-bezier(0.22,1,0.36,1) forwards',
        }}>
          {toastMsg}
        </div>
      )}

      <BottomNav activeTab="week" />
    </div>
  )
}
