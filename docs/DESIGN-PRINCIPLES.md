# Design Principles
*Roux Phase 2 — Established April 12, 2026*

---

## Search & Filter Pattern

All list screens in Roux use the same search + filter pattern:

- **Search input** with a magnifying glass icon on the left, `padding: 10px 14px 10px 36px`, `border: 1px solid rgba(200,185,160,0.55)`, `borderRadius: 10px`, Jost 14px 300 weight.
- **Filter icon** (sliders) to the right of the search input. Tapping opens a BottomSheet with filter options as toggle pills. A small honey dot appears on the icon when any filter is active.
- **Active filter summary** line below the search bar (driftwood 12px, tappable to reopen the sheet). Only visible when filters are active.
- **Filter sheet** uses BottomSheet with `maxHeight="70vh"`. Sections separated by 18px gap. Each section has a 10px uppercase label. Pills use `borderRadius: 20px`, `padding: 6px 14px`, arc color when active. "Show [items]" CTA at the bottom + "Clear all" link when filters are active.
- **Canonical implementation:** `src/pages/RecipeLibrary.jsx` (search + tag filter + system pills). `src/pages/Meals.jsx` mirrors the same structure for meal-specific filters.

Do not use inline pill rows for filtering on list screens. Always use the search bar + filter icon + sheet pattern.
