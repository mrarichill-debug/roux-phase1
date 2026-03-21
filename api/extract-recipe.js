/**
 * /api/extract-recipe.js — Recipe URL extraction via Anthropic API.
 * Fetches the URL server-side, strips noise, sends to Claude for structured extraction.
 * Known-blocked domains short-circuit before fetch. Bot protection detected post-fetch.
 * Reads sage_model from app_config via service role key.
 */

import { getSageModelServer } from './_lib/getSageModel.js'

const BLOCKED_DOMAINS = [
  'allrecipes.com',
  'foodnetwork.com',
  'cooking.nytimes.com',
  'tasty.co',
  'delish.com',
  'epicurious.com',
  'bonappetit.com',
  'food.com',
  'yummly.com',
  'pillsbury.com',
  'bettycrocker.com',
]

const EXTRACTION_PROMPT = `You are Sage, a recipe extraction assistant for the Roux family meal planning app. Extract a structured recipe from the provided web page content. Return ONLY valid JSON with these fields:
{
  "name": "string (recipe title)",
  "description": "string (1-2 sentence summary, what makes it special)",
  "author": "string or null",
  "source_url": "string or null (original URL if provided)",
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

function getBlockedDomain(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return BLOCKED_DOMAINS.find(d => hostname === d || hostname.endsWith('.' + d)) || null
  } catch {
    return null
  }
}

function friendlySiteName(domain) {
  const names = {
    'allrecipes.com': 'AllRecipes',
    'foodnetwork.com': 'Food Network',
    'cooking.nytimes.com': 'NYT Cooking',
    'tasty.co': 'Tasty',
    'delish.com': 'Delish',
    'epicurious.com': 'Epicurious',
    'bonappetit.com': 'Bon Appétit',
    'food.com': 'Food.com',
    'yummly.com': 'Yummly',
    'pillsbury.com': 'Pillsbury',
    'bettycrocker.com': 'Betty Crocker',
  }
  return names[domain] || domain
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
    const { url } = req.body

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'url string required' })
    }

    // Check known-blocked domains before fetching
    const blockedDomain = getBlockedDomain(url)
    if (blockedDomain) {
      return res.status(422).json({
        success: false,
        error: 'blocked_domain',
        site: friendlySiteName(blockedDomain),
      })
    }

    // Fetch the recipe page server-side with realistic browser headers
    console.log('[extract-recipe] Attempting fetch:', url)
    let pageContent
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
        },
        redirect: 'follow',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      console.log('[extract-recipe] Fetch response:', pageRes.status, pageRes.headers.get('content-type'))
      if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`)
      const contentType = pageRes.headers.get('content-type') || ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        console.log('[extract-recipe] Non-HTML content-type:', contentType)
        return res.status(422).json({ success: false, error: 'fetch_failed', debug: `Non-HTML content-type: ${contentType}` })
      }
      pageContent = await pageRes.text()
      console.log('[extract-recipe] Page content length:', pageContent.length)
    } catch (fetchErr) {
      console.error('[extract-recipe] Fetch error:', fetchErr.message, fetchErr.code)
      return res.status(422).json({ success: false, error: 'fetch_failed', debug: fetchErr.message, code: fetchErr.code || null })
    }

    // Detect bot protection pages (Cloudflare challenge, login walls, etc.)
    const lowerContent = pageContent.toLowerCase()
    const isBlocked = (
      (lowerContent.includes('cf-browser-verification') || (lowerContent.includes('cloudflare') && lowerContent.includes('challenge'))) ||
      (lowerContent.includes('just a moment') && pageContent.length < 5000) ||
      (lowerContent.includes('access denied') && pageContent.length < 3000) ||
      (lowerContent.includes('please verify') && lowerContent.includes('human') && pageContent.length < 5000)
    )
    if (isBlocked) {
      return res.status(422).json({ success: false, error: 'fetch_failed' })
    }

    // Strip scripts, styles, nav, footer, ads to reduce token usage
    pageContent = pageContent
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()

    // Truncate to avoid token limits
    if (pageContent.length > 30000) {
      pageContent = pageContent.slice(0, 30000)
    }

    // Resolve model server-side from app_config
    const model = await getSageModelServer()

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: EXTRACTION_PROMPT,
        messages: [{
          role: 'user',
          content: `Extract the recipe from this web page content. The original URL is: ${url}\n\n---\n\n${pageContent}`,
        }],
      }),
    })

    if (!response.ok) {
      return res.status(502).json({ success: false, error: 'parse_failed' })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // Parse JSON from response
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const recipe = JSON.parse(cleaned)
      recipe.source_url = url
      return res.status(200).json({ success: true, recipe })
    } catch {
      return res.status(422).json({ success: false, error: 'parse_failed' })
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: 'parse_failed' })
  }
}
