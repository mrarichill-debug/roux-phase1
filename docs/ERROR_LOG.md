# Error Log
*Known errors and how they were fixed. Read before any task. Do not repeat these.*

---

### Mar 20 — Embedded Supabase joins causing 403 errors
**What happened:** Queries with `recipe_tag_definitions(name)` embedded join returned 403 or empty results.
**Root cause:** PostgREST can't resolve FK relationships when multiple paths exist between tables.
**Rule going forward:** Never use embedded joins. Always split into two separate queries and join in JavaScript.

### Mar 21 — Missing GRANT after creating new tables
**What happened:** `recipe_tag_definitions`, `recipe_tags`, `meal_tags`, `ingredient_alternatives` all returned 403 despite correct RLS policies.
**Root cause:** New tables need explicit GRANT permissions to `anon` and `authenticated` roles. GRANT and RLS are both always required.
**Rule going forward:** After every `CREATE TABLE`, immediately run `GRANT SELECT, INSERT, UPDATE, DELETE ON [table] TO anon, authenticated;`.

### Mar 20 — .eq('household_id', ...) failing when householdId is null or stale
**What happened:** Queries returned empty results with no error because `appUser.household_id` was null during early render.
**Root cause:** Client-side household_id can be null before auth resolves. RLS functions handle this server-side.
**Rule going forward:** Trust `get_my_household_id()` in RLS policies. Never add redundant `.eq('household_id', ...)` filters that depend on client state being ready.

### Mar 26 — Querying a nonexistent column returning empty results with no error
**What happened:** Insert to `meal_plans` failed silently — no error message, no rows created.
**Root cause:** `created_by` and `week_end_date` were NOT NULL columns missing from the insert. Supabase returns no error for constraint violations behind RLS.
**Rule going forward:** Verify column names and NOT NULL constraints against actual schema before writing any insert. Run `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'your_table'` first.

### Mar 25 — Environment variables not loading after dev server restart
**What happened:** `VITE_GOOGLE_CLIENT_ID` showed as undefined despite being in `.env`.
**Root cause:** Vite caches env vars at startup. HMR does not reload `.env` changes. Must kill and restart the dev server.
**Rule going forward:** After any `.env` change, kill the dev server process completely and restart. Hard refresh the browser too.

### Mar 25 — .env format breaking with spaces around =
**What happened:** `VITE_GOOGLE_CLIENT_ID = value` was not parsed by Vite.
**Root cause:** Vite's `.env` parser requires `KEY=value` with no spaces around the `=` sign.
**Rule going forward:** Never put spaces around `=` in `.env` files. Always `KEY=value`.

### Mar 22 — Empty root div from deleted file still being imported
**What happened:** Entire React app showed blank white page — root div empty on all routes.
**Root cause:** `Sage.jsx` was deleted but tradition routes in App.jsx still rendered `<Sage>` as a component. Module-level crash killed the entire app.
**Rule going forward:** After deleting any component file, search the entire codebase for `<ComponentName` and `from '...ComponentName'` before committing. One missed reference = total app crash.

### Mar 20 — Welcome screen flash on authenticated login
**What happened:** Logged-in users briefly saw the welcome screen before routing to dashboard.
**Root cause:** `onAuthStateChange` fires null session before Supabase resolves the persisted token from localStorage.
**Rule going forward:** Call `getSession()` synchronously first. Only show unauthenticated UI after `getSession` confirms no session exists.

### Mar 26 — has_planned_first_meal redirect loop after onboarding
**What happened:** Completing onboarding redirected back to `/onboarding` endlessly.
**Root cause:** DB was updated but React `appUser` state still held the old value. Routing check saw stale `false`.
**Rule going forward:** After any DB write that affects routing, update in-memory state too: `setAppUser(prev => ({ ...prev, field: newValue }))`.

### Mar 20 — .trim() crash on Sage-extracted recipe fields
**What happened:** `TypeError: C.trim is not a function` when saving URL-extracted recipes.
**Root cause:** Sage returns numbers or null for fields the code calls `.trim()` on.
**Rule going forward:** Use safe string helper on every field before DB insert: `const s = (val) => (val == null ? '' : String(val).trim())`.

### Mar 25 — sageMealMatch not firing in dev
**What happened:** Ghost meals saved but `sage_match_status` stayed null — Sage never called.
**Root cause:** `/api/sage` calls go through Vite proxy. Proxy was pointed to `localhost:3001` (not running). Silent 404.
**Rule going forward:** Vite proxy must point to `https://roux-phase2.vercel.app`. Serverless functions must be deployed before they work through the proxy.

### Mar 28 — Stale shopping list ID in handoff doc
**What happened:** Master shopping list ID in session handoff was stale and didn't match the actual ID in the database.
**Root cause:** List ID was hardcoded in the handoff doc and changed between sessions.
**Rule going forward:** Never hardcode shopping list IDs. Always query by `household_id` + `list_type = 'master'` at runtime.

### Mar 28 — "ground [spice]" misrouted to meat category
**What happened:** Keyword categorization matched "ground cumin" to meat because "ground" is a beef keyword.
**Root cause:** Keyword list checked for "ground" as a prefix without checking what followed it.
**Rule going forward:** In `categorizeIngredient.js`, meat keywords must match whole meaningful terms (e.g. "ground beef", "ground turkey") — not the word "ground" alone.

### Mar 28 — Case-sensitive meal name matching failed ingredient dialog check
**What happened:** The remove-meal ingredient dialog never fired because `custom_name` ("apricot chicken") didn't match `source_meal_name` ("Apricot Chicken") stored by Sage's normalization.
**Root cause:** String comparison was case-sensitive. Sage normalizes meal names to title case when storing `source_meal_name`, but `custom_name` in `planned_meals` preserves whatever case Lauren typed.
**Rule going forward:** Any string comparison between user-entered meal names and stored `source_meal_name` values must use `.toLowerCase()` on both sides. Never assume consistent casing between these two fields.

### Mar 28 — shopping_trips status check constraint mismatch
**What happened:** "Start a Trip" insert failed with 400 Bad Request — constraint violation on `shopping_trips.status`.
**Root cause:** Original table had `CHECK (status IN ('planned', 'active', 'completed'))`. New code correctly used `'pending'` and `'in_progress'` but those values weren't in the constraint.
**Rule going forward:** When designing status columns, always check for existing CHECK constraints before writing insert code. Claude.ai can verify constraints with `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = '[constraint_name]'`.
