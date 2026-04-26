-- Recipe photos storage bucket + RLS, mirroring the receipts bucket.
--
-- Root cause being fixed: the `recipe-photos` bucket was never created in the
-- Supabase project, so every recipe photo upload failed silently. This migration
-- creates the bucket with the same settings as `receipts` and adds RLS policies
-- on storage.objects keyed on the household_id path prefix
-- (`(storage.foldername(name))[1] = get_my_household_id()::text`).
--
-- The `public.recipe_photos` table itself already exists in the live DB and is
-- not modified here. It is documented in supabase-schema.sql alongside this.

-- ── Bucket ───────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-photos',
  'recipe-photos',
  FALSE,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── RLS policies on storage.objects ──────────────────────────────────────────
-- Mirrors the receipts bucket: SELECT/INSERT/UPDATE for both authenticated and
-- public roles, scoped by the household_id path prefix. Adds DELETE for
-- recipe-photos (receipts has no DELETE policy; recipes need it for cleanup).

DROP POLICY IF EXISTS "recipe-photos select authenticated" ON storage.objects;
CREATE POLICY "recipe-photos select authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'recipe-photos'
    AND (storage.foldername(name))[1] = get_my_household_id()::text
  );

DROP POLICY IF EXISTS "recipe-photos select public" ON storage.objects;
CREATE POLICY "recipe-photos select public"
  ON storage.objects FOR SELECT TO public
  USING (
    bucket_id = 'recipe-photos'
    AND (storage.foldername(name))[1] = get_my_household_id()::text
  );

DROP POLICY IF EXISTS "recipe-photos insert authenticated" ON storage.objects;
CREATE POLICY "recipe-photos insert authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recipe-photos'
    AND (storage.foldername(name))[1] = get_my_household_id()::text
  );

DROP POLICY IF EXISTS "recipe-photos insert public" ON storage.objects;
CREATE POLICY "recipe-photos insert public"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'recipe-photos'
    AND (storage.foldername(name))[1] = get_my_household_id()::text
  );

DROP POLICY IF EXISTS "recipe-photos update authenticated" ON storage.objects;
CREATE POLICY "recipe-photos update authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'recipe-photos'
    AND (storage.foldername(name))[1] = get_my_household_id()::text
  );

DROP POLICY IF EXISTS "recipe-photos update public" ON storage.objects;
CREATE POLICY "recipe-photos update public"
  ON storage.objects FOR UPDATE TO public
  USING (
    bucket_id = 'recipe-photos'
    AND (storage.foldername(name))[1] = get_my_household_id()::text
  );

DROP POLICY IF EXISTS "recipe-photos delete authenticated" ON storage.objects;
CREATE POLICY "recipe-photos delete authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'recipe-photos'
    AND (storage.foldername(name))[1] = get_my_household_id()::text
  );

DROP POLICY IF EXISTS "recipe-photos delete public" ON storage.objects;
CREATE POLICY "recipe-photos delete public"
  ON storage.objects FOR DELETE TO public
  USING (
    bucket_id = 'recipe-photos'
    AND (storage.foldername(name))[1] = get_my_household_id()::text
  );
