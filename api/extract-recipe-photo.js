/**
 * /api/extract-recipe-photo.js — Recipe photo extraction via Anthropic vision API.
 * Accepts base64 images, sends to Claude for structured extraction.
 */

const SINGLE_PROMPT = `You are Sage, a recipe extraction assistant for the Roux family meal planning app. Extract a structured recipe from the provided content. Return ONLY valid JSON with these fields:
{
  "name": "string (recipe title)",
  "description": "string (1-2 sentence summary, what makes it special)",
  "author": "string or null",
  "source_url": "string or null",
  "category": "string or null (e.g. Main, Side, Dessert, Appetizer, Breakfast, Soup, Salad, Snack, Drink, Bread, Sauce)",
  "cuisine": "string or null (e.g. Italian, Mexican, American)",
  "method": "string or null (one of: stovetop, baked, slow cooker, no-cook, grilled, other)",
  "difficulty": "string or null (one of: easy, medium, advanced)",
  "prep_time_minutes": "number or null",
  "cook_time_minutes": "number or null",
  "servings": "string or null (e.g. '4-6')",
  "ingredients": [{"quantity": "string", "unit": "string (tsp/tbsp/cup/oz/lb/g/piece/etc)", "name": "string"}],
  "instructions": [{"step_number": 1, "instruction": "string"}],
  "personal_notes": "string or null"
}
Be thorough with ingredients — include quantities and standard units. Convert vague measurements to standard units when possible. For instructions, break into clear numbered steps. If information is missing, use null rather than guessing.`

const MULTI_PROMPT = `You are Sage, a recipe extraction assistant for the Roux family meal planning app. These images are multiple pages or sides of the same recipe. Combine all ingredients and instructions across all images into a single unified recipe. Do not duplicate ingredients that appear on multiple pages. Return ONLY valid JSON with these fields:
{
  "name": "string (recipe title)",
  "description": "string (1-2 sentence summary, what makes it special)",
  "author": "string or null",
  "source_url": "string or null",
  "category": "string or null (e.g. Main, Side, Dessert, Appetizer, Breakfast, Soup, Salad, Snack, Drink, Bread, Sauce)",
  "cuisine": "string or null (e.g. Italian, Mexican, American)",
  "method": "string or null (one of: stovetop, baked, slow cooker, no-cook, grilled, other)",
  "difficulty": "string or null (one of: easy, medium, advanced)",
  "prep_time_minutes": "number or null",
  "cook_time_minutes": "number or null",
  "servings": "string or null (e.g. '4-6')",
  "ingredients": [{"quantity": "string", "unit": "string (tsp/tbsp/cup/oz/lb/g/piece/etc)", "name": "string"}],
  "instructions": [{"step_number": 1, "instruction": "string"}],
  "personal_notes": "string or null"
}
Be thorough with ingredients — include quantities and standard units. Convert vague measurements to standard units when possible. For instructions, break into clear numbered steps. If information is missing, use null rather than guessing.`

export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, error: 'Server configuration error' })
  }

  try {
    const { images, mediaTypes, model } = req.body

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ success: false, error: 'images array required' })
    }

    if (images.length > 6) {
      return res.status(400).json({ success: false, error: 'Maximum 6 images allowed' })
    }

    const isMulti = images.length > 1
    const systemPrompt = isMulti ? MULTI_PROMPT : SINGLE_PROMPT

    // Build image content blocks
    const imageBlocks = images.map((base64, i) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaTypes?.[i] || 'image/jpeg',
        data: base64,
      },
    }))

    const userText = isMulti
      ? `Extract the recipe from these ${images.length} photos. They are multiple pages or sides of the same recipe.`
      : 'Extract the recipe from this photo of a recipe card or cookbook page.'

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [...imageBlocks, { type: 'text', text: userText }],
        }],
      }),
    })

    if (!response.ok) {
      return res.status(502).json({ success: false, error: 'Photo extraction failed. Try again.' })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const recipe = JSON.parse(cleaned)

    return res.status(200).json({ success: true, recipe })
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Could not read the photo. Try a clearer image or enter manually.' })
  }
}
