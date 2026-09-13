"use client";

import { useEffect, useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useRange } from "../../lib/RangeContext";
import {
  Card,
  CardHeader,
  EmptyState,
  KpiCard,
  LoadingState,
  PageHeader,
  Segmented,
} from "../../components/ui";
import {
  MONTHS,
  euro,
  euro2,
  eachDay,
  fetchAllRows,
  kfmt,
  niceScale,
  parseDay,
  pctChange,
  rangeTitle,
  signedPct,
  bucketDays,
  bucketLabel,
} from "../../lib/format";
import { buildSalesModel, dayOf } from "../../lib/salesModel";

const INTERVALS = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

const PLATFORMS = [
  { id: "all", label: "Both" },
  { id: "facebook", label: "Facebook" },
  { id: "instagram", label: "Instagram" },
];

const FB = "#0070f3";
const IG = "#7928ca";

/** Seven-day trailing average, to take the weekday sawtooth out of a trend. */
function rolling(values, window = 7) {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** Pearson's r between two equal-length series. */
function correlation(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let cov = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    sx += (xs[i] - mx) ** 2;
    sy += (ys[i] - my) ** 2;
  }
  return sx && sy ? cov / Math.sqrt(sx * sy) : 0;
}

const polyline = (values, w, h, min, max) => {
  const span = max - min || 1;
  return values
    .map(
      (v, i) =>
        `${((i / Math.max(1, values.length - 1)) * w).toFixed(1)},${(
          h -
          ((v - min) / span) * h
        ).toFixed(1)}`
    )
    .join(" ");
};

