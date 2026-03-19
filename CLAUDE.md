# CLAUDE.md — Roux Phase 2
*Last updated: March 13, 2026*

---

## What Is Roux

Roux is a premium family recipe library that also plans meals, built for Lauren Hill (mrslaurenhill@gmail.com) — a family of 7 in Hendersonville, TN. Lauren is the primary user, permanently on the Premium tier. Aric Hill built it and uses it as a Member Admin. The app stores the family recipe library, plans the weekly meal schedule, generates the shopping list, and surfaces intelligence through Sage — an AI assistant modeled on Joanna Gaines in the kitchen. It is not a tutorial app, not a social network, not a calorie counter.

---

## Tech Stack & Project

| | |
|---|---|
| **Frontend** | React + Vite + Tailwind CSS |
| **Backend** | Supabase (auth + database + storage) |
| **AI** | Anthropic Claude API — `claude-sonnet-4-20250514` (never change this) |
| **Hosting** | Vercel |
| **Project root** | `~/src/meal-planner/roux-phase2` |
| **Dev server** | `localhost:3000` — run `npm run dev` from project root |
| **Node** | `~/.nvm/versions/node/v22.22.1/bin/` — prefix bash commands with `export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH" &&` |
| **Credentials** | `.env` file only — never hardcode Supabase URL, anon key, or Anthropic key |

**Supabase project:** `https://goivrbphdqleqgjfqbtb.supabase.co`
**Lauren's IDs:** household `53f6a197-544a-48e6-9a46-23d7252399c2` / user `18c38c61-fb49-4c29-a4c2-e8907a554dac`

**Key files:**
- `supabase-schema.sql` — 30-table schema (authoritative)
- `seed_recipes.sql` — 13 Hill family recipes
- `src/App.jsx` — auth state machine
- `src/lib/auth.js` — `loadAppUser(authUserId)`
- `src/pages/Recipes.jsx` — Phase 1 recipe library (built)
- `src/components/AppShell.jsx` — BrowserRouter + drawer + routes
- `src/components/BottomNav.jsx` — shared 5-tab nav (Home / This Week / Recipes / Sage / Shopping)
- `src/lib/colorSchemes.js` — color scheme tokens (garden/slate/walnut/midnight)
- `src/hooks/useColorScheme.js` — reads household scheme, applies CSS vars
- `/prototypes/` — approved HTML prototypes (visual source of truth)
- `/docs/` — full design system, screen specs, copy rules, build flags

---

## Current Build Status

**Built:**
- Supabase schema deployed (30+ tables, RLS, grants, triggers)
- Auth flow working (signup → trigger → household + user record)
- AppShell with top bar, 5-tab bottom nav, routes
- Recipe library Phase 2 (2-col grid, search, filter, category pills)
- Recipe card Phase 2 (tabs, serves adjuster, Sage strip, Family Notes, pinned CTA)
- Shopping list (3-state flow — Building/Shopping/Complete, manual items)
- Meals hub (two-zone layout — action tiles + archive counters with tagline strip)
- Plan a Meal (recipe picker, alternatives, quick add, autofill, edit mode)
- Saved Meals (list with search, tap to edit, Add to plan via AddToPlanSheet)
- This Week / Week view (collapsible day cards, four slots, multi-item, autofill quick items, week nav with boundary, fixed header, protein roster)
- Week Settings — two-screen architecture: This Week Settings + Household Defaults
- AddToPlanSheet (reusable week/day/slot picker with calendar for future weeks)
- Design sprint complete — all 10 screen prototypes approved

**Partially built:**
- Dashboard (Home) — Tonight card, greeting, week strip, shortcuts exist. Missing: spending snapshot, Sage nudge, "By Ingredient" destination.
- Shopping list — manual add works. Auto-generation from week plan not built.

**Not yet built (in priority order):**
1. Welcome / onboarding flow (5 screens — prototypes approved)
2. Recipe import with Sage (chat-style input)
3. Traditions screen (`/meals/traditions`) — schema live, routes to placeholder
4. Sage screen (`/sage`) — placeholder only
5. Settings screen (My Account + Our Kitchen sections)
6. Family members management UI
7. Tier enforcement layer (`useSubscription()` hook)
8. Responsive design — tablet and desktop

Full checklist with flags → `docs/BUILD-FLAGS.md`

---

## Top 9 Rules — Never Forget

1. **Prototypes are law.** `/prototypes/` files are the visual source of truth. Match them exactly. Do not improvise design.

2. **"Home" not "household" in all user-facing copy.** The database table stays `households`. Every UI string says "home." Full audit required before launch.

3. **Fraunces and DM Sans are retired.** The confirmed type system is: Playfair Display (headings) + Jost (body/UI) + Caveat (handwritten accent only).

4. **Sage never replaces forms.** Forms collect structured data. Sage handles unstructured content (recipe import, natural language). Never use a chat interface for structured data collection.

5. **Lauren makes deliberate decisions. The system handles state automatically.** She publishes plans. She finalizes shopping lists. Everything else advances on its own.

6. **Sage is a helper, not a planner.** Lauren plans meals. Sage observes, nudges, and suggests when asked. Sage never acts unilaterally or removes options without Lauren's input.

7. **Never use swipe gestures as the only way to access an action.** All destructive actions (delete, remove) must be accessible via a visible UI element — inline edit/trash icons or a three-dot menu. Swipe gestures may be added as a shortcut enhancement on top of visible controls but never as the sole mechanism.

8. **Bottom nav always has 5 tabs in this exact order: Today / Week / Meals / Sage / Shop.** Routes: `/` `/thisweek` `/meals` `/sage` `/shopping`. Meals is a hub screen — not a direct link to RecipeLibrary. Never add, remove, or reorder tabs without explicit instruction.

9. **Color scheme tokens come from `src/lib/colorSchemes.js` and `useColorScheme()` hook.** Never hardcode `--forest`, `--sage`, or other color values directly in new components — always use CSS variables so scheme switching works automatically.

---

## Documentation Index

| File | Read When |
|---|---|
| `docs/DESIGN-SYSTEM.md` | Building any UI — colors, typography, topbar, nav, buttons, animations, watermarks, haptics |
| `docs/SCREEN-SPECS.md` | Building any screen — full specs, states, interactions, and the prototype file registry |
| `docs/COPY-RULES.md` | Writing any user-facing string — Sage voice, button copy, tone, home vs household |
| `docs/BUILD-FLAGS.md` | Starting any build task — what's done, what's next, what must be fixed before launch |
| `docs/PRODUCT-TIERS.md` | Making tier decisions — Free, Plus, Premium feature breakdown and enforcement notes |
| `docs/USER-EDUCATION.md` | Pre-launch review — empty states, first-use tooltips, Sage education nudges per screen |

---

## Database Quick Reference

After any schema wipe, run:
```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
```

Two-layer permissions: GRANT (table-level) + RLS policy (row-level) — both required.
`get_my_household_id()` and `get_my_user_id()` are SECURITY DEFINER functions — prevent RLS recursion.
PostgREST FK disambiguation: `ingredients!recipe_id(...)` when table has multiple FKs to same parent.

Full 30-table schema lives in `supabase-schema.sql`. Do not add tables without documenting them in that file first.
