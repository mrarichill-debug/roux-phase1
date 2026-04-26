# DESIGN SYSTEM AUDIT
*Roux Phase 2 — Generated 2026-04-25. Source of truth: `docs/DESIGN-SYSTEM.md` + `:root` in `src/styles/global.css`.*

This audit inventories design-token drift across `src/`, proposes a JS token module, and lays out a migration plan. **No code edits made** — review before acting.

---

## 1. Headline Findings

| Finding | Count | Severity |
|---|---:|---|
| Files redeclaring an inline `const C = {...}` palette | **41** | High |
| Inline palette **shapes diverge** between files (different keys per file) | 41 / 41 | High |
| Distinct hex literals in `src/` | **40+** | High |
| Distinct `rgba(...)` literals in `src/` | **80+** | High |
| Distinct hand-written `boxShadow` strings | **25+** | Medium |
| Tokens used in code but **missing from `docs/DESIGN-SYSTEM.md`** | 4 (`forestDk`, `driftwoodSm`, `honeyDark`, `linen` variant `#E4DDD2`) | High |
| Off-palette one-off colors leaking in (likely Tailwind stone defaults) | 9 | Medium |
| `--app-bg` defined in `:root` but referenced almost nowhere | 1 | Low |

**Bottom line:** the `:root` CSS variables in `global.css` are essentially dead code — every page reads from a per-file hex object instead. The doc and the implementation have diverged.

---

## 2. Inventory of Drift

### 2.1 Files with inline `const C = {...}` palette (41)

| Layer | Files |
|---|---|
| **Pages (28)** | [AdminDashboard.jsx](src/pages/AdminDashboard.jsx), [CalendarConnect.jsx](src/pages/CalendarConnect.jsx), [Dashboard.jsx](src/pages/Dashboard.jsx), [DevReset.jsx](src/pages/DevReset.jsx), [EatingOutReceipt.jsx](src/pages/EatingOutReceipt.jsx), [EditRecipe.jsx](src/pages/EditRecipe.jsx), [EventsPage.jsx](src/pages/EventsPage.jsx), [HouseholdDefaults.jsx](src/pages/HouseholdDefaults.jsx), [Meals.jsx](src/pages/Meals.jsx), [Onboarding.jsx](src/pages/Onboarding.jsx), [Pantry.jsx](src/pages/Pantry.jsx), [PantryList.jsx](src/pages/PantryList.jsx), [PantryTrip.jsx](src/pages/PantryTrip.jsx), [PlanMeal.jsx](src/pages/PlanMeal.jsx), [Profile.jsx](src/pages/Profile.jsx), [ReceiptScan.jsx](src/pages/ReceiptScan.jsx), [RecipeCard.jsx](src/pages/RecipeCard.jsx), [RecipeLibrary.jsx](src/pages/RecipeLibrary.jsx), [SaveRecipe.jsx](src/pages/SaveRecipe.jsx), [SavedMeals.jsx](src/pages/SavedMeals.jsx), [SettingsHub.jsx](src/pages/SettingsHub.jsx), [ShoppingList.jsx](src/pages/ShoppingList.jsx), [ShoppingTrip.jsx](src/pages/ShoppingTrip.jsx), [Staples.jsx](src/pages/Staples.jsx), [ThisWeek.jsx](src/pages/ThisWeek.jsx), [ThisWeekSettings.jsx](src/pages/ThisWeekSettings.jsx), [WeekReview.jsx](src/pages/WeekReview.jsx), [WeekSettings.jsx](src/pages/WeekSettings.jsx), [WeeklyReview.jsx](src/pages/WeeklyReview.jsx), [welcome/welcomeUtils.jsx](src/pages/welcome/welcomeUtils.jsx) |
| **Components (11)** | [AddDayTypeSheet.jsx](src/components/AddDayTypeSheet.jsx), [AddMealFlow.jsx](src/components/AddMealFlow.jsx), [AddToPlanSheet.jsx](src/components/AddToPlanSheet.jsx), [BottomNav.jsx](src/components/BottomNav.jsx), [BottomSheet.jsx](src/components/BottomSheet.jsx), [ProfileSheet.jsx](src/components/ProfileSheet.jsx), [SageIntelligenceCard.jsx](src/components/SageIntelligenceCard.jsx), [SageNudgeCard.jsx](src/components/SageNudgeCard.jsx), [ShoppingOnboarding.jsx](src/components/ShoppingOnboarding.jsx), [TopBar.jsx](src/components/TopBar.jsx), [UnsavedChangesSheet.jsx](src/components/UnsavedChangesSheet.jsx) |

