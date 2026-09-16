"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * The date range that every screen shares.
 *
 * The v1 dashboard gave each page its own picker and anchored it to the newest
 * row in the table it happened to read, so Sales and Marketing could silently
 * be showing different months. The v2 design has one range in the header, and
 * it is relative to today — if a range is empty, the screen says so rather than
 * quietly sliding back to whenever the data stops.
 *
 * Every range also carries the equal-length period before it, because the
 * design compares against it on every KPI.
 */

const RangeContext = createContext(null);

const TZ = "Europe/Nicosia";

/** Today in Cyprus as a plain calendar date, free of the server's timezone. */
function cyprusToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = parts.split("-").map(Number);
  return { y, m, d };
}

/** Today in Cyprus as `YYYY-MM-DD`. The furthest a custom range can reach. */
export function todayISO() {
  const { y, m, d } = cyprusToday();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const fmt = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const addDays = (date, n) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

const dayCount = (from, to) =>
  Math.round((new Date(to) - new Date(from)) / 86400000) + 1;

/** "5 – 11 Sep" / "15 Aug – 11 Sep" — the hint under each option. */
function shortSpan(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (from === to) return `${a.getDate()} ${MON[a.getMonth()]}`;
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}–${b.getDate()} ${MON[b.getMonth()]}`;
  }
  return `${a.getDate()} ${MON[a.getMonth()]}–${b.getDate()} ${MON[b.getMonth()]}`;
}

function buildRanges() {
  const { y, m, d } = cyprusToday();
  const today = new Date(y, m - 1, d);

  const span = (from, to) => ({ from: fmt(from), to: fmt(to) });

  return [
    { id: "today", label: "Today", ...span(today, today) },
    { id: "7d", label: "Last 7 days", ...span(addDays(today, -6), today) },
    { id: "28d", label: "Last 28 days", ...span(addDays(today, -27), today) },
    {
      id: "mtd",
      label: "This month",
      ...span(new Date(y, m - 1, 1), today),
    },
    {
      id: "qtd",
      label: "This quarter",
      ...span(new Date(y, Math.floor((m - 1) / 3) * 3, 1), today),
    },
  ].map((r) => ({ ...r, hint: shortSpan(r.from, r.to) }));
}

export function RangeProvider({ children }) {
  const [rangeId, setRangeId] = useState("7d");
  const [custom, setCustomState] = useState(null); // { from, to }

  // Rebuilt per render rather than memoised on []: a dashboard left open
  // overnight should roll over to the new day, not keep showing yesterday.
  const options = buildRanges();

  const setRange = useCallback((id) => {
    setRangeId(id);
    setCustomState(null);
  }, []);

  const setCustom = useCallback((from, to) => {
    setCustomState({ from, to });
    setRangeId("custom");
  }, []);

  const value = useMemo(() => {
    const active =
      rangeId === "custom" && custom
        ? { id: "custom", label: "Custom", ...custom, hint: shortSpan(custom.from, custom.to) }
        : options.find((r) => r.id === rangeId) || options[1];

    const days = dayCount(active.from, active.to);
    const prevTo = addDays(new Date(active.from), -1);
    const prevFrom = addDays(prevTo, -(days - 1));

    return {
      ...active,
      days,
      previous: { from: fmt(prevFrom), to: fmt(prevTo) },
      options,
      setRange,
      setCustom,
    };
    // options is rebuilt every render, so keying on the ids keeps this stable
    // across renders within the same day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeId, custom, options.map((o) => o.from + o.to).join(), setRange, setCustom]);

  return <RangeContext.Provider value={value}>{children}</RangeContext.Provider>;
}

export function useRange() {
  const ctx = useContext(RangeContext);
  if (!ctx) throw new Error("useRange must be used inside RangeProvider");
  return ctx;
}
