"use client";

import { useEffect, useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useRange } from "../../lib/RangeContext";
import DayDrawer from "../../components/DayDrawer";
import {
  Card,
  CardHeader,
  EmptyState,
  KpiCard,
  LoadingState,
  PageHeader,
  Segmented,
  PLATFORM,
} from "../../components/ui";
import {
  MONTHS,
  euro,
  euro2,
  eachDay,
  fetchAllRows,
  niceScale,
  num,
  parseDay,
  pctChange,
  rangeTitle,
  weatherLabel,
  dayCount,
  priorPhrase,
  signedPct,
  bucketDays,
  bucketLabel,
} from "../../lib/format";
import {
  SOURCE_IDS,
  buildSalesModel,
  dayOf,
  hourOf,
  stampLabel,
  LOST_COLOR,
  LOST_LABEL,
  LOST_STATUSES,
} from "../../lib/salesModel";

const INTERVALS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const DOW_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function SalesPage() {
  const range = useRange();
  const [interval, setInterval] = useState("daily");
  const [active, setActive] = useState({ wolt: true, foody: true, bolt: true, pos: true });
  // The fetched data is tagged with the range it belongs to, so "loading" is a
  // derived fact rather than a second piece of state flipped inside the effect.
  const rangeKey = `${range.from}|${range.to}`;
  const [store, setStore] = useState({ key: null, raw: null, failure: null });
  const loading = store.key !== rangeKey;
  const raw = loading ? null : store.raw;
  const failure = loading ? null : store.failure;
  const [hover, setHover] = useState(-1);
  const [heatHover, setHeatHover] = useState(null);
  const [openDay, setOpenDay] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const windowFrom = range.previous.from;
      const until = `${range.to}T23:59:59.999`;
      try {
        const [deliveries, pos, payouts, holidays, weather] = await Promise.all([
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
          fetchAllRows(supabase, "public_holidays", "day, name", [
            { op: "gte", col: "day", val: windowFrom },
            { op: "lte", col: "day", val: range.to },
          ]),
          fetchAllRows(supabase, "weather_daily", "day, code, temp_max, rain_mm", [
            { op: "gte", col: "day", val: range.from },
            { op: "lte", col: "day", val: range.to },
          ]),
        ]);
        if (cancelled) return;
        setStore({ key: rangeKey, raw: { deliveries, pos, payouts, holidays, weather }, failure: null });
      } catch (err) {
        if (cancelled) return;
        console.error("Sales fetch failed:", err);
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

  const on = useMemo(() => SOURCE_IDS.filter((id) => active[id]), [active]);

  const model = useMemo(() => {
    if (!raw) return null;
    const s = buildSalesModel(raw);
    const days = eachDay(range.from, range.to);
    const buckets = bucketDays(days, interval);

    // With every source switched off the page would read as a closed month
    // rather than an empty filter, so fall back to all of them for the maths
    // and let the chips show what is off.
    const srcs = on.length ? on : SOURCE_IDS;

    const openForSrcs = days.filter((day) => s.ordersOn(day, srcs) > 0);

    /*
     * Was it a bad night, or a bad sky?
     *
     * The answer this card gives is almost always "not the sky", and it has to
     * be, because that is what the data says. Across the whole year on record,
     * days with a millimetre of rain or more averaged €469 against €425 dry —
     * a tempting +10%, and the obvious story for a shop that takes 70% of its
     * money through delivery apps. It is the season. Compare wet days with dry
     * ones *inside the same month* and the gap collapses to €17 across 46 wet
     * days, with the sign flipping month to month: +19, −43, −49, +83, −40.
     *
     * Temperature looks stronger and is worse confounded: under 20°C averaged
     * €480 against €401 in the 30–35°C band, but the cold days are January and
     * February, when Betty's was taking €526 a day for reasons that have
     * nothing to do with a coat.
     *
     * So the card shows the split, states the confound, and refuses to draw a
     * conclusion from a handful of days. Its job is to stop a thin Tuesday
     * being blamed on the weather when the answer is somewhere else.
     */
    const wx = Object.fromEntries((raw.weather ?? []).map((w) => [w.day, w]));
    const openInRange = days.filter(s.openOn);
    const takeOn = (day) => s.grossOn(day);

    const band = (list) => {
      if (list.length === 0) return null;
      const total = list.reduce((a, day) => a + takeOn(day), 0);
      return { days: list.length, perDay: total / list.length };
    };
    const wet = band(openInRange.filter((d) => Number(wx[d]?.rain_mm ?? 0) >= 1));
    const dry = band(openInRange.filter((d) => Number(wx[d]?.rain_mm ?? 0) < 1 && wx[d]));

    const TEMP_BANDS = [
      { id: "cold", label: "Under 20°", test: (t) => t < 20 },
      { id: "mild", label: "20 – 25°", test: (t) => t >= 20 && t < 25 },
      { id: "warm", label: "25 – 30°", test: (t) => t >= 25 && t < 30 },
      { id: "hot", label: "30 – 35°", test: (t) => t >= 30 && t < 35 },
      { id: "scorching", label: "35° and up", test: (t) => t >= 35 },
    ];
    const temps = TEMP_BANDS.map((b) => ({
      ...b,
      ...(band(
        openInRange.filter((d) => wx[d]?.temp_max != null && b.test(Number(wx[d].temp_max)))
      ) ?? { days: 0, perDay: 0 }),
    })).filter((b) => b.days > 0);

    const weather = {
      wet,
      dry,
      temps,
      covered: openInRange.filter((d) => wx[d]).length,
      openDays: openInRange.length,
      // Four wet days cannot carry a claim. The card says so instead of drawing
      // a difference nobody should act on.
      thin: !wet || !dry || wet.days < 5 || dry.days < 5,
      max: Math.max(1, ...temps.map((b) => b.perDay), wet?.perDay ?? 0, dry?.perDay ?? 0),
    };

    const closures = days
      .filter((day) => !s.openOn(day) && s.holidayOn(day))
      .map((day) => ({
        name: s.holidayOn(day),
        on: `${parseDay(day).getDate()} ${MONTHS[parseDay(day).getMonth()]}`,
      }));

    const now = s.sumOver(range.from, range.to, srcs);
    const before = s.sumOver(range.previous.from, range.previous.to, srcs);

    const bars = buckets.map((b) => {
      const gross = b.days.reduce((a, day) => a + s.grossOn(day, srcs), 0);
      const fees = b.days.reduce((a, day) => a + s.feeOn(day, srcs).fee, 0);
      const segments = srcs
        .map((id) => ({
          id,
          color: PLATFORM[id].color,
          value: b.days.reduce((a, day) => a + s.revOn(day, id), 0),
        }))
        .filter((seg) => seg.value > 0);
      return {
        key: b.key,
        days: b.days,
        label: bucketLabel(b.key, interval),
        // Shut for every day in the bucket, on every source — a closed marker
        // rather than a bar of no height.
        closed: b.days.every((day) => !s.openOn(day)),
        closedFor: [...new Set(b.days.map(s.holidayOn).filter(Boolean))].join(" · "),
        total: segments.reduce((a, seg) => a + seg.value, 0),
        segments,
        gross,
        fees,
        net: gross - fees,
      };
    });
    const scale = niceScale(Math.max(...bars.map((b) => b.total), 1), 4);

    // Orders that did not reach a customer. The platforms never tell us *why* —
    // there is no reason field anywhere — so this counts what was lost rather
    // than pretending to explain it.
    //
    // Every non-delivered status gets a row, in the order it is worth reading,
    // so a status nobody expected shows up instead of disappearing. That is how
    // "failed" and "courier near pick up" went unnoticed for a year.
    const tally = (from, to) => {
      const byStatus = {};
      let notDelivered = 0;
      for (const d of raw.deliveries) {
        const day = dayOf(d.order_placed);
        if (day < from || day > to) continue;
        if (!srcs.includes((d.delivery_partner || "").toLowerCase())) continue;
        const status = (d.delivery_status || "").toLowerCase();
        if (!status || status === "delivered") continue;
        (byStatus[status] ??= { status, count: 0, value: 0 });
        byStatus[status].count += 1;
        byStatus[status].value += Number(d.price || 0);
        notDelivered += 1;
      }
      // Rejected, cancelled, failed — then anything still in flight, which is
      // not a loss and should not lead the list.
      const rank = (st) => {
        const i = LOST_STATUSES.indexOf(st);
        return i === -1 ? 99 : i;
      };
      const rows = Object.values(byStatus).sort(
        (a, b) => rank(a.status) - rank(b.status) || b.count - a.count
      );
      const terminal = rows.filter((r) => LOST_STATUSES.includes(r.status));
      return {
        rows,
        notDelivered,
        count: terminal.reduce((a, r) => a + r.count, 0),
        value: terminal.reduce((a, r) => a + r.value, 0),
      };
    };

    const lost = tally(range.from, range.to);
    const lostCount = lost.count;
    const lostValue = lost.value;
    // Anything still in flight belongs in the denominator but not the numerator:
    // it has not been lost, it just has not landed.
    const lostRate =
      now.orders + lost.notDelivered > 0
        ? (lostCount / (now.orders + lost.notDelivered)) * 100
        : 0;

    const prev = tally(range.previous.from, range.previous.to);
    const prevLostRate =
      before.orders + prev.notDelivered > 0
        ? (prev.count / (before.orders + prev.notDelivered)) * 100
        : 0;

    // Per-platform table.
    const platforms = srcs
      .map((id) => {
        const revenue = days.reduce((a, day) => a + s.revOn(day, id), 0);
        const orders = days.reduce((a, day) => a + s.ordOn(day, id), 0);
        const fees = days.reduce((a, day) => a + s.platformFeeOn(day, id).fee, 0);
        const prevRevenue = eachDay(range.previous.from, range.previous.to).reduce(
          (a, day) => a + s.revOn(day, id),
          0
        );
        return {
          id,
          name: PLATFORM[id].name,
          color: PLATFORM[id].color,
          revenue,
          orders,
          aov: orders > 0 ? revenue / orders : 0,
          fee: id === "pos" ? "—" : revenue > 0 ? `${((fees / revenue) * 100).toFixed(1)}%` : "—",
          net: revenue - fees,
          delta: pctChange(revenue, prevRevenue),
        };
      })
      .filter((p) => p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
    const platTotal = platforms.reduce((a, p) => a + p.revenue, 0) || 1;
    const platformRows = platforms.map((p) => ({ ...p, share: (p.revenue / platTotal) * 100 }));

    // Share label on each source chip, computed over every source so the
    // percentages still add up when some are switched off.
    const allTotal = days.reduce((a, day) => a + s.grossOn(day), 0) || 1;
    const chips = SOURCE_IDS.map((id) => ({
      id,
      name: PLATFORM[id].name === "In-store POS" ? "POS" : PLATFORM[id].name,
      color: PLATFORM[id].color,
      on: !!active[id],
      share: `${Math.round((days.reduce((a, day) => a + s.revOn(day, id), 0) / allTotal) * 100)}%`,
    }));

    // ── Hour-of-day heatmap.
    //
    // The hours shown are the ones the kitchen actually traded in, not a fixed
    // 10–23 window: a shop that opens at 08:00 or serves past midnight would
    // otherwise have its takings silently cropped off the chart.
    const heat = {};
    const hourTotals = Array(24).fill(0);
    const addHeat = (ts, price, src) => {
      const day = dayOf(ts);
      if (day < range.from || day > range.to) return;
      if (!srcs.includes(src)) return;
      const h = hourOf(ts);
      if (h == null) return;
      const dow = parseDay(day).getDay();
      heat[`${dow}-${h}`] = (heat[`${dow}-${h}`] || 0) + Number(price || 0);
      hourTotals[h] += Number(price || 0);
    };
    for (const d of s.sold) {
      addHeat(d.order_placed, d.price, (d.delivery_partner || "").toLowerCase());
    }
    for (const p of raw.pos) addHeat(p.order_placed, p.price, "pos");

    // The axis spans the hours the kitchen actually traded — a shop that opens
    // at 08:00 or closes at 23:00 keeps all of its columns, and the dead hours
    // of the night are not drawn as a row of empty cells.
    const traded = hourTotals.map((v, h) => (v > 0 ? h : -1)).filter((h) => h >= 0);
    const firstHour = traded.length ? traded[0] : 11;
    const lastHour = traded.length ? traded[traded.length - 1] : 22;
    const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
    const weeksInRange = Math.max(1, days.length / 7);
    const heatRows = DOW_ORDER.map((dow) => ({
      dow,
      label: DOW_LABEL[dow],
      cells: hours.map((h) => ({
        hour: h,
        // Averaged per occurrence of that weekday, so a 28-day range and a
        // 7-day one are read on the same scale.
        value: (heat[`${dow}-${h}`] || 0) / weeksInRange,
      })),
    }));
    const heatMax = Math.max(1, ...heatRows.flatMap((r) => r.cells.map((c) => c.value)));
    let peak = null;
    for (const row of heatRows) {
      for (const cell of row.cells) {
        if (!peak || cell.value > peak.value) peak = { ...cell, day: row.label };
      }
    }

    // When the order feed last caught up, measured against the end of the
    // period rather than the wall clock — a quiet-looking week and a stalled
    // import are indistinguishable without it.
    let lastOrderAt = null;
    let lastOrderDay = null;
    for (const row of [...raw.deliveries, ...raw.pos]) {
      if (!row.order_placed) continue;
      const day = dayOf(row.order_placed);
      if (!lastOrderDay || day > lastOrderDay) {
        lastOrderDay = day;
        lastOrderAt = row.order_placed;
      } else if (day === lastOrderDay && row.order_placed > lastOrderAt) {
        lastOrderAt = row.order_placed;
      }
    }
    const daysBehind = lastOrderDay
      ? Math.round((parseDay(range.to) - parseDay(lastOrderDay)) / 86400000)
      : null;

    return {
      bars,
      closures,
      weather,
      wx,
      scale,
      now,
      before,
      lastOrderAt,
      daysBehind,
      chips,
      platforms: platformRows,
      lost,
      lostCount,
      lostValue,
      lostRate,
      prevLostRate,
      hours,
      heatRows,
      heatMax,
      peak,
      weeksInRange,
      // Trading days only — see the note on Overview's sparklines. A zero for a
      // Sunday the shop was shut is noise on the gross line and a lie on the
      // average-order one. Measured against the chosen sources, so filtering to
      // a single platform that took nothing that day drops it too.
      dailyGross: openForSrcs.map((day) => s.grossOn(day, srcs)),
      dailyOrders: openForSrcs.map((day) => s.ordersOn(day, srcs)),
      dailyAov: openForSrcs.map((day) => s.grossOn(day, srcs) / s.ordersOn(day, srcs)),
      isEmpty: now.orders === 0,
    };
  }, [raw, range, interval, on, active]);

  if (failure) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Sales" sub={rangeTitle(range.from, range.to)} />
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
    return <LoadingState kpis={5} shape="chart" line="LOADING ORDERS · 4 SOURCES" />;
  }

  const header = (
    <PageHeader
      title="Sales"
      sub={`${rangeTitle(range.from, range.to)} · ${dayCount(range.days)} · compared with ${priorPhrase(range.days)}`}
      right={
        model?.lastOrderAt && (
          <div className="flex items-center gap-[7px] h-[26px] px-2.5 border border-line rounded-full font-mono text-[11px] text-subtle whitespace-nowrap">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background:
                  model.daysBehind > 2
                    ? "#ee0000"
                    : model.daysBehind > 0
                      ? "#f5a623"
                      : "#50e3c2",
              }}
            />
            SYNCED {stampLabel(model.lastOrderAt)}
          </div>
        )
      }
    />
  );

  if (model.isEmpty) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        {header}
        <EmptyState
          title={`No sales between ${rangeTitle(range.from, range.to)}`}
          body="No order reached any platform in this range. If that looks wrong, the import may not have caught up yet — the most recent orders can be older than the window you picked."
          action="Jump to the last 28 days"
          onAction={() => range.setRange("28d")}
        />
      </div>
    );
  }

  const aov = model.now.orders > 0 ? model.now.gross / model.now.orders : 0;
  const prevAov = model.before.orders > 0 ? model.before.gross / model.before.orders : 0;
  const labelEvery = Math.ceil(model.bars.length / (model.bars.length > 14 ? 7 : 8));
  const hovered = hover >= 0 ? model.bars[hover] : null;
  const openBar = model.bars.find((b) => b.key === openDay);

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}

      {/* Source filters + granularity */}
      <div className="flex flex-wrap items-center gap-2">
        {model.chips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => setActive((a) => ({ ...a, [chip.id]: !a[chip.id] }))}
            className={`flex items-center gap-[7px] h-8 px-[11px] rounded-lg border text-[13px] whitespace-nowrap ${
              chip.on
                ? "border-ink-strong bg-surface text-ink"
                : "border-line bg-wash-light text-subtle"
            }`}
          >
            <span
              className="w-2 h-2 rounded-[2px] shrink-0"
              style={{ background: chip.on ? chip.color : "#e5e5e5" }}
            />
            {chip.name}
            <span className={`font-mono text-[11px] ${chip.on ? "text-subtle" : "text-faint"}`}>
              {chip.share}
            </span>
          </button>
        ))}
        {/* Switching every source off falls back to all four, so that the page
            reads as an empty filter rather than a closed month. Silently, until
            now: greyed-out chips over a full chart is not a readable state. */}
        {on.length === 0 && (
          <span className="text-[12px] text-subtle text-pretty">
            No source selected — showing all four
          </span>
        )}
        <div className="flex-1 min-w-1" />
        <Segmented options={INTERVALS} value={interval} onChange={setInterval} />
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <KpiCard
          label="GROSS"
          value={euro(model.now.gross)}
          sub="before platform fees"
          delta={pctChange(model.now.gross, model.before.gross)}
          series={model.dailyGross}
        />
        <KpiCard
          label="ORDERS"
          value={num(model.now.orders)}
          sub={`across ${on.length || SOURCE_IDS.length} sources`}
          delta={pctChange(model.now.orders, model.before.orders)}
          series={model.dailyOrders}
        />
        <KpiCard
          label="AVG ORDER"
          value={euro2(aov)}
          sub={
            prevAov > 0
              ? `${euro2(Math.abs(aov - prevAov))} ${aov >= prevAov ? "more" : "less"} than last period`
              : "no comparable period before"
          }
          delta={pctChange(aov, prevAov)}
          series={model.dailyAov}
        />
        <KpiCard
          label="PER DAY"
          value={euro(model.now.gross / Math.max(1, model.now.openDays))}
          sub={`${model.now.openDays} open day${model.now.openDays === 1 ? "" : "s"} in ${range.days}`}
          delta={pctChange(
            model.now.gross / Math.max(1, model.now.openDays),
            model.before.gross / Math.max(1, model.before.openDays)
          )}
          series={model.dailyGross}
        />
        <KpiCard
          label="LOST"
          value={`${model.lostRate.toFixed(1)}%`}
          sub={`${euro(model.lostValue)} · ${model.lostCount} order${model.lostCount === 1 ? "" : "s"}`}
          delta={model.lostRate - model.prevLostRate}
          deltaLabel={`${Math.abs(model.lostRate - model.prevLostRate).toFixed(1)}pp`}
          positiveIsGood={false}
          series={model.dailyOrders}
        />
      </div>

      {/* Revenue by source */}
      <Card>
        <div className="border-b border-line">
          <CardHeader
            title="Revenue by source"
            sub={
              hovered
                ? `${hovered.label}${
                    hovered.days.length === 1 && model.wx[hovered.days[0]]
                      ? ` · ${weatherLabel(model.wx[hovered.days[0]])}`
                      : ""
                  } · ${hovered.segments
                    .map((seg) => `${PLATFORM[seg.id].name} ${euro(seg.value)}`)
                    .join("  ·  ")}  ·  total ${euro(hovered.total)}`
                : "Hover a bar for the breakdown · click a day to open its orders"
            }
            right={
              <div className="flex flex-wrap gap-3 text-[11px] text-muted">
                {(on.length ? on : SOURCE_IDS).map((id) => (
                  <span key={id} className="flex items-center gap-1.5">
                    <span
                      className="w-[9px] h-[9px] rounded-[2px]"
                      style={{ background: PLATFORM[id].color }}
                    />
                    {PLATFORM[id].name === "In-store POS" ? "POS" : PLATFORM[id].name}
                  </span>
                ))}
              </div>
            }
          />
        </div>

        <div className="px-4 pt-4 flex gap-2.5">
          <div className="w-[34px] md:w-10 shrink-0 flex flex-col justify-between h-[190px] md:h-[250px] text-right">
            {[4, 3, 2, 1, 0].map((k) => (
              <span key={k} className="font-mono text-[11px] text-muted leading-none">
                {euro(model.scale.step * k)}
              </span>
            ))}
          </div>
          <div className="flex-1 min-w-0 relative h-[190px] md:h-[250px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="absolute left-0 right-0 h-px bg-wash"
                style={{ top: `${i * 25}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end gap-0.5 md:gap-1">
              {model.bars.map((bar, i) => (
                <div
                  key={bar.key}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(-1)}
                  onClick={() => bar.days.length === 1 && setOpenDay(bar.key)}
                  className={`flex-1 min-w-0 h-full flex flex-col justify-end rounded ${
                    bar.days.length === 1 ? "cursor-pointer" : ""
                  } ${hover === i ? "bg-wash-light" : ""}`}
                >
                  {bar.closed && (
                    <div
                      title={bar.closedFor ? `Closed · ${bar.closedFor}` : "Closed"}
                      className="w-full h-[2px] rounded-full bg-line-strong"
                    />
                  )}
                  {bar.segments.map((seg, si) => (
                    <div
                      key={seg.id}
                      style={{
                        height: `${(seg.value / model.scale.max) * 100}%`,
                        background: seg.color,
                        borderRadius: si === 0 ? "3px 3px 0 0" : 0,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-2 flex gap-2.5">
          <div className="w-[34px] md:w-10 shrink-0" />
          <div className="flex-1 min-w-0 flex">
            {model.bars.map((bar, i) => (
              <div key={bar.key} className="flex-1 min-w-0 text-center">
                {i % labelEvery === 0 && (
                  <span
                    // A phone fits about half as many ticks before they collide,
                    // so the in-between ones are hidden rather than overlapped.
                    className={`font-mono text-[11px] text-muted whitespace-nowrap ${
                      i % (labelEvery * 2) === 0 ? "" : "hidden md:inline"
                    }`}
                  >
                    {interval === "daily"
                      ? `${parseDay(bar.key).getDate()} ${MONTHS[parseDay(bar.key).getMonth()].toLowerCase()}`
                      : bar.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
        {model.closures.length > 0 && (
          <div className="border-t border-line px-4 py-2.5 text-[12px] text-subtle text-pretty">
            Shut for {model.closures.map((c) => `${c.name} (${c.on})`).join(", ")}
          </div>
        )}
      </Card>

      {/* Platforms + what was lost */}
      <div className="grid gap-3 items-start md:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader title="Platforms" sub="Share of gross, and what each one keeps" />
          <div className="hidden md:grid px-4 pb-2 gap-2 font-mono text-[11px] tracking-[0.05em] text-muted grid-cols-[minmax(0,1.5fr)_88px_64px_70px_58px_64px]">
            <span>PLATFORM</span>
            <span className="text-right">GROSS</span>
            <span className="text-right">ORDERS</span>
            <span className="text-right">AVG</span>
            <span className="text-right">FEE</span>
            <span className="text-right">VS PREV</span>
          </div>
          {model.platforms.map((p) => (
            <div
              key={p.id}
              className="px-4 py-2.5 border-t border-line hover:bg-wash-light grid gap-2 items-center grid-cols-[minmax(0,1fr)_76px_58px] md:grid-cols-[minmax(0,1.5fr)_88px_64px_70px_58px_64px]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-[2px] shrink-0"
                    style={{ background: p.color }}
                  />
                  <span className="text-[13px] font-medium truncate">{p.name}</span>
                  <span className="font-mono text-[11px] text-subtle">
                    {Math.round(p.share)}%
                  </span>
                </div>
                <div className="mt-1.5 h-[3px] bg-wash rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${p.share}%`, background: p.color }} />
                </div>
              </div>
              <span className="font-mono text-[13px] tabular-nums text-right">
                {euro(p.revenue)}
              </span>
              <span className="font-mono text-[13px] tabular-nums text-right md:hidden">
                {signedPct(p.delta, 1)}
              </span>
              <span className="hidden md:block font-mono text-[13px] tabular-nums text-right">
                {num(p.orders)}
              </span>
              <span className="hidden md:block font-mono text-[13px] tabular-nums text-right">
                {euro2(p.aov)}
              </span>
              <span className="hidden md:block font-mono text-[13px] tabular-nums text-right text-muted">
                {p.fee}
              </span>
              <span
                className="hidden md:block font-mono text-[13px] tabular-nums text-right"
                style={{
                  color: p.delta >= 0 ? "var(--color-accent)" : "var(--color-danger)",
                }}
              >
                {signedPct(p.delta, 1)}
              </span>
            </div>
          ))}
        </Card>

        <Card>
          <CardHeader
            title="Not delivered"
            sub="Orders that never reached a customer"
          />
          {model.lost.rows.length === 0 ? (
            <p className="px-4 pb-4 text-[12px] text-muted border-t border-line pt-3">
              Every order in this range reached its customer.
            </p>
          ) : (
            <>
              {model.lost.rows.map((row) => (
                <div
                  key={row.status}
                  className="px-4 py-2.5 border-t border-line flex items-center gap-2.5"
                >
                  <span
                    className="w-2 h-2 rounded-[2px] shrink-0"
                    style={{ background: LOST_COLOR[row.status] ?? "var(--color-line-strong)" }}
                  />
                  <span className="text-[13px] flex-1 min-w-0 truncate">
                    {LOST_LABEL[row.status] ??
                      row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                  </span>
                  {!LOST_STATUSES.includes(row.status) && (
                    <span className="font-mono text-[10px] tracking-[0.06em] text-subtle shrink-0">
                      IN FLIGHT
                    </span>
                  )}
                  <span className="font-mono text-[12px] tabular-nums text-subtle">
                    {row.count}
                  </span>
                  <span className="font-mono text-[13px] tabular-nums w-[56px] text-right">
                    {euro(row.value)}
                  </span>
                </div>
              ))}
              <p className="px-4 py-3 border-t border-line text-[12px] text-subtle text-pretty">
                The platforms do not record a reason, so this is what was lost rather
                than why.
              </p>
            </>
          )}
        </Card>
      </div>

      {/* Hour heatmap */}
      <Card>
        <div className="border-b border-line">
          <CardHeader
            title="When the money comes in"
            sub={
              heatHover
                ? `${heatHover.day} ${String(heatHover.hour).padStart(2, "0")}:00 · ${euro(heatHover.value)} on an average ${heatHover.day}`
                : model.peak
                  ? `Average takings per hour · ${model.peak.day} ${String(model.peak.hour).padStart(2, "0")}:00 is the peak`
                  : "Average takings per hour"
            }
            right={
              <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.06em] text-subtle">
                <span>LOW</span>
                {[0.1, 0.3, 0.55, 0.8, 1].map((t) => (
                  <span
                    key={t}
                    className="w-4 h-2.5 rounded-[2px]"
                    style={{ background: `rgba(23,23,23,${(0.04 + 0.92 * t ** 0.85).toFixed(3)})` }}
                  />
                ))}
                <span>HIGH</span>
              </div>
            }
          />
        </div>
        <div className="p-4 overflow-x-auto">
          <div className="min-w-[560px]">
            <div
              className="grid gap-[3px] mb-[5px]"
              style={{ gridTemplateColumns: `34px repeat(${model.hours.length}, minmax(0,1fr))` }}
            >
              <span />
              {model.hours.map((h) => (
                <span key={h} className="font-mono text-[11px] text-muted text-center">
                  {h}
                </span>
              ))}
            </div>
            {model.heatRows.map((row) => (
              <div
                key={row.dow}
                className="grid gap-[3px] mb-[3px] items-center"
                style={{
                  gridTemplateColumns: `34px repeat(${model.hours.length}, minmax(0,1fr))`,
                }}
              >
                <span className="text-[11px] text-muted">{row.label}</span>
                {row.cells.map((cell) => (
                  <div
                    key={cell.hour}
                    onMouseEnter={() => setHeatHover({ ...cell, day: row.label })}
                    onMouseLeave={() => setHeatHover(null)}
                    className="h-5 md:h-[22px] rounded-[3px]"
                    style={{
                      background: `rgba(23,23,23,${(
                        0.04 +
                        0.92 * (cell.value / model.heatMax) ** 0.85
                      ).toFixed(3)})`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Was it a bad night, or a bad sky? */}
      {model.weather.covered > 0 && (
        <Card>
          <CardHeader
            title="Weather and takings"
            sub={`Gross per open day over the ${model.weather.covered} day${
              model.weather.covered === 1 ? "" : "s"
            } in this range with weather on record, for Limassol`}
          />

          <div className="grid gap-x-6 gap-y-3 px-4 py-3.5 md:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-[11px] tracking-[0.05em] text-muted">
                RAIN · WET IS 1MM OR MORE
              </span>
              {[
                { label: "Wet days", v: model.weather.wet },
                { label: "Dry days", v: model.weather.dry },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="text-[13px] flex-1 min-w-0 truncate">{r.label}</span>
                  <div className="w-[38%] shrink-0 h-1.5 rounded-full bg-wash overflow-hidden">
                    {r.v && (
                      <div
                        className="h-full rounded-full bg-ink-strong"
                        style={{ width: `${(r.v.perDay / model.weather.max) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="font-mono text-[12px] w-[92px] text-right shrink-0">
                    {r.v ? `${euro(r.v.perDay)} · ${r.v.days}d` : "none"}
                  </span>
                </div>
              ))}
              {model.weather.thin && (
                <p className="text-[12px] text-subtle text-pretty">
                  Not enough of one kind of day in this range to put next to the other.
                  Limassol is dry from June to September, so a summer range will almost
                  never have both.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="font-mono text-[11px] tracking-[0.05em] text-muted">
                HIGHEST TEMPERATURE
              </span>
              {model.weather.temps.length === 0 ? (
                <span className="text-[13px] text-subtle">Nothing on record.</span>
              ) : (
                model.weather.temps.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className="text-[13px] flex-1 min-w-0 truncate">{t.label}</span>
                    <div className="w-[38%] shrink-0 h-1.5 rounded-full bg-wash overflow-hidden">
                      <div
                        className="h-full rounded-full bg-ink-strong"
                        style={{ width: `${(t.perDay / model.weather.max) * 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-[12px] w-[92px] text-right shrink-0">
                      {euro(t.perDay)} · {t.days}d
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="px-4 py-2.5 border-t border-line text-[12px] text-muted text-pretty">
            Read this as a description of the days, not a cause of them. Over the whole
            year on record the weather looks like it matters and it is
            the season wearing its coat: wet days average €44 more than dry ones until
            you compare them <strong className="font-medium text-ink">inside the
            same month</strong>, where the gap falls to €17 across 46 wet days and
            changes sign from month to month. Temperature is worse — the cold days are
            January and February, which were simply better trading months. With one
            year on record the sky and the calendar cannot be told apart, so this card
            is here to rule the weather out, not to blame it.
          </div>
        </Card>
      )}

      {openBar && (
        <DayDrawer
          day={openDay}
          totals={openBar}
          weather={model.wx[openDay]}
          deliveries={raw.deliveries}
          pos={raw.pos}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  );
}
