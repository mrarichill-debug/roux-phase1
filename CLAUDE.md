# CLAUDE.md — Roux Phase 2
*Last updated: April 5, 2026*

## What Is Roux

Roux is a family meal planner + recipe library for the Hill family (7 members, Hendersonville, TN). Lauren Hill is the primary user (Full Plan). Aric Hill built it (Member Admin). Sage is the AI kitchen companion. Not a tutorial app, not a social network, not a calorie counter.

## Tech Stack

| | |
|---|---|
| **Frontend** | React + Vite + Tailwind CSS |
| **Backend** | Supabase (auth + database + storage) |
| **AI** | Anthropic Claude API — all calls via `/api/` serverless functions. Model configured in `app_config.sage_model`. |
| **Hosting** | Vercel — deploy only when Aric explicitly requests. Dev/test on `localhost:5173`. |
| **Node** | Prefix bash commands with `export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH" &&` |
| **Credentials** | `.env` file only — never hardcode keys. API key is server-side only (`ANTHROPIC_API_KEY`). |

**Supabase:** `https://goivrbphdqleqgjfqbtb.supabase.co`
**Lauren's IDs:** household `53f6a197-544a-48e6-9a46-23d7252399c2` / user `18c38c61-fb49-4c29-a4c2-e8907a554dac`

---

## Before You Start Any Task

**1. Read these files first:**
- `docs/BUILD-FLAGS.md` — what's done, what's next, current build status
- `docs/ERROR_LOG.md` — known errors and how they were fixed. Do not repeat them.
- `docs/LESSONS.md` — principles learned from the build. Apply them proactively.

**2. Check the relevant skill file if one exists:**
- Building UI? Read `skills/SKILL-component.md`
- Writing RLS or schema? Read `skills/SKILL-supabase-rls.md`
- Writing Sage prompts or voice? Read `skills/SKILL-sage-prompt.md`

**3. Run the Round Table checklist before implementing:**
- 🏛️ Architect: *Does this make sense as a system that will scale?*
- 🎨 Designer: *Does this look and feel like Roux?*
- 👤 UX Advocate: *Would a tired parent at 6pm find this easy and helpful?*
- 🔨 Builder: *What's the right sequence to build this safely?*
- 💰 Product Strategist: *Is this the most valuable thing to build right now?*
- 👩‍🍳 Maya: *Would I actually use this on a Thursday night when I'm exhausted?*

If any answer is clearly "no" — stop and flag it before proceeding.

---

## Top 10 Rules

1. **Prototypes are law.** `/prototypes/` are the visual source of truth. Match exactly.
2. **"Home" not "household"** in all user-facing copy. DB table stays `households`.
3. **Playfair Display + Jost + Caveat only.** Fraunces and DM Sans are retired.
4. **Sage never replaces forms.** Forms = structured data. Sage = unstructured content.
5. **Lauren decides. The system advances automatically.** She publishes plans and finalizes lists.
6. **Sage is a helper, not a planner.** Observes, nudges, suggests — never acts unilaterally.
7. **No swipe-only actions.** Destructive actions must have visible UI (icons, menus). Swipe = shortcut only.
8. **4 tabs: Home / Week / Meals / Pantry.** Routes: `/` `/thisweek` `/meals` `/pantry`. Sage accessible via ✦ sparkle icon in topbar. Never reorder tabs.
9. **Subscription tiers are `'free'` and `'full'` only.** No other tier names anywhere in the codebase. Hill House = `'full'`.
10. **Sage has no free-form chat.** All interactions are app-triggered. Users respond with taps only. App always constructs the API prompt.

---

## Writer/Reviewer Rule

After any significant code change (component rewrites, new utilities, multi-file edits), run a review pass before presenting results:

1. **Small changes** (single function, bug fix): Run `/simplify` against the changed files.
2. **Large changes** (new screen, rewrite, 3+ files): Spawn a separate review agent in a worktree that reads the diff cold — no context of why it was written. It evaluates: unused code, missed edge cases, CLAUDE.md rule violations, unnecessary coupling, Roux pattern compliance (design tokens, fonts, card styles, activity logging).
3. **Never skip the review.** If the build passes but the review wasn't run, the task isn't done.

