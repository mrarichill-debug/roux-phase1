/**
 * Profile.jsx — Settings screen.
 * Two sections: My Account (personal) and Our Kitchen (household).
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'

const C = {
  forest: '#3D6B4F', forestDk: '#2E5038', sage: '#7A8C6E',
  honey: '#C49A3C', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0', walnut: '#8B6F52', red: '#A03030',
}

const sectionHeader = {
  fontSize: '10px', fontWeight: 500, letterSpacing: '2px',
  textTransform: 'uppercase', color: C.driftwood, marginBottom: '12px',
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

  // Add member sheet
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberDob, setNewMemberDob] = useState('')
  const [savingMember, setSavingMember] = useState(false)

  // Add store
  const [addStoreOpen, setAddStoreOpen] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')

  // Delete confirmations
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deleteStoreId, setDeleteStoreId] = useState(null)

  // Toggles (persisted on users table)
  const [haptics, setHaptics] = useState(false)
  const [notifications, setNotifications] = useState(true)

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
      const [householdRes, membersRes, storesRes, userPrefsRes] = await Promise.all([
        supabase.from('households').select('id, name, invite_code').eq('id', appUser.household_id).single(),
        supabase.from('family_members').select('id, name, date_of_birth, is_pet, notes').eq('household_id', appUser.household_id).order('created_at'),
        supabase.from('grocery_stores').select('id, name, is_primary').eq('household_id', appUser.household_id).order('name'),
        supabase.from('users').select('haptic_feedback_enabled, notifications_enabled').eq('id', appUser.id).single(),
      ])
      if (householdRes.data) { setHousehold(householdRes.data); setHomeValue(householdRes.data.name) }
      if (membersRes.data) setMembers(membersRes.data)
      if (storesRes.data) setStores(storesRes.data)
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

  async function addMember() {
    if (!newMemberName.trim() || savingMember) return
    setSavingMember(true)
    try {
      const { data, error } = await supabase.from('family_members').insert({
        household_id: appUser.household_id,
        name: newMemberName.trim(),
        date_of_birth: newMemberDob || null,
      }).select('id, name, date_of_birth, is_pet, notes').single()
      if (error) throw error
      setMembers(prev => [...prev, data])
      setAddMemberOpen(false)
      setNewMemberName('')
      setNewMemberDob('')
      showToast('Family member added')
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

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  async function refreshInviteCode() {
    const code = generateInviteCode()
    const { error } = await supabase.from('households').update({ invite_code: code }).eq('id', household.id)
    if (error) { showToast('Could not generate new code'); return }
    setHousehold(prev => ({ ...prev, invite_code: code }))
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

  function getAge(dob) {
    if (!dob) return null
    const today = new Date()
    const birth = new Date(dob)
    let age = today.getFullYear() - birth.getFullYear()
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--
    return age
  }

  return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: '140px', position: 'relative', overflowX: 'hidden',
    }}>

      <TopBar slim leftAction={{ onClick: () => navigate(-1), label: 'Back' }} />

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
                  <button onClick={saveName} style={{ fontSize: '12px', color: C.forest, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Save</button>
                  <button onClick={() => setEditingName(false)} style={{ fontSize: '12px', color: C.driftwood, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Cancel</button>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: '14px', color: C.ink }}>{appUser.name}</div>
                    <div style={{ fontSize: '11px', color: C.driftwood }}>Name</div>
                  </div>
                  <button onClick={() => setEditingName(true)} style={{ fontSize: '12px', color: C.forest, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Edit</button>
                </>
              )}
            </div>

            {/* Email */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: '14px', color: C.ink }}>{appUser.email}</div>
                <div style={{ fontSize: '11px', color: C.driftwood }}>Email</div>
              </div>
            </div>

            {/* Password */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: '14px', color: C.ink }}>••••••••</div>
                <div style={{ fontSize: '11px', color: C.driftwood }}>Password</div>
              </div>
              <button onClick={sendPasswordReset} style={{ fontSize: '12px', color: resetSent ? C.driftwood : C.forest, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>
                {resetSent ? 'Sent ✓' : 'Reset'}
              </button>
            </div>

            {/* Haptics toggle */}
            <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', color: C.ink }}>Vibration feedback</div>
                  <div style={{ fontSize: '11px', color: C.driftwood }}>Feel a gentle tap when taking actions</div>
                </div>
                <ToggleSwitch on={haptics} onToggle={toggleHaptics} />
              </div>
            </div>

            {/* Notifications toggle */}
            <div style={{ ...rowStyle, borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '14px', color: C.ink }}>Weekly planning reminders</div>
                  <div style={{ fontSize: '11px', color: C.driftwood }}>Sage will nudge you when the week needs attention</div>
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
                  <button onClick={saveHomeName} style={{ fontSize: '12px', color: C.forest, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Save</button>
                  <button onClick={() => { setEditingHome(false); setHomeValue(household.name) }} style={{ fontSize: '12px', color: C.driftwood, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Cancel</button>
                </div>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: '14px', color: C.ink }}>{household?.name}</div>
                    <div style={{ fontSize: '11px', color: C.driftwood }}>Home name</div>
                  </div>
                  <button onClick={() => setEditingHome(true)} style={{ fontSize: '12px', color: C.forest, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>Edit</button>
                </>
              )}
            </div>
          </div>

          {/* ── Family Members ──────────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.12s both' }}>
            <div style={sectionHeader}>Family Members</div>
            {members.map(m => {
              const age = getAge(m.date_of_birth)
              return (
                <div key={m.id} style={rowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', color: C.ink }}>{m.name}</div>
                    <div style={{ fontSize: '11px', color: C.driftwood }}>
                      {age !== null ? `${age} years old` : ''}
                    </div>
                  </div>
                  {deleteConfirmId === m.id ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: C.red }}>Remove?</span>
                      <button onClick={() => deleteMember(m.id)} style={{ fontSize: '11px', color: 'white', background: C.red, border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 500 }}>Yes</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: '11px', color: C.driftwood, background: 'none', border: `1px solid ${C.linen}`, borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>No</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirmId(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(140,123,107,0.55)', padding: '3px', display: 'flex' }} aria-label="Remove member">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}
            <button onClick={() => { setNewMemberName(''); setNewMemberDob(''); setAddMemberOpen(true) }} style={{
              width: '100%', padding: '12px', marginTop: '8px', fontSize: '13px',
              fontFamily: "'Jost', sans-serif", fontWeight: 500, color: C.forest,
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
                    <span style={{ fontSize: '9px', fontWeight: 500, color: C.forest, background: 'rgba(61,107,79,0.08)', border: '1px solid rgba(61,107,79,0.15)', padding: '2px 6px', borderRadius: '4px' }}>Default</span>
                  )}
                </div>
                {deleteStoreId === s.id ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: C.red }}>Remove?</span>
                    <button onClick={() => deleteStore(s.id)} style={{ fontSize: '11px', color: 'white', background: C.red, border: 'none', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif", fontWeight: 500 }}>Yes</button>
                    <button onClick={() => setDeleteStoreId(null)} style={{ fontSize: '11px', color: C.driftwood, background: 'none', border: `1px solid ${C.linen}`, borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}>No</button>
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
              fontFamily: "'Jost', sans-serif", fontWeight: 500, color: C.forest,
              background: 'transparent', border: `1.5px dashed rgba(61,107,79,0.4)`,
              borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
            }}>
              + Add store
            </button>
          </div>

          {/* ── Invite Code ────────────────────────────────────────────── */}
          <div style={{ ...cardStyle, animation: 'fadeUp 0.35s ease 0.20s both' }}>
            <div style={sectionHeader}>Invite Someone to Your Kitchen</div>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontSize: '32px', fontWeight: 600,
                color: C.forest, letterSpacing: '8px', marginBottom: '6px',
              }}>
                {household?.invite_code || '------'}
              </div>
              <div style={{ fontSize: '11px', color: C.driftwood }}>
                Share this code with family members
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={shareCode} style={{
                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 500,
                fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                background: C.forest, color: 'white', border: 'none',
              }}>Share</button>
              <button onClick={copyCode} style={{
                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 500,
                fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                background: 'none', color: C.forest, border: `1.5px solid rgba(61,107,79,0.4)`,
              }}>Copy</button>
              <button onClick={refreshInviteCode} style={{
                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 500,
                fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                background: 'none', color: C.driftwood, border: `1px solid ${C.linen}`,
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

      {/* ── Add Member Sheet ─────────────────────────────────────────── */}
      {addMemberOpen && (
        <>
          <div onClick={() => setAddMemberOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200, animation: 'fadeIn 0.2s ease' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '0 0 40px', zIndex: 201, boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
            animation: 'sheetRise 0.32s cubic-bezier(0.32,0.72,0,1) both',
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
            <div style={{ padding: '20px 22px 0' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '16px' }}>
                Add a family member
              </div>
              <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '6px' }}>Name</div>
              <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="First and last name" autoFocus style={{
                width: '100%', padding: '12px 14px', border: `1px solid ${C.linen}`, borderRadius: '10px',
                fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: C.ink, outline: 'none', background: C.cream, boxSizing: 'border-box', marginBottom: '14px',
              }} />
              <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '2px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '6px' }}>Date of birth (optional)</div>
              <input type="date" value={newMemberDob} onChange={e => setNewMemberDob(e.target.value)} style={{
                width: '100%', padding: '12px 14px', border: `1px solid ${C.linen}`, borderRadius: '10px',
                fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: C.ink, outline: 'none', background: C.cream, boxSizing: 'border-box', marginBottom: '14px',
              }} />
              <button onClick={addMember} disabled={!newMemberName.trim() || savingMember} style={{
                width: '100%', padding: '14px', borderRadius: '12px', background: newMemberName.trim() ? C.forest : C.linen,
                color: newMemberName.trim() ? 'white' : C.driftwood, border: 'none', fontFamily: "'Jost', sans-serif",
                fontSize: '14px', fontWeight: 500, cursor: newMemberName.trim() ? 'pointer' : 'default', marginBottom: '8px',
              }}>
                {savingMember ? 'Adding…' : 'Add Member'}
              </button>
              <button onClick={() => setAddMemberOpen(false)} style={{
                width: '100%', background: 'none', border: 'none', color: C.driftwood,
                fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300, padding: '10px', cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── Add Store Sheet ──────────────────────────────────────────── */}
      {addStoreOpen && (
        <>
          <div onClick={() => setAddStoreOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,23,0.45)', zIndex: 200, animation: 'fadeIn 0.2s ease' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '430px', background: 'white', borderRadius: '20px 20px 0 0',
            padding: '0 0 40px', zIndex: 201, boxShadow: '0 -4px 32px rgba(44,36,23,0.18)',
            animation: 'sheetRise 0.32s cubic-bezier(0.32,0.72,0,1) both',
          }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(200,185,160,0.6)', margin: '12px auto 0' }} />
            <div style={{ padding: '20px 22px 0' }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 500, color: C.ink, marginBottom: '16px' }}>
                Add a store
              </div>
              <input type="text" value={newStoreName} onChange={e => setNewStoreName(e.target.value)} placeholder="Store name" autoFocus
                onKeyDown={e => { if (e.key === 'Enter') addStore() }}
                style={{
                  width: '100%', padding: '12px 14px', border: `1px solid ${C.linen}`, borderRadius: '10px',
                  fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 300, color: C.ink, outline: 'none', background: C.cream, boxSizing: 'border-box', marginBottom: '14px',
                }} />
              <button onClick={addStore} disabled={!newStoreName.trim()} style={{
                width: '100%', padding: '14px', borderRadius: '12px', background: newStoreName.trim() ? C.forest : C.linen,
                color: newStoreName.trim() ? 'white' : C.driftwood, border: 'none', fontFamily: "'Jost', sans-serif",
                fontSize: '14px', fontWeight: 500, cursor: newStoreName.trim() ? 'pointer' : 'default', marginBottom: '8px',
              }}>Add Store</button>
              <button onClick={() => setAddStoreOpen(false)} style={{
                width: '100%', background: 'none', border: 'none', color: C.driftwood,
                fontFamily: "'Jost', sans-serif", fontSize: '13px', fontWeight: 300, padding: '10px', cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
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

      {/* ── Bottom Nav ───────────────────────────────────────────────── */}
      <BottomNav navigate={navigate} />
    </div>
  )
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ on, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      width: '44px', height: '24px', borderRadius: '12px',
      border: on ? 'none' : `1.5px solid ${C.linen}`,
      background: on ? C.forest : C.cream,
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

// ── Bottom Navigation ─────────────────────────────────────────────────────────
const NAV_TABS = [
  { key: 'home', label: 'Home', path: '/', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { key: 'thisweek', label: 'This Week', path: '/thisweek', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> },
  { key: 'recipes', label: 'Recipes', path: '/recipes', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
  { key: 'shopping', label: 'Shopping', path: '/shopping', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
]

function BottomNav({ navigate }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: '430px', height: '80px',
      padding: '10px 0 22px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
      zIndex: 100, background: C.cream, borderTop: `1px solid ${C.linen}`,
      boxShadow: '0 -2px 12px rgba(80,60,30,0.08)',
    }}>
      {NAV_TABS.map(tab => (
        <button key={tab.key} onClick={() => navigate(tab.path)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
          cursor: 'pointer', padding: '4px 0', background: 'none', border: 'none',
          color: C.driftwood, transition: 'color 0.15s', position: 'relative',
          fontFamily: "'Jost', sans-serif",
        }}>
          {tab.icon}
          <span style={{ fontSize: '10px', fontWeight: 400, letterSpacing: '0.3px' }}>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
