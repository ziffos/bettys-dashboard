"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  House,
  ChartNoAxesCombined,
  Settings,
  LogOut,
  Megaphone,
  UtensilsCrossed,
  Star,
  ShoppingBag,
  CreditCard,
  Calendar,
  Wallet,
  Users
} from "lucide-react";
import logo from "../../public/images/betty_logo.png";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabase";

const TOP_ITEMS = [
  { slug: "overview", href: "/", icon: House, label: "Overview" },
];

const ANALYTICS_ITEMS = [
  { slug: "sales",       href: "/sales",     icon: ChartNoAxesCombined, label: "Sales" },
  { slug: "marketing",   href: "/marketing", icon: Megaphone,           label: "Marketing" },
  { slug: "products",    href: "/products",  icon: ShoppingBag,         label: "Products" },
  { slug: "reviews",     href: "/reviews",   icon: Star,                label: "Reviews" },
];

const OPERATIONS_ITEMS = [
  { slug: "menu",        href: "/menu",             icon: UtensilsCrossed, label: "Menu" },
  { slug: "payouts",     href: "/platform-payouts", icon: CreditCard,      label: "Platform Payouts" },
  { slug: "calendar",    href: "/calendar",         icon: Calendar,        label: "Calendar" },
  { slug: "payroll",     href: "/payroll",           icon: Users,           label: "Payroll" },
  { slug: "my-payroll",  href: "/my-payroll",        icon: Wallet,          label: "My Payroll" },
];

const SYSTEM_ITEMS = [
  { slug: "settings", href: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar({ onCloseMobile }) {
  const pathname = usePathname();
  const { user, profile, signOut, canAccess } = useAuth();
  const [hasShifts, setHasShifts] = useState(false);

  // Check if employee has any shifts (to decide My Payroll visibility)
  useEffect(() => {
    if (!user || profile?.role === "admin") return;
    supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("employee_id", user.id)
      .then(({ count }) => setHasShifts((count ?? 0) > 0));
  }, [user, profile]);

  const isAdmin = profile?.role === "admin";

  const filterItems = (items) => items.filter((item) => {
    if (!canAccess(item.slug)) return false;
    if (item.slug === "my-payroll" && isAdmin) return false;
    if (item.slug === "my-payroll" && !hasShifts) return false;
    return true;
  });

  const visibleTop = filterItems(TOP_ITEMS);
  const visibleAnalytics = filterItems(ANALYTICS_ITEMS);
  const visibleOperations = filterItems(OPERATIONS_ITEMS);
  const visibleSystem = filterItems(SYSTEM_ITEMS);

  const renderGroup = (items, label) => {
    if (items.length === 0) return null;
    return (
      <>
        {label && <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 md:mb-3 pl-3 md:pl-4 mt-4 md:mt-5 first:mt-0">{label}</p>}
        {items.map((item) => (
          <NavLink key={item.slug} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} onClick={onCloseMobile} />
        ))}
      </>
    );
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6">
      {/* Brand Section */}
      <div className="flex items-center gap-3 mb-6 md:mb-10 pl-1 md:pl-2 h-12 md:h-auto">
        <Image src={logo} alt="Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain rounded-lg" />
        <div className="flex flex-col">
          <h2 className="text-sm md:text-lg font-medium md:font-bold text-white tracking-tight leading-none">Betty's</h2>
          <p className="text-[9px] md:text-[10px] uppercase tracking-wider text-emerald-500 font-bold mt-0.5 md:mt-1">Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 md:space-y-1 overflow-y-auto">
        {renderGroup(visibleTop, null)}
        {renderGroup(visibleAnalytics, "Analytics")}
        {renderGroup(visibleOperations, "Operations")}
        {renderGroup(visibleSystem, "System")}
      </nav>

      {/* Logout — always visible */}
      <div className="pt-4 md:pt-6 border-t border-neutral-800">
         <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 md:px-4 py-2.5 md:py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all duration-200 group"
         >
            <LogOut size={18} className="stroke-[1.5] md:w-5 md:h-5" />
            <span>Logout</span>
         </button>
      </div>
    </div>
  );
}

// Helper Component for Navigation Links
function NavLink({ href, icon: Icon, label, active, onClick }) {
    return (
        <Link
          href={href}
          onClick={onClick}
          className={`
            flex items-center gap-3 text-sm font-medium transition-all duration-200 group
            px-3 py-2.5 md:px-4 md:py-3
            ${active
                ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] rounded-xl"
                : "text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl"
            }
          `}
        >
          <Icon
            size={18}
            className={`stroke-[1.5] transition-colors md:w-5 md:h-5 ${active ? "stroke-white md:stroke-white" : "group-hover:stroke-emerald-400"}`}
          />
          {label}
        </Link>
    );
}
