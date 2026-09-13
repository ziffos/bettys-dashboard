// Real menu snapshot. This is the only demo data that is NOT synthetic.
//
// Item names, descriptions and prices are already public — they are printed on
// bettyscrispychicken.com and on the Wolt / Foody / Bolt listings — so keeping
// them real costs nothing and makes the TV boards and the menu screen look like
// the product they actually are. Everything commercially sensitive (revenue,
// payouts, wages, customers) is generated in ./generate.js instead.

const raw = [
  ["Betty's Classic", "Fried Chicken Combos", "3 pcs Crispy chicken · 1 Side dish · 1 Soft drink", 7.2, 6.5, 1, "Betty's%20Classic.jpg", 1, 1, 1],
  ["Hungry Hero", "Fried Chicken Combos", "6 pcs Crispy chicken · 1 Side dish · 1 Soft drink", 10.6, 9.6, 2, "Hungry%20Hero.jpg", 1, 1, 2],
  ["Double Delight", "Fried Chicken Combos", "6 pcs Crispy chicken · 2 Side dishes · 2 Soft drinks", 11.9, 10.8, 3, "Double%20Delight.jpg", 2, 1, 3],
  ["Betty's Family Deal", "Fried Chicken Combos", "6 pcs Crispy chicken · 6 pcs Spicy Wings · 6 Chicken Stripes · 3 Sides · 2 Coleslaw · 4 Soft drinks", 26.95, 24.95, 4, "Betty's%20Family%20Deal.jpg", 4, 1, 4],
  ["Betty's Spicy Wings", "Fried Chicken Combos", "6 Spicy wings · 1 Side dish · 1 Soft drink", 7.0, 6.4, 5, "bettys%20spicy%20wings%201.jpg", 1, 2, 1],
  ["Mega Wing Pack", "Fried Chicken Combos", "20 Spicy Wings", 16.8, 15.3, 6, "Mega%20Wing%20Pack.png", 2, 2, 2],
  ["Chicken Stripes Combo", "Fried Chicken Combos", "5 Chicken Stripes · 1 Side dish · 1 Soft drink", 9.9, 9.0, 7, "Chicken%20Stripes.png", 1, 2, 3],
  ["Chicken Wrap Combo", "Burger & Wrap Combos", "1 Chicken wrap · 1 Side dish · 1 Soft drink", 8.8, 8.0, 8, "Chicken%20Wrap.png", 1, 2, 4],
  ["Chicken Burger Combo", "Burger & Wrap Combos", "1 Chicken burger · 1 Side dish · 1 Soft drink", 11.0, 10.0, 9, "Chicken%20Burger.png", 1, 3, 1],
  ["Beef Burger Combo", "Burger & Wrap Combos", "1 Beef burger · 1 Side dish · 1 Soft drink", 13.2, 12.0, 10, "Beef%20Burger%202.png", 1, 3, 2],
  ["Halloumi Burger Combo", "Burger & Wrap Combos", "1 Halloumi burger · 1 Side dish · 1 Soft drink", 11.0, 10.0, 11, "Halloumi%20Burger.png", 1, 3, 3],
  ["Chicken Sandwich Combo", "Burger & Wrap Combos", "1 Chicken sandwich · 1 Side dish · 1 Soft drink", 9.9, 9.0, 12, "Chicken%20Sandwich.jpg", 1, 3, 4],
  ["Wicked Wings", "Fried Chicken Combos", "9 Spicy wings · 1 Side dish · 1 Soft drink", 8.8, 8.0, 13, "Wicked%20Wings.jpg", 1, null, null],
  ["Chicken Burger", "Products", "Crispy battered chicken thigh fillet with fresh vegetables in a soft bun.", 8.8, 8.0, 14, null, 1, null, null],
  ["Beef Burger", "Products", "Juicy premium beef patty with fresh vegetables in a soft bun.", 11.0, 10.0, 15, null, 1, null, null],
  ["Halloumi Burger", "Products", "Grilled Halloumi with Chili-Mint Sauce, Pickled Cucumber, Tomato, Lettuce.", 8.8, 8.0, 16, null, 1, null, null],
  ["Chicken Sandwich", "Products", "Crispy fried chicken thigh fillet with vegetables in a soft bun.", 7.7, 7.0, 17, null, 1, null, null],
  ["Chicken Stripes (5pcs)", "Products", "5 pcs Chicken stripes in beer-battered crust with Sweet Chili sauce.", 8.3, 7.5, 18, null, 1, null, null],
  ["Chicken Wrap", "Products", "Crispy battered chicken, fresh vegetables, and creamy sauce in a tortilla.", 6.6, 6.0, 19, null, 1, null, null],
  ["Crispy Chicken", "Products", "Juicy, bone-in fried chicken, seasoned and cooked to crispy perfection.", 2.2, 2.0, 20, null, 1, null, null],
  ["Spicy Wings", "Products", "Spicy chicken wings with a crispy, seasoned batter.", 1.1, 1.0, 21, null, 1, null, null],
  ["Crispy Coleslaw", "Sides", "Fresh cabbage, carrots, pineapple, apple, mixed with creamy mayo.", 3.3, 3.0, 22, null, 1, null, null],
  ["French Fries", "Sides", "Crispy, Golden and Freshly fried potatoes.", 3.3, 3.0, 23, null, 1, null, null],
  ["Mashed Potatoes", "Sides", "Creamy, buttery mashed potatoes topped with rich, savory gravy.", 3.3, 3.0, 24, null, 1, null, null],
  ["Rice with Corn", "Sides", "Fluffy white rice mixed with sweet corn.", 2.2, 2.0, 25, null, 1, null, null],
  ["Sweet Potatoes", "Sides", null, 4.4, 4.0, 26, null, 1, null, null],
  ["Betty's Chicken Sauce", "Dips", null, 0.8, 0.7, 27, null, 1, null, null],
  ["Blue Cheese", "Dips", null, 0.8, 0.7, 28, null, 1, null, null],
  ["Honey Mustard", "Dips", null, 0.8, 0.7, 29, null, 1, null, null],
  ["Sweet Chili", "Dips", null, 0.8, 0.7, 30, null, 1, null, null],
  ["7Up 330ml", "Drinks", null, 1.7, 1.5, 31, null, 1, null, null],
  ["Coca-Cola 330ml", "Drinks", null, 1.7, 1.5, 32, null, 1, null, null],
  ["Coca-Cola Zero 330ml", "Drinks", null, 1.7, 1.5, 33, null, 1, null, null],
  ["Diet 7Up 330ml", "Drinks", null, 1.7, 1.5, 34, null, 1, null, null],
  ["Fanta 330ml", "Drinks", null, 1.7, 1.5, 35, null, 1, null, null],
  ["Soda", "Drinks", null, 1.7, 1.5, 36, null, 1, null, null],
  ["Water", "Drinks", null, 0.9, 0.8, 37, null, 1, null, null],
];

