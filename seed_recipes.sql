-- ══════════════════════════════════════════════════════════════════════════════
-- ROUX — Hill Family Seed Recipes
-- ══════════════════════════════════════════════════════════════════════════════
--
-- household_id : 53f6a197-544a-48e6-9a46-23d7252399c2
-- added_by     : 18c38c61-fb49-4c29-a4c2-e8907a554dac  (Lauren Hill)
--
-- Recipes (13):
--   01  Authentic Pizzeria Sauce
--   02  Buffalo Chicken Dip
--   03  Feisty Feta Dip
--   04  Loaded Baked Potato Soup
--   05  Creamy Tortellini Soup
--   06  Lynn's Super Secret Fudge         (visibility: secret)
--   07  Peanut Butter Balls
--   08  Macaroni and Cheese
--   09  Homemade French Bread
--   10  Enchiladas De Pollo
--   11  Chicken Piccata Sauce             (partial — sauce only)
--   12  Bagels
--   13  Slow Cooker Roast                 (component of French Dip Night)
--
-- Paste into Supabase → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════════════════════════════════

-- Shared constants used throughout
DO $$ BEGIN
  -- sanity check: verify the household and user exist before seeding
  IF NOT EXISTS (SELECT 1 FROM households WHERE id = '53f6a197-544a-48e6-9a46-23d7252399c2') THEN
    RAISE EXCEPTION 'household not found — check household_id';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = '18c38c61-fb49-4c29-a4c2-e8907a554dac') THEN
    RAISE EXCEPTION 'user not found — check user_id';
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- RECIPES
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO recipes (
  id, household_id, added_by,
  name, description,
  source_type, source_url, author, credited_to_name,
  category, cuisine, method, difficulty,
  prep_time_minutes, cook_time_minutes, servings,
  visibility, is_family_favorite
) VALUES

-- 01 Authentic Pizzeria Sauce
( '11111111-1111-1111-1111-000000000001',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Authentic Pizzeria Sauce',
  'Simple, deeply flavored cooked tomato sauce. San Marzano tomatoes are non-negotiable.',
  'manual', NULL, NULL, NULL,
  'sauce', 'Italian', 'stovetop', 'easy',
  5, 20, '2 pizzas',
  'household', false ),

-- 02 Buffalo Chicken Dip
( '11111111-1111-1111-1111-000000000002',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Buffalo Chicken Dip',
  'Creamy, spicy party dip. Brandee''s recipe — a Hill family staple.',
  'person', NULL, NULL, 'Brandee',
  'appetizer', 'American', 'baked', 'easy',
  10, 25, '10–12',
  'household', true ),

-- 03 Feisty Feta Dip
( '11111111-1111-1111-1111-000000000003',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Feisty Feta Dip',
  'Whipped feta with roasted red peppers and a kick of heat. Addictive on warm pita.',
  'url', 'https://scrambledandspiced.com', NULL, 'Scrambled & Spiced',
  'appetizer', 'Mediterranean', 'no-cook', 'easy',
  10, 0, '6–8',
  'household', false ),

-- 04 Loaded Baked Potato Soup
( '11111111-1111-1111-1111-000000000004',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Loaded Baked Potato Soup',
  'Thick, creamy potato soup with all the baked potato toppings.',
  'url', 'https://melobites.com', NULL, 'Melo Bites',
  'soup', 'American', 'stovetop', 'easy',
  20, 40, '6–8',
  'household', true ),

-- 05 Creamy Tortellini Soup
( '11111111-1111-1111-1111-000000000005',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Creamy Tortellini Soup',
  'Dan Pelosi''s NYT Cooking recipe. Italian sausage, kale, cheese tortellini in a creamy tomato broth.',
  'url', 'https://cooking.nytimes.com', 'Dan Pelosi', 'NYT Cooking',
  'soup', 'Italian-American', 'stovetop', 'easy',
  15, 30, '4–6',
  'household', true ),

-- 06 Lynn's Super Secret Fudge (secret — only Lauren can see)
( '11111111-1111-1111-1111-000000000006',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Lynn''s Super Secret Fudge',
  'Family recipe. Do not share.',
  'person', NULL, NULL, 'Lynn',
  'dessert', 'American', 'stovetop', 'easy',
  10, 15, '~64 pieces',
  'secret', false ),

