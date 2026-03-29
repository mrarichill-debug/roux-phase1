/**
 * sageMealMatch.js — Background Sage call to match ghost meal entries to recipes.
 * Also normalizes the meal name (Title Case, spelling fixes).
 * Fire-and-forget after meal is added. Never blocks UI.
 */
import { supabase } from './supabase'

export async function sageMealMatch({ mealId, mealName, householdId }) {
  if (!mealName || !householdId || !mealId) return

  try {
    // Load all household recipes for local matching
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, name, description')
      .eq('household_id', householdId)
      .eq('recipe_type', 'full')
      .eq('status', 'complete')
      .limit(100)

    if (!recipes || recipes.length === 0) return

    // Local matching with priority tiers:
    // 1. Exact name match (case-insensitive)
    // 2. Meal name appears anywhere in recipe name
    // 3. Any word from meal name appears in recipe name
    const mealLower = mealName.toLowerCase().trim()
    const mealWords = mealLower.split(/\s+/).filter(w => w.length > 2) // skip tiny words

    const tier1 = [] // exact
    const tier2 = [] // meal name found in recipe name
    const tier3 = [] // word overlap

    for (const r of recipes) {
      const recipeLower = (r.name || '').toLowerCase()
      if (recipeLower === mealLower) {
        tier1.push({ recipe_id: r.id, recipe_name: r.name, confidence: 'high' })
      } else if (recipeLower.includes(mealLower)) {
        tier2.push({ recipe_id: r.id, recipe_name: r.name, confidence: 'high' })
      } else if (mealWords.length > 0) {
        const matchCount = mealWords.filter(w => recipeLower.includes(w)).length
        if (matchCount > 0) {
          tier3.push({ recipe_id: r.id, recipe_name: r.name, confidence: 'medium', _score: matchCount / mealWords.length })
        }
      }
    }

    // Sort tier3 by relevance (highest word overlap first), take top matches
    tier3.sort((a, b) => b._score - a._score)
    const localMatches = [...tier1, ...tier2, ...tier3.slice(0, 3)].slice(0, 5)
    // Clean up _score before storing
    for (const m of localMatches) delete m._score

    if (localMatches.length > 0) {
      // Filter out recipes with zero ingredients — empty recipes are useless
      const matchedIds = localMatches.map(m => m.recipe_id)
      const { data: ingredientRows } = await supabase
        .from('ingredients')
        .select('recipe_id')
        .in('recipe_id', matchedIds)
      const validIds = new Set((ingredientRows || []).map(r => r.recipe_id))
      const filteredMatches = localMatches.filter(m => validIds.has(m.recipe_id))

      if (filteredMatches.length > 0) {
        await supabase.from('planned_meals').update({
          sage_match_result: { normalized_name: mealName, matches: filteredMatches, suggest_new: false },
          sage_match_status: 'pending',
        }).eq('id', mealId)
        return
      }
    }

    // No local matches — call Sage for name normalization + suggest_new
    const response = await fetch('/api/sage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: `You are Sage, a kitchen assistant. Clean up meal names. Respond ONLY with valid JSON. No explanation, no markdown.`,
        messages: [{
          role: 'user',
          content: `The user wants to make: "${mealName}"

No matching recipes were found. Return JSON:
{
  "normalized_name": "Title Case corrected meal name with proper spelling",
  "matches": [],
  "suggest_new": true
}

Rules for normalized_name:
- Title Case for all main words (capitalize first letter of each significant word)
- Fix obvious spelling errors
- Keep connecting words lowercase (with, and, or, the, a, an, in, of)
- If the name is already clean, return it unchanged`,
        }],
      }),
    })

    if (!response.ok) {
      console.warn('[SageMealMatch] API error:', response.status)
      return
    }

    const data = await response.json()
    const text = data.content?.find(c => c.type === 'text')?.text || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean)

    if (!result) return

    const update = {
      sage_match_result: result,
      sage_match_status: 'pending',
    }

    if (result.normalized_name && result.normalized_name !== mealName) {
      update.custom_name = result.normalized_name
    }

    await supabase.from('planned_meals').update(update).eq('id', mealId)
  } catch (err) {
    console.warn('[SageMealMatch] Failed:', err.message)
  }
}
