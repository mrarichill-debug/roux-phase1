/**
 * getOrCreateShoppingList.js — Find or create a shopping list for a specific meal plan.
 * Each meal plan owns its own shopping list. Never query by household_id alone.
 */
import { supabase as defaultSupabase } from './supabase'

export async function getOrCreateShoppingList(mealPlanId, householdId, sb) {
  const client = sb || defaultSupabase
  if (!mealPlanId || !householdId) return null

  // Find existing list for this meal plan
  const { data: existing } = await client
    .from('shopping_lists')
    .select('id')
    .eq('meal_plan_id', mealPlanId)
    .maybeSingle()

  if (existing) return existing.id

  // Create new list for this meal plan
  const { data: newList } = await client
    .from('shopping_lists')
    .insert({
      household_id: householdId,
      meal_plan_id: mealPlanId,
      list_type: 'master',
      status: 'draft',
    })
    .select('id')
    .single()

  return newList?.id || null
}
