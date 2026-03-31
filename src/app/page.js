"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { Star } from "lucide-react";
import SkeletonBlock from "../components/SkeletonBlock";
import { parseISO, format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LabelList,
  ResponsiveContainer,
} from "recharts";

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORM_BADGE = {
  wolt: "bg-blue-500/15 text-blue-400",
  foody: "bg-amber-500/15 text-amber-400",
  bolt: "bg-emerald-500/15 text-emerald-400",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCyprusNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Nicosia" })
  );
}

/** Convert order_placed to YYYY-MM-DD — same as sales page: parseISO + format (local tz) */
function getDateStr(orderPlaced) {
  if (!orderPlaced) return null;
  return format(parseISO(orderPlaced), "yyyy-MM-dd");
}

/** Paginated fetch — same as sales page, handles Supabase 1000-row default limit */
async function fetchAllRows(table, select, filters) {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;
  while (true) {
    let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);
    for (const f of filters) {
      query = query[f.op](f.col, f.val);
    }
    const { data, error } = await query;
    if (error || !data) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

function formatShortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Nicosia",
  });
}

function getGreeting(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Custom shape for net (green) bar — rounds top corners only when no commission above */
function NetBarShape({ x, y, width, height, commission }) {
  if (!height || height <= 0) return null;
  if (!commission || commission <= 0) {
    const r = 4;
    return (
      <path
        d={`M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`}
        fill="#1D9E75"
      />
    );
  }
  return <rect x={x} y={y} width={width} height={height} fill="#1D9E75" />;
}

/** Custom shape for commission bar — solid red if confirmed, light red with dashed border if estimated */
function CommBarShape({ x, y, width, height, confirmed }) {
  if (!height || height <= 0) return null;
  const r = 4;
  const path = `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
  if (confirmed) {
    return <path d={path} fill="#A32D2D" />;
  }
  return (
    <g>
      <path d={path} fill="rgba(163, 45, 45, 0.2)" />
      <path d={path} fill="none" stroke="#A32D2D" strokeWidth={1.5} strokeDasharray="4 3" />
    </g>
  );
}

/** Label for net bar: net payout inside green segment */
function RevNetLabels({ x, y, width, height, value, net }) {
  const amount = net || value;
  if (!amount || amount <= 0 || height < 14) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2 + 3}
      textAnchor="middle"
      fill="rgba(255,255,255,0.85)"
      className="text-[9px] md:text-[10px]"
    >
      &euro;{Math.round(amount).toLocaleString()}
    </text>
  );
}

/** Label for commission bar: commission amount inside red/amber segment */
function RevCommLabel({ x, y, width, height, value }) {
  if (!value || height < 14) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2 + 3}
      textAnchor="middle"
      fill="rgba(255,255,255,0.85)"
      className="text-[9px] md:text-[10px]"
    >
      {value}
    </text>
  );
}

function ReachLabel({ x, y, width, value }) {
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      fill="white"
      fontSize={11}
    >
      {value.toLocaleString()}
    </text>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const { profile } = useAuth();
  const [interval, setInterval] = useState("daily");
  const [commentOnly, setCommentOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState(null);
  const [quote, setQuote] = useState(null);

  const cyprusNow = getCyprusNow();
  const greeting = getGreeting(cyprusNow.getHours());
  const firstName = profile?.full_name
    ? profile.full_name.split(" ")[0]
    : "";

  // ── Fetch all data once ─────────────────────────────────────────────────
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);

      // Quote of the day
      const dayOfYear = Math.floor(
        (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
      );
      const quoteOffset = dayOfYear % 30;

      // Fetch 7 months of data (broadest range needed for monthly interval)
      const rangeStart = new Date();
      rangeStart.setMonth(rangeStart.getMonth() - 7);
      const rangeStartStr = rangeStart.toISOString().split("T")[0];

      // Paginated fetches for large tables (same as sales page)
      const [allDel, allPos, socialRes, reviewRes, quoteRes, payoutRows] =
        await Promise.all([
          fetchAllRows("delivery_purchases", "order_placed, price, delivery_status, items, delivery_partner", [
            { op: "gte", col: "order_placed", val: rangeStartStr },
          ]),
          fetchAllRows("pos_sales", "order_placed, price", [
            { op: "gte", col: "order_placed", val: rangeStartStr },
          ]),
          supabase
            .from("social_stats")
            .select("stat_date, total_reach")
            .gte("stat_date", rangeStartStr),
          supabase
            .from("reviews")
            .select("rating, review_text, source_platform, review_date")
            .order("review_date", { ascending: false })
            .limit(30),
          supabase
            .from("quotes")
            .select("text, author")
            .range(quoteOffset, quoteOffset),
          fetchAllRows("platform_payouts", "platform,period_from,period_to,gross_sales,commission_total,ad_spend,other_fees,net_payout", [
            { op: "gte", col: "period_to", val: rangeStartStr },
          ]),
        ]);

      // Only include delivered orders (matches sales page logic)
      const deliveries = allDel.filter(
        (r) => (r.delivery_status || "").toLowerCase() === "delivered"
      );
      const pos = allPos;

      // Find latest data date — same logic as sales page: parseISO + format in local tz
      const allDateStrs = [
        ...deliveries.map((r) => getDateStr(r.order_placed)),
        ...pos.map((r) => getDateStr(r.order_placed)),
      ].filter(Boolean);
      allDateStrs.sort();
      const latestDateStr = allDateStrs.length > 0
        ? allDateStrs[allDateStrs.length - 1]
        : format(new Date(), "yyyy-MM-dd");

      setRaw({
        deliveries,
        pos,
        social: socialRes.data || [],
        reviews: reviewRes.data || [],
        payouts: payoutRows,
        latestDateStr,
      });
      setQuote(quoteRes.data?.[0] || null);
      setLoading(false);
    }
    fetchAll();
  }, []);

  // ── Derive chart data based on interval ─────────────────────────────────
  const chartData = useMemo(() => {
    if (!raw) return null;

    // Anchor everything to the business date string (no timezone issues)
    const latestStr = raw.latestDateStr;
    const [ly, lm, ld] = latestStr.split("-").map(Number);

    // Helper: Date(y,m,d) → "YYYY-MM-DD" (pure calendar math, no timezone)
    const fmtD = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

    // Helper to build 7 buckets anchored to a given date
    function buildBuckets(anchorY, anchorM, anchorD) {
      const b = [];
      if (interval === "daily") {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(anchorY, anchorM - 1, anchorD - i);
          b.push({ key: fmtD(d), label: DAY_NAMES[d.getDay()], value: 0 });
        }
      } else if (interval === "weekly") {
        for (let i = 6; i >= 0; i--) {
          const endD = new Date(anchorY, anchorM - 1, anchorD - i * 7);
          const startD = new Date(anchorY, anchorM - 1, anchorD - i * 7 - 6);
          // ISO week number of the bucket's end date
          const thu = new Date(endD);
          thu.setDate(thu.getDate() - ((thu.getDay() + 6) % 7) + 3);
          const jan4 = new Date(thu.getFullYear(), 0, 4);
          const wk = 1 + Math.round(((thu - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
          b.push({ startStr: fmtD(startD), endStr: fmtD(endD), label: `W${wk}`, value: 0 });
        }
      } else {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(anchorY, anchorM - 1 - i, 1);
          const y = d.getFullYear();
          const m = d.getMonth();
          const lastDay = new Date(y, m + 1, 0).getDate();
          b.push({
            startStr: `${y}-${String(m + 1).padStart(2, "0")}-01`,
            endStr: `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
            label: MONTH_NAMES[m],
            value: 0,
          });
        }
      }
      return b;
    }

    function addToBuckets(bkts, dateStr, val) {
      if (!dateStr) return;
      if (interval === "daily") {
        const b = bkts.find((b) => b.key === dateStr);
        if (b) b.value += val;
      } else {
        const b = bkts.find((b) => dateStr >= b.startStr && dateStr <= b.endStr);
        if (b) b.value += val;
      }
    }

    // ── Revenue buckets (anchored to revenue latest date)
    // For daily: pick the last 7 dates that actually had orders (skip closed days)
    let revBuckets;
    if (interval === "daily") {
      const activeDates = new Set();
      for (const d of raw.deliveries) { const ds = getDateStr(d.order_placed); if (ds) activeDates.add(ds); }
      for (const p of raw.pos) { const ds = getDateStr(p.order_placed); if (ds) activeDates.add(ds); }
      const last7 = [...activeDates].sort().slice(-7);
      revBuckets = last7.map((key) => {
        const [y, m, d] = key.split("-").map(Number);
        return { key, label: DAY_NAMES[new Date(y, m - 1, d).getDay()], value: 0 };
      });
    } else {
      revBuckets = buildBuckets(ly, lm, ld);
    }
    for (const b of revBuckets) { b.deliveryRev = 0; b.posRev = 0; b.deliveryByPlatform = {}; }

    for (const d of raw.deliveries) {
      const ds = getDateStr(d.order_placed);
      if (!ds) continue;
      const b = interval === "daily"
        ? revBuckets.find((x) => x.key === ds)
        : revBuckets.find((x) => ds >= x.startStr && ds <= x.endStr);
      if (b) {
        const price = Number(d.price || 0);
        b.value += price;
        b.deliveryRev += price;
        const plat = (d.delivery_partner || "").toLowerCase();
        if (plat) b.deliveryByPlatform[plat] = (b.deliveryByPlatform[plat] || 0) + price;
      }
    }
    for (const p of raw.pos) {
      const ds = getDateStr(p.order_placed);
      if (!ds) continue;
      const b = interval === "daily"
        ? revBuckets.find((x) => x.key === ds)
        : revBuckets.find((x) => ds >= x.startStr && ds <= x.endStr);
      if (b) {
        const price = Number(p.price || 0);
        b.value += price;
        b.posRev += price;
      }
    }

    // ── Payout data for stacked revenue chart
    const payouts = raw.payouts || [];

    // Build daily per-platform revenue lookup from delivery data
    const dailyPlatformRev = {};
    for (const d of raw.deliveries) {
      const ds = getDateStr(d.order_placed);
      if (!ds) continue;
      const plat = (d.delivery_partner || "").toLowerCase();
      if (!plat) continue;
      if (!dailyPlatformRev[ds]) dailyPlatformRev[ds] = {};
      dailyPlatformRev[ds][plat] = (dailyPlatformRev[ds][plat] || 0) + Number(d.price || 0);
    }

    // Sum a platform's delivery revenue within a date range
    function platformRevInRange(platform, fromStr, toStr) {
      let total = 0;
      const [fy, fm, fd] = fromStr.split("-").map(Number);
      const [ty, tm, td] = toStr.split("-").map(Number);
      const endDate = new Date(ty, tm - 1, td);
      const d = new Date(fy, fm - 1, fd);
      while (d <= endDate) {
        total += (dailyPlatformRev[fmtD(d)]?.[platform] || 0);
        d.setDate(d.getDate() + 1);
      }
      return total;
    }

    function getBucketRange(b) {
      return interval === "daily"
        ? { start: b.key, end: b.key }
        : { start: b.startStr, end: b.endStr };
    }
    function payoutsForBucket(b) {
      const { start, end } = getBucketRange(b);
      return payouts.filter(
        (p) => p.period_from && p.period_to && p.period_from <= end && p.period_to >= start
      );
    }

    // Count days between two YYYY-MM-DD strings (inclusive)
    function dayCount(fromStr, toStr) {
      const [fy, fm, fd] = fromStr.split("-").map(Number);
      const [ty, tm, td] = toStr.split("-").map(Number);
      return Math.round((new Date(ty, tm - 1, td) - new Date(fy, fm - 1, fd)) / 86400000) + 1;
    }

    // Sales-weighted commission: fees are scaled by the data-available fraction of the
    // payout period, then distributed by each platform's actual revenue in the bucket.
    function proratedCommForBucket(b) {
      const { start, end } = getBucketRange(b);
      const overlapping = payoutsForBucket(b);
      let total = 0;
      for (const p of overlapping) {
        const fees = Number(p.commission_total || 0) + Number(p.ad_spend || 0) + Number(p.other_fees || 0);
        const plat = (p.platform || "").toLowerCase();
        // Clip payout end to available data range so payouts extending into the
        // future don't dump all fees onto the last day with data
        const dataEnd = p.period_to <= latestStr ? p.period_to : latestStr;
        if (dataEnd < p.period_from) continue;
        const fullDays = dayCount(p.period_from, p.period_to);
        const dataDays = dayCount(p.period_from, dataEnd);
        const scaledFees = fullDays > 0 ? fees * (dataDays / fullDays) : fees;
        // Sales-weight within the data-available portion
        const periodRev = platformRevInRange(plat, p.period_from, dataEnd);
        if (periodRev <= 0) continue;
        const oStart = start > p.period_from ? start : p.period_from;
        const oEnd = end < dataEnd ? end : dataEnd;
        if (oEnd < oStart) continue;
        const bucketRev = platformRevInRange(plat, oStart, oEnd);
        total += scaledFees * (bucketRev / periodRev);
      }
      return total;
    }

    // Per-platform average fee rate from all unique payouts overlapping the displayed periods
    const seenPK = new Set();
    const platGross = {};
    const platFees = {};
    for (const b of revBuckets) {
      for (const p of payoutsForBucket(b)) {
        const k = `${p.platform}-${p.period_from}-${p.period_to}`;
        if (seenPK.has(k)) continue;
        seenPK.add(k);
        const plat = (p.platform || "").toLowerCase();
        platGross[plat] = (platGross[plat] || 0) + Number(p.gross_sales || 0);
        platFees[plat] = (platFees[plat] || 0) + Number(p.commission_total || 0) + Number(p.ad_spend || 0) + Number(p.other_fees || 0);
      }
    }
    const totalGross = Object.values(platGross).reduce((a, v) => a + v, 0);
    const totalFeesSum = Object.values(platFees).reduce((a, v) => a + v, 0);
    const blendedFeeRate = totalGross > 0 ? totalFeesSum / totalGross : 0;

    // Compute net / commission per bucket — commission only from delivery, never POS
    for (const b of revBuckets) {
      b.value = Math.round(b.value * 100) / 100;
      b.gross = b.value;

      const bp = payoutsForBucket(b);

      // Confirmed commission from platforms with payouts (sales-weighted)
      const confirmedComm = bp.length > 0 ? proratedCommForBucket(b) : 0;

      // Walk each day in the bucket to find platform/day gaps without payout coverage
      const { start, end } = getBucketRange(b);
      const [sy, sm, sd] = start.split("-").map(Number);
      const [ey, em, ed] = end.split("-").map(Number);
      const endDate = new Date(ey, em - 1, ed);
      let estimatedComm = 0;
      let hasUncovered = false;
      for (let d = new Date(sy, sm - 1, sd); d <= endDate; d.setDate(d.getDate() + 1)) {
        const ds = fmtD(d);
        const dayPlats = dailyPlatformRev[ds];
        if (!dayPlats) continue;
        for (const plat of Object.keys(dayPlats)) {
          const covered = payouts.some(
            (p) => (p.platform || "").toLowerCase() === plat && p.period_from <= ds && p.period_to >= ds
          );
          if (!covered) {
            const rate = platGross[plat] > 0 ? platFees[plat] / platGross[plat] : blendedFeeRate;
            estimatedComm += dayPlats[plat] * rate;
            hasUncovered = true;
          }
        }
      }

      const totalComm = confirmedComm + estimatedComm;
      b.commission = Math.round(Math.min(totalComm, b.deliveryRev) * 100) / 100;
      b.net = Math.round((b.deliveryRev - b.commission + b.posRev) * 100) / 100;
      b.confirmed = !hasUncovered;
      b.commDisplay = b.confirmed
        ? `€${Math.round(b.commission).toLocaleString()}`
        : `~€${Math.round(b.commission).toLocaleString()}`;
    }

    // ── Social buckets (anchored to social latest date)
    const socialDates = raw.social.map((s) => s.stat_date).filter(Boolean);
    socialDates.sort();
    const socialLatestStr = socialDates.length > 0 ? socialDates[socialDates.length - 1] : latestStr;
    const [sy, sm, sd] = socialLatestStr.split("-").map(Number);
    const socialBuckets = buildBuckets(sy, sm, sd);
    for (const s of raw.social) {
      addToBuckets(socialBuckets, s.stat_date, Number(s.total_reach || 0));
    }
    for (const b of socialBuckets) b.value = Math.round(b.value);

    // ── Top dishes — use the revenue buckets' date range
    const rangeStart = interval === "daily" ? revBuckets[0].key : revBuckets[0].startStr;
    const rangeEnd = interval === "daily"
      ? revBuckets[revBuckets.length - 1].key
      : revBuckets[revBuckets.length - 1].endStr;

    const dishCount = {};
    for (const d of raw.deliveries) {
      const ds = getDateStr(d.order_placed);
      if (ds < rangeStart || ds > rangeEnd) continue;
      if (!d.items) continue;
      const tokens = d.items.split(",").map((t) => t.trim()).filter(Boolean);
      for (const token of tokens) {
        const match = token.match(/^(\d+)\s+(.+)$/);
        if (match) {
          const name = match[2].trim();
          // Skip unit-only tokens like "330 ml", "500 ml" etc.
          if (/^(ml|g|kg|cl|l|oz|pcs)$/i.test(name)) continue;
          const qty = parseInt(match[1], 10);
          dishCount[name] = (dishCount[name] || 0) + qty;
        }
      }
    }
    const topDishes = Object.entries(dishCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Period labels
    let periodLabel;
    if (interval === "daily") periodLabel = "Last 7 days";
    else if (interval === "weekly") periodLabel = "Last 7 weeks";
    else periodLabel = "Last 7 months";

    return { revBuckets, socialBuckets, topDishes, latestStr, socialLatestStr, periodLabel };
  }, [raw, interval]);

  // ── Reviews (always latest, not interval-filtered) ──────────────────────
  const reviews = useMemo(() => {
    if (!raw) return [];
    let list = raw.reviews;
    if (commentOnly) list = list.filter((r) => r.review_text?.trim());
    return list.slice(0, 5);
  }, [raw, commentOnly]);

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonBlock className="h-3 w-64 mb-1" />
        <SkeletonBlock className="h-3 w-40 mb-4" />
        <div className="border-t border-neutral-800" />
        <SkeletonBlock className="h-8 w-72 mb-1" />
        <SkeletonBlock className="h-4 w-96" />
        <div className="flex gap-1">
          <SkeletonBlock className="h-9 w-20 rounded-full" />
          <SkeletonBlock className="h-9 w-20 rounded-full" />
          <SkeletonBlock className="h-9 w-24 rounded-full" />
        </div>
        <SkeletonBlock className="h-[160px] md:h-[220px] rounded-2xl" />
        <SkeletonBlock className="h-[160px] md:h-[220px] rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonBlock className="h-56 rounded-2xl" />
          <SkeletonBlock className="h-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!chartData) return null;

  const fullDate = cyprusNow.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Nicosia",
  });

  return (
    <div className="space-y-6">
      {/* ── Greeting ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[18px] md:text-2xl font-bold text-white tracking-tight">
          {greeting}, {firstName}
        </h1>
        {quote && (
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-emerald-500 font-serif leading-none" style={{ fontSize: 18, opacity: 0.35 }}>&ldquo;</span>
            <p className="text-neutral-500 italic text-[11px] md:text-xs">
              {quote.text} <span className="text-neutral-600 not-italic">&mdash; {quote.author}</span>
            </p>
          </div>
        )}
      </div>

      {/* ── Interval toggle ───────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-neutral-900 p-1 rounded-full w-fit border border-neutral-800">
        {["daily", "weekly", "monthly"].map((v) => (
          <button
            key={v}
            onClick={() => setInterval(v)}
            className={`px-3 md:px-4 py-1.5 text-[11px] md:text-xs font-medium rounded-full transition-colors capitalize ${
              interval === v
                ? "bg-emerald-500 text-white"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* ── Section 1: Revenue chart (stacked) ──────────────────────────── */}
      <div className="bg-neutral-900 p-3.5 md:p-6 rounded-2xl border border-neutral-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Revenue
        </h3>
        <p className="text-[11px] text-neutral-600 mt-0.5 mb-4">
          {chartData.periodLabel} &middot; up to{" "}
          {formatShortDate(chartData.latestStr)}
        </p>
        <div className="h-[160px] md:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData.revBuckets}
              margin={{ top: 28, right: 4, bottom: 0, left: 4 }}
            >
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#737373", fontSize: 11 }}
              />
              <YAxis hide />
              <Bar
                dataKey="net"
                stackId="rev"
                shape={<NetBarShape />}
                label={<RevNetLabels />}
              />
              <Bar
                dataKey="commission"
                stackId="rev"
                shape={<CommBarShape />}
              >
                <LabelList dataKey="commDisplay" content={<RevCommLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-[10px] md:text-xs text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#1D9E75]" />
            Net payout
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#A32D2D]" />
            Commission (confirmed)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[rgba(163,45,45,0.2)] border border-dashed border-[#A32D2D]" />
            Commission (estimated)
          </span>
        </div>
      </div>

      {/* ── Section 2: Social media reach chart ───────────────────────────── */}
      <div className="bg-neutral-900 p-3.5 md:p-6 rounded-2xl border border-neutral-800">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Social media reach
        </h3>
        <p className="text-[11px] text-neutral-600 mt-0.5 mb-4">
          {chartData.periodLabel} &middot; up to{" "}
          {formatShortDate(chartData.socialLatestStr)}
        </p>
        <div className="h-[160px] md:h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData.socialBuckets}
              margin={{ top: 28, right: 4, bottom: 0, left: 4 }}
            >
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#737373", fontSize: 11 }}
              />
              <YAxis hide />
              <Bar
                dataKey="value"
                fill="#1D9E75"
                radius={[4, 4, 0, 0]}
                label={<ReachLabel />}
                minPointSize={2}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Section 3: Two-column grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Top dishes */}
        <div className="bg-neutral-900 p-3.5 md:p-6 rounded-2xl border border-neutral-800">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Top dishes
          </h3>
          <p className="text-[11px] text-neutral-600 mt-0.5 mb-4">
            {chartData.periodLabel}
          </p>
          {chartData.topDishes.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">
              No dish data available
            </p>
          ) : (
            <div className="space-y-2.5">
              {chartData.topDishes.map((dish, i) => {
                const maxCount = chartData.topDishes[0]?.count || 1;
                const widthPct = (dish.count / maxCount) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-neutral-600 w-4 shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-neutral-300 truncate flex-1 min-w-0">
                      {dish.name}
                    </span>
                    <div className="w-16 md:w-20 h-1.5 bg-neutral-800 rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-400 w-8 text-right shrink-0">
                      {dish.count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Latest reviews */}
        <div className="bg-neutral-900 p-3.5 md:p-6 rounded-2xl border border-neutral-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Latest reviews
            </h3>
            <button
              onClick={() => setCommentOnly(!commentOnly)}
              className={`text-[10px] md:text-xs px-2.5 py-1 rounded-full border transition-colors ${
                commentOnly
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "border-neutral-700 text-neutral-500 hover:text-neutral-300"
              }`}
            >
              With comment only
            </button>
          </div>
          {reviews.length === 0 ? (
            <p className="text-sm text-neutral-500 italic">No reviews found</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((review, i) => {
                const platform = (
                  review.source_platform || ""
                ).toLowerCase();
                const badgeClass =
                  PLATFORM_BADGE[platform] ||
                  "bg-neutral-700/50 text-neutral-400";
                return (
                  <div
                    key={i}
                    className={`${i > 0 ? "border-t border-neutral-800 pt-3" : ""}`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={12}
                            className={
                              s <= review.rating
                                ? "text-yellow-500"
                                : "text-neutral-700"
                            }
                            fill={
                              s <= review.rating ? "currentColor" : "none"
                            }
                          />
                        ))}
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeClass}`}
                      >
                        {review.source_platform}
                      </span>
                      <span className="text-[10px] text-neutral-600">
                        {formatShortDate(review.review_date)}
                      </span>
                    </div>
                    {review.review_text?.trim() ? (
                      <p className="text-xs text-neutral-400 line-clamp-2">
                        {review.review_text}
                      </p>
                    ) : (
                      <p className="text-xs text-neutral-600 italic">
                        No comment left
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
