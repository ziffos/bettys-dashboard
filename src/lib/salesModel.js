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

/** The business day an order belongs to, in Cyprus. */
export const dayOf = (timestamp) => {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Nicosia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
};

export const timeOf = (timestamp) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Nicosia",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));

/** The hour of day an order was placed, in Cyprus. */
export const hourOf = (timestamp) => {
  if (!timestamp) return null;
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Nicosia",
      hour: "2-digit",
      hour12: false,
    }).format(new Date(timestamp))
  );
};

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
