# SCREEN SPECIFICATIONS
*Roux Phase 2 — March 2026. Prototypes in `/prototypes/` are the visual source of truth. Read these specs alongside the prototype HTML. Do not deviate.*

---

## Prototype File Registry

| File | Screen | Status |
|---|---|---|
| `roux-welcome-screen1.html` | Welcome — New vs. Returning | ✅ ACTIVE |
| `roux-welcome-screen2.html` | Intent — Start vs. Join | ✅ ACTIVE |
| `roux-welcome-screen3a.html` | Create a Home | ✅ ACTIVE |
| `roux-welcome-screen3b.html` | Join a Home | ✅ ACTIVE |
| `roux-welcome-screen4.html` | Sign In — Returning Users | ✅ ACTIVE |
| `roux-dashboard-cuttingboard.html` | Dashboard — Home | ✅ ACTIVE (default) |
| `roux-thisweek-style1-objects.html` | This Week Planner | ✅ ACTIVE |
| `roux-library-style1-objects.html` | Recipe Library | ✅ ACTIVE |
| `roux-recipe-card-style1-objects.html` | Recipe Card | ✅ ACTIVE |
| `roux-shopping-style1.html` | Shopping List | ✅ ACTIVE |
| `roux-build-notes.docx` | Full build spec & design decisions | ✅ ACTIVE |
| `roux-dashboard-style1-objects.html` | Dashboard — Green Tonight | ⛔ Superseded by cutting board |

---

## Screen 1 — Welcome (`roux-welcome-screen1.html`)

- **Purpose:** Entry point. New vs. returning user.
- Large "Roux" wordmark: Playfair Display 58px / weight 600. "R" in `--ink`, italic "oux" in `--forest`.
- Tagline: *"Roux and You — let's make something good."* — appears on this screen ONLY. Not repeated anywhere else in the app.
- Small cutting board + herbs + spoon SVG illustration, centered.
- Two buttons: **Get Started** (primary, forest) + **Sign In** (secondary, outline).
- Invite hint below buttons: "Joining someone's home? Use your invite link."
- Ghost recipe box SVG, bottom-right, ~5.5% opacity.
- Staggered entrance: logo → tagline → divider → illustration → buttons (delays 0.2s, 0.85s, 1.05s, 1.15s, 1.25s).

---

## Screen 2 — Intent (`roux-welcome-screen2.html`)

- **Purpose:** Route to "Start a home" vs "Join a home."
- Heading: "Let's get you set up."
- Two large choice cards with icon, title, description, arrow:
  - **Start from scratch** — forest green icon tint, house+plus icon
  - **Join a home** — honey icon tint, people+plus icon
- OR divider + dashed "I have an invite code" button (sage color, lock icon).
- Step indicator dots at bottom: 3 dots, first active as wide pill.
- Cards get selected state: `--forest` border + glow ring on tap.

---

## Screen 3a — Create a Home (`roux-welcome-screen3a.html`)

- **Purpose:** Account creation + home naming. 3-step form + welcome moment.
- **Step 1 — Your name:** First + last name fields. Continue disabled until both filled.
- **Step 2 — Account:** Email + password. Password strength: 3 bars (weak=honey, medium=sage, strong=forest) + 3 requirement dots (8 chars / one number / one special char). Show/hide toggle.
- **Step 3 — Home name:** Auto-suggests "[Last] Family Kitchen" as tappable Caveat chip. Pre-fills input. Button: "Create my home."
- **Step 4 — Welcome moment:** Forest icon + "Welcome home," + home name in Caveat + Sage introduction message personalized to last name + "Let's go" CTA.
- Progress bar updates each step. "Step X of 3" label.
- ToS line required below Sign Up button before launch (see BUILD-FLAGS.md).
- **Mid-flow failure recovery:** If account creation succeeds but home creation fails, persist partial state locally — do not make Lauren re-enter credentials.

---

## Screen 3b — Join a Home (`roux-welcome-screen3b.html`)

