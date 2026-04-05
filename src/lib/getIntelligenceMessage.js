/**
 * getIntelligenceMessage.js — Daily message pool system.
 * Layer 1: Arc stage determines what Roux is allowed to say.
 * Layer 2: Available data determines which specific message surfaces today.
 * See docs/MESSAGE-POOL.md for the full message text.
 */

const DOW_KEYS  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
const DOW_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// ── Arc answers by stage range ──────────────────────────────────────────────
const ARC_ANSWERS = {
  1: 'Make sure you never forget an ingredient.',
  2: 'Make sure you never forget an ingredient.',
  3: 'Remember what your family loves.',
  4: 'Remember what your family loves.',
  5: "Know what's in your kitchen and what you're spending.",
  6: "Know what's in your kitchen and what you're spending.",
  7: 'Know your family through every season.',
}

// ── Actions by stage ────────────────────────────────────────────────────────
const STAGE_ACTIONS = {
  1: { primary: { label: 'Plan a meal', route: '/thisweek' }, secondary: { label: 'View my list', route: '/pantry' } },
  2: { primary: { label: 'See the breakdown', route: '/pantry' }, secondary: null },
  3: { primary: { label: 'View this week', route: '/thisweek' }, secondary: { label: 'Browse recipes', route: '/meals/recipes' } },
  4: { primary: { label: 'Browse recipes', route: '/meals/recipes' }, secondary: null },
  5: { primary: { label: 'View my list', route: '/pantry' }, secondary: { label: 'Plan the week', route: '/thisweek' } },
  6: { primary: { label: 'Plan next week', route: '/thisweek' }, secondary: null },
  7: { primary: { label: 'Plan next week', route: '/thisweek' }, secondary: null },
}

// ── Message pools — exact text from docs/MESSAGE-POOL.md ────────────────────

