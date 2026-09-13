// Reconcile Platform Payouts with production: statement totals against our own
// order log, and the drift flag against every statement there is.
import { buildSalesModel, feesOf } from "../src/lib/salesModel.js";
import { eachDay } from "../src/lib/format.js";

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
const median = (v) => { if (!v.length) return null; const s=[...v].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };

const [payouts, deliveries] = await Promise.all([
  all("platform_payouts", "platform,period_from,period_to,gross_sales,commission_total,ad_spend,other_fees,customer_deductions,net_payout,invoice_number"),
  all("delivery_purchases", "order_placed,price,delivery_status,delivery_partner"),
]);
const s = buildSalesModel({ deliveries, pos: [], payouts: [] });

const rows = payouts.filter((p) => Number(p.gross_sales) > 0).map((p) => {
  const platform = p.platform.toLowerCase();
  const ours = eachDay(p.period_from, p.period_to).reduce((a, d) => a + s.revOn(d, platform), 0);
  return { ...p, platform, ours, reported: Number(p.gross_sales), ratio: ours > 0 ? Number(p.gross_sales) / ours : null, fees: feesOf(p) };
});

const baseline = {};
for (const id of ["wolt", "foody", "bolt"]) {
  baseline[id] = median(rows.filter((r) => r.platform === id && r.ratio != null).map((r) => r.ratio));
}
console.log("baseline ratio (reported / our log), median over all statements:");
for (const id of Object.keys(baseline)) console.log(`  ${id.padEnd(6)} ${baseline[id].toFixed(4)}`);

const withDrift = rows.map((r) => ({ ...r, drift: r.ratio != null ? r.ratio / baseline[r.platform] - 1 : null }));
for (const tol of [0.02, 0.10, 0.15, 0.20]) {
  const n = withDrift.filter((r) => r.drift != null && Math.abs(r.drift) > tol).length;
  console.log(`drift > ${(tol*100).toFixed(0)}%: ${n} of ${withDrift.length} statements`);
}
console.log("\nflagged at 15%:");
for (const r of withDrift.filter((r) => r.drift != null && Math.abs(r.drift) > 0.15).sort((a,b)=>Math.abs(b.drift)-Math.abs(a.drift))) {
  console.log(`  ${r.platform.padEnd(6)} ${r.period_from} → ${r.period_to}  reported ${r.reported.toFixed(2).padStart(9)}  ours ${r.ours.toFixed(2).padStart(9)}  drift ${(r.drift*100).toFixed(1).padStart(7)}%  ${r.invoice_number ?? ""}`);
}

// net_payout vs gross minus the four fee lines
let exact = 0, off = 0, worst = null;
for (const r of rows) {
  if (r.net_payout == null) continue;
  const computed = r.reported - r.fees;
  const d = Math.abs(Number(r.net_payout) - computed);
  if (d < 0.005) exact++; else { off++; if (!worst || d > worst.d) worst = { d, r, computed }; }
}
console.log(`\nnet_payout equals gross minus the four fee lines on ${exact} statements, differs on ${off}`);
if (worst) console.log(`  worst: ${worst.r.platform} ${worst.r.period_from} — stated ${Number(worst.r.net_payout).toFixed(2)}, computed ${worst.computed.toFixed(2)}, off by ${worst.d.toFixed(2)}`);
