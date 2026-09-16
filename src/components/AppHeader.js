"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search, Calendar, Download, Bell, ChevronRight, ChevronDown, ChevronLeft } from "lucide-react";
import logo from "../../public/images/betty_logo.png";
import { todayISO, useRange } from "../lib/RangeContext";
import CommandPalette from "./CommandPalette";

export const PAGE_TITLES = {
  "/": "Overview",
  "/sales": "Sales",
  "/marketing": "Marketing",
  "/products": "Products",
  "/reviews": "Reviews",
  "/menu": "Menu",
  "/platform-payouts": "Platform Payouts",
  "/calendar": "Calendar",
  "/payroll": "Payroll",
  "/tv-displays": "TV Displays",
  "/my-payroll": "My Payroll",
  "/settings": "Settings",
  "/assistant": "Assistant",
};

/**
 * Two dates and an Apply, in the same popover the presets live in.
 *
 * It replaces the list rather than growing beside it: the popover is 248px on
 * a phone as well as a desktop, and a picker that pushes five presets off the
 * bottom of the screen is worse than one that borrows their space and gives it
 * back. `type="date"` on purpose — the platform's own picker is a better
 * calendar than one built here would be, and it is the one already on the
 * phone.
 *
 * Nothing past today: the dashboard is defined relative to today and a range
 * that reaches into next week can only ever be empty.
 */
function CustomRange({ value, onChange, onBack, onApply }) {
  const today = todayISO();
  const valid = value.from && value.to && value.from <= value.to && value.to <= today;
  const field =
    "w-full h-9 px-2.5 border border-line rounded-lg bg-surface text-[13px] outline-none focus:border-ink-strong";

  return (
    <div
      className="absolute right-0 top-[calc(100%+6px)] w-[248px] bg-surface border border-line rounded-[10px] p-1 z-50"
      style={{ boxShadow: "var(--shadow-pop)", animation: "riseIn .12s ease" }}
    >
      <div className="flex items-center gap-1 px-1 pt-0.5 pb-1.5">
        <button
          onClick={onBack}
          aria-label="Back to the presets"
          className="w-6 h-6 -ml-0.5 rounded flex items-center justify-center text-subtle hover:text-ink hover:bg-wash"
        >
          <ChevronLeft size={14} strokeWidth={2} />
        </button>
        <span className="text-[13px] font-medium">Custom range</span>
      </div>

      <div className="px-1 pb-1 flex flex-col gap-1.5">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.06em] text-subtle uppercase">From</span>
          <input
            type="date"
            max={value.to || today}
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.06em] text-subtle uppercase">To</span>
          <input
            type="date"
            min={value.from || undefined}
            max={today}
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className={field}
          />
        </label>

        <button
          onClick={() => onApply(value.from, value.to)}
          disabled={!valid}
          className="h-9 mt-0.5 rounded-lg bg-ink-strong text-surface text-[13px] font-medium disabled:opacity-40"
        >
          Apply
        </button>
        {!valid && value.from && value.to && (
          <p className="px-0.5 pb-0.5 text-[11.5px] text-warn-ink text-pretty">
            {value.from > value.to
              ? "The first date has to come first."
              : "There is no data after today."}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AppHeader() {
  const pathname = usePathname();
  const range = useRange();
  const [rangeOpen, setRangeOpen] = useState(false);
  const [picking, setPicking] = useState(null); // { from, to } while choosing one
  const [paletteOpen, setPaletteOpen] = useState(false);
  const rangeRef = useRef(null);

  const title = PAGE_TITLES[pathname] ?? "Overview";

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!rangeOpen) return;
    const onDown = (e) => {
      if (rangeRef.current && !rangeRef.current.contains(e.target)) {
        setRangeOpen(false);
        setPicking(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [rangeOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 h-14 shrink-0 flex items-center gap-3 px-3 md:px-4 border-b border-line bg-surface">
        {/* Phone: brand + page name. Desktop: breadcrumb. */}
        <div className="flex md:hidden items-center gap-2.5 min-w-0">
          <Image src={logo} alt="Betty's" className="w-7 h-7 rounded-md object-contain shrink-0" />
          <span className="text-[15px] font-semibold tracking-[-0.01em] truncate">{title}</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 min-w-0">
          <span className="text-[13px] text-muted truncate">Betty&apos;s Crispy Chicken</span>
          <ChevronRight size={14} strokeWidth={2} className="text-line-strong shrink-0" />
          <span className="text-[13px] font-medium truncate">{title}</span>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden md:flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-md border border-line bg-surface text-[13px] text-subtle hover:border-line-strong min-w-[220px]"
        >
          <Search size={14} strokeWidth={2} className="shrink-0" />
          <span className="flex-1 text-left">Search orders, dishes…</span>
          <kbd className="font-mono text-[10px] border border-line rounded px-1.5 py-0.5">⌘K</kbd>
        </button>

        <div className="relative" ref={rangeRef}>
          <button
            onClick={() => setRangeOpen((o) => !o)}
            className="flex items-center gap-2 h-8 px-2.5 rounded-md border border-line bg-surface text-[13px] hover:border-line-strong whitespace-nowrap"
          >
            <Calendar size={14} strokeWidth={2} className="text-muted shrink-0" />
            <span>{range.id === "custom" ? range.hint : range.label}</span>
            <ChevronDown size={14} strokeWidth={2} className="text-subtle shrink-0" />
          </button>
          {rangeOpen && picking && (
            <CustomRange
              value={picking}
              onChange={setPicking}
              onBack={() => setPicking(null)}
              onApply={(from, to) => {
                range.setCustom(from, to);
                setPicking(null);
                setRangeOpen(false);
              }}
            />
          )}

          {rangeOpen && !picking && (
            <div
              className="absolute right-0 top-[calc(100%+6px)] w-[248px] bg-surface border border-line rounded-[10px] p-1 z-50"
              style={{ boxShadow: "var(--shadow-pop)", animation: "riseIn .12s ease" }}
            >
              {range.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    range.setRange(opt.id);
                    setRangeOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-md text-[13px] text-left hover:bg-wash-light ${
                    range.id === opt.id ? "bg-wash-light" : ""
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="font-mono text-[11px] text-subtle">{opt.hint}</span>
                </button>
              ))}
              <div className="h-px bg-line my-1" />
              <button
                onClick={() => setPicking({ from: range.from, to: range.to })}
                className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-md text-[13px] text-left hover:bg-wash-light ${
                  range.id === "custom" ? "bg-wash-light" : ""
                }`}
              >
                <span>Custom range…</span>
                {range.id === "custom" && (
                  <span className="font-mono text-[11px] text-subtle">{range.hint}</span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Export and notifications render, but neither is wired up yet — what
            Export should produce is still an open question, and the bell is
            meant to surface the Needs attention items once those are real. */}
        <button
          disabled
          title="Export is not available yet"
          className="hidden md:flex items-center gap-2 h-8 px-2.5 rounded-md border border-line bg-surface text-[13px] text-faint cursor-not-allowed"
        >
          <Download size={14} strokeWidth={2} className="shrink-0" />
          Export
        </button>

        <button
          disabled
          title="Notifications are not available yet"
          className="relative flex items-center justify-center w-8 h-8 rounded-md border border-line bg-surface text-faint cursor-not-allowed shrink-0"
        >
          <Bell size={15} strokeWidth={2} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
        </button>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
