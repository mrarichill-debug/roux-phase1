/**
 * AddDayTypeSheet.jsx — Reusable bottom sheet for creating a new day type.
 */
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import BottomSheet from './BottomSheet'

const C = {
  forest: '#3D6B4F', ink: '#2C2417', driftwood: '#8C7B6B', linen: '#E8E0D0',
}

const COLOR_OPTIONS = ['#5B8DD9','#7A8C6E','#D4874A','#C49A3C','#8B6F52','#A03030','#3D6B4F']

export default function AddDayTypeSheet({ open, onClose, householdId, onSaved }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#7A8C6E')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) { setName(''); setColor('#7A8C6E'); setSaving(false) }
  }, [open])

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const { data, error } = await supabase.from('day_types').insert({
        household_id: householdId,
        name: name.trim(),
        color,
      }).select('id, name, color').single()
      if (error) throw error
      onSaved(data)
      onClose()
    } catch (err) {
      console.error('[Roux] AddDayTypeSheet save error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={open} onClose={onClose} title="New day type">
      <div style={{ padding: '4px 22px 24px' }}>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Day type name"
          autoFocus style={{
            width: '100%', padding: '12px 14px', fontSize: '14px', fontFamily: "'Jost', sans-serif",
            border: `1.5px solid ${C.linen}`, borderRadius: '10px', outline: 'none', color: C.ink,
            boxSizing: 'border-box', marginBottom: '12px',
          }}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
        />
        <div style={{ fontSize: '11px', color: C.driftwood, fontWeight: 300, marginBottom: '8px' }}>Color</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {COLOR_OPTIONS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: '28px', height: '28px', borderRadius: '50%',
              border: color === c ? `2px solid ${C.ink}` : '2px solid transparent',
              background: c, cursor: 'pointer',
            }} />
          ))}
        </div>
        <button onClick={handleSave} disabled={!name.trim() || saving} style={{
          width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
          background: name.trim() ? C.forest : C.linen, color: name.trim() ? 'white' : C.driftwood,
          fontSize: '14px', fontWeight: 500, fontFamily: "'Jost', sans-serif",
          cursor: name.trim() ? 'pointer' : 'default',
        }}>
          {saving ? 'Saving...' : 'Add day type'}
        </button>
      </div>
    </BottomSheet>
  )
}
