-- ══════════════════════════════════════════════════════════════════════════════
-- ROUX PHASE 1 DATABASE SCHEMA
-- ══════════════════════════════════════════════════════════════════════════════
-- 
-- Instructions:
-- 1. Go to your Supabase project dashboard
-- 2. Click "SQL Editor" in the left sidebar
-- 3. Click "New Query"
-- 4. Paste this entire file
-- 5. Click "Run"
-- 
-- This will create all tables, indexes, and Row Level Security policies
-- ══════════════════════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ══════════════════════════════════════════════════════════════════════════════
-- HOUSEHOLDS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  staples_profile JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_households_invite_code ON households(invite_code);

-- ══════════════════════════════════════════════════════════════════════════════
-- USERS TABLE (extends Supabase auth.users)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  preferences JSONB DEFAULT '{}'::jsonb,
  health_goals JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tutorial_completed BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_users_household ON users(household_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- RECIPES TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  ingredients JSONB NOT NULL, -- [{name, amount, unit}]
  instructions TEXT NOT NULL,
  cook_time_minutes INTEGER,
  servings INTEGER NOT NULL DEFAULT 4,
  category TEXT,
  emoji_icon TEXT,
  tags JSONB DEFAULT '[]'::jsonb, -- ["Chicken", "Crock Pot", "Aric's Top 10"]
  kids_version_note TEXT,
  batch_friendly BOOLEAN DEFAULT FALSE,
  freeze_friendly BOOLEAN DEFAULT FALSE,
  make_ahead BOOLEAN DEFAULT FALSE,
  typical_leftover_servings INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recipes_household ON recipes(household_id);
CREATE INDEX idx_recipes_category ON recipes(category);
CREATE INDEX idx_recipes_tags ON recipes USING GIN(tags);

-- ══════════════════════════════════════════════════════════════════════════════
-- WEEK PLANS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE week_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  constraints JSONB DEFAULT '[]'::jsonb, -- ["Soccer Thursday", "Budget week"]
  breakfast_lunch_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_week_plans_household ON week_plans(household_id);
CREATE INDEX idx_week_plans_dates ON week_plans(week_start_date, week_end_date);

-- ══════════════════════════════════════════════════════════════════════════════
-- DAY TYPES TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE day_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_plan_id UUID REFERENCES week_plans(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  day_type TEXT NOT NULL CHECK (day_type IN ('cooking', 'quick', 'crockpot', 'nocook', 'prep', 'flex'))
);

CREATE INDEX idx_day_types_week_plan ON day_types(week_plan_id);
CREATE INDEX idx_day_types_date ON day_types(day_date);

-- ══════════════════════════════════════════════════════════════════════════════
-- MEALS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_plan_id UUID REFERENCES week_plans(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  day_date DATE NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'dinner',
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'skipped', 'completed')),
  skipped_at TIMESTAMPTZ,
  skipped_action TEXT, -- 'freeze', 'move_to_X', 'carry_over', 'discard'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meals_week_plan ON meals(week_plan_id);
