"use client";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import { supabase } from "../../lib/supabase";

const ORANGE = "#FFA000";
const REF_W = 1920;
const REF_H = 1080;

const S = {
  catTitle: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: 52,
    color: "#fff",
    margin: 0,
    borderLeft: `4px solid ${ORANGE}`,
    paddingLeft: 14,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  comboName: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: 32,
    color: "#fff",
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    lineHeight: 1.12,
  },
  desc: {
    fontFamily: "'Nunito', sans-serif",
    fontSize: 21,
    color: "#9a938c",
    margin: "2px 0 0 0",
    lineHeight: 1.3,
    fontWeight: 600,
  },
  price: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: 34,
    color: ORANGE,
    margin: 0,
    whiteSpace: "nowrap",
    letterSpacing: "0.02em",
  },
  simpleRowName: {
    fontFamily: "'Nunito', sans-serif",
    fontSize: 26,
    color: "#ccc",
    margin: 0,
  },
  simpleRowPrice: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: 34,
    color: ORANGE,
    margin: 0,
    whiteSpace: "nowrap",
  },
};

function FormatDesc({ text }) {
  if (!text) return null;
  const parts = text.split("·").map((s) => s.trim()).filter(Boolean);
  return (
    <p style={S.desc}>
      {parts.map((part, i) => {
        const match = part.match(/^(\d+)\s*(pcs|pieces?)?\s*(.+)$/i);
        return (
          <span key={i}>
            {i > 0 && " · "}
            {match ? <><span style={{ color: ORANGE, fontWeight: 800 }}>{match[1]}x</span> {match[3].trim()}</> : part}
          </span>
        );
      })}
    </p>
  );
}

function ComboItem({ item }) {
  return (
    <div style={{ padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14 }}>
        <p style={S.comboName}>{item.canonical_name}</p>
        {item.pos_price != null && <p style={S.price}>€{Number(item.pos_price).toFixed(2)}</p>}
      </div>
      <FormatDesc text={item.description} />
    </div>
  );
}

function SimpleRow({ name, price }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #1a1a1a" }}>
      <p style={S.simpleRowName}>{name}</p>
      {price != null && <p style={S.simpleRowPrice}>€{Number(price).toFixed(2)}</p>}
    </div>
  );
}

function CategoryTitle({ title, size = "lg" }) {
  const fontSize = size === "sm" ? 38 : 52;
  const marginBottom = size === "sm" ? 6 : 12;
  return <h3 style={{ ...S.catTitle, fontSize, marginBottom }}>{title}</h3>;
}

// The board is dense: only ~180px is free under column 1 and ~120px under
// column 2. Keep the fills inside that or `margin-top: auto` stops resolving
// and they push into the TV's overscan zone.
const FILL_H = 156;
const FILL_GAP = 20;

