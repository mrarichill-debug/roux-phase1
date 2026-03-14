-- Migration: Create protein_favorites table
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS protein_favorites (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  preferred_store_id UUID      REFERENCES grocery_stores(id) ON DELETE SET NULL,
  typical_price    DECIMAL(10,2),
  sort_order       INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE protein_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY pf_select ON protein_favorites
  FOR SELECT USING (household_id = get_my_household_id());
CREATE POLICY pf_insert ON protein_favorites
  FOR INSERT WITH CHECK (household_id = get_my_household_id());
CREATE POLICY pf_update ON protein_favorites
  FOR UPDATE USING (household_id = get_my_household_id());
CREATE POLICY pf_delete ON protein_favorites
  FOR DELETE USING (household_id = get_my_household_id());

GRANT ALL ON protein_favorites TO anon, authenticated;

-- Seed Hill family protein favorites (names only — store chosen fresh each week)
INSERT INTO protein_favorites (household_id, name, sort_order) VALUES
  ('53f6a197-544a-48e6-9a46-23d7252399c2', 'Chicken Thighs',  1),
  ('53f6a197-544a-48e6-9a46-23d7252399c2', 'Ground Beef',     2),
  ('53f6a197-544a-48e6-9a46-23d7252399c2', 'Pork Tenderloin', 3),
  ('53f6a197-544a-48e6-9a46-23d7252399c2', 'Salmon',          4),
  ('53f6a197-544a-48e6-9a46-23d7252399c2', 'Ribs',            5),
  ('53f6a197-544a-48e6-9a46-23d7252399c2', 'Chicken Breasts', 6)
ON CONFLICT DO NOTHING;
