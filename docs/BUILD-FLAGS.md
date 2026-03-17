# BUILD FLAGS & PROGRESS TRACKER
*Roux Phase 2 — Last updated March 13, 2026*

---

## Build Progress

- [x] Complete database schema design
- [x] Deploy Supabase schema SQL (30 tables, RLS policies, grants)
- [x] Load Hill family sample data (13 recipes via seed_recipes.sql)
- [x] Verify foreign key relationships
- [x] Build recipe library Phase 1 (card list + expanded view)
- [x] Design sprint complete (all prototypes approved, build notes complete)
- [ ] Build welcome / onboarding flow (5 screens — all prototypes approved)
- [ ] Build dashboard (cutting board design — prototype approved)
- [ ] Build This Week planner (prototype approved)
- [x] Build recipe library Phase 2 (2-col grid, search, filter, category pills — see SCREEN-SPECS.md)
- [x] Build recipe card Phase 2 (tabs, serves adjuster, Sage strip, Family Notes, pinned CTA)
- [x] Build shopping list (3-state flow — prototype approved)
- [ ] Build recipe import with Sage (chat-style input)
- [ ] Build household setup flow
- [ ] Wire "By Ingredient" search (currently dead tap — must fix before launch)
- [ ] Design child/view-only dashboard (required before onboarding ships)
- [ ] Responsive design — tablet and desktop

---

## ⚠ Must-Fix Before Go-Live

### 1. "By Ingredient" Shortcut — Dead Tap
The "By Ingredient" tile on the dashboard Quick Access and the Recipe Library currently go nowhere. Build the screen or replace with a working destination before launch.

### 2. Publish → Shopping List Handoff — Undesigned
When Lauren publishes the plan, the app must immediately surface a prompt to build the shopping list. The transition from This Week → Shopping List is the most important workflow handoff in the app. Currently undesigned at the transition moment.

### 3. Tonight Card Empty State — Board Must Always Show
The cutting board background must always be present regardless of plan status. Empty state = same wood grain + dashed groove + warm italic text. Never show a blank or unstyled container.

### 4. Recipe Library Results Count — Currently Static
The prototype shows "48 recipes" as a static string. Must update dynamically based on active filter and search state in the real build.

### 5. Child-Scoped Dashboard (View Only Role) — Not Designed
A child or "Just browsing" member landing on the full dashboard is a broken experience. Must be fully designed before the onboarding flow ships — the role exists in Screen 3b but the destination hasn't been designed.

### 6. Terms of Service Legal Line — Required
Required on Screen 3a and Screen 3b account creation steps before launch.
Copy: "By continuing you agree to our Terms of Service and Privacy Policy."
Style: 10–11px, `--driftwood` color, below the sign-up button.

### 7. Tonight Card — "Who's Cooking" Stat Missing
The Tonight card footer shows prep time only. The prototype has a second stat ("Aric cooking" + vertical divider). Requires an `assigned_to` field on `planned_meals` referencing `users`. Wire this during the This Week build — query and display the assigned member's first name in the tonight card at that time.

### 8. This Week — Day Type Badge Only Has School + Weekend
`getDayType()` in ThisWeek.jsx returns only `School` (Mon–Fri) or `Weekend` (Sat/Sun). The prototype defines 4 types: School (blue), Weekend (sage), No School (orange `#D4874A`), Summer (honey `#C49A3C`). Requires a `day_type` data source per day — likely a `household_schedule` table or a `day_type` field on `planned_meals` / `household_traditions`. Decide schema approach and implement when wiring the full This Week edit flow.

### 9. "Household" in UI Copy — Global Audit Required
All user-facing strings must use "home" not "household." Run a global find-and-replace across all JSX and string literals before launch. Database table names are unaffected.

### 10. Recipe Card — `family_notes` Field Missing from Schema
The recipe card spec calls for a `family_notes` field supporting multiple bulleted notes per recipe. The `recipes` table only has `personal_notes TEXT` (single string — currently used for the handwritten card note on the library grid card AND as a single Family Notes item in the recipe card). Before launch, add `family_notes TEXT[]` to the `recipes` table and migrate any data from `personal_notes` that is intended as family notes rather than the card subtitle note. Update the recipe card to query `family_notes` and render one starred item per array element.

