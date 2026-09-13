import { eachDay } from "./format";

/**
 * The revenue-and-fees model every sales-shaped screen needs.
 *
 * There is no per-order fee anywhere in the data: Wolt, Foody and Bolt bill by
 * statement, covering a span of days. So a statement's fees are spread across
 * its days in proportion to what each day actually sold, and a day no statement
 * covers yet is *estimated* from that platform's average rate rather than
 * counted as free. Screens draw the estimated part differently — that
 * distinction is the whole reason this is shared rather than recomputed.
 */

export const DELIVERY_IDS = ["wolt", "foody", "bolt"];
export const SOURCE_IDS = [...DELIVERY_IDS, "pos"];

/** Everything a platform takes off the top of one statement. */
export const feesOf = (payout) =>
  Number(payout.commission_total || 0) +
  Number(payout.ad_spend || 0) +
  Number(payout.other_fees || 0) +
  Number(payout.customer_deductions || 0);

/**
 * Both order tables store Cyprus wall-clock time — but only one of them says so.
 *
 * `pos_sales.order_placed` is a naive `timestamp`, which is honest.
 * `delivery_purchases.order_placed` and `reviews.review_date` are `timestamptz`
 * carrying a `+00` tag they have not earned: the importer wrote local time and
 * Postgres, running in UTC, stamped it as if it were UTC. Converting that tag
 * to Europe/Nicosia pushed every delivery order and review three hours late —
 * enough to roll a 21:46 Saturday order onto Sunday, a day the shop is shut,
 * and to move an evening's takings onto the next day's bar.
 *
 * Two proofs, both in TASKS.md: the hour histograms of the two tables have the
 * same 11:00–22:00 shape once the tag is ignored, and read that way Sundays
 * have zero orders.
 *
 * So we read the characters PostgREST sends and ignore anything after the
 * minutes. That is correct for a naive timestamp and for a mis-tagged one, and
 * it does not depend on the timezone of the machine looking at the page.
 */
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

const wallParts = (timestamp) => {
  if (!timestamp) return null;
  return WALL_CLOCK.exec(
    typeof timestamp === "string" ? timestamp : toWallString(timestamp)
  );
};

/** A Date can only have come from our own code, so read it in local time. */
const toWallString = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
};

