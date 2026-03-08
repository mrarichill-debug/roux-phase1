-- ══════════════════════════════════════════════════════════════════════════════
-- ROUX — handle_new_user trigger
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Fires after every INSERT on auth.users (i.e. every new signup).
-- Reads name and household_name from raw_user_meta_data, which is populated
-- by the options.data object passed to supabase.auth.signUp() on the frontend.
--
-- SECURITY DEFINER means the function runs with the permissions of its owner
-- (postgres / superuser), bypassing RLS entirely. This is required because
-- the new user has no users row yet, so RLS policies that call
-- get_my_household_id() cannot be satisfied.
--
-- SET search_path = public prevents search path injection attacks, which is
-- required security practice for all SECURITY DEFINER functions.
--
-- Install:
--   Paste this entire file into Supabase → SQL Editor → New query → Run
-- ══════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id  UUID;
  v_user_id       UUID;
  v_name          TEXT;
  v_household     TEXT;
BEGIN
  -- Pull name and household_name from the metadata passed during signUp.
  -- Fall back to safe defaults if metadata is missing.
  v_name      := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),          'New User');
  v_household := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'household_name'), ''), 'My Household');

  -- Step 1: create household (founded_by/owned_by NULL — circular FK, backfilled below)
  INSERT INTO public.households (name)
  VALUES (v_household)
  RETURNING id INTO v_household_id;

  -- Step 2: create user row linked to the new household
  INSERT INTO public.users (auth_id, household_id, name, email, role)
  VALUES (NEW.id, v_household_id, v_name, NEW.email, 'admin')
  RETURNING id INTO v_user_id;

  -- Step 3: backfill founded_by and owned_by now that users row exists
  UPDATE public.households
  SET founded_by = v_user_id,
      owned_by   = v_user_id
  WHERE id = v_household_id;

  RETURN NEW;
END;
$$;


-- Drop trigger first in case this is being re-installed
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
