# Roux Daily Message Pool

## Selection Logic
1. Always pick the most contextually relevant message from the current stage pool
2. Messages referencing yesterday's events or tomorrow's calendar take priority
3. Never show the same message twice in a 7-day window
4. Maximum 2 intelligence messages per day per user
5. Recency-weighted — recent events surface relevant messages first
6. One-time messages (marked OTO) are never repeated

## Implementation
See `src/lib/getIntelligenceMessage.js`
Variables in [brackets] are interpolated from real user data at runtime.

---

## Stage 1 — First Contact
*Data: meals planned, calendar events, shopping list, household*

**Selection priority:** Prefer messages referencing a specific meal or calendar event
from today or tomorrow. Generic observations are fallback only.

1. "You've got [n] meals planned this week — [n] ingredients ready on your list, nothing to forget."
2. "Nothing planned for [day] yet. Want to get ahead of it before the week gets away from you?"
3. "[Meal] is on for [day]. I've already added everything you need to the list."
4. "Looks like a busy [day] ahead. Worth keeping dinner simple that night."
5. "[Day] is clear on the calendar. Good night for something you actually enjoy making."
6. "Three nights still unplanned this week. No pressure — I'll be here when you're ready."
7. "Your shopping list has [n] items ready. That's [n] fewer things to remember at the store."
8. "You added [meal] — I've added [n] ingredients to your list automatically."
9. "You've planned [meal] twice this week. Must be a family favourite."
10. "Next week is completely open. This week is the one that matters — how's it looking?"
11. "[Tonight's meal] tonight. Everything you need is already on the list."
12. "The weekend is coming up — usually a good time to try something new. Nothing planned yet."

---

## Stage 2 — First Week Complete
*Adds: eaten/skipped signals, receipt data, pantry start, cost baseline*

**Selection priority:** Receipt scan in last 48hrs → message 5 takes absolute priority
(savings reveal for Market C). Skip signals from yesterday → messages 1, 3, or 9.
Receipt nudge (11) only if no receipt scanned this week.

1. "You skipped [meal] last [day]. Worth rescheduling, or moving on from it?"
2. "Your groceries last week: $[amount]. I'm starting to get a picture of what your kitchen actually costs."
3. "[Meal] got eaten — noted. [Meal] got skipped — also noted. I'm paying attention."
4. "Cooking at home [n] nights last week. That's a solid start."
5. "First receipt scanned — you spent $[amount]. Eating out those same meals would've cost roughly $[estimate]." ← PRIORITY after first scan
6. "[Meal] keeps moving around the week. Might be worth finding a better night for it."
7. "Two weeks in a row now. I'm starting to learn your rhythm."
8. "Nothing on the list got forgotten this week. That's exactly the point."
9. "[Day] was a skip last week too. Starting to see a pattern there."
10. "You've completed your first full week. Every week from here gets easier."
11. "Scan your receipt after this week's shop and I'll show you what you saved." ← nudge only, no receipt yet
12. "[Meal] was on the plan but didn't happen. Want to move it to next week or let it go?"

---

## Stage 3 — Pattern Emerging
*Adds: rhythm detection, rotation gaps, skip patterns, busy night awareness*

**Selection priority:** Forward-looking messages (1, 4, 9) take priority Sunday/Monday.
Streak messages (5) only when genuinely earned. Pattern observations (2, 3, 7)
only after 3+ confirmed data points, never after just one.

1. "I haven't seen [meal] in [n] weeks. Worth bringing back next week?"
2. "[Day] has been your busiest night three weeks running. I'll plan around it."
3. "You tend to skip meals on [day]. Want me to only suggest simple ones for that night going forward?"
4. "Next week looks clear on [day] — good night for something new."
5. "You've cooked [n] nights in a row without a skip. That's your best streak yet."
6. "[Meal] gets eaten every time you make it. That one's a keeper."
7. "Three [days] in a row, three skips. I don't think [day] is a cooking night for your family."
8. "You haven't tried anything new in [n] weeks. Next clear night might be worth experimenting."
9. "Next week is looking busy — might be worth planning simpler meals than usual."
10. "Your family's been on a [cuisine] run lately. Feels intentional."
11. "I noticed you moved [meal] twice this week. Want to find a better night for it?"
12. "[Meal] has been planned [n] times and made [n] times. Most reliable dinner in your rotation."

---

## Stage 4 — Family Taste Profile
*Adds: flavor/cuisine preferences, leftover resistance, eating out costs, ratings*

**Selection priority:** Savings messages (2, 4) within 24hrs of eating-out log entry.
Taste profile observations (1, 10) on Sundays when Lauren is planning.
Never surface message 7 more than once per week.

