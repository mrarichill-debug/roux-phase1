/**
 * ReceiptScan.jsx — Receipt scanning screen for a completed shopping trip.
 * Upload photo → Sage parses via Haiku → show matched/unmatched items + total.
 * Low-confidence matches shown for Lauren to confirm.
 */
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import SageNudgeCard from '../components/SageNudgeCard'
import BottomNav from '../components/BottomNav'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E8E0D0', sage: '#7A8C6E', honey: '#C49A3C',
}
const sentenceCase = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : ''

export default function ReceiptScan({ appUser }) {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [preview, setPreview] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState(null)

  // Confirmation state for low-confidence matches
  const [confirmations, setConfirmations] = useState([]) // items needing confirmation
  const [confirmingIndex, setConfirmingIndex] = useState(null) // which one is showing search

  useEffect(() => { if (tripId) loadTrip() }, [tripId])

  async function loadTrip() {
    setLoading(true)
    try {
      const { data: tripData } = await supabase.from('shopping_trips')
        .select('id, name, store_name, household_id, receipt_photo_url, reconciliation_status, actual_cost')
        .eq('id', tripId).single()
      if (!tripData) { navigate('/pantry'); return }
      setTrip(tripData)

      if (tripData.receipt_photo_url) {
        const { data: tripItems } = await supabase.from('shopping_trip_items')
          .select('id, shopping_list_item_id, actual_price, is_purchased').eq('trip_id', tripId)
        const itemIds = (tripItems || []).map(r => r.shopping_list_item_id)
        let listMap = {}
        if (itemIds.length) {
          const { data: listItems } = await supabase.from('shopping_list_items')
            .select('id, name').in('id', itemIds)
          listMap = Object.fromEntries((listItems || []).map(i => [i.id, i]))
        }
        const matchedItems = (tripItems || []).filter(ti => ti.actual_price != null).map(ti => ({
          name: listMap[ti.shopping_list_item_id]?.name || 'Unknown item',
          price: ti.actual_price,
        }))
        setScanResult({
          store: tripData.store_name,
          total: tripData.actual_cost,
          matchedItems,
          unmatchedItems: [],
          needsConfirmation: [],
          reconciliation_status: tripData.reconciliation_status,
        })
      }
    } catch (err) {
      console.error('[ReceiptScan] Load error:', err)
    }
    setLoading(false)
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(file)

    setUploading(true)
    setScanError(null)
    try {
      const storagePath = `${appUser.household_id}/${tripId}.jpg`
      const { error: uploadErr } = await supabase.storage.from('receipts')
        .upload(storagePath, file, { upsert: true, contentType: file.type || 'image/jpeg' })
      if (uploadErr) throw uploadErr

      setUploading(false)
      setScanning(true)

      const res = await fetch('/api/receipt-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, imagePath: storagePath, householdId: appUser.household_id }),
      })
      const result = await res.json()

      if (result.error) {
        setScanError(result.error)
      } else {
        setScanResult(result)
        setConfirmations((result.needsConfirmation || []).map(c => ({ ...c, status: 'pending' })))
        logActivity({ user: appUser, actionType: 'receipt_scanned', targetType: 'shopping_trip', targetId: tripId, targetName: trip?.name })
      }
    } catch (err) {
      console.error('[ReceiptScan] Upload/scan error:', err)
      setScanError('Something went wrong uploading the receipt. Try again.')
    }
    setUploading(false)
    setScanning(false)
  }

  async function confirmMatch(index) {
    const item = confirmations[index]
    // Record purchase — update trip item price + insert history
    if (item.suggestedMatchId) {
      await supabase.from('shopping_trip_items').update({ actual_price: item.price }).eq('id', item.suggestedMatchId)
    }
    await supabase.from('ingredient_purchase_history').insert({
      household_id: appUser.household_id,
      trip_id: tripId,
      ingredient_name: (item.suggestedMatch || item.receiptItem).toLowerCase().trim(),
      receipt_line_item: item.receiptItem,
      store_name: scanResult?.storeName || trip?.store_name || '',
      store_type: scanResult?.storeType || 'standard',
      actual_price: item.price,
      purchase_date: new Date().toISOString().split('T')[0],
      is_bulk_purchase: (scanResult?.storeType || 'standard') === 'bulk',
    })
    setConfirmations(prev => prev.map((c, i) => i === index ? { ...c, status: 'confirmed' } : c))
  }

  function skipMatch(index) {
    setConfirmations(prev => prev.map((c, i) => i === index ? { ...c, status: 'skipped' } : c))
  }

  const allConfirmed = confirmations.length === 0 || confirmations.every(c => c.status !== 'pending')

  if (loading) return (
    <div style={{ background: C.cream, minHeight: '100vh', maxWidth: '430px', margin: '0 auto', fontFamily: "'Jost', sans-serif" }}>
      <div style={{ padding: '20px 22px' }}>
        {[60, 40, 40].map((h, i) => <div key={i} className="shimmer-block" style={{ height: `${h}px`, borderRadius: '12px', marginBottom: '10px' }} />)}
      </div>
    </div>
  )

  const hasExistingReceipt = trip?.receipt_photo_url && scanResult
  const showUpload = !hasExistingReceipt && !scanning && !scanResult

  return (
    <div style={{
      background: C.cream, fontFamily: "'Jost', sans-serif", fontWeight: 300,
      minHeight: '100vh', maxWidth: '430px', margin: '0 auto',
      paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 8px))',
    }}>
      {/* Header */}
      <div style={{ background: C.forest, padding: '16px 22px 14px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/pantry')} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(250,247,242,0.7)', padding: '4px', display: 'flex', alignItems: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: 'rgba(250,247,242,0.95)' }}>Scan Receipt</span>
        </div>
      </div>

      <div style={{ padding: '20px 22px' }}>
        {/* Upload area */}
        {showUpload && (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFileSelect} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} style={{
              width: '100%', padding: '48px 24px', borderRadius: '16px',
              border: `2px dashed ${C.linen}`, background: 'white', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={C.driftwood} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 40, height: 40 }}>
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <div style={{ fontSize: '14px', color: C.ink, fontWeight: 400 }}>Tap to take a photo or choose from your library</div>
              <div style={{ fontSize: '12px', color: C.driftwood }}>Sage will read the receipt and match your items</div>
            </button>
          </>
        )}

        {/* Preview + uploading state */}
        {preview && (uploading || scanning) && (
          <div style={{ textAlign: 'center' }}>
            <img src={preview} alt="Receipt preview" style={{
              width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '12px',
              marginBottom: '16px', border: `1px solid ${C.linen}`,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
              <span style={{ color: C.sage, fontSize: '16px' }}>✦</span>
              <span style={{ fontSize: '14px', color: C.ink, fontStyle: 'italic' }}>
                {uploading ? 'Uploading receipt...' : 'Sage is reading your receipt...'}
              </span>
            </div>
            <div style={{ marginTop: '12px' }}>
              <div className="shimmer-block" style={{ height: '4px', borderRadius: '2px', maxWidth: '200px', margin: '0 auto' }} />
            </div>
          </div>
        )}

        {/* Error state */}
        {scanError && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '14px', color: C.ink, marginBottom: '12px' }}>{scanError}</div>
            <button onClick={() => { setScanError(null); setPreview(null); fileRef.current?.click() }} style={{
              padding: '12px 24px', borderRadius: '12px', border: 'none',
              background: C.forest, color: 'white', cursor: 'pointer',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500,
            }}>Try again</button>
          </div>
        )}

        {/* Scan results */}
        {scanResult && !scanning && (
          <div>
            {/* Store + total */}
            <div style={{ marginBottom: '20px' }}>
              {scanResult.store && (
                <div style={{ fontSize: '13px', color: C.driftwood, marginBottom: '4px' }}>
                  {scanResult.store}{scanResult.date ? ` · ${scanResult.date}` : ''}
                </div>
              )}
              {scanResult.total != null && (
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 500, color: C.ink }}>
                  ${Number(scanResult.total).toFixed(2)}
                </div>
              )}
            </div>

            {/* Matched items */}
            {scanResult.matchedItems?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.sage, marginBottom: '6px' }}>
                  Matched Items
                </div>
                {scanResult.matchedItems.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: '1px solid rgba(200,185,160,0.2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span style={{ fontSize: '13px', color: C.ink }}>{sentenceCase(item.name)}</span>
                    </div>
                    {item.price != null && (
                      <span style={{ fontSize: '13px', color: C.driftwood }}>${Number(item.price).toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Needs confirmation — low-confidence matches */}
            {confirmations.filter(c => c.status === 'pending').length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.honey, marginBottom: '6px' }}>
                  Sage wasn't sure about these — can you help?
                </div>
                {confirmations.map((item, i) => {
                  if (item.status !== 'pending') return null
                  return (
                    <div key={i} style={{
                      padding: '12px', marginBottom: '8px', background: 'white',
                      borderRadius: '10px', border: `1px solid ${C.linen}`,
                    }}>
                      <div style={{ fontSize: '12px', color: C.driftwood, marginBottom: '4px' }}>
                        {item.receiptItem} — ${Number(item.price).toFixed(2)}
                      </div>
                      {item.suggestedMatch && (
                        <div style={{ fontSize: '13px', color: C.ink, marginBottom: '8px' }}>
                          Is this → <strong>{sentenceCase(item.suggestedMatch)}</strong>?
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => confirmMatch(i)} style={{
                          padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500,
                          background: C.forest, color: 'white', border: 'none', cursor: 'pointer',
                          fontFamily: "'Jost', sans-serif",
                        }}>Yes</button>
                        <button onClick={() => skipMatch(i)} style={{
                          padding: '6px 14px', borderRadius: '8px', fontSize: '12px',
                          background: 'none', color: C.driftwood, border: `1px solid ${C.linen}`,
                          cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                        }}>No, skip</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Confirmed items summary */}
            {confirmations.filter(c => c.status === 'confirmed').length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                {confirmations.filter(c => c.status === 'confirmed').map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 0', borderBottom: '1px solid rgba(200,185,160,0.1)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={C.sage} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                      <span style={{ fontSize: '12px', color: C.driftwood }}>{sentenceCase(item.suggestedMatch || item.receiptItem)} — confirmed</span>
                    </div>
                    <span style={{ fontSize: '12px', color: C.driftwood }}>${Number(item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Unmatched items */}
            {scanResult.unmatchedItems?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.honey, marginBottom: '6px' }}>
                  Unmatched Items
                </div>
                {scanResult.unmatchedItems.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: '1px solid rgba(200,185,160,0.2)',
                  }}>
                    <span style={{ fontSize: '13px', color: C.honey }}>{item.name}</span>
                    {item.price != null && (
                      <span style={{ fontSize: '13px', color: C.driftwood }}>${Number(item.price).toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Sage nudge for needs_review */}
            {scanResult.reconciliation_status === 'needs_review' && (
              <SageNudgeCard
                message="A few items didn't match your list — they may be store brands or combined purchases. Your total has been captured."
              />
            )}

            {/* Done button — only when all confirmations resolved */}
            {allConfirmed && (
              <button onClick={() => navigate('/pantry')} style={{
                width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
                background: C.forest, color: 'white', cursor: 'pointer', marginTop: '20px',
                fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
                boxShadow: '0 4px 16px rgba(30,55,35,0.25)',
              }}>Looks good →</button>
            )}
          </div>
        )}
      </div>

      <BottomNav activeTab="pantry" />
    </div>
  )
}
