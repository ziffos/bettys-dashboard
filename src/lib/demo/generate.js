// Synthetic data for demo mode.
//
// Everything commercially sensitive or personal is invented here: revenue,
// orders, platform payouts and take-rates, staff, wages, shifts, customers and
// their reviews. Only the menu itself is real (see ./menuSnapshot.js) because
// it is already published on the website and the delivery apps.
//
// Generation is seeded, so a given day produces byte-identical data on every
// reload — charts do not reshuffle between screenshots. It is also lazy: nothing
// runs until getTables() is first called, so a production build that never
// enters demo mode pays nothing for this file.

import { MENU_ITEMS, SELLABLE } from "./menuSnapshot";

export const DEMO_USER_ID = "demo-user-0001";

const DAY = 86400000;
// 14 months of history, so the 1Y range preset has something to show.
const HISTORY_DAYS = 430;
// Shifts are deliberately shallower. /calendar reads them with .limit(1000)
// ordered oldest-first, so a full 14 months of rostering would fill the quota
// with ancient rows and leave the current month blank.
const SHIFT_WINDOW_DAYS = 240;

const STAFF = [
  { name: "Alex Rivera", role: "admin", job: "Owner", rate: 0, bonus: 0 },
  { name: "Sam Chen", role: "employee", job: "Kitchen manager", rate: 9.5, bonus: 120 },
  { name: "Jordan Okafor", role: "employee", job: "Cook", rate: 8.75, bonus: 80 },
  { name: "Nina Kovacs", role: "employee", job: "Cook", rate: 9.0, bonus: 100 },
  { name: "Leo Bianchi", role: "employee", job: "Counter", rate: 8.5, bonus: 0 },
  { name: "Maya Haddad", role: "employee", job: "Driver", rate: 10.25, bonus: 150 },
  { name: "Tomas Reyes", role: "employee", job: "Counter, weekends", rate: 8.75, bonus: 60 },
];

const REVIEW_TEXT = {
  5: [
    "Best fried chicken in Limassol, hands down. The Family Deal feeds four properly.",
    "Crispy, juicy, still hot when it arrived. Blue cheese dip is excellent.",
    "Ordered the Hungry Hero and it was spot on. Fast delivery too.",
    "Consistently good. We order here most Fridays now.",
    "Halloumi burger is a great shout for the veggie in the group.",
    "Wings had a proper kick. Will be back.",
    "Staff were lovely when I collected. Food was perfect.",
    "Family Deal is genuinely good value. Fed four of us easily.",
    "Chicken stripes and sweet chili is my go-to. Never disappoints.",
  ],
  4: [
    "Really good chicken, though the fries could have been crispier.",
    "Solid meal, arrived a bit later than the app said.",
    "Tasty as always. Wish the portion of coleslaw were bigger.",
    "Good value for the combo. Would order again.",
    "Quick delivery and still hot. Only gripe is the packaging.",
  ],
  3: [
    "Chicken was fine but arrived lukewarm.",
    "Decent, nothing special this time. Previous orders were better.",
    "Missing a dip from the order, otherwise okay.",
  ],
  2: [
    "Order took over an hour and the fries were soggy by then.",
    "Got the wrong side dish. Chicken itself was okay.",
  ],
  1: ["Order never arrived and I still got charged.", "Cold and greasy, very disappointing."],
};

const REVIEWER_NAMES = [
  "A. Morgan", "C. Delgado", "P. Nowak", "S. Whitfield", "K. Andersen",
  "M. Rossi", "T. Fischer", "L. Varga", "J. Bakker", "R. Silva",
  "E. Lindqvist", "D. Moreau", "H. Yilmaz", "N. Pappas", "O. Brennan",
];

