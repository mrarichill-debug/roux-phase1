import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import TopBar from '../components/TopBar'
import BottomNav from '../components/BottomNav'
import { useArc } from '../context/ArcContext'
import { color, alpha, elevation } from '../styles/tokens'

const CATEGORIES = [
  { key: 'dairy', label: 'Dairy' },
  { key: 'produce', label: 'Produce' },
  { key: 'meat', label: 'Meat' },
  { key: 'bakery', label: 'Bakery' },
  { key: 'frozen', label: 'Frozen' },
  { key: 'pantry', label: 'Pantry' },
  { key: 'other', label: 'Other' },
]

export default function Staples({ appUser }) {
  const navigate = useNavigate()
  const { color: arcColor } = useArc()
  const [staples, setStaples] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addIngName, setAddIngName] = useState('')
  const [addIngQty, setAddIngQty] = useState('')
  const [addIngUnit, setAddIngUnit] = useState('')
  const [addCategory, setAddCategory] = useState('other')
  const [saving, setSaving] = useState(false)
  const [editStaple, setEditStaple] = useState(null)

  useEffect(() => {
    if (!appUser?.household_id) return
    loadStaples()
  }, [appUser?.household_id])

  async function loadStaples() {
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, name, category')
      .eq('household_id', appUser.household_id)
      .eq('recipe_type', 'quick')
      .order('name')
    if (recipes) {
      const ids = recipes.map(r => r.id)
      let ingMap = {}
      if (ids.length) {
        const { data: ings } = await supabase
          .from('ingredients')
          .select('recipe_id, name, quantity, unit')
          .in('recipe_id', ids)
          .order('sort_order')
        for (const ing of (ings || [])) {
          if (!ingMap[ing.recipe_id]) ingMap[ing.recipe_id] = ing
        }
      }
      setStaples(recipes.map(r => ({ ...r, primaryIng: ingMap[r.id] || null })))
    }
    setLoading(false)
  }

  function openEdit(staple) {
    setEditStaple(staple)
    setAddName(staple.name || '')
    setAddIngName(staple.primaryIng?.name || '')
    setAddIngQty(staple.primaryIng?.quantity || '')
    setAddIngUnit(staple.primaryIng?.unit || '')
    setAddCategory(staple.category || 'other')
    setShowAdd(true)
  }

  function openAdd() {
    setEditStaple(null)
    setAddName('')
    setAddIngName('')
    setAddIngQty('')
    setAddIngUnit('')
    setAddCategory('other')
    setShowAdd(true)
  }

  async function handleSave() {
    if (!addName.trim() || saving) return
    setSaving(true)
    console.log('[Roux] Staple save:', { name: addName.trim(), household_id: appUser.household_id, category: addCategory })
    try {
      const { data: recipe, error } = await supabase.from('recipes').insert({
        household_id: appUser.household_id,
        added_by: appUser.id,
        name: addName.trim(),
        recipe_type: 'quick',
        status: 'complete',
        visibility: 'household',
        category: addCategory,
      }).select('id').single()
      console.log('[Roux] Staple insert result:', { recipe, error: error?.message })
      if (error) throw error

      if (addIngName.trim()) {
        const nameLower = addIngName.trim().toLowerCase()
        let { data: existing } = await supabase.from('pantry_items').select('id')
          .eq('household_id', appUser.household_id).ilike('name', nameLower).maybeSingle()
        if (!existing) {
          const { data: created } = await supabase.from('pantry_items').insert({
            household_id: appUser.household_id, name: nameLower, default_unit: addIngUnit || 'piece',
          }).select('id').single()
          existing = created
        }
        await supabase.from('ingredients').insert({
          recipe_id: recipe.id,
          name: addIngName.trim(),
          quantity: addIngQty.trim() || null,
          unit: addIngUnit.trim() || null,
          sort_order: 0,
          grocery_category: addCategory,
          pantry_item_id: existing?.id || null,
        })
      }

      logActivity({ user: appUser, actionType: 'recipe_saved', targetType: 'recipe', targetId: recipe.id, targetName: addName.trim(), metadata: { recipe_type: 'quick' } })
      setShowAdd(false)
      setAddName('')
      setAddIngName('')
      setAddIngQty('')
      setAddIngUnit('')
      setAddCategory('other')
      loadStaples()
    } catch (err) {
      console.error('[Roux] Save staple error:', err.message)
    }
    setSaving(false)
  }

  async function handleUpdate() {
    if (!addName.trim() || !editStaple || saving) return
    setSaving(true)
    try {
      await supabase.from('recipes').update({
        name: addName.trim(),
        category: addCategory,
      }).eq('id', editStaple.id)

      await supabase.from('ingredients').delete().eq('recipe_id', editStaple.id)
      if (addIngName.trim()) {
        const nameLower = addIngName.trim().toLowerCase()
        let { data: existing } = await supabase.from('pantry_items').select('id')
          .eq('household_id', appUser.household_id).ilike('name', nameLower).maybeSingle()
        if (!existing) {
          const { data: created } = await supabase.from('pantry_items').insert({
            household_id: appUser.household_id, name: nameLower, default_unit: addIngUnit || 'piece',
          }).select('id').single()
          existing = created
        }
        await supabase.from('ingredients').insert({
          recipe_id: editStaple.id,
          name: addIngName.trim(),
          quantity: addIngQty.trim() || null,
          unit: addIngUnit.trim() || null,
          sort_order: 0,
          grocery_category: addCategory,
          pantry_item_id: existing?.id || null,
        })
      }

      logActivity({ user: appUser, actionType: 'recipe_edited', targetType: 'recipe', targetId: editStaple.id, targetName: addName.trim(), metadata: { recipe_type: 'quick' } })
      setShowAdd(false)
      setEditStaple(null)
      loadStaples()
    } catch (err) {
      console.error('[Roux] Update staple error:', err.message)
    }
    setSaving(false)
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: '10px',
    border: `1px solid ${color.rule}`, fontFamily: "'Jost', sans-serif",
    fontSize: '14px', fontWeight: 300, outline: 'none', color: color.ink,
    boxSizing: 'border-box',
  }

  return (
    <div style={{
      background: color.paper, minHeight: '100vh', maxWidth: '430px',
      margin: '0 auto', fontFamily: "'Jost', sans-serif",
      paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 8px))',
    }}>
      <TopBar />

      {/* Sub-tab strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', margin: '0 22px' }}>
        {[['Meals', '/meals/history'], ['Recipes', '/meals/recipes'], ['Staples', '/meals/staples']].map(([label, path]) => {
          const active = label === 'Staples'
          return (
            <button key={label} onClick={() => !active && navigate(path)} style={{
              padding: '14px', textAlign: 'center',
              fontFamily: "'Jost', sans-serif", fontSize: '12px',
              fontWeight: 500, letterSpacing: '1.5px', textTransform: 'uppercase',
              color: active ? arcColor : color.inkSoft,
              cursor: active ? 'default' : 'pointer', border: 'none', background: 'none',
              borderBottom: active ? `2px solid ${arcColor}` : '2px solid transparent',
              transition: 'color 0.2s cubic-bezier(0.22,1,0.36,1), border-color 0.2s cubic-bezier(0.22,1,0.36,1)',
            }}>{label}</button>
          )
        })}
      </div>

      <div style={{ padding: '8px 22px 0' }}>
        {loading ? (
          <div>
            {[1,2,3].map(i => <div key={i} className="shimmer-block" style={{ height: '60px', borderRadius: '14px', marginBottom: '10px' }} />)}
          </div>
        ) : staples.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '16px', color: color.inkSoft, lineHeight: 1.7 }}>
              No staples yet.
            </div>
            <div style={{ fontSize: '13px', color: color.inkSoft, marginTop: '4px' }}>
              Staples are quick items like Yogurt or Toast that don't need a full recipe.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {staples.map((s, i) => (
              <div key={s.id} onClick={() => openEdit(s)} style={{
                background: 'white', borderRadius: '14px', padding: '14px 16px',
                border: `1px solid ${color.rule}`, cursor: 'pointer',
                opacity: 0, animation: `fadeUp 0.4s ease ${0.03 * i}s forwards`,
              }}>
                <div style={{
                  fontFamily: "'Playfair Display', serif", fontSize: '15px',
                  fontWeight: 500, color: color.ink,
                }}>{s.name}</div>
                {s.primaryIng && (
                  <div style={{ fontSize: '12px', color: color.inkSoft, fontWeight: 300, marginTop: '3px' }}>
                    {[s.primaryIng.quantity, s.primaryIng.unit, s.primaryIng.name].filter(Boolean).join(' ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FAB: Add a Staple ─────────────────────────────────────── */}
      <button
        onClick={openAdd}
        style={{
          position: 'fixed', bottom: 'calc(58px + env(safe-area-inset-bottom, 8px))', right: '20px',
          width: '56px', height: '56px', borderRadius: '50%',
          background: arcColor, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 50,
          animation: 'fabIn 0.35s cubic-bezier(0.22,1,0.36,1) 0.1s both',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" style={{ width: 24, height: 24 }}>
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {/* ── Add Staple — full-page overlay (keyboard safe) ─────── */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, background: color.paper, zIndex: 300,
          display: 'flex', flexDirection: 'column', maxWidth: '430px', margin: '0 auto',
        }}>
          <div style={{
            background: color.forest, padding: '10px 16px 12px',
            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          }}>
            <button onClick={() => { setShowAdd(false); setEditStaple(null) }} style={{
              background: 'rgba(250,247,242,0.15)', border: 'none', borderRadius: '50%',
              width: 32, height: 32, color: 'white', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>‹</button>
            <span style={{ fontFamily: "'Slabo 27px', serif", fontSize: 18, color: 'rgba(250,247,242,0.95)' }}>
              {editStaple ? 'Edit Staple' : 'Add a Staple'}
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', color: color.inkSoft, marginBottom: '8px' }}>
              Name
            </div>
            <input type="text" value={addName} onChange={e => setAddName(e.target.value)}
              placeholder="e.g. Yogurt" autoFocus style={{ ...inputStyle, marginBottom: '20px' }} />

            <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', color: color.inkSoft, marginBottom: '8px' }}>
              Ingredient (optional)
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input type="text" value={addIngQty} onChange={e => setAddIngQty(e.target.value)}
                placeholder="Qty" style={{ ...inputStyle, width: '60px', flex: 'none' }} />
              <input type="text" value={addIngUnit} onChange={e => setAddIngUnit(e.target.value)}
                placeholder="Unit" style={{ ...inputStyle, width: '70px', flex: 'none' }} />
              <input type="text" value={addIngName} onChange={e => setAddIngName(e.target.value)}
                placeholder="Ingredient name" style={{ ...inputStyle, flex: 1 }} />
            </div>

            <div style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase', color: color.inkSoft, marginBottom: '8px' }}>
              Grocery Category
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px' }}>
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setAddCategory(c.key)} style={{
                  padding: '5px 12px', borderRadius: '16px', fontSize: '11px',
                  border: addCategory === c.key ? `1.5px solid ${arcColor}` : `1px solid ${color.rule}`,
                  background: addCategory === c.key ? `${arcColor}15` : 'white',
                  color: addCategory === c.key ? arcColor : color.ink,
                  cursor: 'pointer', fontFamily: "'Jost', sans-serif",
                }}>{c.label}</button>
              ))}
            </div>

            <button onClick={editStaple ? handleUpdate : handleSave} disabled={!addName.trim() || saving} style={{
              width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
              background: addName.trim() ? arcColor : color.rule,
              color: addName.trim() ? 'white' : color.inkSoft,
              cursor: addName.trim() ? 'pointer' : 'default',
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
              boxShadow: addName.trim() ? '0 4px 16px rgba(30,55,35,0.25)' : 'none',
            }}>{saving ? 'Saving...' : editStaple ? 'Update Staple' : 'Save Staple'}</button>
          </div>
        </div>
      )}

      <BottomNav activeTab="meals" />
    </div>
  )
}
