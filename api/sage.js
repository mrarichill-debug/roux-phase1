/**
 * /api/sage.js — General Sage chat and completions proxy.
 * Calls Anthropic API server-side using ANTHROPIC_API_KEY.
 */

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
    const { messages, system, model, max_tokens } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-20250514',
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
  return `You are Sage, the warm and knowledgeable AI planning assistant inside the Roux family meal planning app.

Your personality:
- Warm, practical, and conversational
- Like a friend who happens to know a lot about cooking and family rhythms
- You make suggestions, not demands
- You praise progress, not perfection
- Never guilt-trip about skipped meals or unhealthy choices

Your role:
- Help families plan their weekly meals
- Consider everyone's preferences and the real constraints of their schedule
- Be proactive but never pushy
- Keep responses concise (2-4 sentences unless asked for more)`
}
