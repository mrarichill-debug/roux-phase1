-- ══════════════════════════════════════════════════════════════════════════════
-- ROUX PHASE 2 — DATABASE SCHEMA
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Instructions:
--   1. Open Supabase dashboard → SQL Editor → New Query
--   2. Paste this entire file
--   3. Click Run
--   4. Verify: Table Editor should show all 30 tables
--
-- IMPORTANT — DO NOT run roux-phase1/supabase-schema.sql against this project.
-- That schema is retired. This file is the authoritative phase 2 schema.
--
-- Architecture notes:
--
--   Circular dependency fix (Option 1):
--     households.founded_by and owned_by are nullable to break the circular FK
--     with users. Correct INSERT order:
--       1. INSERT INTO households (name, invite_code, ...) — both FKs omitted/NULL
--       2. INSERT INTO users (household_id, auth_id, ...) — links to household
--       3. UPDATE households SET founded_by = <user_id>, owned_by = <user_id>
--     This is the only valid household creation pattern. Enforce in app logic.
--
--   founded_by vs owned_by:
--     founded_by — immutable historical record. Who created this household.
--                  ON DELETE SET NULL: if the founder leaves, history is preserved.
--                  Never changes after initial backfill. Enforce in app.
--     owned_by   — current operational owner. Who controls the household now.
--                  ON DELETE RESTRICT: the owner cannot be deleted without first
--                  transferring ownership to another user.
--                  Can change via an ownership transfer flow.
--     RLS permission checks use owned_by, not founded_by.
--
--   Auth link:
--     users.auth_id references auth.users(id). Required for RLS (auth.uid() lookup).
--     users.id is the internal app UUID used for all FK relationships.
--     users.auth_id is the Supabase auth identity.
--
--   Age is never stored. Always calculate from date_of_birth at query time.
--
--   households.founded_by is immutable after initial backfill. Enforce in app.
--   households.week_start_day is immutable after creation. Enforce in app.
--
-- ══════════════════════════════════════════════════════════════════════════════


-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ── Helper: updated_at trigger function ───────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ── Helper: invite code generator ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  taken BOOLEAN;
BEGIN
  LOOP
    code := 'ROUX-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM households WHERE invite_code = code) INTO taken;
    IF NOT taken THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- ══════════════════════════════════════════════════════════════════════════════
-- TABLES — in dependency order
-- ══════════════════════════════════════════════════════════════════════════════


-- ── Table 1: households ───────────────────────────────────────────────────────
-- founded_by and owned_by are nullable to break the circular FK with users.
-- Both must be backfilled immediately after the admin user row is inserted.
-- founded_by: immutable historical record — SET NULL if founder leaves.
-- owned_by:   current owner for permission checks — RESTRICT, transfer first.

