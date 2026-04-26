# BUILD FLAGS & PROGRESS TRACKER
*Roux Phase 2 — Last updated April 25, 2026*

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
- [x] Build This Week / week view (collapsible day cards, four slots, multi-item, autofill, nav boundary, fixed header, accordion past/future, honey calendar pills, meal move, persistent week navigation, per-day free-text notes)
- [x] Build Week Settings — two-screen architecture (This Week Settings + Household Defaults)
- [x] Build AddToPlanSheet (reusable week/day/slot picker with calendar)
- [x] Build AddDayTypeSheet (reusable, used in both settings screens)
- [ ] Build welcome / onboarding flow (5 screens — all prototypes approved)
- [x] Build dashboard redesign — intelligence-first layout (Intelligence Card, slim Tonight Card, Week Strip in card)
- [ ] Wire full message pool from `docs/MESSAGE-POOL.md` into `getIntelligenceMessage.js` (currently simplified, 8 conditions)
- [ ] Build "By Ingredient" destination screen
- [x] Build Save a Recipe flow (Photo capture + URL extraction + Manual entry, Sage ingredient review on save)
- [ ] Build Traditions screen (`/meals/traditions`) — schema live, routes to placeholder
- [ ] Build Sage screen (`/sage`) — placeholder only
- [ ] Build Settings screen (My Account + Our Kitchen)
- [ ] Build family members management UI
- [ ] Build shopping list auto-generation from week plan
- [x] Build meal move (move meal to another day — this week + next week picker)
- [ ] Build tradition slot picker workflow
- [x] Wire activity log writes — active via `src/lib/activityLog.js`
- [ ] Wire "By Ingredient" search (currently dead tap)
- [ ] Design child/view-only dashboard (required before onboarding ships)
- [ ] Build tier enforcement layer (`useSubscription()` hook)
- [ ] Responsive design — tablet and desktop

---

## ⚠ Must-Fix Before Go-Live

### 1. "By Ingredient" Shortcut — Dead Tap
The "By Ingredient" tile was removed from the dashboard in the Apr 5 redesign. The Recipe Library version still goes nowhere. Build the screen or replace with a working destination before launch.

### 2. Publish → Shopping List Handoff — Undesigned
When Lauren publishes the plan, the app must immediately surface a prompt to build the shopping list. The transition from This Week → Shopping List is the most important workflow handoff in the app. Currently undesigned at the transition moment.

### 3. Tonight Card Empty State — ✅ RESOLVED (Apr 5)
Cutting board background always present. Empty state: wood grain + italic "What's for dinner?" + "Plan tonight" button. Slim design (no divider, no prep time row).

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

### URL Extraction — Anthropic Web Search (Mar 20, 2026)

- URL extraction uses Anthropic `web_search_20250305` tool — Claude fetches and parses recipe pages directly via built-in web search. No server-side HTTP fetch needed.
- Free users get 3 URL extractions/month. Full Plan users get unlimited. ~3-5x more expensive than plain API calls due to web search tool usage.
- Uses `@anthropic-ai/sdk` npm package in the serverless function.
- Error handling: `tier_required` (Free users), `fetch_failed` (web search couldn't reach page), `parse_failed` (couldn't parse recipe from response). Every error provides a clear next step.
- `subscription_tier` read from `households` table, loaded into `appUser` via `loadAppUser()`.

### Recipe Tags (Mar 20, 2026)

- Recipe tags replace single category — `recipe_tag_definitions` + `recipe_tags` tables live.
- Default tags: Entry, Appetizer, Dessert (`is_default = true`, cannot be removed).
- Custom tags: household-specific, created inline via "+ Add a tag" on Edit/Save Recipe screens.
- Multi-select: recipes can have any number of tags. Active tags show in forest green.
- **Edit/Save Recipe:** tag selector replaces category picker. Multi-select pills + inline tag creation.
- **Recipe detail:** all tags shown as quiet pills in hero bar (replaces single category pill).
- **Recipe library filter:** "Browse by tag" replaces "Browse by category". Multi-select with AND logic — recipes must match ALL selected tags.
- **Recipe library card:** first tag (lowest sort_order) shown as primary pill on card.
- **Sage extraction:** `category` field from extraction matched case-insensitively against existing tag definitions. Creates new tag if no match.
- `recipes.category` column preserved for backward compat but no longer primary — new recipes use tags exclusively.

