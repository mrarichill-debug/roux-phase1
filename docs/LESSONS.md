# Lessons
*Principles learned from building Roux. Apply proactively — don't wait to rediscover these.*

---

### Always split Supabase queries — never embed joins
**The lesson:** When querying related tables, use two separate queries and join the results in JavaScript. Never use PostgREST's embedded join syntax (`table(column)`).
**Why it matters:** Embedded joins fail silently with 403 or empty results when multiple FK paths exist between tables — and the error gives no clue what went wrong.

### Two-layer permissions are always required
**The lesson:** Every Supabase table needs both GRANT (table-level access) AND RLS policies (row-level filtering). After every `CREATE TABLE`, run `GRANT SELECT, INSERT, UPDATE, DELETE ON [table] TO anon, authenticated;` immediately.
**Why it matters:** Without GRANT, all queries return 403 even with perfect RLS policies — and the error message doesn't say "missing GRANT."

### Deploy to Vercel only at explicit session close
**The lesson:** Never push to main mid-session unless Aric specifically requests it. All development and testing runs on localhost via `npm run dev`.
**Why it matters:** Unintended deploys can ship broken features to the live app that Lauren uses.

### Prototypes in /prototypes/ are law
**The lesson:** Never deviate from the approved prototypes without Aric's explicit approval. Match them exactly.
**Why it matters:** Prototypes represent design decisions that were carefully made — improvising creates visual debt.

### activity_log wire-in is required on every new feature
**The lesson:** Every new feature that involves user interaction must include a `logActivity()` call — fire-and-forget, after the primary action succeeds.
**Why it matters:** Sage intelligence depends entirely on this table. Missing log entries = Sage can't learn.

### Sage never acts unilaterally
**The lesson:** Sage observes, nudges, and suggests — but never makes decisions, removes options, or takes action without Lauren's explicit tap.
**Why it matters:** Lauren plans. Sage assists. Violating this trust model is a product-level failure.

### "Home" in all user-facing copy, never "household"
**The lesson:** The word "household" is a census form word. Every UI string, button label, Sage message, and notification must say "home" instead.
**Why it matters:** Roux is warm and personal. "Household" is cold and institutional.

### Hard refresh after any .env change
**The lesson:** Vite caches env vars at startup. After adding or changing any `.env` variable, kill the dev server process and restart. Then hard-refresh the browser (Cmd+Shift+R).
**Why it matters:** HMR does not pick up new env vars — the app will silently use the old values.

### Update in-memory state after DB writes that affect routing
**The lesson:** When a DB update changes a value that React routing depends on, also call `setAppUser(prev => ({ ...prev, field: newValue }))`. DB write alone is not enough.
**Why it matters:** React won't re-read from the database — stale state causes redirect loops.

### Verify schema before writing inserts
**The lesson:** Before writing any Supabase insert, check the table's columns for NOT NULL constraints without defaults. Include every required column in the payload.
**Why it matters:** Missing a NOT NULL column causes a silent failure — no error, no rows created, no clue.

### Search for all references before deleting a file
**The lesson:** After deleting any component file, search the entire codebase for `<ComponentName` and `from '...ComponentName'` before committing.
**Why it matters:** One missed import reference = total app crash (blank white page, no error visible to the user).

### Sage returns mixed types — always coerce
**The lesson:** Sage may return numbers, null, or unexpected types for fields your code expects as strings. Use a safe coercion helper on every field before any string operation or DB insert.
**Why it matters:** `.trim()` on a number throws a TypeError that crashes the save flow.

### History-first autofill
**The lesson:** Autofill should query `planned_meals` history before the recipes table. Past linked meals carry their `recipe_id` forward automatically.
**Why it matters:** Suggestions feel like "your family's meals" instead of "your recipe database."

### Every error state needs a next step
**The lesson:** Never show a generic error or dead end. Every error message must tell Lauren what happened, why, and what to do next — with action buttons.
**Why it matters:** A dead end at 6pm with hungry kids is a product failure.

