# BUILD FLAGS & PROGRESS TRACKER
*Roux Phase 2 — Last updated March 18, 2026*

---

## Build Progress

- [x] Complete database schema design
- [x] Deploy Supabase schema SQL (30+ tables, RLS policies, grants)
- [x] Load Hill family sample data (13 recipes via seed_recipes.sql)
- [x] Verify foreign key relationships
- [x] Build recipe library Phase 1 (card list + expanded view)
- [x] Design sprint complete (all prototypes approved, build notes complete)
- [x] Build recipe library Phase 2 (2-col grid, search, filter, category pills)
- [x] Build recipe card Phase 2 (tabs, serves adjuster, Sage strip, Family Notes, pinned CTA)
- [x] Build shopping list (3-state flow — manual items, aisle sections, budget strip)
- [x] Build Meals hub (two-zone layout — action tiles + archive counters + tagline strip)
- [x] Build Plan a Meal (recipe picker, alternatives, quick add, autofill, edit mode)
- [x] Build Saved Meals (list with search, tap to edit, Add to plan)
- [x] Build This Week / week view (collapsible day cards, four slots, multi-item, autofill, nav boundary, fixed header)
- [x] Build Week Settings — two-screen architecture (This Week Settings + Household Defaults)
- [x] Build AddToPlanSheet (reusable week/day/slot picker with calendar)
- [x] Build AddDayTypeSheet (reusable, used in both settings screens)
- [ ] Build welcome / onboarding flow (5 screens — all prototypes approved)
- [ ] Build dashboard improvements (spending snapshot, Sage nudge, "By Ingredient" destination)
- [x] Build Save a Recipe flow (Photo capture + URL extraction + Manual entry, Sage ingredient review on save)
- [ ] Build Traditions screen (`/meals/traditions`) — schema live, routes to placeholder
- [ ] Build Sage screen (`/sage`) — placeholder only
- [ ] Build Settings screen (My Account + Our Kitchen)
- [ ] Build family members management UI
- [ ] Build shopping list auto-generation from week plan
- [ ] Build slot-to-slot move
- [ ] Build tradition slot picker workflow
- [ ] Wire activity log writes (Sage intelligence blocked)
- [ ] Wire "By Ingredient" search (currently dead tap)
- [ ] Design child/view-only dashboard (required before onboarding ships)
- [ ] Build tier enforcement layer (`useSubscription()` hook)
- [ ] Responsive design — tablet and desktop

---

## ⚠ Must-Fix Before Go-Live

### 1. "By Ingredient" Shortcut — Dead Tap
The "By Ingredient" tile on the dashboard Quick Access and the Recipe Library currently go nowhere. Build the screen or replace with a working destination before launch.

### 2. Publish → Shopping List Handoff — Undesigned
When Lauren publishes the plan, the app must immediately surface a prompt to build the shopping list. The transition from This Week → Shopping List is the most important workflow handoff in the app. Currently undesigned at the transition moment.

### 3. Tonight Card Empty State — Board Must Always Show
The cutting board background must always be present regardless of plan status. Empty state = same wood grain + dashed groove + warm italic text. Never show a blank or unstyled container.

### 4. Recipe Library Results Count — ✅ RESOLVED
Meals hub archive tiles show live counts (recipes, meals, traditions) that refresh on window focus. Recipe library grid count may still need verification against active filter state.

### 5. Child-Scoped Dashboard (View Only Role) — Not Designed
A child or "Just browsing" member landing on the full dashboard is a broken experience. Must be fully designed before the onboarding flow ships — the role exists in Screen 3b but the destination hasn't been designed.

### 6. Terms of Service Legal Line — Required
Required on Screen 3a and Screen 3b account creation steps before launch.
Copy: "By continuing you agree to our Terms of Service and Privacy Policy."
Style: 10–11px, `--driftwood` color, below the sign-up button.

### 7. Tonight Card — "Who's Cooking" Stat Missing
The Tonight card footer shows prep time only. The prototype has a second stat ("Aric cooking" + vertical divider). Requires an `assigned_to` field on `planned_meals` referencing `users`. Wire this during the This Week build — query and display the assigned member's first name in the tonight card at that time.

