"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";

const GLOW_COLORS = ["#e85d04", "#FFA000", "#e63946", "#2a9d8f"];
const REF_W = 1920;
const REF_H = 1080;

export default function TvDisplay3Page() {
  const [items, setItems] = useState([]);
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    setScale(Math.min(window.innerWidth / REF_W, window.innerHeight / REF_H));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  useEffect(() => {
    async function fetchItems() {
      const { data } = await supabase
        .from("menu_items")
        .select("canonical_name, description, pos_price, image_url, sort_order, servings")
        .eq("is_active", true)
        .eq("category", "Burger & Wrap Combos")
        .order("sort_order", { ascending: true })
        .limit(4);
      if (data) setItems(data);
    }
    fetchItems();
    const interval = setInterval(fetchItems, 30000);
    return () => clearInterval(interval);
  }, []);

  const displayed = items.slice(0, 4);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600&display=swap');
        body { margin: 0; padding: 0; overflow: hidden; background: #111; }
      `}</style>
      <div
        style={{
          width: REF_W,
          height: REF_H,
          display: "flex",
          background: "#111",
          fontFamily: "'Nunito', sans-serif",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {displayed.map((item, i) => {
          const color = GLOW_COLORS[i % GLOW_COLORS.length];
          return (
            <div
              key={item.canonical_name + i}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderRight: i < displayed.length - 1 ? "1px solid #222" : "none",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "24px 28px", zIndex: 3 }}>
                <span style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 88, color: "rgba(255,255,255,0.85)", lineHeight: 1, textShadow: "0 3px 12px rgba(0,0,0,0.7)" }}>
                  {item.sort_order ?? i + 1}
                </span>
                {item.servings > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {[...Array(item.servings)].map((_, si) => (
                      <svg key={si} width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    ))}
                  </div>
                )}
              </div>

              {item.image_url ? (
                <img src={item.image_url} alt={item.canonical_name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
              ) : (
                <div style={{ position: "absolute", inset: 0, background: "#1a1a1a", zIndex: 0 }} />
              )}

              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.95) 100%)", zIndex: 1, pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: "15%", left: "50%", transform: "translateX(-50%)", width: "80%", height: "40%", borderRadius: "50%", background: color, opacity: 0.1, filter: "blur(50px)", zIndex: 1, pointerEvents: "none" }} />

              <div style={{ position: "relative", zIndex: 2, marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 38px 60px", textAlign: "center", gap: 12 }}>
                <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 44, color: "#fff", margin: 0, lineHeight: 1.1, letterSpacing: "0.02em" }}>
                  {item.canonical_name}
                </h2>
                {item.description && (
                  <p style={{ fontSize: 16, color: "#999", margin: 0, lineHeight: 1.4, fontWeight: 400, textTransform: "uppercase" }}>
                    {item.description}
                  </p>
                )}
                <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 52, color: "#fff", margin: "12px 0 0 0", letterSpacing: "0.03em" }}>
                  {item.pos_price != null ? `€${Number(item.pos_price).toFixed(2)}` : ""}
                </p>
              </div>

              <div style={{ height: 6, background: color, flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
    </>
  );
}
