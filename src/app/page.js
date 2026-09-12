"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useRange } from "../lib/RangeContext";
import {
  Card,
  CardHeader,
  EmptyState,
  KpiCard,
  LoadingState,
  PageHeader,
  Segmented,
  SidePanel,
  Stars,
  UpcomingCard,
  PLATFORM,
} from "../components/ui";
import {
  DOW_SHORT,
  MONTHS,
  euro,
  euro2,
  eachDay,
  fetchAllRows,
  kfmt,
  num,
  parseDay,
  parseItems,
  pctChange,
  rangeTitle,
  signedPct,
} from "../lib/format";

const DELIVERY_IDS = ["wolt", "foody", "bolt"];
const SOURCE_IDS = [...DELIVERY_IDS, "pos"];

const INTERVALS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

/** Everything a platform takes off the top, per statement. */
const feesOf = (payout) =>
  Number(payout.commission_total || 0) +
  Number(payout.ad_spend || 0) +
  Number(payout.other_fees || 0) +
  Number(payout.customer_deductions || 0);

/** The business day an order belongs to, in Cyprus. */
const dayOf = (timestamp) => {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Nicosia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
};

const timeOf = (timestamp) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Nicosia",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));

export default function OverviewPage() {
  const range = useRange();
  const [interval, setIntervalId] = useState("daily");
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState(null);
  const [openDay, setOpenDay] = useState(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailure(null);

    (async () => {
      const windowFrom = range.previous.from;
      const until = `${range.to}T23:59:59.999`;

      try {
      const [deliveries, pos, payouts, social, reviews] = await Promise.all([
        fetchAllRows(
          supabase,
          "delivery_purchases",
          "order_placed, price, delivery_status, delivery_partner, items",
          [
            { op: "gte", col: "order_placed", val: windowFrom },
            { op: "lte", col: "order_placed", val: until },
          ]
        ),
        fetchAllRows(supabase, "pos_sales", "order_placed, price, items", [
          { op: "gte", col: "order_placed", val: windowFrom },
          { op: "lte", col: "order_placed", val: until },
        ]),
        fetchAllRows(
          supabase,
          "platform_payouts",
          "platform, period_from, period_to, gross_sales, commission_total, ad_spend, other_fees, customer_deductions",
          [
            { op: "gte", col: "period_to", val: windowFrom },
            { op: "lte", col: "period_from", val: range.to },
          ]
        ),
        fetchAllRows(supabase, "social_stats", "stat_date, platform, total_reach", [
          { op: "gte", col: "stat_date", val: windowFrom },
          { op: "lte", col: "stat_date", val: range.to },
        ]),
        fetchAllRows(supabase, "reviews", "rating, review_text, source_platform, review_date", [
          { op: "gte", col: "review_date", val: range.from },
          { op: "lte", col: "review_date", val: until },
        ]),
      ]);

      if (cancelled) return;
      setRaw({ deliveries, pos, payouts, social, reviews });
      setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Overview fetch failed:", err);
        setFailure(err.message || "Could not load this period.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, range.previous.from]);

  // ── Derive ───────────────────────────────────────────────────────────────
  const model = useMemo(() => {
    if (!raw) return null;

    // A delivery only counts as revenue once it reached someone.
    const sold = raw.deliveries.filter(
      (d) => (d.delivery_status || "").toLowerCase() === "delivered"
    );

    /** Per-day, per-source revenue and order counts for the whole window. */
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
      const bucket = touch(day);
      bucket.rev[src] += Number(d.price || 0);
      bucket.ord[src] += 1;
    }
    for (const p of raw.pos) {
      const day = dayOf(p.order_placed);
      if (!day) continue;
      const bucket = touch(day);
      bucket.rev.pos += Number(p.price || 0);
      bucket.ord.pos += 1;
    }

    const revOn = (day, src) => byDay[day]?.rev[src] ?? 0;
    const grossOn = (day) => SOURCE_IDS.reduce((a, s) => a + revOn(day, s), 0);
    const ordersOn = (day) =>
      SOURCE_IDS.reduce((a, s) => a + (byDay[day]?.ord[s] ?? 0), 0);

    // ── Fees.
    //
    // There is no per-order fee anywhere: platforms bill by statement. So a
    // statement's fees are spread across its days in proportion to what we
    // actually sold on each of them, and a day no statement covers yet is
    // *estimated* from that platform's average rate rather than left at zero.
    const payouts = raw.payouts.filter((p) => p.period_from && p.period_to);

    /** Per-platform gross and fees across a set of statements. */
    const totalsFrom = (list) => {
      const out = {};
      for (const p of list) {
        const plat = (p.platform || "").toLowerCase();
        const t = (out[plat] ??= { gross: 0, fees: 0 });
        t.gross += Number(p.gross_sales || 0);
        t.fees += feesOf(p);
      }
      return out;
    };

    // Rates for estimating days no statement covers yet come from the whole
    // fetched window — a wider base is steadier than the handful of statements
    // that happen to overlap a seven-day range.
    const platformTotals = totalsFrom(payouts);
    const blendedRate = (() => {
      const g = Object.values(platformTotals).reduce((a, t) => a + t.gross, 0);
      const f = Object.values(platformTotals).reduce((a, t) => a + t.fees, 0);
      return g > 0 ? f / g : 0;
    })();
    const rateOf = (plat) => {
      const t = platformTotals[plat];
      return t && t.gross > 0 ? t.fees / t.gross : blendedRate;
    };

    /** What each statement costs us on one specific day, per platform. */
    const confirmedFeeOn = {};
    const coveredOn = {};
    for (const p of payouts) {
      const plat = (p.platform || "").toLowerCase();
      const days = eachDay(p.period_from, p.period_to);
      const periodRev = days.reduce((a, day) => a + revOn(day, plat), 0);
      for (const day of days) (coveredOn[day] ??= new Set()).add(plat);
      if (periodRev <= 0) continue;
      const fees = feesOf(p);
      for (const day of days) {
        const share = revOn(day, plat) / periodRev;
        ((confirmedFeeOn[day] ??= {})[plat] ??= 0);
        confirmedFeeOn[day][plat] += fees * share;
      }
    }

    /** A platform's fee on one day, confirmed if a statement covers it. */
    const platformFeeOn = (day, plat) => {
      const rev = revOn(day, plat);
      if (rev <= 0) return { fee: 0, estimated: false };
      if (coveredOn[day]?.has(plat)) {
        // Fees can never exceed what the platform actually handled.
        return { fee: Math.min(confirmedFeeOn[day]?.[plat] ?? 0, rev), estimated: false };
      }
      return { fee: Math.min(rev * rateOf(plat), rev), estimated: true };
    };

    const feeOn = (day) => {
      let fee = 0;
      let estimated = false;
      for (const plat of DELIVERY_IDS) {
        const f = platformFeeOn(day, plat);
        fee += f.fee;
        estimated = estimated || f.estimated;
      }
      return { fee, estimated };
    };

    // ── Buckets for the bar chart.
    const days = eachDay(range.from, range.to);
    let buckets;
    if (interval === "daily") {
      buckets = days.map((day) => ({ key: day, days: [day] }));
    } else if (interval === "weekly") {
      buckets = [];
      for (let i = days.length; i > 0; i -= 7) {
        buckets.unshift({ key: days[Math.max(0, i - 7)], days: days.slice(Math.max(0, i - 7), i) });
      }
    } else {
      const byMonth = {};
      for (const day of days) (byMonth[day.slice(0, 7)] ??= []).push(day);
      buckets = Object.entries(byMonth).map(([key, ds]) => ({ key: key + "-01", days: ds }));
    }

    const bars = buckets.map((b) => {
      const gross = b.days.reduce((a, day) => a + grossOn(day), 0);
      const fees = b.days.reduce((a, day) => a + feeOn(day).fee, 0);
      const estimated = b.days.some((day) => feeOn(day).estimated);
      const date = parseDay(b.key);
      return {
        key: b.key,
        days: b.days,
        gross,
        fees,
        net: gross - fees,
        orders: b.days.reduce((a, day) => a + ordersOn(day), 0),
        estimated,
        label:
          interval === "daily"
            ? DOW_SHORT[date.getDay()]
            : interval === "weekly"
              ? `${date.getDate()} ${MONTHS[date.getMonth()]}`
              : MONTHS[date.getMonth()],
        subLabel:
          interval === "daily"
            ? `${date.getDate()} ${MONTHS[date.getMonth()]}`
            : interval === "weekly"
              ? `wk`
              : String(date.getFullYear()),
      };
    });

    // ── Totals, this period and the one before.
    const sumOver = (from, to) => {
      const list = eachDay(from, to);
      const gross = list.reduce((a, day) => a + grossOn(day), 0);
      const fees = list.reduce((a, day) => a + feeOn(day).fee, 0);
      const orders = list.reduce((a, day) => a + ordersOn(day), 0);
      const openDays = list.filter((day) => ordersOn(day) > 0).length;
      return { gross, fees, net: gross - fees, orders, openDays };
    };
    const now = sumOver(range.from, range.to);
    const before = sumOver(range.previous.from, range.previous.to);

    const dailyNet = days.map((day) => grossOn(day) - feeOn(day).fee);
    const dailyOrders = days.map(ordersOn);
    const dailyAov = days.map((day, i) =>
      dailyOrders[i] > 0 ? grossOn(day) / dailyOrders[i] : 0
    );
    const dailyFeeRate = days.map((day) => {
      const g = grossOn(day);
      return g > 0 ? (feeOn(day).fee / g) * 100 : 0;
    });

    const feeRate = now.gross > 0 ? (now.fees / now.gross) * 100 : 0;
    const prevFeeRate = before.gross > 0 ? (before.fees / before.gross) * 100 : 0;
    const aov = now.orders > 0 ? now.gross / now.orders : 0;
    const prevAov = before.orders > 0 ? before.gross / before.orders : 0;

    // ── Channel mix.
    // The rate beside a channel is what it actually cost us over this period —
    // its share of the prorated fees — not a lifetime average. A period with no
    // statement yet still shows a number, marked estimated in the bars.
    const channels = SOURCE_IDS.map((id) => {
      const revenue = days.reduce((a, day) => a + revOn(day, id), 0);
      const fees =
        id === "pos" ? 0 : days.reduce((a, day) => a + platformFeeOn(day, id).fee, 0);
      const rate = revenue > 0 ? (fees / revenue) * 100 : null;
      return {
        id,
        name: PLATFORM[id].name,
        color: PLATFORM[id].color,
        revenue,
        fee: id === "pos" ? "0%" : rate == null ? "—" : `${rate.toFixed(1)}%`,
        feeRate: rate ?? 0,
      };
    })
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
    const channelTotal = channels.reduce((a, c) => a + c.revenue, 0) || 1;
    for (const c of channels) c.share = (c.revenue / channelTotal) * 100;

    const dearest = channels
      .filter((c) => c.id !== "pos" && c.feeRate > 0)
      .sort((a, b) => b.feeRate - a.feeRate)[0];

    // ── Top dishes, against the same span before.
    const countDishes = (from, to) => {
      const counts = {};
      const within = (ts) => {
        const day = dayOf(ts);
        return day >= from && day <= to;
      };
      for (const d of sold) {
        if (!within(d.order_placed)) continue;
        for (const { qty, name } of parseItems(d.items)) {
          counts[name] = (counts[name] || 0) + qty;
        }
      }
      for (const p of raw.pos) {
        if (!within(p.order_placed)) continue;
        for (const { qty, name } of parseItems(p.items)) {
          counts[name] = (counts[name] || 0) + qty;
        }
      }
      return counts;
    };
    const dishNow = countDishes(range.from, range.to);
    const dishBefore = countDishes(range.previous.from, range.previous.to);
    const topDishes = Object.entries(dishNow)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count], i) => ({
        rank: i + 1,
        name,
        count,
        delta: dishBefore[name] ? pctChange(count, dishBefore[name]) : null,
      }));
    const dishMax = topDishes[0]?.count || 1;

    // ── Reviews.
    const reviews = [...raw.reviews].sort(
      (a, b) => new Date(b.review_date) - new Date(a.review_date)
    );
    const avgRating = reviews.length
      ? reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length
      : 0;

    // ── Social reach. Instagram and Facebook are separate rows; combined
    // campaigns arrive as their own `facebook_instagram` platform and are
    // counted once here rather than split between the two.
    const reachByDay = {};
    for (const s of raw.social) {
      if (!s.stat_date) continue;
      reachByDay[s.stat_date] = (reachByDay[s.stat_date] || 0) + Number(s.total_reach || 0);
    }
    const reachBars = buckets.map((b) => ({
      key: b.key,
      label:
        interval === "daily"
          ? DOW_SHORT[parseDay(b.key).getDay()]
          : interval === "weekly"
            ? `${parseDay(b.key).getDate()} ${MONTHS[parseDay(b.key).getMonth()]}`
            : MONTHS[parseDay(b.key).getMonth()],
      value: b.days.reduce((a, day) => a + (reachByDay[day] || 0), 0),
    }));
    const reachTotal = reachBars.reduce((a, b) => a + b.value, 0);
    const reachMax = Math.max(1, ...reachBars.map((b) => b.value));
    const bestReach = reachBars.reduce(
      (best, b) => (b.value > (best?.value ?? -1) ? b : best),
      null
    );

    // ── Orders behind one day, for the drawer.
    const ordersFor = (day) => {
      const rows = [];
      for (const d of raw.deliveries) {
        if (dayOf(d.order_placed) !== day) continue;
        const src = (d.delivery_partner || "").toLowerCase();
        rows.push({
          time: timeOf(d.order_placed),
          items: d.items || "—",
          total: Number(d.price || 0),
          platform: PLATFORM[src]?.name ?? src,
          color: PLATFORM[src]?.color ?? "#8f8f8f",
          status:
            (d.delivery_status || "").toLowerCase() === "delivered"
              ? "Delivered"
              : (d.delivery_status || "").toLowerCase() === "rejected"
                ? "Rejected by kitchen"
                : "Cancelled",
        });
      }
      for (const p of raw.pos) {
        if (dayOf(p.order_placed) !== day) continue;
        rows.push({
          time: timeOf(p.order_placed),
          items: p.items || "—",
          total: Number(p.price || 0),
          platform: "In-store POS",
          color: PLATFORM.pos.color,
          status: "Collected",
        });
      }
      return rows.sort((a, b) => b.time.localeCompare(a.time));
    };

    return {
      bars,
      now,
      before,
      feeRate,
      prevFeeRate,
      aov,
      prevAov,
      dailyNet,
      dailyOrders,
      dailyAov,
      dailyFeeRate,
      channels,
      dearest,
      topDishes,
      dishMax,
      reviews: reviews.slice(0, 3),
      reviewCount: reviews.length,
      avgRating,
      reachBars,
      reachTotal,
      reachMax,
      bestReach,
      ordersFor,
      isEmpty: now.orders === 0,
    };
  }, [raw, range.from, range.to, range.previous.from, range.previous.to, interval]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (failure) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Overview" sub={rangeTitle(range.from, range.to)} />
        <EmptyState
          icon={TriangleAlert}
          title="Could not load this period"
          body={`${failure} The figures are left blank rather than shown half-read — a partial fetch looks exactly like a quiet week.`}
          action="Try again"
          onAction={() => range.setRange(range.id)}
        />
      </div>
    );
  }

  if (loading || !model) {
    return (
      <LoadingState
        kpis={4}
        shape="chart"
        line="LOADING ORDERS · 4 SOURCES"
        columns="repeat(auto-fit, minmax(180px, 1fr))"
      />
    );
  }

  const header = (
    <PageHeader
      title="Overview"
      sub={`${rangeTitle(range.from, range.to)} · compared with previous ${range.days} days`}
      right={<Segmented options={INTERVALS} value={interval} onChange={setIntervalId} />}
    />
  );

  if (model.isEmpty) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        {header}
        <EmptyState
          title={`No orders between ${rangeTitle(range.from, range.to)}`}
          body="Nothing is broken — there is simply nothing to show for this range. The most recent orders may also be older than the window you picked."
          action="Jump to the last 28 days"
          onAction={() => range.setRange("28d")}
        />
      </div>
    );
  }

  const barMax = Math.max(1, ...model.bars.map((b) => b.gross));
  const showBarValues = model.bars.length <= 8;
  const labelEvery = Math.ceil(model.bars.length / 8);
  // The column is sized in CSS so it can differ between phone and desktop; the
  // segments are percentages of it rather than pixels, which is what keeps the
  // bars inside the plot on a 390px screen.
  const pctOf = (v) => `${((v / barMax) * 100).toFixed(2)}%`;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KpiCard
          label="NET REVENUE"
          value={euro(model.now.net)}
          sub={`after ${euro(model.now.fees)} in platform fees`}
          delta={pctChange(model.now.net, model.before.net)}
          series={model.dailyNet}
        />
        <KpiCard
          label="ORDERS"
          value={num(model.now.orders)}
          sub={`⌀ ${Math.round(model.now.orders / Math.max(1, model.now.openDays))} per open day`}
          delta={pctChange(model.now.orders, model.before.orders)}
          series={model.dailyOrders}
        />
        <KpiCard
          label="AVERAGE ORDER"
          value={euro2(model.aov)}
          sub={
            model.prevAov > 0
              ? `${euro2(Math.abs(model.aov - model.prevAov))} ${
                  model.aov >= model.prevAov ? "higher" : "lower"
                } than last period`
              : "no comparable period before"
          }
          delta={pctChange(model.aov, model.prevAov)}
          series={model.dailyAov}
        />
        <KpiCard
          label="FEE RATE"
          value={`${model.feeRate.toFixed(1)}%`}
          sub={model.dearest ? `${model.dearest.name} is the expensive one` : "no platform fees in this range"}
          delta={model.feeRate - model.prevFeeRate}
          deltaLabel={`${Math.abs(model.feeRate - model.prevFeeRate).toFixed(1)}pp`}
          positiveIsGood={false}
          series={model.dailyFeeRate}
        />
      </div>

      {/* Revenue + the right rail */}
      <div className="grid gap-3 items-start md:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <Card>
          <div className="border-b border-line">
            <CardHeader
              title="Revenue after platform fees"
              sub="Select a bar to open that day's orders"
              right={
                <div className="flex flex-wrap gap-3 text-[11px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="w-[9px] h-[9px] rounded-[2px] bg-ink-strong" />
                    Net payout
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-[9px] h-[9px] rounded-[2px]"
                      style={{
                        background:
                          "repeating-linear-gradient(45deg,#d4d4d4 0 1px,#f2f2f2 1px 4px)",
                      }}
                    />
                    Fees (confirmed)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-[9px] h-[9px] rounded-[2px] bg-surface border border-dashed border-line-strong" />
                    Fees (estimated)
                  </span>
                </div>
              }
            />
          </div>

          <div className="px-4 pt-5 pb-3">
            <div className="flex items-end gap-0.5 md:gap-1.5">
              {model.bars.map((bar, i) => {
                const selected = openDay === bar.key;
                const clickable = bar.days.length === 1;
                return (
                  <div
                    key={bar.key}
                    onClick={() => clickable && setOpenDay(bar.key)}
                    className={`flex-1 min-w-0 flex flex-col items-center gap-2 rounded-lg py-1.5 px-0.5 ${
                      clickable ? "cursor-pointer hover:bg-wash-light" : ""
                    } ${selected ? "bg-wash-light" : ""}`}
                  >
                    {showBarValues && (
                      <span
                        className="text-[11px] font-medium whitespace-nowrap"
                        style={{ color: selected ? "var(--color-accent)" : "var(--color-ink)" }}
                      >
                        {euro(bar.gross)}
                      </span>
                    )}
                    <div className="w-full flex flex-col justify-end h-[104px] md:h-[154px]">
                      <div
                        className="rounded-t"
                        style={{
                          height: pctOf(bar.fees),
                          background: bar.estimated
                            ? "#fff"
                            : "repeating-linear-gradient(45deg,#d4d4d4 0 1px,#f2f2f2 1px 4px)",
                          border: bar.estimated ? "1px dashed #d4d4d4" : "0",
                        }}
                      />
                      <div
                        className="rounded-b"
                        style={{
                          height: pctOf(bar.net),
                          background: selected ? "var(--color-accent)" : "var(--color-ink-strong)",
                        }}
                      />
                    </div>
                    <div className="text-center min-w-0">
                      {(i % labelEvery === 0 || model.bars.length <= 8) && (
                        <>
                          <div
                            className="text-[11px] font-medium"
                            style={{ color: selected ? "var(--color-ink)" : "var(--color-muted)" }}
                          >
                            {bar.label}
                          </div>
                          {interval === "daily" && (
                            <div className="text-[11px] text-muted">{bar.subLabel}</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-line px-4 py-2.5 flex flex-wrap gap-4 text-[12px] text-muted">
            <span>
              Gross <strong className="font-mono text-ink font-medium">{euro(model.now.gross)}</strong>
            </span>
            <span>
              Fees <strong className="font-mono text-ink font-medium">{euro(model.now.fees)}</strong>{" "}
              <span className="text-subtle">({model.feeRate.toFixed(1)}%)</span>
            </span>
            <span>
              Net <strong className="font-mono text-ink font-medium">{euro(model.now.net)}</strong>
            </span>
          </div>
        </Card>

        <div className="flex flex-col gap-3 min-w-0">
          <UpcomingCard title="Needs attention">
            Fee jumps, unconfirmed payouts and items that sold out mid-service will be
            flagged here. The rules are still being worked out — likely read by a model
            rather than hand-written thresholds.
          </UpcomingCard>

          <Card className="px-4 py-3.5">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] mb-3">Channel mix</h2>
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-3.5">
              {model.channels.map((c) => (
                <div key={c.id} style={{ width: `${c.share}%`, background: c.color }} />
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              {model.channels.map((c) => (
                <div key={c.id} className="flex items-center gap-2.5">
                  <span
                    className="w-2 h-2 rounded-[2px] shrink-0"
                    style={{ background: c.color }}
                  />
                  <span className="text-[13px] flex-1 min-w-0 truncate">{c.name}</span>
                  <span className="font-mono text-[12px] text-subtle">{c.fee}</span>
                  <span className="font-mono text-[12px] tabular-nums w-[60px] text-right">
                    {euro(c.revenue)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Digest row */}
      <div className="grid gap-3 grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
        <Card>
          <div className="px-4 py-3.5 flex items-center justify-between">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Top dishes</h2>
            <Link href="/products" className="text-[12px] font-medium text-accent">
              All products
            </Link>
          </div>
          {model.topDishes.map((dish) => (
            <div
              key={dish.name}
              className="px-4 py-[9px] border-t border-line flex items-center gap-2.5 hover:bg-wash-light"
            >
              <span className="font-mono text-[11px] text-muted w-3.5">{dish.rank}</span>
              <span className="text-[13px] flex-1 min-w-0 truncate">{dish.name}</span>
              <div className="w-[70px] h-1 bg-wash rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-ink-strong"
                  style={{ width: `${(dish.count / model.dishMax) * 100}%` }}
                />
              </div>
              <span className="font-mono text-[12px] tabular-nums w-[34px] text-right">
                {dish.count}
              </span>
              <span
                className="font-mono text-[11px] w-[46px] text-right"
                style={{
                  color:
                    dish.delta == null
                      ? "var(--color-subtle)"
                      : dish.delta >= 0
                        ? "var(--color-accent)"
                        : "var(--color-danger)",
                }}
              >
                {dish.delta == null ? "new" : signedPct(dish.delta, 0)}
              </span>
            </div>
          ))}
        </Card>

        <Card>
          <div className="px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Reviews</h2>
              <span className="font-mono text-[12px] text-subtle truncate">
                {model.reviewCount
                  ? `${model.avgRating.toFixed(1)} · ${model.reviewCount} this period`
                  : "none this period"}
              </span>
            </div>
            <Link href="/reviews" className="text-[12px] font-medium text-accent shrink-0">
              All reviews
            </Link>
          </div>
          {model.reviews.length === 0 && (
            <p className="px-4 pb-4 text-[12px] text-muted border-t border-line pt-3">
              Nobody left a rating in this range.
            </p>
          )}
          {model.reviews.map((r, i) => {
            const plat = PLATFORM[(r.source_platform || "").toLowerCase()];
            return (
              <div key={i} className="px-4 py-[11px] border-t border-line">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Stars rating={r.rating || 0} />
                  <span
                    className="font-mono text-[10px] tracking-[0.04em] uppercase"
                    style={{ color: plat?.color ?? "#8f8f8f" }}
                  >
                    {plat?.name ?? r.source_platform}
                  </span>
                  <span className="text-[11px] text-muted">
                    {r.review_date ? shortDay(r.review_date) : ""}
                  </span>
                </div>
                <p
                  className="text-[12px] text-pretty"
                  style={{
                    color: r.review_text ? "var(--color-muted)" : "var(--color-faint)",
                    fontStyle: r.review_text ? "normal" : "italic",
                  }}
                >
                  {r.review_text || "No comment left"}
                </p>
              </div>
            );
          })}
        </Card>

        <Card className="px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Social reach</h2>
            <span className="font-mono text-[12px] text-subtle">{kfmt(model.reachTotal)}</span>
          </div>
          {model.reachTotal === 0 ? (
            <p className="mt-4 text-[12px] text-muted text-pretty">
              No reach recorded in this range. Social stats are imported separately and
              currently lag behind the order data.
            </p>
          ) : (
            <>
              <div className="flex items-end gap-1.5 h-24 mt-4">
                {model.reachBars.map((bar, i) => (
                  <div key={bar.key} className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${Math.round((bar.value / model.reachMax) * 78)}px`,
                        background:
                          bar.key === model.bestReach?.key ? "var(--color-accent)" : "#e5e5e5",
                      }}
                    />
                    {(i % labelEvery === 0 || model.reachBars.length <= 8) && (
                      <span className="text-[11px] text-muted truncate">{bar.label}</span>
                    )}
                  </div>
                ))}
              </div>
              {model.bestReach && (
                <p className="mt-3 text-[12px] text-muted text-pretty">
                  {model.bestReach.label} reached{" "}
                  <strong className="font-medium text-ink">{kfmt(model.bestReach.value)}</strong> —
                  the best in this range.
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      <DayDrawer
        day={openDay}
        model={model}
        onClose={() => setOpenDay(null)}
      />
    </div>
  );
}

const shortDay = (timestamp) => {
  const d = new Date(timestamp);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

function DayDrawer({ day, model, onClose }) {
  if (!day) return null;
  const bar = model.bars.find((b) => b.key === day);
  if (!bar) return null;
  const orders = model.ordersFor(day);
  const date = parseDay(day);

  return (
    <SidePanel
      open
      eyebrow="DAY DETAIL"
      title={`${date.toLocaleDateString("en-GB", { weekday: "long" })} ${date.getDate()} ${MONTHS[date.getMonth()]}`}
      onClose={onClose}
    >
      <div className="grid grid-cols-3 border-b border-line">
        {[
          ["GROSS", euro(bar.gross), "text-ink"],
          ["FEES", euro(bar.fees), "text-muted"],
          ["NET", euro(bar.net), "text-ink"],
        ].map(([label, value, tone], i) => (
          <div key={label} className={`px-4 py-3 ${i < 2 ? "border-r border-line" : ""}`}>
            <div className="font-mono text-[10px] tracking-[0.06em] text-subtle">{label}</div>
            <div className={`text-[18px] font-semibold tracking-[-0.02em] mt-[3px] ${tone}`}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 font-mono text-[10px] tracking-[0.06em] text-subtle border-b border-line">
        <span>{orders.length} ORDERS</span>
        <span>NEWEST FIRST</span>
      </div>

      {orders.length === 0 && (
        <p className="px-4 py-6 text-[13px] text-muted text-center">
          No orders logged for this day.
        </p>
      )}

      {orders.map((o, i) => (
        <div
          key={i}
          className="px-4 py-2.5 border-b border-wash flex items-center gap-2.5 hover:bg-wash-light"
        >
          <span className="font-mono text-[12px] text-subtle w-[38px] shrink-0">{o.time}</span>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: o.color }} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] truncate">{o.items}</div>
            <div className="text-[11px] text-subtle">
              {o.platform} · {o.status}
            </div>
          </div>
          <span className="font-mono text-[13px] tabular-nums shrink-0">{euro2(o.total)}</span>
        </div>
      ))}
    </SidePanel>
  );
}