### 2.2 Palette shape divergence

The `C` object is **not** the same shape file-to-file:

| File | Keys defined |
|---|---|
| [ThisWeek.jsx:26](src/pages/ThisWeek.jsx:26) | forest, cream, ink, driftwood, **driftwoodSm**, linen, sage, honey, **honeyDark**, red |
| [Dashboard.jsx](src/pages/Dashboard.jsx) | forest, **forestDk**, sage, honey, cream, ink, driftwood, **driftwoodSm**, linen, walnut |
| [RecipeLibrary.jsx](src/pages/RecipeLibrary.jsx) | forest, **forestDk**, sage, honey, cream, ink, driftwood, **driftwoodSm**, linen, walnut |
| [Pantry.jsx](src/pages/Pantry.jsx) | forest, cream, ink, driftwood, linen, sage *(no honey, no red)* |
| [Meals.jsx](src/pages/Meals.jsx) | forest, cream, ink, driftwood, linen, honey *(no sage)* |
| [BottomSheet.jsx](src/components/BottomSheet.jsx) | cream, ink, **linen: `#E4DDD2`** *(divergent value!)*, **backdrop: `rgba(44,36,23,0.5)`** |
| [TopBar.jsx](src/components/TopBar.jsx) | forest, cream + bespoke `SHADOW` const |

**Critical drift:** [BottomSheet.jsx](src/components/BottomSheet.jsx) defines `linen: '#E4DDD2'` while everywhere else uses `#E8E0D0`. Both are referenced as "linen" — there are effectively two linens in the system.

### 2.3 Top hardcoded hex values, mapped to canonical tokens

| Hex | Count | Canonical Token | Action |
|---|---:|---|---|
| `#8C7B6B` | 65 | `--driftwood` | Replace |
| `#3D6B4F` | 59 | `--forest` | Replace |
| `#FAF7F2` | 55 | `--cream` | Replace |
| `#2C2417` | 55 | `--ink` | Replace |
| `#7A8C6E` | 42 | `--sage` | Replace |
| `#E8E0D0` | 40 | `--linen` | Replace |
| `#C49A3C` | 36 | `--honey` | Replace |
| `#E4DDD2` | 25 | **none — divergent linen** | Decide: alias to `--linen` or add `--linen-warm` |
| `#A03030` | 20 | `--red` | Replace |
| `#6B5B4E` | 17 | **none — undocumented `driftwoodSm`** | Add `--driftwood-dk` to docs + `:root` |
| `#8B6F52` | 11 | `--walnut` | Replace |
| `#2E5038` | 11 | `--forest-dk` | Replace |
| `#D4874A` | 5 | `--day-noschool` | Replace |
| `#5B8DD9` | 5 | `--day-school` | Replace |
| `#EFF4EC` | 3 | **none** — light forest tint | Derive from `--forest` (alpha) or add `--forest-tint` |
| `#7A5C14` | 2 | **none — undocumented `honeyDark`** | Add `--honey-dk` to docs + `:root` |
| `#A07830`, `#C4B8A8`, `#D6CCBA`, `#E8C49A`, `#DEBA8E`, `#D4AE84`, `#C8D9C0`, `#A8A29E`, `#78716C`, `#44403C`, `#e7e5e4`, `#F5F0E8`, `#FDF8F0` | 1–4 each | **off-palette** | Investigate — likely Tailwind stone leakage or one-off polish |

### 2.4 Top hardcoded `rgba(...)` values, mapped to alpha steps

