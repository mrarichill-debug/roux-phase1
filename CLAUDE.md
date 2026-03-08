# CLAUDE.md — Roux Phase 2
## The Complete DNA of This Application
*Last updated: March 8, 2026*
*This document is the single source of truth for all development decisions, product direction, and technical architecture for Roux Phase 2. Read this entire document before writing any code, creating any files, or making any architectural decisions.*

---

## 1. WHAT IS ROUX

Roux is a family meal planning application. At its core it is a **premium family recipe library that also plans meals**. It is not a tutorial app, not a social network, not a restaurant finder. It is the digital home for a family's food life.

**The one sentence description:**
> Roux is where families store their recipes, plan their meals, and get smarter about feeding the people they love.

**What Roux does — in priority order:**
1. Stores the family recipe library — premium, complete, detailed
2. Plans the weekly meal schedule using that library
3. Generates and manages the shopping list from the plan
4. Tracks what actually happened — cooked, skipped, spent
5. Learns family patterns and behaviors over time
6. Surfaces intelligence through Sage — the AI assistant

**What Roux is NOT:**
- Not a recipe discovery app (like Yummly)
- Not a restaurant app
- Not a calorie counter (though nutrition estimates are a feature)
- Not a social media platform (though sharing features exist)
- Not a tutorial-heavy onboarding experience

---

## 2. THE PEOPLE

### Lauren Hill — THE User
- **Email:** mrslaurenhill@gmail.com
- **Role:** Admin — the primary user this entire app was built for
- **Subscription:** Premium — permanently, not as a test user. This is her app.
- **Background:** 20+ years cooking experience. Family of 7. Experienced, confident, efficient.
- **Cooking style:** Weeknight meals in 30-60 minutes. Comfort food. Family-first. Familiar favorites with occasional new things.
- **Planning behavior:** Checks store ads Tuesday/Wednesday, starts draft plan, finalizes Saturday morning.
- **DOB:** November 30, 1984

### Aric Hill — The Builder and Secondary User
- **Email:** mrarichill@gmail.com
- **Role:** Member Admin
- **Relationship to app:** Built it for Lauren. Uses it as a contributing household member.
- **Planning role:** Defers to Lauren on final meal decisions. Makes suggestions. She approves.
- **DOB:** August 17, 1984

### The Hill Family
| Name | DOB | Age (Mar 2026) | Role in App |
|---|---|---|---|
| Lauren | Nov 30, 1984 | 41 | Admin — Premium |
| Aric | Aug 17, 1984 | 41 | Member Admin |
| Avery | Feb 13, 2010 | 16 | Family member (no login yet) |
| Logan | Apr 5, 2013 | 12 | Family member (no login yet) |
| Lucas | Sep 29, 2014 | 11 | Family member (no login yet) |
| Lincoln | Feb 22, 2018 | 8 | Family member (no login yet) |
| Autumn | Jun 29, 2019 | 6 | Family member (no login yet) |
| Coco 🐾 | 2020 | ~5 | French bulldog. Family member. Never a user. |

**IMPORTANT:** Never store age as a field. Always calculate dynamically from date_of_birth.

**Upcoming birthdays (from Mar 8, 2026):**
- Logan — April 5 (28 days away) — Sage should be surfacing this NOW
- Autumn — June 29
- Aric — August 17
- Lucas — September 29
- Lauren — November 30

---

## 3. SAGE — THE AI ASSISTANT

### Who Sage Is
Sage is the AI assistant built into Roux. Her personality is modeled on **Joanna Gaines in the kitchen** — warm, grounded, family-first, unpretentious, fun. She treats Lauren as an experienced equal, never talks down to her, never lectures. She is always time-aware (Lauren has 30-60 minutes on weeknights). She prompts Lauren to gather family input before finalizing plans.

### Sage's Voice
- Warm and direct — like a knowledgeable friend, not a corporate assistant
- Light humor when appropriate
- Never preachy, never repetitive with advice
- Always aware of who she's talking to (Lauren vs Aric vs a kid)
- References family members by name — not "your children"

