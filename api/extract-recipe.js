/**
 * /api/extract-recipe.js — Recipe URL extraction via Anthropic web search tool.
 * Uses Claude's built-in web search to fetch and parse recipe pages.
 * Gated to Plus/Premium tiers — Free users get a warm upgrade prompt.
 * Reads sage_model from app_config via service role key.
 */

import Anthropic from '@anthropic-ai/sdk'
import { getSageModelServer } from './_lib/getSageModel.js'

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
    const { url, tier } = req.body

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'url string required' })
    }

    // Tier gate — URL extraction is Plus/Premium only
    if (!tier || tier === 'free') {
      return res.status(403).json({
        success: false,
        error: 'tier_required',
        message: 'URL import is available on Plus and Premium plans.',
      })
    }

    // Resolve model server-side
    const model = await getSageModelServer()

    // Use Anthropic SDK with web search tool
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Find and extract this recipe: ${url}

Return ONLY a valid JSON object with: name, description, author, source_url (set to "${url}"), category (e.g. Main, Side, Dessert, Appetizer, Breakfast, Soup, Salad, Snack, Drink, Bread, Sauce), cuisine (e.g. Italian, Mexican, American), method (one of: stovetop, baked, slow cooker, no-cook, grilled, other), difficulty (one of: easy, medium, advanced), prep_time_minutes, cook_time_minutes, servings, ingredients (array of {name, quantity, unit, preparation_note}), instructions (array of {step_number, instruction}), personal_notes. Set unknown fields to null. No markdown, no explanation — just the JSON object.`,
      }],
    })

    // Extract the final text block from the response
    let text = ''
    for (const block of response.content) {
      if (block.type === 'text') {
        text = block.text
      }
    }

    if (!text) {
      return res.status(422).json({ success: false, error: 'parse_failed' })
    }

    // Parse JSON — handle markdown code blocks
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const recipe = JSON.parse(cleaned)
      recipe.source_url = url
      return res.status(200).json({ success: true, recipe })
    } catch {
      return res.status(422).json({ success: false, error: 'parse_failed' })
    }
  } catch (error) {
    console.error('[extract-recipe] Error:', error.message)
    return res.status(500).json({ success: false, error: 'parse_failed' })
  }
}
