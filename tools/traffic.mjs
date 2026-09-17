/**
 * Fill site_traffic from the Vercel Web Analytics API.
 *
 *   node tools/traffic.mjs                 # from the last day on record to today
 *   node tools/traffic.mjs 2026-08-20      # from a given day to today
 *   node tools/traffic.mjs 2026-08-20 2026-09-01
 *   node tools/traffic.mjs --probe         # one request, print the raw shape
 *
 * Why this exists rather than just reading Vercel's dashboard: the Hobby plan
 * reports **thirty days** and this dashboard compares periods on every screen.
 * Sync daily and after a month the window stops mattering, because the history
 * is ours. The same argument as tools/weather.mjs.
 *
 * The token is read from the environment and never reaches the browser: this
 * writes to Supabase, and the app reads Supabase with the anon key under RLS.
 * Every page in the app is a client component, so anything the app holds is
 * public.
 */
const PROJECT = "prj_Pqp1MTq2BTNGdsKDcoRLV9IxAP4H";
const TEAM = null; // personal account — no teamId or slug on the request
const REF = "nhtxpinnvuqpfwnatqre";
const TZ = "Europe/Nicosia";

/**
 * What to pull, and what to call it in the table.
 *
 * `by=day` alone gives the daily totals; `by=day,<dimension>` gives one row per
 * day per value. Two grouping dimensions is what the API allows, and two is all
 * we want — a third would multiply the rows without answering anything.
 */
const CUTS = [
  { dimension: "total", by: "day", key: null },
  { dimension: "referrer", by: "day,referrerHostname", key: "referrerHostname" },
  { dimension: "route", by: "day,route", key: "route" },
  { dimension: "country", by: "day,country", key: "country" },
  { dimension: "device", by: "day,deviceType", key: "deviceType" },
];

const todayThere = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(
      `${name} is not set. Add it to the env block in ~/.claude/settings.json and restart.`
    );
    process.exit(1);
  }
  return v;
};

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${need("SUPABASE_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function vercel(by, since, until) {
  const params = new URLSearchParams({ projectId: PROJECT, since, until, by, limit: "100" });
  if (TEAM) params.set("teamId", TEAM);
  const res = await fetch(
    `https://api.vercel.com/v1/query/web-analytics/visits/aggregate?${params}`,
    { headers: { Authorization: `Bearer ${need("VERCEL_TOKEN")}` } }
  );
  if (!res.ok) throw new Error(`Vercel ${res.status} on by=${by}: ${await res.text()}`);
  return res.json();
}

const args = process.argv.slice(2);

if (args[0] === "--probe") {
  const today = todayThere();
  const week = new Date(Date.parse(today) - 6 * 86400000).toISOString().slice(0, 10);
  for (const cut of CUTS) {
    const out = await vercel(cut.by, week, today);
    console.log(`\n── by=${cut.by}`);
    console.log(JSON.stringify(out.data?.slice(0, 3) ?? out, null, 2));
  }
  process.exit(0);
}

const to = args[1] || todayThere();
let from = args[0];
if (!from) {
  const [row] = await sql("select max(day)::text as day from site_traffic");
  // Re-fetch the last stored day: today is still being counted when we ask.
  from = row?.day || new Date(Date.parse(to) - 29 * 86400000).toISOString().slice(0, 10);
}
if (from > to) {
  console.log(`site_traffic is already current through ${to}.`);
  process.exit(0);
}

const esc = (v) => "'" + String(v).replace(/'/g, "''") + "'";
const rows = [];

for (const cut of CUTS) {
  const out = await vercel(cut.by, from, to);
  for (const r of out.data ?? []) {
    const day = String(r.timestamp ?? r.day ?? "").slice(0, 10);
    if (!day) continue;
    // Vercel returns the grouped value under the dimension's own name, and
    // sometimes under a generic key — take whichever is there rather than
    // guessing, and keep an empty string for the daily totals.
    const value =
      cut.key === null
        ? ""
        : String(r[cut.key] ?? r.value ?? r[cut.by.split(",")[1]] ?? "(none)");
    rows.push(
      `(${esc(day)}, ${esc(cut.dimension)}, ${esc(value)}, ` +
        `${Number(r.pageviews || 0)}, ${Number(r.visitors || 0)})`
    );
  }
}

if (rows.length === 0) {
  console.log(`Vercel returned nothing for ${from} … ${to}.`);
  process.exit(0);
}

await sql(
  "insert into site_traffic (day, dimension, value, pageviews, visitors) values\n" +
    rows.join(",\n") +
    `\non conflict (day, dimension, value) do update set
       pageviews = excluded.pageviews, visitors = excluded.visitors, fetched_at = now();`
);

const [sum] = await sql(`
  select count(*) rows, min(day)::text lo, max(day)::text hi,
         sum(visitors) filter (where dimension = 'total') visitors
  from site_traffic`);
console.log(
  `stored ${rows.length} row(s) for ${from} … ${to}; site_traffic now holds ` +
    `${sum.rows} rows over ${sum.lo} … ${sum.hi}, ${sum.visitors ?? 0} visitors.`
);
