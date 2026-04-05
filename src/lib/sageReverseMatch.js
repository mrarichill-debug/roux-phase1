/**
 * sageReverseMatch.js — After a new recipe is saved, check if any ghost meals
 * on the current week match the recipe name. If so, insert a Sage nudge offering to link them.
 * Fire-and-forget. Never blocks UI. Never surfaces errors.
 */
import { supabase } from './supabase'

export async function sageReverseMatch({ recipeId, recipeName, appUser }) {
  if (!recipeId || !recipeName || !appUser?.household_id) return

  try {
    // Get current week's ghost meals (unlinked, not removed)
    const { data: ghostMeals } = await supabase
      .from('planned_meals')
      .select('id, custom_name, planned_date, day_of_week')
      .eq('household_id', appUser.household_id)
      .eq('entry_type', 'ghost')
      .is('recipe_id', null)
      .is('removed_at', null)

    if (!ghostMeals?.length) return

    // Case-insensitive match
    const match = ghostMeals.find(m =>
      m.custom_name?.toLowerCase() === recipeName.toLowerCase()
    )

    if (!match) return

    // Format the day name for the message
    const dayName = match.day_of_week
      ? match.day_of_week.charAt(0).toUpperCase() + match.day_of_week.slice(1)
      : 'your menu'

    await supabase.from('sage_background_activity').insert({
      household_id: appUser.household_id,
      user_id: appUser.id,
      activity_type: 'recipe_match',
      message: `${match.custom_name} matches a recipe in your library — want to link it?`,
      recipe_id: recipeId,
      seen: false,
      metadata: {
        matched_meal_id: match.id,
        matched_meal_name: match.custom_name,
        matched_recipes: [{ id: recipeId, name: recipeName }],
        planned_meal_id: match.id,
      },
    })
  } catch (err) {
    console.warn('[SageReverseMatch] Failed:', err.message)
  }
}
