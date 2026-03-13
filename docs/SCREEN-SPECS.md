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

## This Week (`roux-thisweek-style1-objects.html`)

- **Layout:** Vertical scroll. One full-width day row per day, Mon–Sun.
- **Week navigation:** Prev/next arrows + week range label centered.
- **Plan status banner:** Amber = draft, green = published. "Share this week with the family" CTA. Future weeks auto-create new draft on navigation. Past weeks open read-only archived view.
- **Protein roster:** Collapsible card. Protein name + store + on-sale indicator.

### Day Rows
- Left column: day name (10px caps) + date (Playfair) + tradition badge if applicable.
- Right: day type badge (color-coded). Tradition badge is below date in left column — NOT beside day type badge.
- Today row: `--forest` header background, white text.

### Dinner Slot States
- **Filled:** Meal name + assigned cook + status chip + notes dot + swap button (34px tap target confirmed).
- **Empty:** Dashed border + italic "What's for dinner?" + "Ask Sage" nudge button + large green + circle.
- **Open evening:** Soft green background + checkmark + "Open evening — no meal needed."
- Tapping any empty or open slot opens the bottom sheet.

### Bottom Sheet
- Rise: `translateY(100%)→translateY(0)`, `cubic-bezier(0.32,0.72,0,1)`, 320ms.
- Overlay darkens with 40ms delay behind sheet rise.
- Options: Let Sage suggest / Browse the library / Enter manually.
- 4th option below divider: "Mark this evening as open — no meal needed."
- When triggered from "Ask Sage" button: Sage option gets primary (green) treatment.

### Publish Flow
- Publish bar fixed above bottom nav in draft state. "Share this week with the family" — confirmed copy.
- On publish: status dot amber→green (150ms), banner shifts (200ms), publish bar fades and slides down (300ms). 60ms offset chain.
- **On publish, immediately surface a prompt to build the shopping list** — this is the most important workflow handoff in the app (see BUILD-FLAGS.md).

---

## Recipe Library (`roux-library-style1-objects.html`)

- Green topbar with inline search: translucent white-on-green input, search icon left.
- "Browse by" label (sage-tinted white, 9px caps) above category pills.
- Category pills (horizontally scrollable): All / Breakfast / Lunch / Dinner / Soups / Salads / Sides / Desserts.
- "Filter by" label in cream body area above filter pills.
- Filter pills: All / ★ Favorites / Recent / Quick ≤30m / Gluten Free / Vegetarian.
- Add recipe button copy: **"Save a Recipe"** — not "+ Add Recipe".
- Results count bar: "48 recipes" — must be reactive to active search/filter state in real build (currently static in prototype).
- **2-column card grid.** White cards, `border-radius: 16px`.

### Recipe Card (Library Grid)
- Category badge (10px, forest green, light green bg).
- Favorite star (honey) top-right if favorited.
- Recipe name: Playfair Display 14px.
- Optional Caveat handwritten note (walnut, 80% opacity).
- Time + servings meta (driftwood, 11px).
- Dietary dots at bottom-left: GF (honey) / Veg (sage) / DF (walnut).
- "+ Week" add-to-plan link bottom-right.

---

## Recipe Card (`roux-recipe-card-style1-objects.html`)

- **Slim topbar (58px):** Back arrow → library. Logo. Favorite star (honey).
- **Hero:** 220px, 22px margins, 16px border radius. Category badge overlay (bottom-left, white bg, blur).
- **Title card (white, 22px margins, 16px radius):** Recipe name (Playfair 28px) + Caveat handwritten note + 4-stat grid (Prep/Cook/Serves/Level) + dietary tags.
- **Action row:** "Add to Shopping List" outline button only. "Add to This Week's Plan" lives as the pinned CTA only — not duplicated here.
- **Sage strip:** Forest green background, collapsed by default. Expand/collapse with chevron. Sparkle icon (✦) + Sage badge + pulse dot. Message in italic Playfair on expand.
- **Tabs:** Ingredients / Directions. Sticky at `top: 58px` (below slim topbar). 200ms crossfade (panelFade).
- **Ingredients panel:** Serves adjuster (+/−, Playfair 22px count). Section headers (10px sage caps). Tap-to-check: checkPulse scale(1.22), 180ms. Checked = strikethrough + linen color.
- **Directions panel:** Step cards cycle idle → active (sage border + tinted bg) → done (faded). `.completing` opacity dip to ~0.5, 180ms. Tips: italic Playfair, walnut left border.
- **Family Notes:** Caveat 20px heading + starred note items (honey star). Brand signature moment.
- **Related recipes:** "Goes Well With" section with related recipe cards.
- **Pinned CTA:** "Add to This Week's Plan" — fixed above bottom nav.
- **Serves adjuster is non-trivial:** quantity scaling affects data model. Plan this early in build (see BUILD-FLAGS.md).

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
