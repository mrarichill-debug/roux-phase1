# Skill: Supabase Schema & RLS in Roux

---

## The Two-Layer Rule

Every Supabase table needs BOTH layers. Missing either one = broken queries.

**Layer 1 — GRANT (table-level access):**
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON [table_name] TO anon, authenticated;
```

**Layer 2 — RLS policies (row-level filtering):**
```sql
CREATE POLICY "select" ON table_name FOR SELECT USING (household_id = get_my_household_id());
CREATE POLICY "insert" ON table_name FOR INSERT WITH CHECK (household_id = get_my_household_id());
CREATE POLICY "update" ON table_name FOR UPDATE USING (household_id = get_my_household_id());
CREATE POLICY "delete" ON table_name FOR DELETE USING (household_id = get_my_household_id());
```

Without GRANT → 403 on every query.
Without RLS → no row filtering, data leaks across households.

---

## After Any Schema Wipe — Run These Three Statements

```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
```

---

## get_my_household_id() and get_my_user_id()

These are `SECURITY DEFINER` functions that resolve the current auth user's household/user ID without triggering RLS recursion.

**Use them in RLS policies — never in application code.**

**Never add redundant `.eq('household_id', appUser.household_id)` filters alongside RLS.** The RLS policy already handles household scoping. Adding client-side filters creates fragility — if `appUser.household_id` is null or stale during early render, the query silently returns nothing.

Exception: You DO need `.eq('household_id', ...)` when inserting rows, because `WITH CHECK` validates the value you're writing, not a value that already exists.

---

## FK Disambiguation

When a table has multiple foreign keys pointing to the same parent, PostgREST can't resolve which FK to use for an embedded join:

```js
// BAD — ambiguous, will fail
supabase.from('users').select('id, households(subscription_tier)')

// GOOD — use FK hint syntax
supabase.from('users').select('id, households!users_household_id_fkey(subscription_tier)')
```

**Better — just split the query:**
```js
const { data: user } = await supabase.from('users').select('id, household_id').eq(...)
const { data: household } = await supabase.from('households').select('subscription_tier').eq('id', user.household_id).single()
```

Rule: Always split into two queries and join in JavaScript. Never use embedded joins.

---

## Parallel Count Query

When you need a count without fetching rows:

```js
const { count } = await supabase
  .from('planned_meals')
  .select('id', { count: 'exact', head: true })
  .eq('household_id', appUser.household_id)
```

`head: true` means no rows returned — just the count. Combine with `Promise.all` for multiple parallel counts:

```js
const [recipesCount, mealsCount] = await Promise.all([
  supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('household_id', hid),
  supabase.from('meals').select('id', { count: 'exact', head: true }).eq('household_id', hid),
])
```

---

## Verify Column Names Before Querying

Querying a nonexistent column returns empty results with no error — not a 400 or 404.

Before any insert, check the actual schema:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'your_table'
ORDER BY ordinal_position;
```

Pay special attention to NOT NULL columns without defaults — every one MUST be in your insert payload. Missing one = silent failure, no error, no rows created.

---

## Never Use Embedded Joins

This is worth repeating because it's the most common source of silent failures:

```js
// BAD — will break with FK ambiguity or 403
.select('*, recipes(name)')
.select('tag_id, recipe_tag_definitions(name)')
.select('household_id, households(subscription_tier)')

// GOOD — two queries, join in JS
const { data: items } = await supabase.from('recipe_tags').select('recipe_id, tag_id').in('recipe_id', ids)
const { data: defs } = await supabase.from('recipe_tag_definitions').select('id, name').in('id', tagIds)
const defMap = Object.fromEntries(defs.map(d => [d.id, d.name]))
```

---

## Server-Side Access (Serverless Functions Only)

For `/api/` functions that need to bypass RLS:
```js
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

const res = await fetch(`${url}/rest/v1/table?select=col1,col2&id=eq.${id}`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
```

**Never expose the service role key to the client.** It bypasses all RLS.
