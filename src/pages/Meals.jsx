/**
 * Meals.jsx — Meals history sub-tab.
 * Shows unique meal names from planned_meals with week count.
 * Tab strip: [ Meals ] [ Recipes ] [ Staples ]
 */
import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLog'
import { uploadMealPhoto } from '../lib/uploadMealPhoto'
import TopBar from '../components/TopBar'
import BottomSheet from '../components/BottomSheet'
import BottomNav from '../components/BottomNav'
import { useArc } from '../context/ArcContext'
import { color, alpha, elevation } from '../styles/tokens'

const MEAL_TYPE_LABELS = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner',
  snack: 'Snack', other: 'Other',
}

const TYPE_FILTERS = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
// TODO: upgrade to ingredient-based matching
const PROTEIN_FILTERS = ['Chicken', 'Beef', 'Pork', 'Fish', 'Vegetarian']

export default function Meals({ appUser }) {
  const navigate = useNavigate()
  const { color: arcColor } = useArc()
  const [meals, setMeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMeal, setSelectedMeal] = useState(null)

  // Favorites
  const [familyMembers, setFamilyMembers] = useState([])
  const [allFavorites, setAllFavorites] = useState([]) // [{ family_member_id, meal_name }]
  const [favPickerOpen, setFavPickerOpen] = useState(false)
  const [favPickerMeal, setFavPickerMeal] = useState(null)
  const [favPickerSelected, setFavPickerSelected] = useState(new Set())

  // Search + filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState(null)
  const [proteinFilter, setProteinFilter] = useState(null)
  const [showFavsOnly, setShowFavsOnly] = useState(false)
  const [showNotRecent, setShowNotRecent] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  useEffect(() => {
    if (!appUser?.household_id) return
    load()
    supabase.from('family_members').select('id, name, is_pet')
      .eq('household_id', appUser.household_id).eq('is_pet', false).order('name')
      .then(({ data }) => setFamilyMembers(data ?? []))
    supabase.from('meal_favorites').select('family_member_id, meal_name')
      .eq('household_id', appUser.household_id)
      .then(({ data }) => setAllFavorites(data ?? []))
  }, [appUser?.household_id])

  async function load() {
    // Dual-read pass (PR 2 of meals-as-records, see docs/HANDOFF-MEALS-AS-RECORDS.md):
    // primary source is the `meals` table; weekCount / lastDate / meal_type are
    // aggregated by joining back through planned_meals.meal_id. Any planned_meals
    // row without a meal_id (orphan / pre-backfill) falls back to grouping by
    // custom_name. Both paths render identical card shapes.
    const [{ data: mealRecords }, { data: pmRows }] = await Promise.all([
      supabase
        .from('meals')
        .select('id, name, photo_url, is_archived')
        .eq('household_id', appUser.household_id)
        .eq('is_archived', false),
      supabase
        .from('planned_meals')
        .select('meal_id, custom_name, meal_type, meal_plan_id, planned_date')
        .eq('household_id', appUser.household_id)
        .is('removed_at', null)
        .not('meal_type', 'in', '("eating_out","leftovers")')
        .neq('entry_type', 'eating_out'),
    ])

    // Aggregate planned_meals signals keyed by meal_id when present, else
    // by lowercased custom_name (the legacy bucket).
    const aggByMealId = {}
    const aggByName = {}
    for (const m of (pmRows || [])) {
      const bucket = m.meal_id
        ? (aggByMealId[m.meal_id] ||= { plans: new Set(), dates: new Set(), lastDate: null, meal_type: m.meal_type || 'dinner' })
        : (() => {
            const name = String(m.custom_name || '').trim()
            if (!name) return null
            const lk = name.toLowerCase()
            return (aggByName[lk] ||= { name, plans: new Set(), dates: new Set(), lastDate: null, meal_type: m.meal_type || 'dinner' })
          })()
      if (!bucket) continue
      if (m.meal_plan_id) bucket.plans.add(m.meal_plan_id)
      if (m.planned_date) bucket.dates.add(m.planned_date)
      if (m.planned_date && (!bucket.lastDate || m.planned_date > bucket.lastDate)) {
        bucket.lastDate = m.planned_date
        bucket.meal_type = m.meal_type || bucket.meal_type
      }
    }

    const fromRecords = (mealRecords || []).map(r => {
      const agg = aggByMealId[r.id] || { plans: new Set(), dates: new Set(), lastDate: null, meal_type: 'dinner' }
      return {
        id: r.id,
        name: r.name,
        photo_url: r.photo_url || null,
        meal_type: agg.meal_type,
        weekCount: agg.plans.size || agg.dates.size,
        lastDate: agg.lastDate,
      }
    })
    const fromOrphans = Object.values(aggByName).map(g => ({
      id: null,
      name: g.name,
      photo_url: null,
      meal_type: g.meal_type,
      weekCount: g.plans.size || g.dates.size,
      lastDate: g.lastDate,
    }))

    const sorted = [...fromRecords, ...fromOrphans]
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    setMeals(sorted)
    setLoading(false)
  }

  // Favorites helpers
  const favsByMeal = useMemo(() => {
    const map = {}
    for (const f of allFavorites) {
      const key = f.meal_name
      if (!map[key]) map[key] = []
      map[key].push(f.family_member_id)
    }
    return map
  }, [allFavorites])

  function getMealFavMembers(mealName) {
    const key = mealName.toLowerCase().trim()
    const memberIds = favsByMeal[key] || []
    return familyMembers.filter(m => memberIds.includes(m.id))
  }

  function openFavPicker(meal) {
    setFavPickerMeal(meal)
    const key = meal.name.toLowerCase().trim()
    const existing = (favsByMeal[key] || [])
    setFavPickerSelected(new Set(existing))
    setFavPickerOpen(true)
  }

  async function toggleFav(memberId) {
    if (!favPickerMeal || !appUser?.household_id) return
    const key = favPickerMeal.name.toLowerCase().trim()
    const next = new Set(favPickerSelected)
    if (next.has(memberId)) {
      next.delete(memberId)
      await supabase.from('meal_favorites').delete()
        .eq('household_id', appUser.household_id)
        .eq('family_member_id', memberId)
        .eq('meal_name', key)
      setAllFavorites(prev => prev.filter(f => !(f.meal_name === key && f.family_member_id === memberId)))
    } else {
      next.add(memberId)
      await supabase.from('meal_favorites').upsert({
        household_id: appUser.household_id,
        family_member_id: memberId,
        meal_name: key,
      }, { onConflict: 'household_id,family_member_id,meal_name' })
      setAllFavorites(prev => [...prev, { family_member_id: memberId, meal_name: key }])
    }
    setFavPickerSelected(next)
  }

  // Filtered meals
  const hasActiveFilters = !!search.trim() || typeFilter || proteinFilter || showFavsOnly || showNotRecent

  const filteredMeals = useMemo(() => {
    let result = [...meals]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(m => m.name.toLowerCase().includes(q))
    }
    if (typeFilter) {
      const tf = typeFilter.toLowerCase()
      result = result.filter(m => m.meal_type === tf)
    }
    if (proteinFilter) {
      const pf = proteinFilter.toLowerCase()
      result = result.filter(m => m.name.toLowerCase().includes(pf))
    }
    if (showFavsOnly) {
      result = result.filter(m => (favsByMeal[m.name.toLowerCase().trim()] || []).length > 0)
    }
    if (showNotRecent) {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const cutoff = thirtyDaysAgo.toISOString().split('T')[0]
      result = result.filter(m => !m.lastDate || m.lastDate < cutoff)
      result.sort((a, b) => (a.lastDate || '').localeCompare(b.lastDate || ''))
    }
    return result
  }, [meals, search, typeFilter, proteinFilter, showFavsOnly, showNotRecent, favsByMeal])

  const filterSummary = useMemo(() => {
    const parts = []
    if (typeFilter) parts.push(typeFilter)
    if (proteinFilter) parts.push(proteinFilter)
    if (showFavsOnly) parts.push('Favorites')
    if (showNotRecent) parts.push('Not recent')
    return parts.length > 0 ? `Filtered by ${parts.join(' + ')}` : ''
  }, [typeFilter, proteinFilter, showFavsOnly, showNotRecent])

  function clearFilters() {
    setSearch('')
    setTypeFilter(null)
    setProteinFilter(null)
    setShowFavsOnly(false)
    setShowNotRecent(false)
  }

  function formatLastDate(dateStr) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const today = new Date(); today.setHours(0,0,0,0)
    const date = new Date(y, m - 1, d)
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (date.getTime() === today.getTime()) return 'Today'
    if (date > today) return `Coming ${label}`
    return `Last ${label}`
  }

  function addToWeek(meal) {
    setSelectedMeal(null)
    logActivity({ user: appUser, actionType: 'meal_reuse_from_history', targetType: 'meal', targetName: meal.name })
    navigate('/plan', { state: { prefillMeal: meal.name, prefillType: meal.meal_type } })
  }

  // Photo upload — meal-photos bucket, optimistic update, writes meals.photo_url.
  // Only available on meals with a real id (not orphan/legacy rows aggregated
  // from planned_meals.custom_name).
  const photoInputRef = useRef(null)
  const [uploadingMealId, setUploadingMealId] = useState(null)

  async function handleMealPhoto(e, meal) {
    const file = e.target.files?.[0]
    if (!file || !meal?.id) return
    e.target.value = '' // allow re-selecting the same file later
    if (!appUser?.household_id) return
    setUploadingMealId(meal.id)
    try {
      const { publicUrl } = await uploadMealPhoto({
        file,
        householdId: appUser.household_id,
        mealId: meal.id,
      })
      const { error } = await supabase.from('meals').update({ photo_url: publicUrl }).eq('id', meal.id)
      if (error) throw error
      // Optimistic update of the local list
      setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, photo_url: publicUrl } : m))
      setSelectedMeal(prev => prev && prev.id === meal.id ? { ...prev, photo_url: publicUrl } : prev)
      logActivity({ user: appUser, actionType: 'meal_photo_added', targetType: 'meal', targetId: meal.id, targetName: meal.name })
    } catch (err) {
      console.error('[Meals] Photo upload failed:', err)
      alert(`Photo upload failed: ${err.message || err}`)
    } finally {
      setUploadingMealId(null)
    }
  }

  const filterPill = (label, active, onClick) => (
    <button onClick={onClick} style={{
      padding: '6px 14px', borderRadius: '20px',
      border: active ? `1.5px solid ${arcColor}` : `1px solid ${color.rule}`,
      background: active ? 'rgba(61,107,79,0.08)' : 'white',
      color: active ? arcColor : color.ink,
      fontFamily: "'Jost', sans-serif", fontSize: '13px',
      fontWeight: active ? 500 : 400, cursor: 'pointer',
    }}>{label}</button>
  )

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
          const active = label === 'Meals'
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

      {/* Search + filter icon */}
      <div style={{ padding: '8px 18px 10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: color.inkSoft, display: 'flex', alignItems: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search meals…" style={{
              width: '100%', background: 'white',
              border: '1px solid rgba(200,185,160,0.55)', borderRadius: '10px',
              padding: '10px 14px 10px 36px',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 300,
              color: color.ink, outline: 'none', boxSizing: 'border-box',
            }} />
        </div>
        <button onClick={() => setFilterSheetOpen(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          position: 'relative', padding: '6px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={color.inkSoft} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/>
            <line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/>
            <line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/>
            <line x1="1" x2="7" y1="14" y2="14"/><line x1="9" x2="15" y1="8" y2="8"/><line x1="17" x2="23" y1="16" y2="16"/>
          </svg>
          {hasActiveFilters && (
            <span style={{ position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px', borderRadius: '50%', background: color.honey }} />
          )}
        </button>
      </div>
      {/* Active filter summary */}
      {hasActiveFilters && filterSummary && (
        <button onClick={() => setFilterSheetOpen(true)} style={{
          display: 'block', width: '100%', textAlign: 'left',
          padding: '0 22px 8px', background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: "'Jost', sans-serif",
          fontSize: '12px', fontWeight: 300, color: color.inkSoft,
        }}>{filterSummary}</button>
      )}

      <div style={{ padding: '8px 22px 0' }}>
        {loading ? (
          <div>
            {[1,2,3,4,5].map(i => <div key={i} className="shimmer-block" style={{ height: '72px', borderRadius: '14px', marginBottom: '10px' }} />)}
          </div>
        ) : filteredMeals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: '16px', color: color.inkSoft, lineHeight: 1.7 }}>
              {hasActiveFilters ? 'No meals match your filters.' : 'No meals planned yet.'}
            </div>
            {!hasActiveFilters && (
              <div style={{ fontSize: '13px', color: color.inkSoft, marginTop: '4px' }}>
                Meals you add to your weekly plan will show up here.
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredMeals.map((m, i) => {
              const favMembers = getMealFavMembers(m.name)
              return (
                <button key={i} onClick={() => setSelectedMeal(m)} style={{
                  background: 'white', borderRadius: '14px', padding: '14px 16px',
                  border: `1px solid ${color.rule}`, cursor: 'pointer',
                  textAlign: 'left', width: '100%',
                  opacity: 0, animation: `fadeUp 0.4s ease ${0.03 * Math.min(i, 10)}s forwards`,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Playfair Display', serif", fontSize: '16px',
                      fontWeight: 500, color: color.ink, marginBottom: '6px',
                    }}>{m.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {MEAL_TYPE_LABELS[m.meal_type] && (
                        <span style={{
                          fontSize: '10px', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase',
                          padding: '2px 8px', borderRadius: '4px',
                          background: `${arcColor}12`, color: arcColor,
                          fontFamily: "'Jost', sans-serif",
                        }}>{MEAL_TYPE_LABELS[m.meal_type]}</span>
                      )}
                      <span style={{ fontSize: '12px', color: color.inkSoft, fontWeight: 300 }}>
                        {m.weekCount} week{m.weekCount !== 1 ? 's' : ''}
                      </span>
                      {m.lastDate && (
                        <span style={{ fontSize: '12px', color: color.inkSoft, fontWeight: 300 }}>
                          · {formatLastDate(m.lastDate)}
                        </span>
                      )}
                    </div>
                    {favMembers.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                        <span style={{ fontSize: '11px', color: color.honey }}>★</span>
                        <span style={{ fontSize: '11px', color: color.inkSoft, fontWeight: 300 }}>
                          {favMembers.map(fm => fm.name.split(' ')[0]).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Tap-to-add bottom sheet */}
      <BottomSheet isOpen={!!selectedMeal && !favPickerOpen} onClose={() => setSelectedMeal(null)}>
        <div style={{ padding: '20px 22px 24px' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: color.ink, marginBottom: '16px' }}>
            {selectedMeal?.name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button onClick={() => addToWeek(selectedMeal)} style={{
              width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
              background: arcColor, color: 'white', cursor: 'pointer',
              fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
              boxShadow: elevation.modal,
            }}>Add to this week</button>
            <button onClick={() => { setSelectedMeal(null); openFavPicker(selectedMeal) }} style={{
              width: '100%', padding: '12px', borderRadius: '14px',
              border: `1px solid ${color.rule}`, background: 'white',
              color: color.ink, cursor: 'pointer',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 400,
            }}>★ Mark as favorite</button>
            {selectedMeal?.id && (
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingMealId === selectedMeal?.id}
                style={{
                  width: '100%', padding: '12px', borderRadius: '14px',
                  border: `1px solid ${color.rule}`, background: 'white',
                  color: color.ink, cursor: 'pointer',
                  fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 400,
                  opacity: uploadingMealId === selectedMeal?.id ? 0.6 : 1,
                }}
              >
                {uploadingMealId === selectedMeal?.id
                  ? 'Uploading…'
                  : selectedMeal.photo_url ? '📷 Change photo' : '📷 Add a photo'}
              </button>
            )}
            <button onClick={() => setSelectedMeal(null)} style={{
              width: '100%', padding: '12px', borderRadius: '14px', border: 'none',
              background: 'none', color: color.inkSoft, cursor: 'pointer',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 300,
            }}>Close</button>
          </div>
        </div>
      </BottomSheet>
      {/* Hidden file input — single ref reused for whichever meal is selected */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={(e) => handleMealPhoto(e, selectedMeal)}
        style={{ display: 'none' }}
      />

      {/* Favorites member picker */}
      <BottomSheet isOpen={favPickerOpen} onClose={() => setFavPickerOpen(false)}>
        <div style={{ padding: '20px 22px 24px' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', fontWeight: 500, color: color.ink, marginBottom: '4px' }}>
            {favPickerMeal?.name}
          </div>
          <div style={{ fontSize: '12px', color: color.inkSoft, marginBottom: '16px' }}>Who loves this meal?</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
            {familyMembers.map(member => {
              const isSelected = favPickerSelected.has(member.id)
              return (
                <button key={member.id} onClick={() => toggleFav(member.id)} style={{
                  padding: '8px 16px', borderRadius: '20px',
                  border: `1px solid ${isSelected ? color.honey : color.rule}`,
                  background: isSelected ? 'rgba(196,154,60,0.1)' : 'white',
                  color: isSelected ? color.honey : color.inkSoft,
                  fontSize: '13px', fontFamily: "'Jost', sans-serif", cursor: 'pointer',
                  fontWeight: isSelected ? 500 : 400,
                }}>{isSelected ? '★ ' : ''}{member.name.split(' ')[0]}</button>
              )
            })}
          </div>
          <button onClick={() => setFavPickerOpen(false)} style={{
            width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
            background: arcColor, color: 'white', cursor: 'pointer',
            fontFamily: "'Jost', sans-serif", fontSize: '15px', fontWeight: 500,
          }}>Done</button>
        </div>
      </BottomSheet>

      {/* Filter sheet */}
      <BottomSheet isOpen={filterSheetOpen} onClose={() => setFilterSheetOpen(false)} maxHeight="70vh">
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', color: color.inkSoft, fontWeight: 500, marginBottom: '10px' }}>
              Meal type
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {TYPE_FILTERS.map(t => filterPill(t, typeFilter === t, () => setTypeFilter(typeFilter === t ? null : t)))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', color: color.inkSoft, fontWeight: 500, marginBottom: '10px' }}>
              {/* TODO: upgrade to ingredient-based matching */}
              Protein
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PROTEIN_FILTERS.map(p => filterPill(p, proteinFilter === p, () => setProteinFilter(proteinFilter === p ? null : p)))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '1.2px', textTransform: 'uppercase', color: color.inkSoft, fontWeight: 500, marginBottom: '10px' }}>
              More
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {filterPill('★ Favorites', showFavsOnly, () => setShowFavsOnly(!showFavsOnly))}
              {filterPill('Not recent', showNotRecent, () => setShowNotRecent(!showNotRecent))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={() => setFilterSheetOpen(false)} style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              background: arcColor, color: 'white', border: 'none',
              fontFamily: "'Jost', sans-serif", fontSize: '14px', fontWeight: 500, cursor: 'pointer',
            }}>Show meals</button>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'Jost', sans-serif", fontSize: '12px',
                color: color.inkSoft, fontWeight: 300, padding: '4px',
              }}>Clear all</button>
            )}
          </div>
        </div>
      </BottomSheet>

      <BottomNav activeTab="meals" />
    </div>
  )
}
