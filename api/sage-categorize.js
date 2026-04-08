/**
 * /api/sage-categorize.js — Background ingredient categorization via Sage.
 * Uses Haiku for speed/cost. Categorizes ingredients into grocery categories + storage type.
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
        max_tokens: 2048,
        system: 'You categorize cooking ingredients. Respond ONLY with valid JSON. No explanation, no markdown.',
        messages: [{
          role: 'user',
          content: `Categorize each ingredient into a grocery_category and a storage_type.

grocery_category — exactly one of: produce, meat, seafood, dairy, bakery, pantry, frozen, beverages, household, other.

storage_type — exactly one of:
- "cold" — anything that lives in the fridge: meat, poultry, seafood, dairy, eggs, fresh produce, fresh herbs, deli items, opened condiments
- "dry" — anything shelf-stable: canned goods, pasta, rice, grains, dried beans, spices, oils, vinegars, baking supplies, bread, nuts
- "frozen" — anything that lives in the freezer: frozen vegetables, frozen meat, ice cream, frozen meals

Return ONLY a JSON object where each key is the ingredient name and the value is an object with "grocery_category" and "storage_type" fields.

Example: {"Ground beef": {"grocery_category": "meat", "storage_type": "cold"}, "Olive oil": {"grocery_category": "pantry", "storage_type": "dry"}}

Ingredients:
${ingredients.join('\n')}`,
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
