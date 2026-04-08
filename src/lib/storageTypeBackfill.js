/**
 * storageTypeBackfill.js — One-time backfill for storage_type on existing ingredients.
 * Runs on app load, fire-and-forget. Uses the rule-based classifier (no API calls).
 * Only touches ingredients where storage_type IS NULL — never overwrites.
 */
import { supabase } from './supabase'
import { classifyStorageType } from './storageTypeClassifier'

let hasRun = false

export async function backfillStorageTypes() {
  if (hasRun) return
  hasRun = true

  try {
    const { data: ingredients } = await supabase
      .from('ingredients')
      .select('id, name')
      .is('storage_type', null)
      .not('name', 'is', null)
      .limit(500)

    if (!ingredients?.length) return

    for (const ing of ingredients) {
      const storageType = classifyStorageType(ing.name)
      await supabase
        .from('ingredients')
        .update({ storage_type: storageType })
        .eq('id', ing.id)
        .is('storage_type', null)
    }

    console.log(`[Roux] Backfilled storage_type for ${ingredients.length} ingredients`)
  } catch (err) {
    console.warn('[Roux] Storage type backfill failed:', err.message)
  }
}
