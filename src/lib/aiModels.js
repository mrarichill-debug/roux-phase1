/**
 * aiModels.js — Tiered model strategy for all Anthropic API calls.
 * Never hardcode model strings — always import from here so model
 * upgrades can be made in one place.
 */

// Full intelligence — conversational Sage, complex reasoning, user-facing quality
export const SAGE_CHAT = 'claude-sonnet-4-20250514'
export const SAGE_WEEK_PLANNING = 'claude-sonnet-4-20250514'
export const RECIPE_URL_EXTRACTION = 'claude-sonnet-4-20250514'

// Fast and efficient — structured tasks, background operations, high-frequency
export const SAGE_INGREDIENT_REVIEW = 'claude-haiku-4-5-20251001'
export const SAGE_SKIP_DETECTION = 'claude-haiku-4-5-20251001'
export const SAGE_REACTIVE_SUGGESTIONS = 'claude-haiku-4-5-20251001'
export const SHOPPING_LIST_GENERATION = 'claude-haiku-4-5-20251001'