/** The business day an order belongs to, in Cyprus. "2026-09-12" */
export const dayOf = (timestamp) => {
  const m = wallParts(timestamp);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** "21:46" */
export const timeOf = (timestamp) => {
  const m = wallParts(timestamp);
  return m ? `${m[4]}:${m[5]}` : "";
};

/** The hour of day an order was placed, in Cyprus. */
export const hourOf = (timestamp) => {
  const m = wallParts(timestamp);
  return m ? Number(m[4]) : null;
};

/** "12 SEP, 21:46" — for the freshness chip. */
export const stampLabel = (timestamp) => {
  const m = wallParts(timestamp);
  if (!m) return "";
  const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${Number(m[3])} ${MON[Number(m[2]) - 1]}, ${m[4]}:${m[5]}`;
};

/**
 * Days a platform sold on that no statement covers — money the shop earned and
 * has not been settled for.
 *
 * Islands are cut on coverage, not on sales, so a Sunday sitting inside a gap
 * does not split one missing statement into two. An island that starts after
 * the platform's newest statement is `awaiting` — the trailing edge, which
 * always exists because settlement lags. One with statements on both sides is
 * `missing`: the period was settled around it and the paperwork never arrived.
 *
 * @param statements  [{ platform, from, to }] — every statement, not just the
 *                    ones overlapping the header range
 * @param sales       a buildSalesModel result covering at least the gap days
 * @param lastDay     the newest day with orders; nothing after it can be late
 */
export function findPayoutGaps({ statements = [], sales, lastDay }) {
  const out = [];

  for (const id of DELIVERY_IDS) {
    const mine = statements
      .filter((s) => (s.platform || "").toLowerCase() === id && s.from && s.to)
      .sort((a, b) => a.from.localeCompare(b.from));
    if (mine.length === 0) continue;

    const covered = new Set();
    for (const s of mine) for (const day of eachDay(s.from, s.to)) covered.add(day);
    const lastTo = mine.reduce((a, s) => (s.to > a ? s.to : a), mine[0].to);
    if (mine[0].from > lastDay) continue;

    let island = null;
    const close = () => {
      if (island && island.orders > 0) out.push(island);
      island = null;
    };

    for (const day of eachDay(mine[0].from, lastDay)) {
      if (covered.has(day)) {
        close();
        continue;
      }
      island ??= {
        platform: id,
        from: day,
        to: day,
        days: 0,
        orders: 0,
        gross: 0,
        kind: day > lastTo ? "awaiting" : "missing",
      };
      island.to = day;
      island.days += 1;
      island.orders += sales.ordOn(day, id);
      island.gross += sales.revOn(day, id);
    }
    close();
  }

  return out.sort((a, b) => b.from.localeCompare(a.from));
}

export function buildSalesModel({ deliveries = [], pos = [], payouts = [] }) {
  // A delivery only counts as revenue once it reached someone.
  const sold = deliveries.filter(
    (d) => (d.delivery_status || "").toLowerCase() === "delivered"
  );

  const byDay = {};
  const touch = (day) =>
    (byDay[day] ??= {
      rev: { wolt: 0, foody: 0, bolt: 0, pos: 0 },
      ord: { wolt: 0, foody: 0, bolt: 0, pos: 0 },
    });

  for (const d of sold) {
    const day = dayOf(d.order_placed);
    const src = (d.delivery_partner || "").toLowerCase();
    if (!day || !SOURCE_IDS.includes(src)) continue;
    const b = touch(day);
    b.rev[src] += Number(d.price || 0);
    b.ord[src] += 1;
  }
  for (const p of pos) {
    const day = dayOf(p.order_placed);
    if (!day) continue;
    const b = touch(day);
    b.rev.pos += Number(p.price || 0);
    b.ord.pos += 1;
  }

  const revOn = (day, src) => byDay[day]?.rev[src] ?? 0;
  const ordOn = (day, src) => byDay[day]?.ord[src] ?? 0;
  const grossOn = (day, srcs = SOURCE_IDS) =>
    srcs.reduce((a, s) => a + revOn(day, s), 0);
  const ordersOn = (day, srcs = SOURCE_IDS) =>
    srcs.reduce((a, s) => a + ordOn(day, s), 0);

  // ── Fee rates, from every statement in the fetched window. A wider base is
  // steadier than the handful that happen to overlap a seven-day range.
  const statements = payouts.filter((p) => p.period_from && p.period_to);
  const totals = {};
  for (const p of statements) {
    const plat = (p.platform || "").toLowerCase();
    const t = (totals[plat] ??= { gross: 0, fees: 0 });
    t.gross += Number(p.gross_sales || 0);
    t.fees += feesOf(p);
  }
  const allGross = Object.values(totals).reduce((a, t) => a + t.gross, 0);
  const allFees = Object.values(totals).reduce((a, t) => a + t.fees, 0);
  const blendedRate = allGross > 0 ? allFees / allGross : 0;
  const rateOf = (plat) => {
    const t = totals[plat];
    return t && t.gross > 0 ? t.fees / t.gross : blendedRate;
  };

  const confirmedFeeOn = {};
  const coveredOn = {};
  for (const p of statements) {
    const plat = (p.platform || "").toLowerCase();
    const days = eachDay(p.period_from, p.period_to);
    const periodRev = days.reduce((a, day) => a + revOn(day, plat), 0);
    for (const day of days) (coveredOn[day] ??= new Set()).add(plat);
    if (periodRev <= 0) continue;
    const fees = feesOf(p);
    for (const day of days) {
      ((confirmedFeeOn[day] ??= {})[plat] ??= 0);
      confirmedFeeOn[day][plat] += fees * (revOn(day, plat) / periodRev);
    }
  }

  /** One platform's fee on one day. Fees can never exceed what it handled. */
  const platformFeeOn = (day, plat) => {
    const rev = revOn(day, plat);
    if (rev <= 0 || plat === "pos") return { fee: 0, estimated: false };
    if (coveredOn[day]?.has(plat)) {
      return { fee: Math.min(confirmedFeeOn[day]?.[plat] ?? 0, rev), estimated: false };
    }
    return { fee: Math.min(rev * rateOf(plat), rev), estimated: true };
  };

  const feeOn = (day, srcs = DELIVERY_IDS) => {
    let fee = 0;
    let estimated = false;
    for (const plat of srcs) {
      if (plat === "pos") continue;
      const f = platformFeeOn(day, plat);
      fee += f.fee;
      estimated = estimated || f.estimated;
    }
    return { fee, estimated };
  };

  /** Totals over a span, optionally narrowed to a subset of sources. */
  const sumOver = (from, to, srcs = SOURCE_IDS) => {
    const days = eachDay(from, to);
    const gross = days.reduce((a, day) => a + grossOn(day, srcs), 0);
    const fees = days.reduce((a, day) => a + feeOn(day, srcs).fee, 0);
    const orders = days.reduce((a, day) => a + ordersOn(day, srcs), 0);
    const openDays = days.filter((day) => ordersOn(day, srcs) > 0).length;
    return { gross, fees, net: gross - fees, orders, openDays, days };
  };

  return {
    sold,
    revOn,
    ordOn,
    grossOn,
    ordersOn,
    feeOn,
    platformFeeOn,
    rateOf,
    sumOver,
  };
}
