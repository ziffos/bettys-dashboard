"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  ChartNoAxesCombined,
  Megaphone,
  Star,
  Menu,
  Check,
  ListChecks,
  LogOut,
} from "lucide-react";
import { useVisibleNav } from "./Sidebar";
import { useAuth } from "../lib/AuthContext";
import { usePanelItems } from "./panel/usePanelItems";

/**
 * The phone navigation: four destinations plus More.
 *
 * The four are fixed rather than derived from permissions, because a bar whose
 * items move depending on who is signed in is a bar nobody builds muscle memory
 * for. An entry the person cannot open is simply left out, and More carries
 * everything — including the four, so nothing is unreachable.
 *
 * More is also where signing out lives. The desktop rail has it next to the
 * person at the bottom; on a phone there is no rail, and until this sheet
 * carried it there was no way to sign out on a phone at all.
 */
const PRIMARY = [
  { slug: "overview", href: "/", icon: House, label: "Overview" },
  { slug: "sales", href: "/sales", icon: ChartNoAxesCombined, label: "Sales" },
  { slug: "marketing", href: "/marketing", icon: Megaphone, label: "Marketing" },
  { slug: "reviews", href: "/reviews", icon: Star, label: "Reviews" },
];

/**
 * The Assistant sits in the bar rather than behind More, because the whole
 * point of it is that a task is one thumb away from whatever you were reading.
 * Admins only — there is no rail on a phone to hide it in.
 *
 * The icon stays a checklist even though the page is called Assistant: the
 * badge on it counts open tasks, and the list is the half that is built. A
 * sparkle would promise the chat, which is not connected to anything.
 */
const ASSISTANT = { slug: "assistant", href: "/assistant", icon: ListChecks, label: "Assistant" };

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const groups = useVisibleNav();
  const { profile, signOut } = useAuth();
  const { openCount } = usePanelItems();

  // While the sheet is up, Escape closes it and the page behind it stops
  // scrolling — otherwise a flick aimed at the sheet drags the dashboard.
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const reachable = new Set(groups.flatMap((g) => g.items.map((i) => i.href)));
  const primary = PRIMARY.filter((i) => reachable.has(i.href));
  const isAdmin = profile?.role === "admin";
  const bar = isAdmin ? [...primary, ASSISTANT] : primary;

  const name = profile?.full_name || "";
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—";

  const goto = (href) => {
    setMoreOpen(false);
    router.push(href);
  };

  return (
    <>
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/20"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Sheet and bar travel together, so the sheet can never end up under
          the bar however tall the safe area turns out to be. */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40">
        {moreOpen && (
          <div
            className="bg-surface border-t border-line rounded-t-2xl overflow-hidden flex flex-col max-h-[70vh]"
            style={{ animation: "sheetIn .18s ease", boxShadow: "0 -8px 32px rgba(0,0,0,0.12)" }}
          >
            <div className="px-4 pt-3 pb-3 border-b border-line flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-full bg-ink-strong text-surface font-mono text-[11px] flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium truncate">{name || "Signed in"}</div>
                <div className="text-[12px] text-subtle truncate">
                  {profile?.job_title || (profile?.role === "admin" ? "Admin" : "Employee")}
                </div>
              </div>
              <button
                onClick={() => signOut()}
                className="min-h-9 px-3 flex items-center gap-1.5 border border-line rounded-md bg-surface text-[13px] text-muted shrink-0"
              >
                <LogOut size={14} strokeWidth={1.75} />
                Sign out
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
              {groups.map((group, gi) => (
                <div key={group.title ?? `group-${gi}`}>
                  {group.title && (
                    <div className="px-4 pt-3 pb-1 font-mono text-[10px] tracking-[0.06em] text-subtle uppercase">
                      {group.title}
                    </div>
                  )}
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    return (
                      <button
                        key={item.slug}
                        onClick={() => goto(item.href)}
                        className="w-full min-h-12 px-4 border-t border-wash flex items-center gap-2.5 text-left"
                      >
                        <span
                          className={`text-[15px] flex-1 min-w-0 truncate ${
                            active ? "text-ink font-medium" : "text-muted"
                          }`}
                        >
                          {item.label}
                        </span>
                        {active && <Check size={16} strokeWidth={2.5} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="h-3" />
            </div>
          </div>
        )}

        <div
          className="flex border-t border-line px-1 pt-1.5"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(8px)",
            paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))",
          }}
        >
          {bar.map((item) => {
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
                <span className="relative">
                  <Icon size={19} strokeWidth={1.75} />
                  {item.slug === "assistant" && openCount > 0 && (
                    <span className="absolute -top-px -right-1 w-1.5 h-1.5 rounded-full bg-danger" />
                  )}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            className={`flex-1 min-h-12 flex flex-col items-center justify-center gap-[3px] rounded-lg ${
              moreOpen ? "text-ink" : "text-subtle"
            }`}
          >
            <Menu size={19} strokeWidth={1.75} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </div>
    </>
  );
}