/* Hero card for the sharing deal, sat beside the QR under column 1. */
function BestValue({ item }) {
  if (!item?.image_url) return null;
  return (
    <div style={{ flex: 1, minWidth: 0, position: "relative", height: FILL_H, borderRadius: 14, overflow: "hidden", border: `2px solid ${ORANGE}` }}>
      <Image src={item.image_url} alt={item.canonical_name} fill sizes="33vw" quality={75} style={{ objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.92) 12%, rgba(0,0,0,0.25) 65%, transparent)" }} />
      {item.servings > 1 && (
        <div style={{ position: "absolute", top: 12, left: 12, background: ORANGE, color: "#141414", fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 17, lineHeight: 1, letterSpacing: "0.06em", padding: "8px 14px", borderRadius: 999 }}>
          ★ FEEDS {item.servings}
        </div>
      )}
      {/* No description here — the same item is listed in full a few rows above. */}
      <div style={{ position: "absolute", left: 18, right: 18, bottom: 16, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 36, lineHeight: 1, color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: "0.02em" }}>
          {item.canonical_name}
        </p>
        {item.pos_price != null && (
          <span style={{ flex: "none", background: ORANGE, color: "#141414", fontFamily: "'Bebas Neue', cursive", fontSize: 34, lineHeight: 1, padding: "9px 17px 6px", borderRadius: 999, whiteSpace: "nowrap" }}>
            €{Number(item.pos_price).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

const STEPS = ["Pick chicken", "Pick a side", "Add a drink"];

/* Three-step combo explainer — fills the dead space under column 2. */
function ComboSteps() {
  return (
    <div style={{ marginTop: "auto", paddingTop: 8, marginBottom: FILL_GAP, display: "flex", gap: 12 }}>
      {STEPS.map((step, i) => (
        <div key={i} style={{ flex: 1, textAlign: "center", background: "#141414", border: "1px solid #262626", borderRadius: 12, padding: "12px 10px" }}>
          <div style={{ width: 34, height: 34, margin: "0 auto 8px", borderRadius: 999, background: ORANGE, color: "#141414", fontFamily: "'Bebas Neue', cursive", fontSize: 24, lineHeight: "34px" }}>
            {i + 1}
          </div>
          <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 26, lineHeight: 1.05, color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
            {step}
          </p>
        </div>
      ))}
    </div>
  );
}

/* QR to the public /qr-menu page, which carries the Google review link. */
function ScanCard() {
  return (
    <div style={{ flex: "none", width: 134, height: FILL_H, background: "#141414", border: "1px solid #262626", borderRadius: 14, padding: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <div style={{ background: "#fff", borderRadius: 8, padding: 6, lineHeight: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/qr-menu.svg" alt="" width={88} height={88} />
      </div>
      <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 21, lineHeight: 1.05, color: "#fff", margin: 0, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "center", whiteSpace: "nowrap" }}>
        Scan for menu
      </p>
    </div>
  );
}

export default function TvDisplay4Page() {
  const [items, setItems] = useState([]);
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

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
        .select("canonical_name, category, pos_price, description, sort_order, image_url, servings")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("canonical_name", { ascending: true });
      if (data) setItems(data);
    }
    fetchItems();
    const channel = supabase
      .channel("tv-display-4")
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

  const grouped = useMemo(() => {
    const map = {};
    for (const item of items) {
      const cat = item.category || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(item);
    }
    return map;
  }, [items]);

  const chicken = grouped["Fried Chicken Combos"] || [];
  const burgers = grouped["Burger & Wrap Combos"] || [];
  const products = grouped["Products"] || [];
  const sides = grouped["Sides"] || [];
  const dips = grouped["Dips"] || [];
  const drinks = grouped["Drinks"] || [];

  const water = drinks.find((d) => /water/i.test(d.canonical_name));
  const softDrinks = drinks.filter((d) => !/water/i.test(d.canonical_name));
  const softPrice = softDrinks[0]?.pos_price ?? 1.5;
  const softNames = softDrinks
    .map((d) => d.canonical_name.replace(/\s*330ml/i, "").trim())
    .join(" · ");

  // Biggest sharing deal that has a photo — the Family Deal today, but it
  // follows the data rather than naming an item.
  const bestValue = useMemo(() => {
    const withPhoto = items.filter((i) => i.image_url);
    if (!withPhoto.length) return null;
    return withPhoto.reduce((best, i) =>
      (i.servings ?? 0) !== (best.servings ?? 0)
        ? (i.servings ?? 0) > (best.servings ?? 0) ? i : best
        : (i.pos_price ?? 0) > (best.pos_price ?? 0) ? i : best,
    );
  }, [items]);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600;700;800&display=swap');
        body { margin: 0; padding: 0; overflow: hidden; background: #0d0d0d; }
      `}</style>
      <div
        ref={containerRef}
        style={{
          width: REF_W,
          height: REF_H,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          background: "#0d0d0d",
          fontFamily: "'Nunito', sans-serif",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* ─── Column 1: Fried Chicken Combos ─── */}
        <div style={{ display: "flex", flexDirection: "column", padding: "26px 30px", borderRight: "1px solid #2a2a2a" }}>
          <CategoryTitle title="Fried Chicken Combos" />
          <div>
            {chicken.map((item, i) => <ComboItem key={i} item={item} />)}
          </div>
          <div style={{ marginTop: "auto", paddingTop: 8, marginBottom: FILL_GAP, display: "flex", gap: 14, alignItems: "stretch" }}>
            <BestValue item={bestValue} />
            <ScanCard />
          </div>
        </div>

        {/* ─── Column 2: Burgers & Wraps + Sides ─── */}
        <div style={{ display: "flex", flexDirection: "column", padding: "26px 30px", borderRight: "1px solid #2a2a2a" }}>
          <CategoryTitle title="Burger & Wrap Combos" />
          <div>
            {burgers.map((item, i) => <ComboItem key={i} item={item} />)}
          </div>
          <div style={{ marginTop: 22 }}>
            <CategoryTitle title="Sides" />
            <div>
              {sides.map((item, i) => <SimpleRow key={i} name={item.canonical_name} price={item.pos_price} />)}
            </div>
          </div>
          <ComboSteps />
        </div>

        {/* ─── Column 3: Products, Dips, Drinks ─── */}
        <div style={{ display: "flex", flexDirection: "column", padding: "26px 30px" }}>
          <CategoryTitle title="Products" />
          <div>
            {products.map((item, i) => <SimpleRow key={i} name={item.canonical_name} price={item.pos_price} />)}
          </div>

          <div style={{ marginTop: 22 }}>
            <CategoryTitle title="Dips — €0.70" size="sm" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
              {dips.map((d, i) => (
                <span key={i} style={{ background: "#191919", border: "1px solid #2e2e2e", color: "#d9d4cf", fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 23, lineHeight: 1, padding: "11px 17px", borderRadius: 999 }}>
                  {d.canonical_name}
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <CategoryTitle title="Drinks" size="sm" />
            <div>
              <SimpleRow name="Soft Drinks 330ml" price={softPrice} />
              {water && <SimpleRow name="Water" price={water.pos_price} />}
            </div>
            {softNames && (
              <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 21, color: "#8a8178", margin: "8px 0 0", lineHeight: 1.5, fontWeight: 600 }}>
                {softNames}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