| Literal | Count | Base Token | Proposed Step Name |
|---|---:|---|---|
| `rgba(61,107,79,0.08)` | 38 | `--forest` | `forest/8` |
| `rgba(250,247,242,0.95)` | 34 | `--cream` | `cream/95` (text-on-forest) |
| `rgba(30,55,35,0.25)` | 31 | shadow base | `shadow/forest-25` (E3 elevation) |
| `rgba(0,0,0,0.15)` | 17 | neutral | `shadow/black-15` (E2 alt) |
| `rgba(250,247,242,0.15)` | 13 | `--cream` | `cream/15` |
| `rgba(200,185,160,0.55)` | 13 | **undocumented `#C8B9A0`** | `linen-dk/55` — see below |
| `rgba(61,107,79,0.4)` | 10 | `--forest` | `forest/40` |
| `rgba(250,247,242,0.7)` | 10 | `--cream` | `cream/70` |
| `rgba(200,185,160,0.15)` | 10 | undoc. linen-dk | `linen-dk/15` |
| `rgba(200,185,160,0.20)` | 9 | undoc. linen-dk | `linen-dk/20` |
| `rgba(61,107,79,0.10)` | 8 | `--forest` | `forest/10` |
| `rgba(80,60,30,0.06)` | 7 | **undocumented brown shadow** | `shadow/warm-06` (E1 elevation) |
| `rgba(196,154,60,0.12)` | 5 | `--honey` | `honey/12` |
| `rgba(122,140,110,0.12)` | 5 | `--sage` | `sage/12` |
| `rgba(160,48,48,0.07)` | 3 | `--red` | `red/7` |
| 50+ others at 1–3 uses each | — | various | mostly noise — collapse into the steps below |

**Two undocumented base colors leak through alpha:**

1. **`rgb(200,185,160)` = `#C8B9A0`** — a darker linen used for borders and inactive surfaces. Appears 50+ times across 8+ alpha steps. Either rename to `--linen-dk` and document, or replace with `--driftwood` at low alpha (visually close).
2. **`rgb(80,60,30)` = `#503C1E`** — a warm brown used only in shadows. Always low alpha (0.05–0.07). Should be the canonical "warm shadow" base for E1 elevations.

### 2.5 Recurring `boxShadow` strings → proposed elevation scale

| Frequency | String | Proposed Name | Use |
|---:|---|---|---|
| ~31 | `0 4px 16px rgba(30,55,35,0.25)` | **`elevation.modal`** (E3) | Bottom sheets, Sage cards, primary CTAs |
| ~7 | `0 1px 4px rgba(80,60,30,0.06)` | **`elevation.card`** (E1) | Standard cards |
| ~7 | `0 1px 4px rgba(80,60,30,0.07)` | (collapse into E1) | — |
| ~5 | `0 2px 6px rgba(80,60,30,0.06)` | **`elevation.cardRaised`** (E2) | Day cards, accordion headers |
| ~5 | `0 2px 8px rgba(0,0,0,0.06)` | (collapse into E2) | — |
| ~4 | `0 4px 16px rgba(0,0,0,0.15)` | **`elevation.toast`** | Toasts, popovers |
| ~3 | `0 8px 32px rgba(44,36,23,0.18)` | **`elevation.drawer`** (E4) | Full bottom drawer |
| ~3 | `0 1px 3px rgba(0,0,0,0.15)` | **`elevation.chip`** | Toggle dots, small interactive |
| ~2 | `0 1px 4px rgba(80,60,30,0.07), 0 3px 12px rgba(80,60,30,0.05)` | **`elevation.cardComposite`** | Used on hero cards |
| 1× (bespoke) | 4-layer topbar shadow ([TopBar.jsx:9](src/components/TopBar.jsx:9)) | **`elevation.topbar`** | Already named locally — promote |

**Six elevation tokens** would absorb ~85% of the ad-hoc shadow strings.

---

## 3. Proposed Token Module — `src/styles/tokens.js`

