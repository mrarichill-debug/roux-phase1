/**
 * DevReset.jsx — Developer-only reset utility.
 * Resets Lauren's account to "just signed up" state for testing onboarding.
 * Only accessible when import.meta.env.DEV === true.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const C = { forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417', driftwood: '#8C7B6B', honey: '#C49A3C', red: '#A03030', linen: '#E8E0D0' }

const HILL_HOUSEHOLD = '53f6a197-544a-48e6-9a46-23d7252399c2'

export default function DevReset({ appUser }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [done, setDone] = useState(false)
  const [fixing, setFixing] = useState(false)

  async function fixSession() {
    if (fixing) return
    setFixing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { alert('No auth session — sign in first'); setFixing(false); return }
      await supabase.from('users').upsert({
        auth_id: session.user.id,
        household_id: HILL_HOUSEHOLD,
        name: session.user.email?.split('@')[0] || 'Dev User',
        email: session.user.email || 'dev@roux.app',
        role: 'admin',
        membership_status: 'active',
        has_planned_first_meal: true,
      }, { onConflict: 'auth_id' })
      window.location.reload()
    } catch (err) {
      console.error('[DevReset] Fix session error:', err)
      setFixing(false)
    }
  }

  async function handleReset() {
    if (resetting) return
    setResetting(true)
    const hid = appUser.household_id

    try {
      // Delete planned meals
      await supabase.from('planned_meals').delete().eq('household_id', hid)
      // Delete meal plans
      await supabase.from('meal_plans').delete().eq('household_id', hid)
      // Reset first meal flag
      await supabase.from('users').update({ has_planned_first_meal: false }).eq('id', appUser.id)
      // Clear shopping list items (master list only)
      const { data: masterList } = await supabase.from('shopping_lists').select('id').eq('household_id', hid).eq('list_type', 'master').maybeSingle()
      if (masterList) {
        await supabase.from('shopping_list_items').delete().eq('shopping_list_id', masterList.id)
      }
      // Clear activity log
      await supabase.from('activity_log').delete().eq('household_id', hid)
      // Clear home notices
      await supabase.from('home_notices').delete().eq('household_id', hid)

      setDone(true)
      setTimeout(() => navigate('/onboarding'), 1500)
    } catch (err) {
      console.error('[DevReset] Error:', err)
      setResetting(false)
    }
  }

  return (
    <div style={{
      background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      fontFamily: "'Jost', sans-serif", fontWeight: 300,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 30px',
    }}>
      {/* DEV badge */}
      <div style={{
        position: 'fixed', top: '12px', right: '12px',
        background: C.honey, color: 'white', fontSize: '9px', fontWeight: 600,
        padding: '3px 8px', borderRadius: '4px', letterSpacing: '1px',
      }}>DEV ONLY</div>

      <div style={{ fontFamily: "'Slabo 27px', serif", fontSize: '27px', color: C.forest, marginBottom: '24px' }}>
        Roux.
      </div>

      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: C.ink, marginBottom: '8px', textAlign: 'center' }}>
        Test Reset
      </div>
      <div style={{ fontSize: '13px', color: C.driftwood, textAlign: 'center', lineHeight: 1.6, marginBottom: '32px', maxWidth: '280px' }}>
        Reset {appUser?.name?.split(' ')[0] || 'user'}'s account to a fresh state for testing onboarding. Recipes and settings are kept.
      </div>

      {done ? (
        <div style={{ fontSize: '15px', color: C.forest, fontWeight: 500 }}>
          Reset complete. Redirecting...
        </div>
      ) : confirming ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '260px' }}>
          <div style={{ fontSize: '12px', color: C.red, textAlign: 'center', marginBottom: '4px' }}>
            This will delete all planned meals, meal plans, shopping items, activity log, and home notices.
          </div>
          <button onClick={handleReset} disabled={resetting} style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: C.red, color: 'white', cursor: 'pointer',
            fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
          }}>
            {resetting ? 'Resetting...' : 'Yes, reset everything'}
          </button>
          <button onClick={() => setConfirming(false)} style={{
            width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
            background: 'none', color: C.driftwood, cursor: 'pointer',
            fontFamily: "'Jost', sans-serif", fontSize: '13px',
          }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} style={{
          padding: '14px 32px', borderRadius: '14px', border: 'none',
          background: C.forest, color: 'white', cursor: 'pointer',
          fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
          boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
        }}>
          Reset to Fresh Start
        </button>
      )}

      {/* Calendar provider quick switch */}
      <div style={{ marginTop: '32px', padding: '16px', background: 'white', borderRadius: '12px', border: `1px solid ${C.linen}`, width: '100%', maxWidth: '260px' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '8px' }}>Calendar Provider</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['apple', 'google', null].map(p => (
            <button key={String(p)} onClick={async () => {
              await supabase.from('users').update({
                calendar_provider: p,
                calendar_sync_enabled: !!p,
              }).eq('id', appUser.id)
            }} style={{
              flex: 1, padding: '8px', borderRadius: '8px', fontSize: '11px',
              border: `1px solid ${C.linen}`, background: 'white', cursor: 'pointer',
              fontFamily: "'Jost', sans-serif", color: C.ink,
            }}>{p === 'apple' ? 'Apple' : p === 'google' ? 'Google' : 'None'}</button>
          ))}
        </div>
      </div>

      {/* Fix session — link dev auth user to Hill household */}
      <div style={{ marginTop: '24px', padding: '16px', background: 'white', borderRadius: '12px', border: `1px solid ${C.linen}`, width: '100%', maxWidth: '260px' }}>
        <div style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.driftwood, marginBottom: '8px' }}>Session Fix</div>
        <div style={{ fontSize: '11px', color: C.driftwood, lineHeight: 1.5, marginBottom: '10px' }}>
          Link current auth user to Hill household. Fixes blank screens caused by missing users row.
        </div>
        <button onClick={fixSession} disabled={fixing} style={{
          width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
          background: C.honey, color: 'white', cursor: 'pointer',
          fontFamily: "'Jost', sans-serif", fontSize: '12px', fontWeight: 500,
        }}>{fixing ? 'Fixing...' : 'Fix session — link to Hill household'}</button>
      </div>

      <button onClick={() => navigate('/')} style={{
        marginTop: '24px', background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '12px', color: C.driftwood, fontFamily: "'Jost', sans-serif",
      }}>← Back to app</button>
    </div>
  )
}
