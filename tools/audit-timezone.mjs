// Verify the wall-clock fix against production: the model's per-day gross must
// equal what SQL computes from the same rows read naively.
import { buildSalesModel, dayOf, hourOf, timeOf } from "../src/lib/salesModel.js";

const URL = "https://nhtxpinnvuqpfwnatqre.supabase.co/rest/v1";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odHhwaW5udnVxcGZ3bmF0cXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNTM1MDEsImV4cCI6MjA3OTkyOTUwMX0.214hDg97grdATQsnMMVtHHX--TH1O_1fee_4ou6spRk";

async function get(table, select, qs) {
  const r = await fetch(`${URL}/${table}?select=${select}&${qs}&limit=10000`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

const FROM = "2026-09-01", TO = "2026-09-12";
const until = `${TO}T23:59:59.999`;

const [deliveries, pos] = await Promise.all([
  get("delivery_purchases", "order_placed,price,delivery_status,delivery_partner",
      `order_placed=gte.${FROM}&order_placed=lte.${until}`),
  get("pos_sales", "order_placed,price", `order_placed=gte.${FROM}&order_placed=lte.${until}`),
]);

console.log(`fetched ${deliveries.length} deliveries, ${pos.length} pos`);
console.log("raw delivery sample:", JSON.stringify(deliveries[0]));
console.log("raw pos sample:     ", JSON.stringify(pos[0]));

const m = buildSalesModel({ deliveries, pos, payouts: [] });
const days = [];
for (let d = new Date(FROM); d <= new Date(TO); d.setDate(d.getDate() + 1)) {
  days.push(d.toISOString().slice(0, 10));
}
console.log("\nday        gross    orders");
for (const day of days) {
  console.log(day, String(m.grossOn(day).toFixed(2)).padStart(9), String(m.ordersOn(day)).padStart(6));
}

// the order the owner saw as "Sunday 13 Sep 00:46"
const latest = deliveries.reduce((a, b) => (a.order_placed > b.order_placed ? a : b));
console.log("\nlatest delivery row:", latest.order_placed,
            "-> day", dayOf(latest.order_placed), "time", timeOf(latest.order_placed), "hour", hourOf(latest.order_placed));

const sundays = [...deliveries, ...pos].filter((r) => {
  const [y, mo, dd] = dayOf(r.order_placed).split("-").map(Number);
  return new Date(y, mo - 1, dd).getDay() === 0;
});
console.log("orders landing on a Sunday:", sundays.length);
