"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";

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
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600;700&display=swap');
        body { margin: 0; padding: 0; overflow: hidden; background: #000; }
      `}</style>
      <div
        style={{
          width: REF_W,
          height: REF_H,
          display: "flex",
          background: "#000",
          fontFamily: "'Nunito', sans-serif",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {displayed.map((item, i) => (
          <div
            key={item.canonical_name + i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              borderRight: i < displayed.length - 1 ? "6px solid #000" : "none",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {item.image_url ? (
              <img src={item.image_url} alt={item.canonical_name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: "#1a1a1a", zIndex: 0 }} />
            )}

            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "45%", background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)", zIndex: 1, pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35%", background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)", zIndex: 1, pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 2, padding: "36px 32px 0", textAlign: "center" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 54, color: "#fff", margin: 0, lineHeight: 1.05, letterSpacing: "0.02em", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
                {item.canonical_name}
              </h2>
              <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 64, color: "#FFA000", margin: "8px 0 0 0", letterSpacing: "0.03em", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
                {item.pos_price != null ? `€${Number(item.pos_price).toFixed(2)}` : ""}
              </p>
            </div>

            <div style={{ position: "relative", zIndex: 2, marginTop: "auto", padding: "0 28px 32px", textAlign: "center" }}>
              {item.description && (
                <p style={{ fontSize: 18, color: "rgba(255,255,255,0.8)", margin: 0, lineHeight: 1.45, fontWeight: 400, textTransform: "uppercase", textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}>
                  {item.description}
                </p>
              )}
              {item.servings > 0 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
                  {[...Array(item.servings)].map((_, si) => (
                    <svg key={si} width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
