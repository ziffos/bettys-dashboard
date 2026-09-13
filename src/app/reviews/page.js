"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Search, TriangleAlert } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useRange } from "../../lib/RangeContext";
import {
  Card,
  CardHeader,
  EmptyState,
  LoadingState,
  PageHeader,
  Segmented,
  Stars,
  UpcomingCard,
  PLATFORM,
} from "../../components/ui";
import {
  MONTHS,
  eachDay,
  fetchAllRows,
  fmtDay,
  num,
  parseDay,
  parseItems,
  rangeTitle,
  shortDate,
} from "../../lib/format";
import { dayOf, timeOf } from "../../lib/salesModel";

/**
 * Google has no rows in `reviews` yet — the import only covers the three
 * delivery platforms. It stays in the UI on purpose, so the day the Google feed
 * is connected the screen already has a place for it rather than needing a
 * change. Until then it reads as "no reviews yet", which is true.
 */
const SOURCES = ["google", "wolt", "foody", "bolt"];

const FEED_LIMIT = 30;
const TARGET = 4.5;
const WEEKS = 8;

export default function ReviewsPage() {
  const range = useRange();
  const rangeKey = `${range.from}|${range.to}`;
  const [store, setStore] = useState({ key: null, raw: null, failure: null });
  const loading = store.key !== rangeKey;
  const raw = loading ? null : store.raw;
  const failure = loading ? null : store.failure;

  const [platform, setPlatform] = useState("all");
  const [star, setStar] = useState(0);
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // The weekly trend looks back further than the range picker does.
      const trendFrom = fmtDay(
        new Date(parseDay(range.to).getTime() - (WEEKS * 7 - 1) * 86400000)
      );
      const windowFrom = trendFrom < range.previous.from ? trendFrom : range.previous.from;
      const until = `${range.to}T23:59:59.999`;

      try {
        const reviews = await fetchAllRows(
          supabase,
          "reviews",
          "rating, review_text, review_date, source_platform, order_reference, reviewer_name",
          [
            { op: "gte", col: "review_date", val: windowFrom },
            { op: "lte", col: "review_date", val: until },
          ]
        );

        // What each reviewer actually ordered, via the order they rated.
        const refs = [...new Set(reviews.map((r) => r.order_reference).filter(Boolean))];
        let purchases = [];
        if (refs.length) {
          // `in` on a few hundred references is fine; chunked so a busy quarter
          // cannot produce a URL the gateway rejects.
          const CHUNK = 150;
          for (let i = 0; i < refs.length; i += CHUNK) {
            const { data, error } = await supabase
              .from("delivery_purchases")
              .select("order_reference, items")
              .in("order_reference", refs.slice(i, i + CHUNK));
            if (error) throw new Error(`delivery_purchases: ${error.message}`);
            purchases = purchases.concat(data || []);
          }
        }

        // When a platform has nothing in the range, "none yet" is the wrong
        // story if it used to have plenty. One row each, unbounded, so the
        // table can say when its last review actually arrived.
        const lastEver = {};
        await Promise.all(
          SOURCES.map(async (id) => {
            const { data } = await supabase
              .from("reviews")
              .select("review_date")
              .eq("source_platform", id)
              .order("review_date", { ascending: false })
              .limit(1);
            lastEver[id] = data?.[0]?.review_date ? dayOf(data[0].review_date) : null;
          })
        );

        if (cancelled) return;
        setStore({ key: rangeKey, raw: { reviews, purchases, windowFrom, lastEver }, failure: null });
      } catch (err) {
        if (cancelled) return;
        console.error("Reviews fetch failed:", err);
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

    const itemsByRef = new Map(
      raw.purchases.map((p) => [p.order_reference, p.items])
    );

    const all = raw.reviews.map((r) => {
      const day = dayOf(r.review_date);
      return {
        ...r,
        day,
        platform: (r.source_platform || "").toLowerCase(),
        text: (r.review_text || "").trim(),
        items: parseItems(itemsByRef.get(r.order_reference)),
      };
    });

    const inRange = (r) => r.day >= range.from && r.day <= range.to;
    const current = all.filter(inRange);
    const previous = all.filter(
      (r) => r.day >= range.previous.from && r.day <= range.previous.to
    );

    const avgOf = (list) =>
      list.length ? list.reduce((a, r) => a + (r.rating || 0), 0) / list.length : 0;

    const overallAvg = avgOf(current);
    const prevAvg = avgOf(previous);

    // Per platform, including the ones with nothing yet.
    const platRows = SOURCES.map((id) => {
      const list = current.filter((r) => r.platform === id);
      const before = previous.filter((r) => r.platform === id);
      const avg = avgOf(list);
      return {
        id,
        name: PLATFORM[id].name,
        color: PLATFORM[id].color,
        avg,
        count: list.length,
        diff: list.length && before.length ? avg - avgOf(before) : null,
        lastEver: raw.lastEver?.[id] ?? null,
      };
    }).sort((a, b) => b.count - a.count || b.avg - a.avg);

    // The breakdown doubles as the star filter, so it reflects the platform
    // choice but not its own star selection.
    const forBreakdown =
      platform === "all" ? current : current.filter((r) => r.platform === platform);
    const breakdown = [5, 4, 3, 2, 1].map((s) => {
      const count = forBreakdown.filter((r) => r.rating === s).length;
      return {
        star: s,
        count,
        share: forBreakdown.length ? (count / forBreakdown.length) * 100 : 0,
        color: s >= 4 ? "#171717" : s === 3 ? "#f5a623" : "#ee0000",
      };
    });

    // Weekly average over the last eight weeks, ending at the range's end.
    const end = parseDay(range.to);
    const weeks = [];
    for (let w = WEEKS - 1; w >= 0; w--) {
      const to = fmtDay(new Date(end.getTime() - w * 7 * 86400000));
      const from = fmtDay(new Date(parseDay(to).getTime() - 6 * 86400000));
      const list = all.filter(
        (r) =>
          r.day >= from &&
          r.day <= to &&
          (platform === "all" || r.platform === platform)
      );
      weeks.push({ from, to, avg: list.length ? avgOf(list) : null, count: list.length });
    }

    // ── Feed.
    const q = query.trim().toLowerCase();
    const feedAll = current
      .filter((r) => platform === "all" || r.platform === platform)
      .filter((r) => !star || r.rating === star)
      .filter((r) => !commentsOnly || r.text)
      .filter(
        (r) =>
          !q ||
          r.text.toLowerCase().includes(q) ||
          (r.reviewer_name || "").toLowerCase().includes(q) ||
          r.items.some((i) => i.name.toLowerCase().includes(q))
      )
      .sort((a, b) => String(b.review_date).localeCompare(String(a.review_date)));

    const withComment = current.filter((r) => r.text).length;

    let lastDay = null;
    for (const r of current) if (!lastDay || r.day > lastDay) lastDay = r.day;
    const daysBehind = lastDay
      ? Math.round((parseDay(range.to) - parseDay(lastDay)) / 86400000)
      : null;

    return {
      overallAvg,
      prevAvg,
      count: current.length,
      withComment,
      platRows,
      breakdown,
      weeks,
      feed: feedAll.slice(0, FEED_LIMIT),
      feedTotal: feedAll.length,
      lastDay,
      daysBehind,
      isEmpty: current.length === 0,
    };
  }, [raw, range.from, range.to, range.previous.from, range.previous.to, platform, star, commentsOnly, query]);

  if (failure) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Reviews" sub={rangeTitle(range.from, range.to)} />
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
    return <LoadingState kpis={2} shape="list" line="LOADING REVIEWS · 4 PLATFORMS" columns="minmax(0,1.9fr) minmax(280px,1fr)" />;
  }

  const header = (
    <PageHeader
      title="Reviews"
      sub={`${rangeTitle(range.from, range.to)} · Google, Wolt, Foody and Bolt`}
      right={
        model.lastDay && (
          <div className="flex items-center gap-[7px] h-[26px] px-2.5 border border-line rounded-full font-mono text-[11px] text-subtle whitespace-nowrap">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background:
                  model.daysBehind > 2 ? "#ee0000" : model.daysBehind > 0 ? "#f5a623" : "#50e3c2",
              }}
            />
            SYNCED {parseDay(model.lastDay).getDate()}{" "}
            {MONTHS[parseDay(model.lastDay).getMonth()].toUpperCase()}
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
          icon={MessageCircle}
          title={`No reviews between ${rangeTitle(range.from, range.to)}`}
          body="Nobody left a rating in this range. Reviews usually land a day or two after the order, so a recent window stays quiet for a while."
          action="Jump to the last 28 days"
          onAction={() => range.setRange("28d")}
        />
      </div>
    );
  }

  const diff = model.overallAvg - model.prevAvg;
  const ratedWeeks = model.weeks.filter((w) => w.avg != null);
  const lo = 3.5;
  const hi = 5;
  const yOf = (v) => 110 - ((v - lo) / (hi - lo)) * 110;
  const xOf = (i) => (i / Math.max(1, WEEKS - 1)) * 300;

  const platformOptions = [
    { id: "all", label: "All" },
    ...SOURCES.map((id) => ({ id, label: PLATFORM[id].name })),
  ];

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}

      {/* Hero + breakdown */}
      <div className="grid gap-3 items-start md:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <Card className="px-4 py-4">
          <div className="flex items-end gap-3.5 flex-wrap">
            <span className="text-[44px] md:text-[52px] font-semibold tracking-[-0.045em] leading-none">
              {model.overallAvg.toFixed(1)}
            </span>
            <div className="flex flex-col gap-1.5 pb-1">
              <Stars rating={model.overallAvg} size={16} />
              <span className="font-mono text-[11px] text-subtle">
                {num(model.count)} review{model.count === 1 ? "" : "s"} in {range.days} days
              </span>
            </div>
            <div className="flex-1" />
            {model.prevAvg > 0 && (
              <span
                className="text-[12px] font-medium"
                style={{
                  color: diff >= 0 ? "var(--color-accent)" : "var(--color-danger)",
                }}
              >
                {diff >= 0 ? "+" : "−"}
                {Math.abs(diff).toFixed(1)} vs previous {range.days} days
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3 mt-4">
            {model.platRows.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <span
                  className="w-2 h-2 rounded-[2px] shrink-0"
                  style={{ background: p.count ? p.color : "#e5e5e5" }}
                />
                <span
                  className={`text-[13px] w-14 shrink-0 ${p.count ? "" : "text-subtle"}`}
                >
                  {p.name}
                </span>
                <div className="flex-1 min-w-10 h-[5px] bg-wash rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${(p.avg / 5) * 100}%`, background: p.color }}
                  />
                </div>
                <span className="font-mono text-[13px] font-medium w-7 text-right">
                  {p.count ? p.avg.toFixed(1) : "—"}
                </span>
                <span
                  className="font-mono text-[11px] w-8 text-right"
                  style={{
                    color:
                      p.diff == null
                        ? "var(--color-subtle)"
                        : p.diff >= 0
                          ? "var(--color-accent)"
                          : "var(--color-danger)",
                  }}
                >
                  {p.diff == null ? "" : `${p.diff >= 0 ? "+" : "−"}${Math.abs(p.diff).toFixed(1)}`}
                </span>
                <span className="font-mono text-[11px] text-subtle w-[128px] text-right truncate">
                  {p.count
                    ? `${p.count} reviews`
                    : p.lastEver
                      ? `none since ${shortDate(p.lastEver)}`
                      : "none yet"}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Rating breakdown" sub="Click a row to filter the feed" />
          <div className="px-2 pb-2.5">
            {model.breakdown.map((b) => {
              const on = star === b.star;
              return (
                <div
                  key={b.star}
                  onClick={() => setStar(on ? 0 : b.star)}
                  className={`flex items-center gap-2.5 px-2 py-[7px] rounded-md cursor-pointer hover:bg-wash-light ${
                    on ? "bg-wash-light" : ""
                  }`}
                >
                  <span
                    className={`flex items-center gap-[3px] w-[26px] text-[13px] ${
                      on ? "font-medium" : ""
                    }`}
                  >
                    {b.star}
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="text-ink-strong"
                    >
                      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
                    </svg>
                  </span>
                  <div className="flex-1 min-w-[30px] h-1.5 bg-wash rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${b.share}%`, background: b.color }}
                    />
                  </div>
                  <span className="font-mono text-[12px] w-7 text-right">{b.count}</span>
                  <span className="font-mono text-[11px] text-subtle w-8 text-right">
                    {Math.round(b.share)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={platformOptions} value={platform} onChange={setPlatform} />
        <button
          onClick={() => setCommentsOnly((v) => !v)}
          className={`flex items-center gap-[7px] h-8 px-[11px] rounded-lg border text-[13px] whitespace-nowrap ${
            commentsOnly
              ? "border-ink-strong bg-ink-strong text-surface"
              : "border-line bg-surface text-muted"
          }`}
        >
          <MessageCircle size={14} strokeWidth={1.75} />
          With comment
          <span
            className={`font-mono text-[11px] ${
              commentsOnly ? "text-surface/70" : "text-subtle"
            }`}
          >
            {model.withComment}
          </span>
        </button>
        <div className="flex-1 min-w-1" />
        <div className="flex items-center gap-2 h-8 px-2.5 border border-line rounded-lg bg-surface min-w-[180px]">
          <Search size={14} strokeWidth={2} className="text-subtle shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reviews"
            className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
        </div>
      </div>

      {/* Themes (upcoming) + weekly average */}
      <div className="grid gap-3 items-start md:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <UpcomingCard title="What people mention">
          Themes — food quality, delivery time, missing items — pulled from the reviews
          that left a comment. Only {model.withComment} of {model.count} reviews in this
          range carry any text, and there is no theme on the record yet, so the
          classifier is still an open decision.
        </UpcomingCard>

        <Card className="px-4 py-3.5">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Weekly average</h2>
          <p className="mt-[3px] text-[12px] text-subtle">
            Last {WEEKS} weeks, against a {TARGET} target
          </p>
          <div className="flex gap-2.5 mt-4">
            <div className="w-[30px] shrink-0 relative h-[110px]">
              {[5, 4.5, 4, 3.5].map((v) => (
                <span
                  key={v}
                  className="absolute right-0 font-mono text-[11px] text-muted -translate-y-1/2"
                  style={{ top: `${((hi - v) / (hi - lo)) * 100}%` }}
                >
                  {v.toFixed(1)}
                </span>
              ))}
            </div>
            <div className="flex-1 min-w-0 relative h-[110px]">
              {[5, 4.5, 4, 3.5].map((v) => (
                <div
                  key={v}
                  className="absolute left-0 right-0 h-px bg-wash"
                  style={{ top: `${((hi - v) / (hi - lo)) * 100}%` }}
                />
              ))}
              <svg
                viewBox="0 0 300 110"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full"
              >
                <line
                  x1="0"
                  x2="300"
                  y1={yOf(TARGET)}
                  y2={yOf(TARGET)}
                  stroke="#d4d4d4"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  vectorEffect="non-scaling-stroke"
                />
                {ratedWeeks.length > 1 && (
                  <polyline
                    points={model.weeks
                      .map((w, i) => (w.avg == null ? null : `${xOf(i)},${yOf(w.avg)}`))
                      .filter(Boolean)
                      .join(" ")}
                    fill="none"
                    stroke="var(--color-ink-strong)"
                    strokeWidth={1.75}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />
                )}
                {model.weeks.map((w, i) =>
                  w.avg == null ? null : (
                    <circle
                      key={w.to}
                      cx={xOf(i)}
                      cy={yOf(w.avg)}
                      r={2.5}
                      fill="var(--color-ink-strong)"
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                )}
              </svg>
            </div>
          </div>
          <div className="flex gap-2.5 mt-2">
            <div className="w-[30px] shrink-0" />
            <div className="flex-1 min-w-0 relative h-3.5">
              {[0, 3, 7].map((i) => (
                <span
                  key={i}
                  className="absolute font-mono text-[11px] text-muted -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${(i / (WEEKS - 1)) * 100}%` }}
                >
                  {parseDay(model.weeks[i].to).getDate()}{" "}
                  {MONTHS[parseDay(model.weeks[i].to).getMonth()].toLowerCase()}
                </span>
              ))}
            </div>
          </div>
          {ratedWeeks.length < 2 && (
            <p className="mt-3 text-[12px] text-subtle text-pretty">
              Too few weeks with reviews to draw a trend yet.
            </p>
          )}
        </Card>
      </div>

      {/* Feed */}
      <Card>
        <div className="px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Feed</h2>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-subtle">
              {model.feedTotal === 0
                ? "No reviews match these filters"
                : `Showing ${Math.min(FEED_LIMIT, model.feedTotal)} of ${model.feedTotal}`}
            </span>
            <button
              onClick={() => {
                setPlatform("all");
                setStar(0);
                setCommentsOnly(false);
                setQuery("");
              }}
              className="h-7 px-2.5 border border-line rounded-md bg-surface text-[12px] text-muted hover:border-line-strong hover:text-ink"
            >
              Clear filters
            </button>
          </div>
        </div>

        {model.feed.length === 0 && (
          <div className="border-t border-line py-11 px-6 flex flex-col items-center text-center gap-2.5">
            <div className="w-9 h-9 rounded-[9px] border border-line bg-surface flex items-center justify-center">
              <MessageCircle size={16} strokeWidth={1.75} className="text-subtle" />
            </div>
            <h3 className="text-[15px] font-semibold tracking-[-0.01em]">
              Nothing matches those filters
            </h3>
            <p className="text-[13px] text-muted max-w-[320px] text-pretty">
              Try a different platform or star rating, or clear the filters to see
              everything again.
            </p>
          </div>
        )}

        {model.feed.map((r, i) => {
          const plat = PLATFORM[r.platform];
          return (
            <div key={i} className="px-4 py-3.5 border-t border-line hover:bg-wash-light">
              <div className="flex items-center gap-2.5 flex-wrap">
                <Stars rating={r.rating || 0} size={12} />
                <span className="flex items-center gap-1.5 text-[12px]">
                  <span
                    className="w-[7px] h-[7px] rounded-[2px]"
                    style={{ background: plat?.color ?? "#8f8f8f" }}
                  />
                  {r.reviewer_name || `${plat?.name ?? r.platform} customer`}
                </span>
                <span className="font-mono text-[11px] text-subtle">
                  {parseDay(r.day).getDate()} {MONTHS[parseDay(r.day).getMonth()]} ·{" "}
                  {timeOf(r.review_date)}
                </span>
              </div>
              <p
                className="mt-2 text-[13px] leading-[1.5] text-pretty"
                style={{
                  color: r.text ? "var(--color-ink)" : "var(--color-muted)",
                  fontStyle: r.text ? "normal" : "italic",
                }}
              >
                {r.text || "No comment left"}
              </p>
              {r.items.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {r.items.map((item, j) => (
                    <span
                      key={j}
                      className="text-[11px] px-2 py-[3px] rounded-full bg-wash-light border border-line text-muted"
                    >
                      {item.qty}× {item.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
