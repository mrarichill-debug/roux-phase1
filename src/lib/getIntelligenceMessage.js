/**
 * getIntelligenceMessage.js — Derives the Home screen intelligence card content
 * from data already fetched by Dashboard.loadDashboardData().
 *
 * Returns { message, arcAnswer, primaryAction, secondaryAction }
 * where each action is { label, route } or null.
 *
 * Data gaps (noted, not queried):
 *   - Skip details (meal name, weeks since): stage 3 won't trigger until tracked
 *   - Taste profile/cuisine: stage 4+ uses generic "go-to favorites"
 *   - Eating out estimate: stage 2 shows grocery cost only
 */
import { getArcStage } from './getArcStage'

export function getIntelligenceMessage({
  activePlan,
  weekMeals,
  shoppingList,
  sageIntelligence,
  sageMessages,
  calendarConnected,
  shopTile,
}) {
  const score = sageIntelligence?.score || { receipts: 0, reviews: 0, meals: 0, staples: 0 }
  const stage = getArcStage({
    mealsCount: score.meals,
    weeksClosedOut: score.reviews,
    receiptsScanned: score.receipts,
    skipsDetected: 0, // not tracked yet
  })

  const plannedCount = weekMeals?.length || 0
  const hasMeals = plannedCount > 0 || !!activePlan

  // ── Condition 1: No meals planned ────────────────────────────
  if (!hasMeals) {
    return {
      message: "Add your first meal and I'll build your shopping list instantly.",
      arcAnswer: "Let's find out.",
      primaryAction: { label: 'Plan a meal', route: '/thisweek' },
      secondaryAction: null,
    }
  }

  // ── Condition 2/3: Meals planned, Stage 1 ────────────────────
  if (stage === 1) {
    // Check for busy-night calendar context in existing sage messages
    const calMsg = sageMessages?.find(m => m.source === 'background' && m.dayOfWeek)
    const busyDay = calMsg?.dayOfWeek

    if (calendarConnected && busyDay) {
      return {
        message: `You've got ${busyDay} looking busy this week. I'd keep dinner simple that night.`,
        arcAnswer: 'Make sure you never forget an ingredient.',
        primaryAction: { label: 'View my list', route: '/pantry' },
        secondaryAction: { label: 'Add a meal', route: '/thisweek' },
      }
    }

    return {
      message: "Your shopping list is ready. Every ingredient for every meal — nothing forgotten.",
      arcAnswer: 'Make sure you never forget an ingredient.',
      primaryAction: { label: 'View my list', route: '/pantry' },
      secondaryAction: { label: 'Add a meal', route: '/thisweek' },
    }
  }

  // ── Condition 4: First receipt scanned, Stage 2 ──────────────
  if (stage === 2) {
    const spent = shopTile?.totalSpent || shoppingList?.actual_cost
    const amount = spent ? `$${Math.round(spent)}` : 'tracked'
    return {
      message: `Your groceries this week: ${amount}. I'm learning what things cost so I can show you the real picture.`,
      arcAnswer: 'Show you what you\'re actually saving.',
      primaryAction: { label: 'See the breakdown', route: '/pantry' },
      secondaryAction: null,
    }
  }

  // ── Condition 5: Stage 3 — skip pattern (approximated) ───────
  if (stage === 3) {
    return {
      message: "I've been watching what gets planned and what gets skipped — some patterns are forming.",
      arcAnswer: 'Remember what your family loves.',
      primaryAction: { label: 'View this week', route: '/thisweek' },
      secondaryAction: { label: 'Maybe later', route: null },
    }
  }

  // ── Condition 6: Stage 4 — taste profile ─────────────────────
  if (stage === 4) {
    return {
      message: "Your family tends to love your go-to favorites. Might be worth looking for something new in that direction.",
      arcAnswer: 'Know what your family actually likes to eat.',
      primaryAction: { label: "I'll keep an eye out", route: '/meals/recipes' },
      secondaryAction: null,
    }
  }

  // ── Condition 7: Stage 5 — established ───────────────────────
  if (stage === 5) {
    return {
      message: "I know your kitchen pretty well now. Your patterns, your staples, your family's favorites.",
      arcAnswer: 'Keep your kitchen running without the mental load.',
      primaryAction: { label: 'View my list', route: '/pantry' },
      secondaryAction: { label: 'Plan the week', route: '/thisweek' },
    }
  }

  // ── Condition 8: Stage 6+ — autonomous offer ─────────────────
  if (stage >= 6) {
    return {
      message: "I think I know your family well enough now — want me to plan next week? You can change anything.",
      arcAnswer: 'Plan your whole week before you have to ask.',
      primaryAction: { label: 'Yes, plan next week', route: '/thisweek' },
      secondaryAction: { label: "I'll do it myself", route: '/thisweek' },
    }
  }

  // ── Fallback: quiet moment (signals humor card) ──────────────
  return null
}