### Sage's Two-Layer System Prompt Architecture
Built in `src/lib/claude.js`:
- **Layer 1:** `getMasterSystemPrompt()` — permanent identity, never changes
- **Layer 2:** `getContextPrompt(context)` — situation-specific additions
- **Assembly:** `buildSystemPrompt(context, userPreferences)` — combines both

### Sage Assist — The Core Concept
Sage makes one-time offers to help with specific things. The user accepts or declines. If declined, Sage never brings it up again for that item.

**UI pattern:** Small subtle banner — not a popup, not an interruption.
> 🌿 *Sage has a suggestion for this recipe* — **Review** or **Dismiss**

**Types of Sage Assist:**
- Complete an incomplete recipe
- Estimate nutritional information
- Suggest a photo for a recipe
- Clean up imported recipe formatting
- Flag perishable ingredients with shelf life estimates
- Suggest meal swaps based on family preferences
- Surface upcoming birthdays and traditions
- Notice patterns in suggestions (Lucas and hot dogs 😄)

**Sage Assist data fields on recipes:**
- `sage_assist_offered` — what Sage suggested
- `sage_assist_status` — 'pending', 'accepted', 'declined'
- `sage_assist_content` — what Sage added if accepted

### What Sage Handles Automatically
Sage auto-completes the following WITHOUT asking Lauren:
- Recipe classification (category, cuisine, method, difficulty)
- Time estimates (prep, cook, total)
- Equipment detection
- Ingredient perishability and shelf life estimates
- Shopping list categorization (produce, dairy, meat, pantry)
- Receipt reading and price extraction
- Activity log entries
- Price history updates
- Template detection from repeated weeks
- Recurring item detection on shopping lists

### What Sage NEVER Does
- Replace forms for structured data collection
- Make decisions Lauren should make (publish, approve, mark favorite)
- Suggest swapping a non-swappable recipe in a meal
- Reveal secret recipes to other household members
- Reference a family member's private preferences to others
- Be the primary interface for collecting structured household data

### Subscription Tier Capabilities

**Free — Sage is aware:**
- Recipe import (paste, photo, URL)
- Basic recipe assist
- Weather awareness
- Birthday awareness
- Tradition awareness

