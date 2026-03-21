/**
 * Server-side helper: reads app_config.sage_model via Supabase service role key.
 * Bypasses RLS entirely. Falls back to hardcoded Sonnet if not configured.
 */

const FALLBACK = 'claude-sonnet-4-20250514'
let _cached = null
let _cachedAt = 0
const TTL = 5 * 60 * 1000 // 5 minutes

export async function getSageModelServer() {
  const now = Date.now()
  if (_cached && (now - _cachedAt) < TTL) return _cached

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    _cached = FALLBACK
    _cachedAt = now
    return FALLBACK
  }

  try {
    const res = await fetch(`${url}/rest/v1/app_config?key=eq.sage_model&select=value`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Accept': 'application/json',
      },
    })
    if (res.ok) {
      const rows = await res.json()
      if (rows?.[0]?.value) {
        _cached = rows[0].value
        _cachedAt = now
        return _cached
      }
    }
  } catch {
    // fall through
  }

  _cached = FALLBACK
  _cachedAt = now
  return FALLBACK
}