CREATE INDEX idx_meals_date ON meals(day_date);
CREATE INDEX idx_meals_recipe ON meals(recipe_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- LEFTOVER LOGS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE leftover_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_id UUID REFERENCES meals(id) ON DELETE CASCADE,
  servings_remaining INTEGER NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leftover_logs_meal ON leftover_logs(meal_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- CARRY OVER ITEMS TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE carry_over_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  ingredient_name TEXT NOT NULL,
  approximate_amount TEXT,
  source_week_start DATE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('skipped_meal', 'end_of_week_checkin', 'manual')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'discarded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_carry_over_household ON carry_over_items(household_id);
CREATE INDEX idx_carry_over_status ON carry_over_items(status);

-- ══════════════════════════════════════════════════════════════════════════════
-- SHOPPING LIST TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  week_plan_id UUID REFERENCES week_plans(id) ON DELETE CASCADE,
  items JSONB NOT NULL, -- [{name, qty, unit, category, checked, is_household_item, store_note}]
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shopping_lists_week_plan ON shopping_lists(week_plan_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- SAGE CHAT HISTORY TABLE
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE sage_chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sage_chat_household ON sage_chat_history(household_id);
CREATE INDEX idx_sage_chat_user ON sage_chat_history(user_id);
CREATE INDEX idx_sage_chat_created ON sage_chat_history(created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE week_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE leftover_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE carry_over_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_chat_history ENABLE ROW LEVEL SECURITY;

-- Households: Users can only see their own household
CREATE POLICY households_select ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY households_insert ON households
  FOR INSERT WITH CHECK (true); -- Anyone can create a household

CREATE POLICY households_update ON households
  FOR UPDATE USING (
    id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Users: Users can see all users in their household
CREATE POLICY users_select ON users
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (
    id = auth.uid() -- Can only insert yourself
  );

CREATE POLICY users_update ON users
  FOR UPDATE USING (
    id = auth.uid() -- Can only update yourself
  );

-- Recipes: Users can see all recipes in their household
CREATE POLICY recipes_select ON recipes
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY recipes_insert ON recipes
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY recipes_update ON recipes
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY recipes_delete ON recipes
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Week Plans: Users can see all plans in their household
CREATE POLICY week_plans_select ON week_plans
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY week_plans_insert ON week_plans
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY week_plans_update ON week_plans
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY week_plans_delete ON week_plans
  FOR DELETE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Day Types: Users can see all day types in their household's plans
CREATE POLICY day_types_select ON day_types
  FOR SELECT USING (
    week_plan_id IN (
      SELECT id FROM week_plans 
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY day_types_insert ON day_types
  FOR INSERT WITH CHECK (
    week_plan_id IN (
      SELECT id FROM week_plans 
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY day_types_update ON day_types
  FOR UPDATE USING (
    week_plan_id IN (
      SELECT id FROM week_plans 
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

-- Meals: Users can see all meals in their household's plans
CREATE POLICY meals_select ON meals
  FOR SELECT USING (
    week_plan_id IN (
      SELECT id FROM week_plans 
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY meals_insert ON meals
  FOR INSERT WITH CHECK (
    week_plan_id IN (
      SELECT id FROM week_plans 
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY meals_update ON meals
  FOR UPDATE USING (
    week_plan_id IN (
      SELECT id FROM week_plans 
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY meals_delete ON meals
  FOR DELETE USING (
    week_plan_id IN (
      SELECT id FROM week_plans 
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

-- Leftover Logs: Users can see all logs in their household
CREATE POLICY leftover_logs_select ON leftover_logs
  FOR SELECT USING (
    meal_id IN (
      SELECT id FROM meals 
      WHERE week_plan_id IN (
        SELECT id FROM week_plans 
        WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY leftover_logs_insert ON leftover_logs
  FOR INSERT WITH CHECK (
    meal_id IN (
      SELECT id FROM meals 
      WHERE week_plan_id IN (
        SELECT id FROM week_plans 
        WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
      )
    )
  );

-- Carry Over Items: Users can see all items in their household
CREATE POLICY carry_over_items_select ON carry_over_items
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY carry_over_items_insert ON carry_over_items
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY carry_over_items_update ON carry_over_items
  FOR UPDATE USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

-- Shopping Lists: Users can see all lists in their household
CREATE POLICY shopping_lists_select ON shopping_lists
  FOR SELECT USING (
    week_plan_id IN (
      SELECT id FROM week_plans 
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY shopping_lists_insert ON shopping_lists
  FOR INSERT WITH CHECK (
    week_plan_id IN (
      SELECT id FROM week_plans 
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY shopping_lists_update ON shopping_lists
  FOR UPDATE USING (
    week_plan_id IN (
      SELECT id FROM week_plans 
      WHERE household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    )
  );

-- Sage Chat History: Users can see all chat in their household
CREATE POLICY sage_chat_select ON sage_chat_history
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY sage_chat_insert ON sage_chat_history
  FOR INSERT WITH CHECK (
    household_id IN (SELECT household_id FROM users WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code like ROUX-4729
    code := 'ROUX-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    
    -- Check if it exists
    SELECT EXISTS(SELECT 1 FROM households WHERE invite_code = code) INTO exists;
    
    -- If unique, return it
    IF NOT exists THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════════════
-- DONE!
-- ══════════════════════════════════════════════════════════════════════════════
-- 
-- Your Supabase database is now set up for Roux Phase 1.
-- Next step: Set up authentication in the Supabase dashboard
-- (Settings → Authentication → Email templates)
-- ══════════════════════════════════════════════════════════════════════════════