**Plus — Sage is helpful:**
- Weather-based meal suggestions
- Nutrition estimates
- Complete incomplete recipes
- Suggestion tracking (Lucas's hot dog campaign)
- Meal swap suggestions
- Birthday meal suggestions
- Perishable reminders
- Waste tracking
- Weekly spend summary
- Share plan via link
- Follow other Roux users

**Premium — Sage is proactive (Lauren's tier):**
- Full weekly plan drafting
- Pattern intelligence
- Seasonal meal suggestions
- Family preference learning
- Holiday planning with lead time
- Last year's occasion memory
- Shopping list cost estimation
- Budget trend analysis
- Store price comparison
- Shareable achievement cards
- Auto-generated templates
- Eating out correlation insights
- Waste reduction stats

---

## 4. CORE PRODUCT PRINCIPLES

These principles were established through extensive product design sessions. Do not violate them.

### Forms for structured data. Sage for unstructured content.
- Family member DOB → form field
- Household preferences → multi-step form with checkboxes
- Recipe import → Sage reads it in any format
- Never use Sage as a data collection form for structured information

### Lauren makes deliberate decisions. The system handles state automatically.
- Lauren publishes a meal plan → her decision
- Lauren finalizes a shopping list → her decision
- Plan status advancing from active to completed → system does it automatically
- Shopping list creation when plan is created → system does it automatically
- Never ask Lauren to manually advance a status the system can figure out

### Recipe import uses familiar chat-style input
- Text box + attachment button (like this conversation)
- Sage interprets the format automatically — no format selection menu
- Lauren never has to declare "this is a URL" or "this is a photo"
- Opening message: *"Share a recipe with me — paste the text, drop a photo, or send me a link. I'll take care of the rest."*

### Dinner is primary. Breakfast and lunch are lighter weight.
- Lauren spends 80% of planning energy on dinners
- Breakfast and lunch are often notes, not recipes
- Meal prep items (made Sunday, eaten all week) live in the week they're consumed, but their ingredients belong to the week they're cooked (prep_plan_id vs meal_plan_id)

### Nothing is ever hidden from Lauren in her own app.
- Archived plans are fully viewable by Lauren
- Historical data is always accessible
- Sage mines history for intelligence but Lauren can always look too
- "Repeat this week" button available on any archived plan

### The app gets smarter the longer Lauren uses it.
- Week 1-2: not enough data for insights
- Month 1: basic adherence picture forming
- Month 3: meaningful trends emerging
- Month 6: Sage has real intelligence to share
- Year 1: full seasonal picture and genuine financial insights
- This is a feature, not a limitation. Communicate it as the value of staying subscribed.

---

## 5. SUBSCRIPTION TIERS

| Tier | Price | Recipe Limit | Meal Limit | Contributing Users |
|---|---|---|---|---|
| Free | $0 | 25 | 10 | 1 (admin only) |
| Plus | ~$4.99/mo | 100 | 50 | 3 |
| Premium | ~$9.99/mo | Unlimited | Unlimited | Unlimited |

**Family members are always unlimited across all tiers.**
The value is in contribution rights, not family member count.

**Planning horizon by tier:**
- Free: Next week only
- Plus: Up to 4 weeks in advance
- Premium: Unlimited advance planning

**Sage upsell pattern:**
Sage herself surfaces upgrade prompts contextually — never aggressively.
> 🌿 *"I can see a cold week coming and I have some perfect comfort food suggestions — this feature is available on Roux Plus. Want to unlock it?"*

**Lauren's account:** Premium permanently. She is the reason this app exists.

---

## 6. USER ROLES

| Role | Permissions |
|---|---|
| Admin | Everything. Final approver. Household owner. |
| Co-Admin | Full equal rights. Designated by admin. No approval needed. |
| Member Admin | Add/edit recipes, suggest meals. Plan changes need admin approval. |
| Member Viewer | View everything. Suggestions only. Always needs approval. |

**Important:** `founded_by` on households is immutable. Lauren founded the Hill household — that fact never changes regardless of role changes. Role is a status field (can change). `founded_by` is a historical fact (never changes). `owned_by` is the current operational owner and can change via an ownership transfer flow.

---

## 7. THE WEEKLY PLANNING WORKFLOW

Lauren's real Saturday morning process — the app should mirror this exactly:

**Tuesday/Wednesday:**
- Store ads drop
- Lauren checks Kroger, Publix
- Opens Roux, starts draft plan for next week
- Enters weekly proteins (simple table — protein, store, on sale yes/no, price)
- Rough meal ideas start forming
- Adds odds and ends to shopping list

**Thursday/Friday:**
- Fills in more meal slots
- Shopping list grows
- Sage makes suggestions based on proteins entered

**Saturday morning:**
- Draft already has proteins and rough meals
- Lauren refines, fills gaps, confirms meals
- Sage assists with remaining suggestions
- Shopping list finalized
- Plan published to family

**Week start:** Always Monday. Set during household setup. Immutable.
*(Other households may choose Sunday — week_start_day field on households)*

---

## 8. THE HILL FAMILY HOUSEHOLD DATA

### Household
- **Name:** The Hill Family
- **Location:** Hendersonville, Tennessee
- **Timezone:** America/Chicago
- **Week start:** Monday
- **Subscription:** Premium

### Preferred Grocery Stores
1. Kroger — primary
2. Publix — secondary
3. ALDI — occasional
4. Walmart — occasional
5. Target — occasional

### Household Preferences
- **Proteins eaten:** Beef, chicken, pork
- **Dietary style:** Meat focused — protein at every meal
- **Red meat frequency:** Once a week
- **Avoided proteins:** Fish, shellfish, lamb, venison, tofu, meat substitutes
- **Dietary restrictions:** None
- **Spice tolerance:** Mild (kids rule the spice level 😄)
- **Weeknight max cook time:** 30-60 minutes
- **Planning scope:** Weeknight dinners, meal prep, special occasions
- **Equipment:** Stand mixer, Instant Pot, slow cooker, cast iron skillet, food processor
- **Cuisine preferences:** American/comfort, Mexican/Tex-Mex, Italian, Mediterranean, BBQ/Southern
- **Adventurousness:** Mostly familiar with occasional new things
- **Meal values:** Quick weeknight wins, comfort food classics, kid approved

### Family Member Preferences
**Avery (16):**
- Dislikes: Red sauce
- Likes: Plain noodles

**Logan (12):**
- No specific restrictions noted yet

**Lucas (11):**
- Dislikes: Red sauce, noodles/pasta
- Likes: Hot dogs (strongly and repeatedly 😄)

**Lincoln (8):**
- Dislikes: Red sauce
- Likes: Plain noodles, simple preparations

**Autumn (6):**
- No specific restrictions noted yet

**Coco 🐾:**
- Is a dog. Does not eat from the meal plan.

### Household Traditions
| Tradition | Type | Day/Date | Hosted | Lead Days | Notes |
|---|---|---|---|---|---|
| Taco Tuesday | Weekly | Tuesday | No | 0 | Flexible on recipe |
| Pizza Movie Night | Weekly | Friday | No | 0 | Keep it simple for movie night |
| Birthday Meal | Annual | Per person | No | 7 | Birthday person chooses |
| Thanksgiving Dinner | Annual | Nov 4th Thursday | Yes | 14 | Turkey, green bean casserole, mashed potatoes + more |
| Christmas Dinner | Annual | December 25 | Yes | 21 | Ham, mashed potatoes, scalloped potatoes + more |

### Day Types
| Name | Description | Kids Home | Default Dinner Time | Color |
|---|---|---|---|---|
| School Day | Regular school day | No | 30-60 min | Blue |
| Weekend | Saturday or Sunday | Yes | Flexible | Green |
| No School Day | Kids home, no school | Yes | Flexible | Orange |
| Summer Day | Summer break | Yes | Flexible | Yellow |

**Default week mapping:**
- Monday-Thursday → School Day
- Friday → School Day (Movie Night tradition stacks on top)
- Saturday-Sunday → Weekend

---

## 9. THE RECIPE LIBRARY

### Pre-loaded Recipes (Hill Family)
The following recipes are pre-loaded into Lauren's library at launch. Full recipe data is in SAMPLE_DATA.md.

1. Buffalo Chicken Dip — credited to Brandee (personal contact)
2. Feisty Feta Dip — from scrambledandspiced.com
3. Loaded Baked Potato Soup — from melobites.com
4. Creamy Tortellini Soup — by Dan Pelosi, NYT Cooking
5. Lynn's Super Secret Fudge — family recipe, visibility: secret
6. Peanut Butter Balls — family recipe, Lauren's note on wax quantity
7. Macaroni and Cheese — Ree Drummond / Food Network
8. Homemade French Bread — by Amy Nash, houseofnasheats
9. Enchiladas De Pollo — family recipe
10. Chicken Piccata Sauce — partial recipe (sauce only)
11. Bagels — by Claire Saffitz, NYT Cooking

### Pre-loaded Meals
1. French Dip Night — Slow Cooker Roast (main, not swappable) + Homemade French Bread (bread, not swappable) + Simple Green Salad (side, swappable)

### Recipe Visibility Levels
- **secret** 🔒 — Only the adding user sees it (Lauren's hidden veggie recipes 😄)
- **household** 🏠 — Whole household sees it, not shareable externally
- **shareable** 🌿 — Can be shared with other households on request

### Recipe Import — How It Works
Lauren opens Add Recipe. A chat-style interface appears:
- Text box for paste or typing
- + button for photo or file attachment
- Sage reads whatever arrives and returns a structured recipe card
- Lauren reviews, tweaks, saves
- No format selection. No "how would you like to add this?" menu.
- Sage auto-fills: category, cuisine, method, difficulty, times, equipment, perishable flags
- Lauren provides: visibility, is_family_favorite, personal notes, credited_to

---

## 10. THE COMPLETE DATABASE SCHEMA

### Schema Principles
- All primary keys are UUIDs
- All tables have created_at timestamp
- All editable tables have updated_at timestamp
- Age is NEVER stored — always calculated from date_of_birth
- founded_by on households is immutable — set once at creation, never updated
- owned_by on households is the current owner — changes only via ownership transfer
- week_start_day on households is immutable — set once, never updated
- System handles all status transitions except Lauren's deliberate decisions

### Table 1: households
```sql
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  founded_by UUID REFERENCES users(id) ON DELETE SET NULL,   -- immutable historical record
  owned_by UUID REFERENCES users(id) ON DELETE RESTRICT,     -- current owner; transfer before delete
  invite_code TEXT UNIQUE NOT NULL,
  location TEXT,
  timezone TEXT DEFAULT 'America/Chicago',
  week_start_day TEXT DEFAULT 'monday' CHECK (week_start_day IN ('monday', 'sunday')),
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'plus', 'premium')),
  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 2: users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  family_member_id UUID REFERENCES family_members(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'member_viewer' CHECK (role IN ('admin', 'co_admin', 'member_admin', 'member_viewer')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 3: family_members
```sql
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  date_of_birth DATE,
  is_pet BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 4: family_member_preferences
```sql
CREATE TABLE family_member_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_member_id UUID NOT NULL REFERENCES family_members(id),
  household_id UUID NOT NULL REFERENCES households(id),
  preference_type TEXT NOT NULL CHECK (preference_type IN ('like', 'dislike', 'allergy', 'restriction', 'texture', 'note')),
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 5: household_preferences
```sql
CREATE TABLE household_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL UNIQUE REFERENCES households(id),
  proteins TEXT[] DEFAULT '{}',
  avoided_proteins TEXT[] DEFAULT '{}',
  dietary_style TEXT,
  red_meat_frequency TEXT,
  dietary_restrictions TEXT[] DEFAULT '{}',
  spice_tolerance TEXT DEFAULT 'mild' CHECK (spice_tolerance IN ('none', 'mild', 'medium', 'hot')),
  weeknight_max_time INTEGER DEFAULT 60,
  meal_planning_scope TEXT[] DEFAULT '{}',
  equipment TEXT[] DEFAULT '{}',
  cuisine_preferences TEXT[] DEFAULT '{}',
  adventurousness TEXT DEFAULT 'mostly_familiar',
  meal_values TEXT[] DEFAULT '{}',
  sweet_tooth BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 6: features
```sql
CREATE TABLE features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT UNIQUE NOT NULL,
  feature_name TEXT NOT NULL,
  description TEXT,
  min_tier TEXT NOT NULL CHECK (min_tier IN ('free', 'plus', 'premium')),
  category TEXT CHECK (category IN ('sage_aware', 'sage_helpful', 'sage_proactive', 'planning', 'social', 'limits')),
  limit_value INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 7: grocery_stores
```sql
CREATE TABLE grocery_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  location TEXT,
  is_primary BOOLEAN DEFAULT FALSE,
  ad_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 8: recipes
```sql
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  added_by UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  author TEXT,
  credited_to_name TEXT,
  credited_to_user_id UUID REFERENCES users(id),
  original_recipe_id UUID REFERENCES recipes(id),
  original_household_id UUID REFERENCES households(id),
  shared_by_user_id UUID REFERENCES users(id),
  last_notified_update TIMESTAMPTZ,
  source_type TEXT CHECK (source_type IN ('url', 'photo', 'manual', 'person', 'social', 'paste')),
  source_url TEXT,
  published_date DATE,
  photo_url TEXT,
  photo_credit TEXT,
  video_url TEXT,
  category TEXT,
  cuisine TEXT,
  method TEXT,
  diet TEXT[] DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'advanced')),
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  inactive_time_minutes INTEGER,
  total_time_minutes INTEGER,
  total_project_time TEXT,
  cook_temp_f INTEGER,
  servings TEXT,
  yield_description TEXT,
  equipment TEXT[] DEFAULT '{}',
  storage_instructions TEXT,
  personal_notes TEXT,
  variations TEXT,
  visibility TEXT DEFAULT 'household' CHECK (visibility IN ('secret', 'household', 'shareable')),
  is_family_favorite BOOLEAN DEFAULT FALSE,
  source_rating TEXT,
  times_planned INTEGER DEFAULT 0,
  times_cooked INTEGER DEFAULT 0,
  sage_assist_offered TEXT,
  sage_assist_status TEXT CHECK (sage_assist_status IN ('pending', 'accepted', 'declined')),
  sage_assist_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 9: ingredients
```sql
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  section_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  preparation_note TEXT,
  is_optional BOOLEAN DEFAULT FALSE,
  substitution TEXT,
  personal_note TEXT,
  linked_recipe_id UUID REFERENCES recipes(id),
  is_perishable BOOLEAN DEFAULT FALSE,
  perishable_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 10: instructions
```sql
CREATE TABLE instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  section_name TEXT,
  step_number INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  tip TEXT,
  step_photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 11: meals
```sql
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  is_saved BOOLEAN DEFAULT TRUE,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 12: meal_recipes
```sql
CREATE TABLE meal_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id),
  role TEXT CHECK (role IN ('main', 'side', 'bread', 'sauce', 'dessert', 'drink', 'other')),
  is_swappable BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 13: day_types
```sql
CREATE TABLE day_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  description TEXT,
  default_dinner_max_time INTEGER,
  default_dinner_complexity TEXT CHECK (default_dinner_complexity IN ('simple', 'normal', 'ambitious')),
  default_breakfast_style TEXT CHECK (default_breakfast_style IN ('quick', 'relaxed', 'special')),
  default_lunch_style TEXT CHECK (default_lunch_style IN ('school', 'home', 'leftovers', 'out', 'skip')),
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 14: household_traditions
```sql
CREATE TABLE household_traditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  tradition_type TEXT CHECK (tradition_type IN ('weekly', 'annual', 'occasional')),
  day_of_week TEXT,
  occasion_date DATE,
  occasion_month INTEGER,
  occasion_week TEXT,
  is_hosted BOOLEAN DEFAULT FALSE,
  expected_guest_count INTEGER,
  planning_lead_days INTEGER DEFAULT 0,
  is_flexible BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 15: tradition_recipes
```sql
CREATE TABLE tradition_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tradition_id UUID NOT NULL REFERENCES household_traditions(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id),
  is_required BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 16: meal_plans
```sql
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  created_by UUID NOT NULL REFERENCES users(id),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'active', 'completed', 'archived')),
  season_tag TEXT,
  notes TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 17: planned_meals
```sql
CREATE TABLE planned_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  prep_plan_id UUID REFERENCES meal_plans(id),
  day_of_week TEXT CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'other', 'meal_prep')),
  scope TEXT DEFAULT 'day' CHECK (scope IN ('day', 'week', 'weekday', 'weekend', 'meal_prep')),
  slot_type TEXT CHECK (slot_type IN ('meal', 'recipe', 'note', 'leftover', 'takeout', 'school_lunch')),
  meal_id UUID REFERENCES meals(id),
  recipe_id UUID REFERENCES recipes(id),
  note TEXT,
  day_type_id UUID REFERENCES day_types(id),
  tradition_id UUID REFERENCES household_traditions(id),
  prep_day TEXT,
  serves_members JSONB DEFAULT '[]',
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'prepped', 'cooked', 'skipped', 'leftover')),
  skip_reason TEXT CHECK (skip_reason IN ('no_time', 'changed_mind', 'sick', 'ate_out', 'leftovers', 'other')),
  skip_cost DECIMAL(10,2),
  sage_suggested BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 18: weekly_proteins