### Ingredient Alternatives (Mar 20, 2026)

- `ingredient_alternatives` table live. Each alternative links to a `primary_ingredient_id` with its own name, quantity, unit, preparation_note, sort_order.
- **Edit Recipe:** "+ Add alternative" tap target below each ingredient row. Inline form: qty + unit + name. Multiple alternatives per ingredient. Honey `or` prefix and left border. Remove with ×.
- **Recipe Detail:** Ingredients with alternatives show a honey `+N alt(s)` pill. Tapping expands to show alternatives inline as `or 3 lb boneless steak`. Collapsed by default.
- **Save a Recipe:** "X or Y" ingredient names from Sage extraction auto-parsed into primary + alternative. Primary is first item, alternative is second.
- Same UX pattern as meal recipe alternatives in PlanMeal.
- RLS: accessible via ingredients → recipes → household ownership chain.

### Sage Ingredient Review (Mar 19, 2026)

- **Async background call** after every recipe save (new or edit). Fire-and-forget — save completes immediately for the user.
- Uses `claude-haiku-4-5-20251001` — fast and cost-efficient. Does **not** count against `sage_usage` limits.
- Reviews ingredient list for consistency issues: ambiguous units, vague quantities, duplicated ingredients expressed differently.
- Results saved to `recipes.sage_assist_content` (JSON array), `sage_assist_status` set to `'pending'`, `sage_assist_offered` set to timestamp.
- If no issues found — empty array, no notification, no DB write.
- On recipe detail: amber nudge appears when `sage_assist_status = 'pending'`. Opens a review sheet where Lauren accepts or dismisses each suggestion.
- Accepting updates the ingredient row in the database. All resolved → `sage_assist_status` set to `'resolved'`, nudge disappears.
- Columns `sage_assist_content`, `sage_assist_status`, `sage_assist_offered` already existed on the `recipes` table. `sage_assist_status` CHECK constraint updated to include `'resolved'`.

### Calendar Sync (Mar 22, 2026)

Calendar sync — Apple CalDAV is TEST ONLY (requires app-specific password, not suitable for production). Production Apple Calendar = EventKit in native iOS app. Google Calendar OAuth is production-ready. Switch provider via `users.calendar_provider`. Events display as quiet honey-dotted pills on day cards — display only, max 3 per day with "+N more" overflow. Sage reads them for context.

