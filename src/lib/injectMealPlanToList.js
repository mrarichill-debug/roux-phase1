/**
 * injectMealPlanToList.js — Pulls ingredients from linked recipes into the master shopping list.
 * Called when Lauren taps "Build my list" after sharing the week.
 */
import { supabase } from './supabase'

export async function injectMealPlanToList({ planId, householdId }) {
  if (!planId || !householdId) return { count: 0 }

  try {
    // Get linked meals with recipe IDs
    const { data: linkedMeals } = await supabase
      .from('planned_meals')
      .select('id, recipe_id, custom_name, entry_type')
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

    // Build meal name map: recipe_id → display name
    const mealNameMap = {}
    for (const meal of linkedMeals) {
      mealNameMap[meal.recipe_id] = meal.custom_name || recipeNameMap[meal.recipe_id] || 'Meal'
    }

    // Fetch all ingredients for these recipes
    const { data: ingredients } = await supabase
      .from('ingredients')
      .select('name, quantity, unit, recipe_id')
      .in('recipe_id', recipeIds)

    if (!ingredients?.length) return { count: 0 }

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

      newItems.push({
        shopping_list_id: masterList.id,
        household_id: householdId,
        name: ing.name.trim(),
        quantity: ing.quantity || null,
        unit: ing.unit || null,
        item_type: 'recipe',
        status: 'active',
        approval_status: 'approved',
        grocery_category: 'other',
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