const QUOTES = [
  ["Quality is remembered long after price is forgotten.", "Aldo Gucci"],
  ["The details are not the details. They make the design.", "Charles Eames"],
  ["Take care of the customer and the business takes care of itself.", "Ray Kroc"],
  ["Simplicity is the ultimate sophistication.", "Leonardo da Vinci"],
  ["You can't manage what you don't measure.", "Peter Drucker"],
  ["Do one thing, and do it well.", "Doug McIlroy"],
  ["Well begun is half done.", "Aristotle"],
  ["Perfection is achieved when there is nothing left to take away.", "Antoine de Saint-Exupery"],
  ["Slow is smooth, and smooth is fast.", "Proverb"],
  ["The best time to plant a tree was twenty years ago.", "Proverb"],
];

const SHIFT_PATTERNS = [
  ["11:00", "17:00", 30],
  ["16:00", "23:00", 30],
  ["11:30", "22:30", 60],
  ["17:00", "23:00", 20],
  ["12:00", "20:00", 45],
];

const PLATFORMS = ["wolt", "foody", "bolt"];
const PLATFORM_MIX = [0.46, 0.32, 0.22]; // wolt-heavy, as in the real channel split
const PLATFORM_FEES = {
  wolt: { commission: 0.29, ads: 0.035, other: 0.011 },
  foody: { commission: 0.31, ads: 0.028, other: 0.009 },
  bolt: { commission: 0.265, ads: 0.021, other: 0.013 },
};

// Lunch bump, bigger dinner peak. Mon-Sat 11:30-22:30, closed Sunday.
const HOUR_WEIGHTS = [
  [11, 0.4], [12, 1.0], [13, 1.4], [14, 1.1], [15, 0.6], [16, 0.5],
  [17, 0.7], [18, 1.2], [19, 1.9], [20, 2.1], [21, 1.6], [22, 0.8],
];

const RATING_WEIGHTS = [[5, 0.58], [4, 0.24], [3, 0.1], [2, 0.05], [1, 0.03]];

