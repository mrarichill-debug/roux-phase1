/**
 * /api/eating-out-receipt.js — Simple receipt total extraction via Haiku vision.
 * Just extracts the total amount from a receipt photo. No item matching needed.
 */
import { createClient } from '@supabase/supabase-js'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

const RECEIPT_PROMPT = `Look at this receipt and return ONLY a JSON object with one field:
{ "total": 0.00 }
Just the final total amount paid. Nothing else.`

export const config = {
  api: { bodyParser: { sizeLimit: '1mb' } },
}

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
    const { image, mediaType } = req.body
    if (!image) {
      return res.status(400).json({ error: 'image required' })
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
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
            { type: 'text', text: RECEIPT_PROMPT },
          ],
        }],
      }),
    })

    if (!response.ok) {
      return res.status(200).json({ error: 'Could not read receipt' })
    }

    const aiData = await response.json()
    const text = aiData.content?.[0]?.text || ''

    let parsed
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      return res.status(200).json({ error: 'Could not read receipt' })
    }

    return res.status(200).json({ total: parsed.total || null })
  } catch (error) {
    console.error('[eating-out-receipt] Error:', error)
    return res.status(200).json({ error: 'Could not read receipt' })
  }
}