### Sage over keyword rules for data classification
**The lesson:** When categorizing natural language data like ingredient names, use Sage instead of building keyword lists. Keyword lists have a ceiling and require constant maintenance. Sage handles edge cases naturally.
**Why it matters:** Keyword logic creates ongoing maintenance work and always has gaps. Sage categorization runs once, stores the result, and never needs updating.

### Categorize at the source, carry forward
**The lesson:** Store `grocery_category` on the `ingredients` table, not just on `shopping_list_items`. Categorize once when the recipe is saved, carry the value forward to every shopping list injection.
**Why it matters:** Recategorizing on every injection wastes API calls and risks inconsistency. One source of truth on the ingredient is cleaner and cheaper.

### Gate async AI work before dependent operations
**The lesson:** If a shopping list injection depends on categorization being complete, await categorization before injecting — don't inject and clean up later.
**Why it matters:** Users never see "other" on their shopping list. Sage quietly does the work first, then the list builds correctly the first time.

### Use status columns to track async AI task state
**The lesson:** When Sage does background work on a record, track it with a status column (`pending` / `done` / `skipped`) rather than inferring state from the data itself.
**Why it matters:** Enables reliable retry logic, prevents duplicate API calls, and gives Sage a clear signal for when to act vs. when to skip.

### Soft-delete planned meals, never hard-delete
**The lesson:** When a meal is removed from the plan, set `removed_at` and `status = 'removed'` rather than deleting the row. Filter active queries with `.is('removed_at', null)`.
**Why it matters:** Sage needs the removal record to surface intelligent nudges during the weekly review — e.g. "You kept the ingredients for Apricot Chicken, want to put it on next week's menu?"

### The ingredient manifest and the shopping trip are two different UX modes
**The lesson:** The Pantry screen in default state is a read-only ingredient manifest — what's needed this week and why. Checkboxes and shopping interactions belong in the Shopping Trip mode triggered by "Start a Trip". Never conflate these two experiences.
**Why it matters:** Checkboxes on a reference view create false cognitive load. The manifest is for planning, the trip is for doing.

### Shopping trips are item assignments, not list copies
**The lesson:** When creating a shopping trip, assign manifest items to the trip via `assigned_trip_id` on `shopping_list_items` — don't copy rows into a separate table. The `shopping_trip_items` join table tracks per-trip purchase state while the master list item remains the single source of truth.
**Why it matters:** Copying creates sync problems — if Lauren edits a quantity on the manifest, the trip copy is stale. Assignment keeps one row per item with a pointer to its current trip.

### Receipt scanning uses Haiku not Sonnet
**The lesson:** Receipt parsing is a structured extraction task — fast and accurate with Haiku. Reserve Sonnet for tasks requiring reasoning or creativity. Cost difference is significant at scale.
**Why it matters:** Receipt scans could happen weekly per household. At scale, using Sonnet would be 5x more expensive than Haiku for no quality gain on this task.

### Batch multiplier lives on planned_meals, not ingredients
**The lesson:** The batch size is a property of this week's plan, not the recipe itself. `batch_multiplier` on `planned_meals` means the same recipe can be made at different scales in different weeks without touching the recipe data.
**Why it matters:** Keeps recipes clean and reusable. The shopping list injection is responsible for applying the scale at the moment of injection.

### Cost intelligence builds from receipt scans, not assumptions
**The lesson:** Ingredient cost estimates come from Lauren's actual purchase history recorded during receipt scans. Bulk store purchases (Costco, Sam's Club) are stored separately from standard store purchases and never mixed in cost averages.
**Why it matters:** A bag of Parmesan from Costco costs $14 and lasts months. The same ingredient from Kroger costs $5. Mixing these averages would produce meaningless estimates.

### Split shared ingredient costs evenly across recipes
**The lesson:** When an ingredient appears in multiple recipes on the same week and is purchased once, split the cost evenly between all recipes. This averages out over time.
**Why it matters:** Precise per-recipe cost attribution isn't possible from a single receipt line item. Even splitting is fair and self-correcting over multiple weeks.

### Low confidence receipt matches require user confirmation
**The lesson:** Never auto-record a purchase history entry for a receipt item that doesn't clearly match an ingredient. Always ask Lauren to confirm ambiguous matches.
**Why it matters:** One wrong match contaminates the cost history for that ingredient permanently. Confirmation is worth the extra tap.

