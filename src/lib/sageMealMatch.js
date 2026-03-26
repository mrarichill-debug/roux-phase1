/**
 * sageMealMatch.js — Background Sage call to match ghost meal entries to recipes.
 * Also normalizes the meal name (Title Case, spelling fixes).
 * Fire-and-forget after meal is added. Never blocks UI.
 */
import { supabase } from './supabase'

export async function sageMealMatch({ mealId, mealName, householdId }) {
  if (!mealName || !householdId || !mealId) return

  try {
    const { data: recipes } = await supabase
      .from('recipes')
      .select('id, name, description')
      .eq('household_id', householdId)
      .eq('recipe_type', 'full')
      .eq('status', 'complete')
      .limit(50)

    if (!recipes || recipes.length === 0) return

    const response = await fetch('/api/sage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: `You are Sage, a kitchen assistant. You help match meal descriptions to existing recipes and clean up meal names. Respond ONLY with valid JSON. No explanation, no markdown.`,
        messages: [{
          role: 'user',
          content: `The user wants to make: "${mealName}"

Here are their saved recipes:
${recipes.map(r => `- ${r.id}: ${r.name}${r.description ? ` (${r.description.substring(0, 60)})` : ''}`).join('\n')}

Return JSON with this exact structure:
{
  "normalized_name": "Title Case corrected meal name with proper spelling",
  "matches": [
    { "recipe_id": "uuid", "recipe_name": "name", "confidence": "high|medium" }
  ],
  "suggest_new": true|false
}

Rules for normalized_name:
- Title Case for all main words (capitalize first letter of each significant word)
- Fix obvious spelling errors
- Keep connecting words lowercase (with, and, or, the, a, an, in, of)
- Example: "grilled chicken with rice and zuchinni" → "Grilled Chicken with Rice and Zucchini"
- If the name is already clean, return it unchanged

Only include recipes that genuinely match the meal description. Maximum 3 matches. If no recipes match well, return empty matches array and suggest_new: true.`,
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

    // Build update payload
    const update = {
      sage_match_result: result,
      sage_match_status: 'pending',
    }

    // Apply normalized name if it differs from the original
    if (result.normalized_name && result.normalized_name !== mealName) {
      update.custom_name = result.normalized_name
    }

    await supabase.from('planned_meals').update(update).eq('id', mealId)
  } catch (err) {
    console.warn('[SageMealMatch] Failed:', err.message)
  }
}