-- 07 Peanut Butter Balls
( '11111111-1111-1111-1111-000000000007',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Peanut Butter Balls',
  'No-bake peanut butter and chocolate treats. Note: use only half the wax the recipe calls for.',
  'person', NULL, NULL, NULL,
  'dessert', 'American', 'no-bake', 'easy',
  30, 0, '~60 balls',
  'household', true ),

-- 08 Macaroni and Cheese
( '11111111-1111-1111-1111-000000000008',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Macaroni and Cheese',
  'Ree Drummond''s baked mac and cheese. Rich, creamy, and unapologetically indulgent.',
  'url', 'https://www.foodnetwork.com/recipes/ree-drummond/macaroni-and-cheese-recipe', 'Ree Drummond', 'Food Network',
  'pasta', 'American', 'baked', 'easy',
  20, 25, '8–10',
  'household', true ),

-- 09 Homemade French Bread
( '11111111-1111-1111-1111-000000000009',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Homemade French Bread',
  'Amy Nash''s classic French bread. Two golden loaves with a crisp crust and soft interior.',
  'url', 'https://houseofnasheats.com', 'Amy Nash', 'House of Nash Eats',
  'bread', 'French', 'baked', 'medium',
  20, 25, '2 loaves',
  'household', true ),

-- 10 Enchiladas De Pollo
( '11111111-1111-1111-1111-000000000010',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Enchiladas De Pollo',
  'Family recipe green chile chicken enchiladas. Creamy filling, salsa verde, melted cheese.',
  'person', NULL, NULL, NULL,
  'main', 'Mexican', 'baked', 'easy',
  25, 30, '6–8',
  'household', true ),

-- 11 Chicken Piccata Sauce
( '11111111-1111-1111-1111-000000000011',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Chicken Piccata Sauce',
  'The sauce only — bright lemon-caper butter sauce. Serve over chicken, pasta, or fish.',
  'manual', NULL, NULL, NULL,
  'sauce', 'Italian', 'stovetop', 'easy',
  5, 10, '4',
  'household', false ),

-- 12 Bagels
( '11111111-1111-1111-1111-000000000012',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Bagels',
  'Claire Saffitz''s NYT Cooking bagels. Chewy, glossy, deeply flavored — worth the effort.',
  'url', 'https://cooking.nytimes.com', 'Claire Saffitz', 'NYT Cooking',
  'bread', 'American', 'baked', 'advanced',
  60, 25, '8 bagels',
  'household', false ),

-- 13 Slow Cooker Roast (component of French Dip Night)
( '11111111-1111-1111-1111-000000000013',
  '53f6a197-544a-48e6-9a46-23d7252399c2',
  '18c38c61-fb49-4c29-a4c2-e8907a554dac',
  'Slow Cooker Roast',
  'The main event for French Dip Night. The braising liquid becomes the au jus for dipping.',
  'manual', NULL, NULL, NULL,
  'main', 'American', 'slow-cooker', 'easy',
  10, 480, '6–8',
  'household', true );


-- ══════════════════════════════════════════════════════════════════════════════
-- INGREDIENTS
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO ingredients (recipe_id, sort_order, quantity, unit, name, preparation_note) VALUES

-- ── 01 Authentic Pizzeria Sauce ───────────────────────────────────────────────
('11111111-1111-1111-1111-000000000001', 1,  '1',      'can (28 oz)',  'crushed San Marzano tomatoes', NULL),
('11111111-1111-1111-1111-000000000001', 2,  '2',      'cloves',       'garlic', 'minced'),
('11111111-1111-1111-1111-000000000001', 3,  '2',      'tbsp',         'olive oil', NULL),
('11111111-1111-1111-1111-000000000001', 4,  '1',      'tsp',          'dried oregano', NULL),
('11111111-1111-1111-1111-000000000001', 5,  '1',      'tsp',          'dried basil', NULL),
('11111111-1111-1111-1111-000000000001', 6,  '1/2',    'tsp',          'kosher salt', NULL),
('11111111-1111-1111-1111-000000000001', 7,  '1/2',    'tsp',          'sugar', NULL),
('11111111-1111-1111-1111-000000000001', 8,  '1',      'pinch',        'red pepper flakes', NULL),