const POOLS = {
  1: [
    { id: 's1-1',  tpl: "You've got {n} meals planned this week — {listN} ingredients ready on your list, nothing to forget.", v: d => d.planned > 0 && d.listItems > 0 ? { n: d.planned, listN: d.listItems } : null },
    { id: 's1-2',  tpl: "Nothing planned for {day} yet. Want to get ahead of it before the week gets away from you?", v: d => d.firstOpenDay ? { day: d.firstOpenDay } : null },
    { id: 's1-3',  tpl: "{meal} is on for {day}. I've already added everything you need to the list.", v: d => d.namedMeal && d.namedMealDay ? { meal: d.namedMeal, day: d.namedMealDay } : null },
    { id: 's1-4',  tpl: "Looks like a busy {day} ahead. Worth keeping dinner simple that night.", v: d => d.busyDay ? { day: d.busyDay } : null },
    { id: 's1-5',  tpl: "{day} is clear on the calendar. Good night for something you actually enjoy making.", v: d => d.clearDay ? { day: d.clearDay } : null },
    { id: 's1-6',  tpl: "Three nights still unplanned this week. No pressure — I'll be here when you're ready.", v: d => d.openCount >= 3 ? {} : null },
    { id: 's1-7',  tpl: "Your shopping list has {n} items ready. That's {n} fewer things to remember at the store.", v: d => d.listItems > 0 ? { n: d.listItems } : null },
    { id: 's1-8',  tpl: "You added {meal} — I've added {n} ingredients to your list automatically.", v: d => d.namedMeal && d.listItems > 0 ? { meal: d.namedMeal, n: d.listItems } : null },
    { id: 's1-11', tpl: "{tonight} tonight. Everything you need is already on the list.", v: d => d.tonight && d.listItems > 0 ? { tonight: d.tonight } : null },
    { id: 's1-12', tpl: "The weekend is coming up — usually a good time to try something new. Nothing planned yet.", v: d => d.isBeforeWeekend && d.weekendOpen ? {} : null },
    { id: 's1-10', tpl: "Next week is completely open. This week is the one that matters — how's it looking?", v: d => d.planned > 0 ? {} : null },
  ],

  2: [
    { id: 's2-5',  tpl: "First receipt scanned — you spent ${amount}. Eating out those same meals would've cost roughly double.", v: d => d.recentReceipt ? { amount: d.receiptAmount } : null, priority: true },
    { id: 's2-1',  tpl: "You skipped {meal} last {day}. Worth rescheduling, or moving on from it?", v: d => d.skippedMeal ? { meal: d.skippedMeal, day: d.skippedDay } : null, priority: true },
    { id: 's2-2',  tpl: "Your groceries last week: ${amount}. I'm starting to get a picture of what your kitchen actually costs.", v: d => d.totalSpent > 0 ? { amount: d.totalSpent } : null },
    { id: 's2-4',  tpl: "Cooking at home {n} nights last week. That's a solid start.", v: d => d.planned > 0 ? { n: d.planned } : null },
    { id: 's2-7',  tpl: "Two weeks in a row now. I'm starting to learn your rhythm.", v: d => d.planned > 3 ? {} : null },
    { id: 's2-8',  tpl: "Nothing on the list got forgotten this week. That's exactly the point.", v: d => d.listItems > 0 && d.shopComplete ? {} : null },
    { id: 's2-10', tpl: "You've completed your first full week. Every week from here gets easier.", v: d => d.planned > 0 ? {} : null },
    { id: 's2-11', tpl: "Scan your receipt after this week's shop and I'll show you what you saved.", v: d => !d.recentReceipt && d.planned > 0 ? {} : null },
    { id: 's2-12', tpl: "{meal} was on the plan but didn't happen. Want to move it to next week or let it go?", v: d => d.skippedMeal ? { meal: d.skippedMeal } : null },
  ],

  3: [
    { id: 's3-1',  tpl: "I haven't seen {meal} in a while. Worth bringing back next week?", v: d => d.namedMeal ? { meal: d.namedMeal } : null },
    { id: 's3-2',  tpl: "{day} has been your busiest night lately. I'll plan around it.", v: d => d.busyDay ? { day: d.busyDay } : null },
    { id: 's3-4',  tpl: "Next week looks clear on {day} — good night for something new.", v: d => d.clearDay ? { day: d.clearDay } : null },
    { id: 's3-5',  tpl: "You've cooked {n} nights in a row without a skip. That's your best streak yet.", v: d => d.planned >= 5 ? { n: d.planned } : null },
    { id: 's3-6',  tpl: "{meal} gets eaten every time you make it. That one's a keeper.", v: d => d.namedMeal ? { meal: d.namedMeal } : null },
    { id: 's3-8',  tpl: "You haven't tried anything new in a while. Next clear night might be worth experimenting.", v: d => d.planned > 0 ? {} : null },
    { id: 's3-9',  tpl: "Next week is looking busy — might be worth planning simpler meals than usual.", v: d => d.busyDay ? {} : null },
    { id: 's3-11', tpl: "I noticed you moved {meal} this week. Want to find a better night for it?", v: d => d.namedMeal ? { meal: d.namedMeal } : null },
  ],

  4: [
    { id: 's4-3',  tpl: "{meal} never has leftovers. Your family's telling you something.", v: d => d.namedMeal ? { meal: d.namedMeal } : null },
    { id: 's4-4',  tpl: "You've saved roughly ${amount} this month cooking at home. That's real money.", v: d => d.totalSpent > 0 ? { amount: d.totalSpent } : null },
    { id: 's4-7',  tpl: "Three eating-out nights this week — busier than usual. No judgment, just noticed.", v: d => d.eatingOutCount >= 3 ? {} : null },
    { id: 's4-8',  tpl: "Your family has eaten {meal} many times and never left anything on the plate. That's the definition of a keeper.", v: d => d.namedMeal ? { meal: d.namedMeal } : null },
    { id: 's4-9',  tpl: "You tend to try new meals on {day}. Good instinct — that's your lowest-pressure night.", v: d => d.clearDay ? { day: d.clearDay } : null },
    { id: 's4-2',  tpl: "Last time you ordered out on a {day}, it cost ${amount}. Cooking that night would've been about half.", v: d => d.eatingOutDay && d.totalSpent > 0 ? { day: d.eatingOutDay, amount: d.totalSpent } : null },
  ],

  5: [
    { id: 's5-2',  tpl: "Your grocery spend has been consistent for a few weeks now. You've found your rhythm.", v: d => d.planned > 0 ? {} : null },
    { id: 's5-4',  tpl: "Cooking at home saved you roughly ${amount} last month compared to eating out every night.", v: d => d.totalSpent > 0 ? { amount: d.totalSpent } : null },
    { id: 's5-6',  tpl: "You've scanned {n} receipts now. I have a clear picture of what your kitchen actually costs to run.", v: d => d.receiptCount > 0 ? { n: d.receiptCount } : null },
    { id: 's5-8',  tpl: "Your spending has come down since you started planning. That's not an accident.", v: d => d.totalSpent > 0 ? {} : null },
    { id: 's5-9',  tpl: "Next shop looks light — only {n} items. Either the pantry is well stocked or next week needs more planning.", v: d => d.listItems > 0 && d.listItems < 15 ? { n: d.listItems } : null },
    { id: 's5-10', tpl: "You've made {meal} so many times — you probably don't need the recipe anymore.", v: d => d.namedMeal ? { meal: d.namedMeal } : null },
  ],

  6: [
    { id: 's6-1',  tpl: "I think I know your family well enough now — want me to plan next week? You can change anything.", v: () => ({}), oto: true },
    { id: 's6-3',  tpl: "You've planned {n} weeks in a row. That's a real habit now — not just an app.", v: d => d.weeksPlanned > 0 ? { n: d.weeksPlanned } : null },
    { id: 's6-5',  tpl: "Next week has {n} busy nights. Want me to keep it simple and plan around them?", v: d => d.busyNightCount > 0 ? { n: d.busyNightCount } : null },
    { id: 's6-8',  tpl: "You haven't tried something new in a while. Want me to work one in next week?", v: d => d.planned > 0 ? {} : null },
    { id: 's6-9',  tpl: "It's Sunday — next week is wide open. Want me to take a first pass at it?", v: d => d.isSunday ? {} : null },
    { id: 's6-10', tpl: "You've settled into a rhythm that works. Want me to build on it for next week?", v: d => d.planned > 3 ? {} : null },
  ],

  7: [
    { id: 's7-1',  tpl: "It's getting colder — your family tends to shift toward soups and comfort meals around this time of year. Want to bring some back?", v: d => d.isWinter ? {} : null },
    { id: 's7-4',  tpl: "You've been using Roux for a year. Your family has eaten {n} home-cooked meals together. That's not nothing.", v: d => d.totalMeals > 0 ? { n: d.totalMeals } : null, oto: true },
    { id: 's7-7',  tpl: "Summer's coming — your family tends to want lighter, faster meals. Worth planning for that shift.", v: d => d.isSummer ? {} : null },
    { id: 's7-9',  tpl: "Your family eats at home more in winter. I'll plan a bit fuller this time of year.", v: d => d.isWinter ? {} : null },
    { id: 's7-10', tpl: "It's been a full year. You've figured out what your family loves. I'm just here to remember it.", v: () => ({}), oto: true },
  ],
}

