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
  DollarSign,
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

const NAV_ITEMS = [
  { slug: "overview",    href: "/",                 icon: House,                label: "Overview" },
  { slug: "sales",       href: "/sales",            icon: ChartNoAxesCombined,  label: "Sales" },
  { slug: "marketing",   href: "/marketing",        icon: Megaphone,            label: "Marketing" },
  { slug: "menu",        href: "/menu",             icon: UtensilsCrossed,      label: "Menu" },
  { slug: "products",    href: "/products",         icon: ShoppingBag,          label: "Products" },
  { slug: "economics",   href: "/economics",        icon: DollarSign,           label: "Economics" },
  { slug: "payouts",     href: "/platform-payouts", icon: CreditCard,           label: "Platform Payouts" },
  { slug: "reviews",     href: "/reviews",          icon: Star,                 label: "Reviews" },
  { slug: "calendar",    href: "/calendar",         icon: Calendar,             label: "Calendar" },
  { slug: "my-payroll",  href: "/my-payroll",       icon: Wallet,               label: "My Payroll" },
];

const SYSTEM_ITEMS = [
  { slug: "payroll",  href: "/payroll",  icon: Users,    label: "Payroll" },
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

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (!canAccess(item.slug)) return false;
    // Hide My Payroll for employees with no shifts
    if (item.slug === "my-payroll" && profile?.role !== "admin" && !hasShifts) return false;
    return true;
  });
  const visibleSystem = SYSTEM_ITEMS.filter((item) => canAccess(item.slug));

  return (
    <div className="h-full flex flex-col p-6">
      {/* Brand Section */}
      <div className="flex items-center gap-4 mb-10 pl-2">
        <div className="p-1 bg-white/5 rounded-xl border border-white/10">
          <Image src={logo} alt="Logo" className="w-10 h-10 object-contain" />
        </div>
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-white tracking-tight leading-none">Betty's</h2>
          <p className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold mt-1">Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4 pl-4">Menu</p>

        {visibleNav.map((item) => (
          <NavLink
            key={item.slug}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={pathname === item.href}
            onClick={onCloseMobile}
          />
        ))}
      </nav>

      {/* Footer / System */}
      <div className="pt-6 border-t border-neutral-800 space-y-2">
         <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4 pl-4">System</p>
         {visibleSystem.map((item) => (
           <NavLink
             key={item.slug}
             href={item.href}
             icon={item.icon}
             label={item.label}
             active={pathname === item.href}
             onClick={onCloseMobile}
           />
         ))}
         <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl transition-all duration-200 group"
         >
            <LogOut size={20} className="stroke-[1.5]" />
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
            flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group
            ${active
                ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }
          `}
        >
          <Icon
            size={20}
            className={`stroke-[1.5] transition-colors ${active ? "stroke-white" : "group-hover:stroke-emerald-400"}`}
          />
          {label}
        </Link>
    );
}
