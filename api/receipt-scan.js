/**
 * /api/receipt-scan.js — Receipt parsing via Haiku vision.
 * Uploads are handled client-side to Supabase Storage.
 * Downloads image, sends to Claude for extraction, writes results to
 * shopping_trips + shopping_trip_items + ingredient_purchase_history.
 */
import { createClient } from '@supabase/supabase-js'

const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

const RECEIPT_PROMPT = `You are parsing a grocery receipt. Extract all line items and totals.
Return ONLY valid JSON in this exact format, nothing else:
{
  "store": "store name",
  "date": "YYYY-MM-DD or null",
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00,
  "items": [
    { "name": "item name as printed", "price": 0.00, "quantity": 1 }
  ]
}`

const BULK_STORES = ['costco', "sam's club", 'sams club', "bj's", 'bjs wholesale']

const HIGH_CONFIDENCE_THRESHOLD = 50
const LOW_CONFIDENCE_THRESHOLD = 30

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
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!ANTHROPIC_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    const { tripId, imagePath, householdId } = req.body
    if (!tripId || !imagePath) {
      return res.status(400).json({ error: 'tripId and imagePath required' })
    }

    // Download image from Supabase Storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from('receipts').download(imagePath)
    if (downloadErr || !fileData) {
      return res.status(400).json({ error: 'Could not download receipt image' })
    }

    // Convert to base64
    const buffer = Buffer.from(await fileData.arrayBuffer())
    const base64 = buffer.toString('base64')
    const mediaType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg'

    // Send to Claude Haiku for parsing
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
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
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

    // Get trip store info
    const { data: tripRow } = await supabase.from('shopping_trips')
      .select('store_name').eq('id', tripId).single()
    const storeName = tripRow?.store_name || parsed.store || ''
    const storeType = BULK_STORES.some(s => storeName.toLowerCase().includes(s)) ? 'bulk' : 'standard'

    // Update shopping_trips with cost + receipt info
    await supabase.from('shopping_trips').update({
      actual_cost: parsed.total || null,
      receipt_photo_url: imagePath,
      receipt_scanned_at: new Date().toISOString(),
      receipt_subtotal: parsed.subtotal || null,
      item_count: parsed.items?.length || null,
    }).eq('id', tripId)

    // Load trip items + list items for fuzzy matching (separate queries per LESSONS.md)
    const { data: tripItems } = await supabase.from('shopping_trip_items')
      .select('id, shopping_list_item_id').eq('trip_id', tripId)
    let listMap = {}
    if (tripItems?.length) {
      const itemIds = tripItems.map(r => r.shopping_list_item_id)
      const { data: listItems } = await supabase.from('shopping_list_items')
        .select('id, name, quantity, unit, source_meal_name').in('id', itemIds)
      listMap = Object.fromEntries((listItems || []).map(i => [i.id, i]))
    }

    // Build source_meal_name → count map for cost splitting
    const mealCountMap = {}
    for (const ti of (tripItems || [])) {
      const li = listMap[ti.shopping_list_item_id]
      if (!li) continue
      const key = li.name.toLowerCase()
      if (!mealCountMap[key]) mealCountMap[key] = []
      if (li.source_meal_name) mealCountMap[key].push(li.source_meal_name)
    }

    // Fuzzy match receipt items against trip items
    const matchedItems = []
    const unmatchedItems = []
    const needsConfirmation = []
    const receiptItems = parsed.items || []
    const usedTripItemIds = new Set()

    for (const ri of receiptItems) {
      const receiptName = (ri.name || '').toLowerCase()
      let bestMatch = null
      let bestScore = 0

      for (const ti of (tripItems || [])) {
        if (usedTripItemIds.has(ti.id)) continue
        const listItem = listMap[ti.shopping_list_item_id]
        if (!listItem) continue
        const listName = (listItem.name || '').toLowerCase()

        let score = 0
        if (receiptName === listName) score = 100
        else if (receiptName.includes(listName) || listName.includes(receiptName)) score = 70
        else {
          const rWords = receiptName.split(/\s+/)
          const lWords = listName.split(/\s+/)
          const overlap = rWords.filter(w => lWords.some(lw => lw.includes(w) || w.includes(lw))).length
          if (overlap > 0) score = (overlap / Math.max(rWords.length, lWords.length)) * 50
        }

        if (score > bestScore) { bestScore = score; bestMatch = ti }
      }

      if (bestMatch && bestScore >= HIGH_CONFIDENCE_THRESHOLD) {
        // High confidence — auto-record
        usedTripItemIds.add(bestMatch.id)
        await supabase.from('shopping_trip_items').update({ actual_price: ri.price }).eq('id', bestMatch.id)
        const li = listMap[bestMatch.shopping_list_item_id]
        const matchName = li?.name || ri.name
        matchedItems.push({ name: matchName, price: ri.price, receiptName: ri.name })

        // Record purchase history
        await recordPurchaseHistory(supabase, {
          householdId, tripId, storeName, storeType,
          ingredientName: matchName.toLowerCase().trim(),
          receiptLineItem: ri.name,
          price: ri.price,
          listItem: li,
          mealCountMap,
        })

        // Update pantry staple purchase tracking if ingredient is a staple
        await updateStaplePurchase(supabase, householdId, matchName.toLowerCase().trim())
      } else if (bestMatch && bestScore >= LOW_CONFIDENCE_THRESHOLD) {
        // Low confidence — needs confirmation
        const li = listMap[bestMatch.shopping_list_item_id]
        needsConfirmation.push({
          receiptItem: ri.name,
          suggestedMatch: li?.name || null,
          suggestedMatchId: bestMatch.id,
          price: ri.price,
          listItemId: li?.id || null,
        })
      } else {
        unmatchedItems.push({ name: ri.name, price: ri.price })
      }
    }

    // Determine reconciliation status
    let reconciliation_status = 'needs_review'
    if (receiptItems.length > 0 && unmatchedItems.length === 0 && needsConfirmation.length === 0) {
      reconciliation_status = 'matched'
    } else if (matchedItems.length > 0) {
      reconciliation_status = 'partial'
    }

    await supabase.from('shopping_trips').update({ reconciliation_status }).eq('id', tripId)

    return res.status(200).json({
      store: parsed.store,
      date: parsed.date,
      subtotal: parsed.subtotal,
      tax: parsed.tax,
      total: parsed.total,
      matchedItems,
      unmatchedItems,
      needsConfirmation,
      reconciliation_status,
      storeName,
      storeType,
    })
  } catch (error) {
    console.error('[receipt-scan] Error:', error)
    return res.status(200).json({ error: 'Could not read receipt' })
  }
}

