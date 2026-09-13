// Check findPayoutGaps against production. The SQL equivalent is in TASKS.md.
import { buildSalesModel, findPayoutGaps } from "../src/lib/salesModel.js";
import { dayOf } from "../src/lib/salesModel.js";

const URL = "https://nhtxpinnvuqpfwnatqre.supabase.co/rest/v1";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5odHhwaW5udnVxcGZ3bmF0cXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNTM1MDEsImV4cCI6MjA3OTkyOTUwMX0.214hDg97grdATQsnMMVtHHX--TH1O_1fee_4ou6spRk";

async function all(table, select, qs = "") {
  const out = [];
  for (let page = 0; ; page++) {
    const r = await fetch(`${URL}/${table}?select=${select}&${qs}&limit=1000&offset=${page * 1000}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!r.ok) throw new Error(`${table}: ${r.status}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const [payouts, deliveries] = await Promise.all([
  all("platform_payouts", "platform,period_from,period_to"),
  all("delivery_purchases", "order_placed,price,delivery_status,delivery_partner"),
]);

const sales = buildSalesModel({ deliveries, pos: [], payouts: [] });
const lastDay = deliveries.reduce((a, d) => {
  const day = dayOf(d.order_placed);
  return day > a ? day : a;
}, "0000-00-00");

const gaps = findPayoutGaps({
  statements: payouts.map((p) => ({ platform: p.platform, from: p.period_from, to: p.period_to })),
  sales,
  lastDay,
});

console.log(`${payouts.length} statements, ${deliveries.length} deliveries, last day ${lastDay}\n`);
console.log("platform  period                    span  orders     gross  kind");
for (const g of [...gaps].sort((a, b) => a.platform.localeCompare(b.platform) || a.from.localeCompare(b.from))) {
  console.log(
    g.platform.padEnd(9),
    `${g.from} → ${g.to}`.padEnd(25),
    String(g.days).padStart(4),
    String(g.orders).padStart(7),
    g.gross.toFixed(2).padStart(9),
    " " + g.kind
  );
}
const owed = gaps.reduce((a, g) => a + g.gross, 0);
console.log("\ntotal unsettled gross:", owed.toFixed(2));