### 11. Recipe Card — Favorite Toggle Uses Household-Level `is_family_favorite`
The favorite ★ button on the recipe card currently reads/writes `recipes.is_family_favorite` (a household-level boolean — everyone sees the same state). The spec requires a per-user favorites store. Add a `user_favorites` table: `(id UUID, user_id UUID REFERENCES users(id), recipe_id UUID REFERENCES recipes(id), created_at TIMESTAMPTZ, UNIQUE(user_id, recipe_id))` with RLS policy scoped to the authenticated user. Update the favorite toggle to INSERT/DELETE from `user_favorites` instead. The library grid card's `is_family_favorite` display can remain household-level or be migrated to user-level at the same time.

### 12. Shopping List — `shopping_lists.status` Values Mismatch
The schema defines `status CHECK (status IN ('draft', 'finalized', 'completed'))`. The Shopping List UI uses three states: Building / Shopping / Complete. The mapping used in ShoppingList.jsx is: `draft`→Building, `finalized`→Shopping, `completed`→Complete. This is correct and functional. However, the spec language says "Building" which maps to DB `draft` — not `building`. No column rename needed, but the mapping must stay consistent.

### 13. Shopping List — `shopping_list_items` Missing Several Expected Columns
The schema for `shopping_list_items` does NOT have the following columns that were referenced in the build spec or the prototype:
- **`is_checked`** — spec refers to this field. Actual column is `is_purchased`. ShoppingList.jsx uses `is_purchased` (correct).
- **`checked_at`** — spec refers to this field. Actual column is `purchased_at`. ShoppingList.jsx uses `purchased_at` (correct).
- **`got_it_at`** — referenced in spec. Does not exist. Omitted in build.
- **`aisle_section`** — referenced in spec. Actual column is `category` (with CHECK constraint: protein/produce/dairy/pantry/frozen/bakery/other). ShoppingList.jsx uses `category` (correct). Note: "deli" aisle section shown in the prototype and SCREEN-SPECS.md does NOT exist in the schema CHECK constraint — items with category `deli` would fail a DB insert. Add `'deli'` to the `category` CHECK constraint before using it.
- **`price_estimate`** — referenced in spec. Actual column is `estimated_price`. ShoppingList.jsx uses `estimated_price` (correct).
- **`store_name`** — referenced in spec. Actual is a FK `store_id` referencing `grocery_stores`. Store name requires a join. Store filter pills in Building state are currently display-only (no join implemented).
- **`is_staple`** — referenced in spec as recurring indicator. Actual column is `is_recurring`. ShoppingList.jsx uses `is_recurring` (correct).

**Action required before launch:** Add `'deli'` to the `shopping_list_items.category` CHECK constraint in `supabase-schema.sql` and redeploy if the Deli aisle section is needed.

### 14. Shopping List — Store Filter Pills Not Functional
The store filter pills (All / Kroger / Costco) in the Building state topbar are display-only. Filtering by store requires either: (a) joining `shopping_list_items` with `grocery_stores` to get store names, or (b) storing a denormalized `store_name` TEXT on items. The store_id FK approach requires a second query or a Supabase join. Wire this properly when the grocery stores table is populated.

---

## Database & Data Gaps

*Identified during full database audit — March 14, 2026.*

### Must Fix Before Inviting Users Outside Hill Household

- [ ] **Add Protein flow** — the "+ Add protein" button on This Week exists but does nothing. Build a bottom sheet with: protein name field, store dropdown (pulls from `grocery_stores` table), on-sale toggle, price field. Writes to `weekly_proteins` table.
- [ ] **`family_members` management UI** — family members are seeded for the Hill family but there is no UI to add, edit, or remove family members. Needed for: Who's cooking on Tonight card, per-member dietary preferences, child dashboard scoping, assigned cook on planned meals. Build in Profile/Settings screen.
- [ ] **`activity_log` writes** — zero activity being logged. Sage pattern intelligence depends entirely on this table. Add fire-and-forget INSERT to `activity_log` on these key actions: publish plan, add meal to plan, skip/remove meal, complete shopping, save recipe. Each entry needs: `user_id`, `household_id`, `action_type`, `entity_id`, `entity_type`, `created_at`.
- [ ] **`invite_codes` table** — returned a query error during audit. Investigate whether table exists with correct schema and RLS policy. Needed before invite flow is built.