### 8. This Week — Day Type System — ✅ RESOLVED
Day types now use `meal_plan_day_types` table with FK to `day_types`. Household defaults stored in `household_weekly_pattern`. New week plans auto-apply defaults. All four types (School, Weekend, No School, Summer) supported. Day type pills are typographic only — no emoji. Two-screen Week Settings built.

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

## Schema Notes

### Traditions — Occurrence Model (added Mar 17, 2026)

Traditions use an occurrence-based data model. Two new tables are live in Supabase:

- **`tradition_occurrences`** — each time a tradition happens. Has a `date`, `label`, `notes`, and `is_sealed` flag that locks it as history once passed.
- **`tradition_occurrence_meals`** — what was cooked at each occurrence. Links to `meal_id` or `recipe_id`. Has `is_anchor` boolean so meals can be promoted to permanent anchors from any occurrence.

**Model summary:**

- A **Tradition** is the thing itself (Christmas Dinner, Taco Tuesday)
- An **Occurrence** is each time it happens (Christmas 2025, Taco Tuesday Mar 18)
- **Anchor meals** (in `tradition_meals`) pre-populate each new occurrence as a starting point
- **Occurrence meals** are what was actually cooked — anchors plus anything added for that occasion
- **First-time flow:** no history → build first occurrence from scratch
- **Returning flow:** show last occurrence → start from anchors → add and swap freely
- `is_flexible` on `household_traditions` distinguishes recurring traditions (Taco Tuesday) from occasion traditions (Christmas Dinner)

**Do not build the Traditions UI yet.** Schema is protected for future build.

### Day Types — Default Set Correction (Mar 17, 2026)

The four default day types seeded per household are: **School Day**, **Weekend**, **No School**, **Summer**. Holiday was removed — occasions belong in Traditions, not Day Types. The codebase (WeekSettings.jsx, ThisWeek.jsx, Dashboard.jsx) already uses this correct set. PRODUCT-TIERS.md updated to match.

### Occasion Traditions — Auto-Scheduling (Mar 17, 2026)

*Schema supports this fully. Do not build the UI yet — document so the week view build accounts for it.*

When a week plan is created or loaded, the app should check `household_traditions` for any rows where `tradition_type = 'occasion'` and the tradition's date falls within that week.

**Date matching rules:**

- **Fixed date:** `occasion_month` + `occasion_date` matches a date in the week (e.g. July 4th)
- **Relative date:** `occasion_week` + `occasion_month` logic (e.g. fourth Thursday in November)
- **Lead time:** if `planning_lead_days > 0`, surface the tradition that many days before the occasion date

**When a match is found, auto-populate the day in the plan with:**

- The tradition's anchor meals pre-loaded into that day's `planned_meals`
- A honey-colored tradition label displayed above the meal list for that day in the week view
- If a previous occurrence exists (`tradition_occurrences`), surface a Sage-style nudge: *"Last [occasion name] you made [X meals]. Want to start from there?"*

### Week View — Day Cards (Mar 18, 2026)

- Day cards are **collapsible by default**. Today's card auto-expands. All others collapsed showing item count summary.
- **Four active slots per day:** Breakfast, Lunch, Dinner, Everything else (`other` in DB). `snack` exists in DB constraint but has no UI slot. `meal_prep` hidden until future build.
- **All slots support multiple items.** Each item is either a `meal_id`, `recipe_id`, or freeform text saved as a `recipe_type = 'quick'` record.
- **Freeform slot items use autofill** — queries existing `recipe_type = 'quick'` recipes by `ILIKE`. Deduplicates on save via find-or-create pattern.
- **Slot items are fully tappable** — tap to change or remove. No circle icon. Min 44px tap target.
- **Slot label mapping:** `breakfast` → "Breakfast", `lunch` → "Lunch", `dinner` → "Dinner", `other` → "Everything else". Never show raw DB values.
- **"Apply to other days" prompt** shows all 7 days — not filtered by empty slots (slots support multiple items).
- **Back navigation boundary:** cannot navigate before `households.created_at`. Message at boundary: *"This is where it all started."*
- **Forward navigation:** unrestricted.
- **Week navigation arrows** are absolutely positioned — never shift regardless of content.
- **Week header:** fixed three-row layout — PAST/THIS/NEXT WEEK label, date range, metadata row (status pill + template pill + status message). Fixed height always.
- **Day type pills:** typographic only, no icons or emoji. Color from `day_types.color` field. 10% opacity background.
- **Day/day type columns** use fixed-width two-column layout for alignment: left column `min-width: 120px`, date number `min-width: 24px` right-aligned.

