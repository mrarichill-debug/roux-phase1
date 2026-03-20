/**
 * sageReview.js — Background ingredient quality check via /api/ingredient-review.
 * Fire-and-forget after recipe save. Does not count against sage_usage.
 */
import { supabase } from './supabase'

export async function runSageIngredientReview(recipeId, ingredients, { recipeName, userId } = {}) {
  if (!recipeId || !ingredients?.length) return

  try {
    const ingList = ingredients.map(i => ({
      name: i.name,
      quantity: i.quantity || null,
      unit: i.unit || null,
      preparation_note: i.preparation_note || null,
    }))

    const response = await fetch('/api/ingredient-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: ingList }),
    })

    if (!response.ok) {
      console.error('[Sage Review] API error:', response.status)
      return
    }

    const { suggestions } = await response.json()

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      console.log('[Sage Review] No issues found for recipe', recipeId)
      return
    }

    // Save suggestions to recipe
    await supabase.from('recipes').update({
      sage_assist_content: JSON.stringify(suggestions),
      sage_assist_status: 'pending',
      sage_assist_offered: new Date().toISOString(),
    }).eq('id', recipeId)

    // Write notification if userId provided
    if (userId) {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'sage_ingredient_review',
        title: `Sage reviewed ${recipeName || 'a recipe'}`,
        body: 'A few ingredient suggestions are ready for your review.',
        action_type: 'navigate',
        target_id: recipeId,
      }).then(({ error }) => { if (error) console.log('[Sage Review] Notification write skipped:', error.message) })
    }

    console.log('[Sage Review] Saved', suggestions.length, 'suggestions for recipe', recipeId)
  } catch (err) {
    console.error('[Sage Review] Error:', err)
  }
}
