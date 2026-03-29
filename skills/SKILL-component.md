# Skill: Building React Components in Roux

## File Structure
- Pages go in `src/pages/` — one component per file, default export
- Shared components go in `src/components/`
- Hooks go in `src/hooks/`
- Utilities go in `src/lib/`

## Color Tokens
Always use the `C` object — never hardcode hex values:
```js
const C = {
  forest: '#3D6B4F',    // Primary brand, CTAs, active states
  forestDark: '#2E5038', // Press states
  cream: '#FAF7F2',      // App background
  ink: '#2C2417',         // Primary text
  driftwood: '#8C7B6B',  // Secondary text, labels
  driftwoodSm: '#6B5B4E', // Darker secondary (used on white bg)
  linen: '#E8E0D0',      // Borders, dividers
  sage: '#7A8C6E',       // Sage AI, secondary accent
  honey: '#C49A3C',      // Highlights, alerts, traditions
  red: '#A03030',         // Error states
}
```

## Typography
- Playfair Display — headings, meal names, hero text
- Jost — body, labels, buttons, UI (weights: 300 default, 400, 500)
- Caveat — handwritten accent only (notes, personal touches)
- Slabo 27px — hero titles, empty states, completion moments (always with trailing period)

## Common Patterns
- **TopBar:** `import TopBar from '../components/TopBar'` — slim variant for inner pages
- **BottomNav:** `import BottomNav from '../components/BottomNav'` — always include, set `activeTab`
- **Safe strings:** `const s = (val) => (val == null ? '' : String(val).trim())` before any DB insert
- **Activity logging:** Fire-and-forget after primary action succeeds
- **Bottom sheets:** `animation: 'sheetRise 0.28s cubic-bezier(0.22,1,0.36,1) both'`
- **Cards:** `background: 'white', border: '1px solid rgba(200,185,160,0.55)', borderRadius: '16px', padding: '18px'`

## Navigation
- Explicit routes, never `navigate(-1)` on named screens
- Pass `onBeforeNavigate` to BottomNav for unsaved changes guard
- Global icons (Sage sparkle, bell, avatar) hidden on `/onboarding`

## Content Padding
- Nav is 48px. Content paddingBottom: `calc(64px + env(safe-area-inset-bottom, 8px))`
- Pinned CTAs: `bottom: calc(48px + env(safe-area-inset-bottom, 8px))`
