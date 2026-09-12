"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { House, ChartNoAxesCombined, Megaphone, Star, Menu, Check } from "lucide-react";
import { useVisibleNav } from "./Sidebar";

/**
 * The phone navigation: four destinations plus More.
 *
 * The four are fixed rather than derived from permissions, because a bar whose
 * items move depending on who is signed in is a bar nobody builds muscle memory
 * for. An entry the person cannot open is simply left out, and More carries
 * everything — including the four, so nothing is unreachable.
 */
const PRIMARY = [
  { slug: "overview", href: "/", icon: House, label: "Overview" },
  { slug: "sales", href: "/sales", icon: ChartNoAxesCombined, label: "Sales" },
  { slug: "marketing", href: "/marketing", icon: Megaphone, label: "Marketing" },
  { slug: "reviews", href: "/reviews", icon: Star, label: "Reviews" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const groups = useVisibleNav();

  const reachable = new Set(groups.flatMap((g) => g.items.map((i) => i.href)));
  const primary = PRIMARY.filter((i) => reachable.has(i.href));

  const goto = (href) => {
    setMoreOpen(false);
    router.push(href);
  };

  return (
    <div className="md:hidden sticky bottom-0 z-40">
      {moreOpen && (
        <div
          className="bg-surface border-t border-line max-h-[58vh] overflow-y-auto"
          style={{ boxShadow: "0 -8px 24px rgba(0,0,0,0.06)" }}
        >
          <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] tracking-[0.06em] text-muted">ALL PAGES</span>
            <button
              onClick={() => setMoreOpen(false)}
              className="min-h-8 px-2.5 border border-line rounded-md bg-surface text-[12px] text-muted"
            >
              Close
            </button>
          </div>
          {groups.map((group, gi) => (
            <div key={group.title ?? `group-${gi}`}>
              {group.title && (
                <div className="px-4 pt-2 pb-0.5 font-mono text-[10px] tracking-[0.06em] text-subtle uppercase">
                  {group.title}
                </div>
              )}
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <div
                    key={item.slug}
                    onClick={() => goto(item.href)}
                    className="min-h-12 px-4 border-t border-wash flex items-center gap-2.5 cursor-pointer"
                  >
                    <span
                      className={`text-[15px] flex-1 min-w-0 ${
                        active ? "text-ink font-medium" : "text-muted"
                      }`}
                    >
                      {item.label}
                    </span>
                    {active && <Check size={16} strokeWidth={2.5} className="shrink-0" />}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="h-2.5" />
        </div>
      )}

      <div
        className="flex border-t border-line px-1 pt-1.5 pb-2.5"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))",
        }}
      >
        {primary.map((item) => {
          const active = pathname === item.href && !moreOpen;
          const Icon = item.icon;
          return (
            <Link
              key={item.slug}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className={`flex-1 min-h-12 flex flex-col items-center justify-center gap-[3px] rounded-lg ${
                active ? "text-ink" : "text-subtle"
              }`}
            >
              <Icon size={19} strokeWidth={1.75} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className={`flex-1 min-h-12 flex flex-col items-center justify-center gap-[3px] rounded-lg ${
            moreOpen ? "text-ink" : "text-subtle"
          }`}
        >
          <Menu size={19} strokeWidth={1.75} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </div>
  );
}
