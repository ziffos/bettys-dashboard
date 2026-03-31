"use client";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { supabase } from "../../lib/supabase";

const ORANGE = "#FFA000";
const REF_W = 1920;
const REF_H = 1080;

const S = {
  catTitle: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: 46.5,
    color: "#fff",
    margin: 0,
    borderLeft: `4px solid ${ORANGE}`,
    paddingLeft: 12,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },
  comboName: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: 34,
    color: "#fff",
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
    lineHeight: 1.15,
  },
  desc: {
    fontFamily: "'Nunito', sans-serif",
    fontSize: 15.5,
    color: "#666",
    margin: "2px 0 0 0",
    lineHeight: 1.25,
    textTransform: "uppercase",
    maxWidth: "70%",
  },
  price: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: 29,
    color: ORANGE,
    margin: 0,
    whiteSpace: "nowrap",
    letterSpacing: "0.02em",
  },
  simpleRowName: {
    fontFamily: "'Nunito', sans-serif",
    fontSize: 24,
    color: "#ccc",
    margin: 0,
  },
  simpleRowPrice: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: 29,
    color: ORANGE,
    margin: 0,
    whiteSpace: "nowrap",
  },
};

function ComboItem({ item }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a1a1a", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={S.comboName}>{item.canonical_name}</p>
        {item.description && <p style={S.desc}>{item.description}</p>}
      </div>
      {item.pos_price != null && <p style={S.price}>€{Number(item.pos_price).toFixed(2)}</p>}
    </div>
  );
}

function SimpleRow({ name, price }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
      <p style={S.simpleRowName}>{name}</p>
      {price != null && <p style={S.simpleRowPrice}>€{Number(price).toFixed(2)}</p>}
    </div>
  );
}

function CategoryTitle({ title }) {
  return <h3 style={{ ...S.catTitle, marginBottom: 8 }}>{title}</h3>;
}

function InfoBox({ children }) {
  return (
    <div style={{ marginTop: "auto", background: "#141414", border: "1px solid #222", borderRadius: 8, padding: "14px 20px" }}>
      {children}
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
        .select("canonical_name, category, pos_price, description, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("canonical_name", { ascending: true });
      if (data) setItems(data);
    }
    fetchItems();
    const interval = setInterval(fetchItems, 60000);
    return () => clearInterval(interval);
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

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600&display=swap');
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
        <div style={{ display: "flex", flexDirection: "column", padding: "22px 22px", borderRight: "1px solid #2a2a2a" }}>
          <CategoryTitle title="Fried Chicken Combos" />
          <div style={{ flex: "0 1 auto" }}>
            {chicken.map((item, i) => <ComboItem key={i} item={item} />)}
          </div>
          <InfoBox>
            <p style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 32, color: ORANGE, margin: "0 0 6px 0", letterSpacing: "0.03em" }}>
              Every combo includes
            </p>
            <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 16, color: "#888", margin: "0 0 3px 0", lineHeight: 1.35 }}>
              Choose 1 Side — Fries · Coleslaw · Mashed Potatoes · Rice with Corn
            </p>
            <p style={{ fontFamily: "'Nunito', sans-serif", fontSize: 16, color: "#888", margin: 0, lineHeight: 1.35 }}>
              Choose 1 Soft Drink — Coca-Cola · Fanta · 7Up · Diet options available
            </p>
          </InfoBox>
        </div>

        {/* ─── Column 2: Burgers & Wraps + Products ─── */}
        <div style={{ display: "flex", flexDirection: "column", padding: "22px 22px", borderRight: "1px solid #2a2a2a" }}>
          <CategoryTitle title="Burger & Wrap Combos" />
          <div>
            {burgers.map((item, i) => <ComboItem key={i} item={item} />)}
          </div>
          <div style={{ marginTop: 18 }}>
            <CategoryTitle title="Products" />
            <div>
              {products.map((item, i) => <SimpleRow key={i} name={item.canonical_name} price={item.pos_price} />)}
            </div>
          </div>
        </div>

        {/* ─── Column 3: Sides, Dips, Drinks ─── */}
        <div style={{ display: "flex", flexDirection: "column", padding: "22px 22px" }}>
          <CategoryTitle title="Sides" />
          <div>
            {sides.map((item, i) => <SimpleRow key={i} name={item.canonical_name} price={item.pos_price} />)}
          </div>

          <div style={{ marginTop: 18 }}>
            <CategoryTitle title="Dips" />
            <div>
              {dips.map((item, i) => <SimpleRow key={i} name={item.canonical_name} price={item.pos_price} />)}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <CategoryTitle title="Drinks" />
            <div>
              <SimpleRow name="Soft Drinks 330ml" price={1.50} />
              <SimpleRow name="Water" price={0.80} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