### Quick review and detailed review are the same data, different depth
**The lesson:** Quick review sets `status`, `cooked_at`, `quick_reviewed`. Detailed review adds `ingredients_consumed`, `ingredients_bought_before_skip`, `review_rating`, `detailed_reviewed`. The in-week "Mark as cooked" button IS the quick review distributed across the week — not a separate feature.
**Why it matters:** Keeps the data model unified. One `planned_meals` row tracks the full lifecycle of every meal regardless of how it was reviewed.

### Each meal plan owns its own shopping list
**The lesson:** Always use `getOrCreateShoppingList(mealPlanId)` to find or create the right list. Never query shopping data by `household_id` alone — that returns all weeks mixed together.
**Why it matters:** A household has 52 meal plans per year. Household-scoped queries return a jumbled mix of all weeks. Week-scoped queries return exactly what the user is looking at.

### Pantry staples are household-level, shopping list items are week-level
**The lesson:** `pantry_staples` persists across weeks — it represents what the household always has on hand. `shopping_list_items` is scoped to one meal plan's shopping list and resets each week.
**Why it matters:** "I always have olive oil" is a household fact. "I need olive oil this week" is a weekly shopping need. Conflating these means Lauren re-marks her staples every week.

### Three pantry staple types — different Sage behaviors
**The lesson:** Perishable staples get spoilage and usage tracking (`sage_tracks = true`). Non-perishable staples get frequency tracking and inline weekly prompts. Household items get frequency tracking only. All three build purchase history through receipt scans.
**Why it matters:** Not all pantry items need the same intelligence. Milk spoils, olive oil doesn't, trash bags aren't food. Sage applies the right kind of attention to each.

### "Have it this week" is not the same as a pantry staple
**The lesson:** `have_it_this_week` is a per-week flag on `shopping_list_items`. `pantry_staples` is a household-level persistent record. They are completely separate concepts — never conflate them.
**Why it matters:** "I have milk this week" resets next week. "Milk is a staple I keep on hand" persists forever. One is situational, one is structural.

### Planned meals support multiple recipes via planned_meal_recipes
**The lesson:** Use the `planned_meal_recipes` junction table for recipe linking on planned meals, not `planned_meals.recipe_id`. A Taco Night might need a taco recipe AND a salsa recipe AND a guacamole recipe.
**Why it matters:** Single `recipe_id` is a dead end. The junction table matches the `meal_recipes` pattern already established on the Meals page and scales to any number of recipes.

### Never auto-link recipes without user confirmation
**The lesson:** When Sage finds recipe matches, always surface as a suggestion via `sage_background_activity` or `sage_match_result`. Never silently set `recipe_id` or insert into `planned_meal_recipes`.
**Why it matters:** Silent auto-linking removes user agency. Lauren may have multiple matching recipes or may not want any linked.

### Use dismissed_tooltips JSONB for all persistent tip tracking
**The lesson:** Never add individual boolean columns for "has seen X tip". Use `users.dismissed_tooltips` JSONB with string keys. Check with `hasSeenTooltip()`, dismiss with `dismissTooltip()` from `src/lib/tooltips.js`.
**Why it matters:** One flexible column handles unlimited tips forever. Individual boolean columns multiply with every new feature.

### Multi-week trips are two trips linked by companion_trip_id
**The lesson:** When Lauren shops for two weeks in one trip, two `shopping_trips` rows are created — one per week's shopping list. They're linked via `companion_trip_id`. The UI shows them as one combined trip. Never merge the underlying data.
**Why it matters:** Each week's shopping list must stay independent for weekly review, cost tracking, and Sage intelligence to work correctly.

### Sage intelligence score is weighted by data quality
**The lesson:** Receipt scans (x3) and weekly reviews (x4) are weighted higher than meals planned (x1) because they provide richer, more accurate data. Pantry staples (x2) are mid-weight.
**Why it matters:** The score should reflect data quality, not just activity. A household that scans every receipt and reviews every week should advance faster than one that just plans meals.
