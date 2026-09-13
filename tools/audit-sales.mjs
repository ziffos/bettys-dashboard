// Reconcile Sales with production. node --import ./tools/node-app.mjs tools/audit-sales.mjs
import { buildSalesModel, dayOf, hourOf, SOURCE_IDS } from "../src/lib/salesModel.js";
import { eachDay, parseDay } from "../src/lib/format.js";

const URL = "https://nhtxpinnvuqpfwnatqre.supabase.co/rest/v1";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odHhwaW5udnVxcGZ3bmF0cXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNTM1MDEsImV4cCI6MjA3OTkyOTUwMX0.214hDg97grdATQsnMMVtHHX--TH1O_1fee_4ou6spRk";
async function all(t, sel) {
  const o = [];
  for (let p = 0; ; p++) {
    const r = await fetch(`${URL}/${t}?select=${sel}&limit=1000&offset=${p * 1000}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!r.ok) throw new Error(`${t}: ${r.status}`);
    const rows = await r.json();
    o.push(...rows);
    if (rows.length < 1000) return o;
  }
}

const [deliveries, pos, payouts] = await Promise.all([
  all("delivery_purchases", "order_placed,price,delivery_status,delivery_partner"),
  all("pos_sales", "order_placed,price"),
  all("platform_payouts", "platform,period_from,period_to,gross_sales,commission_total,ad_spend,other_fees,customer_deductions"),
]);
const s = buildSalesModel({ deliveries, pos, payouts });

const FROM = "2026-08-17", TO = "2026-09-13";          // the 28-day range
const PFROM = "2026-07-20", PTO = "2026-08-16";
const days = eachDay(FROM, TO);

const now = s.sumOver(FROM, TO);
console.log(`28d  gross ${now.gross.toFixed(2)}  orders ${now.orders}  aov ${(now.gross/now.orders).toFixed(2)}` +
            `  openDays ${now.openDays}/${days.length}  perDay ${(now.gross/now.openDays).toFixed(2)}`);

// ── lost orders ─────────────────────────────────────────────────────────────
const lost = { rejected: { count: 0, value: 0 }, cancelled: { count: 0, value: 0 } };
for (const d of deliveries) {
  const day = dayOf(d.order_placed);
  if (day < FROM || day > TO) continue;
  const st = (d.delivery_status || "").toLowerCase();
  if (st === "rejected" || st === "cancelled") { lost[st].count++; lost[st].value += +d.price || 0; }
}
const lostCount = lost.rejected.count + lost.cancelled.count;
const lostValue = lost.rejected.value + lost.cancelled.value;
console.log(`lost  rejected ${lost.rejected.count} (${lost.rejected.value.toFixed(2)})` +
            `  cancelled ${lost.cancelled.count} (${lost.cancelled.value.toFixed(2)})` +
            `  rate ${(lostCount/(now.orders+lostCount)*100).toFixed(2)}%`);

// every status the table actually uses
const statuses = {};
for (const d of deliveries) statuses[(d.delivery_status || "").toLowerCase()] = (statuses[(d.delivery_status||"").toLowerCase()]||0)+1;
console.log("delivery_status values:", JSON.stringify(statuses));

// ── platform table ──────────────────────────────────────────────────────────
console.log("\nplatform  revenue     orders   aov     fee%    net");
for (const id of SOURCE_IDS) {
  const revenue = days.reduce((a, d) => a + s.revOn(d, id), 0);
  const orders = days.reduce((a, d) => a + s.ordOn(d, id), 0);
  const fees = days.reduce((a, d) => a + s.platformFeeOn(d, id).fee, 0);
  if (revenue === 0) continue;
  console.log(" ", id.padEnd(8), revenue.toFixed(2).padStart(9), String(orders).padStart(7),
              (revenue/orders).toFixed(2).padStart(7),
              (id === "pos" ? "—" : (fees/revenue*100).toFixed(1)+"%").padStart(7),
              (revenue-fees).toFixed(2).padStart(9));
}

// ── heatmap ─────────────────────────────────────────────────────────────────
const heat = {};
const hourTotals = Array(24).fill(0);
const addHeat = (ts, price) => {
  const day = dayOf(ts);
  if (day < FROM || day > TO) return;
  const h = hourOf(ts);
  if (h == null) return;
  const dow = parseDay(day).getDay();
  heat[`${dow}-${h}`] = (heat[`${dow}-${h}`] || 0) + (+price || 0);
  hourTotals[h] += +price || 0;
};
for (const d of s.sold) addHeat(d.order_placed, d.price);
for (const p of pos) addHeat(p.order_placed, p.price);
const traded = hourTotals.map((v, h) => (v > 0 ? h : -1)).filter((h) => h >= 0);
let peak = null;
for (const k of Object.keys(heat)) if (!peak || heat[k] > peak.v) peak = { k, v: heat[k] };
const weeks = Math.max(1, days.length / 7);
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const [pd, ph] = peak.k.split("-").map(Number);
console.log(`\nheatmap axis ${traded[0]}:00 → ${traded[traded.length-1]}:00 ` +
            `(${traded.length} columns, ${24-traded.length} dead hours dropped)`);
console.log(`peak cell ${DOW[pd]} ${String(ph).padStart(2,"0")}:00 = ${(peak.v/weeks).toFixed(2)} avg per occurrence`);
const sundayTotal = Object.entries(heat).filter(([k]) => k.startsWith("0-")).reduce((a,[,v])=>a+v,0);
console.log("Sunday total in heatmap:", sundayTotal.toFixed(2));
