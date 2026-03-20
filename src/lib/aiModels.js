/**
 * aiModels.js — Tiered model strategy for all Anthropic API calls.
 * Never hardcode model strings — always import from here so model
 * upgrades can be made in one place.
 *
 * Primary Sage model (Sonnet) is runtime-configurable via app_config.sage_model.
 * Haiku assignments for background tasks are intentional cost decisions and stay hardcoded.
 */

import { supabase } from './supabase'

// --- Runtime-configurable primary model (reads from app_config.sage_model) ---

const FALLBACK_SAGE_MODEL = 'claude-sonnet-4-20250514'
let _cachedSageModel = null
let _cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Fetches the primary Sage model from app_config.sage_model.
 * Caches for 5 minutes so repeated calls don't hit the DB.
 * Falls back to hardcoded Sonnet if the query fails.
 */
export async function getSageModel() {
  const now = Date.now()
  if (_cachedSageModel && (now - _cacheTimestamp) < CACHE_TTL_MS) {
    return _cachedSageModel
  }

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'sage_model')
      .single()

    if (!error && data?.value) {
      _cachedSageModel = data.value
      _cacheTimestamp = now
      return _cachedSageModel
    }
  } catch {
    // fall through to fallback
  }

  _cachedSageModel = FALLBACK_SAGE_MODEL
  _cacheTimestamp = now
  return _cachedSageModel
}

// Convenience aliases — all resolve to the same runtime-configurable model
export const getSageChatModel = getSageModel
export const getSageWeekPlanningModel = getSageModel
export const getRecipeUrlExtractionModel = getSageModel

// --- Hardcoded Haiku — intentional cost decisions for background tasks ---

export const SAGE_INGREDIENT_REVIEW = 'claude-haiku-4-5-20251001'
export const SAGE_SKIP_DETECTION = 'claude-haiku-4-5-20251001'
export const SAGE_REACTIVE_SUGGESTIONS = 'claude-haiku-4-5-20251001'
export const SHOPPING_LIST_GENERATION = 'claude-haiku-4-5-20251001'
