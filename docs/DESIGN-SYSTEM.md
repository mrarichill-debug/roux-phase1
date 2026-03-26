# DESIGN SYSTEM
*Roux Phase 2 — March 2026 Design Sprint. Prototypes in `/prototypes/` are the visual source of truth. Do not deviate.*

---

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--forest` | `#3D6B4F` | Primary brand — topbar, Tonight card, CTAs, active nav |
| `--forest-dark` | `#2E5038` | Pressed/active states on forest elements |
| `--sage` | `#7A8C6E` | Secondary accent — Sage AI, borders, section labels |
| `--honey` | `#C49A3C` | Highlight — traditions, alerts, notification dot |
| `--cream` | `#FAF7F2` | App background, bottom nav, cards |
| `--ink` | `#2C2417` | Primary text |
| `--driftwood` | `#8C7B6B` | Secondary text, labels, meta info |
| `--linen` | `#E8E0D0` | Dividers, borders, inactive states |
| `--walnut` | `#8B6F52` | Tradition badges, warm brown accent |
| `--red` | `#A03030` | Error states, over-budget indicator |

**Day type colors:**
```css
--day-school:   #5B8DD9;  /* blue */
--day-weekend:  #7A8C6E;  /* sage green */
--day-noschool: #D4874A;  /* orange */
--day-summer:   #C49A3C;  /* honey */
```

---

## Typography

- **Playfair Display** — headings, meal names, dates, hero text, step numbers. Weights: 400, 500, 600. Italic for brand accents ("oux" in logo, greeting name, Sage messages on recipe card). Load from Google Fonts.
- **Jost** — body text, labels, buttons, meta, UI copy. Weights: 300 (default body), 400, 500 (emphasis). Never use system fonts as fallback for branded moments.
- **Caveat** — handwritten accent only. Family Notes headings, home name on welcome moments, personal notes on recipe cards. Weights 500–600. Font must be loaded before Caveat elements render — never fall back to a system font.
- **Slabo 27px** — secondary display font. Self-hosted at `/fonts/Slabo27px.woff2`. Use in exactly three contexts: (1) screen hero titles ("Your Kitchen." on Meals hub), (2) empty state headlines ("Nothing planned yet."), (3) completion moments ("Meal saved."). Always with trailing period. CSS class: `.slabo-title` (27px, weight 400). Never below 24px or above 32px. Never for navigation, buttons, counts, or functional UI text.

> **⚠ Note:** Fraunces and DM Sans are retired. Do not use them.

---

## Topbar

- Height: **68px** standard / **58px** on recipe card (slim variant).
- Background: `--forest`. Position: sticky, z-index 100.
- Logo: Playfair Display 26px / weight 600. Base color `rgba(250,247,242,0.95)`. Italic "oux" in `rgba(188,218,178,0.82)`.
- **Shadow — exact 4-layer system. Must be preserved:**
  ```css
  box-shadow:
    0 2px  0px rgba(20,40,25,0.55),
    0 4px  8px rgba(20,40,25,0.40),
    0 8px 24px rgba(30,55,35,0.28),
    0 16px 40px rgba(30,55,35,0.14),
    0 1px  0px rgba(255,255,255,0.06) inset;
  ```

---

## Bottom Navigation — 4 Tabs (Updated March 2026)

- Height: **48px** content area + `env(safe-area-inset-bottom, 8px)` padding below. Background: `--cream`. Border-top: `1px solid --linen`. `viewport-fit=cover` required in HTML meta tag.
- 4 tabs: **Home / Week / Meals / Pantry**
- Routes: `/` `/thisweek` `/meals` `/pantry`
- Layout: standard `repeat(4, 1fr)` grid — even spacing.
- **Icons:** Home (house), Week (calendar with pegs), Meals (rounded rect with horizontal lines), Pantry (bullet list).
- **Sage access:** ✦ sparkle icon in topbar (global, every screen) → opens Sage summary sheet.
- Active state: `--forest` color + font-weight 600 + 3px dot below label.
- Inactive: `--driftwood` color, font-weight 400.
- Labels: 9px Jost, 0.3px letter-spacing.
- Shared component: `src/components/BottomNav.jsx` — used on every screen.

---

## Meal Entry States

Three states for planned meals on the Menu Planner:

| State | `entry_type` | Behavior | Visual |
|---|---|---|---|
| **Ghost** | `ghost` | `custom_name` only, no recipe linked | Plain text, no icon |
| **Linked** | `linked` | `recipe_id` set, connected to a recipe | Small recipe book icon |
| **Manual** | `manual` | Shopping items added directly | Small list icon |