### Week Settings — Two Screen Architecture (Mar 18, 2026)

- **Screen 1:** This Week Settings (`/week-settings`) — day type assignments for this week only, relevant traditions (recurring + annual within 14 days), template apply/preview/undo, save as template, reset to defaults, link to Screen 2.
- **Screen 2:** Household Defaults (`/week/defaults`) — default weekly pattern (saves to `household_weekly_pattern`), manage day types (list + add via `AddDayTypeSheet`), manage templates (list + delete).
- **Template selection uses preview/confirm pattern** — visual preview first (day types change in UI), database write only on "Apply." "Undo" restores snapshot. Tapping an already-applied template offers removal + reset to defaults.
- **`+ Add a day type`** accessible from both screens via shared `AddDayTypeSheet` component.
- **Day types sorted A–Z** everywhere they appear in the app.
- **Templates sorted A–Z** everywhere they appear.

### Day Types (Mar 18, 2026)

- **Universal household defaults at creation:** Weekday (Mon–Fri) and Weekend (Sat–Sun) only. No school-specific types seeded by default.
- **Hill House additionally has:** School Day, No School, Summer — household-specific, invisible to all other households.
- All day types scoped to `household_id` — same table, siloed data, RLS enforced.
- **Default weekly pattern** stored in `household_weekly_pattern` table — one row per day per household.
- **Hill House default pattern:** School Day Mon–Fri, Weekend Sat–Sun.
- **Per-week day type assignments** stored in `meal_plan_day_types` — separate from household defaults.
- **New week plans auto-apply household default pattern** on creation.
- Changing a day type on the current week only changes `meal_plan_day_types` for that week, not the household default.

### Slot-to-Slot Move — Not Yet Built (Mar 18, 2026)

When a meal is placed in a slot, Lauren should be able to move it to a different slot on the same day. Opens a simple slot picker: *"Move to — Breakfast / Lunch / Dinner / Everything else."* Updates `meal_type` on the `planned_meals` row. No remove-and-re-add required. **Spec documented, UI not built yet.**

### Tradition Auto-Population — Slot Default (Mar 18, 2026)

When a tradition is applied to a day (manually or via auto-scheduling), its anchor meals default to the `other` slot ("Everything else"). Lauren moves them to the correct slots. Do not attempt to guess the right slot.

### Birthday Traditions — Auto-Creation (Mar 18, 2026)

Birthday traditions are auto-created for all non-pet family members: `tradition_type = 'annual'`, `planning_lead_days = 7`. When a new family member is added with a `date_of_birth`, a birthday tradition should be auto-created at that time.

### Tradition Auto-Scheduling on Week View — Not Yet Built (Mar 18, 2026)

Traditions must be applied via the slot picker which creates a `planned_meals` row with `tradition_id`. Do not auto-display traditions based on `day_of_week` matching alone. The previous auto-display shortcut has been removed.

### Pantry Items — Ingredient Dictionary (Mar 19, 2026)

