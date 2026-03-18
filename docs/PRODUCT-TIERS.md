# Roux Product Tiers
*Last updated: March 17, 2026*

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
- Day Types — default set only (School Day, Weekend, Holiday, Summer), editable but not custom

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
- Day Types — custom (create your own with full configuration)
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
- Weekly Proteins — protein tracking with sale price per week plan

---

## Deferred — Not Currently Being Built

- Household Follows — social/discovery between households (v3)

---

## Notes

- Tier enforcement layer not yet built — required before inviting non-Hill users
- Lauren Hill is permanently Premium regardless of tier logic
- Sage interaction limits tracked in `sage_usage` table with immutable historical rates
- Day Type defaults are seeded per household at creation — School Day, Weekend, Holiday, Summer
