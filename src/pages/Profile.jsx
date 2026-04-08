/**
 * Profile.jsx — Settings screen.
 * Two sections: My Account (personal) and Our Kitchen (household).
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import BottomSheet from '../components/BottomSheet'
import { COLOR_SCHEMES, SCHEME_NAMES } from '../lib/colorSchemes'
import { useArc } from '../context/ArcContext'

const C = {
  forest: '#3D6B4F', forestDk: '#2E5038', sage: '#7A8C6E',
  honey: '#C49A3C', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', driftwoodSm: '#6B5B4E', linen: '#E8E0D0', walnut: '#8B6F52', red: '#A03030',
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
  padding: '12px 0', borderBottom: `1px solid rgba(200,185,160,0.2)`,
}

export default function Profile({ appUser }) {
  const { color: arcColor } = useArc()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [stores, setStores] = useState([])

  // Editable fields
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [editingHome, setEditingHome] = useState(false)
  const [homeValue, setHomeValue] = useState('')

  // Add/edit member sheet
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [editMemberId, setEditMemberId] = useState(null)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberDob, setNewMemberDob] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('member_admin')
  const [newMemberIsPet, setNewMemberIsPet] = useState(false)
  const [savingMember, setSavingMember] = useState(false)

  // Display name (local copy for optimistic update)
  const [displayName, setDisplayName] = useState(appUser?.name || '')

  // Invite code confirmation
  const [newCodeConfirmOpen, setNewCodeConfirmOpen] = useState(false)

  // Admin transfer
  const [transferOpen, setTransferOpen] = useState(false)

  // Add store
  const [addStoreOpen, setAddStoreOpen] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')

  // Delete confirmations
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deleteStoreId, setDeleteStoreId] = useState(null)

  // Tags
  const [tagDefs, setTagDefs] = useState([])
  const [editingTagId, setEditingTagId] = useState(null)
  const [editingTagName, setEditingTagName] = useState('')
  const [deleteTagConfirm, setDeleteTagConfirm] = useState(null)

  // Week defaults
  const [defaultPattern, setDefaultPattern] = useState({})
  const [dayTypeRecords, setDayTypeRecords] = useState([])
  const [dtKeyToId, setDtKeyToId] = useState({})
  const [dtPickerDow, setDtPickerDow] = useState(null)

  // Toggles (persisted on users table)
  const [haptics, setHaptics] = useState(false)
  const [notifications, setNotifications] = useState(true)

  // Kitchen theme
  const [activeScheme, setActiveScheme] = useState('garden')

  // Toast + password reset
  const [toastMsg, setToastMsg] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const firstName = appUser?.name?.split(' ')[0] ?? ''

  useEffect(() => {
    if (appUser?.household_id) loadProfile()
  }, [appUser?.household_id])

  async function loadProfile() {
    setLoading(true)
    try {
      const hid = appUser.household_id
      const [householdRes, membersRes, storesRes, userPrefsRes, tagDefsRes, dayTypesRes, patternRes] = await Promise.all([
        supabase.from('households').select('id, name, invite_code, color_scheme').eq('id', hid).single(),
        supabase.from('family_members').select('id, name, date_of_birth, is_pet, notes').eq('household_id', hid).order('created_at'),
        supabase.from('grocery_stores').select('id, name, is_primary').eq('household_id', hid).order('name'),
        supabase.from('users').select('haptic_feedback_enabled, notifications_enabled').eq('id', appUser.id).single(),
        supabase.from('recipe_tag_definitions').select('*').eq('household_id', hid).order('sort_order'),
        supabase.from('day_types').select('id, name, color').eq('household_id', hid),
        supabase.from('household_weekly_pattern').select('day_of_week, day_type_id').eq('household_id', hid),
      ])
      if (householdRes.data) {
        setHousehold(householdRes.data)
        setHomeValue(householdRes.data.name)
        if (householdRes.data.color_scheme) setActiveScheme(householdRes.data.color_scheme)
      }
      if (membersRes.data) setMembers(membersRes.data)
      if (storesRes.data) setStores(storesRes.data)
      setTagDefs(tagDefsRes.data || [])
      // Day types + weekly pattern
      const dtRecs = dayTypesRes.data || []
      setDayTypeRecords([...dtRecs].sort((a, b) => a.name.localeCompare(b.name)))
      const keyToId = {}
      const idToKey = {}
      for (const dt of dtRecs) {
        const key = dt.name === 'School Day' ? 'school' : dt.name === 'No School' ? 'no_school' : dt.name.toLowerCase()
        keyToId[key] = dt.id
        idToKey[dt.id] = key
      }
      setDtKeyToId(keyToId)
      const pat = {}
      for (const r of (patternRes.data || [])) { const k = idToKey[r.day_type_id]; if (k) pat[r.day_of_week] = k }
      setDefaultPattern(pat)
      if (userPrefsRes.data) {
        setHaptics(userPrefsRes.data.haptic_feedback_enabled ?? false)
        setNotifications(userPrefsRes.data.notifications_enabled ?? true)
      }
      setNameValue(appUser.name || '')
    } catch (err) {
      console.error('[Roux] loadProfile error:', err)
    } finally {
      setLoading(false)
    }
  }

  function showToast(msg) { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2500) }

  // ── My Account actions ──────────────────────────────────────────────
  async function saveName() {
    if (!nameValue.trim()) return
    await supabase.from('users').update({ name: nameValue.trim() }).eq('id', appUser.id)
    setDisplayName(nameValue.trim())
    setEditingName(false)
    showToast('Name updated')
  }

  async function sendPasswordReset() {
    if (resetSent) return
    const { error } = await supabase.auth.resetPasswordForEmail(appUser.email)
    if (error) { showToast('Could not send reset email'); return }
    setResetSent(true)
    showToast(`Reset link sent to ${appUser.email}`)
  }

  function toggleHaptics() {
    const next = !haptics
    setHaptics(next)
    supabase.from('users').update({ haptic_feedback_enabled: next }).eq('id', appUser.id)
      .then(({ error }) => { if (error) console.error('[Roux] toggleHaptics error:', error.message) })
  }

  function toggleNotifications() {
    const next = !notifications
    setNotifications(next)
    supabase.from('users').update({ notifications_enabled: next }).eq('id', appUser.id)
      .then(({ error }) => { if (error) console.error('[Roux] toggleNotifications error:', error.message) })
  }

  // ── Our Kitchen actions ─────────────────────────────────────────────
  async function saveHomeName() {
    if (!homeValue.trim() || !household) return
    await supabase.from('households').update({ name: homeValue.trim() }).eq('id', household.id)
    setHousehold(prev => ({ ...prev, name: homeValue.trim() }))
    setEditingHome(false)
    showToast('Home name updated')
  }

  function openEditMember(m) {
    setEditMemberId(m.id)
    setNewMemberName(m.name)
    setNewMemberDob(m.date_of_birth || '')
    setNewMemberIsPet(m.is_pet || false)
    const raw = m.notes || 'member_admin'
    const roleKey = raw === 'Admin' ? 'admin' : raw === 'Co-admin' || raw === 'co_admin' ? 'co_admin' : raw === 'View only' || raw === 'Just browsing' || raw === 'member_viewer' ? 'member_viewer' : 'member_admin'
    setNewMemberRole(roleKey)
    setAddMemberOpen(true)
  }

  function openAddMember() {
    setEditMemberId(null)
    setNewMemberName('')
    setNewMemberDob('')
    setNewMemberRole('member_admin')
    setNewMemberIsPet(false)
    setAddMemberOpen(true)
  }

  async function saveMemberEdit() {
    if (!newMemberName.trim() || savingMember) return
    setSavingMember(true)
    try {
      const roleLabel = newMemberIsPet ? '' : newMemberRole === 'admin' ? 'Admin' : newMemberRole === 'co_admin' ? 'Co-admin' : newMemberRole === 'member_viewer' ? 'View only' : 'Family member'
      const { error } = await supabase.from('family_members').update({
        name: newMemberName.trim(),
        date_of_birth: newMemberIsPet ? null : (newMemberDob || null),
        is_pet: newMemberIsPet,
        notes: roleLabel,
      }).eq('id', editMemberId)
      if (error) throw error
      setMembers(prev => prev.map(m => m.id === editMemberId ? { ...m, name: newMemberName.trim(), date_of_birth: newMemberIsPet ? null : (newMemberDob || null), is_pet: newMemberIsPet, notes: roleLabel } : m))
      setAddMemberOpen(false)
      showToast(newMemberIsPet ? 'Pet updated' : 'Member updated')
    } catch (err) {
      console.error('[Roux] saveMemberEdit error:', err)
    } finally {
      setSavingMember(false)
    }
  }

  async function addMember() {
    if (!newMemberName.trim() || savingMember) return
    setSavingMember(true)
    try {
      const roleLabel = newMemberIsPet ? '' : newMemberRole === 'admin' ? 'Admin' : newMemberRole === 'co_admin' ? 'Co-admin' : newMemberRole === 'member_viewer' ? 'View only' : 'Family member'
      const { data, error } = await supabase.from('family_members').insert({
        household_id: appUser.household_id,
        name: newMemberName.trim(),
        date_of_birth: newMemberIsPet ? null : (newMemberDob || null),
        is_pet: newMemberIsPet,
        notes: roleLabel,
      }).select('id, name, date_of_birth, is_pet, notes').single()
      if (error) throw error
      setMembers(prev => [...prev, data])
      setAddMemberOpen(false)
      setNewMemberName('')
      setNewMemberDob('')
      setNewMemberRole('member_admin')
      setNewMemberIsPet(false)
      showToast(newMemberIsPet ? 'Pet added' : 'Family member added')
    } catch (err) {
      console.error('[Roux] addMember error:', err)
    } finally {
      setSavingMember(false)
    }
  }

  async function deleteMember(id) {
    setMembers(prev => prev.filter(m => m.id !== id))
    setDeleteConfirmId(null)
    showToast('Family member removed')
    supabase.from('family_members').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('[Roux] deleteMember error:', error.message) })
  }

  async function addStore() {
    if (!newStoreName.trim()) return
    try {
      const { data, error } = await supabase.from('grocery_stores').insert({
        household_id: appUser.household_id,
        name: newStoreName.trim(),
      }).select('id, name, is_primary').single()
      if (error) throw error
      setStores(prev => [...prev, data])
      setNewStoreName('')
      setAddStoreOpen(false)
      showToast('Store added')
    } catch (err) {
      console.error('[Roux] addStore error:', err)
    }
  }

  async function deleteStore(id) {
    setStores(prev => prev.filter(s => s.id !== id))
    setDeleteStoreId(null)
    showToast('Store removed')
    supabase.from('grocery_stores').delete().eq('id', id)
      .then(({ error }) => { if (error) console.error('[Roux] deleteStore error:', error.message) })
  }

  async function transferAdmin(targetMemberId) {
    // Find current admin member (by matching appUser name)
    const currentAdmin = members.find(m => m.name === displayName || m.notes === 'Admin')
    if (!currentAdmin) return
    // Update target to Admin, current to Co-admin
    await Promise.all([
      supabase.from('family_members').update({ notes: 'Admin' }).eq('id', targetMemberId),
      supabase.from('family_members').update({ notes: 'Co-admin' }).eq('id', currentAdmin.id),
    ])
    setMembers(prev => prev.map(m => {
      if (m.id === targetMemberId) return { ...m, notes: 'Admin' }
      if (m.id === currentAdmin.id) return { ...m, notes: 'Co-admin' }
      return m
    }))
    setTransferOpen(false)
    setAddMemberOpen(false)
    showToast('Admin transferred')
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    // Household prefix: first 4 letters, uppercase, letters only
    const prefix = (household?.name || 'ROUX').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4)
    let suffix = ''
    for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
    return `${prefix}-${suffix}`
  }

  async function confirmAndRefreshCode() {
    const code = generateInviteCode()
    const { error } = await supabase.from('households').update({ invite_code: code }).eq('id', household.id)
    if (error) { showToast('Could not generate new code'); return }
    setHousehold(prev => ({ ...prev, invite_code: code }))
    setNewCodeConfirmOpen(false)
    showToast('New invite code generated')
  }

  function copyCode() {
    if (household?.invite_code) {
      navigator.clipboard?.writeText(household.invite_code)
      showToast('Code copied')
    }
  }

  function shareCode() {
    if (navigator.share && household?.invite_code) {
      navigator.share({ title: 'Join our kitchen on Roux', text: `Use code ${household.invite_code} to join ${household.name} on Roux.` })
    } else {
      copyCode()
    }
  }

  // ── Tag management ───────────────────────────────────────────────
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

  // ── Week default management ─────────────────────────────────────
  const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const DOW_KEYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
  const DAY_TYPE_OPTIONS = dayTypeRecords.map(dt => {
    const key = dt.name === 'School Day' ? 'school' : dt.name === 'No School' ? 'no_school' : dt.name.toLowerCase()
    return { key, label: dt.name, color: dt.color || C.driftwood }
  })

  async function savePatternDay(dowKey, typeKey) {
    setDefaultPattern(prev => ({ ...prev, [dowKey]: typeKey }))
    setDtPickerDow(null)
    const dtId = dtKeyToId[typeKey]
    if (!dtId) return
    await supabase.from('household_weekly_pattern').delete().eq('household_id', appUser.household_id).eq('day_of_week', dowKey)
    await supabase.from('household_weekly_pattern').insert({ household_id: appUser.household_id, day_of_week: dowKey, day_type_id: dtId })
    showToast('Default updated')
  }

  function getAge(dob) {
    if (!dob) return null
    const today = new Date()
    const birth = new Date(dob)
    let age = today.getFullYear() - birth.getFullYear()
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
    return age
  }

  const ROLE_LABELS = { admin: 'Admin', co_admin: 'Co-admin', 'Co-admin': 'Co-admin', member_admin: 'Family member', 'Family member': 'Family member', member_viewer: 'View only', 'View only': 'View only', 'Just browsing': 'View only' }

  function getMemberRole(m) {
    return m.notes || 'Family member'
  }

  function getMemberLabel(m) {
    if (m.is_pet) return '\u{1F43E}'
    const age = getAge(m.date_of_birth)
    const rawRole = getMemberRole(m)
    const roleLabel = ROLE_LABELS[rawRole] || rawRole
    if (age !== null && age < 18) return `Age ${age}`
    return roleLabel
  }

  return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: '140px', position: 'relative', overflowX: 'hidden',
    }}>

      <TopBar slim leftAction={{ onClick: () => navigate('/'), label: 'Back' }} />

      {/* Screen title */}
      <div style={{ padding: '22px 24px 14px', animation: 'fadeUp 0.35s ease both' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontWeight: 600, color: C.ink, margin: 0 }}>
          Settings
        </h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: C.driftwood, fontSize: '14px' }}>Loading...</div>
      ) : (
        <>
          {/* ═══ MY ACCOUNT ═══════════════════════════════════════════════ */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.04s both' }}>
            <div style={sectionHeader}>My Account</div>

            {/* Name */}
            <div style={rowStyle}>
              {editingName ? (
                <div style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'center' }}>
                  <input value={nameValue} onChange={e => setNameValue(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                    style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.sage}`, borderRadius: '8px', fontFamily: "'Jost', sans-serif", fontSize: '14px', color: C.ink, outline: 'none', background: C.cream }} />
                  <button onClick={saveName} style={{ fontSize: '12px', color: arcColor, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Save</button>
                  <button onClick={() => setEditingName(false)} style={{ fontSize: '12px', color: C.driftwoodSm, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Cancel</button>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: '14px', color: C.ink }}>{displayName}</div>
                    <div style={{ fontSize: '11px', color: C.driftwoodSm }}>Name</div>
                  </div>
                  <button onClick={() => setEditingName(true)} style={{ fontSize: '12px', color: arcColor, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Edit</button>
                </>
              )}
            </div>

            {/* Email */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: '14px', color: C.ink }}>{appUser.email}</div>
                <div style={{ fontSize: '11px', color: C.driftwoodSm }}>Email</div>
              </div>
            </div>

            {/* Password */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: '14px', color: C.ink }}>••••••••</div>
                <div style={{ fontSize: '11px', color: C.driftwoodSm }}>Password</div>
              </div>
              <button onClick={sendPasswordReset} style={{ fontSize: '12px', color: resetSent ? C.driftwoodSm : arcColor, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>
                {resetSent ? 'Sent ✓' : 'Reset'}
              </button>
            </div>

            {/* Haptics toggle */}
            <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', color: C.ink }}>Vibration feedback</div>
                  <div style={{ fontSize: '11px', color: C.driftwoodSm }}>Feel a gentle tap when taking actions</div>
                </div>
                <ToggleSwitch on={haptics} onToggle={toggleHaptics} />
              </div>
            </div>

            {/* Notifications toggle */}
            <div style={{ ...rowStyle, borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', color: C.ink }}>Weekly planning reminders</div>
                  <div style={{ fontSize: '11px', color: C.driftwoodSm }}>Sage will nudge you when the week needs attention</div>
                </div>
                <ToggleSwitch on={notifications} onToggle={toggleNotifications} />
              </div>
            </div>
          </div>

          {/* ═══ OUR KITCHEN ══════════════════════════════════════════════ */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.08s both' }}>
            <div style={sectionHeader}>Our Kitchen</div>

            {/* Home name */}
            <div style={rowStyle}>
              {editingHome ? (
                <div style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'center' }}>
                  <input value={homeValue} onChange={e => setHomeValue(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveHomeName(); if (e.key === 'Escape') setEditingHome(false) }}
                    style={{ flex: 1, padding: '8px 12px', border: `1px solid ${C.sage}`, borderRadius: '8px', fontFamily: "'Jost', sans-serif", fontSize: '14px', color: C.ink, outline: 'none', background: C.cream }} />
                  <button onClick={saveHomeName} style={{ fontSize: '12px', color: arcColor, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Save</button>
                  <button onClick={() => { setEditingHome(false); setHomeValue(household.name) }} style={{ fontSize: '12px', color: C.driftwoodSm, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Cancel</button>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: '14px', color: C.ink }}>{household?.name}</div>
                    <div style={{ fontSize: '11px', color: C.driftwoodSm }}>Home name</div>
                  </div>
                  <button onClick={() => setEditingHome(true)} style={{ fontSize: '12px', color: arcColor, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Edit</button>
                </>
              )}
            </div>
          </div>

          {/* ── Kitchen Theme ───────────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.10s both' }}>
            <div style={sectionHeader}>Kitchen Theme</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
              {Object.entries(COLOR_SCHEMES).map(([key, s]) => {
                const sel = activeScheme === key
                return (
                  <button
                    key={key}
                    onClick={async () => {
                      setActiveScheme(key)
                      await supabase.from('households').update({ color_scheme: key }).eq('id', appUser.household_id)
                      showToast(`Theme: ${SCHEME_NAMES[key]}`)
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                      padding: '12px 4px', borderRadius: '12px', cursor: 'pointer',
                      border: `1.5px solid ${sel ? s.primary : 'rgba(200,185,160,0.4)'}`,
                      background: sel ? `${s.primary}08` : 'transparent',
                      transition: 'all 0.15s', fontFamily: "'Jost', sans-serif",
                    }}
                  >
                    {/* Color swatch */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: `linear-gradient(135deg, ${s.primary} 50%, ${s.secondary} 50%)`,
                      border: `2px solid ${sel ? s.primary : 'rgba(200,185,160,0.3)'}`,
                      boxShadow: sel ? `0 0 0 2px ${s.primary}30` : 'none',
                      transition: 'all 0.15s',
                    }} />
                    <span style={{
                      fontSize: '10px', fontWeight: sel ? 600 : 400,
                      color: sel ? s.primary : C.driftwood,
                      letterSpacing: '0.3px',
                    }}>
                      {SCHEME_NAMES[key]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Family Members ──────────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.12s both' }}>
            <div style={sectionHeader}>Family Members</div>
            {members.map(m => {
              const isAdmin = getMemberRole(m) === 'Admin'
              const isPet = m.is_pet
              return (
                <div key={m.id} style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: C.ink }}>
                      {m.name}
                      <span style={{ fontSize: isPet ? '13px' : '11px', color: isAdmin ? arcColor : C.driftwood, fontWeight: isAdmin ? 500 : 400, marginLeft: '8px' }}>
                        {getMemberLabel(m)}
                      </span>
                    </div>
                  </div>
                  {deleteConfirmId === m.id ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: C.red }}>Remove?</span>
                      <button onClick={() => deleteMember(m.id)} style={{ fontSize: '11px', color: 'white', background: C.red, border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 500 }}>Yes</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: '11px', color: C.driftwoodSm, background: 'none', border: `1px solid ${C.linen}`, borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>No</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={() => openEditMember(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(140,123,107,0.55)', padding: '3px', display: 'flex' }} aria-label="Edit member">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>
                        </svg>
                      </button>
                      {!isAdmin && (
                        <button onClick={() => setDeleteConfirmId(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(140,123,107,0.55)', padding: '3px', display: 'flex' }} aria-label="Remove member">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <button onClick={openAddMember} style={{
              width: '100%', padding: '12px', marginTop: '8px', fontSize: '13px',
              fontFamily: "'Jost', sans-serif", fontWeight: 500, color: arcColor,
              background: 'transparent', border: `1.5px dashed rgba(61,107,79,0.4)`,
              borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
            }}>
              + Add family member
            </button>
          </div>

          {/* ── Grocery Stores ─────────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.16s both' }}>
            <div style={sectionHeader}>Grocery Stores</div>
            {stores.map(s => (
              <div key={s.id} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px', color: C.ink }}>{s.name}</span>
                  {s.is_primary && (
                    <span style={{ fontSize: '9px', fontWeight: 500, color: arcColor, background: 'rgba(61,107,79,0.08)', border: '1px solid rgba(61,107,79,0.15)', padding: '2px 6px', borderRadius: '4px' }}>Default</span>
                  )}
                </div>
                {deleteStoreId === s.id ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: C.red }}>Remove?</span>
                    <button onClick={() => deleteStore(s.id)} style={{ fontSize: '11px', color: 'white', background: C.red, border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 500 }}>Yes</button>
                    <button onClick={() => setDeleteStoreId(null)} style={{ fontSize: '11px', color: C.driftwoodSm, background: 'none', border: `1px solid ${C.linen}`, borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>No</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteStoreId(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(140,123,107,0.55)', padding: '3px', display: 'flex' }} aria-label="Remove store">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => { setNewStoreName(''); setAddStoreOpen(true) }} style={{
              width: '100%', padding: '12px', marginTop: '8px', fontSize: '13px',
              fontFamily: "'Jost', sans-serif", fontWeight: 500, color: arcColor,
              background: 'transparent', border: `1.5px dashed rgba(61,107,79,0.4)`,
              borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
            }}>
              + Add store
            </button>
          </div>

          {/* ── Tags ──────────────────────────────────────────────────── */}
          <div id="tags" style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.18s both' }}>
            <div style={sectionHeader}>Recipe & Meal Tags</div>
            {/* Default tags */}
            {tagDefs.filter(t => t.is_default).map(tag => (
              <div key={tag.id} style={rowStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13, opacity: 0.5, flexShrink: 0 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span style={{ fontSize: '14px', color: C.ink }}>{tag.name}</span>
                </div>
                <span style={{ fontSize: '10px', color: C.driftwood, fontWeight: 300 }}>Default</span>
              </div>
            ))}
            {/* Custom tags */}
            {tagDefs.filter(t => !t.is_default).map(tag => (
              <div key={tag.id} style={rowStyle}>
                {editingTagId === tag.id ? (
                  <div style={{ display: 'flex', gap: '6px', flex: 1, alignItems: 'center' }}>
                    <input value={editingTagName} onChange={e => setEditingTagName(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') renameTag(tag.id); if (e.key === 'Escape') setEditingTagId(null) }}
                      style={{ flex: 1, padding: '6px 10px', fontSize: '14px', fontFamily: "'Jost', sans-serif", border: `1px solid ${C.sage}`, borderRadius: '8px', outline: 'none', color: C.ink, background: C.cream }} />
                    <button onClick={() => renameTag(tag.id)} style={{ fontSize: '12px', color: arcColor, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Save</button>
                    <button onClick={() => setEditingTagId(null)} style={{ fontSize: '12px', color: C.driftwoodSm, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Cancel</button>
                  </div>
                ) : deleteTagConfirm === tag.id ? (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: C.ink, marginBottom: '6px' }}>Remove '{tag.name}'? It will be removed from all recipes and meals.</div>
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
            {tagDefs.filter(t => !t.is_default).length === 0 && (
              <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood, padding: '8px 0' }}>
                Tags you create in recipes and meals will appear here.
              </div>
            )}
          </div>

          {/* ── Week Defaults ──────────────────────────────────────────── */}
          <div id="week-defaults" style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.20s both' }}>
            <div style={sectionHeader}>Week Defaults</div>
            {DAY_NAMES.map((day, i) => {
              const dowKey = DOW_KEYS[i]
              const activeOpt = DAY_TYPE_OPTIONS.find(o => o.key === defaultPattern[dowKey])
              return (
                <div key={dowKey} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: i < 6 ? '1px solid rgba(200,185,160,0.20)' : 'none',
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
            <div style={{ marginTop: '14px' }}>
              <div style={{ ...sectionHeader, marginBottom: '8px' }}>Day Types</div>
              {dayTypeRecords.map(dt => (
                <div key={dt.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 0', borderBottom: '1px solid rgba(200,185,160,0.15)',
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dt.color || C.driftwood, flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', color: C.ink }}>{dt.name}</span>
                </div>
              ))}
              <button onClick={() => navigate('/week/defaults')} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0 0',
                fontSize: '12px', color: C.driftwood, fontWeight: 300, fontFamily: "'Jost', sans-serif",
              }}>Manage day types →</button>
            </div>
          </div>

          {/* ── Invite Code ────────────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.20s both' }}>
            <div style={sectionHeader}>Invite Someone to Your Kitchen</div>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontSize: '32px', fontWeight: 600,
                color: arcColor, letterSpacing: '8px', marginBottom: '6px',
              }}>
                {household?.invite_code || '------'}
              </div>
              <div style={{ fontSize: '11px', color: C.driftwoodSm }}>
                Active — share with family to join your kitchen
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={shareCode} style={{
                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 500,
                fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                background: arcColor, color: 'white', border: 'none',
              }}>Share</button>
              <button onClick={copyCode} style={{
                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 500,
                fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                background: 'none', color: arcColor, border: `1.5px solid rgba(61,107,79,0.4)`,
              }}>Copy</button>
              <button onClick={() => setNewCodeConfirmOpen(true)} style={{
                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 500,
                fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                background: 'none', color: C.driftwoodSm, border: `1px solid ${C.linen}`,
              }}>New Code</button>
            </div>
          </div>

          {/* ── Sign Out ───────────────────────────────────────────────── */}
          <div style={{ padding: '20px 22px 0', textAlign: 'center' }}>
            <div style={{ height: '1px', background: C.linen, marginBottom: '20px' }} />
            <button onClick={handleSignOut} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '13px', color: C.driftwood, fontWeight: 300,
              fontFamily: "'Jost', sans-serif",
            }}>
              Sign Out
            </button>
          </div>
        </>
      )}

      {/* ── Add Member — full-page overlay (keyboard safe) ──────── */}
      {addMemberOpen && (
      <div style={{ position: 'fixed', inset: 0, background: C.cream, zIndex: 200, display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto' }}>
        <div style={{ background: '#3D6B4F', padding: '10px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setAddMemberOpen(false)} style={{ background: 'rgba(250,247,242,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <span style={{ fontFamily: "'Slabo 27px', serif", fontSize: 18, color: 'rgba(250,247,242,0.95)' }}>{editMemberId ? 'Edit family member' : 'Add a family member'}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', paddingBottom: 120 }}>
              <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '6px' }}>Name</div>
              <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder={newMemberIsPet ? "Pet's name" : 'First and last name'} autoFocus style={{
                width: '100%', padding: '12px 14px', border: `1px solid ${C.linen}`, borderRadius: '10px',
                fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: C.ink, outline: 'none', background: C.cream, boxSizing: 'border-box', marginBottom: '14px',
              }} />

              {/* Pet toggle */}
              <button
                onClick={() => setNewMemberIsPet(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '10px 0', marginBottom: '14px', background: 'none', border: 'none',
                  cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                }}
              >
                <div style={{
                  width: '38px', height: '22px', borderRadius: '11px',
                  background: newMemberIsPet ? arcColor : C.linen,
                  position: 'relative', transition: 'background 0.2s',
                }}>
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                    position: 'absolute', top: '2px',
                    left: newMemberIsPet ? '18px' : '2px',
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }} />
                </div>
                <span style={{ fontSize: '13px', color: C.ink, fontWeight: 400 }}>
                  This is a pet {newMemberIsPet ? '\u{1F43E}' : ''}
                </span>
              </button>

              {!newMemberIsPet && (
                <>
                  <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '6px' }}>Date of birth (optional)</div>
                  <input type="date" value={newMemberDob} onChange={e => setNewMemberDob(e.target.value)} style={{
                    width: '100%', padding: '12px 14px', border: `1px solid ${C.linen}`, borderRadius: '10px',
                    fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: C.ink, outline: 'none', background: C.cream, boxSizing: 'border-box', marginBottom: '6px',
                  }} />
                  <div style={{ fontSize: '11px', fontStyle: 'italic', color: C.driftwoodSm, marginBottom: '14px', lineHeight: 1.4 }}>
                    Used for birthday reminders and to help Sage make better suggestions. Never shared outside your kitchen.
                  </div>
                </>
              )}

              {!newMemberIsPet && (
                <>
              <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwoodSm, marginBottom: '6px' }}>Role</div>
              {editMemberId && newMemberRole === 'admin' ? (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', color: arcColor, fontWeight: 500, marginBottom: '8px' }}>Admin (locked)</div>
                  <button onClick={() => setTransferOpen(true)} style={{
                    fontSize: '12px', color: arcColor, fontWeight: 500, background: 'none',
                    border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif", padding: 0,
                  }}>
                    Transfer Admin to someone else →
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  {[
                    { key: 'co_admin', label: 'Co-admin' },
                    { key: 'member_admin', label: 'Family member' },
                    { key: 'member_viewer', label: 'View only' },
                  ].map(r => (
                    <button key={r.key} onClick={() => setNewMemberRole(r.key)} style={{
                      flex: 1, padding: '8px 6px', fontSize: '11px', fontFamily: "'Jost', sans-serif",
                      fontWeight: newMemberRole === r.key ? 500 : 400, borderRadius: '10px', cursor: 'pointer',
                      border: `1.5px solid ${newMemberRole === r.key ? arcColor : C.linen}`,
                      background: newMemberRole === r.key ? arcColor : 'transparent',
                      color: newMemberRole === r.key ? 'white' : C.ink, transition: 'all 0.15s',
                      textAlign: 'center',
                    }}>
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
              </>
              )}

              <button onClick={editMemberId ? saveMemberEdit : addMember} disabled={!newMemberName.trim() || savingMember} style={{
                width: '100%', padding: '14px', borderRadius: '12px', background: newMemberName.trim() ? arcColor : C.linen,
                color: newMemberName.trim() ? 'white' : C.driftwood, border: 'none', fontFamily: "'Jost', sans-serif",
                fontSize: '14px', fontWeight: 500, cursor: newMemberName.trim() ? 'pointer' : 'default', marginBottom: '8px',
              }}>
                {savingMember ? 'Saving…' : (editMemberId ? 'Save Changes' : 'Add Member')}
              </button>
              <button onClick={() => setAddMemberOpen(false)} style={{
                width: '100%', background: 'none', border: 'none', color: C.driftwood,
                fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300, padding: '10px', cursor: 'pointer',
              }}>Cancel</button>
        </div>
      </div>
      )}

      {/* ── Add Store — full-page overlay (keyboard safe) ──────── */}
      {addStoreOpen && (
      <div style={{ position: 'fixed', inset: 0, background: C.cream, zIndex: 200, display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto' }}>
        <div style={{ background: '#3D6B4F', padding: '10px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button onClick={() => setAddStoreOpen(false)} style={{ background: 'rgba(250,247,242,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <span style={{ fontFamily: "'Slabo 27px', serif", fontSize: 18, color: 'rgba(250,247,242,0.95)' }}>Add a store</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', paddingBottom: 120 }}>
              <input type="text" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} placeholder="Store name" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') addStore() }}
                style={{
                  width: '100%', padding: '12px 14px', border: `1px solid ${C.linen}`, borderRadius: '10px',
                  fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: C.ink, outline: 'none', background: C.cream, boxSizing: 'border-box', marginBottom: '14px',
                }} />
              <button onClick={addStore} disabled={!newStoreName.trim()} style={{
                width: '100%', padding: '14px', borderRadius: '12px', background: newStoreName.trim() ? arcColor : C.linen,
                color: newStoreName.trim() ? 'white' : C.driftwood, border: 'none', fontFamily: "'Jost', sans-serif",
                fontSize: '14px', fontWeight: 500, cursor: newStoreName.trim() ? 'pointer' : 'default', marginBottom: '8px',
              }}>Add Store</button>
              <button onClick={() => setAddStoreOpen(false)} style={{
                width: '100%', background: 'none', border: 'none', color: C.driftwood,
                fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300, padding: '10px', cursor: 'pointer',
              }}>Cancel</button>
        </div>
      </div>
      )}

      {/* ── Admin Transfer Sheet ─────────────────────────────────────── */}
      <BottomSheet isOpen={transferOpen} onClose={() => setTransferOpen(false)} zIndex={300} title="Transfer Admin">
            <div style={{ padding: '0 22px 40px' }}>
              <div style={{ fontSize: '13px', color: C.driftwood, lineHeight: 1.5, marginBottom: '16px' }}>
                Select a Co-admin to become the new Admin. You will become Co-admin.
              </div>
              {members.filter(m => getMemberRole(m) === 'Co-admin').length === 0 ? (
                <div style={{ fontSize: '13px', fontStyle: 'italic', color: C.driftwood, padding: '16px 0' }}>
                  No Co-admins available. Promote someone to Co-admin first.
                </div>
              ) : (
                members.filter(m => getMemberRole(m) === 'Co-admin').map(m => (
                  <button key={m.id} onClick={() => {
                    if (confirm(`Transfer Admin to ${m.name}? They will become the new Admin and you will become Co-admin. This requires their cooperation to undo.`)) {
                      transferAdmin(m.id)
                    }
                  }} style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderRadius: '12px', marginBottom: '8px',
                    border: '1px solid rgba(200,185,160,0.55)', background: C.cream,
                    cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontSize: '14px', color: C.ink,
                    textAlign: 'left',
                  }}>
                    <span>{m.name}</span>
                    <span style={{ fontSize: '11px', color: arcColor, fontWeight: 500 }}>Transfer →</span>
                  </button>
                ))
              )}
              <button onClick={() => setTransferOpen(false)} style={{
                width: '100%', background: 'none', border: 'none', color: C.driftwood,
                fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300,
                padding: '10px', cursor: 'pointer',
              }}>Cancel</button>
            </div>
      </BottomSheet>

      {/* ── New Code Confirmation ────────────────────────────────────── */}
      <BottomSheet isOpen={newCodeConfirmOpen} onClose={() => setNewCodeConfirmOpen(false)} title="Generate new code?">
            <div style={{ padding: '0 22px 40px' }}>
              <div style={{ fontSize: '14px', color: C.driftwood, fontWeight: 300, lineHeight: 1.6, marginBottom: '20px' }}>
                This will invalidate your current code. Anyone with the old code won't be able to use it.
              </div>
              <button onClick={confirmAndRefreshCode} style={{
                width: '100%', background: arcColor, color: 'white', border: 'none',
                borderRadius: '12px', padding: '14px', fontFamily: "'Jost', sans-serif",
                fontSize: '14px', fontWeight: 500, cursor: 'pointer', marginBottom: '8px',
              }}>
                Generate New Code
              </button>
              <button onClick={() => setNewCodeConfirmOpen(false)} style={{
                width: '100%', background: 'none', border: 'none', color: C.driftwood,
                fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300,
                padding: '10px', cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
      </BottomSheet>

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {/* ── Day Type Picker Sheet ─────────────────────────────────────── */}
      <BottomSheet isOpen={!!dtPickerDow} onClose={() => setDtPickerDow(null)} title={dtPickerDow ? dtPickerDow.charAt(0).toUpperCase() + dtPickerDow.slice(1) : ''}>
            <div style={{ padding: '0 22px 40px' }}>
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
      </BottomSheet>

      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
          background: arcColor, color: 'white', padding: '10px 20px',
          borderRadius: '10px', fontSize: '13px', fontWeight: 500,
          fontFamily: "'Jost', sans-serif", zIndex: 500,
          boxShadow: '0 4px 16px rgba(30,55,35,0.30)',
          animation: 'fadeUp 0.25s ease both',
        }}>
          {toastMsg}
        </div>
      )}

      {/* ── Bottom Nav ───────────────────────────────────────────────── */}
      <BottomNav />
    </div>
  )
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ on, onToggle }) {
  const { color: arcColor } = useArc()
  return (
    <button onClick={onToggle} style={{
      width: '44px', height: '24px', borderRadius: '12px',
      border: on ? 'none' : `1.5px solid ${C.linen}`,
      background: on ? arcColor : C.cream,
      cursor: 'pointer', position: 'relative',
      transition: 'background 0.25s, border-color 0.25s',
      padding: 0, flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: '2px', left: on ? '22px' : '2px',
        width: '20px', height: '20px', borderRadius: '50%',
        background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        transition: 'left 0.25s',
      }} />
    </button>
  )
}

