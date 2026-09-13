"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, TriangleAlert, CircleAlert } from "lucide-react";
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
  PLATFORM,
} from "../../components/ui";
import {
  euro,
  euro2,
  eachDay,
  fetchAllRows,
  num,
  parseDay,
  parseItems,
  pctChange,
  rangeTitle,
  signedPct,
  sparkPath,
} from "../../lib/format";
import { SOURCE_IDS, dayOf } from "../../lib/salesModel";
import { buildMenuMatcher, buildPriceLookup } from "../../lib/menuMatch";

/** The repo's own category order and colours, on the v2 palette. */
const CATEGORIES = [
  { name: "Fried Chicken Combos", short: "Chicken", color: "#171717" },
  { name: "Burger & Wrap Combos", short: "Burgers", color: "#0070f3" },
  { name: "Products", short: "Products", color: "#7928ca" },
  { name: "Sides", short: "Sides", color: "#f5a623" },
  { name: "Dips", short: "Dips", color: "#50e3c2" },
  { name: "Drinks", short: "Drinks", color: "#8f8f8f" },
];
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.name, c]));

/** Sides, dips and drinks are the attach; everything else is the main. */
const MAIN_CATEGORIES = new Set(["Fried Chicken Combos", "Burger & Wrap Combos", "Products"]);

const CHANNELS = [
  { id: "all", label: "All" },
  { id: "wolt", label: "Wolt" },
  { id: "foody", label: "Foody" },
  { id: "bolt", label: "Bolt" },
  { id: "pos", label: "POS" },
];

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name),
  qty: (a, b) => a.qty - b.qty,
  revenue: (a, b) => a.revenue - b.revenue,
  delta: (a, b) => (a.delta ?? -Infinity) - (b.delta ?? -Infinity),
};

