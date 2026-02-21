const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

// Call Claude API with context
export const callSage = async (messages, systemPrompt = null) => {
  // Check for API key
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === 'undefined' || ANTHROPIC_API_KEY === '') {
    console.error('Anthropic API key is missing or invalid:', ANTHROPIC_API_KEY)
    throw new Error('Configuration error: Anthropic API key not found. Please contact support.')
  }

  console.log('Calling Sage with', messages.length, 'messages')
  console.log('API Key starts with:', ANTHROPIC_API_KEY.substring(0, 10) + '...')

  try {
    const requestBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt || getDefaultSystemPrompt(),
      messages: messages
    }

    console.log('Sending request to Claude API...')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    })

    console.log('Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API error response:', errorText)
      
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Anthropic API key.')
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.')
      } else if (response.status === 400) {
        throw new Error('Bad request. There may be an issue with the message format.')
      } else {
        throw new Error(`API error (${response.status}): ${errorText}`)
      }
    }

    const data = await response.json()
    console.log('Got response from Sage')
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      console.error('Unexpected response format:', data)
      throw new Error('Unexpected response from Sage')
    }

    return data.content[0].text
  } catch (error) {
    console.error('Error calling Sage:', error)
    
    if (error.message.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.')
    }
    
    throw error
  }
}

// Default system prompt for Sage
const getDefaultSystemPrompt = () => {
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

// System prompt for tutorial flow
export const getTutorialSystemPrompt = (userName) => {
  return `You are Sage, welcoming ${userName} to Roux for the first time.

Guide them through setup with warmth and clarity:
1. Learn about their household (just themselves or a family)
2. Learn basic food preferences (favorites, dislikes, restrictions)
3. Help them import their first recipe
4. Teach them about day types
5. Set up their first week

Keep each response short and actionable. Ask one question at a time. Be encouraging and friendly.`
}

// System prompt for skipped meal conversation
export const getSkippedMealSystemPrompt = (mealName, ingredients) => {
  return `${getDefaultSystemPrompt()}

The user just marked "${mealName}" as skipped. The meal had these ingredients: ${ingredients.join(', ')}.

Help them decide what to do:
- Move it to another day this week?
- Freeze the ingredients for later?
- Plan to use it next week?
- Just skip it and move on?

Ask a brief, helpful question (1-2 sentences) and offer clear options.`
}

// Parse Sage's response to extract structured data if needed
export const parseSageResponse = (text) => {
  // Check if response contains JSON (for structured data)
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
  if (jsonMatch) {
    try {
      return {
        text: text.replace(/```json\n[\s\S]*?\n```/, '').trim(),
        data: JSON.parse(jsonMatch[1])
      }
    } catch (e) {
      return { text, data: null }
    }
  }
  return { text, data: null }
}