- **Purpose:** Join via invite code. 3-step + welcome moment.
- **Step 1 — Code entry:** 6-character invite code, center-aligned, 22px, letter-spacing 6px. "Look up" verify button. On success: invite card reveals (gradient top border sage→forest, home name in Caveat, "Accept Invitation" CTA). Error on invalid code.
- **Step 2 — Role selection:** 3 radio cards: Co-admin / Family member / Just browsing. Each with badge and description. Continue disabled until selection made.
- **Step 3 — Create login:** Name + email + password (same strength meter as 3a). Button: "Join the kitchen."
- **Step 4 — You're in:** "You're in." + home name in Caveat + role pill (color-coded) + role-specific description + "See the kitchen" CTA.
- **Invite code lookup must be server-side.** Expose only home name and inviting admin name to client — never the full invitations table. Codes are single-use, expire after 7 days.
- ToS line required before launch (see BUILD-FLAGS.md).

---

## Screen 4 — Sign In (`roux-welcome-screen4.html`)

- **Purpose:** Returning user login.
- Heading: "Welcome back. Sign in to your kitchen."
- Email + password fields. Show/hide toggle. Enter key submits.
- Loading spinner state on Sign In button during auth.
- Error banner on failed auth: "That email and password don't match. Try again, or reset your password below."
- Forgot password: inline expandable panel (NOT a modal). Pre-fills email if typed. "Check your inbox — link sent."
- Success state: green home icon + "Good to see you," (Playfair) + first name in Caveat → routes to dashboard.
- "New to Roux? Get started" link at bottom.
- Back button routes to Screen 1 (Welcome) — NOT Screen 2.
- **Session persistence:** Returning users with a valid Supabase session skip this screen entirely and go directly to the dashboard. Never flash the welcome screen for a logged-in user.

---

## Dashboard — Home (`roux-dashboard-cuttingboard.html`)

**Design intent:** "Lauren's kitchen counter moment. 6pm Tuesday. Kids are loud. 20 minutes to figure out dinner." Answer three questions instantly: What are we eating tonight? What's coming up this week? Are we on track?

**Hierarchy:** Tonight → This Week strip → One Sage nudge → Spending snapshot → Shortcuts.

### Greeting
- Time-aware: Good morning (before 12pm) / Good afternoon (12–5pm) / Good evening (5pm+).
- Format: "[Salutation], Hill family." — family name from household record.
- Day type pill top-right of greeting row. Color-coded (see DESIGN-SYSTEM.md).
- Status line: "X of 7 nights planned · Plan [draft/published]". Draft state shifts to honey/amber color.

### Tonight Card — Cutting Board (CONFIRMED DEFAULT)
- The forest green variant is retired. The cutting board is the confirmed design.
- Background: 3-layer `repeating-linear-gradient` system over warm blonde maple base (~`#DEBA8E` range).
- Grain lines: three layers at slightly different angles (~1.2°, -0.6°, 0.9°). Opacity ~0.05–0.07.
- Juice channel: `::before` pseudo-element, `inset: 9px`, `border-radius: 13px`, `1.5px` dark border with inset shadow.
- Light catch: `::after` pseudo-element, radial-gradient at top-left ~20%/12%, warm amber, opacity ~0.18.
- Text: dark ink-brown tones (NOT white). Meal name: Playfair Display 27px.
- Footer: prep time + assigned cook + "View recipe →" button. Divider rule above footer.
- Tradition pill: top-right of card.
- **Empty state:** Same cutting board background. Dashed juice channel border. Italic "What's for dinner?" in muted dark tone. Green plan button. The board must always be present regardless of plan status.
- **Loading state required:** Shimmer before data arrives. Must never flash the empty state while the filled state is loading.
- **Settle entrance animation:** scale(1.012)→scale(1), 350ms ease-out, fires after fadeUp completes.

### This Week Strip
- 7-column grid, Mon–Sun. Day abbreviation (8px caps) + date (Playfair 16px) + 5px pip.
- Today: `--forest` background, lifted `translateY(-2px)`, deeper shadow.
- Pip colors: sage = planned, honey = tradition, muted/dashed = open.
- "Full plan" link right-aligned → This Week screen.
- Pip stagger entry: left to right, 40ms per pip, 280ms total.

### Sage Nudge
- One nudge only — the single most relevant. Collapsed by default.
- Priority queue (not hardcoded): time-sensitive items (pending approval, perishable alert, overdue plan) before general nudges.
- White background, `border-left: 3px solid --sage`.

### Spending Snapshot
- Estimated (19px, `--driftwood`, quieter) / Spent (23px, `--ink`) / Used % (23px, `--forest` when healthy, `--red` when low).
- Variance chip: green + up arrow when under, red when over.
- Sage insight line: dashed top border, one sentence max.
- Matures over time: Week 1 prompts receipt capture. Week 4+ shows real comparison. Month 3+ shows trends.

