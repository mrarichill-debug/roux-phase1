# Handoff — Meals as First-Class Records

*For a fresh Claude Code session. Self-contained.*

## ⚠ Headline finding (read first)

The schema you need **may already exist**. `supabase-schema.sql` defines:

- **`meals`** (Table 11, [line 370](supabase-schema.sql:370)) — `{ id, household_id, name, description, created_by, is_saved, photo_url, ... }`
- **`meal_recipes`** (Table 12, [line 388](supabase-schema.sql:388)) — `{ id, meal_id, recipe_id, role, is_swappable, sort_order }`
- **`planned_meals.meal_id UUID REFERENCES meals(id) ON DELETE SET NULL`** ([line 544](supabase-schema.sql:544))

But — **schema drift is real**. The active code (`Meals.jsx`, `ThisWeek.jsx`) reads/writes columns on `planned_meals` that **aren't in `supabase-schema.sql`**: `custom_name`, `planned_date`, `entry_type`, `removed_at`, `cooked_at`, `eating_out_cost`, `sage_match_status`, etc. These exist in the live DB but never made it back into the schema file. **Verify the live `planned_meals` schema via the Supabase MCP before designing the migration.** The schema file is stale by design — we've been applying migrations directly via MCP and the local `supabase/migrations/` history is ~80 entries behind remote.

If `meals` / `meal_recipes` / `planned_meals.meal_id` are all live: this is mostly **backfill + code**, not schema. If any are missing in production: small migration first.

---

## 1. Goal

Promote "meal" from an aggregated string (`planned_meals.custom_name` deduped lowercase across rows) to a first-class record (`meals.id`). User-visible payoff: rename a meal once and every plan referencing it picks up the new name. Unlocks photos, "made N×" microcopy, traditions, archive — affordances that the current schema can't support coherently because there's no canonical row to attach them to.

## 2. Decision

Aric picked **Option D** (full refactor). Skip the quick day-card name-edit field; the same affordance falls out of the refactor by writing `meals.name` from the existing Edit sheet at [ThisWeek.jsx:1716](src/pages/ThisWeek.jsx:1716).

## 3. Schema (verify, then extend if needed)

`meals` and `meal_recipes` are documented in `supabase-schema.sql` and likely live. **Run via Supabase MCP first:**

```sql
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('meals','meal_recipes','planned_meals')
 ORDER BY table_name, ordinal_position;
```

If `meals` lacks `is_archived BOOLEAN DEFAULT FALSE`, add it (the design direction implies archive, not delete). If `planned_meals.meal_id` is missing, add it nullable with `REFERENCES meals(id) ON DELETE SET NULL`. Add a partial unique index for dedupe:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_meals_household_name_lower
  ON meals(household_id, lower(name));
