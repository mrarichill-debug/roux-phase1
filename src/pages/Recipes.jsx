import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(minutes) {
  if (!minutes) return null
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

// Group an array of objects by a key, preserving first-seen order.
function groupBy(arr, key) {
  const map = new Map()
  for (const item of arr) {
    const k = item[key] || ''
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(item)
  }
  return map
}

// Lined notecard background — thin horizontal rules on cream.
const LINED_BG = {
  backgroundColor: '#F5F0E8',
  backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 30px, #D6CCBA 30px, #D6CCBA 31px)',
}


// ── Main component ────────────────────────────────────────────────────────────

export default function Recipes({ appUser }) {
  const [recipes, setRecipes]               = useState([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(null)
  const [selectedRecipe, setSelectedRecipe] = useState(null)

  useEffect(() => { loadRecipes() }, [])

  async function loadRecipes() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('recipes')
      .select(`
        id, name, description, category, cuisine,
        prep_time_minutes, cook_time_minutes, servings,
        is_family_favorite, photo_url,
        ingredients!recipe_id ( id, section_name, sort_order, quantity, unit, name, preparation_note, is_optional ),
        instructions!recipe_id ( id, section_name, step_number, instruction, tip )
      `)
      .eq('household_id', appUser.household_id)
      .order('name')

    if (error) setError(error.message)
    else setRecipes(data ?? [])
    setLoading(false)
  }

  if (loading) return <ScreenMessage>Loading your recipe box…</ScreenMessage>
  if (error)   return <ScreenMessage error>Couldn't load recipes: {error}</ScreenMessage>

  return (
    <div className="relative min-h-full">

      {/* ── List view ──────────────────────────────────────────── */}
      <div className="px-4 pt-7 pb-28">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <p className="text-xs font-medium text-stone-400 uppercase tracking-widest mb-0.5">Recipes</p>
            <h2 className="font-display text-3xl font-light text-stone-800">Your recipe box.</h2>
          </div>
          {recipes.length > 0 && (
            <span className="text-xs text-stone-400">{recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {recipes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {recipes.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onTap={() => setSelectedRecipe(recipe)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Floating add button ────────────────────────────────── */}
      <button
        className="fixed bottom-6 right-5 w-14 h-14 bg-stone-800 hover:bg-stone-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-20"
        aria-label="Add recipe"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* ── Expanded card modal ─────────────────────────────────── */}
      {selectedRecipe && (
        <ExpandedCard
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </div>
  )
}


// ── Recipe card (list) ────────────────────────────────────────────────────────

function RecipeCard({ recipe, onTap }) {
  const prep  = formatTime(recipe.prep_time_minutes)
  const cook  = formatTime(recipe.cook_time_minutes)
  const times = [prep && `${prep} prep`, cook && `${cook} cook`].filter(Boolean)

  return (
    <button
      onClick={onTap}
      className="w-full text-left overflow-hidden active:scale-[0.99] transition-transform"
      style={{
        ...LINED_BG,
        backgroundPositionY: '43px',
        borderRadius: '8px',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
      }}
    >
      {/* Card header label */}
      <div className="px-5 pt-4 pb-1 text-center">
        <p className="font-handwriting text-[11px] tracking-[0.3em] text-stone-400 uppercase">
          — Recipe —
        </p>
      </div>

      {/* Recipe name */}
      <div className="px-5 pt-0.5 pb-1">
        <p className="font-handwriting text-[1.75rem] font-bold leading-tight text-stone-800">
          {recipe.name}
        </p>
      </div>

      {/* Meta row */}
      <div className="px-5 pb-5 pt-2 flex items-center gap-3 flex-wrap">
        {times.map((t, i) => (
          <span key={i} className="font-handwriting text-[15px] text-stone-500">{t}</span>
        ))}
        {times.length > 0 && recipe.servings && (
          <span className="font-handwriting text-[15px] text-stone-300">·</span>
        )}
        {recipe.servings && (
          <span className="font-handwriting text-[15px] text-stone-500">serves {recipe.servings}</span>
        )}
        {recipe.is_family_favorite && (
          <span className="ml-auto text-amber-400 text-base" title="Family favorite">★</span>
        )}
      </div>
    </button>
  )
}


// ── Expanded card (floating modal) ────────────────────────────────────────────

function ExpandedCard({ recipe, onClose }) {
  const [side, setSide] = useState('ingredients')

  const sortedIngredients  = [...(recipe.ingredients  ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const sortedInstructions = [...(recipe.instructions ?? [])].sort((a, b) => a.step_number - b.step_number)
  const ingredientGroups   = groupBy(sortedIngredients,  'section_name')
  const instructionGroups  = groupBy(sortedInstructions, 'section_name')

  const prep = formatTime(recipe.prep_time_minutes)
  const cook = formatTime(recipe.cook_time_minutes)

  return (
    /* Dark backdrop — tap outside to close */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(20,16,12,0.65)' }}
      onClick={onClose}
    >
      {/* Floating card */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          ...LINED_BG,
          backgroundPositionY: '0px',
          width: '85vw',
          maxWidth: '480px',
          height: '80vh',
          borderRadius: '10px',
          border: '1px solid rgba(0,0,0,0.1)',
          boxShadow: '0 16px 56px rgba(0,0,0,0.40), 0 4px 16px rgba(0,0,0,0.18)',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── Card header ─────────────────────────────────────── */}
        <div
          className="shrink-0 px-5 pt-5 pb-0"
          style={{ borderBottom: '1px solid #D6CCBA' }}
        >
          {/* Label + close button */}
          <div className="flex items-start justify-between mb-1">
            <p className="font-handwriting text-[11px] tracking-[0.3em] text-stone-400 uppercase pt-0.5">
              — Recipe —
            </p>
            <button
              onClick={onClose}
              className="p-1 -mt-1 -mr-1 text-stone-400 hover:text-stone-700 transition-colors"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <line x1="3" y1="3" x2="15" y2="15" />
                <line x1="15" y1="3" x2="3" y2="15" />
              </svg>
            </button>
          </div>

          {/* Recipe name */}
          <p className="font-handwriting text-[1.75rem] font-bold text-stone-800 leading-tight">
            {recipe.name}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {prep && <span className="font-handwriting text-[15px] text-stone-500">{prep} prep</span>}
            {cook && <span className="font-handwriting text-[15px] text-stone-500">{cook} cook</span>}
            {recipe.servings && <span className="font-handwriting text-[15px] text-stone-500">serves {recipe.servings}</span>}
          </div>

          {/* Tabs — underline style to match card aesthetic */}
          <div className="flex mt-4 gap-7">
            <button
              onClick={() => setSide('ingredients')}
              className="font-handwriting text-[17px] pb-2.5 transition-colors"
              style={
                side === 'ingredients'
                  ? { color: '#44403C', borderBottom: '2px solid #78716C', fontWeight: 700 }
                  : { color: '#A8A29E', borderBottom: '2px solid transparent' }
              }
            >
              Ingredients
            </button>
            <button
              onClick={() => setSide('directions')}
              className="font-handwriting text-[17px] pb-2.5 transition-colors"
              style={
                side === 'directions'
                  ? { color: '#44403C', borderBottom: '2px solid #78716C', fontWeight: 700 }
                  : { color: '#A8A29E', borderBottom: '2px solid transparent' }
              }
            >
              Directions
            </button>
          </div>
        </div>

        {/* ── Scrollable content ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {side === 'ingredients' ? (
            <IngredientsView groups={ingredientGroups} />
          ) : (
            <DirectionsView groups={instructionGroups} />
          )}
        </div>

      </div>
    </div>
  )
}


// ── Ingredients ───────────────────────────────────────────────────────────────

function IngredientsView({ groups }) {
  if (groups.size === 0) {
    return <p className="font-handwriting text-lg text-stone-400 italic">No ingredients listed yet.</p>
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([section, items]) => (
        <div key={section}>
          {section && (
            <p className="font-handwriting text-[11px] tracking-[0.25em] font-semibold uppercase text-stone-400 mb-2">
              {section}
            </p>
          )}
          <ul className="space-y-2">
            {items.map(ing => (
              <li key={ing.id} className="flex items-baseline gap-2">
                <span className="font-handwriting text-xl leading-snug text-stone-500 shrink-0 min-w-[2rem]">
                  {[ing.quantity, ing.unit].filter(Boolean).join(' ')}
                </span>
                <span className="font-handwriting text-xl leading-snug text-stone-800">
                  {ing.name}
                  {ing.preparation_note && (
                    <span className="text-stone-400">, {ing.preparation_note}</span>
                  )}
                  {ing.is_optional && (
                    <span className="text-stone-400 text-base"> (optional)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}


// ── Directions ────────────────────────────────────────────────────────────────

function DirectionsView({ groups }) {
  if (groups.size === 0) {
    return <p className="font-handwriting text-lg text-stone-400 italic">No directions listed yet.</p>
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([section, steps]) => (
        <div key={section}>
          {section && (
            <p className="font-handwriting text-[11px] tracking-[0.25em] font-semibold uppercase text-stone-400 mb-3">
              {section}
            </p>
          )}
          <ol className="space-y-4">
            {steps.map(step => (
              <li key={step.id} className="flex gap-3">
                <span className="font-handwriting text-2xl font-bold text-stone-300 leading-tight shrink-0 w-6 text-right">
                  {step.step_number}
                </span>
                <div>
                  <p className="font-handwriting text-xl leading-snug text-stone-800">
                    {step.instruction}
                  </p>
                  {step.tip && (
                    <p className="font-handwriting text-[15px] text-stone-400 mt-1 italic">
                      Tip: {step.tip}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}


// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center pt-16 pb-8 text-center">
      <div className="relative w-24 h-32 mb-8">
        <div className="absolute inset-0 rounded-lg rotate-6 shadow-sm" style={{ backgroundColor: '#EDE5D3' }} />
        <div className="absolute inset-0 rounded-lg rotate-2 shadow-sm" style={{ backgroundColor: '#F0E9D9' }} />
        <div className="absolute inset-0 rounded-lg shadow-md flex items-center justify-center" style={{ backgroundColor: '#F5F0E8' }}>
          <span className="font-handwriting text-4xl text-stone-300">?</span>
        </div>
      </div>
      <p className="font-handwriting text-2xl text-stone-700 mb-1">Your recipe box is empty.</p>
      <p className="text-sm text-stone-400 mb-8">Add your first recipe to get started.</p>
      <button className="px-6 py-3 bg-stone-800 hover:bg-stone-700 text-white text-sm font-medium rounded-xl shadow transition-colors">
        Add your first recipe
      </button>
    </div>
  )
}


// ── Utility ───────────────────────────────────────────────────────────────────

function ScreenMessage({ children, error }) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <p className={`text-sm text-center ${error ? 'text-red-500' : 'text-stone-400'}`}>
        {children}
      </p>
    </div>
  )
}