```sql
CREATE TABLE weekly_proteins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  protein_name TEXT NOT NULL,
  store_id UUID REFERENCES grocery_stores(id),
  is_on_sale BOOLEAN DEFAULT FALSE,
  sale_price DECIMAL(10,2),
  unit TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 19: shopping_lists
```sql
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'completed')),
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  unplanned_spend DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 20: shopping_list_items
```sql
CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  quantity TEXT,
  unit TEXT,
  category TEXT CHECK (category IN ('protein', 'produce', 'dairy', 'pantry', 'frozen', 'bakery', 'other')),
  source_type TEXT CHECK (source_type IN ('recipe', 'manual', 'recurring')),
  recipe_id UUID REFERENCES recipes(id),
  store_id UUID REFERENCES grocery_stores(id),
  estimated_price DECIMAL(10,2),
  is_purchased BOOLEAN DEFAULT FALSE,
  already_have BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT FALSE,
  is_perishable BOOLEAN DEFAULT FALSE,
  perishable_days INTEGER,
  use_by_date DATE,
  usage_status TEXT DEFAULT 'unused' CHECK (usage_status IN ('unused', 'used_in_plan', 'used_unplanned', 'wasted', 'still_have')),
  usage_confirmed_at TIMESTAMPTZ,
  carry_forward BOOLEAN DEFAULT FALSE,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 21: receipts
```sql
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  shopping_list_id UUID REFERENCES shopping_lists(id),
  store_id UUID REFERENCES grocery_stores(id),
  photo_url TEXT NOT NULL,
  receipt_date DATE,
  total_amount DECIMAL(10,2),
  sage_processed BOOLEAN DEFAULT FALSE,
  sage_processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 22: receipt_items
