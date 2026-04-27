// Uploads a file to the `meal-photos` Supabase storage bucket using a
// household-scoped path so the bucket's RLS policy
// (`(storage.foldername(name))[1] = get_my_household_id()::text`) accepts it.
//
// Path layout: `${householdId}/${mealId}/${timestamp}.${ext}`
//
// Returns { publicUrl, storagePath } on success. Throws on any failure so the
// caller can surface it (alert, toast, etc.) — silent failure is what caused
// the original photo-not-saving bug on recipes.
//
// DB persistence (writing publicUrl to meals.photo_url) is the caller's
// responsibility — different call sites do optimistic updates differently.

import { supabase } from './supabase'

export async function uploadMealPhoto({ file, householdId, mealId }) {
  if (!file) throw new Error('No file provided')
  if (!householdId) throw new Error('No household_id available')
  if (!mealId) throw new Error('No mealId provided — meal must exist before upload')

  const ext = file.name?.split('.').pop() || 'jpg'
  const storagePath = `${householdId}/${mealId}/${Date.now()}.${ext}`

  const { error: upErr } = await supabase
    .storage
    .from('meal-photos')
    .upload(storagePath, file, { upsert: true })
  if (upErr) throw upErr

  const { data } = supabase.storage.from('meal-photos').getPublicUrl(storagePath)
  const publicUrl = data?.publicUrl
  if (!publicUrl) throw new Error('Upload succeeded but no public URL returned')

  return { publicUrl, storagePath }
}
