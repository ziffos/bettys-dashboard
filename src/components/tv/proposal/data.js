/*
 * Menu restructure proposal — illustrative data, NOT wired to Supabase.
 *
 * Deliberately static: this is a different menu *shape* to the one in the
 * database (piece ladders and a flat meal upgrade instead of fixed combos), so
 * there is nothing in `menu_items` to read it from. Nothing here writes to or
 * reads from the live menu; the real boards are unaffected.
 *
 * Prices are reverse-engineered from the current menu's own internal logic:
 * subtracting Betty's Classic from Hungry Hero gives €1.03 per crispy piece,
 * Spicy Wings from Wicked Wings gives €0.53 per wing, and side+drink falls out
 * at ~€3.40. They hold today's meal prices to within about 40c. They have NOT
 * been checked against food cost — that needs the real numbers.
 */

const IMG = "https://nhtxpinnvuqpfwnatqre.supabase.co/storage/v1/object/public/menu-images";

export const ORANGE = "#FFA000";

/* One rule for the whole menu. */
export const MEAL_UPGRADE = 3.5;

/* Step 1 — pick your chicken. Each has its own ladder, so the piece counts can
 * follow how the item is actually portioned rather than a shared grid. */
export const CHICKEN = [
  {
    key: "crispy",
    name: "Crispy Chicken",
    blurb: "Bone-in, hand-breaded",
    image: `${IMG}/Hungry%20Hero.jpg`,
    ladder: [
      { pcs: 3, price: 3.0 },
      { pcs: 6, price: 6.0 },
      { pcs: 9, price: 8.6 },
      { pcs: 12, price: 11.0 },
      { pcs: 20, price: 17.0 },
    ],
  },
  {
    key: "wings",
    name: "Spicy Wings",
    blurb: "Our house hot rub",
    image: `${IMG}/bettys%20spicy%20wings%201.jpg`,
    ladder: [
      { pcs: 6, price: 3.3 },
      { pcs: 9, price: 4.8 },
      { pcs: 12, price: 6.2 },
      { pcs: 20, price: 9.8 },
      { pcs: 30, price: 13.5 },
    ],
  },
  {
    key: "stripes",
    name: "Chicken Stripes",
    blurb: "Boneless tenders",
    image: `${IMG}/Chicken%20Stripes.png`,
    ladder: [
      { pcs: 3, price: 3.5 },
      { pcs: 5, price: 5.7 },
      { pcs: 8, price: 8.8 },
      { pcs: 12, price: 12.6 },
    ],
  },
];

export const MIX_BOX = {
  name: "Mix Box",
  blurb: "Any 12 pieces — your choice",
  image: `${IMG}/Betty's%20Family%20Deal.jpg`,
  price: 10.5,
};

/* Step 2 — make it a meal. */
export const MEAL_SIDES = [
  { name: "French Fries" },
  { name: "Crispy Coleslaw" },
  { name: "Mashed Potatoes" },
  { name: "Rice with Corn" },
  { name: "Sweet Potatoes", supplement: 1.0 },
];

export const MEAL_DRINKS = [
  "Coca-Cola",
  "Coca-Cola Zero",
  "Fanta",
  "7Up",
  "Diet 7Up",
  "Soda",
];

export const DIPS = {
  price: 0.7,
  items: ["Betty's Chicken Sauce", "Blue Cheese", "Honey Mustard", "Sweet Chili"],
};

/* Step 3 — sharing boxes. Each is priced 15-27% under the sum of its parts, so
 * the saving is real rather than a rounding trick. */
export const BOXES = [
  {
    name: "Duo Box",
    feeds: 2,
    image: `${IMG}/Double%20Delight.jpg`,
    contents: ["6 Crispy chicken", "6 Spicy wings", "2 Sides", "2 Drinks"],
    price: 13.9,
    was: 16.3,
  },
  {
    name: "Family Box",
    feeds: 4,
    image: `${IMG}/Betty's%20Family%20Deal.jpg`,
    contents: [
      "6 Crispy chicken",
      "6 Spicy wings",
      "6 Chicken stripes",
      "3 Sides",
      "2 Coleslaw",
      "4 Drinks",
    ],
    price: 24.95,
    was: 34.2,
    hero: true,
  },
  {
    name: "Party Box",
    feeds: 6,
    image: `${IMG}/Betty's%20Classic.jpg`,
    contents: [
      "12 Crispy chicken",
      "20 Spicy wings",
      "12 Chicken stripes",
      "6 Sides",
      "6 Drinks",
    ],
    price: 42.0,
    was: 54.4,
  },
  {
    name: "Wing Box",
    feeds: 3,
    image: `${IMG}/Mega%20Wing%20Pack.png`,
    contents: ["30 Spicy wings"],
    price: 13.5,
    was: 16.5,
    note: "Replaces the 20-for-€15.30 pack",
  },
];

/* Step 4 — everything else. Same +meal rule applies. */
export const SANDWICHES = [
  { name: "Chicken Wrap", price: 6.0, image: `${IMG}/Chicken%20Wrap.png` },
  { name: "Chicken Sandwich", price: 7.0, image: `${IMG}/Chicken%20Sandwich.jpg` },
  { name: "Vegetable Burger", price: 7.0 },
  { name: "Chicken Burger", price: 8.0, image: `${IMG}/Chicken%20Burger.png` },
  { name: "Halloumi Burger", price: 8.0, image: `${IMG}/Halloumi%20Burger.png` },
  { name: "Beef Burger", price: 10.0, image: `${IMG}/Beef%20Burger%202.png` },
];

export const SIDES_ALACARTE = [
  { name: "Sweet Potatoes", price: 4.0 },
  { name: "French Fries", price: 3.0 },
  { name: "Crispy Coleslaw", price: 3.0 },
  { name: "Mashed Potatoes", price: 3.0 },
  { name: "Rice with Corn", price: 2.0 },
];

export const DRINKS_ALACARTE = [
  { name: "Soft Drinks 330ml", price: 1.5 },
  { name: "Water", price: 0.8 },
];

export const money = (n) => `€${Number(n).toFixed(2)}`;
