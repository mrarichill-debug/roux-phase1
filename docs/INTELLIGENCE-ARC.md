# Roux Intelligence Arc

## Philosophy
The arc stage determines what Roux is *capable* of noticing.
The daily message is what it *actually noticed today*.
These are different things. A user can be at Stage 1 for three weeks
and see a different, specific, honest message every single day.

Sage never pretends to know more than it does. Each stage is a genuine
data threshold. Progress is shown in plain honest language — no visual
metaphor, no gamification.

## User-Facing Voice
- First person, no attribution: "I noticed you skipped pasta on Wednesdays."
- No "Sage says", no "Roux says" — just the message.
- Sparkle icon (✦) is the only intelligence signal in the UI.
- Internally, "Sage" remains the implementation name (components, DB, config).

## The Seven Mental Loads
1. Scheduling — what's happening this week and how it affects dinner
2. Inventory — what's in the house, what needs buying, what gets wasted
3. Rotation — what did we have recently, what are we overdue for
4. Preferences — what the family actually eats vs. what gets pushed around
5. Discovery — Sage nudges Lauren toward what to look for; Lauren does the finding
6. Budget — what is this costing, is eating out worth it tonight
7. Seasonal/special — holidays, guests, occasions, what feels right for the time of year

## Stage Definitions

### Stage 1 — First Contact
**Trigger:** Account created + first meal planned
**Arc answer:** "Make sure you never forget an ingredient."
**Unlocks:** Week view with calendar overlay, ingredient list auto-generation, shopping list
**Data available:** Meals planned, calendar events, shopping list, household members

### Stage 2 — First Week Complete
**Trigger:** 5+ meals planned, week closed out, 1+ receipt scanned
**Arc answer:** "Show you what you're actually saving."
**Unlocks:** Week closeout flow, receipt scanning, pantry inventory start
**Data adds:** Eaten vs. skipped signals, first receipt data, first cost baseline

### Stage 3 — Pattern Emerging
**Trigger:** 3+ weeks planned, 10+ meals in history, 3+ skips detected
**Arc answer:** "Remember what your family loves."
**Unlocks:** Rotation suggestions, busy night detection, skip pattern nudges
**Data adds:** Weekly rhythm, rotation gaps, skip patterns, busy night awareness

### Stage 4 — Family Taste Profile
**Trigger:** 25+ meals in history, 5+ recipes rated/reviewed, eating out logged 3+ times
**Arc answer:** "Know what your family actually likes to eat."
**Unlocks:** Taste-based nudges, eating out cost comparison, recipe match on save
**Data adds:** Flavor/cuisine preferences, leftover resistance, eating out comparisons

### Stage 5 — Kitchen Intelligence
**Trigger:** 5+ receipt scans, 2+ full shopping cycles, waste patterns detected
**Arc answer:** "Know what's in your kitchen and what you're spending."
**Unlocks:** Waste detection, smarter quantity suggestions, spending trend analysis
**Data adds:** Waste patterns, quantity calibration, multi-week spend trends

### Stage 6 — Full Week Planner
**Trigger:** 50+ archived meals, 8+ weeks of consistent planning
**Arc answer:** "Plan your whole week before you have to ask."
**Unlocks:** Sage full week planning, week templates, frequency nudges
**Data adds:** Full rotation history, week structure patterns, consumable cycles
**Note:** "I think I know your family well enough now to try something." — used ONCE only.

### Stage 7 — Seasonal Intelligence
**Trigger:** 3+ months consistent data, seasonal shift detected, first occasion pattern
**Arc answer:** "Know your family through every season."
**Unlocks:** Seasonal meal surfacing, occasion awareness, year-in-review
**Data adds:** Seasonal preferences, occasion patterns, year-over-year comparisons

## Arc Stage Calculation
See `src/lib/getArcStage.js` — derives stage from existing dashboard data.
Never add new Supabase queries to support arc calculation.

## Multi-Market Payoff Moments (Week 1)
All three must work independently — no feature gates another's payoff:
- **Market A (Household Manager):** Calendar + ingredient list removes mental friction on day one. Without calendar: "Your shopping list is ready. Every ingredient, nothing forgotten."
- **Market B (Intentional Family):** First meal planned, first recipe saved — the act of planning feels intentional. No calendar needed.
- **Market C (Budget-Conscious):** First receipt scanned → immediate savings reveal. "Your groceries this week: $X. Eating out those same meals would've cost roughly $Y."

## Forward-Looking Principle
Suggestions should primarily focus on NEXT week, not the current one.
Thinking ahead and setting the tone for next week is more powerful than
reactive comments about what already happened.

## Design Constraint
Every intelligence message must have two versions internally:
one using calendar context, one without.
System picks based on available data.