-- ── 02 Buffalo Chicken Dip ────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000002', 1,  '2',      'cups',         'cooked chicken', 'shredded'),
('11111111-1111-1111-1111-000000000002', 2,  '8',      'oz',           'cream cheese', 'softened'),
('11111111-1111-1111-1111-000000000002', 3,  '1/2',    'cup',          'Frank''s RedHot buffalo sauce', NULL),
('11111111-1111-1111-1111-000000000002', 4,  '1/2',    'cup',          'ranch dressing', NULL),
('11111111-1111-1111-1111-000000000002', 5,  '1',      'cup',          'shredded cheddar cheese', 'divided'),
('11111111-1111-1111-1111-000000000002', 6,  '1/4',    'cup',          'crumbled blue cheese', 'optional'),

-- ── 03 Feisty Feta Dip ────────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000003', 1,  '8',      'oz',           'feta cheese', 'crumbled'),
('11111111-1111-1111-1111-000000000003', 2,  '4',      'oz',           'cream cheese', 'softened'),
('11111111-1111-1111-1111-000000000003', 3,  '1/2',    'cup',          'roasted red peppers', 'drained and chopped'),
('11111111-1111-1111-1111-000000000003', 4,  '2',      'tbsp',         'olive oil', 'plus more for drizzle'),
('11111111-1111-1111-1111-000000000003', 5,  '1',      'clove',        'garlic', 'minced'),
('11111111-1111-1111-1111-000000000003', 6,  '1',      'tbsp',         'fresh lemon juice', NULL),
('11111111-1111-1111-1111-000000000003', 7,  '1/2',    'tsp',          'red pepper flakes', 'plus more for topping'),
('11111111-1111-1111-1111-000000000003', 8,  NULL,     NULL,           'warm pita or crusty bread', 'for serving'),

-- ── 04 Loaded Baked Potato Soup ───────────────────────────────────────────────
('11111111-1111-1111-1111-000000000004', 1,  '6',      'slices',       'bacon', 'chopped'),
('11111111-1111-1111-1111-000000000004', 2,  '3',      'lbs',          'russet potatoes', 'peeled and cubed'),
('11111111-1111-1111-1111-000000000004', 3,  '4',      'tbsp',         'unsalted butter', NULL),
('11111111-1111-1111-1111-000000000004', 4,  '1/3',    'cup',          'all-purpose flour', NULL),
('11111111-1111-1111-1111-000000000004', 5,  '4',      'cups',         'chicken broth', NULL),
('11111111-1111-1111-1111-000000000004', 6,  '2',      'cups',         'whole milk', NULL),
('11111111-1111-1111-1111-000000000004', 7,  '1',      'cup',          'sour cream', NULL),
('11111111-1111-1111-1111-000000000004', 8,  '1 1/2',  'cups',         'shredded cheddar cheese', 'divided'),
('11111111-1111-1111-1111-000000000004', 9,  '4',      NULL,           'green onions', 'sliced, for topping'),
('11111111-1111-1111-1111-000000000004', 10, NULL,     NULL,           'salt and black pepper', 'to taste'),

-- ── 05 Creamy Tortellini Soup ─────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000005', 1,  '1',      'lb',           'Italian sausage', 'casings removed'),
('11111111-1111-1111-1111-000000000005', 2,  '1',      'medium',       'yellow onion', 'diced'),
('11111111-1111-1111-1111-000000000005', 3,  '4',      'cloves',       'garlic', 'minced'),
('11111111-1111-1111-1111-000000000005', 4,  '1',      'can (14 oz)',  'crushed tomatoes', NULL),
('11111111-1111-1111-1111-000000000005', 5,  '4',      'cups',         'chicken broth', NULL),
('11111111-1111-1111-1111-000000000005', 6,  '1',      'cup',          'heavy cream', NULL),
('11111111-1111-1111-1111-000000000005', 7,  '9',      'oz',           'refrigerated cheese tortellini', NULL),
('11111111-1111-1111-1111-000000000005', 8,  '2',      'cups',         'baby spinach or kale', 'roughly chopped'),
('11111111-1111-1111-1111-000000000005', 9,  '1/2',    'cup',          'parmesan cheese', 'freshly grated, plus more for serving'),
('11111111-1111-1111-1111-000000000005', 10, NULL,     NULL,           'salt and black pepper', 'to taste'),

