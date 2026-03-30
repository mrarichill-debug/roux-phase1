# Roux App — Architecture & Product Audit Log

This file records formal audit findings from The Thinker's Audit framework.
Each audit should be revisited before major milestones — especially pre-launch.
Run date and status tracked per finding.

---

## Architecture Audit — March 2026

### Current State at Time of Audit
React/Vite frontend on Vercel. Supabase (PostgreSQL + RLS + Auth + Storage). Anthropic Claude API (Haiku for receipts, Sonnet for Sage). Vercel serverless functions for all AI calls. Single household in production (Hill family). No test suite. No subscription enforcement. Google OAuth on personal account.

---

### Lens 1: Failure Archaeology (Thucydides)

| # | Finding | Severity | Status | Target |
|---|---|---|---|---|
| F1 | Single-household RLS assumption baked in everywhere — multi-user launch will surface silent data failures | Critical | Open | Pre-launch |
| F2 | No test suite — every deploy is a manual trust exercise via Lauren's phone | Critical | Open | Pre-launch |
| F3 | Google OAuth registered under personal account (mrarichill@gmail.com) — single human as system dependency | Moderate | Open | Pre-launch |
| F4 | Sage API costs have no hard ceiling — no circuit breaker, only logging | Moderate | Open | Pre-launch |

### Lens 2: Complexity Inventory (Aristotle)

| # | Finding | Severity | Status | Target |
|---|---|---|---|---|
| C1 | Three overlapping "already have" concepts: `already_have` (deprecated), `have_it_this_week`, `pantry_staples` | Moderate | Open | Next cleanup |
| C2 | `planned_meals.recipe_id` and `planned_meal_recipes` both exist — dual source of truth for recipe linking | Moderate | Open | Next cleanup |
| C3 | `sage_background_activity` handles too many unrelated job types under one table | Low | Open | Before scale |
| C4 | `categorizeIngredient.js` referenced but not built — placeholder creating silent "OTHER" category failures | Low | Open | Next session |

### Lens 3: Scale Assumption Scan (Tocqueville)

| # | Finding | Severity | Status | Target |
|---|---|---|---|---|
| S1 | Shopping list injection is synchronous and unbatched — breaks around 50+ recipes per week | Moderate | Open | Before scale |
| S2 | `sage_background_activity` has no cleanup/archival mechanism — degrades over time at volume | Low | Open | Before scale |
| S3 | Receipt scanning is fully synchronous with no queue — fails under concurrent load (~20 users) | Low | Open | Before scale |
| S4 | All Supabase queries run client-side with no caching — connection pool risk at ~100 concurrent users | Low | Open | Before scale |

---

## Audits To Run

- [ ] Debugging Audit — run after first significant production bug
- [ ] Automation Audit — run after 4 weeks of live receipt scanning
- [ ] Code Review Audit — run before first major refactor
- [ ] Market Design Audit — run after first non-Hill users onboard

---

## Revision History

| Date | Audit Type | Notes |
|---|---|---|
| March 2026 | Architecture | First formal audit. 4 critical/moderate findings pre-launch, 6 scale findings deferred. |
