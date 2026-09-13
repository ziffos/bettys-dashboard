// Reconcile Reviews with production.
import { dayOf, timeOf } from "../src/lib/salesModel.js";

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

const [reviews, deliveries] = await Promise.all([
  all("reviews", "rating,review_text,review_date,source_platform,order_reference,reviewer_name"),
  all("delivery_purchases", "order_reference,items,delivery_partner,order_placed"),
]);

console.log(`${reviews.length} reviews, ${deliveries.length} orders`);

const plats = {};
for (const r of reviews) plats[(r.source_platform || "∅").toLowerCase()] = (plats[(r.source_platform||"∅").toLowerCase()]||0)+1;
console.log("source_platform:", JSON.stringify(plats));

const withText = reviews.filter((r) => (r.review_text || "").trim()).length;
const withName = reviews.filter((r) => (r.reviewer_name || "").trim()).length;
const withRef = reviews.filter((r) => r.order_reference).length;
const refs = new Set(deliveries.map((d) => d.order_reference));
const refHits = reviews.filter((r) => r.order_reference && refs.has(r.order_reference)).length;
console.log(`with review_text: ${withText}/${reviews.length}`);
console.log(`with reviewer_name: ${withName}/${reviews.length}`);
console.log(`with order_reference: ${withRef}/${reviews.length}, of which resolve to an order: ${refHits}`);

const ratings = {};
for (const r of reviews) ratings[r.rating] = (ratings[r.rating] || 0) + 1;
console.log("ratings:", JSON.stringify(ratings));
const avg = reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length;
console.log("all-time average:", avg.toFixed(3));

// the ranges the header offers
const TODAY = "2026-09-13";
const addDays = (iso, n) => { const [y,m,d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m-1, d+n)).toISOString().slice(0,10); };
for (const [id, from, to] of [
  ["today", TODAY, TODAY], ["7d", addDays(TODAY,-6), TODAY], ["28d", addDays(TODAY,-27), TODAY],
  ["mtd", "2026-09-01", TODAY], ["qtd", "2026-07-01", TODAY],
]) {
  const list = reviews.filter((r) => { const d = dayOf(r.review_date); return d >= from && d <= to; });
  const a = list.length ? list.reduce((x, r) => x + (r.rating || 0), 0) / list.length : 0;
  const byPlat = {};
  for (const r of list) byPlat[(r.source_platform||"").toLowerCase()] = (byPlat[(r.source_platform||"").toLowerCase()]||0)+1;
  console.log(`${id.padEnd(6)} ${from} → ${to}  n=${String(list.length).padStart(3)}  avg ${a.toFixed(2)}  ${JSON.stringify(byPlat)}`);
}

// does the review platform agree with the order's platform?
const byRef = new Map(deliveries.map((d) => [d.order_reference, d]));
let mismatched = 0, checked = 0;
for (const r of reviews) {
  const o = byRef.get(r.order_reference);
  if (!o) continue;
  checked++;
  if ((o.delivery_partner || "").toLowerCase() !== (r.source_platform || "").toLowerCase()) mismatched++;
}
console.log(`review platform vs order platform: ${mismatched} disagree of ${checked} checked`);

// review before the order it rates?
let early = 0;
for (const r of reviews) {
  const o = byRef.get(r.order_reference);
  if (!o) continue;
  if (dayOf(r.review_date) < dayOf(o.order_placed)) early++;
}
console.log(`reviews dated before the order they rate: ${early}`);
const newest = reviews.reduce((a, r) => (dayOf(r.review_date) > a ? dayOf(r.review_date) : a), "0000-00-00");
console.log("newest review:", newest, timeOf(reviews.find((r) => dayOf(r.review_date) === newest).review_date));
