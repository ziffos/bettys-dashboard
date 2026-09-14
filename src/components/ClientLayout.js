"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import MobileNav from "./MobileNav";
import SidePanelRail from "./panel/SidePanelRail";
import { useAuth } from "../lib/AuthContext";
import { landingSlugFor } from "../lib/access";

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
  const { loading, toast, profile, permissions, signOut } = useAuth();
  const main = useRef(null);

  // The document no longer scrolls on a desktop, so the browser no longer
  // resets the scroll on a route change — main does, and main has to be told.
  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [pathname]);

  if (loading && !isBare(pathname)) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center text-subtle">
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  if (isBare(pathname)) return <>{children}</>;

  // An employee with no pages granted has nowhere to be sent. Saying so beats
  // redirecting them to a page they cannot open either.
  if (profile && profile.role !== "admin" && permissions && landingSlugFor(permissions) === null) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">
          Nothing has been shared with you yet
        </h1>
        <p className="max-w-[380px] text-[13px] text-muted text-pretty">
          Your account works, but no pages have been granted to it. Ask Betty to open the
          ones you need and they will appear here.
        </p>
        <button
          onClick={() => signOut()}
          className="h-9 px-3.5 border border-line rounded-md bg-surface text-[13px] text-muted hover:border-line-strong hover:text-ink"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    /*
     * On a desktop the shell is exactly the viewport and does not scroll: the
     * two rails and the header hold still and only `main` moves. It used to
     * rely on `position: sticky` for that, which silently does nothing here —
     * `overflow-x: hidden` on html/body in globals.css makes them scroll
     * containers, and a sticky element inside one has nothing to stick to. The
     * rails looked pinned only because most pages were short.
     *
     * A phone keeps scrolling the document. The bottom bar is fixed, the
     * address bar wants a real page scroll, and there is no second column to
     * hold still anyway.
     */
    <div className="flex min-h-screen md:h-screen md:overflow-hidden bg-canvas text-ink">
      <Sidebar />

      {/* min-w-0 so a wide table inside a page cannot stretch the whole shell */}
      <div className="flex-1 min-w-0 md:min-h-0 flex flex-col">
        <AppHeader />
        {/* The phone nav is fixed, so the last card needs clearance under it. */}
        <main
          ref={main}
          className="flex-1 md:min-h-0 md:overflow-y-auto px-3 md:px-6 pt-4 md:pt-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-6"
        >
          {children}
        </main>
        <MobileNav />
      </div>

      {/* Pushes the page rather than covering it — a flex sibling, not an
          overlay. Renders nothing for an employee. */}
      <SidePanelRail />

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-ink-strong text-surface text-[13px] font-medium rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