-- ── 06 Lynn's Super Secret Fudge ──────────────────────────────────────────────
('11111111-1111-1111-1111-000000000006', 1,  '3',      'cups',         'semi-sweet chocolate chips', NULL),
('11111111-1111-1111-1111-000000000006', 2,  '1',      'can (14 oz)',  'sweetened condensed milk', NULL),
('11111111-1111-1111-1111-000000000006', 3,  '4',      'tbsp',         'unsalted butter', NULL),
('11111111-1111-1111-1111-000000000006', 4,  '1',      'tsp',          'vanilla extract', NULL),
('11111111-1111-1111-1111-000000000006', 5,  '1',      'cup',          'chopped walnuts', 'optional'),
('11111111-1111-1111-1111-000000000006', 6,  '1/4',    'tsp',          'kosher salt', NULL),

-- ── 07 Peanut Butter Balls ────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000007', 1,  '2',      'cups',         'creamy peanut butter', NULL),
('11111111-1111-1111-1111-000000000007', 2,  '1/2',    'cup',          'unsalted butter', 'softened'),
('11111111-1111-1111-1111-000000000007', 3,  '3',      'cups',         'powdered sugar', NULL),
('11111111-1111-1111-1111-000000000007', 4,  '2',      'cups',         'Rice Krispies cereal', NULL),
('11111111-1111-1111-1111-000000000007', 5,  '2',      'cups',         'semi-sweet chocolate chips', NULL),
('11111111-1111-1111-1111-000000000007', 6,  '1/4',    'block',        'paraffin wax', 'NOTE: use only half — wax makes chocolate thicker than needed'),

-- ── 08 Macaroni and Cheese ────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000008', 1,  '4',      'cups',         'macaroni pasta', 'uncooked'),
('11111111-1111-1111-1111-000000000008', 2,  '1/4',    'cup',          'unsalted butter', NULL),
('11111111-1111-1111-1111-000000000008', 3,  '1/4',    'cup',          'all-purpose flour', NULL),
('11111111-1111-1111-1111-000000000008', 4,  '2 1/2',  'cups',         'whole milk', NULL),
('11111111-1111-1111-1111-000000000008', 5,  '1',      'cup',          'heavy cream', NULL),
('11111111-1111-1111-1111-000000000008', 6,  '2',      'cups',         'sharp cheddar cheese', 'shredded'),
('11111111-1111-1111-1111-000000000008', 7,  '1',      'cup',          'gruyere or monterey jack', 'shredded'),
('11111111-1111-1111-1111-000000000008', 8,  '4',      'oz',           'cream cheese', 'cubed'),
('11111111-1111-1111-1111-000000000008', 9,  '1',      'tsp',          'seasoned salt', NULL),
('11111111-1111-1111-1111-000000000008', 10, '1/2',    'tsp',          'black pepper', NULL),
('11111111-1111-1111-1111-000000000008', 11, '1/2',    'tsp',          'dry mustard powder', NULL),

-- ── 09 Homemade French Bread ──────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000009', 1,  '5 1/2',  'cups',         'all-purpose flour', 'plus more for kneading'),
('11111111-1111-1111-1111-000000000009', 2,  '2 1/4',  'tsp',          'active dry yeast', '(1 standard packet)'),
('11111111-1111-1111-1111-000000000009', 3,  '2',      'tsp',          'kosher salt', NULL),
('11111111-1111-1111-1111-000000000009', 4,  '1',      'tbsp',         'sugar', NULL),
('11111111-1111-1111-1111-000000000009', 5,  '2',      'tbsp',         'olive oil', NULL),
('11111111-1111-1111-1111-000000000009', 6,  '2',      'cups',         'warm water', '110°F'),
('11111111-1111-1111-1111-000000000009', 7,  '1',      NULL,           'egg', 'beaten, for egg wash'),
('11111111-1111-1111-1111-000000000009', 8,  '1',      'tbsp',         'butter', 'melted, for brushing after bake'),

-- ── 10 Enchiladas De Pollo ────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000010', 1,  '3',      'cups',         'cooked chicken', 'shredded'),
('11111111-1111-1111-1111-000000000010', 2,  '8',      'oz',           'cream cheese', 'softened'),
('11111111-1111-1111-1111-000000000010', 3,  '1',      'can (4 oz)',   'diced green chiles', NULL),
('11111111-1111-1111-1111-000000000010', 4,  '1',      'tsp',          'ground cumin', NULL),
('11111111-1111-1111-1111-000000000010', 5,  '1',      'tsp',          'garlic powder', NULL),
('11111111-1111-1111-1111-000000000010', 6,  '1/2',    'tsp',          'salt', NULL),
('11111111-1111-1111-1111-000000000010', 7,  '8–10',   NULL,           'flour tortillas', 'medium (8-inch)'),
('11111111-1111-1111-1111-000000000010', 8,  '2',      'cups',         'salsa verde', 'store-bought or homemade'),
('11111111-1111-1111-1111-000000000010', 9,  '2',      'cups',         'Mexican blend shredded cheese', 'divided'),
('11111111-1111-1111-1111-000000000010', 10, '1/4',    'cup',          'fresh cilantro', 'for garnish'),
('11111111-1111-1111-1111-000000000010', 11, NULL,     NULL,           'sour cream', 'for serving'),