### Build After `family_members` UI Is Complete

- [ ] **`family_member_preferences` UI** — per-person food preferences, allergies, dislikes, favorites. Blocked by `family_members` management UI.
- [ ] **Who's cooking on Tonight card and planned meal cards** — requires `assigned_to` field on `planned_meals` to be wired to `family_members`. Currently flagged as BUILD-FLAGS #7.

### Post-MVP

- [ ] **`notifications` table** — notification system not yet built. Required before archival confirmation flow and Sage nudge delivery system.
- [ ] **`day_types` table normalization** — currently day types stored as JSON strings in `meal_plans.notes`. Normalize to proper FK relationship with `day_types` table when schema cleanup sprint happens.
- [ ] **`meal_tags`, `meal_plan_rules` tables** — returned query errors during audit. Investigate and either build out or remove from schema if no longer needed.
- [ ] **`family_members.role` stored in `notes` field as workaround** — add a proper `role TEXT` column to `family_members` table in a future schema cleanup sprint. When added, migrate existing role data from `notes` to the new column.
- [ ] **Custom email domain for Supabase transactional emails** (password reset, invite notifications) — configure when Roux domain is purchased. Setting lives in Supabase Dashboard → Authentication → SMTP Settings. Suggested sender: `hello@[domain]` or `sage@[domain]`.

---

## ⚑ Planned But Not Yet Built

- ~~**Shopping list screen**~~ — ✅ Built. Three-state flow (Building/Shopping/Complete), budget strip with inCartPulse animation, Got It / Already Have actions, aisle sections, Sage nudge strip, Complete card with receipt CTA, bottom nav. See schema gaps in items 12–14 above.
- **"By Ingredient" search flow** — full screen design required before this can be built.
- **Template picker / Repeat this week flow** — high-retention feature, post-MVP.
- **Settings screen** — splits into two sections:
  - **My Account** (personal): name, email, password, notification preferences, haptics toggle
  - **Our Kitchen** (household): family members, grocery stores, traditions, dietary preferences, invite code generation, decoration set selection
  - Grocery store management: inline store addition from any store dropdown is built (protein roster, shopping list). Full store list management (edit, delete, set primary) lives in Our Kitchen section.
- **Related recipes on recipe card** — "Goes Well With" section. Invest properly, not a placeholder row.
- **Avery (child) dashboard** — scoped view-only experience. Must be designed before onboarding ships.
- **Profile photos** — users should be able to add a profile photo that appears in the avatar circle instead of their initial. Applies to all household members. Photos stored in Supabase Storage. Avatar displays photo if available, initial as fallback. Build when Profile screen gets its second design pass.
- **Notifications screen** — full notification center at `/notifications`. Bell icon in topbar routes here. Two tabs: Action Required and Informational. Notification types: meal plan archived (needs confirmation), new member joined via invite code, week published (family members notified), Sage observations and nudges, birthday reminders. `notifications` table exists in schema but nothing is writing to it yet — wire `activity_log` and notification writes together in same sprint.
- **Sage screen at `/sage`** — currently placeholder. Full design required. Direct conversation interface with Sage — not a search bar. Lauren asks questions, gets suggestions, searches by ingredient or occasion. Premium feature. Search icon in topbar routes here.
- **Color scheme user-level override** — currently household level. Future: each user picks their own scheme, stored in `user_preferences`. Household scheme is the default, user override takes precedence.
- **Walnut Tonight card variant** — wood grain CSS needs a dark walnut color variant distinct from the blonde maple Garden treatment.
- **Serves adjuster with quantity scaling** — affects the data model. Plan this early in the recipe card build.
- **Welcome screen recipe box illustration** — the ghost recipe box SVG in the lower right corner of the welcome screen is a nice decorative element. This should become part of the watermark/decoration object system and appear on other screens as part of the active seasonal set. Wire it into WatermarkLayer so it rotates with the season like the other objects. Currently only exists on the welcome screen.
- **Invite flow font audit** — the invite flow screens (code entry, invitation card, role selection, account creation, pending approval) should use the same Playfair Display / Jost / Caveat font system as the rest of the app. Do a font audit of WelcomeScreen3b.jsx and PendingApprovalScreen (in App.jsx) and ensure typography matches the design system exactly — no default browser fonts or inconsistent weights.
- **Plan a Meal screen** (`/meals/plan`) — currently routes to Sage placeholder. Full design required. Build a meal composition screen where Lauren selects a recipe, names the meal, and assigns it to a day/slot. This is the primary action from the Meals hub.
- **Traditions screen** (`/meals/traditions`) — currently routes to Sage placeholder. Should show household_traditions data with add/edit/delete. Links to WeekSettings traditions section but as a standalone browsable list.