/**
 * Record ingredient purchase history. Splits cost evenly if ingredient
 * appears in multiple recipes this week.
 */
async function recordPurchaseHistory(supabase, { householdId, tripId, storeName, storeType, ingredientName, receiptLineItem, price, listItem, mealCountMap }) {
  const today = new Date().toISOString().split('T')[0]
  const recipes = mealCountMap[ingredientName] || (listItem?.source_meal_name ? [listItem.source_meal_name] : [])
  const splitCount = recipes.length || 1
  const splitPrice = price / splitCount

  if (recipes.length > 0) {
    for (const recipeName of recipes) {
      await supabase.from('ingredient_purchase_history').insert({
        household_id: householdId,
        trip_id: tripId,
        ingredient_name: ingredientName,
        receipt_line_item: receiptLineItem,
        store_name: storeName,
        store_type: storeType,
        recipe_quantity: listItem?.quantity || null,
        recipe_unit: listItem?.unit || null,
        recipe_name: recipeName,
        actual_price: Math.round(splitPrice * 100) / 100,
        purchase_date: today,
        is_bulk_purchase: storeType === 'bulk',
      })
    }
  } else {
    await supabase.from('ingredient_purchase_history').insert({
      household_id: householdId,
      trip_id: tripId,
      ingredient_name: ingredientName,
      receipt_line_item: receiptLineItem,
      store_name: storeName,
      store_type: storeType,
      recipe_quantity: listItem?.quantity || null,
      recipe_unit: listItem?.unit || null,
      recipe_name: null,
      actual_price: price,
      purchase_date: today,
      is_bulk_purchase: storeType === 'bulk',
    })
  }
}

/**
 * Update pantry staple purchase tracking — frequency data for Sage nudges.
 * Recalculates rolling average days between purchases and next purchase estimate.
 */
async function updateStaplePurchase(supabase, householdId, ingredientName) {
  const { data: staple } = await supabase.from('pantry_staples')
    .select('id, purchase_count, last_purchased_at, avg_days_between_purchase')
    .eq('household_id', householdId)
    .ilike('name', ingredientName)
    .maybeSingle()

  if (!staple) return // Not a pantry staple — skip

  const now = new Date()
  const newCount = (staple.purchase_count || 0) + 1
  const update = {
    last_purchased_at: now.toISOString(),
    purchase_count: newCount,
  }

  // Calculate rolling average days between purchases
  if (staple.last_purchased_at && newCount >= 2) {
    const lastDate = new Date(staple.last_purchased_at)
    const daysSinceLast = Math.max(1, Math.round((now - lastDate) / (1000 * 60 * 60 * 24)))
    const prevAvg = staple.avg_days_between_purchase || daysSinceLast
    // Rolling average: weight recent purchase more
    const newAvg = Math.round(((prevAvg * (newCount - 2)) + daysSinceLast) / (newCount - 1))
    update.avg_days_between_purchase = newAvg
    // Estimate next purchase
    const nextDate = new Date(now.getTime() + newAvg * 24 * 60 * 60 * 1000)
    update.next_purchase_estimate = nextDate.toISOString().split('T')[0]
  }

  await supabase.from('pantry_staples').update(update).eq('id', staple.id)
}
