# Roux Product Tiers
*Last updated: March 22, 2026*

Two tiers only: `free` and `full`. Database values. Display names TBD — use "Free" and "Full Plan" for now.

---

## Free

- Weekly menu planning (unlimited weeks, free text or recipes)
- Recipe library — up to 25 recipes
- Save a Recipe — photo capture, URL extraction (3/month), manual entry
- Plan a Meal — build and save meals with recipe components and alternatives
- Saved Meals library — browse, search, edit
- Add to Plan — schedule meals to any week
- Family shopping list (master list, manual trips)
- Manual shopping trip close-out
- Day Types — default set (Weekday, Weekend), editable
- Default weekly pattern
- Weekly Proteins — basic entry
- Recipe photo upload
- Recipe sharing — share code, public recipes, borrow
- Sage — 10 interactions/month (genuinely helpful, not crippled)
- Sage ingredient review (runs for all tiers — infrastructure)

---

## Full Plan

- Everything in Free
- Unlimited recipes
- Sage — 500 interactions/month
- URL and photo recipe extraction — unlimited
- Meal plan → shopping list auto-generation
- Receipt scanning and parsing
- Sage food waste intelligence and sale item follow-ups
- Sage learned shopping cadence
- Weekly recap — confirm what was cooked, archive the week
- Meal prep session planning
- Family contribution management with Home screen notices
- Day Types — custom (add beyond defaults)
- Week templates
- Traditions — occasion year-over-year history

---

## Deferred

- Household Follows — social/discovery between households (v3, myroux.kitchen)

---

## Notes

- Tier enforcement layer not yet built — required before inviting non-Hill users
- Lauren Hill is permanently Full regardless of tier logic
- Sage interaction limits tracked in `sage_usage` table
- Sage upgrade prompt tone: "You've used your free Sage interactions for the month — want to keep going?" Never "Upgrade to unlock."
- Day Type defaults seeded per household at creation — Weekday + Weekend only
- Sage ingredient review runs for all tiers (infrastructure)