---

## ⚑ Roadmap — Post-MVP Features

- **Multiple shopping lists per week** — one-to-many relationship between `meal_plans` and `shopping_lists`. Each list has its own receipt capture. Budget and utilization aggregate across all lists for the week.
- **Week header shopping badge** — updated to show list count and total spent across all trips. Tappable to show all trips for the current week.
- **Sage observational nudge after 3 skips** — when the same meal is skipped 3 times, Sage surfaces a nudge: *"Hey Lauren — [meal] has been skipped three times now. Worth keeping on the rotation?"* Requires skip tracking on `planned_meals` with `recipe_id` aggregation.
- **Sage full week planning** — unlocks after 50 archived meals. Sage proposes a complete week plan based on learned family preferences. Introduced as *"I think I know your family well enough now to try something"* — not a feature announcement. Lauren reviews and approves; Sage never auto-publishes.

---

## Sage Cost Estimation & Spending Snapshot

### Dashboard Integration

The spending snapshot section on the Dashboard (Estimated / Spent / Used %) is the primary surface where cost estimation activates. These are not separate features — they are the same feature in two states:

**State 1 — Pre-activation (fewer than 6 receipted shopping trips):**
- Spending snapshot shows a warm empty state
- Copy: *"I'm learning your family's shopping patterns. [X] of 6 shopping trips tracked — almost there."*
- Subtle progress indicator showing trips captured vs 6 trip threshold
- Spent figure can still show actual receipt totals even before full activation
- Estimated and Used % remain blank until threshold is met

**State 2 — Active (6+ receipted shopping trips, Premium tier):**
- Estimated: auto-populated by Sage from planned meals × price history
- Spent: pulled from captured receipts as before
- Used %: utilization calculation from planned vs purchased ingredients
- Variance chip activates: green when under estimate, amber when approaching, never red
- Sage insight line below the three figures: trend observations after sufficient history
- Example: *"You're averaging $247/week, down $18 from last month"*

### Progression of Sage Insight Line Over Time

- **Weeks 6–8:** *"Nice work tracking your spending — I'm building your price history"*
- **Weeks 8–12:** Basic estimated vs actual comparison
- **Month 3+:** Trend observations and pattern insights
- **Month 6+:** Predictive suggestions — *"Weeks with 5+ planned meals average $34 less in spending"*

### Design Principle

The spending snapshot is the single most powerful retention feature in the app — it gets more valuable every week Lauren uses Roux. Every design and build decision around it should protect that compounding value.

---

## Subscription Tiers — Roadmap

*To be enforced before opening app beyond Hill family household. Build `useSubscription()` hook as a focused sprint at that time.*

### Tier Definitions (Locked)

**Free**
- Recipe library — up to 25 recipes
- Basic weekly meal planning — dinner slot only
- Manual shopping list — no auto-generation
- One household member
- No Sage AI
- No budget tracking

**Plus**
- Unlimited recipes
- Full weekly planning — all meal slots, day types, traditions
- Shopping list auto-generation from meal plan
- Basic spending tracking — estimated vs spent
- Up to 5 household members
- Sage reactive suggestions — on demand only
- No receipt capture
- No utilization tracking

**Premium**
- Everything in Plus
- Unlimited household members
- Sage AI nudges, observational notes, and proactive suggestions
- Full budget intelligence — estimated vs spent vs utilization
- Receipt capture and price history
- Multiple shopping lists per week
- Week templates — save and apply
- Spending trend analysis — unlocks after 4 weeks
- Sage full week planning — unlocks after 50 archived meals
- Seasonal decoration sets — custom selection
- Sage skip pattern detection — flags meals skipped 3+ times

