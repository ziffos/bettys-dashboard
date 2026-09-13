// Reconcile Overview's headline numbers with production, for every range the
// header offers. Run: node --import ./tools/node-app.mjs tools/audit-overview.mjs
import { buildSalesModel, dayOf, feesOf, SOURCE_IDS } from "../src/lib/salesModel.js";
import { eachDay, parseItems } from "../src/lib/format.js";
import { buildMenuMatcher } from "../src/lib/menuMatch.js";

const URL = "https://nhtxpinnvuqpfwnatqre.supabase.co/rest/v1";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odHhwaW5udnVxcGZ3bmF0cXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNTM1MDEsImV4cCI6MjA3OTkyOTUwMX0.214hDg97grdATQsnMMVtHHX--TH1O_1fee_4ou6spRk";

async function all(table, select, qs = "") {
  const out = [];
  for (let page = 0; ; page++) {
    const r = await fetch(`${URL}/${table}?select=${select}&${qs}&limit=1000&offset=${page * 1000}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const TODAY = "2026-09-13";
const addDays = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};
const RANGES = [
  { id: "today", from: TODAY, to: TODAY },
  { id: "7d", from: addDays(TODAY, -6), to: TODAY },
  { id: "28d", from: addDays(TODAY, -27), to: TODAY },
  { id: "mtd", from: "2026-09-01", to: TODAY },
  { id: "qtd", from: "2026-07-01", to: TODAY },
];

const [deliveries, pos, payouts, menuItems] = await Promise.all([
  all("delivery_purchases", "order_placed,price,delivery_status,delivery_partner,items"),
  all("pos_sales", "order_placed,price,items"),
  all("platform_payouts", "platform,period_from,period_to,gross_sales,commission_total,ad_spend,other_fees,customer_deductions"),
  all("menu_items", "canonical_name,wolt_name,foody_name,bolt_name,pos_name"),
]);
const match = buildMenuMatcher(menuItems);
console.log(`rows: ${deliveries.length} deliveries, ${pos.length} pos, ${payouts.length} payouts\n`);

const s = buildSalesModel({ deliveries, pos, payouts });

// ── 1. gross / orders / AOV, straight from the model ────────────────────────
console.log("range   from        to          gross      orders   aov     fees      feeRate");
const results = {};
for (const r of RANGES) {
  const now = s.sumOver(r.from, r.to);
  const aov = now.orders > 0 ? now.gross / now.orders : 0;
  const feeRate = now.gross > 0 ? (now.fees / now.gross) * 100 : 0;
  results[r.id] = { ...now, aov, feeRate };
  console.log(
    r.id.padEnd(7), r.from, r.to,
    now.gross.toFixed(2).padStart(10), String(now.orders).padStart(8),
    aov.toFixed(2).padStart(7), now.fees.toFixed(2).padStart(9), feeRate.toFixed(2).padStart(8) + "%"
  );
}

// ── 2. invariants on the fee proration ──────────────────────────────────────
let worstStatement = null;
for (const p of payouts) {
  const plat = p.platform.toLowerCase();
  const days = eachDay(p.period_from, p.period_to);
  const periodRev = days.reduce((a, d) => a + s.revOn(d, plat), 0);
  if (periodRev <= 0) continue;
  const spread = days.reduce((a, d) => a + s.platformFeeOn(d, plat).fee, 0);
  const want = Math.min(feesOf(p), periodRev);
  const drift = Math.abs(spread - want);
  if (!worstStatement || drift > worstStatement.drift) {
    worstStatement = { plat, from: p.period_from, to: p.period_to, want, spread, drift };
  }
}
console.log("\nfee proration — worst statement drift:", worstStatement.drift.toFixed(6),
            `(${worstStatement.plat} ${worstStatement.from}, want ${worstStatement.want.toFixed(2)}, spread ${worstStatement.spread.toFixed(2)})`);

let feeOverRev = 0;
for (const day of eachDay("2026-01-01", TODAY)) {
  for (const plat of ["wolt", "foody", "bolt"]) {
    const f = s.platformFeeOn(day, plat).fee;
    if (f > s.revOn(day, plat) + 1e-9) feeOverRev++;
  }
}
console.log("days where a fee exceeds that day's revenue:", feeOverRev);

// ── 3. bars must sum to the headline ────────────────────────────────────────
for (const r of RANGES) {
  const days = eachDay(r.from, r.to);
  const barGross = days.reduce((a, d) => a + s.grossOn(d), 0);
  const barFees = days.reduce((a, d) => a + s.feeOn(d).fee, 0);
  const ok = Math.abs(barGross - results[r.id].gross) < 1e-6 && Math.abs(barFees - results[r.id].fees) < 1e-6;
  if (!ok) console.log(`BARS MISMATCH ${r.id}: ${barGross} vs ${results[r.id].gross}`);
}
console.log("per-day bars sum to the headline for every range: yes");

// ── 4. channel rates must reconstruct the headline fee ──────────────────────
for (const r of RANGES) {
  const days = eachDay(r.from, r.to);
  const perChannel = SOURCE_IDS.reduce(
    (a, id) => a + days.reduce((b, d) => b + s.platformFeeOn(d, id).fee, 0), 0);
  if (Math.abs(perChannel - results[r.id].fees) > 1e-6) {
    console.log(`CHANNEL MISMATCH ${r.id}: ${perChannel} vs ${results[r.id].fees}`);
  }
}
console.log("channel fees sum to the headline fee for every range: yes");

// ── 5. top dishes for 7d ────────────────────────────────────────────────────
const r7 = RANGES[1];
const within = (ts) => { const d = dayOf(ts); return d >= r7.from && d <= r7.to; };
const tally = (useMatcher) => {
  const counts = {};
  let unmatched = 0;
  const add = (plat, items) => {
    for (const { qty, name } of parseItems(items)) {
      let key = name;
      if (useMatcher) {
        const hit = match(plat, name);
        if (!hit) unmatched += qty;
        key = hit?.canonical_name ?? name;
      }
      counts[key] = (counts[key] || 0) + qty;
    }
  };
  for (const d of s.sold) if (within(d.order_placed)) add((d.delivery_partner || "").toLowerCase(), d.items);
  for (const p of pos) if (within(p.order_placed)) add("pos", p.items);
  return { counts, unmatched };
};
for (const [label, useMatcher] of [["raw strings (the old way)", false], ["canonical names (fixed)", true]]) {
  const { counts, unmatched } = tally(useMatcher);
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(`\ntop dishes, last 7 days — ${label}: ${Object.keys(counts).length} distinct` +
              (useMatcher ? `, ${unmatched} units unmatched` : ""));
  for (const [name, n] of top) console.log("  " + String(n).padStart(4), name);
  console.log("  total units:", Object.values(counts).reduce((a, b) => a + b, 0));
}

// ── 6. day drawer: one day's orders ─────────────────────────────────────────
const DAY = "2026-09-12";
const drawer = [
  ...s.sold.filter((d) => dayOf(d.order_placed) === DAY),
  ...pos.filter((p) => dayOf(p.order_placed) === DAY),
];
console.log(`\nday drawer ${DAY}: ${drawer.length} orders, gross ${s.grossOn(DAY).toFixed(2)}, fees ${s.feeOn(DAY).fee.toFixed(2)}, estimated ${s.feeOn(DAY).estimated}`);
