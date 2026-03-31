"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { Menu, X, Loader2 } from "lucide-react";
import Image from "next/image";
import logo from "../../public/images/betty_logo.png";
import { useAuth } from "../lib/AuthContext";

export default function ClientLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { loading, toast } = useAuth();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  if (loading) {
     return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-emerald-500">
           <Loader2 size={48} className="animate-spin" />
        </div>
     );
  }

  // If we are on the login or tv-display page, don't show the sidebar or header
  if (pathname === "/login" || pathname.startsWith("/tv-display")) {
     return <>{children}</>;
  }

  return (
    <div className={`flex min-h-screen bg-neutral-950 text-neutral-200 selection:bg-emerald-500 selection:text-white ${isSidebarOpen ? "overflow-hidden h-screen" : ""}`}>
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4 z-50 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-3">
             <div className="p-1 bg-white/5 rounded-lg border border-white/10">
               <Image src={logo} alt="Logo" className="w-6 h-6 object-contain" />
             </div>
             <div className="flex flex-col">
               <span className="font-bold text-white tracking-tight leading-none">Betty's</span>
               <span className="text-[9px] uppercase tracking-wider text-emerald-500 font-bold mt-0.5">Dashboard</span>
             </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
              {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
            className="md:hidden fixed top-16 left-0 right-0 bottom-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
          fixed top-16 md:top-0 left-0 h-[calc(100%-4rem)] md:h-full w-64 z-50 transition-transform duration-300 ease-in-out
          md:translate-x-0 bg-neutral-900 border-r border-neutral-800
          ${isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}
      `}>
         <Sidebar onCloseMobile={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <main className={`
        flex-1 w-full transition-all duration-300
        md:ml-64
        pt-20 md:pt-8 px-4 md:px-8
      `}>
          <div className="max-w-7xl mx-auto pb-10">
              {children}
          </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 bg-red-500/90 text-white text-sm font-medium rounded-xl shadow-lg backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          {toast}
        </div>
      )}
    </div>
  );
}