```sql
CREATE TABLE receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id),
  raw_text TEXT NOT NULL,
  matched_item_name TEXT,
  shopping_list_item_id UUID REFERENCES shopping_list_items(id),
  quantity DECIMAL(10,3),
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  is_matched BOOLEAN DEFAULT FALSE,
  match_confidence TEXT CHECK (match_confidence IN ('high', 'medium', 'low')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 23: price_history
```sql
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  store_id UUID REFERENCES grocery_stores(id),
  item_name TEXT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  unit TEXT,
  recorded_date DATE NOT NULL,
  source TEXT CHECK (source IN ('receipt', 'manual', 'sage_estimated')),
  receipt_item_id UUID REFERENCES receipt_items(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 24: suggestions
```sql
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  suggested_by_user_id UUID REFERENCES users(id),
  suggested_by_member_id UUID REFERENCES family_members(id),
  suggestion_type TEXT CHECK (suggestion_type IN ('meal', 'recipe', 'ingredient', 'occasion')),
  meal_id UUID REFERENCES meals(id),
  recipe_id UUID REFERENCES recipes(id),
  free_text TEXT,
  meal_plan_id UUID REFERENCES meal_plans(id),
  day_of_week TEXT,
  meal_type TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  responded_by UUID REFERENCES users(id),
  responded_at TIMESTAMPTZ,
  response_note TEXT,
  times_suggested INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 25: activity_log
```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  target_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 26: meal_plan_templates
```sql
CREATE TABLE meal_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  season_tag TEXT,
  source_plan_ids JSONB DEFAULT '[]',
  times_used INTEGER DEFAULT 0,
  auto_generated BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 27: template_meals
```sql
CREATE TABLE template_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES meal_plan_templates(id) ON DELETE CASCADE,
  day_of_week TEXT CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday','saturday','sunday')),
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'other', 'meal_prep')),
  scope TEXT DEFAULT 'day' CHECK (scope IN ('day', 'week', 'weekday', 'weekend', 'meal_prep')),
  slot_type TEXT CHECK (slot_type IN ('meal', 'recipe', 'note', 'leftover', 'takeout', 'school_lunch')),
  meal_id UUID REFERENCES meals(id),
  recipe_id UUID REFERENCES recipes(id),
  note TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 28: shared_plans
