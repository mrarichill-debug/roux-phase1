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

export async function injectSingleMeal({ mealId, mealName, batchMultiplier, planId, householdId }) {
  if (!mealId || !planId || !householdId) return { count: 0 }

  try {
    // Get recipe links for this meal from junction table
    const { data: pmrRows } = await supabase
      .from('planned_meal_recipes')
      .select('recipe_id')
      .eq('planned_meal_id', mealId)

    if (!pmrRows?.length) return { count: 0 }

    const recipeIds = pmrRows.map(r => r.recipe_id)

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

    // Check existing items to avoid duplicates
    const { data: existingItems } = await supabase
      .from('shopping_list_items')
      .select('name')
      .eq('shopping_list_id', listId)
      .eq('status', 'active')
    const existingNames = new Set((existingItems || []).map(i => i.name.toLowerCase()))

    const multiplier = batchMultiplier || 1
    const displayName = mealName || 'Meal'
    const newItems = []
    for (const ing of ingredients) {
      if (!ing.name?.trim()) continue
      if (existingNames.has(ing.name.trim().toLowerCase())) continue
      existingNames.add(ing.name.trim().toLowerCase())

      const rawUnit = ing.unit?.trim() || null
      const unit = rawUnit === 'piece' ? null : rawUnit

      newItems.push({
        shopping_list_id: listId,
        household_id: householdId,
        name: ing.name.trim(),
        quantity: multiplyQuantity(ing.quantity, multiplier),
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

    return { count: newItems.length }
  } catch (err) {
    console.error('[injectSingleMeal] Error:', err.message)
    return { count: 0 }
  }
}