export default function MarketingPage() {
  const range = useRange();
  const [interval, setInterval] = useState("daily");
  const [platform, setPlatform] = useState("all");
  const rangeKey = `${range.from}|${range.to}`;
  const [store, setStore] = useState({ key: null, raw: null, failure: null });
  const loading = store.key !== rangeKey;
  const raw = loading ? null : store.raw;
  const failure = loading ? null : store.failure;
  const [hover, setHover] = useState(-1);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const windowFrom = range.previous.from;
      const until = `${range.to}T23:59:59.999`;
      try {
        const [social, deliveries, pos] = await Promise.all([
          fetchAllRows(
            supabase,
            "social_stats",
            "stat_date, platform, total_reach, ad_spend, follower_count",
            [
              { op: "gte", col: "stat_date", val: windowFrom },
              { op: "lte", col: "stat_date", val: range.to },
            ]
          ),
          fetchAllRows(
            supabase,
            "delivery_purchases",
            "order_placed, price, delivery_status, delivery_partner",
            [
              { op: "gte", col: "order_placed", val: windowFrom },
              { op: "lte", col: "order_placed", val: until },
            ]
          ),
          fetchAllRows(supabase, "pos_sales", "order_placed, price", [
            { op: "gte", col: "order_placed", val: windowFrom },
            { op: "lte", col: "order_placed", val: until },
          ]),
        ]);
        if (cancelled) return;
        setStore({ key: rangeKey, raw: { social, deliveries, pos }, failure: null });
      } catch (err) {
        if (cancelled) return;
        console.error("Marketing fetch failed:", err);
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

    // Campaigns that ran across both networks arrive as a single
    // `facebook_instagram` row. They cannot be attributed to either one, so
    // they count under "Both" and are left out when a single network is picked
    // — the alternative is inventing a split that was never measured.
    const rowsFor = (net) =>
      raw.social.filter((r) => {
        const p = (r.platform || "").toLowerCase();
        return net === "all" ? true : p === net;
      });
    const rows = rowsFor(platform);
    const combinedRows = raw.social.filter(
      (r) => (r.platform || "").toLowerCase() === "facebook_instagram"
    );

    const sumOn = (list, day, field) =>
      list
        .filter((r) => r.stat_date === day)
        .reduce((a, r) => a + Number(r[field] || 0), 0);

    const days = eachDay(range.from, range.to);
    const prevDays = eachDay(range.previous.from, range.previous.to);
    const buckets = bucketDays(days, interval);

    const reachOn = (day) => sumOn(rows, day, "total_reach");
    const spendOn = (day) => sumOn(rows, day, "ad_spend");

    const reach = days.reduce((a, day) => a + reachOn(day), 0);
    const spend = days.reduce((a, day) => a + spendOn(day), 0);
    const prevReach = prevDays.reduce((a, day) => a + reachOn(day), 0);
    const prevSpend = prevDays.reduce((a, day) => a + spendOn(day), 0);

    const cpm = reach > 0 ? (spend / reach) * 1000 : 0;
    const prevCpm = prevReach > 0 ? (prevSpend / prevReach) * 1000 : 0;

    // Followers: the latest count on record for each network, and how much it
    // moved. Combined-campaign rows carry no follower count at all.
    const latestFollowers = (net, upto) => {
      const list = raw.social
        .filter((r) => (r.platform || "").toLowerCase() === net && r.stat_date <= upto)
        .filter((r) => r.follower_count != null)
        .sort((a, b) => a.stat_date.localeCompare(b.stat_date));
      return list.length ? Number(list[list.length - 1].follower_count) : 0;
    };
    const nets = platform === "all" ? ["facebook", "instagram"] : [platform];
    const followersNow = nets.reduce((a, n) => a + latestFollowers(n, range.to), 0);
    const followersStart = nets.reduce(
      (a, n) => a + latestFollowers(n, range.previous.to),
      0
    );
    const followersBefore = nets.reduce(
      (a, n) => a + latestFollowers(n, range.previous.from),
      0
    );
    const netNew = followersNow - followersStart;
    const prevNetNew = followersStart - followersBefore;

    // ── Does reach drive sales?
    //
    // Both series are indexed to 100 at the start of the period and share one
    // axis. The design put them on two axes with the reach area filled, which
    // buried the revenue line and made the card's own question unanswerable by
    // eye. Hovering still reads out the real numbers.
    const s = buildSalesModel({ deliveries: raw.deliveries, pos: raw.pos, payouts: [] });
    const revenueOn = (day) => s.grossOn(day);

    const reachRoll = rolling(days.map(reachOn));
    const revRoll = rolling(days.map(revenueOn));
    const baseReach = reachRoll.find((v) => v > 0) || 1;
    const baseRev = revRoll.find((v) => v > 0) || 1;
    const reachIndex = reachRoll.map((v) => (v / baseReach) * 100);
    const revIndex = revRoll.map((v) => (v / baseRev) * 100);

    const allIndexed = [...reachIndex, ...revIndex];
    const idxMin = Math.min(60, Math.floor(Math.min(...allIndexed) / 10) * 10);
    const idxMax = Math.max(140, Math.ceil(Math.max(...allIndexed) / 10) * 10);

    const r = correlation(days.map(reachOn), days.map(revenueOn));

    // ── Reach by platform, bucketed.
    const reachBars = buckets.map((b) => {
      const seg = (net) =>
        b.days.reduce(
          (a, day) =>
            a +
            raw.social
              .filter(
                (x) => x.stat_date === day && (x.platform || "").toLowerCase() === net
              )
              .reduce((t, x) => t + Number(x.total_reach || 0), 0),
          0
        );
      const segments = [];
      if (platform !== "facebook") segments.push({ id: "instagram", color: IG, value: seg("instagram") });
      if (platform !== "instagram") segments.push({ id: "facebook", color: FB, value: seg("facebook") });
      if (platform === "all") {
        segments.push({ id: "both", color: "#b3b3b3", value: seg("facebook_instagram") });
      }
      return {
        key: b.key,
        label: bucketLabel(b.key, interval),
        segments: segments.filter((x) => x.value > 0),
        total: segments.reduce((a, x) => a + x.value, 0),
      };
    });
    const reachScale = niceScale(Math.max(...reachBars.map((b) => b.total), 1), 3);

    // ── Follower growth since the start of the period.
    const growthSeries = (net) => {
      const start = latestFollowers(net, range.previous.to);
      return days.map((day) => {
        const upto = latestFollowers(net, day);
        return upto > 0 ? upto - start : 0;
      });
    };
    const igGrowth = growthSeries("instagram");
    const fbGrowth = growthSeries("facebook");
    // The domain has to cover losses too. Anchoring it at zero pushed a network
    // that shed followers below the plot, where it drew straight through the
    // legend underneath.
    const growthLo = Math.min(0, ...igGrowth, ...fbGrowth) * 1.1;
    const growthHi = Math.max(1, ...igGrowth, ...fbGrowth) * 1.1;

    // ── Biggest reach days.
    const avgRevenue =
      days.reduce((a, day) => a + revenueOn(day), 0) / Math.max(1, days.length);
    const bestDays = days
      .map((day) => {
        const dayReach = reachOn(day);
        const daySpend = spendOn(day);
        const igReach = raw.social
          .filter((x) => x.stat_date === day && (x.platform || "").toLowerCase() === "instagram")
          .reduce((t, x) => t + Number(x.total_reach || 0), 0);
        return {
          day,
          reach: dayReach,
          spend: daySpend,
          cpm: dayReach > 0 ? (daySpend / dayReach) * 1000 : 0,
          revenue: revenueOn(day),
          lift: avgRevenue > 0 ? pctChange(revenueOn(day), avgRevenue) : 0,
          igShare: dayReach > 0 ? Math.round((igReach / dayReach) * 100) : 0,
        };
      })
      .filter((d) => d.reach > 0)
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 5);

    let lastStatDate = null;
    for (const row of raw.social) {
      if (row.stat_date && (!lastStatDate || row.stat_date > lastStatDate)) {
        lastStatDate = row.stat_date;
      }
    }
    const daysBehind = lastStatDate
      ? Math.round((parseDay(range.to) - parseDay(lastStatDate)) / 86400000)
      : null;

    return {
      reach,
      spend,
      prevReach,
      prevSpend,
      cpm,
      prevCpm,
      followersNow,
      netNew,
      prevNetNew,
      dailyReach: days.map(reachOn),
      dailySpend: days.map(spendOn),
      dailyCpm: rolling(
        days.map((day) => (reachOn(day) > 0 ? (spendOn(day) / reachOn(day)) * 1000 : 0)),
        3
      ),
      dailyFollowers: days.map((_, i) => igGrowth[i] + fbGrowth[i]),
      reachIndex,
      revIndex,
      idxMin,
      idxMax,
      r,
      days,
      reachOn,
      revenueOn,
      spendOn,
      reachBars,
      reachScale,
      igGrowth,
      fbGrowth,
      growthLo,
      growthHi,
      igNetNew: latestFollowers("instagram", range.to) - latestFollowers("instagram", range.previous.to),
      fbNetNew: latestFollowers("facebook", range.to) - latestFollowers("facebook", range.previous.to),
      bestDays,
      combinedCount: combinedRows.filter((x) => x.stat_date >= range.from && x.stat_date <= range.to).length,
      lastStatDate,
      daysBehind,
      isEmpty: reach === 0 && spend === 0,
    };
  }, [raw, range.from, range.to, range.previous.from, range.previous.to, interval, platform]);

  if (failure) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Marketing" sub={rangeTitle(range.from, range.to)} />
        <EmptyState
          icon={TriangleAlert}
          title="Could not load this period"
          body={`${failure} The figures are left blank rather than shown half-read.`}
          action="Try again"
          onAction={() => range.setRange(range.id)}
        />
      </div>
    );
  }

  if (loading || !model) {
    return <LoadingState kpis={4} shape="chart" line="LOADING SOCIAL STATS · 2 PLATFORMS" />;
  }

  const header = (
    <PageHeader
      title="Marketing"
      sub={`${rangeTitle(range.from, range.to)} · Facebook and Instagram · compared with the ${range.days} days before`}
      right={
        model.lastStatDate && (
          <div className="flex items-center gap-[7px] h-[26px] px-2.5 border border-line rounded-full font-mono text-[11px] text-subtle whitespace-nowrap">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background:
                  model.daysBehind > 2 ? "#ee0000" : model.daysBehind > 0 ? "#f5a623" : "#50e3c2",
              }}
            />
            SYNCED{" "}
            {`${parseDay(model.lastStatDate).getDate()} ${MONTHS[
              parseDay(model.lastStatDate).getMonth()
            ].toUpperCase()}`}
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
          title={`Nothing was posted between ${rangeTitle(range.from, range.to)}`}
          body="No reach, spend or follower movement to report. Social stats are imported separately from orders and often lag behind them by weeks."
          action="Jump to the last 28 days"
          onAction={() => range.setRange("28d")}
        />
      </div>
    );
  }

  const hovered = hover >= 0 ? hover : null;
  const labelEvery = Math.ceil(model.days.length / 7);
  const barLabelEvery = Math.ceil(model.reachBars.length / 7);

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={PLATFORMS} value={platform} onChange={setPlatform} />
        <div className="flex-1 min-w-1" />
        <Segmented options={INTERVALS} value={interval} onChange={setInterval} />
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KpiCard
          label="REACH"
          value={kfmt(model.reach)}
          sub="people saw a post"
          delta={pctChange(model.reach, model.prevReach)}
          series={model.dailyReach}
        />
        <KpiCard
          label="AD SPEND"
          value={euro(model.spend)}
          sub="boosted posts only"
          delta={pctChange(model.spend, model.prevSpend)}
          series={model.dailySpend}
        />
        <KpiCard
          label="COST / 1K"
          value={euro2(model.cpm)}
          sub={model.prevCpm > 0 ? `was ${euro2(model.prevCpm)} last period` : "no baseline before"}
          delta={pctChange(model.cpm, model.prevCpm)}
          positiveIsGood={false}
          series={model.dailyCpm}
        />
        <KpiCard
          label="FOLLOWERS"
          value={model.followersNow.toLocaleString("en-GB")}
          sub={`${model.netNew >= 0 ? "+" : "−"}${Math.abs(model.netNew)} new, vs ${
            model.prevNetNew >= 0 ? "+" : "−"
          }${Math.abs(model.prevNetNew)} before`}
          delta={pctChange(model.netNew, model.prevNetNew)}
          series={model.dailyFollowers}
        />
      </div>

      {/* Does reach drive sales? */}
      <Card>
        <div className="border-b border-line">
          <CardHeader
            title="Does reach drive sales?"
            sub={
              hovered != null
                ? `${parseDay(model.days[hovered]).getDate()} ${
                    MONTHS[parseDay(model.days[hovered]).getMonth()]
                  } · reach ${kfmt(model.reachOn(model.days[hovered]))} · revenue ${euro(
                    model.revenueOn(model.days[hovered])
                  )} · spend ${euro(model.spendOn(model.days[hovered]))}`
                : `Seven-day averages, both indexed to 100 at the start. r = ${model.r.toFixed(2)} — ${
                    model.r > 0.6
                      ? "reach and revenue move together, but reach is not the whole story"
                      : model.r > 0.3
                        ? "a loose link: reach nudges revenue, other things matter more"
                        : "no useful link in this period"
                  }`
            }
            right={
              <div className="flex flex-wrap gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-2 rounded-[2px]"
                    style={{ background: "rgba(0,112,243,0.18)" }}
                  />
                  Reach
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-ink-strong" />
                  Revenue
                </span>
              </div>
            }
          />
        </div>

        <div className="px-4 pt-4 flex gap-2.5">
          <div className="w-[34px] md:w-10 shrink-0 flex flex-col justify-between h-[170px] md:h-[190px] text-right">
            {[model.idxMax, (model.idxMax + model.idxMin) / 2, model.idxMin].map((v) => (
              <span key={v} className="font-mono text-[11px] text-muted leading-none">
                {Math.round(v)}
              </span>
            ))}
          </div>
          <div
            className="flex-1 min-w-0 relative h-[170px] md:h-[190px]"
            onMouseLeave={() => setHover(-1)}
          >
            {[0, 50, 100].map((t) => (
              <div
                key={t}
                className="absolute left-0 right-0 h-px bg-wash"
                style={{ top: `${t}%` }}
              />
            ))}
            <svg
              viewBox="0 0 720 190"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full overflow-visible"
            >
              <path
                d={`M0,190 L${polyline(model.reachIndex, 720, 190, model.idxMin, model.idxMax)
                  .split(" ")
                  .join(" L")} L720,190 Z`}
                fill="rgba(0,112,243,0.10)"
              />
              <polyline
                points={polyline(model.reachIndex, 720, 190, model.idxMin, model.idxMax)}
                fill="none"
                stroke={FB}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
              <polyline
                points={polyline(model.revIndex, 720, 190, model.idxMin, model.idxMax)}
                fill="none"
                stroke="var(--color-ink-strong)"
                strokeWidth={1.75}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </svg>
            <div className="absolute inset-0 flex">
              {model.days.map((day, i) => (
                <div
                  key={day}
                  onMouseEnter={() => setHover(i)}
                  className="flex-1"
                  style={{
                    borderLeft: `1px solid ${hovered === i ? "#e5e5e5" : "transparent"}`,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="w-[34px] md:w-10 shrink-0" />
        </div>

        <div className="px-4 pb-3.5 pt-2 flex gap-2.5">
          <div className="w-[34px] md:w-10 shrink-0" />
          <div className="flex-1 min-w-0 flex">
            {model.days.map((day, i) => (
              <div key={day} className="flex-1 min-w-0 text-center">
                {i % labelEvery === 0 && (
                  <span
                    className={`font-mono text-[11px] text-muted whitespace-nowrap ${
                      i % (labelEvery * 2) === 0 ? "" : "hidden md:inline"
                    }`}
                  >
                    {parseDay(day).getDate()} {MONTHS[parseDay(day).getMonth()].toLowerCase()}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="w-[34px] md:w-10 shrink-0" />
        </div>
      </Card>

      {/* Reach by platform + follower growth */}
      <div className="grid gap-3 items-start md:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <Card>
          <div className="border-b border-line">
            <CardHeader
              title="Reach by platform"
              sub={
                platform === "all"
                  ? model.combinedCount > 0
                    ? `${model.combinedCount} combined campaign${
                        model.combinedCount === 1 ? "" : "s"
                      } report as one figure and sit in their own band`
                    : "Each network's share of the period's reach"
                  : `${model.combinedCount} combined campaign${
                      model.combinedCount === 1 ? " is" : "s are"
                    } left out — they cannot be split between the two`
              }
              right={
                <div className="flex flex-wrap gap-3 text-[11px] text-muted">
                  {platform !== "facebook" && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-[9px] h-[9px] rounded-[2px]" style={{ background: IG }} />
                      Instagram
                    </span>
                  )}
                  {platform !== "instagram" && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-[9px] h-[9px] rounded-[2px]" style={{ background: FB }} />
                      Facebook
                    </span>
                  )}
                  {platform === "all" && model.combinedCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-[9px] h-[9px] rounded-[2px] bg-faint" />
                      Both
                    </span>
                  )}
                </div>
              }
            />
          </div>

          <div className="px-4 pt-4 flex gap-2.5">
            <div className="w-[34px] md:w-10 shrink-0 flex flex-col justify-between h-[150px] md:h-[180px] text-right">
              {[3, 2, 1, 0].map((k) => (
                <span key={k} className="font-mono text-[11px] text-muted leading-none">
                  {kfmt(model.reachScale.step * k)}
                </span>
              ))}
            </div>
            <div className="flex-1 min-w-0 relative h-[150px] md:h-[180px]">
              {[0, 33.33, 66.67, 100].map((t) => (
                <div
                  key={t}
                  className="absolute left-0 right-0 h-px bg-wash"
                  style={{ top: `${t}%` }}
                />
              ))}
              <div className="absolute inset-0 flex items-end gap-0.5 md:gap-1">
                {model.reachBars.map((bar) => (
                  <div key={bar.key} className="flex-1 min-w-0 h-full flex flex-col justify-end">
                    {bar.segments.map((seg, si) => (
                      <div
                        key={seg.id}
                        style={{
                          height: `${(seg.value / model.reachScale.max) * 100}%`,
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

          <div className="px-4 pb-3.5 pt-2 flex gap-2.5">
            <div className="w-[34px] md:w-10 shrink-0" />
            <div className="flex-1 min-w-0 flex">
              {model.reachBars.map((bar, i) => (
                <div key={bar.key} className="flex-1 min-w-0 text-center">
                  {i % barLabelEvery === 0 && (
                    <span
                      className={`font-mono text-[11px] text-muted whitespace-nowrap ${
                        i % (barLabelEvery * 2) === 0 ? "" : "hidden md:inline"
                      }`}
                    >
                      {interval === "daily"
                        ? `${parseDay(bar.key).getDate()} ${MONTHS[
                            parseDay(bar.key).getMonth()
                          ].toLowerCase()}`
                        : bar.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="px-4 py-3.5">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Follower growth</h2>
          <p className="mt-[3px] text-[12px] text-subtle">
            New followers since {parseDay(range.from).getDate()}{" "}
            {MONTHS[parseDay(range.from).getMonth()]}
          </p>
          <svg
            viewBox="0 0 320 110"
            preserveAspectRatio="none"
            className="w-full h-[110px] mt-4"
          >
            {model.growthLo < 0 && (
              <line
                x1="0"
                x2="320"
                y1={(110 - ((0 - model.growthLo) / (model.growthHi - model.growthLo)) * 110).toFixed(1)}
                y2={(110 - ((0 - model.growthLo) / (model.growthHi - model.growthLo)) * 110).toFixed(1)}
                stroke="var(--color-wash)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
            <polyline
              points={polyline(model.igGrowth, 320, 110, model.growthLo, model.growthHi)}
              fill="none"
              stroke={IG}
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            <polyline
              points={polyline(model.fbGrowth, 320, 110, model.growthLo, model.growthHi)}
              fill="none"
              stroke={FB}
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex flex-col gap-2 mt-4">
            {[
              ["Instagram", IG, model.igNetNew],
              ["Facebook", FB, model.fbNetNew],
            ].map(([name, color, value]) => (
              <div key={name} className="flex items-center gap-2.5">
                <span
                  className="w-2 h-2 rounded-[2px] shrink-0"
                  style={{ background: color }}
                />
                <span className="text-[13px] flex-1">{name}</span>
                <span className="font-mono text-[13px] font-medium">
                  {value >= 0 ? "+" : "−"}
                  {Math.abs(value)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Biggest reach days */}
      <Card>
        <div className="px-4 pt-3.5 pb-2.5">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Biggest reach days</h2>
          <p className="mt-[3px] text-[12px] text-subtle text-pretty">
            What each one cost, and what the kitchen took that day
          </p>
        </div>
        <div className="hidden md:grid px-4 pb-2 gap-2 font-mono text-[11px] tracking-[0.05em] text-muted grid-cols-[minmax(0,1.4fr)_70px_72px_62px_82px_62px]">
          <span>DAY</span>
          <span className="text-right">REACH</span>
          <span className="text-right">SPEND</span>
          <span className="text-right">/1K</span>
          <span className="text-right">REVENUE</span>
          <span className="text-right">VS AVG</span>
        </div>
        {model.bestDays.length === 0 && (
          <p className="px-4 pb-4 text-[12px] text-muted border-t border-line pt-3">
            No reach recorded in this range.
          </p>
        )}
        {model.bestDays.map((d) => (
          <div
            key={d.day}
            className="px-4 py-2.5 border-t border-line hover:bg-wash-light grid gap-2 items-center grid-cols-[minmax(0,1fr)_62px_74px_58px] md:grid-cols-[minmax(0,1.4fr)_70px_72px_62px_82px_62px]"
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium">
                {parseDay(d.day).toLocaleDateString("en-GB", { weekday: "short" })}{" "}
                {parseDay(d.day).getDate()} {MONTHS[parseDay(d.day).getMonth()]}
              </div>
              <div className="font-mono text-[11px] text-subtle">{d.igShare}% IG</div>
            </div>
            <span className="font-mono text-[12px] text-right">{kfmt(d.reach)}</span>
            <span className="font-mono text-[12px] text-muted text-right hidden md:block">
              {euro(d.spend)}
            </span>
            <span className="font-mono text-[12px] text-muted text-right hidden md:block">
              {euro2(d.cpm)}
            </span>
            <span className="font-mono text-[12px] text-right">{euro(d.revenue)}</span>
            <span
              className="font-mono text-[12px] text-right"
              style={{ color: d.lift >= 0 ? "var(--color-accent)" : "var(--color-danger)" }}
            >
              {signedPct(d.lift, 0)}
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
