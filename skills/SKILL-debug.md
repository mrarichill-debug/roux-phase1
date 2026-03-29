# Skill: Debugging in the Roux Stack

## Standard Debug Sequence

### 1. Build check first
```bash
export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH" && npx vite build 2>&1
```
If build fails → syntax error or bad import. Fix before anything else.

### 2. Check for deleted file references
After deleting any component:
```bash
grep -r "from.*ComponentName\|<ComponentName" src/
```
One missed reference = blank page crash (entire React tree fails).

### 3. Blank page / empty root div
The app crashed before any component mounted. Check in order:
1. Build passes? If yes → runtime error, not syntax
2. Any deleted files still imported? Search all imports
3. Add `ErrorBoundary` in `main.jsx` to catch and display the error
4. Check if it's the auth loading gate showing "Roux." wordmark (not actually blank)
5. Try hard refresh (Cmd+Shift+R) — Vite HMR can cache stale modules

### 4. Supabase query returning 403
Check in order:
1. Does the table have GRANT permissions? `SELECT * FROM information_schema.role_table_grants WHERE table_name = 'your_table'`
2. Does the table have RLS policies? `SELECT * FROM pg_policies WHERE tablename = 'your_table'`
3. Is it an embedded join? Split into separate queries (see SKILL-supabase-rls.md)
4. Are all NOT NULL columns included in the insert?

### 5. Supabase insert failing silently
```sql
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'your_table' AND is_nullable = 'NO' AND column_default IS NULL;
```
Every column returned MUST be in your insert payload. Missing one = silent RLS or constraint failure.

### 6. /api/ calls returning 404 or HTML in dev
Vite doesn't serve serverless functions. Check:
1. `vite.config.js` has proxy: `'/api': { target: 'https://roux-phase2.vercel.app', changeOrigin: true }`
2. The serverless function file is committed and deployed to Vercel
3. The function handles OPTIONS for CORS preflight

### 7. Env vars not loading
- Vite caches env vars at startup. Must kill and restart dev server.
- No spaces around `=` in `.env`: `KEY=value` not `KEY = value`
- `VITE_` prefix = client-side. No prefix = server-side only.
- Check: `grep "YOUR_VAR" .env .env.local`

### 8. State not updating after DB write
If React routing depends on a DB value (like `has_planned_first_meal`):
- DB write alone is not enough
- Must also call `setAppUser(prev => ({ ...prev, field: newValue }))` or equivalent
- Or call `loadAppUser()` to refresh the full object

### 9. Calendar sync returning 0 events
1. Check if `selectedCalendarIds` is set — if empty, falls back to primary only
2. Check token refresh: access tokens expire in 1 hour
3. Check if events are in a subscribed calendar (not primary)
4. Check Vercel logs for `[calendar-sync]` errors

### 10. Sage not responding / sageMealMatch not firing
1. Vite proxy → Vercel must be working (test: `curl localhost:5173/api/sage` should return 405, not 404)
2. Function file must be deployed (check `git status`)
3. Check browser console for fetch errors
4. Check Vercel Function logs for server-side errors
