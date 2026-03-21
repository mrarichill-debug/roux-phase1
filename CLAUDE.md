# CLAUDE.md — Roux Phase 2
*Last updated: March 20, 2026*

## What Is Roux

Roux is a premium family recipe library + meal planner for the Hill family (7 members, Hendersonville, TN). Lauren Hill is the primary user (Premium). Aric Hill built it (Member Admin). Sage is the AI assistant — modeled on Joanna Gaines in the kitchen. Not a tutorial app, not a social network, not a calorie counter.

## Tech Stack

| | |
|---|---|
| **Frontend** | React + Vite + Tailwind CSS |
| **Backend** | Supabase (auth + database + storage) |
| **AI** | Anthropic Claude API — all calls via `/api/` serverless functions. Model configured in `app_config.sage_model`. |
| **Hosting** | Vercel — deploy only when Aric explicitly requests. Dev/test on `localhost:3000`. |
| **Node** | Prefix bash commands with `export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH" &&` |
| **Credentials** | `.env` file only — never hardcode keys. API key is server-side only (`ANTHROPIC_API_KEY`). |

**Supabase:** `https://goivrbphdqleqgjfqbtb.supabase.co`
**Lauren's IDs:** household `53f6a197-544a-48e6-9a46-23d7252399c2` / user `18c38c61-fb49-4c29-a4c2-e8907a554dac`

## Top 9 Rules

1. **Prototypes are law.** `/prototypes/` are the visual source of truth. Match exactly.
2. **"Home" not "household"** in all user-facing copy. DB table stays `households`.
3. **Playfair Display + Jost + Caveat only.** Fraunces and DM Sans are retired.
4. **Sage never replaces forms.** Forms = structured data. Sage = unstructured content.
5. **Lauren decides. The system advances automatically.** She publishes plans and finalizes lists.
6. **Sage is a helper, not a planner.** Observes, nudges, suggests — never acts unilaterally.
7. **No swipe-only actions.** Destructive actions must have visible UI (icons, menus). Swipe = shortcut only.
8. **5 tabs: Today / Week / Meals / Sage / Shop.** Routes: `/` `/thisweek` `/meals` `/sage` `/shopping`. Never reorder.
9. **Color tokens from `colorSchemes.js` + `useColorScheme()` hook.** Never hardcode color values.

## Deployment Rule

Only deploy to Vercel at the explicit close of a build session when Aric asks. All development and testing during a session runs on localhost (`npm run dev`). Never push to trigger a Vercel deployment mid-session unless Aric specifically requests it.

## Next Session Priorities

1. Test recipe tags end-to-end — tag selector on EditRecipe/SaveRecipe, filter on RecipeLibrary
2. Test meal detail screen and meal tags on PlanMeal
3. Test ingredient alternatives UI on EditRecipe and RecipeCard
4. Traditions screen (`/meals/traditions`) — schema fully ready, UI is placeholder
5. Activity log writes — zero activity being logged, blocks Sage intelligence
6. Onboarding flow — 5 screens approved, none built, blocks new users

## Documentation Index

| File | Read When |
|---|---|
| `docs/DESIGN-SYSTEM.md` | Building any UI — colors, typography, nav, buttons, animations |
| `docs/SCREEN-SPECS.md` | Building any screen — full specs, states, interactions |
| `docs/COPY-RULES.md` | Writing any user-facing string — Sage voice, tone, copy |
| `docs/BUILD-FLAGS.md` | Starting any task — what's done, what's next, current build status |
| `docs/PRODUCT-TIERS.md` | Tier decisions — Free / Plus / Premium breakdown |
| `docs/USER-EDUCATION.md` | Pre-launch — empty states, tooltips, Sage nudges |

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
