"use client";
import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { supabase } from "../../lib/supabase";

const ORANGE = "#FFA000";
const CATEGORIES = [
  "All",
  "Fried Chicken Combos",
  "Burger & Wrap Combos",
  "Products",
  "Sides",
  "Dips",
  "Drinks",
];
const COMBO_CATEGORIES = new Set(["Fried Chicken Combos", "Burger & Wrap Combos"]);

export default function QrMenuPage() {
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchItems() {
      const { data } = await supabase
        .from("menu_items")
        .select("canonical_name, category, pos_price, description, image_url, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("canonical_name", { ascending: true });
      if (data) setItems(data);
    }
    fetchItems();
  }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (activeCategory !== "All") list = list.filter((i) => i.category === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((i) => i.canonical_name.toLowerCase().includes(q));
    }
    return list;
  }, [items, activeCategory, search]);

  // Group by category for display
  const grouped = useMemo(() => {
    const map = {};
    for (const item of filtered) {
      const cat = item.category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    // Sort categories in defined order
    const ordered = [];
    for (const cat of CATEGORIES) {
      if (cat === "All") continue;
      if (map[cat]) ordered.push({ category: cat, items: map[cat] });
    }
    return ordered;
  }, [filtered]);

  const isCombo = (cat) => COMBO_CATEGORIES.has(cat);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0d0d; overflow-x: hidden; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 0; }
        input::placeholder { color: #555; }
      `}</style>
      <div style={{ minHeight: "100vh", background: "#0d0d0d", fontFamily: "'Nunito', sans-serif", maxWidth: 480, margin: "0 auto", paddingBottom: 40 }}>

        {/* Header */}
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 32, color: "#fff", letterSpacing: "0.04em" }}>Menu</h1>
          <img src="/images/betty_logo.png" alt="Betty's" style={{ width: 40, height: 40, borderRadius: 12, objectFit: "contain" }} />
        </div>

        {/* Search */}
        <a
          href="https://g.page/r/CeFqk9vjn72qEAE/review"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 20px", padding: "12px 16px", background: "#141414", border: "1px solid #2a2a2a", borderRadius: 14, textDecoration: "none", transition: "all 0.2s" }}
        >
          <svg width={22} height={22} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#ccc", fontFamily: "'Nunito', sans-serif", lineHeight: 1.3 }}>
            Leave us a review on Google and get <span style={{ color: ORANGE }}>10% off today's order!</span>
          </span>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: "auto" }}>
            <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
          </svg>
        </a>

        {/* Category tabs */}
        <div style={{ padding: "0 20px", overflowX: "auto", display: "flex", gap: 6, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            const label = cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  whiteSpace: "nowrap",
                  padding: "8px 16px",
                  borderRadius: 12,
                  border: "none",
                  background: isActive ? ORANGE : "#1a1a1a",
                  color: isActive ? "#000" : "#888",
                  fontSize: 13,
                  fontWeight: isActive ? 800 : 600,
                  fontFamily: "'Nunito', sans-serif",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Menu items */}
        <div style={{ padding: "20px 20px 0" }}>
          {grouped.length === 0 && (
            <p style={{ color: "#555", fontSize: 14, textAlign: "center", padding: 40 }}>No items found</p>
          )}
          {grouped.map(({ category, items: catItems }) => (
            <div key={category} style={{ marginBottom: 28 }}>
              {/* Category title */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 4, height: 24, background: ORANGE, borderRadius: 2 }} />
                <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 22, color: "#fff", letterSpacing: "0.03em" }}>{category}</h2>
              </div>

              {isCombo(category) ? (
                /* Combo items: 2-column grid with images */
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {catItems.map((item) => (
                    <div key={item.canonical_name} style={{ background: "#141414", borderRadius: 16, overflow: "hidden", border: "1px solid #1e1e1e" }}>
                      {/* Image */}
                      <div style={{ width: "100%", aspectRatio: "1 / 1", background: "#1a1a1a", overflow: "hidden", position: "relative" }}>
                        {item.image_url ? (
                          <Image src={item.image_url} alt={item.canonical_name} fill sizes="45vw" quality={70} style={{ objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", background: "#1a1a1a" }} />
                        )}
                      </div>
                      {/* Info */}
                      <div style={{ padding: "10px 12px 14px" }}>
                        <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 16, color: "#fff", margin: 0, lineHeight: 1.15, letterSpacing: "0.02em" }}>
                          {item.canonical_name}
                        </p>
                        {item.description && (
                          <p style={{ fontSize: 10, color: "#666", margin: "4px 0 0", lineHeight: 1.35, textTransform: "uppercase" }}>
                            {item.description}
                          </p>
                        )}
                        <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 20, color: ORANGE, margin: "8px 0 0", letterSpacing: "0.02em" }}>
                          {item.pos_price != null ? `€${Number(item.pos_price).toFixed(2)}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Simple items: list rows */
                <div style={{ background: "#141414", borderRadius: 16, overflow: "hidden", border: "1px solid #1e1e1e" }}>
                  {catItems.map((item, idx) => (
                    <div
                      key={item.canonical_name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        borderBottom: idx < catItems.length - 1 ? "1px solid #1e1e1e" : "none",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#ddd", margin: 0 }}>{item.canonical_name}</p>
                        {item.description && (
                          <p style={{ fontSize: 11, color: "#555", margin: "2px 0 0", lineHeight: 1.3 }}>{item.description}</p>
                        )}
                      </div>
                      <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 18, color: ORANGE, margin: 0, marginLeft: 12, whiteSpace: "nowrap" }}>
                        {item.pos_price != null ? `€${Number(item.pos_price).toFixed(2)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
