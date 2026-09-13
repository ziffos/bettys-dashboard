"use client";

import { useEffect } from "react";
import { ArrowUpRight, Calendar, X } from "lucide-react";
import { sparkPath } from "../../lib/format";

/**
 * The pieces every rebuilt screen is made of. See design/DESIGN.md — the values
 * here are that spec, so a screen composes rather than re-deriving the padding.
 */

export function Card({ className = "", children, ...rest }) {
  return (
    <div
      className={`border border-line rounded-xl bg-surface min-w-0 ${className}`}
      style={{ boxShadow: "var(--shadow-card)" }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, right, className = "" }) {
  return (
    <div
      className={`px-4 py-3.5 flex items-start justify-between gap-3 flex-wrap ${className}`}
    >
      <div className="min-w-0">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
        {sub && <p className="mt-[3px] text-[12px] text-subtle">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ title, sub, right }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-[22px] md:text-[28px] font-semibold tracking-[-0.03em] leading-[1.1]">
          {title}
        </h1>
        {sub && <p className="mt-1.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/**
 * A KPI tile: label, delta, value, one line of context, and the period's shape.
 *
 * `positiveIsGood` is false for the metrics where a rise is bad — fee rate,
 * rejected orders, cost per thousand — so the colour follows the meaning rather
 * than the sign.
 */
export function KpiCard({
  label,
  value,
  sub,
  delta,
  deltaLabel,
  positiveIsGood = true,
  series = [],
  showDelta = true,
}) {
  const up = (delta ?? 0) >= 0;
  const good = positiveIsGood ? up : !up;
  const spark = sparkPath(series);

  return (
    <div
      className="border border-line rounded-xl p-3.5 bg-surface flex flex-col gap-2 hover:border-line-strong transition-colors min-w-0"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between gap-2 h-5">
        <span className="font-mono text-[10px] tracking-[0.06em] text-subtle truncate">
          {label}
        </span>
        {showDelta && delta != null && (
          <span
            className="inline-flex items-center gap-[3px] text-[11px] font-medium rounded-full px-1.5 py-0.5 whitespace-nowrap shrink-0"
            style={{
              color: good ? "var(--color-accent)" : "var(--color-danger)",
              background: good ? "rgba(0,112,243,0.08)" : "rgba(238,0,0,0.07)",
            }}
          >
            <ArrowUpRight
              size={11}
              strokeWidth={2.5}
              style={{ transform: up ? "none" : "scaleY(-1)" }}
            />
            {deltaLabel ?? `${Math.abs(delta).toFixed(1)}%`}
          </span>
        )}
      </div>
      <div className="text-[27px] font-semibold tracking-[-0.03em] leading-none">{value}</div>
      <div className="text-[11px] text-subtle min-h-[30px] text-pretty">{sub}</div>
      <svg
        viewBox="0 0 120 28"
        preserveAspectRatio="none"
        className="w-full h-7 mt-0.5 overflow-visible"
      >
        <path d={spark.area} fill="var(--color-wash)" />
        <polyline
          points={spark.line}
          fill="none"
          stroke="var(--color-ink-strong)"
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** Daily / Weekly / Monthly, platform filters, Week / Month — one control. */
export function Segmented({ options, value, onChange, className = "" }) {
  return (
    // max-w-full + scroll: six month chips do not fit a 390px screen, and a
    // control that cannot fit should scroll rather than stretch the page and
    // leave half of itself past the edge.
    <div
      className={`flex gap-0.5 p-0.5 border border-line rounded-lg bg-wash-light shrink-0 max-w-full overflow-x-auto ${className}`}
    >
      {options.map((opt) => {
        const on = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`px-3 py-[5px] text-[12px] font-medium rounded-md whitespace-nowrap shrink-0 ${
              on ? "bg-surface text-ink" : "text-subtle hover:text-muted"
            }`}
            style={on ? { boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A card for something the design shows but the data cannot answer yet.
 *
 * Kept visible rather than removed so the screen keeps the shape it was
 * designed with, and so the gap stays on the roadmap instead of being forgotten.
 */
export function UpcomingCard({ title, children }) {
  return (
    <Card>
      <div className="px-4 py-3.5 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
        <span className="font-mono text-[10px] tracking-[0.06em] text-subtle border border-line rounded px-1.5 py-0.5">
          UPCOMING
        </span>
      </div>
      <div className="px-4 pb-4 text-[12px] text-muted text-pretty">{children}</div>
    </Card>
  );
}

export function EmptyState({ title, body, action, onAction, icon: Icon = Calendar }) {
  return (
    <div className="border border-dashed border-line rounded-xl py-14 px-6 flex flex-col items-center text-center gap-2.5 bg-wash-light">
      <div className="w-10 h-10 rounded-[10px] border border-line bg-surface flex items-center justify-center">
        <Icon size={18} strokeWidth={1.75} className="text-subtle" />
      </div>
      <h3 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="text-[13px] text-muted max-w-[380px] text-pretty">{body}</p>
      {action && (
        <button
          onClick={onAction}
          className="mt-1.5 h-8 px-3 rounded-md bg-ink-strong text-surface text-[13px] font-medium hover:bg-ink"
        >
          {action}
        </button>
      )}
    </div>
  );
}

const Block = ({ className = "", faint = false, style }) => (
  <div
    className={`rounded ${faint ? "shimmer-faint" : "shimmer"} ${className}`}
    style={style}
  />
);

/**
 * The loading state. `line` says what is being loaded — a count of the rows on
 * their way is more reassuring than a spinner, and it is the design's own
 * pattern.
 */
export function LoadingState({ kpis = 4, shape = "chart", line, columns }) {
  return (
    <div className="flex flex-col gap-4">
      <Block className="h-7 w-[200px]" />
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns:
            columns ?? `repeat(auto-fit, minmax(180px, 1fr))`,
        }}
      >
        {Array.from({ length: kpis }, (_, i) => (
          <div
            key={i}
            className="h-[118px] border border-line rounded-xl p-3.5 flex flex-col gap-2.5"
          >
            <Block className="h-2.5 w-3/5" />
            <Block className="h-6 w-3/4" />
            <Block className="flex-1" faint />
          </div>
        ))}
      </div>

      {shape === "chart" && (
        <div className="h-[320px] border border-line rounded-xl p-4 flex items-end gap-2.5">
          {[58, 74, 46, 52, 62, 80, 96].map((h, i) => (
            <Block key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}

      {shape === "list" && (
        <div className="border border-line rounded-xl overflow-hidden">
          {[72, 58, 80, 64, 76, 54].map((w, i) => (
            <div key={i} className="px-4 py-3.5 border-t border-line flex flex-col gap-2">
              <Block className="h-2.5" style={{ width: `${w * 0.4 + 60}px` }} />
              <Block className="h-3" faint style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      )}

      {line && (
        <p className="font-mono text-[11px] text-subtle tracking-[0.04em]">{line}</p>
      )}
    </div>
  );
}

/** The drawer that replaced the design's modals. */
export function SidePanel({ open, title, eyebrow, onClose, footer, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex justify-center md:justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        className="relative w-full max-w-[390px] md:max-w-[440px] bg-surface border-l border-line flex flex-col h-full"
        style={{ boxShadow: "var(--shadow-panel)", animation: "drawerIn .16s ease" }}
      >
        <div className="px-4 py-3.5 border-b border-line flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            {eyebrow && (
              <p className="font-mono text-[10px] tracking-[0.06em] text-subtle">{eyebrow}</p>
            )}
            <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.02em] truncate">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center border border-line rounded-md bg-surface hover:border-line-strong shrink-0"
          >
            <X size={14} strokeWidth={2} className="text-muted" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        {footer && <div className="border-t border-line shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

/** The five-pointed star used by Reviews and the Overview digest. */
export function Stars({ rating, size = 11 }) {
  return (
    <div className="flex gap-px shrink-0">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={s <= Math.round(rating) ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: s <= Math.round(rating) ? "#171717" : "#e5e5e5" }}
        >
          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
        </svg>
      ))}
    </div>
  );
}

export const PLATFORM = {
  wolt: { name: "Wolt", color: "#007cf0" },
  foody: { name: "Foody", color: "#f5a623" },
  bolt: { name: "Bolt", color: "#50e3c2" },
  pos: { name: "In-store POS", color: "#171717" },
  google: { name: "Google", color: "#ee0000" },
};

/**
 * A short-lived confirmation or failure notice.
 *
 * The write-capable screens all need one: an edit that silently fails looks
 * exactly like an edit that worked until the page is reloaded.
 */
export function Toast({ toast, onDone, after = 3200 }) {
  useEffect(() => {
    if (!toast || !onDone) return;
    const id = setTimeout(onDone, after);
    return () => clearTimeout(id);
  }, [toast, onDone, after]);

  if (!toast) return null;
  const bad = toast.type === "error";
  return (
    <div
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[110] px-4 py-2.5 rounded-lg text-[13px] font-medium shadow-lg max-w-[90vw]"
      style={{
        background: bad ? "var(--color-danger)" : "var(--color-ink-strong)",
        color: "#fff",
        animation: "riseIn .12s ease",
      }}
    >
      {toast.message}
    </div>
  );
}

/** Field label and input styling shared by every side panel. */
export const FIELD_LABEL =
  "block font-mono text-[10px] tracking-[0.06em] text-muted uppercase mb-1.5";
export const FIELD_INPUT =
  "w-full h-9 px-2.5 border border-line rounded-md bg-surface text-[13px] text-ink outline-none focus:border-ink-strong placeholder:text-faint";
