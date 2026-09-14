"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search, Calendar, Download, Bell, ChevronRight, ChevronDown } from "lucide-react";
import logo from "../../public/images/betty_logo.png";
import { useRange } from "../lib/RangeContext";
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
  "/notes": "Notes",
};

export default function AppHeader() {
  const pathname = usePathname();
  const range = useRange();
  const [rangeOpen, setRangeOpen] = useState(false);
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
      if (rangeRef.current && !rangeRef.current.contains(e.target)) setRangeOpen(false);
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
            <span>{range.label}</span>
            <ChevronDown size={14} strokeWidth={2} className="text-subtle shrink-0" />
          </button>
          {rangeOpen && (
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
                disabled
                title="Custom ranges are not wired up yet"
                className="w-full px-2.5 py-2 rounded-md text-[13px] text-left text-faint cursor-not-allowed"
              >
                Custom range…
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
