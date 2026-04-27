-- meal-photos storage bucket + RLS, mirroring recipe-photos.
--
-- Applied directly to production via Supabase MCP on 2026-04-26.
-- Documentation copy of what shipped; will not appear in remote
-- supabase_migrations history table (pre-existing local/remote drift).
--
-- Idempotent: safe to re-run (ON CONFLICT on the bucket, DROP POLICY IF
-- EXISTS before each policy).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meal-photos',
  'meal-photos',
  FALSE,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "meal-photos select authenticated" ON storage.objects;
CREATE POLICY "meal-photos select authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'meal-photos' AND (storage.foldername(name))[1] = get_my_household_id()::text);

DROP POLICY IF EXISTS "meal-photos select public" ON storage.objects;
CREATE POLICY "meal-photos select public"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'meal-photos' AND (storage.foldername(name))[1] = get_my_household_id()::text);

DROP POLICY IF EXISTS "meal-photos insert authenticated" ON storage.objects;
CREATE POLICY "meal-photos insert authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'meal-photos' AND (storage.foldername(name))[1] = get_my_household_id()::text);

DROP POLICY IF EXISTS "meal-photos insert public" ON storage.objects;
CREATE POLICY "meal-photos insert public"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'meal-photos' AND (storage.foldername(name))[1] = get_my_household_id()::text);

DROP POLICY IF EXISTS "meal-photos update authenticated" ON storage.objects;
CREATE POLICY "meal-photos update authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'meal-photos' AND (storage.foldername(name))[1] = get_my_household_id()::text);

DROP POLICY IF EXISTS "meal-photos delete authenticated" ON storage.objects;
CREATE POLICY "meal-photos delete authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'meal-photos' AND (storage.foldername(name))[1] = get_my_household_id()::text);