```js
// src/styles/tokens.js
// Single source of truth for design tokens in JS.
// Mirrors :root in src/styles/global.css and docs/DESIGN-SYSTEM.md.
// Inline `const C = {...}` palette objects in pages/components should be removed
// in favor of importing from here.

// ── Base palette ─────────────────────────────────────────────────────────────
export const color = {
  forest:      '#3D6B4F',
  forestDk:    '#2E5038',
  sage:        '#7A8C6E',
  honey:       '#C49A3C',
  honeyDk:     '#7A5C14',  // promoted from session notes; document in DESIGN-SYSTEM.md
  cream:       '#FAF7F2',
  ink:         '#2C2417',
  driftwood:   '#8C7B6B',
  driftwoodDk: '#6B5B4E',  // was driftwoodSm in inline objects; rename
  linen:       '#E8E0D0',
  linenDk:     '#C8B9A0',  // formerly an undocumented rgb base for borders
  walnut:      '#8B6F52',
  red:         '#A03030',

  // Day-type accents (already documented)
  daySchool:   '#5B8DD9',
  dayWeekend:  '#7A8C6E',
  dayNoSchool: '#D4874A',
  daySummer:   '#C49A3C',
}

// ── Alpha steps ──────────────────────────────────────────────────────────────
// Use alpha() helper below, OR these named constants for the most common steps.
// Keep this list tight — if a one-off alpha is needed, justify it in review.
export const alpha = {
  forest: {
    6:  'rgba(61,107,79,0.06)',
    8:  'rgba(61,107,79,0.08)',
    10: 'rgba(61,107,79,0.10)',
    15: 'rgba(61,107,79,0.15)',
    25: 'rgba(61,107,79,0.25)',
    40: 'rgba(61,107,79,0.40)',
  },
  honey: {
    8:  'rgba(196,154,60,0.08)',
    10: 'rgba(196,154,60,0.10)',
    12: 'rgba(196,154,60,0.12)',
    30: 'rgba(196,154,60,0.30)',
  },
  sage: {
    6:  'rgba(122,140,110,0.06)',
    8:  'rgba(122,140,110,0.08)',
    10: 'rgba(122,140,110,0.10)',
    12: 'rgba(122,140,110,0.12)',
  },
  cream: {
    15: 'rgba(250,247,242,0.15)',
    50: 'rgba(250,247,242,0.50)',
    70: 'rgba(250,247,242,0.70)',
    90: 'rgba(250,247,242,0.90)',
    95: 'rgba(250,247,242,0.95)',  // canonical text-on-forest color
  },
  linenDk: {
    15: 'rgba(200,185,160,0.15)',
    20: 'rgba(200,185,160,0.20)',
    25: 'rgba(200,185,160,0.25)',
    45: 'rgba(200,185,160,0.45)',
    55: 'rgba(200,185,160,0.55)',
  },
  red: {
    7:  'rgba(160,48,48,0.07)',
    20: 'rgba(160,48,48,0.20)',
  },
}

// ── Shadow base colors (kept private — use elevation tokens below) ───────────
const _shadow = {
  warm:    'rgba(80,60,30,',     // E1, E2 (warm card shadow)
  forest:  'rgba(30,55,35,',     // E3 (modal/CTA)
  brown:   'rgba(44,36,23,',     // E4 (drawer)
  black:   'rgba(0,0,0,',        // toast/popover
}

// ── Elevation tokens ─────────────────────────────────────────────────────────
export const elevation = {
  card:           `0 1px 4px ${_shadow.warm}0.06)`,
  cardRaised:     `0 2px 6px ${_shadow.warm}0.06)`,
  cardComposite:  `0 1px 4px ${_shadow.warm}0.07), 0 3px 12px ${_shadow.warm}0.05)`,
  chip:           `0 1px 3px ${_shadow.black}0.15)`,
  modal:          `0 4px 16px ${_shadow.forest}0.25)`,
  toast:          `0 4px 16px ${_shadow.black}0.15)`,
  drawer:         `0 8px 32px ${_shadow.brown}0.18)`,
  topbar: [
    `0 2px 0px ${_shadow.forest.replace('30,55,35,','20,40,25,')}0.55)`,
    `0 4px 8px ${_shadow.forest.replace('30,55,35,','20,40,25,')}0.40)`,
    `0 8px 24px ${_shadow.forest}0.28)`,
    `0 16px 40px ${_shadow.forest}0.14)`,
    `0 1px 0px rgba(255,255,255,0.06) inset`,
  ].join(', '),
}

// ── Optional alpha helper (for one-offs that genuinely don't fit a step) ─────
const _hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}
export const alphaOf = (token, a) => `rgba(${_hexToRgb(color[token])},${a})`

// ── Convenience for legacy callsites ─────────────────────────────────────────
// Drop-in replacement for the old `const C = {...}` pattern. Every page can
// `import { C } from 'src/styles/tokens'` during migration without rewriting
// every property access — then prefer `color.forest` going forward.
export const C = {
  forest: color.forest, forestDk: color.forestDk,
  sage: color.sage, honey: color.honey, honeyDark: color.honeyDk,
  cream: color.cream, ink: color.ink,
  driftwood: color.driftwood, driftwoodSm: color.driftwoodDk,
  linen: color.linen, walnut: color.walnut, red: color.red,
}
```

**Rationale for the `C` re-export:** the migration is mechanical for 85% of callsites if `C` keeps the same shape. New code should prefer `color.*`, `alpha.*`, `elevation.*`, but the legacy alias keeps PRs reviewable.

---

## 4. Migration Plan

Ordered by traffic and visibility. Each step is a single PR-sized change.

### Phase 1 — Token foundation (no behavior change)

