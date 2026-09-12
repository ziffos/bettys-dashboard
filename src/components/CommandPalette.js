"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useVisibleNav } from "./Sidebar";

/**
 * ⌘K search over the things a manager actually looks for by name: a page, a
 * dish, a person, or the order behind a complaint.
 *
 * Orders are matched on their reference and on the item string, because that
 * is all an order has — there is no customer name on a delivery row.
 */

const GROUP_ORDER = ["Pages", "Dishes", "People", "Orders"];

export default function CommandPalette({ open, onClose }) {
  const router = useRouter();
  const groups = useVisibleNav();
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState({ dishes: [], people: [], orders: [] });
  const [searching, setSearching] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);

  const pages = useMemo(
    () => groups.flatMap((g) => g.items.map((i) => ({ label: i.label, href: i.href }))),
    [groups]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setRemote({ dishes: [], people: [], orders: [] });
      setCursor(0);
      // The input only exists once open flips, so focus on the next frame.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced remote lookup. Two characters is the floor — one letter matches
  // most of the menu and tells you nothing.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setRemote({ dishes: [], people: [], orders: [] });
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const id = setTimeout(async () => {
      const like = `%${q}%`;
      try {
      const [dishRes, peopleRes, delRes, posRes] = await Promise.all([
        supabase
          .from("menu_items")
          .select("id, canonical_name, category, pos_price")
          .ilike("canonical_name", like)
          .limit(5),
        supabase.from("profiles").select("id, full_name, job_title, role").ilike("full_name", like).limit(4),
        supabase
          .from("delivery_purchases")
          .select("id, order_reference, items, price, order_placed, delivery_partner")
          .or(`order_reference.ilike.${like},items.ilike.${like}`)
          .order("order_placed", { ascending: false })
          .limit(4),
        supabase
          .from("pos_sales")
          .select("id, order_reference, items, price, order_placed")
          .or(`order_reference.ilike.${like},items.ilike.${like}`)
          .order("order_placed", { ascending: false })
          .limit(3),
      ]);
      if (cancelled) return;
      setRemote({
        dishes: dishRes.data || [],
        people: peopleRes.data || [],
        orders: [
          ...(delRes.data || []).map((o) => ({ ...o, source: o.delivery_partner })),
          ...(posRes.data || []).map((o) => ({ ...o, source: "pos" })),
        ].sort((a, b) => new Date(b.order_placed) - new Date(a.order_placed)),
      });
      } catch (err) {
        // A failed lookup should show "nothing found", never leave the palette
        // spinning forever.
        console.error("Search failed:", err);
        if (!cancelled) setRemote({ dishes: [], people: [], orders: [] });
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = [];
    const matchedPages = q
      ? pages.filter((p) => p.label.toLowerCase().includes(q))
      : pages;
    if (matchedPages.length) {
      out.push({
        group: "Pages",
        rows: matchedPages.map((p) => ({ key: `page-${p.href}`, title: p.label, href: p.href })),
      });
    }
    if (remote.dishes.length) {
      out.push({
        group: "Dishes",
        rows: remote.dishes.map((d) => ({
          key: `dish-${d.id}`,
          title: d.canonical_name,
          meta: [d.category, d.pos_price != null ? `€${Number(d.pos_price).toFixed(2)}` : null]
            .filter(Boolean)
            .join(" · "),
          href: "/menu",
        })),
      });
    }
    if (remote.people.length) {
      out.push({
        group: "People",
        rows: remote.people.map((p) => ({
          key: `person-${p.id}`,
          title: p.full_name,
          meta: p.job_title || (p.role === "admin" ? "Admin" : "Employee"),
          href: "/settings",
        })),
      });
    }
    if (remote.orders.length) {
      out.push({
        group: "Orders",
        rows: remote.orders.map((o) => ({
          key: `order-${o.source}-${o.id}`,
          title: o.items || o.order_reference || "Order",
          meta: [
            o.source === "pos"
              ? "POS"
              : (o.source || "").charAt(0).toUpperCase() + (o.source || "").slice(1),
            o.order_placed ? new Date(o.order_placed).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              timeZone: "Europe/Nicosia",
            }) : null,
            o.price != null ? `€${Number(o.price).toFixed(2)}` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          href: "/sales",
        })),
      });
    }
    return out.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  }, [query, pages, remote]);

  const flat = useMemo(() => results.flatMap((g) => g.rows), [results]);

  useEffect(() => {
    if (cursor >= flat.length) setCursor(0);
  }, [flat.length, cursor]);

  if (!open) return null;

  const go = (row) => {
    if (!row) return;
    onClose();
    router.push(row.href);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (flat.length ? (c + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (flat.length ? (c - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(flat[cursor]);
    }
  };

  let index = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        className="relative w-full max-w-[560px] bg-surface border border-line rounded-xl overflow-hidden"
        style={{ boxShadow: "var(--shadow-pop)", animation: "riseIn .12s ease" }}
      >
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-line">
          <Search size={15} strokeWidth={2} className="text-subtle shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search orders, dishes…"
            className="flex-1 h-full bg-transparent text-[14px] outline-none placeholder:text-faint"
          />
          {searching && <Loader2 size={14} className="text-subtle animate-spin shrink-0" />}
          <kbd className="font-mono text-[10px] text-subtle border border-line rounded px-1.5 py-0.5 shrink-0">
            ESC
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-1.5">
          {flat.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-muted">
              {query.trim().length < 2
                ? "Type at least two characters."
                : searching
                  ? "Searching…"
                  : `Nothing matches “${query.trim()}”.`}
            </p>
          )}
          {results.map((group) => (
            <div key={group.group}>
              <div className="px-4 pt-2 pb-1 font-mono text-[10px] tracking-[0.06em] text-subtle uppercase">
                {group.group}
              </div>
              {group.rows.map((row) => {
                index += 1;
                const active = index === cursor;
                const myIndex = index;
                return (
                  <div
                    key={row.key}
                    onMouseEnter={() => setCursor(myIndex)}
                    onClick={() => go(row)}
                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${
                      active ? "bg-wash-light" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] truncate">{row.title}</div>
                      {row.meta && (
                        <div className="text-[11px] text-subtle truncate">{row.meta}</div>
                      )}
                    </div>
                    {active && (
                      <CornerDownLeft size={13} className="text-subtle shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