Ghost → Linked transition: Sage meal match surfaces recipe suggestions inline. Lauren taps to link. Or she links manually via the recipe picker.

---

## Week View — Day Cards & Header

### Day Type Pills
- Typographic only — **no icons, no emoji**.
- Name in Jost 400, 10px, letter-spacing 0.8px, uppercase.
- Background at 10% opacity of the day type's `color` field. No border, border-radius 4px, padding 2px 8px.
- Color pulled from `day_types.color` record.

### Week Header
- Fixed three-row layout. Fixed height — never shifts.
- **Row 1:** Week label ("THIS WEEK" / "PAST WEEK" / "NEXT WEEK") — Jost 300, 11px, uppercase, 1.2px letter-spacing, driftwood.
- **Row 2:** Date range in Playfair Display 18px.
- **Row 3:** Metadata row — always present, `min-height` maintained even when empty. Contains: status pill (Draft/Published, left), template pill (honey, right), status message line (italic Jost 300 11px driftwood) below pills.
- Navigation arrows absolutely positioned left/right — independent of center content.

### Slot Labels
- `meal_type` → UI label mapping: `breakfast` → "Breakfast", `lunch` → "Lunch", `dinner` → "Dinner", `other` → "Everything else", `meal_prep` → hidden. Never show raw DB field values in UI.

### Day/Day Type Row Layout
- Two-column fixed-width layout for visual alignment uniformity.
- Left column: `min-width: 120px`, `flex-shrink: 0`. Contains date number + day name.
- Date number: `min-width: 24px`, `text-align: right` — so single and double digits align.
- Right column: Day type pill, always starts at the same horizontal position.
- Applied to both collapsed day cards on the week view and day type rows in Week Settings.

### Reusable Components
- `AddDayTypeSheet` (`src/components/AddDayTypeSheet.jsx`) — used in both This Week Settings and Household Defaults screens. Name input + color picker + save.
- `AddToPlanSheet` (`src/components/AddToPlanSheet.jsx`) — week/day/slot picker for scheduling meals. Used in PlanMeal and SavedMeals.

---

## Meals Hub Screen (`/meals`)

Two-zone layout with tagline strip between zones.

**Zone 1 — "Add something"** (zone label in small uppercase driftwood)
- Two equal-height tiles side by side in a 2-column grid:
  - **Plan a Meal** — forest green background, plus icon top-left, "Build it, add it to the week." Routes to `/meals/plan`.
  - **Add a Tradition** — warm off-white `#F0EBE3`, honey star icon, "A meal your family keeps coming back to." Routes to `/meals/traditions/new`.

**Tagline strip** — centered between zones:
- *"Recipes become meals. Meals become your family's story."* — Playfair Display italic 15px, driftwood, line-height 1.6.
- Three separator dots below: `#E4DDD2` / `#C4B8A8` / `#E4DDD2`, 3px each, 6px gap.

**Zone 2 — "Your kitchen"** (zone label)
- Three equal archive tiles in a 3-column grid:
  - **Family Recipes** — live count of complete full recipes. Amber "X to finish" badge if draft recipes exist. Routes to `/meals/recipes`.
  - **Saved Meals** — live count from meals table. Unit: "built". Routes to `/meals/saved`.
  - **Traditions** — live count from household_traditions. Honey star accent. Unit: "kept". Routes to `/meals/traditions`.
- Archive tile layout: icon (16px driftwood) → count (Playfair 22px forest green) → name (Jost 12px ink) → unit (Jost 10px driftwood).
- All counts refresh on window focus.

---

## Color Schemes — Four Options, Household Level

Households can choose from 4 color schemes: **garden** (default), **slate**, **walnut**, **midnight**.

| Scheme | Primary | Personality | Tonight Card | Watermark |
|---|---|---|---|---|
| **Garden** | `#3D6B4F` forest green | Warm, natural, default | Wood grain | ON |
| **Slate** | `#2C3E50` deep slate | Modern, gender-neutral, confident | Solid | OFF |
| **Walnut** | `#5C3D2E` warm walnut | Rich, masculine, kitchen warmth | Wood grain (dark variant) | ON |
| **Midnight** | `#1B2A4A` deep navy | Sophisticated, dark mode | Solid | OFF |

- Scheme stored in `households.color_scheme` field (default: `'garden'`)
- Token definitions: `src/lib/colorSchemes.js`
- Hook: `src/hooks/useColorScheme.js` — reads `households.color_scheme`, applies CSS vars to `:root` on mount
- Theme picker: Profile → Our Kitchen → Kitchen Theme
- Future: user-level scheme override (each person picks their own)

