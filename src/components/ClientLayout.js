"use client";

import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import MobileNav from "./MobileNav";
import { useAuth } from "../lib/AuthContext";

/** Routes that render on their own: the login screen and the in-store displays. */
function isBare(pathname) {
  return (
    pathname === "/login" ||
    pathname === "/qr-menu" ||
    pathname.startsWith("/tv-display-")
  );
}

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const { loading, toast } = useAuth();

  if (loading && !isBare(pathname)) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center text-subtle">
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  if (isBare(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <Sidebar />

      {/* min-w-0 so a wide table inside a page cannot stretch the whole shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader />
        <main className="flex-1 px-3 md:px-6 pt-4 pb-6 md:py-6">{children}</main>
        <MobileNav />
      </div>

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-ink-strong text-surface text-[13px] font-medium rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
