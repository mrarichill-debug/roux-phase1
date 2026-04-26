// Uploads a file to the `recipe-photos` Supabase storage bucket using a
// household-scoped path so the bucket's RLS policy
// (`(storage.foldername(name))[1] = get_my_household_id()::text`) accepts it.
//
// Path layout: `${householdId}/${scopeKey}/${timestamp}.${ext}`
//   - When the recipe id is known, pass it as scopeKey.
//   - When uploading before the recipe row exists (e.g. SaveRecipe hero photo),
//     pass any stable temp key like `new-${Date.now()}`.
//
// Returns { publicUrl, storagePath } on success. Throws on any failure so the
// caller can surface it (alert, toast, etc.) — silent failure is what caused
// the original photo-not-saving bug.
//
// DB persistence (recipes.photo_url, recipe_photos rows) is the caller's
// responsibility — different call sites have different write semantics.

import { supabase } from './supabase'

export async function uploadRecipePhoto({ file, householdId, scopeKey }) {
  if (!file) throw new Error('No file provided')
  if (!householdId) throw new Error('No household_id available')
  if (!scopeKey) throw new Error('No scopeKey provided')

  const ext = file.name?.split('.').pop() || 'jpg'
  const storagePath = `${householdId}/${scopeKey}/${Date.now()}.${ext}`

  const { error: upErr } = await supabase
    .storage
    .from('recipe-photos')
    .upload(storagePath, file, { upsert: true })
  if (upErr) throw upErr

  const { data } = supabase.storage.from('recipe-photos').getPublicUrl(storagePath)
  const publicUrl = data?.publicUrl
  if (!publicUrl) throw new Error('Upload succeeded but no public URL returned')

  return { publicUrl, storagePath }
}
