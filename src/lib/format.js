/** Formatting and small maths shared by every rebuilt screen. */

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const DOW_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const DOW_TITLE = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** €7,959 — whole euros, for totals. */
export const euro = (n) => "€" + Math.round(n || 0).toLocaleString("en-GB");

/** €20.11 — cents, for prices and averages. */
export const euro2 = (n) => "€" + (Number(n) || 0).toFixed(2);

/** 118.7k — compact, for reach and follower counts. */
export const kfmt = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) < 1000) return String(Math.round(v));
  return (v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1) + "k";
};

export const num = (n) => Math.round(Number(n) || 0).toLocaleString("en-GB");

/** Percentage change from `before` to `now`. Zero when there is no baseline. */
export const pctChange = (now, before) =>
  before > 0 ? ((now - before) / before) * 100 : 0;

/** "+12.4%" / "−9%" — a signed delta with a real minus sign. */
export const signedPct = (v, digits = 1) =>
  (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(digits) + "%";

/** A parsed calendar date, free of the browser's timezone. */
export const parseDay = (str) => {
  const [y, m, d] = String(str).split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const fmtDay = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

/** "5 Sep" */
export const shortDate = (str) => {
  const d = parseDay(str);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** "Sat 5 – Fri 11 Sep 2026" — the line under every page title. */
export function rangeTitle(from, to) {
  const a = parseDay(from);
  const b = parseDay(to);
  if (from === to) {
    return `${DOW_TITLE[a.getDay()].slice(0, 3)} ${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
  }
  const left = `${DOW_TITLE[a.getDay()].slice(0, 3)} ${a.getDate()}${
    a.getMonth() === b.getMonth() ? "" : " " + MONTHS[a.getMonth()]
  }`;
  return `${left} – ${DOW_TITLE[b.getDay()].slice(0, 3)} ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

/** Every calendar day from `from` to `to`, inclusive. */
export function eachDay(from, to) {
  const out = [];
  const end = parseDay(to);
  for (let d = parseDay(from); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(fmtDay(d));
  }
  return out;
}

/**
 * The polyline and filled area behind a KPI value.
 *
 * Two points is the floor — one value has no shape, and an empty series would
 * divide by zero on the x step.
 */
export function sparkPath(values, w = 120, h = 28) {
  const vals = values && values.length > 1 ? values : [0, 0];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals.map((v, i) => [
    (i / (vals.length - 1)) * w,
    h - ((v - min) / span) * (h - 4) - 2,
  ]);
  return {
    line: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "),
    area:
      `M0,${h} ` +
      pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ") +
      ` L${w},${h} Z`,
  };
}

/**
 * A y-axis that lands on round numbers: the smallest "nice" step that fits the
 * data in `steps` divisions.
 */
export function niceScale(maxValue, steps = 4) {
  const raw = Math.max(1, maxValue);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw / steps)));
  const step = Math.ceil(raw / steps / magnitude) * magnitude;
  return { step, max: step * steps };
}

/**
 * Pull item counts out of an order's `items` string.
 *
 * Orders store their lines as "2 Crispy Chicken Burger, 1 Loaded Fries". Unit
 * fragments like "330 ml" survive the split as their own token and have to be
 * dropped, or the top dishes list fills up with measurements.
 */
export function parseItems(itemsString) {
  if (!itemsString) return [];
  const out = [];
  for (const token of String(itemsString).split(",")) {
    const match = token.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const name = match[2].trim();
    if (/^(ml|g|kg|cl|l|oz|pcs)$/i.test(name)) continue;
    out.push({ qty: parseInt(match[1], 10), name });
  }
  return out;
}

/**
 * Paginate past PostgREST's 1000-row cap.
 *
 * Throws rather than returning what it managed to read. A page that fails
 * halfway through would otherwise render a month of revenue as if it were the
 * whole period, and look completely normal doing it.
 */
export async function fetchAllRows(supabase, table, select, filters = []) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  for (;;) {
    let query = supabase.from(table).select(select).range(from, from + PAGE - 1);
    for (const f of filters) query = query[f.op](f.col, f.val);
    const { data, error } = await query;
    if (error) {
      throw new Error(`${table}: ${error.message || "query failed"}`);
    }
    if (!data) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/**
 * Group a run of days into the buckets the Daily / Weekly / Monthly toggle asks
 * for. Weeks are counted back from the end of the range, so the most recent
 * week is always whole and any short week is the oldest one.
 */
export function bucketDays(days, interval) {
  if (interval === "daily") return days.map((day) => ({ key: day, days: [day] }));
  if (interval === "weekly") {
    const out = [];
    for (let i = days.length; i > 0; i -= 7) {
      const start = Math.max(0, i - 7);
      out.unshift({ key: days[start], days: days.slice(start, i) });
    }
    return out;
  }
  const byMonth = {};
  for (const day of days) (byMonth[day.slice(0, 7)] ??= []).push(day);
  return Object.entries(byMonth).map(([key, ds]) => ({ key: `${key}-01`, days: ds }));
}

export function bucketLabel(key, interval) {
  const d = parseDay(key);
  if (interval === "daily") return DOW_SHORT[d.getDay()];
  if (interval === "weekly") return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return MONTHS[d.getMonth()];
}
