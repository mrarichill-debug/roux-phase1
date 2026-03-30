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

## Market Design Audit — March 2026

### Current State at Time of Audit
Single household in production (Hill family). Primary test user is Lauren. Core loop built: plan meals → build shopping list → shop by store → scan receipt → Sage learns. No outside users yet. Today's testing revealed: confusion about meals vs recipes mental model, friction in add-meal-then-link flow, ghost meal notices missed at bottom of screen, scroll clunkiness on mobile, Traditions dead end, and strong positive signal on shopping list organization and batch size feature.

---

### Lens 1: Desire vs Feature Gap (Freud)

| # | Finding | Severity | Status | Target |
|---|---|---|---|---|
| D1 | Meals vs recipes confusion is a mental model problem, not a feature problem — desire is confidence the shopping list will be right | Critical | In progress (tooltips built) | Pre-launch |
| D2 | Traditions dead end signals unmet desire for family identity — users want the app to know their family | Moderate | Partial (placeholder fixed) | Next session |
| D3 | Batch size is really about waste reduction — Sage framing hasn't caught up to the real desire | Low | Open | Future |

### Lens 2: Belonging Signal Audit (Tocqueville)

| # | Finding | Severity | Status | Target |
|---|---|---|---|---|
| B1 | Zero belonging signals anywhere in the app — blank week view feels like setting up a spreadsheet | Critical | Open | Pre-launch |
| B2 | Sage intelligence herb is the right instinct but new users see a seed with no visible path forward | Moderate | Open | Next session |
| B3 | Lauren is the only social proof — new households will see a blank slate with no sense anyone has gone before | Moderate | Open | Pre-launch |

### Lens 3: Value Visibility Review (Adam Smith)

| # | Finding | Severity | Status | Target |
|---|---|---|---|---|
| V1 | Receipt scanning value invisible until after 5th scan — payoff requires imagination not observation | Critical | Partial (tooltip built) | Pre-launch |
| V2 | Shopping list feels like extra work until first trip is complete — value only visible in use | Moderate | Open | Pre-launch |
| V3 | Week planner value vs paper calendar not obvious on day one — connection to shopping list not shown | Moderate | Open | Pre-launch |

### Lens 4: Real Competitive Landscape (Machiavelli)

| # | Finding | Severity | Status | Target |
|---|---|---|---|---|
| M1 | Real competitor is the group text and mental shortlist — not Paprika or Mealime | Critical | Open | Pre-launch |
| M2 | Roux's differentiation (meal plan → shopping → budget → Sage) is invisible at first contact | Critical | Open | Pre-launch |
| M3 | Switch cost is front-loaded, payoff is back-loaded — 6-8 steps before Sage has anything to say | Moderate | Open | Pre-launch |

---

## Audits To Run

- [ ] Debugging Audit — run after first significant production bug
- [ ] Automation Audit — run after 4 weeks of live receipt scanning
- [ ] Code Review Audit — run before first major refactor
- [x] Architecture Audit — completed March 2026
- [x] Market Design Audit — completed March 2026

---

## Pre-Launch Critical Findings Checklist

These findings are Critical severity and must be addressed before opening Roux to non-Hill users:

**Architecture:**
- [ ] F1 — Resolve single-household RLS assumption for multi-user launch
- [ ] F2 — Establish basic test coverage for core flows
- [ ] F3 — Migrate Google OAuth to dedicated account (dev@myroux.app)
- [ ] F4 — Add Sage API cost ceiling / circuit breaker

**Market Design:**
- [ ] D1 — Mental model: meals vs recipes must land in first session
- [ ] B1 — Add belonging signals to first-use experience
- [ ] V1 — Pull receipt scanning payoff forward — make value tangible immediately
- [ ] M1 — Differentiation visible at first contact
- [ ] M2 — Reduce front-loaded switch cost or pull early payoffs forward

---

## Revision History

| Date | Audit Type | Notes |
|---|---|---|
| March 2026 | Architecture | First formal audit. 4 critical/moderate findings pre-launch, 6 scale findings deferred. |
| March 2026 | Market Design | First market design audit. 5 critical findings pre-launch, 3 moderate. Real competitor identified as group text, not apps. |
