-- ══════════════════════════════════════════════════════════════════════════════
-- Grant table-level permissions to authenticated and anon roles
-- ══════════════════════════════════════════════════════════════════════════════
--
-- RLS policies control which ROWS each user can see/modify.
-- But GRANT controls whether the role can touch the table AT ALL.
-- Without a GRANT, Postgres returns "permission denied" (42501) before
-- RLS even runs. Our schema created RLS policies but no grants — this is
-- the root cause of the permission denied error.
--
-- authenticated — logged-in users, full CRUD restricted by RLS policies
-- anon          — unauthenticated requests, no access to any app tables
-- ══════════════════════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Full CRUD for authenticated users (RLS policies restrict which rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- service_role needs full access for server-side operations and seeding
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Revoke table access from anon — no unauthenticated data access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