- `pantry_items` table is live — 76 items seeded from existing Hill House recipe ingredients
- `ingredients.pantry_item_id` FK is live — all existing ingredients linked to pantry items
- Every ingredient saved via Edit Recipe is linked to a pantry item (find-or-create on save)
- Pantry items are the foundation for shopping list consolidation and future pantry management
- **Future:** `always_on_hand` flag on pantry items — Lauren marks staples, shopping list skips them automatically
- Unit field uses a fixed picker — Volume (tsp, tbsp, cup, fl oz, ml, l), Weight (oz, lb, g, kg), Count (piece, clove, can, etc.), Other (to taste, as needed). No freeform.
- Ingredient name autofills from household's pantry items via `ILIKE` query, min 2 chars, 6 suggestions max
- New ingredient names auto-create pantry items on save with the selected unit as `default_unit`

### Recipe Library — Refined (Mar 19, 2026)

- Quick items (`recipe_type = 'quick'`) correctly filtered from library — **RESOLVED**
- FAB pattern: forest green circle, 56px, fixed bottom-right above nav. Replaces full-width "Save a Recipe" button.
- Filter sheet: all filters behind filter icon in search bar. Active filter summary line when filters applied. "Show recipes" CTA + "Clear all" link.
- Category labels: dynamic from actual recipe data, sorted A–Z. No hardcoded pill list.
- Card hierarchy: name 17px Playfair dominant, category pill whisper style (transparent bg, `0.5px solid #C4B8A8`, driftwood text)
- Warm header: *"N recipes from your kitchen"* in Playfair italic 14px driftwood. Updates to *"N recipes match"* when filtered/searching.
- Dietary legend footer removed — covered by filter sheet.

### Recipe Detail Screen — Redesigned (Mar 19, 2026)

- Hero: 44px collapsed slim bar when no `photo_url` (category pill only). 220px full height with photo (dark gradient overlay for pill readability).
- Stat row: SVG icons only (clock, flame, people, signal bars) — no emoji.
- Serves adjuster: stateless calculator — labeled *"Adjust to scale ingredients"*. Saves nothing to DB.
- Serving selection for planning: lives in AddToPlanSheet as Step 4 "Feeds" — saves to `planned_meals.serves_members`.
- Edit recipe: link at bottom of detail → `/recipe/:id/edit`.
- Sage ingredient review: amber nudge below title when `sage_assist_status = 'pending'`.

### Edit Recipe Screen — Built (Mar 19, 2026)

- Route: `/recipe/:id/edit`. Back arrow → recipe detail.
- Full editor: photo upload (Supabase Storage), recipe name, description, author, source URL, category (dynamic pills + freeform), cuisine, method (6 pills), difficulty (3 pills), prep/cook time, servings.
- Ingredients: pantry autofill, unit picker, add/remove rows.
- Instructions: numbered steps, add/remove, auto-renumber.
- Notes: personal notes (Caveat font), variations.
- Save: upserts recipe + delete/re-insert ingredients and instructions. Fires Sage ingredient review async.

### Save a Recipe Flow — Built (Mar 20, 2026)

- Route: `/save-recipe`. FAB on recipe library navigates here.
- Three entry methods: Photo capture (primary), URL extraction, Manual entry (softly discouraged).
- **Photo capture** supports multiple photos (up to 6) — front/back of index cards, multi-page cookbook recipes. Horizontal scrollable thumbnail row with remove (×) on each. "Primary" badge on first photo.
- All photos sent to Sage (Sonnet, runtime-configurable via `getSageModel()`) in a single API call as multiple image content blocks. Multi-photo system prompt instructs Sage to combine ingredients/instructions across all images.
- **URL extraction** — paste a URL, Sage extracts structured recipe data via Sonnet.
- **Manual entry** — blank form, same fields as Edit Recipe.
- Extracted data pre-fills a review form. Sage confirmation strip: "Sage filled in what she could."
- Save: INSERTs recipe with `source_type` ('photo'/'url'/'manual'), creates pantry items, inserts ingredients/instructions.
- **Photo storage:** After save, all captured photos uploaded permanently to Supabase Storage at `recipe-photos/{household_id}/{recipe_id}/`. Rows inserted to `recipe_photos` table with `sort_order`, `is_primary` (first photo), `source_type = 'camera'`. First photo also set as `recipes.photo_url` for backward compatibility.
- Fire-and-forget `runSageIngredientReview()` after save.

