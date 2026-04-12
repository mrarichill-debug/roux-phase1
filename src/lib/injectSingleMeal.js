/**
 * injectSingleMeal.js — Injects ingredients from a single planned meal into the shopping list.
 * Used for auto-injection when a recipe is linked to a meal after the list was already built.
 * Reads from planned_meal_recipes, applies batch_multiplier, deduplicates against existing items.
 */
import { supabase } from './supabase'
import { categorizeIngredient } from './categorizeIngredient'
import { categorizeIngredientsWithSage } from './categorizeIngredientsWithSage'
import { getOrCreateShoppingList } from './getOrCreateShoppingList'

function multiplyQuantity(qty, multiplier) {
  if (!qty || multiplier === 1) return qty
  const str = String(qty).trim()
  if (!str) return qty
  const rangeMatch = str.match(/^([\d.]+)\s*-\s*([\d.]+)$/)
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]) * multiplier
    const hi = parseFloat(rangeMatch[2]) * multiplier
    return `${toFriendly(lo)}-${toFriendly(hi)}`
  }
  const fracMatch = str.match(/^(\d+\s+)?(\d+)\/(\d+)$/)
  if (fracMatch) {
    const whole = fracMatch[1] ? parseFloat(fracMatch[1]) : 0
    const num = parseFloat(fracMatch[2])
    const den = parseFloat(fracMatch[3])
    return toFriendly((whole + num / den) * multiplier)
  }
  const n = parseFloat(str)
  if (!isNaN(n)) return toFriendly(n * multiplier)
  return qty
}

function toFriendly(val) {
  if (val === Math.floor(val)) return String(val)
  const fracs = [[0.25, '\u00BC'], [0.333, '\u2153'], [0.5, '\u00BD'], [0.667, '\u2154'], [0.75, '\u00BE']]
  const whole = Math.floor(val)
  const frac = val - whole
  for (const [f, label] of fracs) {
    if (Math.abs(frac - f) < 0.04) return whole > 0 ? `${whole} ${label}` : label
  }
  return String(Math.round(val * 100) / 100)
}

export async function injectSingleMeal({ mealId, mealName, batchMultiplier, planId, householdId, legacyRecipeId }) {
  if (!mealId || !planId || !householdId) return { count: 0 }

  try {
    // Get recipe links for this meal from junction table
    const { data: pmrRows } = await supabase
      .from('planned_meal_recipes')
      .select('recipe_id')
      .eq('planned_meal_id', mealId)

    let recipeIds = (pmrRows || []).map(r => r.recipe_id)

    // Fall back to legacy recipe_id on planned_meals (from Sage match)
    if (!recipeIds.length && legacyRecipeId) {
      recipeIds = [legacyRecipeId]
    }

    if (!recipeIds.length) return { count: 0 }

    // Get recipe names for display
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, name')
      .in('id', recipeIds)
    const recipeNameMap = Object.fromEntries((recipes || []).map(r => [r.id, r.name]))

    // Fetch ingredients
    const { data: ingredients } = await supabase
      .from('ingredients')
      .select('id, name, quantity, unit, recipe_id, grocery_category, categorization_status')
      .in('recipe_id', recipeIds)

    if (!ingredients?.length) return { count: 0 }

    // Categorize uncategorized ingredients
    const uncategorized = ingredients.filter(i =>
      !i.categorization_status || i.categorization_status === 'skipped' || i.categorization_status === 'pending'
    )
    if (uncategorized.length > 0) {
      await categorizeIngredientsWithSage(uncategorized)
      const { data: refreshed } = await supabase
        .from('ingredients')
        .select('id, name, quantity, unit, recipe_id, grocery_category')
        .in('recipe_id', recipeIds)
      if (refreshed) {
        const refreshMap = Object.fromEntries(refreshed.map(r => [r.id, r]))
        for (const ing of ingredients) {
          if (refreshMap[ing.id]?.grocery_category) {
            ing.grocery_category = refreshMap[ing.id].grocery_category
          }
        }
      }
    }

    // Get or create shopping list
    const listId = await getOrCreateShoppingList(planId, householdId)
    if (!listId) return { count: 0 }

    // Fetch existing items so we can sum quantities for duplicates
    const { data: existingItems } = await supabase
      .from('shopping_list_items')
      .select('id, name, quantity, unit')
      .eq('shopping_list_id', listId)
      .eq('status', 'active')
    const existingByName = new Map((existingItems || []).map(i => [i.name.toLowerCase().trim(), i]))

    const multiplier = batchMultiplier || 1
    const displayName = mealName || 'Meal'
    const newItems = []
    const updates = []
    for (const ing of ingredients) {
      if (!ing.name?.trim()) continue
      const nameLower = ing.name.trim().toLowerCase()
      const rawUnit = ing.unit?.trim() || null
      const unit = rawUnit === 'piece' ? null : rawUnit
      const scaledQty = multiplyQuantity(ing.quantity, multiplier)

      const existing = existingByName.get(nameLower)
      if (existing) {
        // Sum quantities when units match (or both null)
        if (scaledQty && (existing.unit || null) === (unit || null)) {
          const a = parseFloat(existing.quantity) || 0
          const b = parseFloat(scaledQty) || 0
          if (a > 0 && b > 0) {
            updates.push({ id: existing.id, quantity: toFriendly(a + b) })
            existing.quantity = toFriendly(a + b)
          }
        }
        continue
      }
      existingByName.set(nameLower, { id: null, name: ing.name.trim(), quantity: scaledQty, unit })

      newItems.push({
        shopping_list_id: listId,
        household_id: householdId,
        name: ing.name.trim(),
        quantity: scaledQty,
        unit,
        item_type: 'recipe',
        status: 'active',
        approval_status: 'approved',
        grocery_category: (ing.grocery_category && ing.grocery_category !== 'other') ? ing.grocery_category : categorizeIngredient(ing.name),
        source_meal_name: displayName,
      })
    }

    if (newItems.length > 0) {
      await supabase.from('shopping_list_items').insert(newItems)
    }
    for (const u of updates) {
      await supabase.from('shopping_list_items').update({ quantity: u.quantity }).eq('id', u.id)
    }

    return { count: newItems.length + updates.length }
  } catch (err) {
    console.error('[injectSingleMeal] Error:', err.message)
    return { count: 0 }
  }
}