const BUCKET =
  "https://nhtxpinnvuqpfwnatqre.supabase.co/storage/v1/object/public/menu-images";

export const MENU_ITEMS = raw.map(
  ([name, category, description, deliveryPrice, posPrice, sortOrder, image, servings, tvNumber, position], i) => ({
    id: `demo-menu-${String(i + 1).padStart(3, "0")}`,
    canonical_name: name,
    category,
    description,
    // The alias columns /products matches incoming order lines against.
    //
    // In production the three platforms genuinely disagree: Wolt keeps the
    // name as written, Foody lower-cases it and swaps the apostrophe for a
    // backtick, the till shouts it in capitals. Demo used to give all four the
    // identical canonical name, which meant it never exercised the matcher at
    // all. And Halloumi Burger really has no till name, which is what the
    // Menu screen's "priced but unnamed" warning is for.
    pos_name: name === "Halloumi Burger" ? null : name.toUpperCase(),
    wolt_name: name,
    foody_name: name.toLowerCase().replace(/'/g, "`"),
    bolt_name: name,
    wolt_price: deliveryPrice,
    foody_price: deliveryPrice,
    bolt_price: deliveryPrice,
    pos_price: posPrice,
    sort_order: sortOrder,
    image_url: image ? `${BUCKET}/${image}` : null,
    servings,
    is_active: true,
    tv_number: tvNumber,
    position,
    foody_pieces_per_unit: 1,
  })
);

// Items that plausibly head up an order, weighted so the combos dominate the
// best-seller charts the way they do in the real data.
export const SELLABLE = MENU_ITEMS.filter(
  (m) => m.category !== "Dips" && m.category !== "Drinks"
);
