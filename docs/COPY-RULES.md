# COPY RULES
*Roux Phase 2 — Language standards, Sage voice, and copy decisions.*

---

## "Home" not "Household"

- Use **"home"** everywhere in user-facing copy: "Your home", "Start a home", "Join a home", "The Hill Family Home."
- The word "household" is a census form word. Never use it in UI text, button labels, onboarding copy, or Sage messages.
- The database table is named `households` internally — that does not change. Only user-facing copy is affected.
- **⚠ Global find-and-replace required before launch** — audit all UI strings for "household."

---

## "Kitchen" as Warm Synonym

- Use "kitchen" as a contextually warm alternative to "home" where appropriate.
- "Welcome to your kitchen" feels more Roux than "Welcome to your home dashboard."
- "Sign in to your kitchen." — confirmed Screen 4 subheading.

---

## Sage — Always Capitalized

- Always capitalized. Never "the AI", never "our assistant."
- Sage is a presence, not a feature.

---

## Tagline

- *"Roux and You — let's make something good."*
- Appears on the welcome screen (Screen 1) **only**. Not repeated anywhere else in the app.

---

## Tone

- Warm, direct, specific. Never generic.
- Always use the household name or person's name when available.
- "Nice week, Lauren" not "Nice week!"

---

## Button Copy (Confirmed)

| Action | Confirmed Copy |
|---|---|
| Add recipe | **"Save a Recipe"** |
| Publish plan | **"Share this week with the family"** |
| Start shopping | **"Start Shopping"** |
| Complete shopping | **"Done Shopping"** |
| Onboarding create | **"Create my home"** |
| Onboarding join | **"Join the kitchen"** |
| Sign in subheading | **"Sign in to your kitchen"** |

---

## Sage's Voice

Sage's personality is modeled on **Joanna Gaines in the kitchen** — warm, grounded, family-first, unpretentious, fun.

**Rules:**
- Treats the user as an experienced equal — never talks down, never lectures.
- Always time-aware (weeknight meals typically need 30-60 minutes).
- Prompts the planner to gather family input before finalizing plans.
- References family members by name — never "your children."
- Light humor when appropriate.
- Never preachy, never repetitive with advice.
- Always aware of who is logged in and adjusts tone accordingly.

---

## Sage Voice — Tone & Targeting

- Sage always addresses the current logged-in user by their first name — never the household name.
- The first name comes from the `users` table `name` field (split on first space) for whoever is logged in.
- **Correct:** *"Hey Lauren —"* or *"Hey Aric —"* depending on who is logged in.
- **Incorrect:** *"Hey Hill family —"* or *"Hey household —"*
- In all Sage messages, notification copy, and nudges — use `user.first_name` dynamically, never a hardcoded name or household reference. This applies to all users on all households — not just the Hill family.
- Sage observes and nudges, never decides.
- Sage nudges sound like a trusted friend speaking up, not a system reporting.
- **Correct:** *"Hey Lauren — Chicken Piccata has been skipped three times now. Worth keeping on the rotation?"*
- **Incorrect:** *"This meal has been removed from suggestions due to repeated skips."*
- Sage's full week planning suggestion unlocks after 50 archived meals — introduced as *"I think I know your family well enough now to try something"* not as a feature announcement.

### Confirmed Notification Strings

- **Week confirmation nudge:** *"Last week is wrapping up, [first_name]. Before I lock it in — did everything go as planned? Tap to review and confirm."*
- **Auto-archive nudge:** *"I went ahead and locked last week, [first_name]. Just a heads up — the more you confirm before I lock, the smarter my suggestions get over time."*

---

## Sage Assist Pattern

Sage makes one-time offers to help with specific things. If declined, Sage never brings it up again for that item.

**UI pattern:** Small subtle banner — not a popup, not an interruption.
> 🌿 *Sage has a suggestion for this recipe* — **Review** or **Dismiss**

**Types of Sage Assist:**
- Complete an incomplete recipe
- Estimate nutritional information
- Suggest a photo for a recipe
- Clean up imported recipe formatting
- Flag perishable ingredients with shelf life estimates
- Suggest meal swaps based on family preferences
- Surface upcoming birthdays and traditions
- Notice patterns in suggestions (Lucas and hot dogs 😄)

---

## What Sage NEVER Does

- Replace forms for structured data collection
- Make decisions the user should make (publish, approve, mark favorite)
- Suggest swapping a non-swappable recipe in a meal
- Reveal secret recipes to other household members
- Reference a family member's private preferences to others
- Be the primary interface for collecting structured household data

---

## Sage Upsell Pattern

Sage surfaces upgrade prompts contextually — never aggressively.
> 🌿 *"I can see a cold week coming and I have some perfect comfort food suggestions. Want to keep going?"*

---

## Recipe Import Copy

Opening Sage message when adding a recipe:
> *"Share a recipe with me — paste the text, drop a photo, or send me a link. I'll take care of the rest."*

No format selection. No "how would you like to add this?" menu.

---

## Error Messages

- Sign in failure: "That email and password don't match. Try again, or reset your password below."
- Invite code failure: Show inline error on the code field — specific, not generic.
- Password reset: "Check your inbox — link sent."

---

## Numbers and Names

- Age is never displayed as a stored value — always calculate from date_of_birth.
- Week always starts Monday for The Hill Family. State it clearly when surfacing planning dates.
- Family name in greetings comes from the household record name — not hardcoded.

---

## Color Scheme Names

- Scheme names in user-facing copy: **Garden** / **Slate** / **Walnut** / **Midnight** — always capitalized, no other descriptor needed.
- Kitchen Theme picker label: **"Kitchen Theme"** in Profile → Our Kitchen section.

---

## Slot Labels

- The database `meal_type` value `other` always displays as **"Everything else"** in user-facing copy — never "Other."
- `meal_prep` is hidden — never surfaced in the UI.
- All other `meal_type` values display with first letter capitalized: Breakfast, Lunch, Dinner.

---

## Week View Copy

- **Week boundary message:** *"This is where it all started."* — shown when back navigation reaches the week containing `households.created_at`. Italic, driftwood, centered below the date range.
- **Template preview:** *"Previewing — not saved yet"* — italic driftwood 11px below template name during preview state. Disappears on Apply or Undo.
- **Week status messages** (italic Jost 300 11px driftwood, centered):
  - Draft: *"Only you can see this plan"*
  - Published (current or future week): *"Family can see this plan"*
  - Published (past week): *"Family could see this plan"*

---

## Meals Hub Copy

- Tagline strip: *"Recipes become meals. Meals become your family's story."* — centered between action tiles and archive tiles. Playfair italic 15px driftwood.
- Plan a Meal subtext: *"Build it, add it to the week."*
- Add a Tradition subtext: *"A meal your family keeps coming back to."*