1. "Your family tends to love meals with [protein] and [style]. Worth keeping that in mind when you're browsing for something new."
2. "Last time you ordered out on a [day], it cost $[amount]. Cooking that night would've been about $[estimate]."
3. "[Meal] never has leftovers. Your family's telling you something."
4. "You've saved roughly $[amount] this month cooking at home. That's real money."
5. "Your family gravitates toward [cuisine] on weekends. Feels like a tradition forming."
6. "[Meal] keeps getting pushed to later in the week. Might not be the right fit anymore."
7. "Three eating-out nights this week — busier than usual. No judgment, just noticed."
8. "Your family has eaten [meal] [n] times and never left anything on the plate. That's the definition of a keeper."
9. "You tend to try new meals on [day]. Good instinct — that's your lowest-pressure night."
10. "Based on what your family loves, [cuisine] might be worth exploring more next time you're browsing."
11. "You've ordered the same thing twice from [type of restaurant]. Might be worth learning to make it."

---

## Stage 5 — Kitchen Intelligence
*Adds: waste patterns, quantity calibration, multi-week spend trends, pantry cycles*

**Selection priority:** Waste messages (1, 3, 7) surface before a shop trip — actionable
in that moment. Spend trend messages (2, 4, 8) mid-week. Message 5 within 24hrs
of a meal marked "not enough."

1. "You've bought [ingredient] [n] times this month. It only shows up in one recipe — want me to find more that use it?"
2. "Your grocery spend has been consistent for [n] weeks. You've found your rhythm."
3. "You always buy [ingredient] but it rarely makes the plan. Worth skipping next shop?"
4. "Cooking at home saved you roughly $[amount] last month compared to eating out every night."
5. "Your portions for [meal] seem to run short — might be worth scaling it up next time."
6. "You've scanned [n] receipts now. I have a clear picture of what your kitchen actually costs to run."
7. "[Ingredient] went on three lists but only got used once. Worth watching."
8. "Your spending has come down $[amount] since you started planning. That's not an accident."
9. "Next shop looks light — only [n] items. Either the pantry is well stocked or next week needs more planning."
10. "You've made [meal] [n] times — you probably don't need the recipe anymore."

---

## Stage 6 — Full Week Planner
*Adds: full rotation history, week structure patterns, consumable cycles*

**Selection priority:** Message 9 every Sunday when next week is unplanned — primary
re-engagement trigger. Message 1 is OTO — used first time only, then use variants.
Consumable nudges (4) only when genuinely relevant, never speculatively.

1. "I think I know your family well enough now — want me to plan next week? You can change anything." ← OTO
2. "Next week looks similar to [date] week — that was a good one. Want me to build on it?"
3. "You've planned [n] weeks in a row. That's a real habit now — not just an app."
4. "Time to restock [staple] — you go through it about every [n] weeks."
5. "Next week has [n] busy nights. Want me to keep it simple and plan around them?"
6. "Your best weeks have [protein] on Monday and something lighter mid-week. Want to try that again?"
7. "I've noticed you like to leave [day] unplanned. I'll keep that open when I suggest next week."
8. "You haven't tried something new in [n] weeks. Want me to work one in next week?"
9. "It's Sunday — next week is wide open. Want me to take a first pass at it?" ← fires every Sunday
10. "You've settled into a rhythm that works. Want me to build on it for next week?"

---

## Stage 7 — Seasonal Intelligence
*Adds: seasonal preferences, occasion patterns, year-over-year comparisons*

**Selection priority:** Message 4 OTO on one-year anniversary. Message 10 OTO as quiet
lifetime milestone. Seasonal shifts (1, 7) at start of new season only — not repeatedly.
Occasion messages (3, 8) surface 2–3 weeks before relevant holiday.

1. "It's getting colder — your family tends to shift toward soups and comfort meals around this time of year. Want to bring some back?"
2. "This time last year you made [meal] and it became a weekly staple. Worth revisiting?"
3. "The holidays are coming — your family tends to go heavier on [cuisine] this time of year."
4. "You've been using Roux for a year. Your family has eaten [n] home-cooked meals together. That's not nothing." ← OTO anniversary
5. "Last [season] your family's favourites were [meals]. Want to bring those back into rotation?"
6. "You spent $[amount] less on groceries this year compared to last. That's the plan working."
7. "Summer's coming — your family tends to want lighter, faster meals. Worth planning for that shift."
8. "You've made [meal] every [holiday] for [n] years now. Should I put it on the plan already?"
9. "Your family eats at home more in winter. I'll plan a bit fuller this time of year."
10. "It's been a full year. You've figured out what your family loves. I'm just here to remember it." ← OTO lifetime

---

## Humor Pool
Delivered sparingly — maximum once every 10–14 days per user.
Never during an active task flow. Never repeated until all exhausted.
Surfaces on Home screen quiet moments and loading/transition screens.
See `src/lib/jokes.js` for the full pool.
OTO = one-time only message, never repeated.
