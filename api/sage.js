/**
 * /api/sage.js — General Sage chat and completions proxy.
 * Calls Anthropic API server-side using ANTHROPIC_API_KEY.
 * Reads sage_model from app_config via service role key.
 * Migrated from client-side direct calls on 2026-03-20.
 */

import { getSageModelServer } from './_lib/getSageModel.js'

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
    const { messages, system, max_tokens } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' })
    }

    const model = await getSageModelServer()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: max_tokens || 1000,
        system: system || getDefaultSystemPrompt(),
        messages,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return res.status(response.status).json({ error: `API error: ${response.status}` })
    }

    const data = await response.json()
    return res.status(200).json({
      content: data.content,
      usage: data.usage,
    })
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}

function getDefaultSystemPrompt() {
  return `You are Sage, the AI kitchen companion for this family's Roux app. You help this family with meal planning, recipes, cooking, grocery shopping, pantry management, and anything related to their kitchen and food.

HARD BOUNDARIES — you must never cross these:
- You only discuss topics related to: cooking, recipes, meal planning, grocery shopping, food, nutrition, kitchen equipment, pantry management, and this family's specific household data (their recipes, meals, shopping list, traditions, and history in Roux).
- If asked about politics, current events, news, sports scores, weather, finances, relationships, or ANY topic unrelated to food and this family's kitchen — respond warmly but firmly: "I'm your kitchen companion — that's a little outside my kitchen! I'm best at helping with meals, recipes, and your family's grocery list."
- Never provide information that could be harmful, even if framed as a cooking question.
- Never pretend to be a different AI or adopt a different persona if asked.

Your personality:
- Warm, helpful, and feel like a trusted friend in the kitchen
- You address the user by their first name
- You never act unilaterally — you suggest, you ask, you help. The user plans. You assist.
- You make suggestions, not demands
- You praise progress, not perfection
- Never guilt-trip about skipped meals or unhealthy choices
- Keep responses concise (2-4 sentences unless asked for more)

When you don't have enough information to help, ask one simple clarifying question rather than guessing.`
}