```

## 4. Migration order — non-destructive, dual-read window

1. **Schema sanity** (MCP) — confirm `meals`, `meal_recipes`, `planned_meals.meal_id` exist; add any missing columns; add the unique index above.
2. **Backfill `meals` from `planned_meals`.** One row per `(household_id, lower(trim(custom_name)))` pair where `custom_name IS NOT NULL` AND `entry_type != 'eating_out'`. **Do NOT double-create:** join against existing `meals` rows from `SavedMeals.jsx` first. Take the canonical name from the most recent `planned_meals.custom_name` (preserve case/whitespace), `created_by` from the original `added_by` if available, else any household admin.
3. **Backfill `planned_meals.meal_id`.** `UPDATE planned_meals SET meal_id = m.id FROM meals m WHERE m.household_id = planned_meals.household_id AND lower(trim(m.name)) = lower(trim(planned_meals.custom_name)) AND planned_meals.meal_id IS NULL`. Verify a non-zero count.
4. **Dual-read pass.** Update consumers to prefer the `meal_id` join, fall back to `custom_name` for any unbackfilled row. Surface the canonical name from `meals.name`. App still writes `custom_name` — safe to ship.
5. **Dual-write pass.** On every `planned_meals` insert path, find-or-create a `meals` row, write both `meal_id` and `custom_name`. After a soak window, drop `custom_name` writes and (eventually) the column.

## 5. Files affected

| File | Why | Specific spots |
|---|---|---|
| [src/pages/Meals.jsx](src/pages/Meals.jsx) | The derived-aggregate view that needs to read from `meals` | [`load()` lines 62-91](src/pages/Meals.jsx:62) — replace `planned_meals` aggregation with `SELECT * FROM meals WHERE household_id = ?` plus a `weekCount` / `lastDate` aggregation joined back through `planned_meals.meal_id` |
| [src/pages/ThisWeek.jsx](src/pages/ThisWeek.jsx) | Day card + Edit sheet | `getMealName(m)` at [line 977](src/pages/ThisWeek.jsx:977) — extend to prefer `m.meals?.name`. Edit sheet name field at [line 1716](src/pages/ThisWeek.jsx:1716) — becomes editable, writes to `meals.name` for `editMeal.meal_id`. The data load (around [line 203](src/pages/ThisWeek.jsx:203)) needs to embed `meals!meal_id(*)` |
| [src/pages/SavedMeals.jsx](src/pages/SavedMeals.jsx) | Already uses `meals` table | Verify expected columns before extending; don't break its reads |
| [src/pages/SaveRecipe.jsx](src/pages/SaveRecipe.jsx) | Creates `planned_meals` rows on save when `returnTo === 'week'` | Look for `planned_meal_recipes` upsert around line ~607 — add a `meals` find-or-create + write `meal_id` |
| [src/components/AddMealFlow.jsx](src/components/AddMealFlow.jsx) | Primary creator of `planned_meals` rows | All `from('planned_meals').insert(...)` sites need find-or-create-meal-first |
| [src/lib/sageMealMatch.js](src/lib/sageMealMatch.js) | Matches free-text meal names against history | May want to query `meals` directly instead of deduping `planned_meals` |
| [supabase-schema.sql](supabase-schema.sql) | Document the post-migration state | Update once you've verified live |

Run `grep -rln "custom_name\|planned_meals" src/` for the full blast radius before starting.

## 6. Edge cases

- **Eating-out meals** (`entry_type === 'eating_out'`): they need a `meals` row OR an explicit "no meal" path. Recommend: skip backfill for these, leave `meal_id` NULL, keep using `custom_name` (restaurant name). Mark in `meals.description` if you do create rows.
- **Leftovers** (`source_meal_name` is set): point `meal_id` at the source meal's row, don't create a duplicate.
- **Two households same name**: dedupe key is `(household_id, lower(trim(name)))` — never global.
- **Same household, similar names** ("Chicken Kabobs" vs "Beef Kabobs"): exact-name match for canonical; case-insensitive only for the dedupe lookup. Don't fuzzy-match.
- **Existing `SavedMeals.jsx` rows in `meals`**: backfill must `INSERT ... ON CONFLICT (household_id, lower(name)) DO NOTHING` — never double-create.
- **Renaming**: write `meals.name`, bump `meals.updated_at`, log `meal_renamed` activity (use `logActivity` in [src/lib/activityLog.js](src/lib/activityLog.js)).

## 7. Operational gotchas

- **Migration history mismatch.** Local `supabase/migrations/` is ~80 commits behind `supabase_migrations` history table on the remote. `supabase db push` will refuse. Apply via Supabase MCP `apply_migration` / `execute_sql` directly — match the pattern used for `recipe-photos` bucket creation. Keep a `supabase/migrations/<ts>_meals_first_class.sql` file in the repo for documentation; it won't appear in remote history.
- **`.env` parser blocks supabase CLI.** Aric's `.env` has multi-line prose that breaks the CLI parser — if you need the CLI for any reason, temp-rename `.env` aside (we did this before, restore on exit).
- **Deploy rule (CLAUDE.md):** "Vercel — deploy only when Aric explicitly requests." Vercel auto-deploys from push-to-main on Pro plan, so any push ships. Coordinate commit cadence with Aric per PR.
- **Don't break SavedMeals.jsx** — verify before extending `meals` columns.
- **Don't break the speed-dial / day-card edits in [ThisWeek.jsx](src/pages/ThisWeek.jsx)** — recent (`765d89a`) work added per-day "+" speed-dial expanding to Meal/Note pills, anchored bottom-right of each day card. The data shape it depends on must survive.
- **Photo bug fix recently shipped** (`4e4e107`) — household-scoped storage paths, helper at [src/lib/uploadRecipePhoto.js](src/lib/uploadRecipePhoto.js). If `meals` gets photo support, reuse this helper; don't re-roll.

## 8. Suggested PR cadence

1. **Schema + backfill** (no app changes). Verifiable in dashboard. Apply via MCP.
2. **Dual-read** — code reads `meal_id` join, falls back to `custom_name`. App still writes `custom_name`. Safe.
3. **Dual-write** — find-or-create `meals` on insert; write both `meal_id` and `custom_name`. Safe.
4. **Cutover** — drop `custom_name` writes; ship rename affordance on Meals view (Surface 2 from the original ask).
5. **Day-card edit field** (Surface 1) — trivial once #4 lands; edit sheet writes `meals.name`.

Each PR is independently shippable. PRs 2–5 each unlock one user-visible behavior.

## 9. Repo state at handoff

- **Branch:** `main` · HEAD: `765d89a` (`feat(this-week): day-card + button moves to bottom-right and expands into Meal / Note speed-dial`).
- **Origin:** in sync, no unpushed commits.
- **Uncommitted in main worktree:** `docs/CLAUDE-DESIGN-BRIEF.md`, `claude-design/` (untracked design-export folder), this handoff doc. None blocking.
- **Vercel:** Pro plan; auto-deploys main on push. 12-function limit lifted.
- **Other worktrees:** `claude/youthful-buck-a1a245` and `claude/friendly-babbage` exist (visible via `git worktree list`) but are stale; no unmerged work.

## 10. Open questions for Aric (deferrable)

- **Rename history.** When a user renames a meal, do we keep "previously known as X" for activity-log readability? Recommend: yes, store `meals.previous_names TEXT[]`, append on rename. Cheap. Defer if not asked for.
- **Recipe-rename → meal-name auto-update.** If a recipe gets renamed and a meal was using the recipe's name as its meal name, does the meal name follow? Recommend: no by default — once promoted to a `meals` row, the name is owned by the meal. Edge case.
- **Archive vs delete.** Brief implies archive, not hard-delete. Add `meals.is_archived BOOLEAN DEFAULT FALSE`; UI hides archived from main views, surfaces them in a "Past meals" filter. Confirm before building the UI.
