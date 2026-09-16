/**
 * Fill weather_daily from the Open-Meteo archive.
 *
 *   node tools/weather.mjs                 # from the last day on record to today
 *   node tools/weather.mjs 2026-01-01      # from a given day to today
 *   node tools/weather.mjs 2026-01-01 2026-06-30
 *
 * Why the weather is in the database at all: Limassol had 55 days with at
 * least a millimetre of rain and 23 days at or above 35°C in the first 255 of
 * 2026, and a chicken shop that takes 70% of its money through delivery apps
 * is going to feel both. Sales can then answer whether a thin evening was the
 * kitchen or the sky.
 *
 * The archive is reanalysis, not forecast, and it reaches today — so this is
 * the only source used. The last day or two can still be revised; re-running
 * this overwrites them, which is the point of the upsert.
 *
 * No API key. Open-Meteo is free for non-commercial use and the only thing
 * sent is a pair of coordinates and a date range.
 */
const LAT = 34.707;
const LON = 33.022;
const TZ = "Europe/Nicosia";
const REF = "nhtxpinnvuqpfwnatqre";

/** Limassol's own today, not the server's. */
const todayThere = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

const [argFrom, argTo] = process.argv.slice(2);
const to = argTo || todayThere();

let from = argFrom;
if (!from) {
  const [row] = await sql("select max(day)::text as day from weather_daily");
  // Re-fetch the last stored day: the archive revises the most recent ones.
  from = row?.day || "2025-12-01";
}
if (from > to) {
  console.log(`weather_daily is already current through ${to}.`);
  process.exit(0);
}

const archive = (a, b) =>
  `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}` +
  `&start_date=${a}&end_date=${b}` +
  `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max` +
  `&timezone=${encodeURIComponent(TZ)}`;

/*
 * Nicosia is three hours ahead of UTC, so for part of every evening Limassol's
 * today is a day the archive does not have yet. Rather than guess the lag,
 * ask — Open-Meteo names its own last day in the 400 — and try again.
 */
async function fetchArchive(a, b) {
  let res = await fetch(archive(a, b));
  if (res.status === 400) {
    const reason = (await res.clone().json().catch(() => ({}))).reason || "";
    const last = reason.match(/to (\d{4}-\d{2}-\d{2})/)?.[1];
    if (!last) throw new Error(`Open-Meteo said 400: ${reason}`);
    if (a > last) {
      console.log(`The archive stops at ${last}; nothing to fetch.`);
      process.exit(0);
    }
    console.log(`The archive stops at ${last}, so asking for ${a} … ${last}.`);
    res = await fetch(archive(a, last));
  }
  if (!res.ok) throw new Error(`Open-Meteo said ${res.status}: ${await res.text()}`);
  return (await res.json()).daily;
}

const d = await fetchArchive(from, to);
const asked = { from: d.time[0], to: d.time[d.time.length - 1] };

const num = (v) => (v === null || v === undefined ? "null" : Number(v));
const rows = d.time
  .map((day, i) =>
    d.temperature_2m_max[i] === null
      ? null
      : `('${day}', ${num(d.weather_code[i])}, ${num(d.temperature_2m_max[i])}, ` +
        `${num(d.temperature_2m_min[i])}, ${num(d.precipitation_sum[i])}, ${num(d.wind_speed_10m_max[i])})`
  )
  .filter(Boolean);

if (rows.length === 0) {
  console.log(`Nothing to store for ${from} … ${to}.`);
  process.exit(0);
}

await sql(
  `insert into weather_daily (day, code, temp_max, temp_min, rain_mm, wind_kmh) values\n` +
    rows.join(",\n") +
    `\non conflict (day) do update set
       code = excluded.code, temp_max = excluded.temp_max, temp_min = excluded.temp_min,
       rain_mm = excluded.rain_mm, wind_kmh = excluded.wind_kmh, fetched_at = now();`
);

const [summary] = await sql(
  "select count(*) n, min(day)::text lo, max(day)::text hi from weather_daily"
);
console.log(
  `stored ${rows.length} day(s) for ${asked.from} … ${asked.to}; ` +
    `weather_daily now holds ${summary.n} days, ${summary.lo} … ${summary.hi}.`
);
