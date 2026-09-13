"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  House,
  ChartNoAxesCombined,
  Megaphone,
  ShoppingBag,
  Star,
  UtensilsCrossed,
  CreditCard,
  Calendar,
  Wallet,
  Tv,
  Users,
  Settings,
  LogOut,
  Pin,
  PinOff,
} from "lucide-react";
import logo from "../../public/images/betty_logo.png";
import { useAuth } from "../lib/AuthContext";
import { isParked } from "../lib/features";
import { supabase } from "../lib/supabase";

export const NAV_GROUPS = [
  {
    title: null,
    items: [{ slug: "overview", href: "/", icon: House, label: "Overview" }],
  },
  {
    title: "Analytics",
    items: [
      { slug: "sales", href: "/sales", icon: ChartNoAxesCombined, label: "Sales" },
      { slug: "marketing", href: "/marketing", icon: Megaphone, label: "Marketing" },
      { slug: "products", href: "/products", icon: ShoppingBag, label: "Products" },
      { slug: "reviews", href: "/reviews", icon: Star, label: "Reviews" },
    ],
  },
  {
    title: "Operations",
    items: [
      { slug: "menu", href: "/menu", icon: UtensilsCrossed, label: "Menu" },
      { slug: "payouts", href: "/platform-payouts", icon: CreditCard, label: "Platform Payouts" },
      { slug: "calendar", href: "/calendar", icon: Calendar, label: "Calendar" },
      { slug: "payroll", href: "/payroll", icon: Wallet, label: "Payroll" },
      { slug: "tv-displays", href: "/tv-displays", icon: Tv, label: "TV Displays" },
      { slug: "my-payroll", href: "/my-payroll", icon: Users, label: "My Payroll" },
    ],
  },
  {
    title: "System",
    items: [{ slug: "settings", href: "/settings", icon: Settings, label: "Settings" }],
  },
];

/**
 * Which nav entries the signed-in person may actually open.
 *
 * My Payroll is the one entry that is hidden for a reason other than
 * permissions: admins do not have shifts, and an employee with no shifts on
 * record would only find an empty page.
 */
export function useVisibleNav() {
  const { user, profile, canAccess } = useAuth();
  const [hasShifts, setHasShifts] = useState(false);
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!user || isAdmin) return;
    let cancelled = false;
    supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", user.id)
      .then(({ count }) => {
        if (!cancelled) setHasShifts((count ?? 0) > 0);
      });
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]);

  const allowed = (item) => {
    if (isParked(item.slug)) return false;
    if (!canAccess(item.slug)) return false;
    if (item.slug === "my-payroll" && (isAdmin || !hasShifts)) return false;
    return true;
  };

  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter(allowed) })).filter(
    (g) => g.items.length > 0
  );
}

const PIN_KEY = "bettys-rail-pinned";

// The pin lives in localStorage, which does not exist during SSR. Reading it
// through useSyncExternalStore gives the server a defined answer (false) and
// the client the stored one, without an effect that re-renders on mount.
const pinListeners = new Set();
const subscribePin = (cb) => {
  pinListeners.add(cb);
  return () => pinListeners.delete(cb);
};
const readPin = () => window.localStorage.getItem(PIN_KEY) === "1";
const readPinOnServer = () => false;
const writePin = (value) => {
  window.localStorage.setItem(PIN_KEY, value ? "1" : "0");
  pinListeners.forEach((cb) => cb());
};

export default function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [hovered, setHovered] = useState(false);
  const pinned = useSyncExternalStore(subscribePin, readPin, readPinOnServer);
  const groups = useVisibleNav();

  const open = pinned || hovered;
  const name = profile?.full_name || "";
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ width: open ? 224 : 60 }}
      className="hidden md:flex shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 overflow-hidden sticky top-0 h-screen"
    >
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-3.5 border-b border-line shrink-0">
        <Image
          src={logo}
          alt="Betty's"
          className="w-7 h-7 rounded-md object-contain shrink-0"
        />
        <div
          className="overflow-hidden whitespace-nowrap flex-1 min-w-0 transition-opacity duration-150"
          style={{ opacity: open ? 1 : 0 }}
        >
          <div className="text-[13px] font-semibold tracking-[-0.01em] leading-[1.1]">
            Betty&apos;s Crispy Chicken
          </div>
          <div className="font-mono text-[10px] text-subtle tracking-[0.04em]">LIMASSOL</div>
        </div>
        <button
          onClick={() => writePin(!pinned)}
          title={pinned ? "Unpin the sidebar" : "Keep the sidebar open"}
          className="w-6 h-6 flex items-center justify-center rounded-md text-subtle hover:text-ink hover:bg-wash shrink-0 transition-opacity duration-150"
          style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
        >
          {pinned ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {groups.map((group, gi) => (
          <div key={group.title ?? `group-${gi}`} className="contents">
            {group.title && (
              <p
                className="font-mono text-[10px] text-subtle tracking-[0.06em] uppercase mt-3.5 mb-1 pl-2.5 whitespace-nowrap transition-opacity duration-150"
                style={{ opacity: open ? 1 : 0 }}
              >
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.slug}
                  href={item.href}
                  title={open ? undefined : item.label}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] whitespace-nowrap ${
                    active
                      ? "bg-wash text-ink font-medium"
                      : "text-muted hover:bg-wash-light hover:text-ink"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} className="shrink-0" />
                  <span
                    className="transition-opacity duration-150"
                    style={{ opacity: open ? 1 : 0 }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Person */}
      <div className="border-t border-line p-2 shrink-0">
        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <div className="w-7 h-7 rounded-full bg-ink-strong text-surface font-mono text-[10px] flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div
            className="flex-1 min-w-0 overflow-hidden whitespace-nowrap transition-opacity duration-150"
            style={{ opacity: open ? 1 : 0 }}
          >
            <div className="text-[13px] font-medium truncate">{name}</div>
            <div className="text-[11px] text-subtle truncate">
              {profile?.job_title || (profile?.role === "admin" ? "Admin" : "Employee")}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            title="Log out"
            className="w-7 h-7 flex items-center justify-center rounded-md text-subtle hover:text-danger hover:bg-wash shrink-0 transition-opacity duration-150"
            style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
          >
            <LogOut size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
