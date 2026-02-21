// Vercel Serverless Function to proxy Claude API calls
// This avoids CORS issues when calling Anthropic API from the browser

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY

  if (!ANTHROPIC_API_KEY) {
    console.error('Missing Anthropic API key')
    return res.status(500).json({ 
      error: 'Configuration error: Missing API key' 
    })
  }

  try {
    const { messages, systemPrompt } = req.body

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array required' 
      })
    }

    console.log('Proxying request to Claude API with', messages.length, 'messages')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt || getDefaultSystemPrompt(),
        messages: messages
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', response.status, errorText)
      
      return res.status(response.status).json({
        error: `Claude API error: ${errorText}`
      })
    }

    const data = await response.json()
    console.log('Successfully got response from Claude')

    return res.status(200).json(data)

  } catch (error) {
    console.error('Proxy error:', error)
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    })
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
- Make the better option easier to reach

Your role:
- Help families plan their weekly meals
- Consider everyone's preferences and the real constraints of their schedule
- Be proactive but never pushy
- Learn from dismissals and adapt silently
- Keep responses concise (2-4 sentences unless asked for more)

Always maintain context awareness - you know the family's recipes, preferences, constraints, and history.`
}