CREATE TABLE households (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT        NOT NULL,
  founded_by              UUID,                          -- FK added after users table; immutable after backfill
  owned_by                UUID,                          -- FK added after users table; changes on ownership transfer
  invite_code             TEXT        UNIQUE NOT NULL DEFAULT generate_invite_code(),
  location                TEXT,
  timezone                TEXT        NOT NULL DEFAULT 'America/Chicago',
  week_start_day          TEXT        NOT NULL DEFAULT 'monday'
                            CHECK (week_start_day IN ('monday', 'sunday')),
  subscription_tier       TEXT        NOT NULL DEFAULT 'free'
                            CHECK (subscription_tier IN ('free', 'plus', 'premium')),
  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 3: family_members ───────────────────────────────────────────────────
-- Created before users because users.family_member_id references this table.

CREATE TABLE family_members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  date_of_birth DATE,                         -- age always calculated, never stored
  is_pet        BOOLEAN     NOT NULL DEFAULT FALSE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 2: users ────────────────────────────────────────────────────────────
-- auth_id links this row to Supabase auth.users for RLS (auth.uid() lookup).
-- id is the internal app UUID used by all FK relationships.

CREATE TABLE users (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id          UUID        UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id     UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  family_member_id UUID        UNIQUE REFERENCES family_members(id) ON DELETE SET NULL,
  name             TEXT        NOT NULL,
  email            TEXT        UNIQUE NOT NULL,
  role             TEXT        NOT NULL DEFAULT 'member_viewer'
                     CHECK (role IN ('admin', 'co_admin', 'member_admin', 'member_viewer')),
  avatar_url       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Now that users exists, add FK constraints for founded_by and owned_by.
-- founded_by: SET NULL preserves history if the founder's account is deleted.
-- owned_by:   RESTRICT blocks deletion of the current owner — transfer first.
ALTER TABLE households
  ADD CONSTRAINT households_founded_by_fkey
  FOREIGN KEY (founded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE households
  ADD CONSTRAINT households_owned_by_fkey
  FOREIGN KEY (owned_by) REFERENCES users(id) ON DELETE RESTRICT;


-- ── RLS helpers — defined here because LANGUAGE sql functions validate ─────────
-- table references at definition time. users table must exist first.

CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ── Table 4: family_member_preferences ────────────────────────────────────────

CREATE TABLE family_member_preferences (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID        NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  household_id     UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  preference_type  TEXT        NOT NULL
                     CHECK (preference_type IN ('like', 'dislike', 'allergy', 'restriction', 'texture', 'note')),
  value            TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 5: household_preferences ───────────────────────────────────────────

CREATE TABLE household_preferences (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         UUID        NOT NULL UNIQUE REFERENCES households(id) ON DELETE CASCADE,
  proteins             TEXT[]      NOT NULL DEFAULT '{}',
  avoided_proteins     TEXT[]      NOT NULL DEFAULT '{}',
  dietary_style        TEXT,
  red_meat_frequency   TEXT,
  dietary_restrictions TEXT[]      NOT NULL DEFAULT '{}',
  spice_tolerance      TEXT        NOT NULL DEFAULT 'mild'
                         CHECK (spice_tolerance IN ('none', 'mild', 'medium', 'hot')),
  weeknight_max_time   INTEGER     NOT NULL DEFAULT 60,
  meal_planning_scope  TEXT[]      NOT NULL DEFAULT '{}',
  equipment            TEXT[]      NOT NULL DEFAULT '{}',
  cuisine_preferences  TEXT[]      NOT NULL DEFAULT '{}',
  adventurousness      TEXT        NOT NULL DEFAULT 'mostly_familiar',
  meal_values          TEXT[]      NOT NULL DEFAULT '{}',
  sweet_tooth          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 6: features ─────────────────────────────────────────────────────────
-- Subscription feature catalog. Read-only from the app layer.

CREATE TABLE features (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key  TEXT        UNIQUE NOT NULL,
  feature_name TEXT        NOT NULL,
  description  TEXT,
  min_tier     TEXT        NOT NULL CHECK (min_tier IN ('free', 'plus', 'premium')),
  category     TEXT        CHECK (category IN ('sage_aware', 'sage_helpful', 'sage_proactive', 'planning', 'social', 'limits')),
  limit_value  INTEGER,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 7: grocery_stores ───────────────────────────────────────────────────

CREATE TABLE grocery_stores (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  location     TEXT,
  is_primary   BOOLEAN     NOT NULL DEFAULT FALSE,
  ad_url       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 8: recipes ──────────────────────────────────────────────────────────

CREATE TABLE recipes (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id          UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  added_by              UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name                  TEXT        NOT NULL,
  description           TEXT,
  author                TEXT,
  credited_to_name      TEXT,
  credited_to_user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  original_recipe_id    UUID        REFERENCES recipes(id) ON DELETE SET NULL,
  original_household_id UUID        REFERENCES households(id) ON DELETE SET NULL,
  shared_by_user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  last_notified_update  TIMESTAMPTZ,
  source_type           TEXT        CHECK (source_type IN ('url', 'photo', 'manual', 'person', 'social', 'paste')),
  source_url            TEXT,
  published_date        DATE,
  photo_url             TEXT,
  photo_credit          TEXT,
  video_url             TEXT,
  category              TEXT,
  cuisine               TEXT,
  method                TEXT,
  diet                  TEXT[]      NOT NULL DEFAULT '{}',
  difficulty            TEXT        CHECK (difficulty IN ('easy', 'medium', 'advanced')),
  prep_time_minutes     INTEGER,
  cook_time_minutes     INTEGER,
  inactive_time_minutes INTEGER,
  total_time_minutes    INTEGER,
  total_project_time    TEXT,
  cook_temp_f           INTEGER,
  servings              TEXT,
  yield_description     TEXT,
  equipment             TEXT[]      NOT NULL DEFAULT '{}',
  storage_instructions  TEXT,
  personal_notes        TEXT,
  variations            TEXT,
  visibility            TEXT        NOT NULL DEFAULT 'household'
                          CHECK (visibility IN ('secret', 'household', 'shareable')),
  is_family_favorite    BOOLEAN     NOT NULL DEFAULT FALSE,
  source_rating         TEXT,
  times_planned         INTEGER     NOT NULL DEFAULT 0,
  times_cooked          INTEGER     NOT NULL DEFAULT 0,
  sage_assist_offered   TEXT,
  sage_assist_status    TEXT        CHECK (sage_assist_status IN ('pending', 'accepted', 'declined')),
  sage_assist_content   TEXT,
  recipe_type           TEXT        NOT NULL DEFAULT 'full'
                          CHECK (recipe_type IN ('full', 'quick')),
  status                TEXT        NOT NULL DEFAULT 'complete'
                          CHECK (status IN ('draft', 'complete')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 9: ingredients ──────────────────────────────────────────────────────

CREATE TABLE ingredients (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id        UUID        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  section_name     TEXT,
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  name             TEXT        NOT NULL,
  quantity         TEXT,
  unit             TEXT,
  preparation_note TEXT,
  is_optional      BOOLEAN     NOT NULL DEFAULT FALSE,
  substitution     TEXT,
  personal_note    TEXT,
  linked_recipe_id UUID        REFERENCES recipes(id) ON DELETE SET NULL,
  is_perishable    BOOLEAN     NOT NULL DEFAULT FALSE,
  perishable_days  INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 10: instructions ────────────────────────────────────────────────────

CREATE TABLE instructions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id      UUID        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  section_name   TEXT,
  step_number    INTEGER     NOT NULL,
  instruction    TEXT        NOT NULL,
  tip            TEXT,
  step_photo_url TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 11: meals ───────────────────────────────────────────────────────────
-- A meal is a named combination of recipes (e.g., "French Dip Night").
-- Component recipe slots live in meal_recipes.

CREATE TABLE meals (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  description  TEXT,
  created_by   UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_saved     BOOLEAN     NOT NULL DEFAULT TRUE,
  photo_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 12: meal_recipes ────────────────────────────────────────────────────
-- recipe_id uses ON DELETE RESTRICT intentionally. A recipe cannot be deleted
-- while it belongs to a saved meal. The app must detect this and guide the user
-- to remove the recipe from all meals before deletion is allowed.

CREATE TABLE meal_recipes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id      UUID        NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  recipe_id    UUID        NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  role         TEXT        CHECK (role IN ('main', 'side', 'bread', 'sauce', 'dessert', 'drink', 'other')),
  is_swappable BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 12b: meal_recipe_alternatives ─────────────────────────────────────
-- Alternative recipe options for a meal component slot. E.g., for French Dip
-- Night the "bread" slot might have Store Bought Rolls or Homemade Baguette.

CREATE TABLE meal_recipe_alternatives (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_recipe_id  UUID        NOT NULL REFERENCES meal_recipes(id) ON DELETE CASCADE,
  recipe_id       UUID        NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(meal_recipe_id, recipe_id)
);


-- ── Table 13: day_types ───────────────────────────────────────────────────────
-- Per-household day type definitions (School Day, Weekend, No School Day, etc.)

CREATE TABLE day_types (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id              UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name                      TEXT        NOT NULL,
  description               TEXT,
  default_dinner_max_time   INTEGER,
  default_dinner_complexity TEXT        CHECK (default_dinner_complexity IN ('simple', 'normal', 'ambitious')),
  default_breakfast_style   TEXT        CHECK (default_breakfast_style IN ('quick', 'relaxed', 'special')),
  default_lunch_style       TEXT        CHECK (default_lunch_style IN ('school', 'home', 'leftovers', 'out', 'skip')),
  color                     TEXT,
  icon                      TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 14: household_traditions ───────────────────────────────────────────

CREATE TABLE household_traditions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,
  tradition_type       TEXT        CHECK (tradition_type IN ('weekly', 'annual', 'occasional')),
  day_of_week          TEXT,
  occasion_date        DATE,
  occasion_month       INTEGER,
  occasion_week        TEXT,
  is_hosted            BOOLEAN     NOT NULL DEFAULT FALSE,
  expected_guest_count INTEGER,
  planning_lead_days   INTEGER     NOT NULL DEFAULT 0,
  is_flexible          BOOLEAN     NOT NULL DEFAULT TRUE,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 15: tradition_recipes ───────────────────────────────────────────────
-- recipe_id uses ON DELETE RESTRICT intentionally. A recipe cannot be deleted
-- while it is linked to a household tradition. The app must detect this and
-- guide the user to remove the recipe from all traditions before deletion.

CREATE TABLE tradition_recipes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tradition_id UUID        NOT NULL REFERENCES household_traditions(id) ON DELETE CASCADE,
  recipe_id    UUID        NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
  is_required  BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 16: meal_plans ──────────────────────────────────────────────────────

CREATE TABLE meal_plans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by      UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  week_start_date DATE        NOT NULL,
  week_end_date   DATE        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published', 'active', 'completed', 'archived')),
  season_tag      TEXT,
  notes           TEXT,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 17: planned_meals ───────────────────────────────────────────────────

CREATE TABLE planned_meals (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  meal_plan_id   UUID        NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  prep_plan_id   UUID        REFERENCES meal_plans(id) ON DELETE SET NULL,
  day_of_week    TEXT        CHECK (day_of_week IN
                   ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  meal_type      TEXT        NOT NULL
                   CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'other', 'meal_prep')),
  scope          TEXT        NOT NULL DEFAULT 'day'
                   CHECK (scope IN ('day', 'week', 'weekday', 'weekend', 'meal_prep')),
  slot_type      TEXT        CHECK (slot_type IN
                   ('meal', 'recipe', 'note', 'leftover', 'takeout', 'school_lunch')),
  meal_id        UUID        REFERENCES meals(id) ON DELETE SET NULL,
  recipe_id      UUID        REFERENCES recipes(id) ON DELETE SET NULL,
  note           TEXT,
  day_type_id    UUID        REFERENCES day_types(id) ON DELETE SET NULL,
  tradition_id   UUID        REFERENCES household_traditions(id) ON DELETE SET NULL,
  prep_day       TEXT,
  serves_members JSONB       NOT NULL DEFAULT '[]',
  status         TEXT        NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned', 'prepped', 'cooked', 'skipped', 'leftover')),
  skip_reason    TEXT        CHECK (skip_reason IN
                   ('no_time', 'changed_mind', 'sick', 'ate_out', 'leftovers', 'other')),
  skip_cost      DECIMAL(10,2),
  sage_suggested BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 18: weekly_proteins ─────────────────────────────────────────────────

CREATE TABLE weekly_proteins (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  meal_plan_id UUID        NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  protein_name TEXT        NOT NULL,
  store_id     UUID        REFERENCES grocery_stores(id) ON DELETE SET NULL,
  is_on_sale   BOOLEAN     NOT NULL DEFAULT FALSE,
  sale_price   DECIMAL(10,2),
  unit         TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 19: shopping_lists ──────────────────────────────────────────────────

CREATE TABLE shopping_lists (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  meal_plan_id    UUID        NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'finalized', 'completed')),
  estimated_cost  DECIMAL(10,2),
  actual_cost     DECIMAL(10,2),
  unplanned_spend DECIMAL(10,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 20: shopping_list_items ─────────────────────────────────────────────

CREATE TABLE shopping_list_items (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id   UUID        NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  household_id       UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name               TEXT        NOT NULL,
  quantity           TEXT,
  unit               TEXT,
  category           TEXT        CHECK (category IN
                       ('protein', 'produce', 'dairy', 'pantry', 'frozen', 'bakery', 'other')),
  source_type        TEXT        CHECK (source_type IN ('recipe', 'manual', 'recurring')),
  recipe_id          UUID        REFERENCES recipes(id) ON DELETE SET NULL,
  store_id           UUID        REFERENCES grocery_stores(id) ON DELETE SET NULL,
  estimated_price    DECIMAL(10,2),
  is_purchased       BOOLEAN     NOT NULL DEFAULT FALSE,
  already_have       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_recurring       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_perishable      BOOLEAN     NOT NULL DEFAULT FALSE,
  perishable_days    INTEGER,
  use_by_date        DATE,
  usage_status       TEXT        NOT NULL DEFAULT 'unused'
                       CHECK (usage_status IN
                         ('unused', 'used_in_plan', 'used_unplanned', 'wasted', 'still_have')),
  usage_confirmed_at TIMESTAMPTZ,
  carry_forward      BOOLEAN     NOT NULL DEFAULT FALSE,
  purchased_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 21: receipts ────────────────────────────────────────────────────────

CREATE TABLE receipts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id      UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  shopping_list_id  UUID        REFERENCES shopping_lists(id) ON DELETE SET NULL,
  store_id          UUID        REFERENCES grocery_stores(id) ON DELETE SET NULL,
  photo_url         TEXT        NOT NULL,
  receipt_date      DATE,
  total_amount      DECIMAL(10,2),
  sage_processed    BOOLEAN     NOT NULL DEFAULT FALSE,
  sage_processed_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 22: receipt_items ───────────────────────────────────────────────────

CREATE TABLE receipt_items (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id            UUID          NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  household_id          UUID          NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  raw_text              TEXT          NOT NULL,
  matched_item_name     TEXT,
  shopping_list_item_id UUID          REFERENCES shopping_list_items(id) ON DELETE SET NULL,
  quantity              DECIMAL(10,3),
  unit_price            DECIMAL(10,2),
  total_price           DECIMAL(10,2),
  is_matched            BOOLEAN       NOT NULL DEFAULT FALSE,
  match_confidence      TEXT          CHECK (match_confidence IN ('high', 'medium', 'low')),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ── Table 23: price_history ───────────────────────────────────────────────────

CREATE TABLE price_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  store_id        UUID        REFERENCES grocery_stores(id) ON DELETE SET NULL,
  item_name       TEXT        NOT NULL,
  unit_price      DECIMAL(10,2) NOT NULL,
  unit            TEXT,
  recorded_date   DATE        NOT NULL,
  source          TEXT        CHECK (source IN ('receipt', 'manual', 'sage_estimated')),
  receipt_item_id UUID        REFERENCES receipt_items(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 24: suggestions ─────────────────────────────────────────────────────

CREATE TABLE suggestions (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id           UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  suggested_by_user_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  suggested_by_member_id UUID        REFERENCES family_members(id) ON DELETE SET NULL,
  suggestion_type        TEXT        CHECK (suggestion_type IN ('meal', 'recipe', 'ingredient', 'occasion')),
  meal_id                UUID        REFERENCES meals(id) ON DELETE SET NULL,
  recipe_id              UUID        REFERENCES recipes(id) ON DELETE SET NULL,
  free_text              TEXT,
  meal_plan_id           UUID        REFERENCES meal_plans(id) ON DELETE SET NULL,
  day_of_week            TEXT,
  meal_type              TEXT,
  status                 TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'declined')),
  responded_by           UUID        REFERENCES users(id) ON DELETE SET NULL,
  responded_at           TIMESTAMPTZ,
  response_note          TEXT,
  times_suggested        INTEGER     NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 25: activity_log ────────────────────────────────────────────────────

CREATE TABLE activity_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES users(id) ON DELETE SET NULL,
  action_type  TEXT        NOT NULL,
  target_type  TEXT,
  target_id    UUID,
  target_name  TEXT,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 26: meal_plan_templates ─────────────────────────────────────────────

CREATE TABLE meal_plan_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  season_tag      TEXT,
  source_plan_ids JSONB       NOT NULL DEFAULT '[]',
  times_used      INTEGER     NOT NULL DEFAULT 0,
  auto_generated  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 27: template_meals ──────────────────────────────────────────────────

CREATE TABLE template_meals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID        NOT NULL REFERENCES meal_plan_templates(id) ON DELETE CASCADE,
  day_of_week TEXT        CHECK (day_of_week IN
                ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  meal_type   TEXT        CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'other', 'meal_prep')),
  scope       TEXT        NOT NULL DEFAULT 'day'
                CHECK (scope IN ('day', 'week', 'weekday', 'weekend', 'meal_prep')),
  slot_type   TEXT        CHECK (slot_type IN
                ('meal', 'recipe', 'note', 'leftover', 'takeout', 'school_lunch')),
  meal_id     UUID        REFERENCES meals(id) ON DELETE SET NULL,
  recipe_id   UUID        REFERENCES recipes(id) ON DELETE SET NULL,
  note        TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 28: shared_plans ────────────────────────────────────────────────────

CREATE TABLE shared_plans (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  meal_plan_id UUID        NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  shared_by    UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  share_type   TEXT        CHECK (share_type IN ('link', 'roux_user')),
  share_token  TEXT        UNIQUE,
  expires_at   TIMESTAMPTZ,
  view_count   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── Table 29: household_follows ───────────────────────────────────────────────

CREATE TABLE household_follows (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  following_household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  status                 TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_household_id, following_household_id)
);


-- ── Table 30: notifications ───────────────────────────────────────────────────
-- System-written only. No client INSERT via RLS — service role writes all rows.
-- Users can SELECT their own notifications and UPDATE to mark read / acted_on.
-- Email infrastructure is not yet implemented; fields are captured for future use.

CREATE TABLE notifications (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id    UUID          NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id         UUID          REFERENCES users(id) ON DELETE CASCADE,  -- NULL = broadcast to whole household
  type            TEXT          NOT NULL,
  title           TEXT          NOT NULL,
  body            TEXT,
  action_type     TEXT,
  action_url      TEXT,
  target_type     TEXT,
  target_id       UUID,
  is_read         BOOLEAN       NOT NULL DEFAULT FALSE,
  is_acted_on     BOOLEAN       NOT NULL DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  acted_on_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  email_enabled   BOOLEAN       NOT NULL DEFAULT FALSE,
  email_sent      BOOLEAN       NOT NULL DEFAULT FALSE,
  email_sent_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- households
CREATE INDEX idx_households_invite_code ON households(invite_code);
CREATE INDEX idx_households_founded_by  ON households(founded_by);
CREATE INDEX idx_households_owned_by    ON households(owned_by);

-- users
CREATE INDEX idx_users_auth_id          ON users(auth_id);
CREATE INDEX idx_users_household        ON users(household_id);
CREATE INDEX idx_users_email            ON users(email);
CREATE INDEX idx_users_family_member    ON users(family_member_id);

-- family_members
CREATE INDEX idx_family_members_household ON family_members(household_id);

-- family_member_preferences
CREATE INDEX idx_fmp_family_member ON family_member_preferences(family_member_id);
CREATE INDEX idx_fmp_household     ON family_member_preferences(household_id);

-- household_preferences
CREATE INDEX idx_hp_household ON household_preferences(household_id);

-- grocery_stores
CREATE INDEX idx_grocery_stores_household ON grocery_stores(household_id);

-- recipes
CREATE INDEX idx_recipes_household  ON recipes(household_id);
CREATE INDEX idx_recipes_added_by   ON recipes(added_by);
CREATE INDEX idx_recipes_category   ON recipes(category);
CREATE INDEX idx_recipes_visibility ON recipes(visibility);
CREATE INDEX idx_recipes_favorite   ON recipes(household_id, is_family_favorite)
  WHERE is_family_favorite = TRUE;

-- ingredients
CREATE INDEX idx_ingredients_recipe ON ingredients(recipe_id);

-- instructions
CREATE INDEX idx_instructions_recipe ON instructions(recipe_id, step_number);

-- meals
CREATE INDEX idx_meals_household  ON meals(household_id);
CREATE INDEX idx_meals_created_by ON meals(created_by);

-- meal_recipes
CREATE INDEX idx_meal_recipes_meal   ON meal_recipes(meal_id);
CREATE INDEX idx_meal_recipes_recipe ON meal_recipes(recipe_id);

-- day_types
CREATE INDEX idx_day_types_household ON day_types(household_id);

-- household_traditions
CREATE INDEX idx_traditions_household ON household_traditions(household_id);

-- tradition_recipes
CREATE INDEX idx_tradition_recipes_tradition ON tradition_recipes(tradition_id);
CREATE INDEX idx_tradition_recipes_recipe    ON tradition_recipes(recipe_id);

-- meal_plans
CREATE INDEX idx_meal_plans_household ON meal_plans(household_id);
CREATE INDEX idx_meal_plans_dates     ON meal_plans(week_start_date, week_end_date);
CREATE INDEX idx_meal_plans_status    ON meal_plans(household_id, status);

-- planned_meals
CREATE INDEX idx_planned_meals_meal_plan ON planned_meals(meal_plan_id);
CREATE INDEX idx_planned_meals_household ON planned_meals(household_id);
CREATE INDEX idx_planned_meals_day       ON planned_meals(meal_plan_id, day_of_week);
CREATE INDEX idx_planned_meals_status    ON planned_meals(status);
CREATE INDEX idx_planned_meals_meal      ON planned_meals(meal_id);
CREATE INDEX idx_planned_meals_recipe    ON planned_meals(recipe_id);

-- weekly_proteins
CREATE INDEX idx_weekly_proteins_meal_plan ON weekly_proteins(meal_plan_id);
CREATE INDEX idx_weekly_proteins_household ON weekly_proteins(household_id);

-- shopping_lists
CREATE INDEX idx_shopping_lists_meal_plan ON shopping_lists(meal_plan_id);
CREATE INDEX idx_shopping_lists_household ON shopping_lists(household_id);

-- shopping_list_items
CREATE INDEX idx_sli_shopping_list ON shopping_list_items(shopping_list_id);
CREATE INDEX idx_sli_household     ON shopping_list_items(household_id);
CREATE INDEX idx_sli_category      ON shopping_list_items(shopping_list_id, category);
CREATE INDEX idx_sli_store         ON shopping_list_items(store_id);

-- receipts
CREATE INDEX idx_receipts_household     ON receipts(household_id);
CREATE INDEX idx_receipts_shopping_list ON receipts(shopping_list_id);

-- receipt_items
CREATE INDEX idx_receipt_items_receipt      ON receipt_items(receipt_id);
CREATE INDEX idx_receipt_items_household    ON receipt_items(household_id);
CREATE INDEX idx_receipt_items_sli          ON receipt_items(shopping_list_item_id);

-- price_history
CREATE INDEX idx_price_history_household ON price_history(household_id);
CREATE INDEX idx_price_history_item      ON price_history(household_id, item_name);
CREATE INDEX idx_price_history_store     ON price_history(store_id);

-- suggestions
CREATE INDEX idx_suggestions_household ON suggestions(household_id);
CREATE INDEX idx_suggestions_status    ON suggestions(household_id, status);

-- activity_log
CREATE INDEX idx_activity_log_household ON activity_log(household_id);
CREATE INDEX idx_activity_log_user      ON activity_log(user_id);
CREATE INDEX idx_activity_log_created   ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_target    ON activity_log(target_type, target_id);

-- meal_plan_templates
CREATE INDEX idx_templates_household ON meal_plan_templates(household_id);

-- template_meals
CREATE INDEX idx_template_meals_template ON template_meals(template_id);

-- shared_plans
CREATE INDEX idx_shared_plans_household   ON shared_plans(household_id);
CREATE INDEX idx_shared_plans_share_token ON shared_plans(share_token);
CREATE INDEX idx_shared_plans_meal_plan   ON shared_plans(meal_plan_id);

-- household_follows
CREATE INDEX idx_follows_follower  ON household_follows(follower_household_id);
CREATE INDEX idx_follows_following ON household_follows(following_household_id);

-- notifications
CREATE INDEX idx_notifications_household ON notifications(household_id);
CREATE INDEX idx_notifications_user      ON notifications(user_id);
CREATE INDEX idx_notifications_unread    ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created   ON notifications(created_at DESC);


-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE households               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_member_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_preferences    ENABLE ROW LEVEL SECURITY;
ALTER TABLE features                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_stores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_recipes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_types                ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_traditions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tradition_recipes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_meals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_proteins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history            ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_meals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_plans             ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_follows        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;


-- ── RLS: households ───────────────────────────────────────────────────────────

CREATE POLICY households_select ON households
  FOR SELECT USING (
    id = get_my_household_id()
    OR id IN (
      SELECT household_id FROM users WHERE auth_id = auth.uid()
    )
  );

-- Any authenticated user can create a household (signup / onboarding flow).
-- auth.uid() IS NOT NULL ensures anonymous/unauthenticated callers are blocked.
CREATE POLICY households_insert ON households
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY households_update ON households
  FOR UPDATE USING (id = get_my_household_id());


-- ── RLS: users ────────────────────────────────────────────────────────────────

CREATE POLICY users_select ON users
  FOR SELECT USING (
    auth_id = auth.uid()
    OR household_id = get_my_household_id()
  );

-- Can only insert your own row (auth_id must match the calling auth identity)
CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (auth_id = auth.uid());

-- Can only update your own row
CREATE POLICY users_update ON users
  FOR UPDATE USING (auth_id = auth.uid());


-- ── RLS: family_members ───────────────────────────────────────────────────────

CREATE POLICY family_members_select ON family_members
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY family_members_insert ON family_members
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY family_members_update ON family_members
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY family_members_delete ON family_members
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: family_member_preferences ───────────────────────────────────────────

CREATE POLICY fmp_select ON family_member_preferences
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY fmp_insert ON family_member_preferences
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY fmp_update ON family_member_preferences
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY fmp_delete ON family_member_preferences
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: household_preferences ────────────────────────────────────────────────

CREATE POLICY hp_select ON household_preferences
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY hp_insert ON household_preferences
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY hp_update ON household_preferences
  FOR UPDATE USING (household_id = get_my_household_id());


-- ── RLS: features (read-only catalog, any authenticated user) ─────────────────

CREATE POLICY features_select ON features
  FOR SELECT USING (auth.uid() IS NOT NULL);


-- ── RLS: grocery_stores ───────────────────────────────────────────────────────

CREATE POLICY grocery_stores_select ON grocery_stores
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY grocery_stores_insert ON grocery_stores
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY grocery_stores_update ON grocery_stores
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY grocery_stores_delete ON grocery_stores
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: recipes ──────────────────────────────────────────────────────────────
-- Secret recipes visible only to the user who added them.

CREATE POLICY recipes_select ON recipes
  FOR SELECT USING (
    household_id = get_my_household_id()
    AND (visibility != 'secret' OR added_by = get_my_user_id())
  );

CREATE POLICY recipes_insert ON recipes
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY recipes_update ON recipes
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY recipes_delete ON recipes
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: ingredients ──────────────────────────────────────────────────────────

CREATE POLICY ingredients_select ON ingredients
  FOR SELECT USING (
    recipe_id IN (
      SELECT id FROM recipes
      WHERE household_id = get_my_household_id()
      AND (visibility != 'secret' OR added_by = get_my_user_id())
    )
  );

CREATE POLICY ingredients_insert ON ingredients
  FOR INSERT WITH CHECK (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = get_my_household_id())
  );

CREATE POLICY ingredients_update ON ingredients
  FOR UPDATE USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = get_my_household_id())
  );

CREATE POLICY ingredients_delete ON ingredients
  FOR DELETE USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = get_my_household_id())
  );


-- ── RLS: instructions ─────────────────────────────────────────────────────────

CREATE POLICY instructions_select ON instructions
  FOR SELECT USING (
    recipe_id IN (
      SELECT id FROM recipes
      WHERE household_id = get_my_household_id()
      AND (visibility != 'secret' OR added_by = get_my_user_id())
    )
  );

CREATE POLICY instructions_insert ON instructions
  FOR INSERT WITH CHECK (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = get_my_household_id())
  );

CREATE POLICY instructions_update ON instructions
  FOR UPDATE USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = get_my_household_id())
  );

CREATE POLICY instructions_delete ON instructions
  FOR DELETE USING (
    recipe_id IN (SELECT id FROM recipes WHERE household_id = get_my_household_id())
  );


-- ── RLS: meals ────────────────────────────────────────────────────────────────

CREATE POLICY meals_select ON meals
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY meals_insert ON meals
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY meals_update ON meals
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY meals_delete ON meals
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: meal_recipes ─────────────────────────────────────────────────────────

CREATE POLICY meal_recipes_select ON meal_recipes
  FOR SELECT USING (
    meal_id IN (SELECT id FROM meals WHERE household_id = get_my_household_id())
  );

CREATE POLICY meal_recipes_insert ON meal_recipes
  FOR INSERT WITH CHECK (
    meal_id IN (SELECT id FROM meals WHERE household_id = get_my_household_id())
  );

CREATE POLICY meal_recipes_update ON meal_recipes
  FOR UPDATE USING (
    meal_id IN (SELECT id FROM meals WHERE household_id = get_my_household_id())
  );

CREATE POLICY meal_recipes_delete ON meal_recipes
  FOR DELETE USING (
    meal_id IN (SELECT id FROM meals WHERE household_id = get_my_household_id())
  );


-- ── RLS: day_types ────────────────────────────────────────────────────────────

CREATE POLICY day_types_select ON day_types
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY day_types_insert ON day_types
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY day_types_update ON day_types
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY day_types_delete ON day_types
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: household_traditions ─────────────────────────────────────────────────

CREATE POLICY traditions_select ON household_traditions
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY traditions_insert ON household_traditions
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY traditions_update ON household_traditions
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY traditions_delete ON household_traditions
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: tradition_recipes ────────────────────────────────────────────────────

CREATE POLICY tradition_recipes_select ON tradition_recipes
  FOR SELECT USING (
    tradition_id IN (
      SELECT id FROM household_traditions WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY tradition_recipes_insert ON tradition_recipes
  FOR INSERT WITH CHECK (
    tradition_id IN (
      SELECT id FROM household_traditions WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY tradition_recipes_delete ON tradition_recipes
  FOR DELETE USING (
    tradition_id IN (
      SELECT id FROM household_traditions WHERE household_id = get_my_household_id()
    )
  );


-- ── RLS: meal_plans ───────────────────────────────────────────────────────────

CREATE POLICY meal_plans_select ON meal_plans
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY meal_plans_insert ON meal_plans
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY meal_plans_update ON meal_plans
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY meal_plans_delete ON meal_plans
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: planned_meals ────────────────────────────────────────────────────────

CREATE POLICY planned_meals_select ON planned_meals
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY planned_meals_insert ON planned_meals
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY planned_meals_update ON planned_meals
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY planned_meals_delete ON planned_meals
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: weekly_proteins ──────────────────────────────────────────────────────

CREATE POLICY weekly_proteins_select ON weekly_proteins
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY weekly_proteins_insert ON weekly_proteins
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY weekly_proteins_update ON weekly_proteins
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY weekly_proteins_delete ON weekly_proteins
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: shopping_lists ───────────────────────────────────────────────────────

CREATE POLICY shopping_lists_select ON shopping_lists
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY shopping_lists_insert ON shopping_lists
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY shopping_lists_update ON shopping_lists
  FOR UPDATE USING (household_id = get_my_household_id());


-- ── RLS: shopping_list_items ──────────────────────────────────────────────────

CREATE POLICY sli_select ON shopping_list_items
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY sli_insert ON shopping_list_items
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY sli_update ON shopping_list_items
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY sli_delete ON shopping_list_items
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: receipts ─────────────────────────────────────────────────────────────

CREATE POLICY receipts_select ON receipts
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY receipts_insert ON receipts
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

-- UPDATE required so Sage can set sage_processed = true and sage_processed_at
CREATE POLICY receipts_update ON receipts
  FOR UPDATE USING (household_id = get_my_household_id());


-- ── RLS: receipt_items ────────────────────────────────────────────────────────

CREATE POLICY receipt_items_select ON receipt_items
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY receipt_items_insert ON receipt_items
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY receipt_items_update ON receipt_items
  FOR UPDATE USING (household_id = get_my_household_id());


-- ── RLS: price_history ────────────────────────────────────────────────────────

CREATE POLICY price_history_select ON price_history
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY price_history_insert ON price_history
  FOR INSERT WITH CHECK (household_id = get_my_household_id());


-- ── RLS: suggestions ──────────────────────────────────────────────────────────

CREATE POLICY suggestions_select ON suggestions
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY suggestions_insert ON suggestions
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY suggestions_update ON suggestions
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY suggestions_delete ON suggestions
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: activity_log ─────────────────────────────────────────────────────────

CREATE POLICY activity_log_select ON activity_log
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY activity_log_insert ON activity_log
  FOR INSERT WITH CHECK (household_id = get_my_household_id());


-- ── RLS: meal_plan_templates ──────────────────────────────────────────────────

CREATE POLICY templates_select ON meal_plan_templates
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY templates_insert ON meal_plan_templates
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY templates_update ON meal_plan_templates
  FOR UPDATE USING (household_id = get_my_household_id());

CREATE POLICY templates_delete ON meal_plan_templates
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: template_meals ───────────────────────────────────────────────────────

CREATE POLICY template_meals_select ON template_meals
  FOR SELECT USING (
    template_id IN (
      SELECT id FROM meal_plan_templates WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY template_meals_insert ON template_meals
  FOR INSERT WITH CHECK (
    template_id IN (
      SELECT id FROM meal_plan_templates WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY template_meals_update ON template_meals
  FOR UPDATE USING (
    template_id IN (
      SELECT id FROM meal_plan_templates WHERE household_id = get_my_household_id()
    )
  );

CREATE POLICY template_meals_delete ON template_meals
  FOR DELETE USING (
    template_id IN (
      SELECT id FROM meal_plan_templates WHERE household_id = get_my_household_id()
    )
  );


-- ── RLS: shared_plans ─────────────────────────────────────────────────────────
-- SELECT is scoped to own household only. Public link sharing (share_token) cannot
-- be safely implemented with a USING clause — it would expose all shared plans to
-- all authenticated users. Public link access must be implemented via a
-- SECURITY DEFINER function that accepts the token as an argument, bypassing RLS.
-- Do not add a token-based SELECT policy here.

CREATE POLICY shared_plans_select_own ON shared_plans
  FOR SELECT USING (household_id = get_my_household_id());

CREATE POLICY shared_plans_insert ON shared_plans
  FOR INSERT WITH CHECK (household_id = get_my_household_id());

CREATE POLICY shared_plans_delete ON shared_plans
  FOR DELETE USING (household_id = get_my_household_id());


-- ── RLS: household_follows ────────────────────────────────────────────────────

CREATE POLICY follows_select ON household_follows
  FOR SELECT USING (
    follower_household_id  = get_my_household_id()
    OR following_household_id = get_my_household_id()
  );

CREATE POLICY follows_insert ON household_follows
  FOR INSERT WITH CHECK (follower_household_id = get_my_household_id());

CREATE POLICY follows_update ON household_follows
  FOR UPDATE USING (
    follower_household_id  = get_my_household_id()
    OR following_household_id = get_my_household_id()
  );

CREATE POLICY follows_delete ON household_follows
  FOR DELETE USING (follower_household_id = get_my_household_id());


-- ── RLS: notifications ────────────────────────────────────────────────────────
-- No INSERT policy — notifications are written by service role only.
-- Users can read their own notifications (user_id match) or household broadcasts (user_id IS NULL).
-- Users can mark their own notifications as read or acted_on via UPDATE.

CREATE POLICY notifications_select ON notifications
  FOR SELECT USING (
    household_id = get_my_household_id()
    AND (
      user_id IS NULL
      OR user_id = get_my_user_id()
    )
  );

CREATE POLICY notifications_update ON notifications
  FOR UPDATE USING (
    household_id = get_my_household_id()
    AND (
      user_id IS NULL
      OR user_id = get_my_user_id()
    )
  );


-- ══════════════════════════════════════════════════════════════════════════════
-- GRANTS
-- ══════════════════════════════════════════════════════════════════════════════
-- RLS policies control which rows each role can touch.
-- GRANT controls whether the role can touch the table at all.
-- Without grants, Postgres returns 42501 permission denied before RLS runs.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;


-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS — auto-update updated_at
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_households_updated_at
  BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_family_members_updated_at
  BEFORE UPDATE ON family_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_fmp_updated_at
  BEFORE UPDATE ON family_member_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_hp_updated_at
  BEFORE UPDATE ON household_preferences
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_grocery_stores_updated_at
  BEFORE UPDATE ON grocery_stores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_meals_updated_at
  BEFORE UPDATE ON meals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_day_types_updated_at
  BEFORE UPDATE ON day_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_traditions_updated_at
  BEFORE UPDATE ON household_traditions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_meal_plans_updated_at
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_planned_meals_updated_at
  BEFORE UPDATE ON planned_meals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_shopping_lists_updated_at
  BEFORE UPDATE ON shopping_lists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_sli_updated_at
  BEFORE UPDATE ON shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON meal_plan_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ══════════════════════════════════════════════════════════════════════════════
-- DONE
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Verify with:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;
--   -- Expected: 30 rows
--
-- Next: deploy SAMPLE_DATA.sql to load Hill family household, users,
-- family members, preferences, and seed recipes.
--
-- ══════════════════════════════════════════════════════════════════════════════