-- ── 11 Chicken Piccata Sauce ──────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000011', 1,  '4',      'tbsp',         'unsalted butter', 'divided'),
('11111111-1111-1111-1111-000000000011', 2,  '2',      'cloves',       'garlic', 'minced'),
('11111111-1111-1111-1111-000000000011', 3,  '1/2',    'cup',          'dry white wine', NULL),
('11111111-1111-1111-1111-000000000011', 4,  '1/2',    'cup',          'chicken broth', NULL),
('11111111-1111-1111-1111-000000000011', 5,  '1/4',    'cup',          'fresh lemon juice', '(about 2 lemons)'),
('11111111-1111-1111-1111-000000000011', 6,  '3',      'tbsp',         'capers', 'drained'),
('11111111-1111-1111-1111-000000000011', 7,  '2',      'tbsp',         'fresh parsley', 'chopped'),
('11111111-1111-1111-1111-000000000011', 8,  NULL,     NULL,           'salt and black pepper', 'to taste'),

-- ── 12 Bagels ─────────────────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000012', 1,  '4',      'cups',         'bread flour', 'plus more for kneading'),
('11111111-1111-1111-1111-000000000012', 2,  '2',      'tsp',          'instant yeast', NULL),
('11111111-1111-1111-1111-000000000012', 3,  '1 1/2',  'tsp',          'kosher salt', NULL),
('11111111-1111-1111-1111-000000000012', 4,  '1',      'tbsp',         'barley malt syrup or honey', NULL),
('11111111-1111-1111-1111-000000000012', 5,  '1 1/4',  'cups',         'warm water', '(110°F)'),

('11111111-1111-1111-1111-000000000012', 6,  '2',      'tbsp',         'baking soda', 'for boiling water'),
('11111111-1111-1111-1111-000000000012', 7,  '1',      'tbsp',         'barley malt syrup', 'for boiling water'),

('11111111-1111-1111-1111-000000000012', 8,  NULL,     NULL,           'sesame seeds, poppy seeds, or everything bagel seasoning', 'for topping'),
('11111111-1111-1111-1111-000000000012', 9,  '1',      NULL,           'egg white', 'beaten, for wash'),

-- ── 13 Slow Cooker Roast ──────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000013', 1,  '3–4',    'lbs',          'beef chuck roast', NULL),
('11111111-1111-1111-1111-000000000013', 2,  '2',      'packets',      'onion soup mix', NULL),
('11111111-1111-1111-1111-000000000013', 3,  '2',      'cups',         'beef broth', NULL),
('11111111-1111-1111-1111-000000000013', 4,  '2',      'tbsp',         'Worcestershire sauce', NULL),
('11111111-1111-1111-1111-000000000013', 5,  '4',      'cloves',       'garlic', 'smashed'),
('11111111-1111-1111-1111-000000000013', 6,  '1',      'tsp',          'black pepper', NULL),
('11111111-1111-1111-1111-000000000013', 7,  NULL,     NULL,           'hoagie rolls', 'for serving'),
('11111111-1111-1111-1111-000000000013', 8,  NULL,     NULL,           'provolone cheese', 'for serving');


-- ══════════════════════════════════════════════════════════════════════════════
-- INSTRUCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO instructions (recipe_id, step_number, instruction, tip) VALUES

-- ── 01 Authentic Pizzeria Sauce ───────────────────────────────────────────────
('11111111-1111-1111-1111-000000000001', 1, 'Heat olive oil in a medium saucepan over medium heat. Add garlic and cook until fragrant and just golden, about 1 minute. Do not let it brown.', 'Browning the garlic makes the sauce bitter.'),
('11111111-1111-1111-1111-000000000001', 2, 'Add crushed tomatoes, oregano, basil, salt, sugar, and red pepper flakes. Stir to combine.', NULL),
('11111111-1111-1111-1111-000000000001', 3, 'Reduce heat to low and simmer uncovered for 20 minutes, stirring occasionally, until sauce has thickened slightly.', 'The sauce should coat a spoon — not too thick, not too thin.'),
('11111111-1111-1111-1111-000000000001', 4, 'Taste and adjust salt. Let cool completely before spreading on pizza dough. Sauce keeps in the fridge for 1 week or freezes for 3 months.', NULL),

