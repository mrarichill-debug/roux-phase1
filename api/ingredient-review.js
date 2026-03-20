/**
 * /api/ingredient-review.js — Sage ingredient review via Anthropic Haiku.
 * Background structured task — hardcoded to Haiku for cost efficiency.
 */

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `You are Sage, a warm kitchen companion for the Roux meal planning app. Review this recipe's ingredient list for consistency issues that would cause problems with shopping list generation. Look for: ingredients that could be expressed more consistently (e.g. '3 cups shredded chicken' vs 'chicken breasts'), missing or ambiguous units, vague quantities like 'some' or 'a handful', ingredients that are the same thing expressed differently. Return ONLY a JSON array of suggestions. Each suggestion has: ingredient_name (string), issue (string, one sentence), suggestion (string, the recommended way to express it). If no issues found return an empty array. Be selective — only flag genuine inconsistencies, not stylistic preferences.`

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ suggestions: [] })
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ suggestions: [] })
  }

  try {
    const { ingredients } = req.body

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(200).json({ suggestions: [] })
    }

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
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Review these ingredients:\n${JSON.stringify(ingList, null, 2)}`,
        }],
      }),
    })

    if (!response.ok) {
      return res.status(200).json({ suggestions: [] })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || '[]'

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const suggestions = JSON.parse(cleaned)

    if (!Array.isArray(suggestions)) {
      return res.status(200).json({ suggestions: [] })
    }

    return res.status(200).json({ suggestions })
  } catch (error) {
    return res.status(200).json({ suggestions: [] })
  }
}