export default function ProductsPage() {
  const range = useRange();
  const rangeKey = `${range.from}|${range.to}`;
  const [store, setStore] = useState({ key: null, raw: null, failure: null });
  const loading = store.key !== rangeKey;
  const raw = loading ? null : store.raw;
  const failure = loading ? null : store.failure;

  const [offCats, setOffCats] = useState({});
  const [channel, setChannel] = useState("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("revenue");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const windowFrom = range.previous.from;
      const until = `${range.to}T23:59:59.999`;
      try {
        const [menuItems, priceHistory, deliveries, pos] = await Promise.all([
          fetchAllRows(supabase, "menu_items", "*", []),
          fetchAllRows(
            supabase,
            "menu_item_price_history",
            "canonical_name, platform, price, valid_from, valid_to",
            []
          ),
          fetchAllRows(
            supabase,
            "delivery_purchases",
            "order_placed, items, delivery_status, delivery_partner",
            [
              { op: "gte", col: "order_placed", val: windowFrom },
              { op: "lte", col: "order_placed", val: until },
            ]
          ),
          fetchAllRows(supabase, "pos_sales", "order_placed, items", [
            { op: "gte", col: "order_placed", val: windowFrom },
            { op: "lte", col: "order_placed", val: until },
          ]),
        ]);
        if (cancelled) return;
        setStore({
          key: rangeKey,
          raw: { menuItems, priceHistory, deliveries, pos },
          failure: null,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Products fetch failed:", err);
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

    const match = buildMenuMatcher(raw.menuItems);
    const priceOn = buildPriceLookup(raw.priceHistory);
    const days = eachDay(range.from, range.to);
    const dayIndex = Object.fromEntries(days.map((d, i) => [d, i]));

    // One row per menu item, filled by walking every order line in the window.
    const stats = new Map();
    const touch = (item) => {
      if (!stats.has(item.canonical_name)) {
        stats.set(item.canonical_name, {
          item,
          name: item.canonical_name,
          category: item.category || "Products",
          qty: 0,
          prevQty: 0,
          revenue: 0,
          prevRevenue: 0,
          byChannel: { wolt: 0, foody: 0, bolt: 0, pos: 0 },
          daily: days.map(() => 0),
        });
      }
      return stats.get(item.canonical_name);
    };

    const unmatched = new Map();

    // Orders, so items-per-order and attach rate have a denominator.
    let ordersNow = 0;
    let ordersBefore = 0;

    const walk = (rows, platformOf) => {
      for (const row of rows) {
        const day = dayOf(row.order_placed);
        if (!day) continue;
        const inNow = day >= range.from && day <= range.to;
        const inPrev = day >= range.previous.from && day <= range.previous.to;
        if (!inNow && !inPrev) continue;

        const platform = platformOf(row);
        if (!platform) continue;
        if (channel !== "all" && platform !== channel) continue;

        if (inNow) ordersNow += 1;
        else ordersBefore += 1;

        for (const { qty, name } of parseItems(row.items)) {
          const item = match(platform, name);
          if (!item) {
            // No menu item answers to this name on this platform, so there is
            // no row to put it in — but dropping it silently is how a missing
            // alias turns into a dish that looks like it never sold. Keep it
            // and show it.
            if (inNow) {
              const key = `${platform}\u0000${name}`;
              const seen = unmatched.get(key);
              if (seen) seen.qty += qty;
              else unmatched.set(key, { platform, name, qty });
            }
            continue;
          }
          const row2 = touch(item);
          const value = qty * priceOn(item, platform, day);
          if (inNow) {
            row2.qty += qty;
            row2.revenue += value;
            row2.byChannel[platform] += qty;
            row2.daily[dayIndex[day]] += qty;
          } else {
            row2.prevQty += qty;
            row2.prevRevenue += value;
          }
        }
      }
    };

    walk(
      raw.deliveries.filter((d) => (d.delivery_status || "").toLowerCase() === "delivered"),
      (d) => {
        const p = (d.delivery_partner || "").toLowerCase();
        return SOURCE_IDS.includes(p) ? p : null;
      }
    );
    walk(raw.pos, () => "pos");

    // Every active item appears, even one that sold nothing — a dish quietly
    // selling zero is the single most useful row on this screen.
    for (const item of raw.menuItems) {
      if (item.is_active) touch(item);
    }

    const unmatchedRows = [...unmatched.values()].sort((a, b) => b.qty - a.qty);
    const unmatchedUnits = unmatchedRows.reduce((a, r) => a + r.qty, 0);

    const allRows = [...stats.values()].map((r) => ({
      ...r,
      delta: r.prevQty > 0 ? pctChange(r.qty, r.prevQty) : null,
    }));

    const catOn = (name) => !offCats[name];
    const visible = allRows.filter((r) => catOn(r.category));

    const q = query.trim().toLowerCase();
    const searched = visible.filter((r) => !q || r.name.toLowerCase().includes(q));

    const sorted = [...searched].sort((a, b) => {
      const cmp = (SORTS[sortKey] ?? SORTS.revenue)(a, b);
      return sortDir === "asc" ? cmp : -cmp;
    });

    // ── Totals.
    const itemsSold = visible.reduce((a, r) => a + r.qty, 0);
    const prevItemsSold = visible.reduce((a, r) => a + r.prevQty, 0);
    const itemRevenue = visible.reduce((a, r) => a + r.revenue, 0);
    const prevItemRevenue = visible.reduce((a, r) => a + r.prevRevenue, 0);

    const mains = visible.filter((r) => MAIN_CATEGORIES.has(r.category));
    const mainQty = mains.reduce((a, r) => a + r.qty, 0);
    const prevMainQty = mains.reduce((a, r) => a + r.prevQty, 0);
    const attach = mainQty > 0 ? (itemsSold - mainQty) / mainQty : 0;
    const prevAttach = prevMainQty > 0 ? (prevItemsSold - prevMainQty) / prevMainQty : 0;

    const perOrder = ordersNow > 0 ? itemsSold / ordersNow : 0;
    const prevPerOrder = ordersBefore > 0 ? prevItemsSold / ordersBefore : 0;

    const dailyItems = days.map((_, i) => visible.reduce((a, r) => a + r.daily[i], 0));

    // ── Categories.
    const catAgg = CATEGORIES.map((c) => {
      const rows = visible.filter((r) => r.category === c.name);
      return {
        ...c,
        qty: rows.reduce((a, r) => a + r.qty, 0),
        revenue: rows.reduce((a, r) => a + r.revenue, 0),
      };
    })
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
    const catTotal = catAgg.reduce((a, c) => a + c.revenue, 0) || 1;
    const catRows = catAgg.map((c) => ({ ...c, share: (c.revenue / catTotal) * 100 }));

    // ── Movers. A small base makes a big percentage out of nothing, so only
    // items with real volume are eligible.
    const movable = visible.filter((r) => r.qty >= 20 && r.delta != null);
    const byDelta = [...movable].sort((a, b) => b.delta - a.delta);
    const gaining = byDelta.filter((r) => r.delta > 0).slice(0, 3);
    const slipping = byDelta.filter((r) => r.delta < 0).slice(-3).reverse();

    const dead = visible.filter((r) => r.qty === 0);
    const maxRevenue = Math.max(1, ...visible.map((r) => r.revenue));

    const chips = CATEGORIES.map((c) => ({
      ...c,
      on: catOn(c.name),
      count: allRows.filter((r) => r.category === c.name).length,
    })).filter((c) => c.count > 0);

    const activeCount = raw.menuItems.filter((m) => m.is_active).length;

    return {
      rows: sorted,
      itemsSold,
      prevItemsSold,
      itemRevenue,
      prevItemRevenue,
      attach,
      prevAttach,
      perOrder,
      prevPerOrder,
      dailyItems,
      catRows,
      gaining,
      slipping,
      dead,
      maxRevenue,
      chips,
      activeCount,
      unmatchedRows,
      unmatchedUnits,
      matchedNone: itemsSold === 0 && ordersNow > 0,
      isEmpty: ordersNow === 0,
    };
  }, [raw, range.from, range.to, range.previous.from, range.previous.to, offCats, channel, query, sortKey, sortDir]);

  if (failure) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Products" sub={rangeTitle(range.from, range.to)} />
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
    return <LoadingState kpis={4} shape="list" line="MATCHING ORDER LINES TO MENU ITEMS" />;
  }

  const header = (
    <PageHeader
      title="Products"
      sub={`${rangeTitle(range.from, range.to)} · ${model.activeCount} active menu items · compared with the ${range.days} days before`}
    />
  );

  if (model.isEmpty) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        {header}
        <EmptyState
          title={`No items sold between ${rangeTitle(range.from, range.to)}`}
          body="Not a single menu item moved in this range. If that looks wrong, the order import may not have caught up yet."
          action="Jump to the last 28 days"
          onAction={() => range.setRange("28d")}
        />
      </div>
    );
  }

  const sortArrow = (key) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const cols =
    "grid-cols-[minmax(0,1fr)_46px_66px_46px] md:grid-cols-[22px_minmax(0,1.5fr)_78px_84px_60px_78px_62px]";

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}

      {/* Category chips + channel */}
      <div className="flex flex-wrap items-center gap-2">
        {model.chips.map((c) => (
          <button
            key={c.name}
            onClick={() => setOffCats((o) => ({ ...o, [c.name]: !o[c.name] }))}
            className={`flex items-center gap-[7px] h-8 px-[11px] rounded-lg border text-[13px] whitespace-nowrap ${
              c.on
                ? "border-ink-strong bg-surface text-ink"
                : "border-line bg-wash-light text-subtle"
            }`}
          >
            <span
              className="w-2 h-2 rounded-[2px] shrink-0"
              style={{ background: c.on ? c.color : "#e5e5e5" }}
            />
            {c.short}
            <span className={`font-mono text-[11px] ${c.on ? "text-subtle" : "text-faint"}`}>
              {c.count}
            </span>
          </button>
        ))}
        <div className="flex-1 min-w-1" />
        <Segmented options={CHANNELS} value={channel} onChange={setChannel} />
      </div>

      {model.matchedNone && (
        <div className="flex items-start gap-2.5 px-4 py-3 border border-line rounded-xl bg-wash-light">
          <CircleAlert size={14} strokeWidth={2} className="text-warn shrink-0 mt-0.5" />
          <p className="text-[12px] text-muted text-pretty">
            Orders were found but none of their lines matched a menu item. That usually
            means the per-platform names on{" "}
            <Link href="/menu" className="text-accent font-medium">
              Menu
            </Link>{" "}
            are missing or out of date for this channel.
          </p>
        </div>
      )}

      {model.unmatchedUnits > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 border border-line rounded-[10px] bg-wash-light">
          <CircleAlert size={15} strokeWidth={2} className="text-warn-ink shrink-0 mt-px" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-pretty">
              {model.unmatchedUnits} item{model.unmatchedUnits === 1 ? "" : "s"} sold under
              a name no menu entry answers to, so {model.unmatchedUnits === 1 ? "it is" : "they are"}{" "}
              missing from every figure here. Add the spelling to that dish&rsquo;s platform
              name in Menu and {model.unmatchedUnits === 1 ? "it" : "they"} will come back.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {model.unmatchedRows.slice(0, 6).map((u) => (
                <span key={`${u.platform}-${u.name}`} className="font-mono text-[11px] text-subtle">
                  {u.qty}× {PLATFORM[u.platform]?.name ?? u.platform} · {u.name}
                </span>
              ))}
              {model.unmatchedRows.length > 6 && (
                <span className="font-mono text-[11px] text-faint">
                  +{model.unmatchedRows.length - 6} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KpiCard
          label="ITEMS SOLD"
          value={num(model.itemsSold)}
          sub="line items across all orders"
          delta={pctChange(model.itemsSold, model.prevItemsSold)}
          series={model.dailyItems}
        />
        <KpiCard
          label="ITEM REVENUE"
          value={euro(model.itemRevenue)}
          sub="at menu price, before fees"
          delta={pctChange(model.itemRevenue, model.prevItemRevenue)}
          series={model.dailyItems}
        />
        <KpiCard
          label="ATTACH RATE"
          value={model.attach.toFixed(2)}
          sub="sides, dips and drinks per main"
          delta={pctChange(model.attach, model.prevAttach)}
          series={model.dailyItems}
        />
        <KpiCard
          label="ITEMS PER ORDER"
          value={model.perOrder.toFixed(1)}
          sub={
            model.prevPerOrder > 0
              ? `was ${model.prevPerOrder.toFixed(1)} last period`
              : "no comparable period before"
          }
          delta={pctChange(model.perOrder, model.prevPerOrder)}
          series={model.dailyItems}
        />
      </div>

      {/* Categories + movers */}
      <div className="grid gap-3 items-start md:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <Card className="px-4 py-3.5">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Where the menu earns</h2>
          <p className="mt-[3px] mb-3.5 text-[12px] text-subtle">
            Share of item revenue by category
          </p>
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            {model.catRows.map((c) => (
              <div key={c.name} style={{ width: `${c.share}%`, background: c.color }} />
            ))}
          </div>
          <div className="flex flex-col gap-2.5 mt-3.5">
            {model.catRows.map((c) => (
              <div key={c.name} className="flex items-center gap-2.5">
                <span
                  className="w-2 h-2 rounded-[2px] shrink-0"
                  style={{ background: c.color }}
                />
                <span className="text-[13px] flex-1 min-w-0 truncate">{c.name}</span>
                <span className="font-mono text-[12px] text-subtle hidden sm:inline">
                  {num(c.qty)} sold
                </span>
                <span className="font-mono text-[12px] tabular-nums w-[64px] text-right">
                  {euro(c.revenue)}
                </span>
                <span className="font-mono text-[12px] text-subtle w-8 text-right">
                  {Math.round(c.share)}%
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Movers"
            sub="Items selling 20+ units, against the period before"
          />
          {[
            ["GAINING", model.gaining, "Nothing gaining in this selection"],
            ["SLIPPING", model.slipping, "Nothing slipping in this selection"],
          ].map(([label, rows, emptyText]) => (
            <div key={label}>
              <div className="px-4 pt-2.5 pb-1 font-mono text-[10px] tracking-[0.06em] text-subtle">
                {label}
              </div>
              {rows.length === 0 && (
                <div className="px-4 py-[7px] text-[13px] text-faint">{emptyText}</div>
              )}
              {rows.map((r) => (
                <div key={r.name} className="px-4 py-[7px] flex items-center gap-2.5">
                  <span
                    className="w-2 h-2 rounded-[2px] shrink-0"
                    style={{ background: CAT[r.category]?.color ?? "#8f8f8f" }}
                  />
                  <span className="text-[13px] flex-1 min-w-0 truncate">{r.name}</span>
                  <span className="font-mono text-[12px] text-subtle">{num(r.qty)}</span>
                  <span
                    className="font-mono text-[12px] w-11 text-right"
                    style={{
                      color: r.delta >= 0 ? "var(--color-accent)" : "var(--color-danger)",
                    }}
                  >
                    {signedPct(r.delta, 0)}
                  </span>
                </div>
              ))}
            </div>
          ))}
          <div className="h-2.5" />
        </Card>
      </div>

      {/* Every item */}
      <Card>
        <div className="px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Every item</h2>
            <p className="mt-[3px] text-[12px] text-subtle">
              Sort by any column · {range.days}-day shape per item
            </p>
          </div>
          <div className="flex items-center gap-2 h-8 px-2.5 border border-line rounded-lg bg-surface min-w-[180px]">
            <Search size={14} strokeWidth={2} className="text-subtle shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an item"
              className="flex-1 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-faint"
            />
          </div>
        </div>

        <div
          className={`grid gap-2 px-4 pb-2 font-mono text-[11px] tracking-[0.05em] text-muted ${cols}`}
        >
          <span className="hidden md:block" />
          <button onClick={() => toggleSort("name")} className="text-left hover:text-ink">
            ITEM{sortArrow("name")}
          </button>
          <span className="hidden md:block text-center">{range.days} DAYS</span>
          <span className="hidden md:block">CHANNEL MIX</span>
          <button onClick={() => toggleSort("qty")} className="text-right hover:text-ink">
            SOLD{sortArrow("qty")}
          </button>
          <button onClick={() => toggleSort("revenue")} className="text-right hover:text-ink">
            <span className="hidden md:inline">REVENUE</span>
            <span className="md:hidden">REV</span>
            {sortArrow("revenue")}
          </button>
          <button onClick={() => toggleSort("delta")} className="text-right hover:text-ink">
            <span className="hidden md:inline">VS PREV</span>
            <span className="md:hidden">Δ</span>
            {sortArrow("delta")}
          </button>
        </div>

        {model.rows.length === 0 && (
          <p className="px-4 py-6 border-t border-line text-[13px] text-muted text-center">
            Nothing matches these filters.
          </p>
        )}

        {model.rows.map((r, i) => {
          const cat = CAT[r.category] ?? { short: r.category, color: "#8f8f8f" };
          const spark = sparkPath(r.qty > 0 ? r.daily : [0, 0], 72, 20);
          const mixTotal = SOURCE_IDS.reduce((a, id) => a + r.byChannel[id], 0);
          return (
            <div
              key={r.name}
              className={`grid gap-2 px-4 py-2.5 border-t border-line items-center hover:bg-wash-light ${cols}`}
            >
              <span className="hidden md:block font-mono text-[11px] text-muted">{i + 1}</span>
              <div className="min-w-0 flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-[2px] shrink-0"
                  style={{ background: cat.color }}
                />
                <div className="min-w-0">
                  <div className="text-[13px] truncate">{r.name}</div>
                  <div className="font-mono text-[11px] text-subtle truncate">
                    {cat.short} · {euro2(r.item.pos_price ?? 0)}
                  </div>
                </div>
              </div>
              <svg
                viewBox="0 0 72 20"
                preserveAspectRatio="none"
                className="hidden md:block w-full h-5"
              >
                <polyline
                  points={spark.line}
                  fill="none"
                  stroke={r.qty > 0 ? "var(--color-ink-strong)" : "#e5e5e5"}
                  strokeWidth={1.25}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="hidden md:flex h-1.5 rounded-full overflow-hidden gap-px">
                {mixTotal === 0 ? (
                  <div className="flex-1 bg-wash" />
                ) : (
                  SOURCE_IDS.filter((id) => r.byChannel[id] > 0).map((id) => (
                    <div
                      key={id}
                      style={{
                        width: `${(r.byChannel[id] / mixTotal) * 100}%`,
                        background: PLATFORM[id].color,
                      }}
                    />
                  ))
                )}
              </div>
              <span className="font-mono text-[12px] tabular-nums text-right">
                {num(r.qty)}
              </span>
              <span className="font-mono text-[12px] tabular-nums text-right">
                {euro(r.revenue)}
              </span>
              <span
                className="font-mono text-[12px] tabular-nums text-right"
                style={{
                  color:
                    r.delta == null
                      ? "var(--color-subtle)"
                      : r.delta >= 0
                        ? "var(--color-accent)"
                        : "var(--color-danger)",
                }}
              >
                {r.delta == null ? (r.qty > 0 ? "new" : "—") : signedPct(r.delta, 0)}
              </span>
            </div>
          );
        })}

        <div className="px-4 py-3 border-t border-line bg-wash-light flex items-center gap-2.5 flex-wrap">
          <CircleAlert size={14} strokeWidth={2} className="text-warn shrink-0" />
          <span className="text-[12px] text-muted flex-1 min-w-0 text-pretty">
            {model.dead.length === 0
              ? "Every item on the menu sold at least once."
              : `${model.dead.length} item${model.dead.length > 1 ? "s" : ""} sold nothing in ${range.days} days: ${model.dead
                  .map((d) => d.name)
                  .slice(0, 6)
                  .join(", ")}${model.dead.length > 6 ? `, and ${model.dead.length - 6} more` : ""}`}
          </span>
          <Link href="/menu" className="text-[12px] font-medium text-accent whitespace-nowrap">
            Review menu
          </Link>
        </div>
      </Card>
    </div>
  );
}
