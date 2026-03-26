/**
 * categorizeIngredient.js — Local keyword-based grocery category detection.
 * Returns a grocery_category string for shopping list items.
 */

const RULES = [
  ['produce', ['lettuce','tomato','onion','garlic','pepper','potato','carrot','celery','broccoli','spinach','kale','cucumber','zucchini','squash','mushroom','avocado','corn','bean sprout','green bean','pea','cabbage','cauliflower','eggplant','radish','beet','turnip','parsnip','leek','shallot','scallion','ginger','lemon','lime','orange','apple','banana','berry','blueberr','strawberr','raspberr','grape','melon','watermelon','peach','plum','pear','mango','pineapple','kiwi','cherry','fig','pomegranate','cilantro','parsley','basil','mint','dill','thyme','rosemary','oregano','chive','jalapeño','jalapeno','habanero','serrano','arugula','romaine','herb','salad','fruit','vegetable','produce']],
  ['meat', ['chicken','beef','pork','steak','ground beef','ground turkey','turkey','bacon','sausage','ham','lamb','veal','brisket','ribs','roast','tenderloin','chop','drumstick','thigh','breast','wing','meatball','hot dog','pepperoni','salami','prosciutto','chorizo','bratwurst','meat','jerky','deli meat']],
  ['seafood', ['salmon','tuna','shrimp','crab','lobster','fish','cod','tilapia','halibut','mahi','scallop','clam','mussel','oyster','anchov','sardine','catfish','trout','swordfish','bass','seafood','crawfish','calamari','squid','octopus']],
  ['dairy', ['milk','cheese','yogurt','butter','cream','sour cream','cream cheese','cottage cheese','ricotta','mozzarella','parmesan','cheddar','swiss','provolone','gouda','brie','feta','goat cheese','whipping cream','half and half','half & half','egg','eggs','margarine','ghee','dairy','whey','kefir']],
  ['bakery', ['bread','bun','roll','bagel','croissant','muffin','tortilla','pita','naan','biscuit','english muffin','hamburger bun','hot dog bun','flatbread','ciabatta','sourdough','rye','wheat bread','white bread','cake','pie crust','pastry','donut','doughnut','bakery']],
  ['frozen', ['frozen','ice cream','popsicle','frozen pizza','frozen vegetable','frozen fruit','frozen dinner','frozen waffle','frozen burrito','frozen fries','gelato','sorbet']],
  ['beverages', ['water','juice','soda','coffee','tea','wine','beer','seltzer','sparkling','lemonade','kombucha','milk alternative','oat milk','almond milk','coconut milk','soy milk','energy drink','gatorade','beverage','drink']],
  ['pantry', ['rice','pasta','noodle','flour','sugar','salt','pepper','oil','olive oil','vegetable oil','coconut oil','vinegar','soy sauce','hot sauce','ketchup','mustard','mayo','mayonnaise','ranch','dressing','sauce','broth','stock','soup','can','canned','tomato sauce','tomato paste','salsa','bean','lentil','chickpea','peanut butter','almond butter','jam','jelly','honey','maple syrup','syrup','cereal','oat','oatmeal','granola','cracker','chip','pretzel','popcorn','nut','almond','walnut','pecan','cashew','pistachio','seed','spice','cinnamon','cumin','paprika','turmeric','chili powder','garlic powder','onion powder','italian seasoning','bay leaf','vanilla','extract','baking soda','baking powder','yeast','cornstarch','cocoa','chocolate','brown sugar','powdered sugar','breadcrumb','panko','raisin','dried fruit','coconut','tortilla chip','taco shell','taco seasoning','enchilada','wrap','peanut','condiment','seasoning','marinade']],
  ['household', ['paper towel','toilet paper','trash bag','garbage bag','dish soap','laundry','detergent','sponge','aluminum foil','plastic wrap','sandwich bag','ziplock','ziploc','napkin','tissue','cleaning','bleach','wipe','battery','light bulb','candle']],
  ['personal_care', ['shampoo','conditioner','soap','body wash','lotion','deodorant','toothpaste','toothbrush','floss','razor','sunscreen','lip balm','cotton','band-aid','bandage','medicine','vitamin','supplement']],
]

export function categorizeIngredient(name) {
  if (!name) return 'other'
  const lower = name.toLowerCase().trim()
  for (const [category, keywords] of RULES) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category
    }
  }
  return 'other'
}
