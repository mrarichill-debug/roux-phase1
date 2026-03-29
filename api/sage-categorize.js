/**
 * /api/sage-categorize.js — Background ingredient categorization via Sage.
 * Uses Haiku for speed/cost. Categorizes ingredients into grocery categories.
 */

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    const { ingredients } = req.body

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(200).json({ categories: {} })
    }

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
        system: 'You categorize cooking ingredients. Respond ONLY with valid JSON. No explanation, no markdown.',
        messages: [{
          role: 'user',
          content: `Categorize each of these cooking ingredients into exactly one of these categories: produce, meat, seafood, dairy, bakery, pantry, frozen, beverages, household, other. Return ONLY a JSON object where each key is the ingredient name and the value is the category string.\n\nIngredients:\n${ingredients.join('\n')}`,
        }],
      }),
    })

    if (!response.ok) {
      return res.status(200).json({ categories: {} })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const categories = JSON.parse(cleaned)
      return res.status(200).json({ categories })
    } catch {
      return res.status(200).json({ categories: {} })
    }
  } catch (error) {
    return res.status(200).json({ categories: {} })
  }
}