---

## Tonight Card — Scheme-Aware

- `tonightCard: 'wood_grain'` schemes (garden, walnut): existing cutting board CSS treatment
- Walnut variant uses darker grain — rich walnut tones, not blonde maple
- `tonightCard: 'solid'` schemes (slate, midnight): clean card using primary color as background, cream/light text
- `tonightCard` property lives on each scheme token object in `colorSchemes.js`

---

## WatermarkLayer — Scheme-Aware

- `watermark: true` (garden, walnut): show seasonal SVG objects as normal
- `watermark: false` (slate, midnight): WatermarkLayer renders nothing — objects clash with dark/cool backgrounds

---

## Logo Update (March 2026)

- Font changed from Playfair Display to Slabo 27px
- Treatment: **'Roux.'** — with period, no italics, no color differentiation
- Color: cream white `rgba(250,247,242,0.95)` on colored topbars
- This is interim — full logo redesign planned for later phase
- Tagline *"Roux and You — let's make something good."* remains on welcome screen only

---

## Form Inputs

- Border radius: 12px. Border: `1.5px solid --linen`. Background: white.
- Focus: `--sage` border + `rgba(122,140,110,0.12)` outer glow ring.
- Filled/valid: `rgba(61,107,79,0.35)` border.
- Error: `--red` border + `rgba(160,48,48,0.08)` glow.
- Placeholder: `rgba(140,123,107,0.5)`.
- Labels: 11px / weight 500 / letter-spacing 1.5px / uppercase / `--driftwood`.

## Progress Bar (Multi-step Forms)

- Track: 3px height, `--linen` background, border-radius 2px.
- Fill: `--forest`. Transition: `width 0.4s cubic-bezier(0.22,1,0.36,1)`.
- Label: "Step X of 3" / "All done ✓" — 10px caps, `--driftwood`.

## Buttons

- **Primary:** `--forest` background, white text, 14–15px Jost weight 500, border-radius 14px, padding 16px, shadow `0 4px 16px rgba(30,55,35,0.25)`.
- **Secondary/outline:** Transparent background, `--forest` text, `1.5px solid rgba(61,107,79,0.4)` border, same sizing.
- **Active/press:** `--forest-dark` background, `transform: scale(0.98)`.
- **Disabled:** `--linen` background, `--driftwood` text, no shadow.

---

## Sage UI Presence

- Collapsed strip with **left border: `3px solid --sage`**, white background — not a popup, not a takeover.
- Expand/collapse with chevron rotate 0°→180°, 0.28s ease.
- Sage pulse dot: `--sage` color, 2.5s opacity cycle (0.6→0.14→0.6 infinite).
- One nudge visible at a time — never stack multiple Sage messages.
- Dark strip variant (forest green background, light text) used on recipe card only.
- Chat-style input for recipe import only.
- Never a full-screen Sage takeover.

---

## Responsive Design

- **Phone** — single column, 48px minimum tap targets, bottom navigation. Primary build target.
- **Tablet** — two columns, sidebar navigation, more content visible.
- **Desktop** — three columns, full sidebar, dashboard view.

---

## Animation & Motion

*All animations should feel intentional and warm — never flashy. The guiding principle: you should feel it before you notice it.*

### Global — Page Load
- All primary content blocks: `fadeUp` entrance — `opacity: 0→1`, `translateY(10px→0)`, `0.4s ease`.
- Staggered `animation-delay` per section: 0s, 0.05s, 0.10s, 0.14s, 0.18s, 0.22s.
- Tonight card: stagger 0.05s + settle animation (see below).
- Week strip pips: stagger left-to-right, 40ms per pip, 280ms total.

### Tonight Card
- **Settle entrance:** `scale(1.012)→scale(1)`, 350ms ease-out, fires after fadeUp completes. Like a board being set on a counter. Do not skip.
- Active/press: box-shadow compresses.

### Sage Card — Expand/Collapse
- Chevron: rotate `0°→180°`, 0.28s ease.
- Preview text: fade OUT 100ms before expanded body fades in.
- Expanded body: `max-height: 0→130px`, `opacity: 0→1`, 0.32s ease / 0.22s ease.
- Sage pulse dot: `opacity: 0.6→0.14→0.6`, 2.5s infinite.

### Meal Card — Added to Slot
- New meal: `scale(0.92)→scale(1)` + fade in, 220ms.

### Publish Flow
Sequential chain on "Share this week with the family":
1. Status dot: amber→green, 150ms
2. Banner: shifts to published green, 200ms
3. Publish bar: opacity→0, slides down, 300ms → `display:none`
- Offset each step 60ms for chain-reaction feel.
- Banner pulse: `scale(1.02)→scale(1)`, 150ms.

