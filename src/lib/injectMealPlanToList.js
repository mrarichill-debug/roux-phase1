/**
 * injectMealPlanToList.js — Pulls ingredients from linked recipes into the master shopping list.
 * Called when Lauren taps "Build my list" after sharing the week.
 */
import { supabase } from './supabase'
import { categorizeIngredient } from './categorizeIngredient'
import { categorizeIngredientsWithSage } from './categorizeIngredientsWithSage'

/**
 * Multiply a quantity string by a batch multiplier.
 * Handles: clean numbers ("2"), fractions ("1/4"), ranges ("8-10"), null/text.
 */
function multiplyQuantity(qty, multiplier) {
  if (!qty || multiplier === 1) return qty
  const str = String(qty).trim()
  if (!str) return qty

  // Range: "8-10"
  const rangeMatch = str.match(/^([\d.]+)\s*-\s*([\d.]+)$/)
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]) * multiplier
    const hi = parseFloat(rangeMatch[2]) * multiplier
    return `${toFriendly(lo)}-${toFriendly(hi)}`
  }

  // Fraction: "1/4" or "1 1/2"
  const fracMatch = str.match(/^(\d+\s+)?(\d+)\/(\d+)$/)
  if (fracMatch) {
    const whole = fracMatch[1] ? parseFloat(fracMatch[1]) : 0
    const num = parseFloat(fracMatch[2])
    const den = parseFloat(fracMatch[3])
    const val = (whole + num / den) * multiplier
    return toFriendly(val)
  }

  // Plain number
  const n = parseFloat(str)
  if (!isNaN(n)) return toFriendly(n * multiplier)

  // Non-numeric text — return as-is
  return qty
}

/** Convert a decimal to a friendly fraction string when possible */
function toFriendly(val) {
  if (val === Math.floor(val)) return String(val)
  const fracs = [[0.25, '¼'], [0.333, '⅓'], [0.5, '½'], [0.667, '⅔'], [0.75, '¾']]
  const whole = Math.floor(val)
  const frac = val - whole
  for (const [f, label] of fracs) {
    if (Math.abs(frac - f) < 0.04) return whole > 0 ? `${whole} ${label}` : label
  }
  // Fall back to clean decimal
  const rounded = Math.round(val * 100) / 100
  return String(rounded)
}

export async function injectMealPlanToList({ planId, householdId, onCategorizing }) {
  if (!planId || !householdId) return { count: 0 }

  try {
    // Get linked meals with recipe IDs + batch multiplier
    const { data: linkedMeals } = await supabase
      .from('planned_meals')
      .select('id, recipe_id, custom_name, entry_type, batch_multiplier')
      .eq('meal_plan_id', planId)
      .eq('entry_type', 'linked')
      .not('recipe_id', 'is', null)

    if (!linkedMeals?.length) return { count: 0 }

    // Get recipe names for display
    const recipeIds = linkedMeals.map(m => m.recipe_id)
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, name')
      .in('id', recipeIds)
    const recipeNameMap = Object.fromEntries((recipes || []).map(r => [r.id, r.name]))

    // Build meal name + multiplier maps: recipe_id → display name / multiplier
    const mealNameMap = {}
    const batchMap = {}
    for (const meal of linkedMeals) {
      mealNameMap[meal.recipe_id] = meal.custom_name || recipeNameMap[meal.recipe_id] || 'Meal'
      batchMap[meal.recipe_id] = meal.batch_multiplier || 1
    }

    // Fetch all ingredients for these recipes
    const { data: ingredients } = await supabase
      .from('ingredients')
      .select('id, name, quantity, unit, recipe_id, grocery_category, categorization_status')
      .in('recipe_id', recipeIds)

    if (!ingredients?.length) return { count: 0 }

    // Block on any uncategorized ingredients — both 'skipped' and null/pending
    const uncategorized = ingredients.filter(i =>
      !i.categorization_status || i.categorization_status === 'skipped' || i.categorization_status === 'pending'
    )
    if (uncategorized.length > 0) {
      if (onCategorizing) onCategorizing(true)
      await categorizeIngredientsWithSage(uncategorized)
      if (onCategorizing) onCategorizing(false)
      // Re-fetch to get updated categories
      const { data: refreshed } = await supabase
        .from('ingredients')
        .select('id, name, quantity, unit, recipe_id, grocery_category')
        .in('recipe_id', recipeIds)
      if (refreshed) {
        // Merge updated categories back
        const refreshMap = Object.fromEntries(refreshed.map(r => [r.id, r]))
        for (const ing of ingredients) {
          if (refreshMap[ing.id]?.grocery_category) {
            ing.grocery_category = refreshMap[ing.id].grocery_category
          }
        }
      }
    }

    // Get or create master list
    let { data: masterList } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('household_id', householdId)
      .eq('list_type', 'master')
      .neq('status', 'completed')
      .limit(1)
      .maybeSingle()

    if (!masterList) {
      const [y, m, d] = new Date().toISOString().split('T')[0].split('-').map(Number)
      const endDate = new Date(y, m - 1, d + 6)
      const wed = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
      const { data: newList } = await supabase.from('shopping_lists').insert({
        household_id: householdId, list_type: 'master', status: 'draft',
      }).select('id').single()
      masterList = newList
    }
    if (!masterList) return { count: 0 }

    // Check existing items to avoid duplicates
    const { data: existingItems } = await supabase
      .from('shopping_list_items')
      .select('name')
      .eq('shopping_list_id', masterList.id)
      .eq('status', 'active')
    const existingNames = new Set((existingItems || []).map(i => i.name.toLowerCase()))

    // Insert new items
    const newItems = []
    for (const ing of ingredients) {
      if (!ing.name?.trim()) continue
      if (existingNames.has(ing.name.trim().toLowerCase())) continue
      existingNames.add(ing.name.trim().toLowerCase()) // prevent duplicates within this batch

      // Clean unit — "piece" is a junk default when no real unit exists
      const rawUnit = ing.unit?.trim() || null
      const unit = rawUnit === 'piece' ? null : rawUnit

      const multiplier = batchMap[ing.recipe_id] || 1
      newItems.push({
        shopping_list_id: masterList.id,
        household_id: householdId,
        name: ing.name.trim(),
        quantity: multiplyQuantity(ing.quantity, multiplier),
        unit,
        item_type: 'recipe',
        status: 'active',
        approval_status: 'approved',
        grocery_category: (ing.grocery_category && ing.grocery_category !== 'other') ? ing.grocery_category : categorizeIngredient(ing.name),
        source_meal_name: mealNameMap[ing.recipe_id] || null,
      })
    }

    if (newItems.length > 0) {
      await supabase.from('shopping_list_items').insert(newItems)
    }

    // Mark plan as injected
    await supabase.from('meal_plans').update({ shopping_injected: true }).eq('id', planId)

    return { count: newItems.length }
  } catch (err) {
    console.error('[injectMealPlanToList] Error:', err.message)
    return { count: 0 }
  }
}