1. **Create `src/styles/tokens.js`** with the module above.
2. **Add the missing tokens to `:root` in `global.css`** so the JS and CSS sides agree:
   - `--forest-dk` *(already present)*, `--honey-dk: #7A5C14`, `--driftwood-dk: #6B5B4E`, `--linen-dk: #C8B9A0`
3. **Update `docs/DESIGN-SYSTEM.md`** — see §5 below.

### Phase 2 — High-traffic page migration (one PR each)

| # | File | Color literals | One-line change |
|---:|---|---:|---|
| 1 | [src/pages/ThisWeek.jsx](src/pages/ThisWeek.jsx) | 31 | Replace inline `C`, swap 7 boxShadows to `elevation.*`, lift `rgba(196,154,60,0.12)` event pill to `alpha.honey[12]`. |
| 2 | [src/pages/Dashboard.jsx](src/pages/Dashboard.jsx) | 26 | Replace inline `C`; resolve any references to `forestDk` → `color.forestDk`. |
| 3 | [src/pages/RecipeLibrary.jsx](src/pages/RecipeLibrary.jsx) | 24 | Same pattern as Dashboard (palette objects are identical). |
| 4 | [src/pages/ShoppingList.jsx](src/pages/ShoppingList.jsx) | 45 | Highest density in the codebase — convert `C`, audit its 9 unique boxShadows against the elevation scale; flag any genuine new shadow. |
| 5 | [src/pages/RecipeCard.jsx](src/pages/RecipeCard.jsx) | 29 | Same. Watch for slim-topbar shadow variant — may need to derive from `elevation.topbar`. |
| 6 | [src/pages/SaveRecipe.jsx](src/pages/SaveRecipe.jsx) | 23 | Same. Has 7 boxShadows. |
| 7 | [src/pages/Profile.jsx](src/pages/Profile.jsx) | 26 | Same. |
| 8 | [src/pages/WeekSettings.jsx](src/pages/WeekSettings.jsx) | 35 | Heavy `linenDk` borders — verify mapping vs. driftwood-low-alpha alternative. |

### Phase 3 — Component migration

| # | File | Notes |
|---:|---|---|
| 9 | [src/components/AddMealFlow.jsx](src/components/AddMealFlow.jsx) | 599 LOC, embedded everywhere — high blast radius. Migrate carefully. |
| 10 | [src/components/BottomSheet.jsx](src/components/BottomSheet.jsx) | **Resolve `linen: #E4DDD2` divergence first** — decide whether to keep as `linen-warm` or unify to `--linen`. Suspect it was a one-off polish that drifted. |
| 11 | [src/components/TopBar.jsx](src/components/TopBar.jsx) | Replace local `SHADOW` const with `elevation.topbar`. |
| 12 | [src/components/BottomNav.jsx](src/components/BottomNav.jsx), [SageIntelligenceCard.jsx](src/components/SageIntelligenceCard.jsx), [SageNudgeCard.jsx](src/components/SageNudgeCard.jsx), [AddDayTypeSheet.jsx](src/components/AddDayTypeSheet.jsx), [AddToPlanSheet.jsx](src/components/AddToPlanSheet.jsx), [ProfileSheet.jsx](src/components/ProfileSheet.jsx), [UnsavedChangesSheet.jsx](src/components/UnsavedChangesSheet.jsx), [ShoppingOnboarding.jsx](src/components/ShoppingOnboarding.jsx) | Mechanical — small files, identical pattern. Bundle into 1 PR. |

### Phase 4 — Remaining pages (mechanical)

13. Bundle the 17 remaining low-density pages into 2–3 PRs (Pantry suite, settings suite, welcome flow, admin/dev).

### Phase 5 — Off-palette cleanup

14. **Investigate the 9 off-palette one-off hexes** (`#A07830`, `#C4B8A8`, `#D6CCBA`, `#E8C49A`, `#DEBA8E`, `#D4AE84`, `#C8D9C0`, `#A8A29E`, `#78716C`, `#44403C`, `#e7e5e4`, `#F5F0E8`, `#FDF8F0`) — likely Tailwind stone leakage from earlier scaffolding or genuine one-off polish. Either promote to a token or replace with the nearest canonical color.
15. **Add a lint guard** — ESLint rule (or simple grep in CI) that fails the build on:
    - `const C = {` outside `src/styles/tokens.js`
    - `rgba(` or `#[0-9a-f]{6}` literals in `src/pages/` and `src/components/`