### Bottom Sheet
- Rise: `translateY(100%)→translateY(0)`, `cubic-bezier(0.32,0.72,0,1)`, 320ms.
- Overlay: darkens with 40ms delay — sheet feels like it emerges from the page.
- Close: reverse.

### Recipe Card
- Tab crossfade: 200ms opacity cross-dissolve (`panelFade`).
- Ingredient checkbox: `checkPulse` — `scale(1.22)` on tap, 180ms, returns to 1.
- Step completion: `.completing` opacity dip (~0.5), 180ms → transitions to done state.

### Shopping List
- **Item check:** Checkmark stroke-dashoffset `20→0`, 200ms ease. Simultaneous: item `opacity: 1→0.4`, 300ms, then relocates to Got It section.
- **Got It item entrance:** `translateY(6px)→translateY(0)` + `opacity: 0→1`, 220ms ease.
- **Got It section expand/collapse:** `max-height: 0→content height`, 280ms ease. Never snaps.
- **Start Shopping press:** `scale(0.97)→scale(1)`, 150ms → status pill cross-fades amber→green, 200ms.
- **Sage strip fade-out on Start Shopping:** `opacity: 1→0`, 200ms → `display:none`.
- **Done Shopping → Complete card:** `fadeUp` from below, 350ms. Screen auto-scrolls to top simultaneously.
- **Budget In Cart number:** `scale(1.06)→scale(1)` pulse, 180ms, on each check/uncheck.
- **Remaining value color change:** green→amber crossfade, 300ms.

### Watermark Objects
- Fade in: `opacity: 0→target (0.07)`, 1.4s ease, staggered 200ms per object.
- Parallax on scroll: `translateY` at rates 0.10×, 0.15×, 0.20× per slot. `requestAnimationFrame` with ticking flag.

---

## Haptic Feedback

- Haptic feedback is **OFF by default**. User-controlled toggle in profile settings.
- Toggle label: "Vibration feedback" / subtitle: "Feel a gentle tap when taking actions."
- Stored as `haptic_feedback_enabled BOOLEAN DEFAULT FALSE` on the `users` table.
- Shared `haptic(pattern)` utility — checks `navigator.vibrate` + user preference before firing.
- Patterns: light tap / medium confirm / double-tap error.
- Wire to: nav taps, action buttons, ingredient checkboxes, step completions, Sage interactions.
- **iOS Safari does not support the Vibration API.** Must fail silently — no error, no fallback UI.

---

## Watermark System

*The watermark layer is a signature design element — seasonal, warm, and unobtrusive. Must be a reusable React component.*

### Architecture

- **Component:** `WatermarkLayer` — accepts a `season` prop (auto-detected) and `decorationSet` prop (from household record).
- **SVG objects:** Extract all SVGs to `src/lib/decorObjects.js` — keyed object map.
- **Seasonal configs:** Extract to `src/lib/decorSets.js` — maps season keys to slot/object/scale/opacity/delay arrays.
- **Database:** `decoration_set TEXT DEFAULT 'default'` on the `households` table.
- **Build order:** Build core layout first, add WatermarkLayer last.

### Layer Setup
```css
#wm-layer {
  position: fixed;
  top: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 430px; height: 100%;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.wm-object {
  position: absolute;
  pointer-events: none;
  opacity: 0;
  color: rgba(60, 42, 22, 1);
}
```

### Slots
| Slot | Position | Parallax Rate |
|---|---|---|
| `top-right` | `top: 78px`, `right: -4px` | 0.10× scroll |
| `mid-left` | `top: 42%`, `left: -8px` | 0.15× scroll |
| `bot-right` | `bottom: 68px`, `right: -4px` | 0.20× scroll |

*Slot positions should be viewport-height-relative in real build — not hardcoded px.*

### Seasonal Sets
| Season | Months | top-right | mid-left | bot-right |
|---|---|---|---|---|
| Spring | Mar–May | Recipe box | Herbs | Spice jars |
| Summer | Jun–Aug | Lemon | Olive oil | Herbs |
| Fall | Sep–Nov | Cookie jar | Cutting board | Pinecone |
| Winter | Dec–Feb | Cookie jar | Cast iron | Pinecone |

### Parallax Code Pattern
```js
window.addEventListener('scroll', () => {
  requestAnimationFrame(() => {
    objects.forEach(({ el, rate }) => {
      el.style.transform = `translateY(${-(scrollY * rate).toFixed(2)}px)`;
    });
  });
}, { passive: true });
```