The reviewer's job is to find what the writer missed. The writer's job is to fix what the reviewer found. Both happen before showing results to Aric.

---

## Deployment Rule

Only deploy to Vercel at the explicit close of a build session when Aric asks. All development and testing during a session runs on localhost (`npm run dev`). Never push mid-session unless Aric specifically requests it.

---

## Activity Log

Active. All meaningful user actions write to `activity_log` via `src/lib/activityLog.js`. Every new feature must wire in a `logActivity()` call — fire-and-forget, after primary action succeeds, never blocking UI.

---

## Session Notes (Apr 5, 2026)

**Home screen rebuilt** — intelligence-first layout. Hero is now an Intelligence Card (arc-stage-aware message + "What can Roux do for you?" + action buttons). Tonight card slimmed down (kept wood grain). Week strip in a white card. Removed: SpendingSnapshot, QuickAccess tiles, SageNudgeCard stack, SageIntelligenceCard herb visual.

**New utilities:** `src/lib/getIntelligenceMessage.js` (derives intelligence card from dashboard data), `src/lib/getArcStage.js` (stage 1–7), `src/lib/jokes.js` (20 dry-wit jokes, 10-day cooldown, cycle tracking in `users.preferences`).

**BottomSheet scroll lock fixed** — three-layer approach: body `position: fixed` + `<html>` `overflow: hidden` + `.page-scroll-container` class on page wrappers. Document-level `touchmove` listener intercepts all touches, only allows scroll inside `[data-sheet-scroll]`.

**Writer/Reviewer workflow** added to CLAUDE.md. After significant changes, run `/simplify` or spawn a review agent. Review caught: useMemo side effect, stale closure in `sageBusyNightDetection`, WeekStrip day-mapping bug, dead state vars + wasted Supabase queries.

**Effort level** set to `high` in `.claude/settings.json`.

---

## Documentation Index

| File | Read When |
|---|---|
| `docs/DESIGN-SYSTEM.md` | Building any UI — colors, typography, nav, buttons, animations |
| `docs/SCREEN-SPECS.md` | Building any screen — full specs, states, interactions |
| `docs/COPY-RULES.md` | Writing any user-facing string — Sage voice, tone, copy |
| `docs/BUILD-FLAGS.md` | Starting any task — what's done, what's next, current build status |
| `docs/PRODUCT-TIERS.md` | Tier decisions — Free / Full Plan breakdown |
| `docs/USER-EDUCATION.md` | Pre-launch — empty states, tooltips, Sage nudges |
| `docs/ERROR_LOG.md` | Before any task — known bugs, root causes, fixes |
| `docs/LESSONS.md` | Before any task — principles and patterns learned from the build |
| `docs/INTELLIGENCE-ARC.md` | Building intelligence features — 7-stage arc, mental loads, stage triggers |
| `docs/MESSAGE-POOL.md` | Writing intelligence messages — 110 messages, selection logic, OTO rules |

## Skills Index

| File | Use When |
|---|---|
| `skills/SKILL-component.md` | Building any React component — structure, naming, Roux patterns |
| `skills/SKILL-supabase-rls.md` | Writing RLS policies, schema changes, or Supabase queries |
| `skills/SKILL-sage-prompt.md` | Writing Sage API prompts or Sage-facing copy |
| `skills/SKILL-debug.md` | Hitting an error — standard debug sequence for this stack |

---

## Database Quick Reference

Two-layer permissions: GRANT (table-level) + RLS policy (row-level) — both required.
`get_my_household_id()` and `get_my_user_id()` are SECURITY DEFINER functions — prevent RLS recursion.
PostgREST FK disambiguation: `ingredients!recipe_id(...)` when table has multiple FKs to same parent.
Schema lives in `supabase-schema.sql`. After any schema wipe, run:
```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
```