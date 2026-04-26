-- PR 1 of the meals-as-records refactor (see docs/HANDOFF-MEALS-AS-RECORDS.md).
--
-- Applied directly to production via Supabase MCP on 2026-04-26.
-- This file lives in the repo as documentation of what shipped; it will NOT
-- appear in the remote `supabase_migrations` history table because the local
-- migrations directory is ~80 entries behind remote (pre-existing drift).
--
-- Idempotent: safe to re-run.
--
-- Result on apply:
--   meals_total:                24  (1 pre-existing + 23 backfilled)
--   planned_meals.meal_id set:  89  (all active non-eating-out named rows)
--   unbackfilled_active:        0   (verified)
--   unbackfilled removed:       22  (orphans from soft-deleted history; intentional)
--   eating_out left NULL:       8   (intentional — restaurant names, not meals)

-- ── Statement A — schema additions ───────────────────────────────────────────
ALTER TABLE meals ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meals_household_name_lower
  ON meals(household_id, lower(name));

-- ── Statement B — backfill `meals` from distinct planned_meals.custom_name ──
-- One row per (household_id, lower(trim(custom_name))) pair.
-- Excludes eating-out (their custom_name is a restaurant name, not a meal)
-- and soft-deleted rows (removed_at set).
-- created_by uses the household's admin (or oldest member as fallback).
-- is_saved=TRUE so backfilled meals appear in the Meals view alongside
-- explicitly-saved meals.
WITH src AS (
  SELECT DISTINCT ON (pm.household_id, lower(trim(pm.custom_name)))
         pm.household_id,
         trim(pm.custom_name) AS name,
         pm.created_at AS first_seen
    FROM planned_meals pm
   WHERE pm.custom_name IS NOT NULL
     AND length(trim(pm.custom_name)) > 0
     AND pm.removed_at IS NULL
     AND COALESCE(pm.entry_type, 'ghost') != 'eating_out'
   ORDER BY pm.household_id, lower(trim(pm.custom_name)), pm.created_at ASC
)
INSERT INTO meals (household_id, name, created_by, is_saved, created_at, updated_at)
SELECT s.household_id,
       s.name,
       COALESCE(
         (SELECT id FROM users u WHERE u.household_id = s.household_id
            AND u.role = 'admin' ORDER BY u.created_at ASC LIMIT 1),
         (SELECT id FROM users u WHERE u.household_id = s.household_id
            ORDER BY u.created_at ASC LIMIT 1)
       ) AS created_by,
       TRUE AS is_saved,
       s.first_seen,
       NOW()
  FROM src s
ON CONFLICT (household_id, lower(name)) DO NOTHING;

-- ── Statement C — backfill `planned_meals.meal_id` from name match ───────────
-- Sets meal_id on every planned_meals row whose custom_name matches a meals
-- row in the same household (case-insensitive, trim-tolerant). Excludes
-- eating-out. Includes soft-deleted rows whose name still resolves — those
-- get the FK populated for free.
UPDATE planned_meals pm
   SET meal_id = m.id
  FROM meals m
 WHERE m.household_id = pm.household_id
   AND lower(trim(m.name)) = lower(trim(pm.custom_name))
   AND pm.meal_id IS NULL
   AND pm.custom_name IS NOT NULL
   AND COALESCE(pm.entry_type, 'ghost') != 'eating_out';
