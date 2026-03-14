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

-- Seed Hill family protein favorites
-- First get the store IDs
DO $$
DECLARE
  hid UUID := '53f6a197-544a-48e6-9a46-23d7252399c2';
  kroger_id UUID;
  costco_id UUID;
BEGIN
  SELECT id INTO kroger_id FROM grocery_stores WHERE household_id = hid AND name = 'Kroger' LIMIT 1;
  SELECT id INTO costco_id FROM grocery_stores WHERE household_id = hid AND name = 'Costco' LIMIT 1;

  INSERT INTO protein_favorites (household_id, name, preferred_store_id, sort_order) VALUES
    (hid, 'Chicken Thighs',  kroger_id, 1),
    (hid, 'Ground Beef',     kroger_id, 2),
    (hid, 'Pork Tenderloin', kroger_id, 3),
    (hid, 'Salmon',          kroger_id, 4),
    (hid, 'Ribs',            costco_id, 5),
    (hid, 'Chicken Breasts', costco_id, 6)
  ON CONFLICT DO NOTHING;
END $$;
