/**
 * storageTypeClassifier.js — Rule-based storage type classifier.
 * Used for backfill of existing ingredients and as fallback when Sage is unavailable.
 * Returns 'cold', 'dry', or 'frozen'.
 */

const COLD_KEYWORDS = [
  'beef', 'chicken', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna',
  'shrimp', 'milk', 'cream', 'butter', 'cheese', 'yogurt', 'egg', 'eggs',
  'lettuce', 'spinach', 'kale', 'broccoli', 'carrot', 'celery', 'onion',
  'lemon', 'lime', 'orange', 'apple', 'berry', 'berries', 'mushroom',
  'tofu', 'bacon', 'sausage', 'deli', 'mayo', 'mayonnaise', 'hummus',
  'juice', 'half and half', 'heavy cream', 'sour cream', 'cottage cheese',
  'tomato', 'pepper', 'cucumber', 'zucchini', 'squash', 'avocado',
  'cilantro', 'parsley', 'basil', 'mint', 'dill', 'chive',
  'steak', 'ground beef', 'ground turkey', 'ground pork',
  'ham', 'prosciutto', 'salami', 'pepperoni',
  'mozzarella', 'parmesan', 'cheddar', 'ricotta', 'feta',
  'whipping cream', 'buttermilk', 'crème fraîche',
  'shallot', 'scallion', 'green onion', 'leek',
  'grape', 'strawberry', 'blueberry', 'raspberry', 'mango', 'pineapple',
  'corn on the cob', 'fresh corn',
]

const FROZEN_KEYWORDS = [
  'frozen', 'ice cream', 'sorbet', 'frost', 'freezer',
]

const DRY_KEYWORDS = [
  'flour', 'sugar', 'salt', 'pepper', 'spice', 'powder', 'dried', 'can',
  'canned', 'pasta', 'noodle', 'rice', 'grain', 'bean', 'lentil', 'oil',
  'vinegar', 'sauce', 'broth', 'stock', 'honey', 'syrup', 'jam', 'bread',
  'cracker', 'chip', 'nut', 'seed', 'oat', 'cereal', 'mix', 'baking',
  'tortilla', 'wrap', 'pita', 'cornstarch', 'baking soda', 'baking powder',
  'vanilla', 'extract', 'cocoa', 'chocolate chip', 'yeast',
  'soy sauce', 'worcestershire', 'hot sauce', 'ketchup', 'mustard',
  'peanut butter', 'almond butter', 'tahini',
  'cumin', 'paprika', 'oregano', 'thyme', 'cinnamon', 'nutmeg', 'garlic powder',
  'onion powder', 'chili powder', 'cayenne', 'turmeric', 'coriander',
  'panko', 'breadcrumb', 'crouton',
]

export function classifyStorageType(ingredientName) {
  if (!ingredientName) return 'dry'
  const lower = ingredientName.toLowerCase()

  for (const kw of FROZEN_KEYWORDS) {
    if (lower.includes(kw)) return 'frozen'
  }
  for (const kw of COLD_KEYWORDS) {
    if (lower.includes(kw)) return 'cold'
  }
  for (const kw of DRY_KEYWORDS) {
    if (lower.includes(kw)) return 'dry'
  }

  return 'dry' // safe default — most pantry items are shelf-stable
}