- `/api/calendar-sync.js` — serverless function, reads credentials from Supabase server-side only (never accepted in request body)
- `/src/lib/calendarSync.js` — client helper, calls API and filters events by date
- `/settings/calendar` — connect/disconnect screen. Apple section DEV ONLY.
- Schema: `users.calendar_provider` (apple/google/null), `users.calendar_sync_enabled` (boolean), `users.calendar_credentials` (jsonb, encrypted at rest in Supabase)
- Env vars needed: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` for Google OAuth

### Session Close (Mar 26, 2026)

- Week finalization flow built — "Share with family →" button, Sage sheet, meal plan → Pantry injection working end to end
- Shopping list injection confirmed — ingredients pull from linked recipes with `source_meal_name` labels ("For Spaghetti", "For Apricot Chicken")
- Sage tutorial card on first Pantry list visit — working
- Pantry list screen needs editing work next session — layout, categorization, item management
- Autofill now queries `planned_meals` history — meals grow naturally over time
- Sage skips API call when history has exact name match with `recipe_id` already linked
- Reverse match on recipe save still pending — when new recipe saved, check ghost meals for potential link
- `protect_activity_log` flag needed before Lauren goes live for real
- Save a recipe from Sage suggestion card now pre-fills meal name and links back to week view automatically
- Calendar event spacing fixed — 8px top padding below header on all day cards
- Onboarding `has_planned_first_meal` flag now sets correctly on both Screen 3 meal add and Screen 4 CTA, with in-memory state update to prevent redirect loop

### Dev Reset

`protect_activity_log` flag (future) — Before Lauren goes live for real, add a `protect_activity_log` toggle to `DevReset.jsx`. When ON (default once real usage begins), the reset skips clearing `activity_log` so real usage data is never accidentally wiped during a test session. Currently the reset wipes activity log — acceptable during pure dev testing, not acceptable once Lauren has real cooking history in the system.

### Session Close (Mar 25, 2026)

- Calendar sync live — Hill family events showing on week view as honey-dot pills
- Calendar selection UI at `/settings/calendar` — toggle individual Google calendars on/off
- No docx session summaries needed — Claude Code handles session notes directly
- Next session: go to `/settings/calendar` first, confirm Angels/Lakers toggled off, then full end-to-end test
- Meal plan → Pantry list injection still pending — planning a meal should auto-populate shopping list
- "Save a recipe" from Sage suggestion card should pre-fill meal name

### Calendar Selection (Mar 25, 2026)

Calendar selection UI — users choose which Google calendars appear in Roux. Stored in `users.calendar_credentials.selectedCalendarIds`. Default: primary + calendars with "family" in name. Sports/team calendars excluded by default. `/api/google-calendar-list.js` fetches the full calendar list. `/api/calendar-sync.js` filters to selected IDs only, falls back to primary-only if none selected.

### Sage Philosophy

Sage never waits to be asked. All Sage interactions are proactive and app-triggered. She surfaces the right information at the right moment. Lauren responds with taps — never types. This is the core product differentiator for Roux vs. every other AI-powered cooking app. Every Sage interaction must be genuinely useful — never filler, never generic. Quality over quantity.

Marketing line: *"Sage doesn't wait to be asked."*

### Sage Interaction Model (Mar 22, 2026)

Sage has no free-form chat interface. All interactions are structured and app-triggered. Users respond to Sage via action buttons only — never by typing. The app always constructs the API prompt based on context (which screen, which recipe, which week) — users never write prompts directly. SageChat.jsx and Sage.jsx deleted. `/sage` route removed. Sage sparkle icon in topbar opens a summary sheet showing recent nudges and suggestions.

### Meals Tab Redesign (Pre-Build Spec — Mar 22, 2026)

*Do not build yet — document only. Current priority is Sage meal match.*

**Two views on the Meals tab:**

- **"Our Meals"** — deduplicated list of every meal the family has ever planned, derived from `planned_meals` history. Sorted by most recently planned. Each entry shows: meal name, last planned date, times planned, recipe linked indicator. Tapping shows history and links to recipe if one exists. Zero setup — grows naturally as Lauren plans weeks.
- **"Recipe Box"** — existing Recipe Library, unchanged.

The tab currently navigates to Recipe Library only. Will become a tabbed view: Our Meals / Recipe Box.

**Autofill update (flag for ThisWeek.jsx):** The add meal input should query `planned_meals` history FIRST (deduplicated `custom_name` + linked recipe names), then recipe names as fallback. This makes suggestions feel like "your family's meals" not "your recipe list."

### Sage Meal Matching (Mar 22, 2026)

Sage meal matching fires async after every ghost meal entry on the Menu page. Normalizes meal name spelling/casing (Title Case, fix typos) + searches recipe library for fuzzy matches. Surfaces inline suggestion card on day card with recipe buttons, "Save a new recipe", and "Keep as-is" actions. Two recognition pathways: autofill (instant, as-you-type from recipes table) + Sage match (async, fuzzy, normalizes name). Schema: `planned_meals.sage_match_result` (jsonb with `normalized_name`, `matches[]`, `suggest_new`), `planned_meals.sage_match_status` (text: pending/resolved). Poll interval: 3 seconds while pending matches exist. Fire-and-forget — never blocks the add meal flow.

**Autofill from planned_meals history (Mar 26, 2026)** — Autofill in ThisWeek.jsx add meal input now queries `planned_meals` history (deduplicated by `custom_name`, most recent first) instead of the recipes table. Past meals with a linked `recipe_id` carry it forward automatically — selecting "Meatloaf" from autofill next week links the recipe without Sage needing to match. Meal type from history is also pre-selected. sageMealMatch.js also checks planned_meals history first — if an exact past match with a recipe exists, it skips the Sage API call entirely and surfaces the match directly.

**Reverse match on recipe save (pending)** — When a new recipe is saved, check if any current week ghost meals with `sage_match_status = 'resolved'` or `null` could match the new recipe name. If a match is found, surface a quiet Sage suggestion on the week view: *"✦ You just saved [recipe name] — want to link it to [meal name] on [day]?"* This closes the gap where Lauren taps "Keep as-is" then saves a recipe separately. Trigger: `logActivity` `recipe_saved` event → fire `sageMealMatch` against existing ghost meals in the current week.

### Sage Topic Fencing (Mar 22, 2026)

Sage is hard-fenced to kitchen/food/meal planning topics via system prompt in `/api/sage.js`. She will warmly redirect any off-topic questions: *"I'm your kitchen companion — that's a little outside my kitchen!"* This is not a UI feature — it's enforced at the API level on every call. Sage cannot be used as a general-purpose AI assistant.

### Navigation Changes (Mar 22, 2026)

- **Bottom nav reduced to 4 tabs:** Home / Week / Meals / Pantry. Sage removed from nav.
- **Sage sparkle icon in topbar** (global, every screen) — persistent entry point to Sage chat. Tapping navigates to `/sage`.
- **Search icon removed from topbar.** Search functionality lives contextually on individual screens (Recipe library has its own search, Pantry list has its own search). No global search needed at this stage.
- **Home screen redesign planned** — Home screen will become Sage's intelligence center (daily briefing, nudges, family activity). Next major build after the Week page redesign.

### Weekly Proteins — Deprecated (Mar 22, 2026)

`weekly_proteins` table deprecated — UI removed from ThisWeek.jsx. `protein_favorites` kept for future Sage signal. Protein-based meal suggestions will be a Sage interaction on the new Week/Menu page — "chicken is on sale, here are your chicken recipes."

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

- ~~**Add Protein flow**~~ — removed. `weekly_proteins` deprecated. Protein suggestions will be a Sage interaction.
- [ ] **`family_members` management UI** — family members are seeded for the Hill family but there is no UI to add, edit, or remove family members. Needed for: Who's cooking on Tonight card, per-member dietary preferences, child dashboard scoping, assigned cook on planned meals. Build in Profile/Settings screen.
- [x] **`activity_log` writes** — ✅ ACTIVE. Fire-and-forget via `src/lib/activityLog.js`. Actions logged: `recipe_saved`, `recipe_edited`, `recipe_viewed`, `recipe_plan_tapped`, `recipe_planned`, `meal_planned`, `meal_added_to_week`, `meal_skipped`. Activity log retention — no cleanup policy needed until 1,000+ users. At scale, consider pruning entries older than 2 years. Do not implement yet.
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
  - Grocery store management: inline store addition from store dropdowns is built. Full store list management (edit, delete, set primary) lives in Our Kitchen section.
- **Related recipes on recipe card** — "Goes Well With" section. Invest properly, not a placeholder row.
- **Avery (child) dashboard** — scoped view-only experience. Must be designed before onboarding ships.
- **Profile photos** — users should be able to add a profile photo that appears in the avatar circle instead of their initial. Applies to all household members. Photos stored in Supabase Storage. Avatar displays photo if available, initial as fallback. Build when Profile screen gets its second design pass.
- **Notifications screen** — full notification center at `/notifications`. Bell icon in topbar routes here. Two tabs: Action Required and Informational. Notification types: meal plan archived (needs confirmation), new member joined via invite code, week published (family members notified), Sage observations and nudges, birthday reminders. `notifications` table exists in schema but nothing is writing to it yet — wire `activity_log` and notification writes together in same sprint.
- **Sage screen at `/sage`** — currently placeholder. Full design required. Direct conversation interface with Sage — not a search bar. Lauren asks questions, gets suggestions, searches by ingredient or occasion. Full Plan feature. Search icon in topbar routes here.
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

- ~~**Exit confirmation on Plan a Meal screen**~~ — ✅ BUILT. Reusable `useUnsavedChanges` hook + `UnsavedChangesSheet` component. Applied to SaveRecipe, EditRecipe, and PlanMeal. Uses React Router `useBlocker` to intercept navigation when form is dirty. Warm copy per screen.

---

## Weekly Wrap-Up — Not Yet Built

The weekly wrap-up is the end-of-week moment that closes the planning loop. Triggered when Lauren navigates away from a published week that has passed, or via a manual "Wrap up this week" action.

**Flow:**

1. For each planned meal that week — confirm: Was this cooked? (Yes / No / Modified)
2. If modified: adjust serving count if different from planned
3. On confirmation: increment `recipes.times_cooked`, update `planned_meals.status` to `'completed'` or `'skipped'`, confirm ingredient quantities used for spending metrics
4. Archive the week: set `meal_plans.status` to `'archived'`, seal any `tradition_occurrences` from that week (`is_sealed = true`)
5. Surface a warm summary moment: *"This week your family ate X meals. You cooked Y new recipes."* — Sage delivers this

**Full Plan feature.** Required before spending trends and Sage skip detection can work accurately. Dependencies: activity log writes, shopping list completion tracking.

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

**State 2 — Active (6+ receipted shopping trips, Full Plan):**
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

See **`docs/PRODUCT-TIERS.md`** for authoritative tier definitions (Free / Full Plan feature breakdown).

### Enforcement Status

- `subscription_tier` field exists on users/households table ✓
- Lauren Hill set to Full permanently ✓
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

---

## Brand & Domain Roadmap

**Domains registered March 21, 2026** — all locked for 3 years via Squarespace:

- **myroux.app** — primary app domain, use when going live
- **myroux.com** — main brand presence, marketing/landing page
- **myroux.kitchen** — reserved for future social/community layer

**Intended long-term architecture:**

- **myroux.app** — the private household app (what we're building now)
- **myroux.com** — public brand home, marketing site, App Store landing page
- **myroux.kitchen** — social layer: shared kitchens, recipe discovery, following other households. Launched when social features are ready — estimated v3+

**Actions needed before go-live:**

- [ ] Configure `myroux.app` as custom domain in Vercel
- [ ] Build a simple `myroux.com` marketing/waitlist page
- [ ] Update all in-app URL references
- [ ] Update Terms of Service and Privacy Policy links

**Trademark:** File in IC 042 (SaaS/software) before public launch. USPTO search clean as of March 21, 2026.

---

## Pantry — Full Model (Pre-Build Spec)

*Documented March 21, 2026. DO NOT BUILD until Aric gives the go signal.*

### Nav Rename

"Shop" → "Pantry" across all files — `BottomNav.jsx`, all route references, page titles, `DESIGN-SYSTEM.md`, `SCREEN-SPECS.md`. Pantry is an action center like Meals, not just a shopping list. It manages everything between the kitchen and the store and back again.

### What Lives in Pantry

**Master Family List** — always-on running list, never resets, never deletes. One per household. All family members can add. Non-admin additions show as `pending_approval`. Items auto-reset to `active` based on type and cadence — Lauren never manually unchecks anything.

**Shopping Trips** — real-time shopping mode. Store selector = context switch ("I am at Kroger right now"). Checking off an item in store context records the store on the purchase. No pre-planning required — Lauren can assign items to stores on the fly or after the fact. Close-out: receipt scan (Full Plan) or manual confirm (Free). On close-out, items mark as purchased on master list.

**Meal Prep Sessions** — batch cooking events. Lauren plans a prep session (Sunday breakfast sandwiches), Sage generates a bulk ingredient list for the prep, outputs become inventory items (12 sandwiches made, 8 remaining). Ingredients flow into the master list as a batch. Built before go-live, gated to Full Plan.

**In the Freezer / Sale Items** — Sage-managed section. Items flagged as sale or bulk are tracked here. Sage follows up proactively — this is the one area Sage is allowed to be persistent. "You bought 3 lbs of chicken on sale 10 days ago — want to plan something with it?" Food waste prevention is a core Sage value prop.

### Item Types and Auto-Reset Rules

| Type | Description | Auto-Reset |
|---|---|---|
| `recipe` | From meal plan injection | Resets when recipe is planned again |
| `staple` | Recurring household item | Configurable cadence (default 30 days). Full Plan: learned from receipt history |
| `sale` | Opportunistic purchase | Does NOT auto-reset. Sage monitors and nudges |
| `future` | For upcoming unplanned meals | Resurfaces when relevant week is planned |
| `manual` | Anything Lauren or family adds | Resets based on `perishable_days` if perishable, otherwise stays until cleared |

### Family Contributions

- Any household member can add to master list
- Non-admin items: `approval_status = pending`
- Surfaces on HOME screen as a notice — admin-only clear
- One-tap approve or remove from a banner — no modals
- Only admin can clear Home page notices

### Tier Gates

| Tier | Features |
|---|---|
| **Free** | Master list, manual trip close-out, time-based auto-reset |
| **Full Plan** | Family contributions, meal plan injection, meal prep sessions, receipt scanning, Sage learned cadence, food waste intelligence, sale item follow-ups |

### Schema Changes Needed (Document Only — Do Not Build)

- `shopping_lists` — remove required `meal_plan_id` (make nullable), add `list_type` (`master`/`trip`/`prep`)
- `shopping_list_items` — add `suggested_by_user_id`, `approval_status`, `item_type` (`recipe`/`staple`/`sale`/`future`/`manual`), `auto_reset_days`, `last_purchased_at`
- New table: `shopping_trips` — named trip events with `store_id`, `status`, linked items, `receipt_photo_url`
- New table: `meal_prep_sessions` — batch cooking events with `planned_date`, `output_count`, `output_item_name`, ingredients linked to master list
- Grant permissions on all new tables to `anon` and `authenticated` roles

### Build Progress

- [x] Schema changes — `grocery_category` column added to `shopping_list_items`, `shopping_trips` + `shopping_trip_items` tables live
- [x] Nav rename Shop → Pantry — all files updated
- [x] Pantry hub screen (`/pantry`) — action center with Family List, Start a Trip, Meal Prep tiles + Sage sections
- [x] Family List screen (`/pantry/list`) — master list grouped by `grocery_category`, add item with category picker. **Not a shopping screen — no store context.**
- [x] Shopping Trip screen (`/pantry/trip/:id`) — separate in-store experience. Large tap targets, store shown prominently, grouped by grocery category, progress bar, Done Shopping closes trip. **This is the store screen.**
- [x] Trip creation — bottom sheet on Pantry hub: pick store, name trip (defaults to "Saturday Kroger run"), creates `shopping_trips` row, pulls active master list items, navigates to trip screen
- [ ] Meal plan → list injection
- [ ] Family contributions + Home screen notices
- [ ] Meal prep sessions
- [ ] Auto-reset intelligence
- [ ] Receipt scanning (Full Plan, last)

### Receipt Scanning (Pre-Build Spec)

**Full Plan feature.** Do not build until Pantry core is stable.

**Flow:**

1. Lauren uploads 1–3 photos of a receipt
2. Sage extracts all line items, prices, quantities via vision API
3. Sage auto-calculates subtotal and compares to printed receipt subtotal
4. If match within $0.05 → `reconciliation_status = 'matched'`
5. If discrepancy → `reconciliation_status = 'discrepancy'`, highlight misread items in honey
6. Lauren sees review screen — all items editable (name, price, qty, category)
7. Lauren confirms → trip logged, items marked purchased, activity log written

**Cost tracking — household level only (v1):**

Track weekly spend by grocery category (produce, meat, dairy etc.) — not per meal. Per-meal cost allocation is a v2 feature requiring 3+ months of receipt history. Rationale: household category spend is always accurate; per-meal allocation requires quantity-based splitting that can't be verified without more data.

**`shopping_trips` new fields needed:**

- `receipt_subtotal` — printed total from the receipt
- `sage_calculated_subtotal` — sum of extracted line items
- `reconciliation_status` — `'matched'` / `'discrepancy'` / `'pending'`
- `reconciliation_notes` — free text for flagged issues
- `item_count` — number of line items extracted
- `store_name` — denormalized store name for display (avoids join on history views)

---

## Sage Future Features — Requires Data Foundation First

### Budget-Optimized Meal Planning (v3+)

*"I want to spend around $100 at the store this week — how can I maximize that with my meal plan?"*

**Prerequisites before this can be built — all must be in place:**

- **Real spend data** — minimum 3 months of confirmed receipt history in `shopping_trips`
- **Per-ingredient price history** — built from receipt scanning over time, stored in `shopping_list_items.actual_price` history
- **Per-meal cost estimates** — calculated from ingredient quantities × price history. Accuracy improves with more receipt data.
- **Recipe history** — sufficient `activity_log` entries to know which meals the family actually makes and enjoys

**How it would work:**

Lauren tells Sage her budget. Sage looks at the week's planned meals, estimates ingredient costs based on price history, identifies the most cost-efficient combination that covers the most meals. Suggests swaps where a cheaper protein or ingredient achieves similar results. Flags what's already in the pantry (already purchased) to reduce the actual shopping spend.

**Why it can't be built yet:**

Without real price history from receipts, Sage would be guessing ingredient costs. A wrong cost estimate is worse than no estimate — Lauren would lose trust immediately. This feature earns its credibility from months of real receipt data.

**The data flywheel:** Receipt scanning → price history builds → per-meal costing becomes accurate → budget optimization becomes possible. Every receipt Lauren scans makes this feature more accurate. This is the long-term payoff of the receipt scanning investment.

---

### Architecture Notes

- **Family List ≠ Shopping Trip.** Family List is for browsing/adding. Shopping Trip is the in-store checkout experience. Two distinct screens, two distinct mental models.
- **Grocery categories are the primary grouping** — `produce`, `meat`, `seafood`, `dairy`, `bakery`, `pantry`, `frozen`, `beverages`, `household`, `personal_care`, `other`. Not `item_type`.
- `item_type` (recipe/manual/staple/future/sale) shows as a quiet badge — it describes how the item got there, not where it lives in the store.

---

## ⚠ Active Bugs & Pending Items (Mar 22, 2026)

### sageMealMatch Not Firing (BUG)
Ghost meals save correctly but `sageMealMatch.js` is not triggering. Ghost entries in `planned_meals` show `sage_match_status = null`. Likely cause: `/api/sage` endpoint not reachable in dev mode (Vite proxy was pointed to `localhost:3001` — fixed to proxy to `roux-phase2.vercel.app`, but needs verification). Check: import in ThisWeek.jsx (~line 239), request format matches what `/api/sage.js` expects, browser console for errors on meal add.

### Onboarding Screen 3 — Needs Interactive Rebuild
Currently static "How It Works" bullets. Should let Lauren add her first meal inline on this screen. Screen 4 becomes celebration + finish-your-week invitation. Copy fixes also pending.

### Welcome Screen Copy — Not Finalized
Brainstorm complete, final line not chosen. Options: "Where your family's meals come together" (recommended), "Your family's kitchen, all in one place", others in session doc. Do not build until Aric confirms.

### Onboarding Copy Fixes Pending
Screen 1 subtext, Screen 2 Roux vs Sage distinction, remove "gets smarter" and "cook with Roux", Screen 3 add recipe box as third path. All written, not applied yet.

### Meals Tab Redesign Pending
"Our Meals" view (derived from `planned_meals` history) + "Recipe Box" (existing library). Build after Week page is stable and tested. Autofill update: add meal input should query `planned_meals` history FIRST, then recipes as fallback.

### Calendar Connect Pending Test
`/settings/calendar` built. Aric's Google account (with iCloud webcal subscribed) needs to be connected to Lauren's Roux account. Verify calendar event pills appear on week day cards.

### Meal Type Smart Default (Future)
Learn from `planned_meals` history what meal type a name is usually categorized as. "Waffles" → defaults to Breakfast. Requires data accumulation.

### Google Calendar OAuth (Production Web)
Production-ready path for web users. Apple CalDAV = TEST ONLY. Apple EventKit = native iOS app only.

### Budget-Optimized Meal Planning (v3+)
"I want to spend $100 this week, maximize my meal plan." Requires 3+ months receipt history, per-ingredient price history, per-meal cost estimates. See "Sage Future Features" section above.

---

## Pre-Launch Checklist

### Google OAuth Credentials — Create Dedicated Account Before Commercial Launch

Current Google Cloud OAuth project is registered under `mrarichill@gmail.com` (Aric's personal account). Before any commercial launch or public beta, create a dedicated Google account for Roux (e.g. `hello@myroux.app` or `dev@myroux.app`) and migrate the Google Cloud project to that account. Update `VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` in Vercel environment variables and `.env.local`. Existing users who connected Google Calendar will need to reconnect once after the migration.