### Quick Access Shortcuts
- 4 tiles: Add a Meal / Browse Recipes / By Ingredient / Shopping List.
- "By Ingredient" is a dead tap until that screen is built — must be wired before launch (see BUILD-FLAGS.md).

---

## Menu Planner (`/thisweek`) — ✅ REBUILT March 2026

The week is a blank canvas menu. No pre-defined slots. Lauren types what she's making.

### Week Header (3 rows, fixed)
- **Row 1:** Context label "THIS WEEK'S MENU" + week navigation arrows (absolutely positioned)
- **Row 2:** Date range (Playfair 17px)
- **Row 3:** Status — "X of 7 nights planned"

### Week Strip
- 7 day tabs (Mon–Sun), horizontal scroll, today highlighted in forest green with shadow
- Pip dot below each tab: sage = has meals, transparent = empty
- Tapping a day scrolls to that day's card

### Day Cards
- One per day, stacked vertically. White card, rounded 14px, forest green border on today.
- **Header:** Day name + date + day type pill (quiet, typographic)
- **Meal list:** Each planned meal as a simple row — name + meal type badge (DINNER/LUNCH/etc) + state icon
- **Empty state:** Dashed "+ Add to [Day]" button
- **With meals:** Small "+ Add another" text link at bottom
- **Calendar event pills:** Honey dot + event title (truncated 20 chars) + time. Max 3 per day, "+N more" overflow.

### Add Meal Sheet (bottom sheet)
- Large text input "What are you making?" — autofocus
- Recipe suggestions from library appear as user types (ILIKE, min 2 chars)
- Pick a recipe → `entry_type = 'linked'`, `recipe_id` set
- Just type and submit → `entry_type = 'ghost'`, `custom_name` set
- Meal type pills: Dinner (default) / Lunch / Breakfast / Other
- "Add to menu" CTA — forest green, full width

### Sage Meal Match (async, after ghost add)
- Fires `sageMealMatch()` in background — normalizes name (Title Case, fix spelling) + searches recipe library
- Surfaces inline suggestion card below the meal row when results arrive (poll every 3s)
- Recipe buttons + "Save new recipe" + "Keep as-is"

### Ghost Bridge Card
- Appears at bottom of week view when ghost entries exist
- *"✦ Some meals don't have recipes yet — want Sage to help with your shopping list?"*
- Two buttons: "Add recipes" → library, "Add items manually" → pantry list

### First-Time Hint Card
- Shows once for new users (has_planned_first_meal = false, zero planned meals globally)
- Sage icon + "Think of this as your family's weekly menu." + description
- "Got it →" dismisses permanently

---

## Onboarding (`/onboarding`) — ✅ BUILT, COPY PENDING

4-screen flow shown after account creation or dev reset. Redirects to `/` if `has_planned_first_meal = true`.

- **Screen 1 — Welcome:** Forest green bg, Roux wordmark, "Welcome to Roux, [name]." Subtext: "Your family's kitchen companion." CTA: "Let's get started →"
- **Screen 2 — Meet Sage:** Sage sparkle icon, explains what Sage does. CTA: "Sounds good →"
- **Screen 3 — How it works:** Three icon+text rows (build menu, Sage builds list, recipe box grows). CTA: "I'm ready →". *Pending redesign: make interactive — let Lauren add first meal inline.*
- **Screen 4 — Your first week:** "Let's build your first menu." Sage hint. CTA: "Go to my menu →" → navigates to `/thisweek`.
- Progress dots (4), back chevron (screens 2-4), animated transitions.

---

## Recipe Library (`/meals/recipes`) — ✅ BUILT & REFINED

- Green topbar with back arrow (→ /meals), inline search input, filter icon (driftwood sliders) with honey dot when filters active.
- **Filter sheet** (bottom sheet): Section 1 "Browse by category" — dynamic pills from actual recipe data, A–Z. Section 2 "Filter by" — Favorites, Recent, Quick ≤30m, Gluten Free, Vegetarian. "Show recipes" CTA + "Clear all" link.
- **Active filter summary line** below search when filters applied — e.g. "Main · Favorites" in driftwood Jost 300 12px. Tappable to reopen sheet.
- **Warm header:** *"N recipes from your kitchen"* in Playfair italic 14px driftwood. Updates to *"N recipes match"* when filtered/searching.
- **2-column card grid.** White cards, `border-radius: 16px`.
- **FAB:** Forest green circle 56px, white + icon, fixed bottom-right above nav. Navigates to Save a Recipe flow.
- Only shows `recipe_type = 'full'` AND `status = 'complete'` recipes. Quick items invisible.