---

## 5. Additions to `docs/DESIGN-SYSTEM.md`

The following are used in production code today but absent from the doc. Add them to make the doc the genuine source of truth:

### 5.1 Color palette additions

| Token | Hex | Usage |
|---|---|---|
| `--honey-dk` | `#7A5C14` | Honey-on-honey text (event pill labels), pressed honey states |
| `--driftwood-dk` | `#6B5B4E` | Stronger meta text, secondary labels needing more contrast than `--driftwood` |
| `--linen-dk` | `#C8B9A0` | Border/inactive surfaces — used at 15–55% alpha across the app |

Note: `#E4DDD2` ("warm linen" used only in [BottomSheet.jsx](src/components/BottomSheet.jsx)) needs a product decision before it's promoted to a token. Recommend collapsing to `--linen` unless the divergence is intentional.

### 5.2 Alpha-step convention

Document the canonical alpha steps so future code references them by name, not by raw rgba:

```
forest:    /6  /8  /10  /15  /25  /40
honey:     /8  /10  /12  /30
sage:      /6  /8  /10  /12
cream:     /15 /50  /70  /90  /95
linen-dk:  /15 /20  /25  /45  /55
red:       /7  /20
```

Rule: prefer the step nearest your need. New steps added only when a palette/UI moment genuinely requires it — review-gated.

### 5.3 Shadow elevation scale

| Name | Value | Use |
|---|---|---|
| `elevation.card` | `0 1px 4px rgba(80,60,30,0.06)` | Standard cards |
| `elevation.cardRaised` | `0 2px 6px rgba(80,60,30,0.06)` | Day cards, accordion headers |
| `elevation.cardComposite` | `0 1px 4px rgba(80,60,30,0.07), 0 3px 12px rgba(80,60,30,0.05)` | Hero/Tonight card |
| `elevation.chip` | `0 1px 3px rgba(0,0,0,0.15)` | Toggle dots, small interactive chips |
| `elevation.modal` | `0 4px 16px rgba(30,55,35,0.25)` | Bottom sheets, Sage cards, primary CTAs |
| `elevation.toast` | `0 4px 16px rgba(0,0,0,0.15)` | Toasts, popovers |
| `elevation.drawer` | `0 8px 32px rgba(44,36,23,0.18)` | Full bottom drawer |
| `elevation.topbar` | (4-layer composite — see [TopBar.jsx:9](src/components/TopBar.jsx:9)) | Topbar only |

Rule: every `boxShadow` in the codebase must come from this scale. New entries require a design review.

### 5.4 "Where to find it" cross-reference

Add a short pointer at the top of `DESIGN-SYSTEM.md`:

> **JS access:** `import { color, alpha, elevation } from 'src/styles/tokens'`
> **CSS access:** `var(--forest)`, `var(--honey)`, etc. — defined in `src/styles/global.css`
> Both reflect the same token table. Do not introduce hex literals in component files.

---

## 6. Open Questions for Review

1. **`#E4DDD2` linen variant** — is this an intentional warmer linen for surfaces that sit on the cream background, or did a polish pass drift? Decision affects whether we add `--linen-warm` or collapse it.
2. **`linen-dk` (`#C8B9A0`) vs. `driftwood` at low alpha** — both are visually similar at 15–25% alpha. One token would be cleaner. Worth a side-by-side check on the day cards in [ThisWeek.jsx](src/pages/ThisWeek.jsx).
3. **Off-palette stone-family colors** (`#78716C`, `#44403C`, `#A8A29E`, `#e7e5e4`) look like Tailwind defaults — confirm they're meant to be replaced, not retained.
4. **Migration sequencing** — propose Phase 1 + Phase 2 step 1 (ThisWeek) as the first PR, so the conversion pattern is established on the highest-traffic file before fanning out.

---

## 7. Estimated Effort

| Phase | PRs | Effort |
|---|---:|---|
| 1 — Foundation | 1 | ~30 min |
| 2 — High-traffic pages | 8 | ~1 hr each (mechanical + smoke test) |
| 3 — Components | 4 | ~1 hr each (BottomSheet needs decision) |
| 4 — Remaining pages | 3 | ~45 min each |
| 5 — Off-palette + lint | 1 | ~1 hr |
| **Total** | **17** | **~14 hours** spread over a sprint |

The audit, the token module, and Phase 1 are the critical unlock. Phases 2–4 can be parallelized or incremental.
