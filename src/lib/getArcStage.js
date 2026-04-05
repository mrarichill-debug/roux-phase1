/**
 * getArcStage.js — Determines the user's intelligence arc stage (1–7).
 *
 * Stages:
 *   1 — Getting started (< 7 meals in history)
 *   2 — First receipt scanned
 *   3 — Skip patterns detected (2+ weeks closed, soft-deleted meals exist)
 *   4 — Taste profile emerging (20+ meals, 3+ reviews)
 *   5 — Established habits (30+ meals, 5+ receipts, 5+ reviews)
 *   6 — Full intelligence (50+ meals, 8+ weeks closed)
 *   7 — Sage autonomous (100+ meals, 12+ weeks closed, 10+ receipts)
 */
export function getArcStage({ mealsCount, weeksClosedOut, receiptsScanned, skipsDetected }) {
  if (mealsCount >= 100 && weeksClosedOut >= 12 && receiptsScanned >= 10) return 7
  if (mealsCount >= 50 && weeksClosedOut >= 8) return 6
  if (mealsCount >= 30 && receiptsScanned >= 5 && weeksClosedOut >= 5) return 5
  if (mealsCount >= 20 && weeksClosedOut >= 3) return 4
  if (weeksClosedOut >= 2 && skipsDetected > 0) return 3
  if (receiptsScanned >= 1) return 2
  return 1
}