-- ── 02 Buffalo Chicken Dip ────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000002', 1, 'Preheat oven to 350°F. In a large bowl, beat cream cheese until smooth.', NULL),
('11111111-1111-1111-1111-000000000002', 2, 'Mix in buffalo sauce and ranch dressing until combined. Fold in shredded chicken and 3/4 cup of the cheddar cheese.', NULL),
('11111111-1111-1111-1111-000000000002', 3, 'Spread into a 9-inch baking dish or cast iron skillet. Top with remaining cheddar (and blue cheese if using).', NULL),
('11111111-1111-1111-1111-000000000002', 4, 'Bake 20–25 minutes until bubbly and lightly browned on top. Serve hot with celery, tortilla chips, or crackers.', 'Rotisserie chicken works perfectly here.'),

-- ── 03 Feisty Feta Dip ────────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000003', 1, 'Add feta, cream cheese, roasted red peppers, olive oil, garlic, lemon juice, and red pepper flakes to a food processor.', NULL),
('11111111-1111-1111-1111-000000000003', 2, 'Process until smooth and creamy, scraping down the sides as needed, about 2 minutes. Taste and adjust seasoning.', 'Want it chunkier? Pulse instead of blending continuously.'),
('11111111-1111-1111-1111-000000000003', 3, 'Transfer to a serving bowl. Drizzle with olive oil and sprinkle with extra red pepper flakes. Serve with warm pita.', NULL),

-- ── 04 Loaded Baked Potato Soup ───────────────────────────────────────────────
('11111111-1111-1111-1111-000000000004', 1, 'In a large Dutch oven or heavy pot, cook bacon over medium heat until crispy. Remove with a slotted spoon and set aside. Leave 2 tbsp drippings in the pot.', NULL),
('11111111-1111-1111-1111-000000000004', 2, 'Add butter to pot. Once melted, whisk in flour and cook 1–2 minutes until golden, forming a roux.', NULL),
('11111111-1111-1111-1111-000000000004', 3, 'Gradually whisk in chicken broth and milk. Add potatoes. Bring to a boil, then reduce heat and simmer 15–20 minutes until potatoes are fork-tender.', NULL),
('11111111-1111-1111-1111-000000000004', 4, 'Using a potato masher, mash some of the potatoes in the pot for a thick, chunky texture (or use an immersion blender for smooth).', 'Leave it chunky — that''s the whole point.'),
('11111111-1111-1111-1111-000000000004', 5, 'Stir in sour cream and 1 cup of the cheddar. Season generously with salt and pepper. Serve topped with remaining cheese, bacon, and green onions.', NULL),

-- ── 05 Creamy Tortellini Soup ─────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000005', 1, 'Brown sausage in a large pot over medium-high heat, breaking it apart as it cooks. Drain excess fat if needed.', NULL),
('11111111-1111-1111-1111-000000000005', 2, 'Add onion to the pot and cook until softened, about 5 minutes. Add garlic and cook 1 minute more.', NULL),
('11111111-1111-1111-1111-000000000005', 3, 'Stir in crushed tomatoes and chicken broth. Bring to a boil.', NULL),
('11111111-1111-1111-1111-000000000005', 4, 'Add tortellini and cook according to package directions (usually 3–5 minutes). Stir in heavy cream and spinach/kale and cook until wilted, about 2 minutes.', NULL),
('11111111-1111-1111-1111-000000000005', 5, 'Remove from heat. Stir in parmesan. Season with salt and pepper. Serve with more parmesan on top.', 'Soup thickens as it sits — add a splash of broth when reheating.'),

