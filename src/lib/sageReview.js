/**
 * sageReview.js — Background ingredient quality check via Claude Haiku.
 * Fire-and-forget after recipe save. Does not count against sage_usage.
 */
import { supabase } from './supabase'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `You are Sage, a warm kitchen companion for the Roux meal planning app. Review this recipe's ingredient list for consistency issues that would cause problems with shopping list generation. Look for: ingredients that could be expressed more consistently (e.g. '3 cups shredded chicken' vs 'chicken breasts'), missing or ambiguous units, vague quantities like 'some' or 'a handful', ingredients that are the same thing expressed differently. Return ONLY a JSON array of suggestions. Each suggestion has: ingredient_name (string), issue (string, one sentence), suggestion (string, the recommended way to express it). If no issues found return an empty array. Be selective — only flag genuine inconsistencies, not stylistic preferences.`

export async function runSageIngredientReview(recipeId, ingredients) {
  if (!API_KEY || !recipeId || !ingredients?.length) return

  try {
    const ingList = ingredients.map(i => ({
      name: i.name,
      quantity: i.quantity || null,
      unit: i.unit || null,
      preparation_note: i.preparation_note || null,
    }))

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Review these ingredients:\n${JSON.stringify(ingList, null, 2)}`,
        }],
      }),
    })

    if (!response.ok) {
      console.error('[Sage Review] API error:', response.status)
      return
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || '[]'

    // Parse JSON from response — handle markdown code blocks
    let suggestions
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      suggestions = JSON.parse(cleaned)
    } catch {
      console.error('[Sage Review] Failed to parse response:', text)
      return
    }

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

    console.log('[Sage Review] Saved', suggestions.length, 'suggestions for recipe', recipeId)
  } catch (err) {
    console.error('[Sage Review] Error:', err)
  }
}
