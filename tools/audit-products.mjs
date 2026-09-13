// Reconcile Products with production.
import { buildSalesModel, dayOf, SOURCE_IDS } from "../src/lib/salesModel.js";
import { buildMenuMatcher, buildPriceLookup } from "../src/lib/menuMatch.js";
import { eachDay, parseItems } from "../src/lib/format.js";

const URL = "https://nhtxpinnvuqpfwnatqre.supabase.co/rest/v1";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odHhwaW5udnVxcGZ3bmF0cXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNTM1MDEsImV4cCI6MjA3OTkyOTUwMX0.214hDg97grdATQsnMMVtHHX--TH1O_1fee_4ou6spRk";
async function all(t, sel) {
  const o = [];
  for (let p = 0; ; p++) {
    const r = await fetch(`${URL}/${t}?select=${sel}&limit=1000&offset=${p * 1000}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!r.ok) throw new Error(`${t}: ${r.status} ${await r.text()}`);
    const rows = await r.json();
    o.push(...rows);
    if (rows.length < 1000) return o;
  }
}

const [deliveries, pos, menuItems, priceHistory] = await Promise.all([
  all("delivery_purchases", "order_placed,price,items,delivery_status,delivery_partner"),
  all("pos_sales", "order_placed,price,items"),
  all("menu_items", "canonical_name,category,is_active,wolt_name,foody_name,bolt_name,pos_name,wolt_price,foody_price,bolt_price,pos_price"),
  all("menu_item_price_history", "canonical_name,platform,price,valid_from,valid_to"),
]);
const match = buildMenuMatcher(menuItems);
const priceOn = buildPriceLookup(priceHistory);

const FROM = "2026-08-17", TO = "2026-09-13";
const inRange = (ts) => { const d = dayOf(ts); return d >= FROM && d <= TO; };

let lines = 0, units = 0, unmatchedLines = 0, unmatchedUnits = 0;
const unmatchedNames = new Map();
let reconstructed = 0;
const byChannelUnits = { wolt: 0, foody: 0, bolt: 0, pos: 0 };
const walk = (rows, platformOf) => {
  for (const row of rows) {
    if (!inRange(row.order_placed)) continue;
    const platform = platformOf(row);
    if (!platform) continue;
    for (const { qty, name } of parseItems(row.items)) {
      lines++; units += qty;
      const item = match(platform, name);
      if (!item) {
        unmatchedLines++; unmatchedUnits += qty;
        unmatchedNames.set(`${platform}: ${name}`, (unmatchedNames.get(`${platform}: ${name}`) || 0) + qty);
        continue;
      }
      byChannelUnits[platform] += qty;
      reconstructed += qty * priceOn(item, platform, dayOf(row.order_placed));
    }
  }
};
walk(deliveries.filter((d) => (d.delivery_status || "").toLowerCase() === "delivered"),
     (d) => { const p = (d.delivery_partner || "").toLowerCase(); return SOURCE_IDS.includes(p) ? p : null; });
walk(pos, () => "pos");

const s = buildSalesModel({ deliveries, pos, payouts: [] });
const actual = eachDay(FROM, TO).reduce((a, d) => a + s.grossOn(d), 0);

console.log(`window ${FROM} → ${TO}`);
console.log(`order lines parsed: ${lines}, units ${units}`);
console.log(`unmatched: ${unmatchedLines} lines (${(unmatchedLines/lines*100).toFixed(1)}%), ${unmatchedUnits} units — DROPPED from every Products figure`);
console.log(`units counted per channel: ${JSON.stringify(byChannelUnits)}`);
console.log(`\nrevenue reconstructed from the price list: ${reconstructed.toFixed(2)}`);
console.log(`revenue actually charged (order prices):   ${actual.toFixed(2)}`);
console.log(`difference: ${(reconstructed - actual).toFixed(2)}  (${((reconstructed/actual - 1) * 100).toFixed(1)}%)`);

console.log("\ntop unmatched names:");
for (const [k, v] of [...unmatchedNames.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log("  " + String(v).padStart(4), k);
}

const active = menuItems.filter((m) => m.is_active);
console.log(`\nmenu: ${menuItems.length} items, ${active.length} active`);
const missingAlias = active.filter((m) => !m.wolt_name || !m.foody_name || !m.bolt_name || !m.pos_name);
console.log(`active items missing at least one alias: ${missingAlias.length}`);
for (const m of missingAlias.slice(0, 8)) {
  const gaps = ["wolt","foody","bolt","pos"].filter((p) => !m[`${p}_name`]);
  console.log("  ", m.canonical_name, "— no", gaps.join(", "));
}
