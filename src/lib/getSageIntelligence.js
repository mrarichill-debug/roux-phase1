/**
 * getSageIntelligence.js — Calculates Sage's intelligence score and growth stage.
 * Score is weighted by data quality: receipts (x3), reviews (x4), meals (x1), staples (x2).
 */

export async function getSageIntelligence(supabase, householdId) {
  const [receipts, reviews, meals, staples] = await Promise.all([
    supabase.from('shopping_trips')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .not('receipt_photo_url', 'is', null),
    supabase.from('meal_plans')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .not('reviewed_at', 'is', null),
    supabase.from('planned_meals')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .is('removed_at', null),
    supabase.from('pantry_staples')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId),
  ])

  const score = {
    receipts: receipts.count || 0,
    reviews: reviews.count || 0,
    meals: meals.count || 0,
    staples: staples.count || 0,
  }

  const total = (score.receipts * 3) + (score.reviews * 4) + (score.meals * 1) + (score.staples * 2)

  let stage, label, description, nextUnlock
  if (total < 5) {
    stage = 'seed'
    label = 'Just getting started'
    description = "Sage is learning about your kitchen. Plan your first week to help her grow."
    nextUnlock = 'Plan a full week of meals'
  } else if (total < 20) {
    stage = 'sprout'
    label = 'Sage is sprouting'
    description = "Sage is starting to learn your family's patterns. Scan a receipt to help her understand costs."
    nextUnlock = 'Scan your first receipt'
  } else if (total < 50) {
    stage = 'growing'
    label = 'Sage is growing'
    description = 'Sage knows your kitchen pretty well now. Complete a weekly review to unlock spending insights.'
    nextUnlock = 'Complete a weekly review'
  } else if (total < 100) {
    stage = 'established'
    label = 'Sage knows your family'
    description = "Sage has learned your family's habits and can start predicting what you need."
    nextUnlock = 'Keep scanning receipts for cost estimates'
  } else {
    stage = 'flourishing'
    label = 'Sage is flourishing'
    description = "Sage knows your kitchen inside and out. She's at her smartest."
    nextUnlock = null
  }

  return { stage, label, description, nextUnlock, score, total }
}