### Implementation Plan (When Ready)

**Step 1 — `useSubscription()` hook**
- Lives in `src/hooks/useSubscription.js`
- Reads `subscription_tier` from `users` table for current logged-in user
- Returns: `tier` string, `isPremium()`, `isPlus()`, `isFree()`, `canUse(featureName)`
- `canUse()` checks a feature map object — single source of truth for what each tier can access
- Must be lightweight — reads from `appUser` already in context, no extra DB call

**Step 2 — Gated component pattern**
- Premium-only features render with a soft lock overlay when tier doesn't match
- Never hide features entirely — show them locked with upgrade prompt
- Upgrade prompt copy: *"This is a Premium feature. Upgrade to unlock Sage's full intelligence."*
- Warm, never pushy — one tap to learn more, easy to dismiss

**Step 3 — Enforcement touchpoints**

Apply `useSubscription()` check to these specific components:
- Sage nudges and suggestions — Premium only
- Spending snapshot utilization % — Premium only
- Receipt capture flow — Premium only
- Multiple shopping lists — Premium only
- Week templates — Premium only
- Sage full week planning — Premium only + 50 meal threshold
- Spending trend analysis — Premium only + 4 week threshold
- Recipe library beyond 25 — Plus and above
- Shopping list auto-generation — Plus and above
- Sage reactive suggestions — Plus and above

**Step 4 — Stripe integration**
- Not planned for Phase 1
- Lauren is permanently Premium — hardcoded in her user record
- Payment infrastructure to be designed as a separate sprint
- For now: tier is set manually in Supabase `users` table

### Current Status

- `subscription_tier` field exists on users/households table ✓
- Lauren Hill set to Premium permanently ✓
- `useSubscription()` hook — **NOT YET BUILT**
- Enforcement layer — **NOT YET BUILT**
- Upgrade prompt UI — **NOT YET DESIGNED**
- Stripe integration — **NOT PLANNED YET**

### Trigger to Build

Build the enforcement layer as a focused sprint immediately before inviting any non-Hill-family users to the app.

---

## Architecture Decisions (Locked)

- **Cutting board Tonight card** — confirmed default. Forest green Tonight card variant is retired.
- **Invite code lookup** — server-side only. Never expose invite table to client. Single-use, 7-day expiry.
- **Session persistence** — valid Supabase session bypasses welcome screen entirely. Never flash auth screens for logged-in users.
- **Sage nudges in Shopping state** — Sage strip is hidden during active shopping (Shopping and Complete states). Nudges in Building state only.
- **Got It vs. Already Have** — these are two distinct actions with different spend tracking implications. Never collapse them into a single "check off" action.
- **WatermarkLayer** — build core layout first, add watermark last. Never block layout work on decoration.
- **Haptic feedback** — OFF by default. User toggle in profile settings. iOS Safari fails silently — no error, no fallback UI.
- **Week start day** — Monday, set at household creation. Immutable.
- **founded_by on households** — immutable historical record. Never update it.
- **Cutting board Tonight card per scheme** — kept on Garden and Walnut schemes, solid card on Slate and Midnight. This is intentional and permanent per scheme design.
- **Nav order** — Home / This Week / Recipes / Sage / Shopping — locked March 2026. Sage moves to center (position 3) only when Sage feature set is substantially complete.
- **Quick items stored as recipes** — all non-recipe items (store bought rolls, cereal, rotisserie chicken) are stored as recipes with `recipe_type = 'quick'` (default is `'full'`). This enables cost tracking, autofill, and usage history across all items. Locked March 2026.
- **Meal component alternatives** — each recipe slot in a meal can have alternative options stored in `meal_recipe_alternatives`. When a meal with alternatives is added to the week, Lauren picks which option to use that week. `last_used_at` tracks the most recent choice for smart defaults.

---

## Design Decisions — Pending

- **Day type badge redesign** — current colored pills feel too generic for the Roux aesthetic. Redesign direction: small contextual icon + Caveat handwritten label inside a warm stamp/tag shape. Applies to three surfaces: This Week day row header badges, Week Settings day type selector pills, and the active badge display. Full prototype to be provided before build. Do not change current implementation until spec is delivered.