// ── Data extraction ─────────────────────────────────────────────────────────
function extractData({
  activePlan, weekMeals, tonightMeal, shoppingList,
  sageIntelligence, sageMessages, calendarConnected, shopTile, appUser,
}) {
  const today = new Date()
  const todayIdx = today.getDay()
  const todayDow = DOW_KEYS[todayIdx]

  // Planned meals
  const meals = weekMeals || []
  const planned = meals.length
  const plannedDays = new Set(meals.map(m => m.day_of_week))
  const openDays = DOW_KEYS.filter(d => !plannedDays.has(d))
  const firstOpenDay = openDays.length > 0 ? DOW_NAMES[DOW_KEYS.indexOf(openDays[0])] : null
  const openCount = 7 - planned

  // Named meal (any meal with a custom_name)
  const namedEntry = meals.find(m => m.custom_name) || null
  const namedMeal = namedEntry?.custom_name || null
  const namedMealDay = namedEntry ? DOW_NAMES[DOW_KEYS.indexOf(namedEntry.day_of_week)] : null

  // Tonight
  const tonight = tonightMeal?.custom_name || tonightMeal?.meals?.name ||
    tonightMeal?.recipes?.name || tonightMeal?.note || null

  // Shopping
  const listItems = shopTile?.remaining || 0
  const totalSpent = Math.round(shopTile?.totalSpent || shoppingList?.actual_cost || 0)
  const shopComplete = shopTile?.state === 'complete'

  // Sage messages
  const msgs = sageMessages || []
  const recentReceipt = msgs.some(m => m.source === 'background' && m.message?.includes('receipt'))
  const receiptAmount = totalSpent
  const skippedEntry = meals.find(m => m.status === 'skipped')
  const skippedMeal = skippedEntry?.custom_name || null
  const skippedDay = skippedEntry ? DOW_NAMES[DOW_KEYS.indexOf(skippedEntry.day_of_week)] : null

  // Calendar signals from sage
  const busyDayMsg = msgs.find(m => m.dayOfWeek)
  const busyDay = busyDayMsg?.dayOfWeek || null
  const clearDay = openDays.length > 0 ? DOW_NAMES[DOW_KEYS.indexOf(openDays[openDays.length - 1])] : null

  // Weekend
  const isBeforeWeekend = todayIdx >= 1 && todayIdx <= 4
  const weekendOpen = !plannedDays.has('saturday') || !plannedDays.has('sunday')

  // Eating out
  const eatingOutCount = meals.filter(m => m.slot_type === 'eating_out').length
  const eatingOutEntry = meals.find(m => m.slot_type === 'eating_out')
  const eatingOutDay = eatingOutEntry ? DOW_NAMES[DOW_KEYS.indexOf(eatingOutEntry.day_of_week)] : null

  // Intelligence scores
  const score = sageIntelligence?.score || {}
  const receiptCount = score.receipts || 0
  const weeksPlanned = score.reviews || 0
  const totalMeals = score.meals || 0

  // Seasonal
  const month = today.getMonth()
  const isWinter = month >= 10 || month <= 2
  const isSummer = month >= 5 && month <= 7
  const isSunday = todayIdx === 0

  // Shown messages tracking (7-day dedup)
  const shownMessages = appUser?.preferences?.shown_messages || {}

  return {
    planned, firstOpenDay, openCount, namedMeal, namedMealDay,
    tonight, listItems, totalSpent, shopComplete,
    recentReceipt, receiptAmount, skippedMeal, skippedDay,
    busyDay, clearDay, busyNightCount: busyDay ? 1 : 0,
    isBeforeWeekend, weekendOpen,
    eatingOutCount, eatingOutDay,
    receiptCount, weeksPlanned, totalMeals,
    isWinter, isSummer, isSunday,
    shownMessages,
  }
}

