# Hill Family Sample Data

Seed data for the Roux app. All recipes belong to Lauren Hill's household.

## IDs

| Field | Value |
|---|---|
| `household_id` | `53f6a197-544a-48e6-9a46-23d7252399c2` |
| `user_id` (Lauren Hill) | `18c38c61-fb49-4c29-a4c2-e8907a554dac` |

## How to Seed

Paste `seed_recipes.sql` into Supabase → SQL Editor → New query → Run.

The file includes a sanity check that verifies both IDs exist before inserting anything.

---

## Recipes (13)

Recipe IDs follow the pattern `11111111-1111-1111-1111-0000000000{nn}`.

| # | ID | Name | Category | Cuisine | Prep | Cook | Serves | Visibility | Favorite |
|---|---|---|---|---|---|---|---|---|---|
| 01 | `...000001` | Authentic Pizzeria Sauce | sauce | Italian | 5m | 20m | 2 pizzas | household | — |
| 02 | `...000002` | Buffalo Chicken Dip | appetizer | American | 10m | 25m | 10–12 | household | ★ |
| 03 | `...000003` | Feisty Feta Dip | appetizer | Mediterranean | 10m | — | 8–10 | household | — |
| 04 | `...000004` | Loaded Baked Potato Soup | soup | American | 15m | 45m | 8–10 | household | ★ |
| 05 | `...000005` | Creamy Tortellini Soup | soup | Italian-American | 10m | 30m | 6–8 | household | ★ |
| 06 | `...000006` | Lynn's Super Secret Fudge | dessert | American | 15m | 15m | ~36 pieces | **secret** | ★ |
| 07 | `...000007` | Peanut Butter Balls | dessert | American | 30m | — | ~48 balls | household | ★ |
| 08 | `...000008` | Macaroni and Cheese | pasta | American | 15m | 50m | 12 | household | ★ |
| 09 | `...000009` | Homemade French Bread | bread | American | 20m | 25m | 2 loaves | household | — |
| 10 | `...000010` | Enchiladas De Pollo | main | Mexican | 30m | 35m | 8 | household | ★ |
| 11 | `...000011` | Chicken Piccata Sauce | sauce | Italian | 5m | 20m | 4 | household | — |
| 12 | `...000012` | Bagels | bread | American | 30m | 25m | 8 | household | — |
| 13 | `...000013` | Slow Cooker Roast | main | American | 10m | 480m | 6–8 | household | — |

---

## Recipe Notes

**Authentic Pizzeria Sauce** — Simple cooked tomato sauce. San Marzano tomatoes are non-negotiable.

**Buffalo Chicken Dip** — Creamy, spicy party dip credited to Brandee. Hill family staple.

**Feisty Feta Dip** — Whipped feta with roasted red peppers. Source: scrambledandspiced.com.

**Loaded Baked Potato Soup** — Hearty, loaded potato soup. Source: melobites.com.

**Creamy Tortellini Soup** — Sausage and tortellini soup. Source: Dan Pelosi, NYT Cooking.

**Lynn's Super Secret Fudge** — Family recipe, visibility set to `secret`. Only Lauren can see it (other household members cannot).

**Peanut Butter Balls** — Lauren's note: use HALF the amount of paraffin wax the recipe calls for. Encoded in ingredient `preparation_note` and an instruction `tip`.

**Macaroni and Cheese** — Ree Drummond's recipe. Source: Food Network.

**Homemade French Bread** — Source: Amy Nash, House of Nash Eats.

**Enchiladas De Pollo** — Family recipe.

**Chicken Piccata Sauce** — Sauce component only (partial recipe). Pairs with chicken.

**Bagels** — Source: Claire Saffitz, NYT Cooking.

**Slow Cooker Roast** — Component of French Dip Night. Slow cooker, 8 hours.

---

## Visibility Model

- `household` — all household members can see it (default)
- `secret` — only the recipe creator can see it (Lynn's Fudge)

RLS enforces this: `visibility = 'household' OR added_by = get_my_user_id()`
