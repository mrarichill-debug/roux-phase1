/**
 * categorizeIngredientsWithSage.js — Background Sage call to categorize ingredients.
 * Fire-and-forget after recipe save. Updates ingredient rows with grocery_category + categorization_status.
 * Logs to sage_background_activity on success.
 * Never blocks UI. Never surfaces errors to Lauren.
 */
import { supabase } from './supabase'

const VALID_CATEGORIES = new Set([
  'produce', 'meat', 'seafood', 'dairy', 'bakery', 'pantry',
  'frozen', 'beverages', 'household', 'personal_care', 'other',
])

export async function categorizeIngredientsWithSage(ingredients, { recipeName, recipeId, appUser } = {}) {
  if (!ingredients?.length) return false

  // Only categorize ingredients without a category, with 'other', or with status 'skipped'
  const toCategorize = ingredients.filter(i =>
    !i.grocery_category || i.grocery_category === 'other' || i.categorization_status === 'skipped'
  )
  if (toCategorize.length === 0) return true // all already done

  try {
    const names = toCategorize.map(i => i.name).filter(Boolean)
    if (names.length === 0) return true

    const response = await fetch('/api/sage-categorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: names }),
    })

    if (!response.ok) {
      // Mark as skipped so retry can pick them up later
      for (const ing of toCategorize) {
        supabase.from('ingredients').update({ categorization_status: 'skipped' }).eq('id', ing.id)
      }
      return false
    }

    const { categories } = await response.json()
    if (!categories || typeof categories !== 'object') {
      for (const ing of toCategorize) {
        supabase.from('ingredients').update({ categorization_status: 'skipped' }).eq('id', ing.id)
      }
      return false
    }

    // Update each ingredient row with category + status
    let successCount = 0
    for (const ing of toCategorize) {
      const cat = categories[ing.name]
      if (cat && VALID_CATEGORIES.has(cat)) {
        await supabase.from('ingredients').update({ grocery_category: cat, categorization_status: 'done' }).eq('id', ing.id)
        successCount++
      } else {
        await supabase.from('ingredients').update({ categorization_status: 'skipped' }).eq('id', ing.id)
      }
    }

    // Log to sage_background_activity on success
    if (successCount > 0 && appUser?.household_id && recipeId) {
      const displayName = recipeName || 'a recipe'
      supabase.from('sage_background_activity').insert({
        household_id: appUser.household_id,
        user_id: appUser.id,
        activity_type: 'ingredient_categorization',
        message: `The ingredients for ${displayName} are now organized — your shopping list will be cleaner next time.`,
        recipe_id: recipeId,
        seen: false,
      })
    }

    return true
  } catch (err) {
    console.warn('[SageCategorize] Failed:', err.message)
    // Mark all as skipped on crash
    for (const ing of toCategorize) {
      supabase.from('ingredients').update({ categorization_status: 'skipped' }).eq('id', ing.id)
    }
    return false
  }
}
