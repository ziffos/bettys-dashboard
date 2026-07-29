"use client";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { supabase } from "../../lib/supabase";

const REF_W = 1920;
const REF_H = 1080;
const ORANGE = "#FFA000";
const TV_NUMBER = 1;

function DescriptionLines({ text }) {
  if (!text) return null;
  const parts = text.split("·").map((s) => s.trim()).filter(Boolean);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
      {parts.map((part, i) => {
        const match = part.match(/^(\d+)\s*(pcs|pieces?)?\s*(.+)$/i);
        if (match) {
          const qty = match[1];
          const rest = match[3].trim();
          return (
            <p key={i} style={{ fontSize: 24, color: "#fff", margin: 0, lineHeight: 1.3, fontWeight: 600, textShadow: "0 2px 8px rgba(0,0,0,0.85)", fontFamily: "'Nunito', sans-serif" }}>
              <span style={{ color: ORANGE, fontWeight: 800 }}>{qty}x</span>{" "}{rest}
            </p>
          );
        }
        return (
          <p key={i} style={{ fontSize: 24, color: "#fff", margin: 0, lineHeight: 1.3, fontWeight: 600, textShadow: "0 2px 8px rgba(0,0,0,0.85)", fontFamily: "'Nunito', sans-serif" }}>
            {part}
          </p>
        );
      })}
    </div>
  );
}

export default function TvDisplayPage() {
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
        .select("canonical_name, description, pos_price, image_url, servings, position")
        .eq("is_active", true)
        .eq("tv_number", TV_NUMBER)
        .order("position", { ascending: true });
      if (data) setItems(data);
    }
    fetchItems();
    const channel = supabase
      .channel(`tv-display-${TV_NUMBER}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        fetchItems,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const displayed = items.slice(0, 4);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600;700;800&display=swap');
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
        {displayed.map((item, i) => {
          const isFeatured = item.servings >= 4;
          return (
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
              {/* Background image */}
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.canonical_name}
                  fill
                  sizes="25vw"
                  quality={75}
                  priority={i === 0}
                  style={{ objectFit: "cover", zIndex: 0 }}
                />
              ) : (
                <div style={{ position: "absolute", inset: 0, background: "#1a1a1a", zIndex: 0 }} />
              )}

              {/* Top gradient for name/price readability */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "48%", background: "linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 60%, transparent 100%)", zIndex: 1, pointerEvents: "none" }} />

              {/* Bottom gradient for description readability */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "40%", background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 55%, transparent 100%)", zIndex: 1, pointerEvents: "none" }} />

              {/* Featured badge */}
              {isFeatured && (
                <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", zIndex: 4, background: ORANGE, color: "#141414", fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 22, padding: "10px 20px", borderRadius: 999, letterSpacing: "0.06em", whiteSpace: "nowrap", boxShadow: "0 6px 16px rgba(0,0,0,0.5)" }}>
                  ★ FEEDS {item.servings}
                </div>
              )}

              {/* Top area: name + price plaque */}
              <div style={{ position: "relative", zIndex: 2, padding: isFeatured ? "84px 32px 0" : "36px 32px 0", textAlign: "center" }}>
                <h2 style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 54, color: "#fff", margin: 0, lineHeight: 1.05, letterSpacing: "0.02em", textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>
                  {item.canonical_name}
                </h2>
                {item.pos_price != null && (
                  <div style={{ marginTop: 14 }}>
                    <span style={{ display: "inline-block", background: ORANGE, color: "#141414", fontFamily: "'Bebas Neue', cursive", fontSize: 52, lineHeight: 1, padding: "10px 28px 6px", borderRadius: 999, letterSpacing: "0.03em", boxShadow: "0 6px 18px rgba(0,0,0,0.45)" }}>
                      €{Number(item.pos_price).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom area: description + servings */}
              <div style={{ position: "relative", zIndex: 2, marginTop: "auto", padding: "0 28px 36px", textAlign: "center" }}>
                <DescriptionLines text={item.description} />
                {item.servings > 0 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
                    {[...Array(item.servings)].map((_, si) => (
                      <svg key={si} width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    ))}
                  </div>
                )}
              </div>

              {/* Orange accent bar */}
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: ORANGE, zIndex: 3 }} />
            </div>
          );
        })}
      </div>
    </>
  );
}