-- ── 06 Lynn's Super Secret Fudge ──────────────────────────────────────────────
('11111111-1111-1111-1111-000000000006', 1, 'Line a 9x13 baking pan with foil and butter the foil. Set aside.', NULL),
('11111111-1111-1111-1111-000000000006', 2, 'In a medium saucepan over low heat, melt chocolate chips, condensed milk, and butter together, stirring constantly until smooth.', 'Keep the heat low and stir constantly — do not rush this.'),
('11111111-1111-1111-1111-000000000006', 3, 'Remove from heat. Stir in vanilla, salt, and walnuts if using.', NULL),
('11111111-1111-1111-1111-000000000006', 4, 'Pour into prepared pan and smooth the top. Refrigerate at least 2 hours until firm. Lift out using foil and cut into squares.', NULL),

-- ── 07 Peanut Butter Balls ────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000007', 1, 'Beat peanut butter and butter together until smooth. Mix in powdered sugar one cup at a time. Fold in Rice Krispies.', NULL),
('11111111-1111-1111-1111-000000000007', 2, 'Roll mixture into 1-inch balls. Place on parchment-lined baking sheets. Freeze for 30 minutes.', 'Cold balls are much easier to dip — don''t skip the freeze.'),
('11111111-1111-1111-1111-000000000007', 3, 'Melt chocolate chips with paraffin wax in a double boiler over low heat, stirring until smooth. NOTE: use only half the wax called for — a full block makes the coating too thick.', 'Half the wax gives a thinner, better snap.'),
('11111111-1111-1111-1111-000000000007', 4, 'Using a toothpick, dip each ball into chocolate, letting excess drip off. Place on parchment to set. Refrigerate until firm.', NULL),

-- ── 08 Macaroni and Cheese ────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000008', 1, 'Cook macaroni in heavily salted boiling water until just al dente (1 minute less than package says). Drain and set aside.', NULL),
('11111111-1111-1111-1111-000000000008', 2, 'Preheat oven to 350°F. In the same pot, melt butter over medium heat. Whisk in flour and cook 1–2 minutes.', NULL),
('11111111-1111-1111-1111-000000000008', 3, 'Gradually add milk and cream, whisking constantly to avoid lumps. Cook until thickened, about 5 minutes.', NULL),
('11111111-1111-1111-1111-000000000008', 4, 'Reduce heat to low. Add cream cheese and stir until melted. Add cheddar and gruyere and stir until smooth. Season with seasoned salt, pepper, and mustard powder.', NULL),
('11111111-1111-1111-1111-000000000008', 5, 'Fold in the cooked macaroni. Pour into a buttered 9x13 baking dish. Bake 20–25 minutes until bubbly and lightly golden on top.', 'For a crispy top, broil for the last 2–3 minutes.'),

-- ── 09 Homemade French Bread ──────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000009', 1, 'Combine warm water, sugar, and yeast. Let sit 5 minutes until foamy.', 'If it doesn''t foam, your yeast is dead — start over.'),
('11111111-1111-1111-1111-000000000009', 2, 'In a large bowl, combine flour and salt. Add yeast mixture and olive oil. Mix until a shaggy dough forms, then knead by hand 8–10 minutes until smooth and elastic.', NULL),
('11111111-1111-1111-1111-000000000009', 3, 'Place dough in an oiled bowl, cover with a towel, and let rise in a warm place 1 hour until doubled.', NULL),
('11111111-1111-1111-1111-000000000009', 4, 'Punch down dough. Divide in half. Shape each into a long oval loaf. Place on a parchment-lined baking sheet. Cover and let rise 30 minutes.', NULL),
('11111111-1111-1111-1111-000000000009', 5, 'Preheat oven to 375°F. Use a sharp knife to make 3–4 diagonal slashes on top of each loaf. Brush with egg wash.', 'Slash confidently and quickly — hesitating deflates the dough.'),
('11111111-1111-1111-1111-000000000009', 6, 'Bake 20–25 minutes until deep golden brown and the loaf sounds hollow when tapped on the bottom. Brush with melted butter immediately out of the oven.', NULL),

-- ── 10 Enchiladas De Pollo ────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000010', 1, 'Preheat oven to 375°F. In a large bowl, mix shredded chicken with cream cheese, green chiles, cumin, garlic powder, salt, and 1/2 cup of the shredded cheese until combined.', NULL),
('11111111-1111-1111-1111-000000000010', 2, 'Warm tortillas briefly in a skillet or microwave so they are pliable and don''t crack when rolling.', NULL),
('11111111-1111-1111-1111-000000000010', 3, 'Spread about 1/2 cup of salsa verde on the bottom of a 9x13 baking dish. Place a heaping scoop of chicken filling in each tortilla, roll tightly, and place seam-side down in the dish.', NULL),
('11111111-1111-1111-1111-000000000010', 4, 'Pour remaining salsa verde over the top. Sprinkle remaining cheese over everything.', NULL),
('11111111-1111-1111-1111-000000000010', 5, 'Bake uncovered 25–30 minutes until cheese is melted and edges are bubbly. Top with cilantro and serve with sour cream.', 'For extra bubbly cheese, broil 2 minutes at the end.'),