### Recipe Card (Library Grid)
- Category pill: transparent bg, `0.5px solid #C4B8A8` border, driftwood text, 9px uppercase. Whisper style — not dominant.
- Favorite star (honey) top-right if favorited.
- Recipe name: **Playfair Display 17px** — dominant element on the card.
- Optional Caveat handwritten note (walnut, 80% opacity).
- Time + servings meta (driftwood, 11px).
- "+ Plan" text link bottom-right (Jost 300 11px forest green) — opens AddToPlanSheet. `stopPropagation()` prevents card tap.
- `.recipe-card-tap:active` — `scale(0.98)` press feel.

---

## Recipe Detail (`/recipe/:id`) — ✅ BUILT & REDESIGNED

- **Topbar (58px slim):** Back arrow → library. Calendar+plus icon (→ AddToPlanSheet). Favorite star (honey/hollow).
- **Hero:** Conditional. **With photo:** 220px full-width, `object-fit: cover`, dark gradient overlay at bottom, category pill overlaid bottom-left (white semi-transparent bg). **Without photo:** 44px slim bar, cream bg, `0.5px solid #E4DDD2` bottom border, category pill left-aligned. If no category either — nothing renders.
- **Header:** Recipe name (Playfair 22px). Attribution "By [author]" if available (Jost 300 12px driftwood). Description with 100-char truncation + "more" expand. Dietary tags as quiet driftwood-bordered pills.
- **Sage amber nudge:** When `sage_assist_status = 'pending'` — *"Sage has a suggestion or two about your ingredients →"* in honey 12px. Tapping opens SageReviewSheet.
- **Stat row:** 4-column grid. SVG icons: clock (Prep), flame (Cook), people (Serves), signal bars (Level). Jost 400 15px value + Jost 300 9px uppercase label. No emoji.
- **Action row:** "+ Add to Shopping List" outline button.
- **Tabs:** Ingredients / Directions. Smooth sliding underline (CSS transition 200ms). Active: forest green underline + ink text. Inactive: no underline + driftwood text.
- **Ingredients panel:** Serves adjuster — stateless calculator, labeled *"Adjust to scale ingredients"*. Saves nothing. Ingredient checkboxes with `checkPulse` animation. Section headers in sage caps.
- **Directions panel:** Step number in forest green Playfair. Step text in Jost 300. Step cycling: idle → active → completing → done.
- **Below tabs:** Personal notes (Caveat "My notes" header). Variations section. Recipe history ("Planned X times · Cooked X times"). "Edit recipe" link → `/recipe/:id/edit`.

---

## Edit Recipe (`/recipe/:id/edit`) — ✅ BUILT

- **Topbar:** "Edit Recipe" centered. Back arrow → recipe detail.
- **Photo:** Photo preview with "Change photo" overlay, or dashed "Add a photo" upload area with camera icon. Uploads to Supabase Storage.
- **Basic info:** Recipe name (Playfair 20px input), description textarea, author + source URL side by side.
- **Details:** Category (dynamic pills from household data + freeform input). Cuisine text input. Method (6 pill options). Difficulty (3 pill options).
- **Timing & servings:** Prep time + cook time (number inputs + "min") + servings (free text).
- **Ingredients:** Pantry autofill (ILIKE from `pantry_items`, 6 suggestions). Unit picker (searchable, Volume/Weight/Count/Other). Qty + unit + name per row. Add/remove buttons.
- **Instructions:** Numbered textarea list. Add/remove, auto-renumber.
- **Notes:** Personal notes (Caveat font), variations.
- **Save:** Upserts recipe, delete/re-insert ingredients and instructions. Creates pantry items for new ingredient names. Fires Sage ingredient review async.
- **Pinned CTA:** "Save changes" forest green, fixed above nav.

---

## Shopping List (`roux-shopping-style1.html`)