function build() {
  // ------------------------------------------------------------- seeded rng
  let seed = 20260819;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const between = (lo, hi) => lo + rnd() * (hi - lo);
  const intBetween = (lo, hi) => Math.floor(between(lo, hi + 1));
  const round2 = (n) => Math.round(n * 100) / 100;

  // ------------------------------------------------------------- dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay = new Date(today.getTime() - HISTORY_DAYS * DAY);

  const iso = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  const eachDay = (fn) => {
    for (let i = 0; i <= HISTORY_DAYS; i++) {
      fn(new Date(firstDay.getTime() + i * DAY), i);
    }
  };
  const isOpen = (d) => d.getDay() !== 0;

  const hourTotal = HOUR_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  const randomHour = () => {
    let r = rnd() * hourTotal;
    for (const [h, w] of HOUR_WEIGHTS) {
      r -= w;
      if (r <= 0) return h;
    }
    return 20;
  };
  const stamp = (day, hour) => {
    const d = new Date(day);
    d.setHours(hour, intBetween(0, 59), intBetween(0, 59), 0);
    return d.toISOString();
  };

  // Weekend lift, gentle growth trend, seasonal wobble — so the trend charts
  // have a shape rather than flat noise.
  const dayFactor = (d, i) => {
    const dow = d.getDay();
    const weekend = dow === 5 ? 1.35 : dow === 6 ? 1.5 : dow === 4 ? 1.1 : 1.0;
    const growth = 1 + (i / HISTORY_DAYS) * 0.42;
    const season = 1 + 0.12 * Math.sin((i / 365) * Math.PI * 2);
    return weekend * growth * season * between(0.88, 1.12);
  };

  // ------------------------------------------------------------- staff
  const profiles = STAFF.map((s, i) => ({
    id: i === 0 ? DEMO_USER_ID : `demo-user-${String(i + 1).padStart(4, "0")}`,
    full_name: s.name,
    email: `${s.name.split(" ")[0].toLowerCase()}@example.com`,
    role: s.role,
    job_title: s.job,
    is_active: true,
    created_at: iso(firstDay),
  }));
  const employees = profiles.filter((p) => p.role === "employee");
  const rateOf = Object.fromEntries(
    profiles.map((p, i) => [p.id, { rate: STAFF[i].rate, bonus: STAFF[i].bonus }])
  );

  const page_permissions = employees.flatMap((e) =>
    ["calendar", "my-payroll", "menu"].map((slug) => ({
      id: `${e.id}-${slug}`,
      user_id: e.id,
      page_slug: slug,
    }))
  );

  // ------------------------------------------------------------- shifts
  const shifts = [];
  const rosterDay = (d) => {
    if (!isOpen(d)) return;
    const onDuty = [...employees].sort(() => rnd() - 0.5).slice(0, intBetween(3, 4));
    for (const e of onDuty) {
      const [start, end, brk] = pick(SHIFT_PATTERNS);
      shifts.push({
        id: `demo-shift-${shifts.length + 1}`,
        employee_id: e.id,
        shift_date: iso(d),
        start_time: start,
        end_time: end,
        break_minutes: brk,
        notes:
          rnd() < 0.08
            ? pick(["Covering a swap", "Closing duty", "Stock delivery"])
            : null,
        hourly_rate: rateOf[e.id].rate,
        created_by: DEMO_USER_ID,
      });
    }
  };
  eachDay((d, i) => {
    if (i < HISTORY_DAYS - SHIFT_WINDOW_DAYS) return;
    rosterDay(d);
  });
  // Roster two weeks ahead as well. A scheduling screen that stops dead at
  // today reads as broken rather than current.
  for (let i = 1; i <= 16; i++) {
    rosterDay(new Date(today.getTime() + i * DAY));
  }

  // ------------------------------------------------------------- orders
  const dips = MENU_ITEMS.filter((m) => m.category === "Dips");
  const drinks = MENU_ITEMS.filter((m) => m.category === "Drinks");
  // Combos dominate the best-seller charts, as they do in reality.
  const weighted = SELLABLE.flatMap((m) => {
    const n = m.category.includes("Combos") ? 6 : m.category === "Sides" ? 3 : 2;
    return Array(n).fill(m);
  });

  const pickPlatform = () => {
    const r = rnd();
    let acc = 0;
    for (let i = 0; i < PLATFORMS.length; i++) {
      acc += PLATFORM_MIX[i];
      if (r <= acc) return PLATFORMS[i];
    }
    return "wolt";
  };

  const buildBasket = (priceKey) => {
    const lines = [];
    let total = 0;
    const mains = intBetween(1, 2);
    for (let i = 0; i < mains; i++) {
      const item = pick(weighted);
      const qty = rnd() < 0.85 ? 1 : 2;
      lines.push(`${qty} ${item.canonical_name}`);
      total += (item[priceKey] ?? item.pos_price) * qty;
    }
    if (rnd() < 0.45) {
      const dip = pick(dips);
      const qty = intBetween(1, 2);
      lines.push(`${qty} ${dip.canonical_name}`);
      total += (dip[priceKey] ?? dip.pos_price) * qty;
    }
    if (rnd() < 0.3) {
      const drink = pick(drinks);
      lines.push(`1 ${drink.canonical_name}`);
      total += drink[priceKey] ?? drink.pos_price;
    }
    return { items: lines.join(", "), price: round2(total) };
  };

  const pos_sales = [];
  const delivery_purchases = [];

  eachDay((d, i) => {
    if (!isOpen(d)) return;
    const f = dayFactor(d, i);

    const posCount = Math.round(between(18, 26) * f);
    for (let n = 0; n < posCount; n++) {
      const { items, price } = buildBasket("pos_price");
      pos_sales.push({
        id: `demo-pos-${pos_sales.length + 1}`,
        order_placed: stamp(d, randomHour()),
        price,
        items,
      });
    }

    const delCount = Math.round(between(26, 38) * f);
    for (let n = 0; n < delCount; n++) {
      const partner = pickPlatform();
      const { items, price } = buildBasket(`${partner}_price`);
      // ~4% fall over, so the Rejected/Cancelled KPI has something real.
      const rejected = rnd() < 0.04;
      delivery_purchases.push({
        id: `demo-del-${delivery_purchases.length + 1}`,
        order_placed: stamp(d, randomHour()),
        price,
        items,
        delivery_partner: partner,
        delivery_status: rejected ? pick(["rejected", "cancelled"]) : "delivered",
        order_reference: `DM-${String(delivery_purchases.length + 1).padStart(6, "0")}`,
      });
    }
  });

  // ------------------------------------------------------------- payouts
  const platform_payouts = [];
  const grossByPeriod = new Map();
  for (const o of delivery_purchases) {
    if (o.delivery_status !== "delivered") continue;
    const periodIndex = Math.floor(
      (new Date(o.order_placed).getTime() - firstDay.getTime()) / (14 * DAY)
    );
    const key = `${o.delivery_partner}|${periodIndex}`;
    grossByPeriod.set(key, (grossByPeriod.get(key) || 0) + o.price);
  }
  let payoutN = 0;
  for (const [key, gross] of grossByPeriod) {
    const [platform, idxStr] = key.split("|");
    const from = new Date(firstDay.getTime() + Number(idxStr) * 14 * DAY);
    const to = new Date(from.getTime() + 13 * DAY);
    if (to > today) continue; // periods still open have not been settled
    const f = PLATFORM_FEES[platform];
    const commission = round2(gross * f.commission * between(0.97, 1.03));
    const ads = round2(gross * f.ads * between(0.6, 1.5));
    const other = round2(gross * f.other * between(0.8, 1.2));
    payoutN++;
    platform_payouts.push({
      id: `demo-payout-${payoutN}`,
      platform,
      period_from: iso(from),
      period_to: iso(to),
      gross_sales: round2(gross),
      commission_total: commission,
      ad_spend: ads,
      other_fees: other,
      net_payout: round2(gross - commission - ads - other),
      invoice_number: `${platform.slice(0, 2).toUpperCase()}-${iso(from).replace(/-/g, "")}-${String(payoutN).padStart(4, "0")}`,
      notes: null,
    });
  }
  platform_payouts.sort((a, b) => (a.period_from < b.period_from ? 1 : -1));

  // ------------------------------------------------------------- reviews
  const pickRating = () => {
    let r = rnd();
    for (const [rating, w] of RATING_WEIGHTS) {
      r -= w;
      if (r <= 0) return rating;
    }
    return 5;
  };

  const reviews = [];
  eachDay((d) => {
    if (!isOpen(d)) return;
    const count = rnd() < 0.85 ? intBetween(2, 5) : 0;
    for (let i = 0; i < count; i++) {
      const rating = pickRating();
      const platform = pick(["google", "wolt", "foody", "bolt"]);
      const linked =
        rnd() < 0.4
          ? delivery_purchases[intBetween(0, delivery_purchases.length - 1)]
          : null;
      reviews.push({
        id: `demo-review-${reviews.length + 1}`,
        rating,
        // Delivery-platform ratings often carry no text; keep some blanks so
        // the "With comment only" filter has something to actually do.
        review_text: rnd() < 0.22 ? null : pick(REVIEW_TEXT[rating]),
        reviewer_name: platform === "google" ? pick(REVIEWER_NAMES) : null,
        review_date: stamp(d, randomHour()),
        source_platform: platform,
        order_reference: linked ? linked.order_reference : null,
      });
    }
  });
  reviews.sort((a, b) => (a.review_date < b.review_date ? 1 : -1));

  // ------------------------------------------------------------- social
  const social_stats = [];
  eachDay((d, i) => {
    const growth = i / HISTORY_DAYS;
    for (const platform of ["facebook", "instagram"]) {
      const base = platform === "facebook" ? 1400 : 2600;
      // A modest viral bump. Keep it small enough that one spike does not
      // flatten the rest of the series into a straight line.
      const spike = rnd() < 0.07 ? between(1.5, 2.3) : 1;
      social_stats.push({
        id: `demo-social-${social_stats.length + 1}`,
        stat_date: iso(d),
        platform,
        total_reach: Math.round(base * (0.7 + growth * 0.9) * between(0.6, 1.5) * spike),
        ad_spend: rnd() < 0.35 ? round2(between(8, 45)) : 0,
        follower_count: Math.round(
          (platform === "facebook" ? 2100 : 4300) * (1 + growth * 0.55) + between(-12, 12)
        ),
      });
    }
  });

  // ------------------------------------------------------------- payroll
  const hoursFor = (s) => {
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    return (eh * 60 + em - (sh * 60 + sm) - s.break_minutes) / 60;
  };

  const rate_changes = employees.map((e, i) => ({
    id: `demo-rate-${i + 1}`,
    employee_id: e.id,
    hourly_rate: rateOf[e.id].rate,
    monthly_bonus: rateOf[e.id].bonus,
    bonus_description: rateOf[e.id].bonus ? "Monthly performance bonus" : null,
    effective_year: firstDay.getFullYear(),
    effective_month: firstDay.getMonth() + 1,
  }));

  const payroll_records = [];
  const payroll_payments = [];
  const byMonth = new Map();
  for (const s of shifts) {
    const [y, m] = s.shift_date.split("-").map(Number);
    const key = `${s.employee_id}|${y}|${m}`;
    const cur = byMonth.get(key) || { hours: 0, count: 0 };
    cur.hours += hoursFor(s);
    cur.count += 1;
    byMonth.set(key, cur);
  }
  for (const [key, agg] of byMonth) {
    const [employee_id, yStr, mStr] = key.split("|");
    const year = Number(yStr);
    const month = Number(mStr);
    if (new Date(year, month, 0) >= today) continue; // month not finished

    const { rate, bonus } = rateOf[employee_id];
    const totalHours = Math.round(agg.hours * 10) / 10;
    const gross = round2(totalHours * rate + bonus);
    const roll = rnd();
    const status = roll < 0.72 ? "paid" : roll < 0.88 ? "partial" : "unpaid";
    const amountPaid =
      status === "paid" ? gross : status === "partial" ? round2(gross * between(0.3, 0.7)) : 0;

    const id = `demo-payroll-${payroll_records.length + 1}`;
    payroll_records.push({
      id,
      employee_id,
      year,
      month,
      total_hours: totalHours,
      hourly_rate: rate,
      monthly_bonus: bonus,
      bonus_description: bonus ? "Monthly performance bonus" : null,
      gross_expected: gross,
      amount_paid: amountPaid,
      status,
      first_paid_at: amountPaid > 0 ? iso(new Date(year, month, intBetween(2, 8))) : null,
      updated_by: DEMO_USER_ID,
    });

    if (amountPaid > 0) {
      const parts = status === "paid" && rnd() < 0.4 ? 2 : 1;
      let left = amountPaid;
      for (let p = 0; p < parts; p++) {
        const amt = p === parts - 1 ? round2(left) : round2(amountPaid / parts);
        left -= amt;
        payroll_payments.push({
          id: `demo-payment-${payroll_payments.length + 1}`,
          payroll_id: id,
          amount: amt,
          paid_at: iso(new Date(year, month, intBetween(2, 12) + p * 6)),
          payment_note: p > 0 ? "Balance" : null,
          created_by: DEMO_USER_ID,
        });
      }
    }
  }

  const quotes = QUOTES.map(([text, author], i) => ({
    id: `demo-quote-${i + 1}`,
    text,
    author,
  }));

  return {
    profiles,
    page_permissions,
    menu_items: MENU_ITEMS.map((m) => ({ ...m })),
    menu_item_price_history: [], // empty → pages fall back to current prices
    shifts,
    pos_sales,
    delivery_purchases,
    platform_payouts,
    reviews,
    social_stats,
    payroll_records,
    payroll_payments,
    rate_changes,
    quotes,
  };
}

let cache = null;

export function getTables() {
  if (!cache) cache = build();
  return cache;
}

export function getDemoProfile() {
  return getTables().profiles[0];
}
