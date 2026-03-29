/**
 * getIngredientCostEstimate.js — Returns cost estimate for an ingredient
 * based on purchase history. Separates bulk vs standard store prices.
 */
import { supabase } from './supabase'

export async function getIngredientCostEstimate(ingredientName, storeType, householdId) {
  if (!ingredientName || !householdId) return null

  const { data } = await supabase
    .from('ingredient_purchase_history')
    .select('actual_price, purchase_date')
    .eq('household_id', householdId)
    .ilike('ingredient_name', ingredientName.toLowerCase().trim())
    .eq('store_type', storeType || 'standard')
    .order('purchase_date', { ascending: false })
    .limit(10)

  if (!data || data.length === 0) return null

  const prices = data.map(r => Number(r.actual_price)).filter(p => !isNaN(p) && p > 0)
  if (prices.length === 0) return null

  const avg = prices.reduce((a, b) => a + b, 0) / prices.length
  const lastPrice = prices[0]
  const count = prices.length

  return {
    estimate: avg,
    lastPrice,
    count,
    label: count === 1 ? `last time: $${lastPrice.toFixed(2)}`
         : count < 3  ? `last time: ~$${Math.round(avg)}`
         : count < 5  ? `usually ~$${Math.round(avg)}`
         : `~$${Math.round(avg)}`,
  }
}