### Three Operational States (Lauren-controlled)
1. **Building** — default after plan is published. Sage nudges visible. Edit/add/remove freely. "Start Shopping" CTA.
2. **Shopping** — triggered by Lauren tapping "Start Shopping". All tap targets grow (checkbox 26px→30px, min-height 56px→64px). Sage strip fades out. Store filter and recipe meta hide. "Done Shopping" CTA.
3. **Complete** — triggered by "Done Shopping". Complete card slides in with result summary + receipt capture CTA + skip option. Screen auto-scrolls to top.

### Store Sections (Auto-categorized by Sage)
1. 🥩 Meat & Seafood
2. 🥬 Produce
3. 🧀 Dairy & Eggs
4. 🥗 Deli
5. 🥫 Pantry & Canned
6. 🍞 Bread & Bakery
7. ❄️ Frozen
8. 🛒 Household & Other

### Critical Distinction — Got It vs. Already Have
- **Got It** — purchased today. Counts toward actual spend. Item moves to Got It section.
- **Already Have** — at home already. Removed from list. Does NOT count toward spend. Counts toward utilization tracking.
- Both accessible via single tap — no swipe required. Got It = forest green button. Already Have = amber button.
- This distinction is what makes spending and utilization data accurate over time.

### Got It Section Collapse
- Shows max 3 items by default. At 4th item: "Show all X got-it items ↓" chip appears.
- Tap to expand. Chip changes to "Show less ↑". Max-height animation — never snaps.

### Budget Strip
- Three figures: Estimated (quiet, smaller) / In Cart (updates live) / Remaining.
- Remaining turns amber when approaching estimate — never red, never alarming.
- In Cart number pulses (scale 1.06→1) on each check/uncheck.

### Sage on the Shopping List
- Nudges in Building state only — not during active shopping.
- One nudge visible at a time. Dismissible. Never blocking.

### Mobile Requirements
- Organized by store section — produce, meat, dairy, pantry, frozen, other.
- If multiple stores — separate views of same master list filtered by store.
- Large tap targets — minimum 48px on all interactive elements. 64px during Shopping state.
- Offline capable — optimistic UI, syncs on reconnect.
- Quantity clearly visible — "chicken breasts 4 lbs" not just "chicken breasts".
- Recipe context shown — "for French Dip Night".
- Location aware — if at Kroger, Kroger items shown first automatically.

---

## Meals Hub (`/meals`) — ✅ BUILT, REDESIGN PLANNED

Currently: Two-zone layout with tagline strip. Zone 1 "Add something": Plan a Meal (forest green) + Add a Tradition (warm off-white). Tagline: *"Recipes become meals. Meals become your family's story."* Zone 2 "Your kitchen": Three archive tiles — Family Recipes (live count, draft badge), Saved Meals (live count), Traditions (live count). All counts refresh on focus.

**Planned redesign:** Tabbed view replacing the hub. Two tabs:
- **Our Meals** — deduplicated list of every meal planned from `planned_meals` history. Sorted by most recently planned. Shows: meal name, last planned date, times planned, recipe linked indicator. Zero setup — grows as Lauren plans.
- **Recipe Box** — existing Recipe Library, unchanged.

---

## Plan a Meal (`/meals/plan`) — ✅ BUILT

Forest green topbar. Meal name input (Playfair 26px). Recipe picker bottom sheet with search + quick add (autofill, type selector: Quick item / Recipe to finish later). Alternatives per recipe slot (honey left border, OR dividers). Reorder mode. Notes in Caveat. "Add to plan after saving" toggle (new meals) or "Add to plan" button (edit mode). AddToPlanSheet with week/day/slot picker including calendar for future weeks. Edit mode loads existing meal via URL param.

---

## Saved Meals (`/meals/saved`) — ✅ BUILT

List of saved meals with recipe components joined by middle dots. Search bar (hidden at 0–1 meals). Each card: Playfair 18px name, Jost 12px recipe list, "Add to plan" link. Tap card → edit in PlanMeal. Empty state: *"Nothing built yet."* with link to Plan a Meal.

---

## Week Settings — ✅ BUILT (Two-Screen Architecture)

**Screen 1 — This Week Settings** (`/week-settings`): Day type assignments for this week (tappable pills → bottom sheet picker), traditions toggle (filtered to relevant only), template apply with preview/confirm/undo, save as template, reset to defaults, link to Household Defaults.

**Screen 2 — Household Defaults** (`/week/defaults`): Default weekly pattern (saves to `household_weekly_pattern`), manage day types (list + add via AddDayTypeSheet), manage templates (list + delete with confirmation). Intro: *"These settings apply to all future weeks."*