// ── Interpolation ───────────────────────────────────────────────────────────
function interpolate(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key]
    return val != null ? String(val) : `{${key}}`
  })
}

// ── Selection ──────────────────────────────────────────��────────────────────
function selectMessage(pool, data) {
  const now = Date.now()
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000

  // Filter: can fill variables + not shown in last 7 days + OTO not already shown
  const eligible = []
  for (const msg of pool) {
    // Check OTO
    if (msg.oto && data.shownMessages[msg.id]) continue

    // Check 7-day cooldown
    const lastShown = data.shownMessages[msg.id]
    if (lastShown && (now - new Date(lastShown).getTime()) < SEVEN_DAYS) continue

    // Check if variables can be filled
    const vars = msg.v(data)
    if (vars === null) continue

    eligible.push({ ...msg, vars })
  }

  if (eligible.length === 0) return null

  // Priority messages first
  const priority = eligible.filter(m => m.priority)
  const pick = priority.length > 0 ? priority[0] : eligible[0]
  const message = interpolate(pick.tpl, pick.vars)

  return { message, messageId: pick.id }
}

// ── Main export ─────────────────────────────────────────────────────────────
export function getIntelligenceMessage(inputData, arcStage) {
  const stage = arcStage || 1
  const data = extractData(inputData)

  // Try current stage pool first
  let result = selectMessage(POOLS[stage] || POOLS[1], data)

  // Fall back to lower stages if current stage has no eligible message
  if (!result) {
    for (let s = stage - 1; s >= 1; s--) {
      result = selectMessage(POOLS[s] || [], data)
      if (result) break
    }
  }

  // No message at all — signal humor card
  if (!result) return null

  const actions = STAGE_ACTIONS[stage] || STAGE_ACTIONS[1]

  return {
    message: result.message,
    arcAnswer: ARC_ANSWERS[stage] || ARC_ANSWERS[1],
    primaryAction: actions.primary,
    secondaryAction: actions.secondary,
    messageId: result.messageId,
  }
}
