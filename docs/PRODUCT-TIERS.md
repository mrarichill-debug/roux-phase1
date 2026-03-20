# Roux Product Tiers
*Last updated: March 18, 2026*

---

## Free

- Recipe library — up to 25 full recipes
- Save a Recipe — manual entry only
- Plan a Meal — build and save meals with recipe components and alternatives
- Saved Meals library — browse, search, edit
- Add to Plan — schedule meals to any week
- Traditions — recurring (e.g. Taco Tuesday), basic setup and display
- Manual shopping list
- Family Suggestions — household members can suggest meals to the planner
- Day Types — default set only (Weekday, Weekend), editable but not custom
- Default weekly pattern — set your household's default day-type pattern for new weeks
- Weekly Proteins — basic entry (protein name per week plan)
- Recipe sharing — share code, public recipes, borrow
- Meal browse sharing
- Tradition browse sharing

---

## Plus

- Everything in Free
- Unlimited recipes
- Save a Recipe via URL extraction (Sage parses recipe URLs)
- Auto-generate shopping list from week plan
- Basic spending tracking
- Week templates
- Shared plans
- Protein Favorites — preferred proteins with typical price and store
- Day Types — custom (add beyond household defaults)
- Linked recipe updates notify borrowers, see who borrowed
- Occasion tradition year-over-year history visible to shared users
- Sage — reactive suggestions, 100 interactions/month

---

## Premium

- Everything in Plus
- Sage full week planning — unlocks after 50 archived meals
- Sage skip detection — gentle nudge after 3 skips of same meal
- Sage — 1000 interactions/month soft ceiling
- Occasion Traditions with year-over-year occurrence history
- Receipt capture and parsing
- Multiple shopping lists
- Spending trend analysis
- Utilization tracking — what gets cooked vs. bought
- Weekly Proteins — sale price tracking, spending trends, Sage protein suggestions
- Weekly wrap-up — confirm what was cooked, archive the week, feeds spending and Sage intelligence

---

## Deferred — Not Currently Being Built

- Household Follows — social/discovery between households (v3)

---

## Notes

- Tier enforcement layer not yet built — required before inviting non-Hill users
- Lauren Hill is permanently Premium regardless of tier logic
- Sage interaction limits tracked in `sage_usage` table with immutable historical rates
- Day Type defaults seeded per household at creation — Weekday + Weekend only. School Day, No School, Summer are household-specific additions.
