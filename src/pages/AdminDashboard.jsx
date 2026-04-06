/**
 * AdminDashboard.jsx — Internal admin health dashboard.
 * Visible to household admins only. No topbar, no bottom nav.
 */
import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getArcStage } from '../lib/getArcStage'
import { getArcColor } from '../lib/getArcColor'

// ⚠️ PRE-LAUNCH: Replace with proper role-based auth before opening to other users
const HILL_HOUSEHOLD = '53f6a197-544a-48e6-9a46-23d7252399c2'

const C = {
  forest: '#3D6B4F', cream: '#FAF7F2', ink: '#2C2417',
  driftwood: '#8C7B6B', linen: '#E4DDD2',
}

export default function AdminDashboard({ appUser }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({})

  // ⚠️ PRE-LAUNCH: Replace with proper role-based auth before opening to other users
  const ADMIN_USER_IDS = [
    '1fb645c3-14a4-4057-afb3-9e803c3cca78', // Aric
    '18c38c61-fb49-4c29-a4c2-e8907a554dac',  // Lauren
  ]
  if (!appUser || !ADMIN_USER_IDS.includes(appUser.id)) {
    return <Navigate to="/" replace />
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const hid = appUser.household_id || HILL_HOUSEHOLD
    try {
      const [
        usersRes, laurenRes,
        mealsCountRes, receiptsRes, weeksRes, skipsRes,
        itemsRes, noCatRes,
        sageRecentRes, sageUnseenRes,
        recipesRes, quickRes, withPhotoRes, recentRecipesRes,
        currentPlanRes, autoClosedRes, reviewedRes, weekMealsRes,
      ] = await Promise.all([
        // Section 1: Household Health
        supabase.from('users').select('id, name, role, membership_status', { count: 'exact' }).eq('household_id', hid),
        supabase.from('users').select('name, updated_at, last_sign_in_at').eq('id', '18c38c61-fb49-4c29-a4c2-e8907a554dac').maybeSingle(),
        // Arc stage queries
        supabase.from('planned_meals').select('id', { count: 'exact', head: true }).eq('household_id', hid).eq('status', 'planned'),
        supabase.from('shopping_trips').select('id', { count: 'exact', head: true }).eq('household_id', hid).not('receipt_photo_url', 'is', null),
        supabase.from('meal_plans').select('id', { count: 'exact', head: true }).eq('household_id', hid).not('reviewed_at', 'is', null),
        supabase.from('planned_meals').select('id', { count: 'exact', head: true }).eq('household_id', hid).eq('status', 'skipped'),
        // Section 2: The List
        supabase.from('shopping_list_items').select('grocery_category', { count: 'exact' }).eq('household_id', hid).eq('status', 'active').eq('approval_status', 'approved'),
        supabase.from('shopping_list_items').select('id', { count: 'exact', head: true }).eq('household_id', hid).eq('status', 'active').is('grocery_category', null),
        // Section 3: Intelligence
        supabase.from('sage_background_activity').select('activity_type, seen, message, created_at').eq('household_id', hid).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('created_at', { ascending: false }),
        supabase.from('sage_background_activity').select('id', { count: 'exact', head: true }).eq('household_id', hid).eq('seen', false),
        // Section 4: Recipe Library
        supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('household_id', hid),
        supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('household_id', hid).eq('recipe_type', 'quick'),
        supabase.from('recipe_photos').select('id', { count: 'exact', head: true }),
        supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('household_id', hid).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        // Section 6: Week Status
        supabase.from('meal_plans').select('id, status, reviewed_at, auto_closed, week_start_date').eq('household_id', hid).order('week_start_date', { ascending: false }).limit(1),
        supabase.from('meal_plans').select('id', { count: 'exact', head: true }).eq('household_id', hid).eq('auto_closed', true),
        supabase.from('meal_plans').select('id', { count: 'exact', head: true }).eq('household_id', hid).not('reviewed_at', 'is', null).neq('auto_closed', true),
        supabase.from('planned_meals').select('id', { count: 'exact', head: true }).eq('household_id', hid).eq('status', 'planned'),
      ])

      const arcStage = getArcStage({
        mealsCount: mealsCountRes.count ?? 0,
        receiptsScanned: receiptsRes.count ?? 0,
        weeksClosedOut: weeksRes.count ?? 0,
        skipsDetected: skipsRes.count ?? 0,
      })

      // Category breakdown
      const catCounts = {}
      for (const item of (itemsRes.data || [])) {
        const cat = item.grocery_category || 'uncategorized'
        catCounts[cat] = (catCounts[cat] || 0) + 1
      }

      // Sage activity type counts
      const sageTypeCounts = {}
      for (const a of (sageRecentRes.data || [])) {
        sageTypeCounts[a.activity_type] = (sageTypeCounts[a.activity_type] || 0) + 1
      }
      const latestSage = (sageRecentRes.data || [])[0] || null

      const currentPlan = (currentPlanRes.data || [])[0] || null

      setData({
        users: usersRes.data || [],
        userCount: usersRes.count ?? 0,
        lauren: laurenRes.data,
        arcStage,
        listItemCount: itemsRes.count ?? 0,
        catCounts,
        noCatCount: noCatRes.count ?? 0,
        sageCount7d: (sageRecentRes.data || []).length,
        sageTypeCounts,
        sageUnseenCount: sageUnseenRes.count ?? 0,
        latestSage,
        recipeCount: recipesRes.count ?? 0,
        quickCount: quickRes.count ?? 0,
        photoCount: withPhotoRes.count ?? 0,
        recentRecipeCount: recentRecipesRes.count ?? 0,
        currentPlan,
        autoClosedCount: autoClosedRes.count ?? 0,
        reviewedCount: reviewedRes.count ?? 0,
        weekMealCount: weekMealsRes.count ?? 0,
      })
    } catch (err) {
      console.error('[Admin] Load error:', err)
    }
    setLoading(false)
  }

  const d = data
  const arcColor = getArcColor(d.arcStage || 1)

  function timeAgo(dateStr) {
    if (!dateStr) return 'Never'
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div style={{
      background: C.cream, minHeight: '100vh',
      maxWidth: '900px', margin: '0 auto',
      fontFamily: "'Jost', sans-serif", fontWeight: 300,
      padding: '24px 20px 60px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '0.5px solid #E4DDD2', marginBottom: '24px',
      }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: C.ink }}>
          Roux. <span style={{ fontSize: '13px', color: C.driftwood, fontFamily: "'Jost', sans-serif", fontWeight: 300 }}>Admin</span>
        </div>
        <button onClick={() => navigate('/')} style={{
          fontSize: '13px', color: C.forest, background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: "'Jost', sans-serif",
        }}>
          ← Back to app
        </button>
      </div>

      {loading ? (
        <div style={{ color: C.driftwood, fontStyle: 'italic', padding: '40px 0' }}>Loading dashboard...</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '16px',
        }}>

          {/* ── Section 1: Household Health ──────────────────────────── */}
          <Card title="Household Health">
            <Row label="Total users" value={d.userCount} />
            <Row label="Lauren last active" value={timeAgo(d.lauren?.last_sign_in_at || d.lauren?.updated_at)} />
            <Row label="Arc stage" value={
              <span style={{
                display: 'inline-block', padding: '2px 10px', borderRadius: '10px',
                fontSize: '12px', fontWeight: 500, color: 'white',
                background: arcColor,
              }}>
                Stage {d.arcStage}
              </span>
            } />
            {d.users?.map(u => (
              <Row key={u.id} label={u.name} value={`${u.role} · ${u.membership_status}`} small />
            ))}
          </Card>

          {/* ── Section 2: The List ──────────────────────────────────── */}
          <Card title="The List">
            <Row label="Active items" value={d.listItemCount} />
            <Row label="No category" value={d.noCatCount} alert={d.noCatCount > 0} />
            <div style={{ marginTop: '8px' }}>
              {Object.entries(d.catCounts || {}).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: C.driftwood, padding: '2px 0' }}>
                  <span>{cat}</span>
                  <span style={{ color: C.ink, fontWeight: 400 }}>{count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* ── Section 3: Intelligence System ───────────────────────── */}
          <Card title="Intelligence System">
            <Row label="Activity (7d)" value={d.sageCount7d} />
            <Row label="Unseen" value={d.sageUnseenCount} alert={d.sageUnseenCount > 5} />
            {Object.entries(d.sageTypeCounts || {}).map(([type, count]) => (
              <Row key={type} label={type} value={count} small />
            ))}
            {d.latestSage && (
              <div style={{ marginTop: '8px', padding: '8px 10px', background: C.cream, borderRadius: '8px', fontSize: '11px', color: C.driftwood, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 500, marginBottom: '2px' }}>Latest: {timeAgo(d.latestSage.created_at)}</div>
                {d.latestSage.message}
              </div>
            )}
          </Card>

          {/* ── Section 4: Recipe Library ─────────────────────────────── */}
          <Card title="Recipe Library">
            <Row label="Total recipes" value={d.recipeCount} />
            <Row label="Quick / ghost" value={d.quickCount} />
            <Row label="With photos" value={d.photoCount} />
            <Row label="Added (7d)" value={d.recentRecipeCount} />
          </Card>

          {/* ── Section 5: Production Errors ──────────────────────────── */}
          <Card title="Production Errors">
            <div style={{ fontSize: '12px', color: C.driftwood, lineHeight: 1.6 }}>
              Check Vercel dashboard for runtime errors.
            </div>
            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '12px', color: C.forest, fontWeight: 500, marginTop: '8px', display: 'inline-block' }}
            >
              Open Vercel logs →
            </a>
          </Card>

          {/* ── Section 6: Week Status ────────────────────────────────── */}
          <Card title="Week Status">
            <Row label="Current week" value={d.currentPlan ? (d.currentPlan.auto_closed ? 'Auto-closed' : d.currentPlan.reviewed_at ? 'Reviewed' : d.currentPlan.status || 'Active') : 'No plan'} />
            <Row label="Meals this week" value={d.weekMealCount} />
            <Row label="Auto-closed weeks" value={d.autoClosedCount} />
            <Row label="Manually reviewed" value={d.reviewedCount} />
          </Card>

        </div>
      )}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{
      background: 'white', borderRadius: '12px',
      border: `0.5px solid #E4DDD2`,
      padding: '16px 18px',
    }}>
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: '15px', fontWeight: 500, color: '#2C2417',
        marginBottom: '12px',
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, small, alert }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: small ? '2px 0' : '4px 0',
    }}>
      <span style={{ fontSize: small ? '11px' : '12px', color: '#8C7B6B' }}>{label}</span>
      <span style={{
        fontSize: small ? '12px' : '20px', fontWeight: small ? 400 : 500,
        color: alert ? '#A03030' : '#2C2417',
      }}>
        {value}
      </span>
    </div>
  )
}