### Recipe Photos (Mar 20, 2026)

- `recipe_photos` table live. Multiple photos per recipe supported.
- Stored permanently in Supabase Storage at `recipe-photos/{household_id}/{recipe_id}/`.
- Primary photo (`is_primary = true`) drives hero display on recipe detail.
- Secondary photos show as horizontally scrollable thumbnail strip below hero. Tappable for full-size lightbox view.
- `recipes.photo_url` is now legacy — new recipes use `recipe_photos` table exclusively. Existing recipes still read `photo_url` as fallback.
- RLS: `recipe_photos` accessible via recipe household ownership (`get_my_household_id()` through recipes join).

### Sage Ingredient Review (Mar 19, 2026)

- **Async background call** after every recipe save (new or edit). Fire-and-forget — save completes immediately for the user.
- Uses `claude-haiku-4-5-20251001` — fast and cost-efficient. Does **not** count against `sage_usage` limits.
- Reviews ingredient list for consistency issues: ambiguous units, vague quantities, duplicated ingredients expressed differently.
- Results saved to `recipes.sage_assist_content` (JSON array), `sage_assist_status` set to `'pending'`, `sage_assist_offered` set to timestamp.
- If no issues found — empty array, no notification, no DB write.
- On recipe detail: amber nudge appears when `sage_assist_status = 'pending'`. Opens a review sheet where Lauren accepts or dismisses each suggestion.
- Accepting updates the ingredient row in the database. All resolved → `sage_assist_status` set to `'resolved'`, nudge disappears.
- Columns `sage_assist_content`, `sage_assist_status`, `sage_assist_offered` already existed on the `recipes` table. `sage_assist_status` CHECK constraint updated to include `'resolved'`.

### Weekly Proteins — Tier Placement (Mar 18, 2026)

Basic weekly protein entry (protein name per week plan) is a **Free** feature. Sale price tracking, spending trends, Sage protein suggestions — **Premium**.

### Schema Added Mar 17–18, 2026

- `meal_plan_day_types` — per-day day type assignments per week plan (`UNIQUE(meal_plan_id, day_of_week)`)
- `meal_plan_traditions` — active traditions per week plan (`UNIQUE(meal_plan_id, tradition_id)`)
- `household_weekly_pattern` — default day type per day of week per household (`UNIQUE(household_id, day_of_week)`)
- `meal_plans.template_id` — proper FK to `meal_plan_templates`, replacing `notes` JSON workaround
- `meal_recipe_alternatives` — alternative recipe options per meal component slot
- `recipes.recipe_type` — `'full'` or `'quick'` (quick items stored as recipes for cost tracking)
- `recipes.status` — `'draft'` or `'complete'`

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
- [x] **`day_types` table normalization** — ✅ RESOLVED. Day types now stored in `meal_plan_day_types` table with FK to `day_types`. `meal_plans.notes` JSON workaround fully replaced.
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
- **Recipe multiple photos** — future build. Requires a `recipe_photos` table (`recipe_id`, `url`, `sort_order`, `caption`). Single `photo_url` on the `recipes` table is the current implementation.
- **Welcome screen recipe box illustration** — the ghost recipe box SVG in the lower right corner of the welcome screen is a nice decorative element. This should become part of the watermark/decoration object system and appear on other screens as part of the active seasonal set. Wire it into WatermarkLayer so it rotates with the season like the other objects. Currently only exists on the welcome screen.
- **Invite flow font audit** — the invite flow screens (code entry, invitation card, role selection, account creation, pending approval) should use the same Playfair Display / Jost / Caveat font system as the rest of the app. Do a font audit of WelcomeScreen3b.jsx and PendingApprovalScreen (in App.jsx) and ensure typography matches the design system exactly — no default browser fonts or inconsistent weights.
- ~~**Plan a Meal screen**~~ — ✅ Built. Recipe picker, quick add with autofill, alternatives, edit mode, AddToPlanSheet with calendar.
- ~~**Saved Meals screen**~~ — ✅ Built. List with search, tap to edit via PlanMeal, Add to plan via AddToPlanSheet.
- ~~**Meals hub**~~ — ✅ Built. Two-zone layout (action tiles + archive counters), tagline strip, live counts refreshing on focus.
- ~~**Week Settings**~~ — ✅ Built. Two-screen architecture: This Week Settings (`/week-settings`) + Household Defaults (`/week/defaults`). Template preview/confirm, AddDayTypeSheet reusable.
- **Traditions screen** (`/meals/traditions`) — currently routes to Sage placeholder. Schema live. Should show household_traditions with add/edit/delete.

