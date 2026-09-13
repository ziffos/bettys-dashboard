"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, CircleAlert, FileText, TriangleAlert } from "lucide-react";
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
  MONTHS,
  euro,
  eachDay,
  fetchAllRows,
  fmtDay,
  parseDay,
  pctChange,
  rangeTitle,
} from "../../lib/format";
import { buildSalesModel, feesOf } from "../../lib/salesModel";

const PLATFORMS = ["wolt", "foody", "bolt"];

/**
 * The four things a platform takes. The design showed three; customer
 * deductions are their own line on the statements and belong beside the rest
 * rather than folded into "other".
 */
const FEE_PARTS = [
  { key: "commission_total", label: "Commission", color: "#171717" },
  { key: "ad_spend", label: "Ad spend", color: "#f5a623" },
  { key: "customer_deductions", label: "Customer deductions", color: "#7928ca" },
  { key: "other_fees", label: "Other fees", color: "#d4d4d4" },
];

/** How far the platform's own gross may drift from our order log before it matters. */
const CHECK_TOLERANCE = 0.02;

/** The trend needs more than a week of statements to say anything. */
const TREND_STATEMENTS = 12;

const MODES = [
  { id: "fee", label: "Fee %" },
  { id: "net", label: "Net payout" },
];

const periodLabel = (from, to) => {
  const a = parseDay(from);
  const b = parseDay(to);
  const left = `${a.getDate()}${a.getMonth() === b.getMonth() ? "" : ` ${MONTHS[a.getMonth()]}`}`;
  return `${left} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
};

export default function PayoutsPage() {
  const range = useRange();
  const rangeKey = `${range.from}|${range.to}`;
  const [store, setStore] = useState({ key: null, raw: null, failure: null });
  const loading = store.key !== rangeKey;
  const raw = loading ? null : store.raw;
  const failure = loading ? null : store.failure;

  const [platform, setPlatform] = useState("all");
  const [mode, setMode] = useState("fee");
  const [open, setOpen] = useState({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // The trend looks back further than the range picker, so the window has
      // to cover it. Roughly a statement a week per platform.
      const trendFrom = fmtDay(
        new Date(parseDay(range.from).getTime() - TREND_STATEMENTS * 7 * 86400000)
      );
      const until = `${range.to}T23:59:59.999`;
      try {
        const [payouts, deliveries] = await Promise.all([
          fetchAllRows(
            supabase,
            "platform_payouts",
            "id, platform, period_from, period_to, gross_sales, commission_total, ad_spend, other_fees, customer_deductions, net_payout, invoice_number, notes",
            [
              { op: "gte", col: "period_to", val: trendFrom },
              { op: "lte", col: "period_from", val: range.to },
            ]
          ),
          fetchAllRows(
            supabase,
            "delivery_purchases",
            "order_placed, price, delivery_status, delivery_partner",
            [
              { op: "gte", col: "order_placed", val: trendFrom },
              { op: "lte", col: "order_placed", val: until },
            ]
          ),
        ]);
        if (cancelled) return;
        setStore({ key: rangeKey, raw: { payouts, deliveries }, failure: null });
      } catch (err) {
        if (cancelled) return;
        console.error("Payouts fetch failed:", err);
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
  }, [rangeKey, range.from, range.to]);

  const model = useMemo(() => {
    if (!raw) return null;

    const sales = buildSalesModel({ deliveries: raw.deliveries, pos: [], payouts: [] });

    const statements = raw.payouts
      .filter((p) => p.period_from && p.period_to)
      .map((p) => {
        const id = (p.platform || "").toLowerCase();
        const fees = feesOf(p);
        const reported = Number(p.gross_sales || 0);
        // What our own orders say the platform handled over the same days.
        const ours = eachDay(p.period_from, p.period_to).reduce(
          (a, day) => a + sales.revOn(day, id),
          0
        );
        const variance = ours > 0 ? (reported - ours) / ours : 0;
        return {
          id: p.id,
          platform: id,
          name: PLATFORM[id]?.name ?? id,
          color: PLATFORM[id]?.color ?? "#8f8f8f",
          from: p.period_from,
          to: p.period_to,
          days: eachDay(p.period_from, p.period_to).length,
          label: periodLabel(p.period_from, p.period_to),
          reported,
          ours,
          variance,
          flagged: ours > 0 && Math.abs(variance) > CHECK_TOLERANCE,
          fees,
          // Trust the platform's own net when it gives one; it is the figure
          // that actually hit the bank.
          net: p.net_payout != null ? Number(p.net_payout) : reported - fees,
          feePct: reported > 0 ? (fees / reported) * 100 : 0,
          parts: FEE_PARTS.map((part) => ({
            ...part,
            value: Number(p[part.key] || 0),
          })).filter((part) => part.value > 0),
          invoice: p.invoice_number,
          notes: p.notes,
        };
      })
      .sort((a, b) => b.to.localeCompare(a.to) || a.platform.localeCompare(b.platform));

    const overlapsRange = (s) => s.from <= range.to && s.to >= range.from;
    const byPlatform = (s) => platform === "all" || s.platform === platform;

    const inRange = statements.filter(overlapsRange).filter(byPlatform);

    const sum = (list, pick) => list.reduce((a, s) => a + pick(s), 0);
    const gross = sum(inRange, (s) => s.reported);
    const fees = sum(inRange, (s) => s.fees);
    const net = sum(inRange, (s) => s.net);
    const feePct = gross > 0 ? (fees / gross) * 100 : 0;

    // The equivalent span before, for the KPI deltas.
    const beforeRange = statements
      .filter((s) => s.from <= range.previous.to && s.to >= range.previous.from)
      .filter(byPlatform);
    const prevGross = sum(beforeRange, (s) => s.reported);
    const prevFees = sum(beforeRange, (s) => s.fees);
    const prevNet = sum(beforeRange, (s) => s.net);
    const prevFeePct = prevGross > 0 ? (prevFees / prevGross) * 100 : 0;

    // ── Trend: the most recent statements per platform, oldest first.
    const lines = PLATFORMS.filter((id) => platform === "all" || platform === id).map(
      (id) => {
        const list = statements
          .filter((s) => s.platform === id)
          .slice(0, TREND_STATEMENTS)
          .reverse();
        return {
          id,
          name: PLATFORM[id].name,
          color: PLATFORM[id].color,
          points: list.map((s) => ({
            label: s.label,
            to: s.to,
            value: mode === "fee" ? s.feePct : s.net,
          })),
        };
      }
    );
    const allValues = lines.flatMap((l) => l.points.map((p) => p.value));
    const lo =
      mode === "fee"
        ? Math.max(0, Math.floor(Math.min(...allValues, 100) / 5) * 5 - 5)
        : 0;
    const hi =
      allValues.length > 0
        ? mode === "fee"
          ? Math.ceil(Math.max(...allValues) / 5) * 5
          : Math.max(...allValues) * 1.1
        : 1;
    const steps = Math.max(...lines.map((l) => l.points.length), 2);

    const flagged = inRange.filter((s) => s.flagged);

    return {
      statements,
      inRange,
      gross,
      fees,
      net,
      feePct,
      prevGross,
      prevFees,
      prevNet,
      prevFeePct,
      hasPrevious: beforeRange.length > 0,
      lines,
      lo,
      hi,
      steps,
      flagged,
      series: inRange.map((s) => s.net).reverse(),
      isEmpty: inRange.length === 0,
    };
  }, [raw, range.from, range.to, range.previous.from, range.previous.to, platform, mode]);

  if (failure) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Platform payouts" sub={rangeTitle(range.from, range.to)} />
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
    return <LoadingState kpis={4} shape="list" line="LOADING PAYOUT STATEMENTS · 3 PLATFORMS" />;
  }

  const platformOptions = [
    { id: "all", label: "All" },
    ...PLATFORMS.map((id) => ({ id, label: PLATFORM[id].name })),
  ];

  const header = (
    <PageHeader
      title="Platform payouts"
      sub={`${rangeTitle(range.from, range.to)} · what Wolt, Foody and Bolt kept, and what reached the bank`}
    />
  );

  if (model.isEmpty) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        {header}
        <div className="flex flex-wrap items-center gap-2">
          <Segmented options={platformOptions} value={platform} onChange={setPlatform} />
        </div>
        <EmptyState
          icon={FileText}
          title="No statements cover this period"
          body="Wolt and Bolt settle roughly weekly and Foody less predictably, so a short or very recent window often has nothing issued against it yet."
          action="Jump to the last 28 days"
          onAction={() => range.setRange("28d")}
        />
      </div>
    );
  }

  const cols =
    "grid-cols-[minmax(0,1fr)_80px_30px] md:grid-cols-[minmax(0,1.4fr)_84px_84px_80px_52px_88px_56px_30px]";

  const xOf = (i, n) => (n <= 1 ? 0 : (i / (n - 1)) * 320);
  const yOf = (v) => 140 - ((v - model.lo) / (model.hi - model.lo || 1)) * 140;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}

      {model.flagged.length > 0 && (
        <div className="flex items-start gap-2.5 px-4 py-3 border border-line rounded-[10px] bg-wash-light">
          <CircleAlert size={15} strokeWidth={2} className="text-danger shrink-0 mt-px" />
          <span className="text-[13px] flex-1 min-w-0 text-pretty">
            {model.flagged.length} statement{model.flagged.length > 1 ? "s" : ""} report
            gross sales more than {CHECK_TOLERANCE * 100}% away from our own order log —
            worth a ticket.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={platformOptions} value={platform} onChange={setPlatform} />
        <div className="flex-1 min-w-1" />
        <Segmented options={MODES} value={mode} onChange={setMode} />
      </div>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KpiCard
          label="GROSS SALES"
          value={euro(model.gross)}
          sub="as reported by the platforms"
          delta={model.hasPrevious ? pctChange(model.gross, model.prevGross) : null}
          showDelta={model.hasPrevious}
          series={model.series}
        />
        <KpiCard
          label="NET PAYOUT"
          value={euro(model.net)}
          sub="what actually reached the bank"
          delta={model.hasPrevious ? pctChange(model.net, model.prevNet) : null}
          showDelta={model.hasPrevious}
          series={model.series}
        />
        <KpiCard
          label="PLATFORM FEES"
          value={euro(model.fees)}
          sub="commission, ads, deductions and other charges"
          delta={model.hasPrevious ? pctChange(model.fees, model.prevFees) : null}
          showDelta={model.hasPrevious}
          positiveIsGood={false}
          series={model.series}
        />
        <KpiCard
          label="EFFECTIVE FEE"
          value={`${model.feePct.toFixed(1)}%`}
          sub={
            model.hasPrevious
              ? `was ${model.prevFeePct.toFixed(1)}% the period before`
              : "share of gross taken by the platforms"
          }
          delta={model.hasPrevious ? model.feePct - model.prevFeePct : null}
          deltaLabel={`${Math.abs(model.feePct - model.prevFeePct).toFixed(1)}pp`}
          showDelta={model.hasPrevious}
          positiveIsGood={false}
          series={model.series}
        />
      </div>

      {/* Trend */}
      <Card>
        <div className="border-b border-line">
          <CardHeader
            title="Are the platforms getting more expensive?"
            sub={`The last ${TREND_STATEMENTS} statements from each platform, oldest first — statements, not weeks, because the periods are not the same length`}
            right={
              <div className="flex flex-wrap gap-3 text-[11px] text-muted">
                {model.lines.map((l) => (
                  <span key={l.id} className="flex items-center gap-1.5">
                    <span className="w-3 h-0.5" style={{ background: l.color }} />
                    {l.name}
                  </span>
                ))}
              </div>
            }
          />
        </div>
        <div className="px-4 pt-4 flex gap-2.5">
          <div className="w-[34px] md:w-10 shrink-0 flex flex-col justify-between h-[140px] text-right">
            {[3, 2, 1, 0].map((k) => {
              const v = model.lo + ((model.hi - model.lo) * k) / 3;
              return (
                <span key={k} className="font-mono text-[11px] text-muted leading-none">
                  {mode === "fee" ? `${Math.round(v)}%` : euro(v)}
                </span>
              );
            })}
          </div>
          <div className="flex-1 min-w-0 relative h-[140px]">
            {[0, 33.33, 66.67, 100].map((t) => (
              <div
                key={t}
                className="absolute left-0 right-0 h-px bg-wash"
                style={{ top: `${t}%` }}
              />
            ))}
            <svg
              viewBox="0 0 320 140"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full"
            >
              {model.lines.map((l) => (
                <polyline
                  key={l.id}
                  points={l.points
                    .map((p, i) => `${xOf(i, model.steps)},${yOf(p.value)}`)
                    .join(" ")}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={1.75}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          </div>
        </div>
        <div className="px-4 pb-3.5 pt-2 flex gap-2.5">
          <div className="w-[34px] md:w-10 shrink-0" />
          <div className="flex-1 min-w-0 relative h-3.5">
            {[0, Math.floor((model.steps - 1) / 2), model.steps - 1].map((i) => {
              const point = model.lines[0]?.points[i];
              if (!point) return null;
              return (
                <span
                  key={i}
                  className="absolute font-mono text-[11px] text-muted -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${(i / Math.max(1, model.steps - 1)) * 100}%` }}
                >
                  {parseDay(point.to).getDate()}{" "}
                  {MONTHS[parseDay(point.to).getMonth()].toLowerCase()}
                </span>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Statements */}
      <Card>
        <CardHeader
          title="Statements"
          sub="CHECK compares the platform's reported gross with our own order log"
          right={
            <span className="font-mono text-[11px] text-subtle">
              {model.inRange.length} statement{model.inRange.length === 1 ? "" : "s"}
            </span>
          }
        />

        <div
          className={`hidden md:grid gap-2 px-4 pb-2 font-mono text-[11px] tracking-[0.05em] text-muted ${cols}`}
        >
          <span>PERIOD</span>
          <span className="text-right">GROSS</span>
          <span>FEE MIX</span>
          <span className="text-right">FEES</span>
          <span className="text-right">RATE</span>
          <span className="text-right">NET</span>
          <span className="text-right">CHECK</span>
          <span />
        </div>

        {model.inRange.map((s) => {
          const isOpen = !!open[s.id];
          return (
            <div key={s.id}>
              <div
                onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                className={`grid gap-2 px-4 py-2.5 border-t border-line items-center cursor-pointer hover:bg-wash-light ${cols}`}
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-[2px] shrink-0"
                    style={{ background: s.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium whitespace-nowrap">{s.label}</div>
                    <div className="font-mono text-[11px] text-subtle">
                      {s.name} · {s.days} day{s.days === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <span className="font-mono text-[13px] tabular-nums text-right">
                  {euro(s.reported)}
                </span>

                <div className="hidden md:flex h-1.5 rounded-full overflow-hidden gap-px">
                  {s.parts.map((p) => (
                    <div
                      key={p.key}
                      style={{
                        width: `${(p.value / (s.fees || 1)) * 100}%`,
                        background: p.color,
                      }}
                    />
                  ))}
                </div>

                <span className="hidden md:block font-mono text-[13px] tabular-nums text-right">
                  {euro(s.fees)}
                </span>
                <span className="hidden md:block font-mono text-[13px] tabular-nums text-right text-muted">
                  {s.feePct.toFixed(1)}%
                </span>
                <span className="hidden md:block font-mono text-[13px] tabular-nums text-right">
                  {euro(s.net)}
                </span>
                <span
                  className="hidden md:block font-mono text-[13px] tabular-nums text-right"
                  style={{
                    color: s.flagged ? "var(--color-danger)" : "var(--color-muted)",
                  }}
                  title={
                    s.ours > 0
                      ? `Our order log says ${euro(s.ours)}`
                      : "No orders on record for these days"
                  }
                >
                  {s.ours === 0 ? "—" : s.flagged ? `${(s.variance * 100).toFixed(1)}%` : "ok"}
                </span>

                <div className="flex justify-end text-subtle">
                  <ChevronDown
                    size={14}
                    strokeWidth={2}
                    style={{
                      transform: isOpen ? "rotate(180deg)" : "none",
                      transition: "transform .15s ease",
                    }}
                  />
                </div>
              </div>

              {isOpen && (
                <div className="px-4 md:pl-10 py-3 bg-wash-light border-t border-line grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    {s.parts.length === 0 && (
                      <span className="text-[12px] text-subtle">No fees on this statement.</span>
                    )}
                    {s.parts.map((p) => (
                      <div key={p.key} className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-[2px] shrink-0"
                          style={{ background: p.color }}
                        />
                        <span className="text-[12px] text-muted flex-1">{p.label}</span>
                        <span className="font-mono text-[12px] tabular-nums">
                          {euro(p.value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-2.5">
                      <span className="text-[12px] text-muted flex-1">Platform reported</span>
                      <span className="font-mono text-[12px] tabular-nums">
                        {euro(s.reported)}
                      </span>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="text-[12px] text-muted flex-1">Our order log</span>
                      <span
                        className="font-mono text-[12px] tabular-nums"
                        style={{ color: s.flagged ? "var(--color-danger)" : undefined }}
                      >
                        {s.ours > 0 ? euro(s.ours) : "—"}
                      </span>
                    </div>
                    {s.invoice && (
                      <div className="flex gap-2.5 items-center">
                        <span className="text-[12px] text-muted flex-1">Invoice</span>
                        <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-muted">
                          <FileText size={12} strokeWidth={2} />
                          {s.invoice}
                        </span>
                      </div>
                    )}
                  </div>

                  {s.notes && (
                    <p className="text-[12px] text-muted md:col-span-2 text-pretty">
                      {s.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div
          className={`grid gap-2 px-4 py-3 border-t-2 border-line items-center font-mono text-[13px] ${cols}`}
        >
          <span className="tracking-[0.05em] text-muted text-[11px]">TOTAL</span>
          <span className="tabular-nums text-right font-medium">{euro(model.gross)}</span>
          <span className="hidden md:block" />
          <span className="hidden md:block tabular-nums text-right font-medium">
            {euro(model.fees)}
          </span>
          <span className="hidden md:block tabular-nums text-right text-muted">
            {model.feePct.toFixed(1)}%
          </span>
          <span className="hidden md:block tabular-nums text-right font-medium">
            {euro(model.net)}
          </span>
          <span className="hidden md:block" />
          <span />
        </div>
      </Card>
    </div>
  );
}