-- ── 11 Chicken Piccata Sauce ──────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000011', 1, 'In the same pan used to cook your chicken, melt 2 tbsp butter over medium heat. Add garlic and cook 30 seconds until fragrant.', NULL),
('11111111-1111-1111-1111-000000000011', 2, 'Add white wine and let it reduce by half, about 2 minutes, scraping up any browned bits from the pan.', NULL),
('11111111-1111-1111-1111-000000000011', 3, 'Add chicken broth, lemon juice, and capers. Simmer 3–4 minutes until slightly reduced.', 'Taste here — adjust lemon and salt before finishing.'),
('11111111-1111-1111-1111-000000000011', 4, 'Remove from heat and swirl in remaining 2 tbsp cold butter until sauce is glossy and slightly thickened. Stir in parsley. Season with salt and pepper.', 'Cold butter off the heat is the key to a silky, emulsified sauce.'),

-- ── 12 Bagels ─────────────────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000012', 1, 'Combine flour, yeast, salt, and malt syrup in a large bowl. Add warm water and mix until a stiff dough forms. Knead by hand 10 minutes until smooth and only slightly tacky.', NULL),
('11111111-1111-1111-1111-000000000012', 2, 'Divide into 8 equal pieces. Shape each into a ball, then poke a hole in the center with your finger and stretch to about 2 inches wide. Place on a parchment-lined pan.', 'The holes shrink during baking — make them bigger than you think.'),
('11111111-1111-1111-1111-000000000012', 3, 'Cover with a damp towel and let rest 20 minutes at room temperature. Then refrigerate overnight (8–16 hours) for the best flavor.', 'The cold ferment is what makes these worth making.'),
('11111111-1111-1111-1111-000000000012', 4, 'Preheat oven to 450°F. Bring a large pot of water to boil. Add baking soda and malt syrup. Boil bagels 2 at a time for 1 minute per side.', NULL),
('11111111-1111-1111-1111-000000000012', 5, 'Place boiled bagels back on the parchment pan. Brush with egg white and add toppings. Bake 20–25 minutes until deep golden brown.', NULL),

-- ── 13 Slow Cooker Roast ──────────────────────────────────────────────────────
('11111111-1111-1111-1111-000000000013', 1, 'Place chuck roast in the slow cooker. Season all over with black pepper.', NULL),
('11111111-1111-1111-1111-000000000013', 2, 'Sprinkle both packets of onion soup mix over the roast. Add smashed garlic cloves around the sides.', NULL),
('11111111-1111-1111-1111-000000000013', 3, 'Pour beef broth and Worcestershire sauce around (not over) the roast to preserve the seasoning on top.', NULL),
('11111111-1111-1111-1111-000000000013', 4, 'Cook on LOW for 8 hours. Do not open the lid during cooking.', 'LOW and slow is mandatory. High heat makes it stringy instead of silky.'),
('11111111-1111-1111-1111-000000000013', 5, 'Remove roast and shred with two forks. Return meat to the slow cooker to soak in the juices. The liquid in the pot is your au jus — ladle into small bowls for dipping.', NULL),
('11111111-1111-1111-1111-000000000013', 6, 'Serve on hoagie rolls with provolone cheese and a small bowl of au jus alongside.', 'Toast the rolls with a little butter first.');


-- ══════════════════════════════════════════════════════════════════════════════
-- VERIFY
-- ══════════════════════════════════════════════════════════════════════════════

SELECT
  r.name,
  COUNT(DISTINCT i.id)  AS ingredients,
  COUNT(DISTINCT ins.id) AS steps,
  r.visibility,
  r.category
FROM recipes r
LEFT JOIN ingredients i   ON i.recipe_id = r.id
LEFT JOIN instructions ins ON ins.recipe_id = r.id
WHERE r.household_id = '53f6a197-544a-48e6-9a46-23d7252399c2'
GROUP BY r.id, r.name, r.visibility, r.category
ORDER BY r.name;