---

## Small UX Touches to Add

- **Exit confirmation on Plan a Meal screen** — when user taps back or navigates away mid-meal with unsaved changes, show a warm confirmation dialog. Copy options to consider: "Leave before saving?" / "Your meal isn't done yet" / "Step away from the stove?" with buttons "Keep cooking" (stay) and "Leave" (exit). Trigger only if meal name or at least one recipe has been entered.

---

## Weekly Wrap-Up — Not Yet Built

The weekly wrap-up is the end-of-week moment that closes the planning loop. Triggered when Lauren navigates away from a published week that has passed, or via a manual "Wrap up this week" action.

**Flow:**

1. For each planned meal that week — confirm: Was this cooked? (Yes / No / Modified)
2. If modified: adjust serving count if different from planned
3. On confirmation: increment `recipes.times_cooked`, update `planned_meals.status` to `'completed'` or `'skipped'`, confirm ingredient quantities used for spending metrics
4. Archive the week: set `meal_plans.status` to `'archived'`, seal any `tradition_occurrences` from that week (`is_sealed = true`)
5. Surface a warm summary moment: *"This week your family ate X meals. You cooked Y new recipes."* — Sage delivers this

**Premium feature.** Required before spending trends and Sage skip detection can work accurately. Dependencies: activity log writes, shopping list completion tracking.

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

## Subscription Tiers

See **`docs/PRODUCT-TIERS.md`** for authoritative tier definitions (Free / Plus / Premium feature breakdown).

### Enforcement Status

- `subscription_tier` field exists on users/households table ✓
- Lauren Hill set to Premium permanently ✓
- `useSubscription()` hook — **NOT YET BUILT**
- Enforcement layer — **NOT YET BUILT**
- Upgrade prompt UI — **NOT YET DESIGNED**
- Stripe integration — **NOT PLANNED YET**

### Trigger to Build

Build the enforcement layer as a focused sprint immediately before inviting any non-Hill-family users to the app. Implementation plan: (1) `useSubscription()` hook reading from `appUser`, (2) gated component pattern with soft lock overlay, (3) enforcement touchpoints per PRODUCT-TIERS.md, (4) Stripe integration in a later phase.

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

## API Cost Management

- Model constants defined in `src/lib/aiModels.js` — single source of truth for all model assignments
- **Primary Sage model** is runtime-configurable via `app_config.sage_model`. `aiModels.js` exports `getSageModel()` (async) which reads this value with a 5-minute cache. Covers: Sage chat, week planning, recipe URL extraction. Change the model in `app_config` without a code deploy.
- **Haiku** (`claude-haiku-4-5-20251001`) assignments are intentional cost decisions and stay hardcoded in `aiModels.js`: ingredient review, skip detection, reactive suggestions, shopping list generation — background structured tasks and high-frequency operations
- **Callers of the primary model** must `await getSageModel()` (or the aliases `getSageChatModel`, `getSageWeekPlanningModel`, `getRecipeUrlExtractionModel`) instead of importing a static constant
- Sage ingredient review does not count against `sage_usage` — it's background infrastructure

---

## Design Decisions — Pending

- **Day type badge redesign** — current colored pills feel too generic for the Roux aesthetic. Redesign direction: small contextual icon + Caveat handwritten label inside a warm stamp/tag shape. Applies to three surfaces: This Week day row header badges, Week Settings day type selector pills, and the active badge display. Full prototype to be provided before build. Do not change current implementation until spec is delivered.
