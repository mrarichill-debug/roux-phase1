/**
 * /api/extract-recipe.js — Recipe URL extraction via Anthropic web search tool.
 * Uses Claude's built-in web search to fetch and parse recipe pages.
 * Free users get 3 extractions/month. Full Plan users get unlimited.
 * Reads sage_model from app_config via service role key.
 */

export const config = {
  maxDuration: 60,
}

import Anthropic from '@anthropic-ai/sdk'
import { getSageModelServer } from './_lib/getSageModel.js'

const RECIPE_PROMPT = (url) => `Find and extract this recipe: ${url}

Return ONLY a valid JSON object with: name, description, author, source_url (set to "${url}"), category (e.g. Main, Side, Dessert, Appetizer, Breakfast, Soup, Salad, Snack, Drink, Bread, Sauce), cuisine (e.g. Italian, Mexican, American), method (one of: stovetop, baked, slow cooker, no-cook, grilled, other), difficulty (one of: easy, medium, advanced), prep_time_minutes, cook_time_minutes, servings, ingredients (array of {name, quantity, unit, preparation_note}), instructions (array of {step_number, instruction}), personal_notes. Set unknown fields to null. No markdown, no explanation — just the JSON object.`

const RETRY_PROMPT = (url) => `Find and extract this recipe: ${url}

IMPORTANT: Respond with ONLY a raw JSON object. No markdown, no explanation, no backticks. Start your response with { and end with }.

Fields: name, description, author, source_url (set to "${url}"), category, cuisine, method (stovetop/baked/slow cooker/no-cook/grilled/other), difficulty (easy/medium/advanced), prep_time_minutes, cook_time_minutes, servings, ingredients (array of {name, quantity, unit, preparation_note}), instructions (array of {step_number, instruction}), personal_notes. Set unknown fields to null.`

function extractJsonFromResponse(text) {
  if (!text) return null

  // Remove markdown fences
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  // Try direct parse first
  try { return JSON.parse(cleaned) } catch {}

  // Try finding JSON object anywhere in the text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]) } catch {}
  }

  // Try finding just the recipe object if response has extra wrapper
  const recipeMatch = cleaned.match(/"name"\s*:\s*"[^"]+"/)
  if (recipeMatch) {
    const start = cleaned.indexOf('{', Math.max(0, cleaned.indexOf(recipeMatch[0]) - 50))
    if (start !== -1) {
      try { return JSON.parse(cleaned.substring(start)) } catch {}
    }
  }

  return null
}

function extractTextFromResponse(response) {
  let text = ''
  for (const block of response.content) {
    if (block.type === 'text') {
      text = block.text
    }
  }
  return text
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
    const { url, tier } = req.body

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'url string required' })
    }

    // Free users: URL extraction allowed (3/month limit enforced client-side)
    // No server-side tier gate — both free and full can call this endpoint

    const model = await getSageModelServer()
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

    // 55-second timeout — under Vercel's 60s maxDuration limit
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 55000)
    )

    async function extractWithRetry() {
      // First attempt
      const response = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: RECIPE_PROMPT(url) }],
      })

      const text = extractTextFromResponse(response)
      const recipe = extractJsonFromResponse(text)

      if (recipe) {
        recipe.source_url = url
        return { success: true, recipe }
      }

      // Retry once with stronger formatting instruction
      console.log('[extract-recipe] First parse failed, retrying with strict prompt')
      const retryResponse = await anthropic.messages.create({
        model,
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: RETRY_PROMPT(url) }],
      })

      const retryText = extractTextFromResponse(retryResponse)
      const retryRecipe = extractJsonFromResponse(retryText)

      if (retryRecipe) {
        retryRecipe.source_url = url
        return { success: true, recipe: retryRecipe }
      }

      return null
    }

    const result = await Promise.race([extractWithRetry(), timeoutPromise])

    if (result) {
      return res.status(200).json(result)
    }

    console.error('[extract-recipe] Both parse attempts failed')
    return res.status(422).json({ success: false, error: 'parse_failed' })
  } catch (error) {
    if (error.message === 'timeout') {
      console.error('[extract-recipe] Timed out after 25s')
      return res.status(408).json({ success: false, error: 'timeout', message: 'Sage took too long to read that page.' })
    }
    console.error('[extract-recipe] Error:', error.message)
    return res.status(500).json({ success: false, error: 'parse_failed' })
  }
}
