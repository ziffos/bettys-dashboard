"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { supabase } from "../lib/supabase";
import { isParked } from "../lib/features";
import { useRange } from "../lib/RangeContext";
import DayDrawer from "../components/DayDrawer";
import {
  Card,
  CardHeader,
  EmptyState,
  KpiCard,
  LoadingState,
  PageHeader,
  Segmented,
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
  priorPhrase,
  signedPct,
  bucketDays,
  bucketLabel,
} from "../lib/format";
import { SOURCE_IDS, buildSalesModel, dayOf } from "../lib/salesModel";
import { buildMenuMatcher } from "../lib/menuMatch";

const INTERVALS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

export default function OverviewPage() {
  const range = useRange();
  const [interval, setInterval] = useState("daily");
  // The fetched data is tagged with the range it belongs to, so "loading" is a
  // derived fact rather than a second piece of state flipped inside the effect.
  const rangeKey = `${range.from}|${range.to}`;
  const [store, setStore] = useState({ key: null, raw: null, failure: null });
  const loading = store.key !== rangeKey;
  const raw = loading ? null : store.raw;
  const failure = loading ? null : store.failure;
  const [openDay, setOpenDay] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const windowFrom = range.previous.from;
      const until = `${range.to}T23:59:59.999`;
      try {
        const [deliveries, pos, payouts, menuItems, social, reviews, holidays] = await Promise.all([
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
          fetchAllRows(supabase, "menu_items", "canonical_name, wolt_name, foody_name, bolt_name, pos_name", []),
          fetchAllRows(supabase, "social_stats", "stat_date, platform, total_reach", [
            { op: "gte", col: "stat_date", val: range.from },
            { op: "lte", col: "stat_date", val: range.to },
          ]),
          fetchAllRows(
            supabase,
            "reviews",
            "rating, review_text, source_platform, review_date",
            [
              { op: "gte", col: "review_date", val: range.from },
              { op: "lte", col: "review_date", val: until },
            ]
          ),
          fetchAllRows(supabase, "public_holidays", "day, name", [
            { op: "gte", col: "day", val: windowFrom },
            { op: "lte", col: "day", val: range.to },
          ]),
        ]);
        if (cancelled) return;
        setStore({
          key: rangeKey,
          raw: { deliveries, pos, payouts, menuItems, social, reviews, holidays },
          failure: null,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Overview fetch failed:", err);
        setStore({
          key: rangeKey,
          raw: null,
          failure: err.message || "Could not load this period.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rangeKey, range.from, range.to, range.previous.from]);

  const model = useMemo(() => {
    if (!raw) return null;
    const s = buildSalesModel(raw);

    const days = eachDay(range.from, range.to);
    const open = days.filter(s.openOn);
    const buckets = bucketDays(days, interval);

    const bars = buckets.map((b) => {
      const gross = b.days.reduce((a, day) => a + s.grossOn(day), 0);
      const fees = b.days.reduce((a, day) => a + s.feeOn(day).fee, 0);
      return {
        key: b.key,
        days: b.days,
        gross,
        fees,
        net: gross - fees,
        // Shut for every day in the bucket — a Sunday, or a holiday. Drawn as a
        // closed marker rather than as a bar of no height, which reads as a
        // terrible day rather than a day that never happened.
        closed: b.days.every((day) => !s.openOn(day)),
        // A closed day with a name on it stops being anonymous. Four of this
        // year's seven non-Sunday closures were public holidays.
        closedFor: [...new Set(b.days.map(s.holidayOn).filter(Boolean))].join(" · "),
        estimated: b.days.some((day) => s.feeOn(day).estimated),
        label: bucketLabel(b.key, interval),
        subLabel: `${parseDay(b.key).getDate()} ${MONTHS[parseDay(b.key).getMonth()]}`,
      };
    });

    // The named closures inside the range, for the line under the chart.
    const closures = days
      .filter((day) => !s.openOn(day) && s.holidayOn(day))
      .map((day) => ({
        name: s.holidayOn(day),
        on: `${parseDay(day).getDate()} ${MONTHS[parseDay(day).getMonth()]}`,
      }));

    const now = s.sumOver(range.from, range.to);
    const before = s.sumOver(range.previous.from, range.previous.to);

    const feeRate = now.gross > 0 ? (now.fees / now.gross) * 100 : 0;
    const prevFeeRate = before.gross > 0 ? (before.fees / before.gross) * 100 : 0;
    const aov = now.orders > 0 ? now.gross / now.orders : 0;
    const prevAov = before.orders > 0 ? before.gross / before.orders : 0;

    // The rate beside a channel is what it cost over this period — its share of
    // the prorated fees — so it always agrees with the headline above it.
    const channels = SOURCE_IDS.map((id) => {
      const revenue = days.reduce((a, day) => a + s.revOn(day, id), 0);
      const fees = days.reduce((a, day) => a + s.platformFeeOn(day, id).fee, 0);
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
    const channelRows = channels.map((c) => ({ ...c, share: (c.revenue / channelTotal) * 100 }));
    const dearest = channelRows
      .filter((c) => c.id !== "pos" && c.feeRate > 0)
      .sort((a, b) => b.feeRate - a.feeRate)[0];

    // Top dishes, against the same span before.
    //
    // Counted by canonical name rather than by whatever each platform typed.
    // The three of them genuinely disagree — Wolt writes "Betty's Classic",
    // Foody writes it with a backtick, the till shouts it in capitals — so
    // counting raw strings splits one dish into three and ranks fragments.
    // An unmatched line keeps its raw name rather than disappearing.
    const match = buildMenuMatcher(raw.menuItems);
    const countDishes = (from, to) => {
      const counts = {};
      const within = (ts) => {
        const day = dayOf(ts);
        return day >= from && day <= to;
      };
      const add = (platform, items) => {
        for (const { qty, name } of parseItems(items)) {
          const key = match(platform, name)?.canonical_name ?? name;
          counts[key] = (counts[key] || 0) + qty;
        }
      };
      for (const d of s.sold) {
        if (!within(d.order_placed)) continue;
        add((d.delivery_partner || "").toLowerCase(), d.items);
      }
      for (const p of raw.pos) {
        if (!within(p.order_placed)) continue;
        add("pos", p.items);
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

    const reviews = [...raw.reviews].sort(
      (a, b) => new Date(b.review_date) - new Date(a.review_date)
    );
    const avgRating = reviews.length
      ? reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length
      : 0;

    // Facebook, Instagram and their combined campaigns each arrive as their own
    // row; summing them is the period's total reach.
    const reachByDay = {};
    for (const r of raw.social) {
      if (!r.stat_date) continue;
      reachByDay[r.stat_date] = (reachByDay[r.stat_date] || 0) + Number(r.total_reach || 0);
    }
    const reachBars = buckets.map((b) => ({
      key: b.key,
      label: bucketLabel(b.key, interval),
      value: b.days.reduce((a, day) => a + (reachByDay[day] || 0), 0),
    }));
    const reachTotal = reachBars.reduce((a, b) => a + b.value, 0);
    const bestReach = reachBars.reduce((best, b) => (b.value > (best?.value ?? -1) ? b : best), null);

    return {
      bars,
      closures,
      now,
      before,
      feeRate,
      prevFeeRate,
      aov,
      prevAov,
      // Sparklines run over trading days only. A sparkline carries no dates and
      // no axis — it is a shape — so a zero for a Sunday the shop was shut is
      // noise that turns every line into a sawtooth. On the average-order and
      // fee-rate lines it is worse than noise: there is no average order on a
      // day with no orders, and plotting €0 says trade was terrible.
      dailyNet: open.map((day) => s.grossOn(day) - s.feeOn(day).fee),
      dailyOrders: open.map((day) => s.ordersOn(day)),
      dailyAov: open.map((day) => s.grossOn(day) / s.ordersOn(day)),
      dailyFeeRate: open.map((day) =>
        s.grossOn(day) > 0 ? (s.feeOn(day).fee / s.grossOn(day)) * 100 : 0
      ),
      channels: channelRows,
      dearest,
      topDishes,
      dishMax: topDishes[0]?.count || 1,
      reviews: reviews.slice(0, 3),
      reviewCount: reviews.length,
      avgRating,
      reachBars,
      reachTotal,
      reachMax: Math.max(1, ...reachBars.map((b) => b.value)),
      bestReach,
      isEmpty: now.orders === 0,
    };
  }, [raw, range.from, range.to, range.previous.from, range.previous.to, interval]);

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
    return <LoadingState kpis={4} shape="chart" line="LOADING ORDERS · 4 SOURCES" />;
  }

  const header = (
    <PageHeader
      title="Overview"
      sub={`${rangeTitle(range.from, range.to)} · compared with ${priorPhrase(range.days)}`}
      right={<Segmented options={INTERVALS} value={interval} onChange={setInterval} />}
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
  // Percentages of a responsive column, not pixels — that is what keeps the
  // bars inside the plot on a 390px screen.
  const pctOf = (v) => `${((v / barMax) * 100).toFixed(2)}%`;
  const openBar = model.bars.find((b) => b.key === openDay);

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}

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
          sub={
            model.dearest
              ? `${model.dearest.name} is the expensive one`
              : "no platform fees in this range"
          }
          delta={model.feeRate - model.prevFeeRate}
          deltaLabel={`${Math.abs(model.feeRate - model.prevFeeRate).toFixed(1)}pp`}
          positiveIsGood={false}
          series={model.dailyFeeRate}
        />
      </div>

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
            {/* Bars and labels are separate rows on purpose. With 28 days on a
                390px screen a column is ten pixels wide, and a label inside it
                both overflowed sideways over its neighbours and — because the
                row is bottom-aligned — lifted its own bar by the label's height,
                so the bars no longer shared a baseline. */}
            <div className="flex items-end gap-0.5 md:gap-1.5">
              {model.bars.map((bar) => {
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
                      {bar.closed && (
                        <div
                          title={bar.closedFor ? `Closed · ${bar.closedFor}` : "Closed"}
                          className="w-full h-[2px] rounded-full bg-line-strong"
                        />
                      )}
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
                          background: selected
                            ? "var(--color-accent)"
                            : "var(--color-ink-strong)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="flex gap-0.5 md:gap-1.5 mt-1"
              style={{ height: interval === "daily" ? 30 : 16 }}
            >
              {model.bars.map((bar, i) => {
                const selected = openDay === bar.key;
                const show = i % labelEvery === 0 || model.bars.length <= 8;
                return (
                  <div key={bar.key} className="flex-1 min-w-0 relative">
                    {show && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                        <div
                          className="text-[11px] font-medium leading-[14px]"
                          style={{ color: selected ? "var(--color-ink)" : "var(--color-muted)" }}
                        >
                          {bar.label}
                        </div>
                        {interval === "daily" && (
                          <div className="text-[11px] text-muted leading-[14px]">
                            {bar.subLabel}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-line px-4 py-2.5 flex flex-wrap gap-4 text-[12px] text-muted">
            <span>
              Gross{" "}
              <strong className="font-mono text-ink font-medium">{euro(model.now.gross)}</strong>
            </span>
            <span>
              Fees <strong className="font-mono text-ink font-medium">{euro(model.now.fees)}</strong>{" "}
              <span className="text-subtle">({model.feeRate.toFixed(1)}%)</span>
            </span>
            <span>
              Net <strong className="font-mono text-ink font-medium">{euro(model.now.net)}</strong>
            </span>
            {/* A tooltip nobody hovers is a fact nobody has. A zero on a bar is
                worth explaining where there is an explanation. */}
            {model.closures.length > 0 && (
              <span className="text-subtle">
                Shut for{" "}
                {model.closures.map((c) => `${c.name} (${c.on})`).join(", ")}
              </span>
            )}
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
            <p className="px-4 pb-4 pt-3 text-[12px] text-muted border-t border-line">
              Nobody left a rating in this range.
            </p>
          )}
          {model.reviews.map((r, i) => {
            const plat = PLATFORM[(r.source_platform || "").toLowerCase()];
            const d = new Date(r.review_date);
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
                    {r.review_date ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : ""}
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

        {/* Parked with Marketing — same table, same stalled import. */}
        {!isParked("marketing") && (
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
              {/* Same shape as the revenue chart above: bars in one row so they
                  share a baseline, labels in another so a long one cannot lift
                  its own bar or spill over its neighbours. */}
              <div className="flex items-end gap-1.5 h-20 mt-4">
                {model.reachBars.map((bar) => (
                  <div key={bar.key} className="flex-1 min-w-0 h-full flex flex-col justify-end">
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${((bar.value / model.reachMax) * 100).toFixed(2)}%`,
                        background:
                          bar.key === model.bestReach?.key ? "var(--color-accent)" : "#e5e5e5",
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mt-1.5 h-4">
                {model.reachBars.map((bar, i) => (
                  <div key={bar.key} className="flex-1 min-w-0 relative">
                    {(i % labelEvery === 0 || model.reachBars.length <= 8) && (
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[11px] text-muted whitespace-nowrap">
                        {bar.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {model.bestReach && (
                <p className="mt-3 text-[12px] text-muted text-pretty">
                  {model.bestReach.label} reached{" "}
                  <strong className="font-medium text-ink">
                    {kfmt(model.bestReach.value)}
                  </strong>{" "}
                  — the best in this range.
                </p>
              )}
            </>
          )}
        </Card>
        )}
      </div>

      {openBar && (
        <DayDrawer
          day={openDay}
          totals={openBar}
          deliveries={raw.deliveries}
          pos={raw.pos}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  );
}