```sql
CREATE TABLE shared_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id),
  shared_by UUID NOT NULL REFERENCES users(id),
  share_type TEXT CHECK (share_type IN ('link', 'roux_user')),
  share_token TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table 29: household_follows
```sql
CREATE TABLE household_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_household_id UUID NOT NULL REFERENCES households(id),
  following_household_id UUID NOT NULL REFERENCES households(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 11. SHOPPING LIST — MOBILE EXPERIENCE

The shopping list must work perfectly when Lauren is standing in a store with her phone.

**Requirements:**
- Organized by store section — produce, meat, dairy, pantry, frozen, other
- If multiple stores — separate views of same master list filtered by store
- Large tap targets — checking off with one hand, cart in the other
- Checked items move to bottom or fade — stays clean while shopping
- Offline capable — no signal in freezer section cannot break the app
- Quantity clearly visible — "chicken breasts 4 lbs" not just "chicken breasts"
- Recipe context shown — "for French Dip Night"
- Location aware — if at Kroger, Kroger items shown first automatically

**Store sections (auto-categorized by Sage):**
1. 🥩 Meat & Protein
2. 🥬 Produce
3. 🧀 Dairy & Eggs
4. 🥫 Pantry & Canned
5. ❄️ Frozen
6. 🍞 Bakery & Bread
7. 🛒 Other / Household

---

## 12. UI PRINCIPLES

**Design direction:** Premium cookbook aesthetic. Clean, modern, polished. Food photography forward. Lots of white space. Not clinical — warm but refined.

**Color palette:** Warm and green tones. Modern interpretation. Final palette TBD during UI design phase. Do NOT reuse phase 1 colors.

**Typography:** Fraunces (headings) + DM Sans (body). Already in project.

**Responsive design:**
- Phone — single column, large touch targets, bottom navigation
- Tablet — two columns, sidebar navigation, more content visible
- Desktop — three columns, full sidebar, dashboard view

**Key UI moments:**
- Recipe card — feels like a premium cookbook page
- Weekly planner — visual, scannable, color-coded by day type
- Shopping list — clean checklist, optimized for one-handed phone use
- Sage conversations — chat-style, warm, not clinical

**Forms:**
- Multi-step with progress indicator
- Checkboxes and single-select for preferences
- Never open text fields for structured data
- Back and Next navigation
- Auto-save as Lauren fills in

**Sage UI presence:**
- Small 🌿 icon for Sage assists — not intrusive
- One-time offer banners — never popups
- Chat-style input for recipe import only
- Never a full-screen takeover

---

## 13. TECH STACK

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Supabase (auth + database + storage)
- **AI:** Anthropic Claude API — model: claude-sonnet-4-20250514
- **Hosting:** Vercel
- **Local dev:** localhost:3000
- **Project directory:** ~/src/meal-planner/roux-phase2

**Supabase credentials:** In .env file — do not hardcode anywhere.
**Anthropic API key:** In .env file — do not hardcode anywhere.

**Important model note:** Always use claude-sonnet-4-20250514. Do not change this.

---

## 14. WHAT NOT TO DO

- Do NOT rebuild the tutorial-heavy phase 1 approach
- Do NOT use Sage as the primary interface for structured data collection
- Do NOT store age — always calculate from date_of_birth
- Do NOT make Lauren manually manage status transitions
- Do NOT start building UI before schema is deployed and verified
- Do NOT use the old phase 1 color palette
- Do NOT over-engineer features before they're needed
- Do NOT add tables without documenting them here first
- Do NOT hardcode any API keys or credentials
- Do NOT run the old phase 1 supabase-schema.sql

---

## 15. DEVELOPMENT WORKFLOW

1. **Schema first** — always deploy and verify database before building UI
2. **Sample data second** — load Hill family data before building any features
3. **Git commits** — commit before every significant change. Commits are save points.
4. **Test with Lauren's actual data** — not placeholder data
5. **Mobile first** — build for phone, scale up to tablet and desktop
6. **CLAUDE.md updates** — update this file when significant decisions are made

### After every schema wipe and fresh deployment, run these grants:

```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
```

Without these, Postgres returns `42501 permission denied` before RLS even runs.
RLS policies control which **rows** each role can access — GRANTs control whether
the role can touch the **table** at all. These are two separate permission layers.
The grants are already included in `supabase-schema.sql` for fresh deployments,
but must be re-run manually after any wipe that doesn't use the full schema file.

---

## 16. NEXT STEPS (in order)

1. ✅ Complete database schema design — DONE
2. ⬜ Write and deploy new Supabase schema SQL
3. ⬜ Load Hill family sample data (see SAMPLE_DATA.md)
4. ⬜ Verify all foreign key relationships
5. ⬜ Build recipe library UI — the core feature
6. ⬜ Build recipe import with Sage (chat-style input)
7. ⬜ Build weekly planner UI
8. ⬜ Build shopping list with mobile optimization
9. ⬜ Build household setup flow (simplified — no heavy tutorial)
10. ⬜ UI design pass — premium cookbook aesthetic
11. ⬜ Responsive design — tablet and desktop

---

*This document represents weeks of careful product thinking. Every decision here was made deliberately. When in doubt — read this document before writing code.*
