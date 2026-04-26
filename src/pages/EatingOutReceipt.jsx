/**
 * EatingOutReceipt.jsx — Scan a receipt for an eating out meal.
 * Simple flow: photograph → extract total → confirm → save.
 */
import { useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { color, alpha, elevation } from '../styles/tokens'

export default function EatingOutReceipt({ appUser }) {
  const { mealId } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [processing, setProcessing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [parsedTotal, setParsedTotal] = useState(null)
  const [editTotal, setEditTotal] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleCapture(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setProcessing(true)

    // Preview
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(file)

    // Convert to base64
    const base64Reader = new FileReader()
    base64Reader.onload = async () => {
      const base64 = base64Reader.result.split(',')[1]
      const mediaType = file.type || 'image/jpeg'

      try {
        const response = await fetch('/api/eating-out-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType }),
        })
        const data = await response.json()
        if (data.error || !data.total) {
          setError('Could not read the total from this receipt. Try entering it manually.')
          setEditing(true)
        } else {
          setParsedTotal(data.total)
          setEditTotal(String(data.total))
        }
      } catch (err) {
        setError('Something went wrong. Try entering the total manually.')
        setEditing(true)
      }
      setProcessing(false)
    }
    base64Reader.readAsDataURL(file)
  }

  async function confirmTotal() {
    const cost = parseFloat((editing ? editTotal : String(parsedTotal)).replace(/[^0-9.]/g, ''))
    if (!cost || isNaN(cost)) return
    setSaving(true)

    // Upload receipt image to storage
    let receiptUrl = null
    if (preview) {
      const blob = await (await fetch(preview)).blob()
      const path = `eating-out/${mealId}-${Date.now()}.jpg`
      const { error: uploadErr } = await supabase.storage.from('receipts').upload(path, blob)
      if (!uploadErr) receiptUrl = path
    }

    await supabase.from('planned_meals').update({
      eating_out_actual_cost: cost,
      eating_out_receipt_url: receiptUrl,
    }).eq('id', mealId)

    logActivity({ user: appUser, actionType: 'eating_out_receipt_scanned', targetType: 'planned_meal', targetId: mealId, metadata: { cost } })

    // Sage budget nudge
    const { data: meal } = await supabase.from('planned_meals').select('custom_name, eating_out_cost').eq('id', mealId).single()
    if (meal?.eating_out_cost) {
      const est = Number(meal.eating_out_cost)
      const diff = Math.abs(cost - est).toFixed(2)
      const mealName = meal.custom_name || 'Eating out'
      const message = cost > est
        ? `You estimated $${est.toFixed(2)} for ${mealName} but spent $${cost.toFixed(2)} — $${diff} over budget.`
        : `Nice — you came in $${diff} under your estimate at ${mealName}!`
      await supabase.from('sage_background_activity').insert({
        household_id: appUser.household_id, user_id: appUser.id,
        activity_type: 'eating_out_actual', message, seen: false,
        metadata: { meal_id: mealId, estimated: est, actual: cost },
      })
    }

    navigate(-1)
  }

  return (
    <div style={{
      background: color.paper, minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      fontFamily: "'Jost', sans-serif", fontWeight: 300,
    }}>
      <TopBar
        leftAction={() => navigate(-1)}
        leftIcon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}><path d="m15 18-6-6 6-6"/></svg>}
        centerContent={<span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Scan Receipt</span>}
      />

      <div style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>

        {/* Upload area */}
        {!preview && !processing && (
          <button onClick={() => fileRef.current?.click()} style={{
            width: '100%', padding: '48px 24px', borderRadius: '16px',
            border: `2px dashed ${color.rule}`, background: 'white',
            cursor: 'pointer', textAlign: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32, marginBottom: '12px' }}>
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
              <path d="M8 7h8M8 11h8M8 15h4"/>
            </svg>
            <div style={{ fontSize: '15px', color: color.ink, fontWeight: 400 }}>Tap to photograph your receipt</div>
            <div style={{ fontSize: '13px', color: color.inkSoft, marginTop: '4px' }}>Sage will read the total for you</div>
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleCapture}
          style={{ display: 'none' }} />

        {/* Processing */}
        {processing && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ display: 'inline-block', width: '32px', height: '32px', border: `3px solid ${color.rule}`, borderTop: `3px solid ${color.forest}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ marginTop: '12px', fontSize: '14px', color: color.inkSoft, fontStyle: 'italic' }}>Sage is reading your receipt...</div>
          </div>
        )}

        {/* Preview */}
        {preview && !processing && (
          <img src={preview} alt="Receipt" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '12px' }} />
        )}

        {/* Error */}
        {error && (
          <div style={{ fontSize: '13px', color: color.inkSoft, fontStyle: 'italic', textAlign: 'center' }}>{error}</div>
        )}

        {/* Parsed total — confirm */}
        {parsedTotal && !editing && !processing && (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: '14px', color: color.inkSoft, marginBottom: '8px' }}>Total:</div>
            <div style={{ fontSize: '28px', fontWeight: 500, color: color.ink, fontFamily: "'Playfair Display', serif", marginBottom: '16px' }}>
              ${Number(parsedTotal).toFixed(2)}
            </div>
            <div style={{ fontSize: '13px', color: color.inkSoft, marginBottom: '20px' }}>Does that look right?</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={confirmTotal} disabled={saving} style={{
                flex: 1, padding: '14px', borderRadius: '14px', border: 'none',
                background: color.forest, color: 'white', cursor: 'pointer',
                fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
              }}>{saving ? 'Saving...' : 'Confirm'}</button>
              <button onClick={() => setEditing(true)} style={{
                flex: 1, padding: '14px', borderRadius: '14px',
                border: `1.5px solid ${color.rule}`, background: 'white', color: color.ink, cursor: 'pointer',
                fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 400,
              }}>Edit</button>
            </div>
          </div>
        )}

        {/* Edit mode */}
        {editing && !processing && (
          <div style={{ width: '100%' }}>
            <div style={{ fontSize: '14px', color: color.inkSoft, marginBottom: '8px' }}>Enter the total:</div>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', color: color.inkSoft }}>$</span>
              <input type="text" inputMode="decimal" value={editTotal} onChange={e => setEditTotal(e.target.value)}
                autoFocus placeholder="0.00" style={{
                  width: '100%', padding: '14px 14px 14px 32px', fontSize: '18px',
                  fontFamily: "'Jost', sans-serif", border: `1.5px solid ${color.rule}`,
                  borderRadius: '12px', outline: 'none', color: color.ink, boxSizing: 'border-box',
                }} />
            </div>
            <button onClick={confirmTotal} disabled={saving || !editTotal.trim()} style={{
              width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
              background: editTotal.trim() ? color.forest : color.rule, color: editTotal.trim() ? 'white' : color.inkSoft,
              cursor: editTotal.trim() ? 'pointer' : 'default',
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
            }}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <BottomNav activeTab="shop" />
    </div>
  )
}
