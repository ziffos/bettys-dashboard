"use client";

/*
 * Animated version of the TV 4 full-menu board — a motion proposal, not yet
 * wired into the live display. Same data contract as tv-display-4.
 *
 * Also fixes a live bug: at 1920x1080 the deployed board's columns measure
 * 1142px, so its bottom rows are cut off below the screen edge. Metrics here
 * are tightened (see M) to fit 1080 exactly.
 *
 * Motion layers:
 *   1. Reading light — a highlight walks row by row down col 1, then 2, then 3.
 *      One pass every MENU_SWEEP_PERIOD_MS, resting in between. A single class
 *      on the board starts every row's animation at its own delay, so ~30 rows
 *      cost one React state change per pass rather than per frame.
 *   2. Boot cascade  — columns in L->R, category rules draw down, rows rise.
 *   3. Combo steps   — 1 -> 2 -> 3 pulse in sequence, so the "build a combo"
 *      instruction actually reads as a sequence.
 *   4. Hero card     — Ken Burns + gloss sweep + slow border glow.
 *   5. QR            — slow breathing glow.
 *   6. Price flash   — a changed price flashes white and its row lights up, so
 *      a menu edit made in the admin app is visibly confirmed on the wall.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "../../lib/supabase";
import { menuSweepAt } from "./motionClock";

const ORANGE = "#FFA000";
const REF_W = 1920;
const REF_H = 1080;

/* Reading light: seconds between consecutive rows, and the pause between
 * finishing one column and starting the next. */
const ROW_STEP = 0.42;
const COL_PAUSE = 1.1;
/* How long one row stays lit as the light passes over it. */
const ROW_ANIM_MS = 1300;

/* Tightened metrics so three dense columns fit inside 1080. */
const M = {
  pad: "20px 28px",
  catTitle: 47,
  catTitleSm: 35,
  comboName: 30,
  desc: 20,
  price: 33,
  rowName: 25,
  fillH: 140,
  fillGap: 14,
  sectionGap: 17,
};

function FormatDesc({ text }) {
  if (!text) return null;
  const parts = text.split("·").map((s) => s.trim()).filter(Boolean);
  return (
    <p className="desc">
      {parts.map((part, i) => {
        const match = part.match(/^(\d+)\s*(pcs|pieces?)?\s*(.+)$/i);
        return (
          <span key={i}>
            {i > 0 && " · "}
            {match ? (
              <>
                <span className="qty">{match[1]}x</span> {match[3].trim()}
              </>
            ) : (
              part
            )}
          </span>
        );
      })}
    </p>
  );
}

/* `d` is the reading-light delay in seconds; `b` the boot-cascade index. */
function ComboItem({ item, d, b, flash }) {
  return (
    <div className="row combo" style={{ "--d": `${d}s`, "--b": b }}>
      <span className="rowLight" style={{ "--d": `${d}s` }} />
      <div className="rowInner" style={{ "--d": `${d}s` }}>
        <div className="rowHead">
          <p className="comboName">{item.canonical_name}</p>
          {item.pos_price != null && (
            <p className={`price${flash ? " flash" : ""}`}>
              €{Number(item.pos_price).toFixed(2)}
            </p>
          )}
        </div>
        <FormatDesc text={item.description} />
      </div>
    </div>
  );
}

function SimpleRow({ name, price, d, b, flash }) {
  return (
    <div className="row simple" style={{ "--d": `${d}s`, "--b": b }}>
      <span className="rowLight" style={{ "--d": `${d}s` }} />
      <div className="rowInner rowHead" style={{ "--d": `${d}s` }}>
        <p className="rowName">{name}</p>
        {price != null && (
          <p className={`price${flash ? " flash" : ""}`}>
            €{Number(price).toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}

function CategoryTitle({ title, size = "lg", d, b }) {
  return (
    <h3
      className={`catTitle${size === "sm" ? " sm" : ""}`}
      style={{ "--d": `${d}s`, "--b": b }}
    >
      <span className="catRule" style={{ "--b": b }} />
      <span className="catText">{title}</span>
    </h3>
  );
}

function HeroCard({ item }) {
  if (!item?.image_url) return null;
  return (
    <div className="hero">
      <div className="heroKb">
        <Image
          src={item.image_url}
          alt={item.canonical_name}
          fill
          sizes="33vw"
          quality={80}
          style={{ objectFit: "cover" }}
        />
      </div>
      <div className="heroScrim" />
      {item.servings > 1 && (
        <div className="heroBadge">★ FEEDS {item.servings}</div>
      )}
      <div className="heroFoot">
        <p className="heroName">{item.canonical_name}</p>
        {item.pos_price != null && (
          <span className="heroPrice">€{Number(item.pos_price).toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}

const STEPS = ["Pick chicken", "Pick a side", "Add a drink"];

function ComboSteps() {
  return (
    <div className="steps">
      {STEPS.map((step, i) => (
        <div key={i} className="step" style={{ "--s": i }}>
          <div className="stepNum" style={{ "--s": i }}>{i + 1}</div>
          <p className="stepText">{step}</p>
        </div>
      ))}
    </div>
  );
}

export default function MenuBoard() {
  const [items, setItems] = useState([]);
  const [scale, setScale] = useState(1);
  const [flashed, setFlashed] = useState(() => new Set());
  const [sweeping, setSweeping] = useState(false);
  const [revision, setRevision] = useState(0);
  const pricesRef = useRef(null);
  const signatureRef = useRef("");

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
      if (!data) return;

      // Flag prices that moved since the last fetch so the row can flash.
      const next = new Map(data.map((d) => [d.canonical_name, d.pos_price]));
      if (pricesRef.current) {
        const changed = new Set();
        for (const [name, price] of next) {
          const before = pricesRef.current.get(name);
          if (before !== undefined && Number(before) !== Number(price)) {
            changed.add(name);
          }
        }
        if (changed.size) {
          setFlashed(changed);
          setTimeout(() => setFlashed(new Set()), 2600);
        }
      }
      pricesRef.current = next;

      const signature = data.map((d) => `${d.canonical_name}|${d.category}`).join("~");
      setItems(data);
      // Replay the boot cascade only when the set of rows changes, not on a
      // price-only edit (that gets the flash instead).
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setRevision((r) => r + 1);
      }
    }
    fetchItems();
    const channel = supabase
      .channel("tv-motion-4")
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

  const bestValue = useMemo(() => {
    const withPhoto = items.filter((i) => i.image_url);
    if (!withPhoto.length) return null;
    return withPhoto.reduce((best, i) =>
      (i.servings ?? 0) !== (best.servings ?? 0)
        ? (i.servings ?? 0) > (best.servings ?? 0) ? i : best
        : (i.pos_price ?? 0) > (best.pos_price ?? 0) ? i : best,
    );
  }, [items]);

  /* Reading-light schedule: walk col 1 top-to-bottom, then col 2, then col 3.
   * Returns per-column delay lookups plus how long a full pass takes. */
  const light = useMemo(() => {
    const columns = [
      [chicken.length],
      [burgers.length, sides.length],
      [products.length, 2],
    ];
    let t = 0;
    const delays = columns.map((groups) =>
      groups.map((n) => {
        const start = t;
        t += n * ROW_STEP + COL_PAUSE;
        return start;
      }),
    );
    return { delays, durationMs: t * 1000 + ROW_ANIM_MS };
  }, [chicken.length, burgers.length, sides.length, products.length]);

  /* The light makes a single pass, then the board rests until the next one.
   * Same wall-clock trick as the showcase boards, so it is deterministic and
   * a reload lands wherever the period actually is. */
  useEffect(() => {
    let cancelled = false;
    let id;
    const step = () => {
      if (cancelled) return;
      const next = menuSweepAt(Date.now(), light.durationMs);
      setSweeping(next.sweeping);
      id = setTimeout(step, Math.max(150, next.msLeft));
    };
    id = setTimeout(step, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [light.durationMs]);

  const d = (col, group, row) => light.delays[col][group] + row * ROW_STEP;
  const isFlashed = (name) => flashed.has(name);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600;700;800&display=swap');
        body { margin: 0; padding: 0; overflow: hidden; background: #0d0d0d; }

        .board {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          background: #0d0d0d;
          font-family: 'Nunito', sans-serif;
          transform-origin: top left;
        }

        .col {
          display: flex;
          flex-direction: column;
          padding: ${M.pad};
          min-height: 0;
          animation: colIn 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(var(--c) * 180ms);
        }
        .col + .col { border-left: 1px solid #2a2a2a; }
        @keyframes colIn {
          from { opacity: 0; transform: translateY(26px); }
          to   { opacity: 1; transform: none; }
        }

        /* ── Category headings ───────────────────────────────────────── */
        .catTitle {
          position: relative;
          display: flex;
          align-items: center;
          gap: 13px;
          font-family: 'Bebas Neue', cursive;
          font-size: ${M.catTitle}px;
          color: #fff;
          margin: 0 0 9px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          line-height: 1.02;
        }
        .catTitle.sm { font-size: ${M.catTitleSm}px; margin-bottom: 6px; }
        .catRule {
          flex: none;
          width: 4px;
          align-self: stretch;
          min-height: 1em;
          background: ${ORANGE};
          transform-origin: top center;
          animation: ruleDraw 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(var(--b) * 60ms + 260ms);
        }
        @keyframes ruleDraw {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        /* The rule brightens as the reading light enters its category. */
        .board.sweeping .catRule {
          animation: rulePulse ease-out both;
          animation-duration: ${ROW_ANIM_MS}ms;
          animation-delay: var(--d);
        }
        @keyframes rulePulse {
          0%, 100% { box-shadow: none; }
          25%      { box-shadow: 0 0 22px 3px rgba(255,160,0,0.85); }
          60%      { box-shadow: none; }
        }
        .catText {
          animation: riseIn 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(var(--b) * 60ms + 300ms);
        }
        @keyframes riseIn {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: none; }
        }

        /* ── Rows + reading light ────────────────────────────────────── */
        .row {
          position: relative;
          border-bottom: 1px solid #1a1a1a;
          animation: riseIn 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(var(--b) * 45ms + 380ms);
        }
        .row.combo { padding: 4px 0; }
        .row.simple { padding: 3px 0; }

        .rowLight {
          position: absolute;
          top: 0; bottom: 0;
          left: -14px; right: -14px;
          border-radius: 8px;
          background: linear-gradient(90deg, rgba(255,160,0,0.20), rgba(255,160,0,0.05) 70%, transparent);
          opacity: 0;
          pointer-events: none;
        }
        .board.sweeping .rowLight {
          animation: rowLight ease-out both;
          animation-duration: ${ROW_ANIM_MS}ms;
          animation-delay: var(--d);
          will-change: opacity;
        }
        @keyframes rowLight {
          0%    { opacity: 0; }
          22%   { opacity: 1; }
          55%   { opacity: 1; }
          100%  { opacity: 0; }
        }
        .rowInner { position: relative; }
        .board.sweeping .rowInner {
          animation: rowNudge ease-out both;
          animation-duration: ${ROW_ANIM_MS}ms;
          animation-delay: var(--d);
          will-change: transform;
        }
        @keyframes rowNudge {
          0%    { transform: translateX(0); }
          25%   { transform: translateX(8px); }
          100%  { transform: translateX(0); }
        }

        .rowHead {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 14px;
        }
        .comboName {
          font-family: 'Bebas Neue', cursive;
          font-size: ${M.comboName}px;
          color: #fff;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          line-height: 1.12;
        }
        .rowName {
          font-family: 'Nunito', sans-serif;
          font-size: ${M.rowName}px;
          color: #ccc;
          margin: 0;
        }
        .desc {
          font-family: 'Nunito', sans-serif;
          font-size: ${M.desc}px;
          color: #9a938c;
          margin: 1px 0 0;
          line-height: 1.28;
          font-weight: 600;
        }
        .qty { color: ${ORANGE}; font-weight: 800; }
        .price {
          font-family: 'Bebas Neue', cursive;
          font-size: ${M.price}px;
          color: ${ORANGE};
          margin: 0;
          white-space: nowrap;
          letter-spacing: 0.02em;
        }
        /* Price just changed in the admin app. */
        .price.flash { animation: priceFlash 2.4s ease-out both; }
        @keyframes priceFlash {
          0%   { color: #fff; transform: scale(1.28); text-shadow: 0 0 26px rgba(255,255,255,0.9); }
          18%  { color: #fff; transform: scale(1.1);  text-shadow: 0 0 22px rgba(255,160,0,0.9); }
          100% { color: ${ORANGE}; transform: scale(1); text-shadow: none; }
        }

        /* ── Dip chips ───────────────────────────────────────────────── */
        .chips { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 9px; }
        .chip {
          background: #191919;
          border: 1px solid #2e2e2e;
          color: #d9d4cf;
          font-weight: 700;
          font-size: 22px;
          line-height: 1;
          padding: 10px 16px;
          border-radius: 999px;
          animation: popIn 600ms cubic-bezier(0.22, 1, 0.36, 1) both,
                     chipGlow 9s ease-in-out infinite;
          animation-delay: calc(var(--k) * 70ms + 700ms), calc(var(--k) * 0.5s + 2s);
        }
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.7); }
          70%  { opacity: 1; transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes chipGlow {
          0%, 88%, 100% { border-color: #2e2e2e; color: #d9d4cf; }
          94%           { border-color: ${ORANGE}; color: #fff; }
        }

        .softNames {
          font-size: ${M.desc}px;
          color: #8a8178;
          margin: 7px 0 0;
          line-height: 1.45;
          font-weight: 600;
        }

        /* ── Bottom fill: hero card + QR ─────────────────────────────── */
        .fill {
          margin-top: auto;
          padding-top: 8px;
          margin-bottom: ${M.fillGap}px;
          display: flex;
          gap: 13px;
          align-items: stretch;
          animation: riseIn 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 900ms;
        }
        .hero {
          position: relative;
          flex: 1;
          min-width: 0;
          height: ${M.fillH}px;
          border-radius: 14px;
          overflow: hidden;
          border: 2px solid ${ORANGE};
          animation: heroGlow 6s ease-in-out infinite;
        }
        @keyframes heroGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(255,160,0,0); }
          50%      { box-shadow: 0 0 32px rgba(255,160,0,0.42); }
        }
        .heroKb {
          position: absolute;
          inset: 0;
          animation: kenburns 26s ease-in-out infinite alternate;
          will-change: transform;
        }
        @keyframes kenburns {
          from { transform: scale(1.02) translate3d(0, 0, 0); }
          to   { transform: scale(1.14) translate3d(-2%, -2%, 0); }
        }
        .heroScrim {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.92) 12%, rgba(0,0,0,0.25) 65%, transparent);
        }
        .heroBadge {
          position: absolute;
          top: 11px; left: 11px;
          background: ${ORANGE};
          color: #141414;
          font-weight: 800;
          font-size: 16px;
          line-height: 1;
          letter-spacing: 0.06em;
          padding: 7px 13px;
          border-radius: 999px;
        }
        .heroFoot {
          position: absolute;
          left: 16px; right: 16px; bottom: 14px;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
        }
        .heroName {
          font-family: 'Bebas Neue', cursive;
          font-size: 34px;
          line-height: 1;
          color: #fff;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .heroPrice {
          position: relative;
          overflow: hidden;
          flex: none;
          background: ${ORANGE};
          color: #141414;
          font-family: 'Bebas Neue', cursive;
          font-size: 32px;
          line-height: 1;
          padding: 8px 16px 5px;
          border-radius: 999px;
          white-space: nowrap;
        }
        .heroPrice::after {
          content: "";
          position: absolute;
          top: 0; left: 0;
          width: 45%;
          height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.65), transparent);
          transform: translateX(-240%) skewX(-18deg);
          animation: shimmer 8s linear 2s infinite;
        }
        @keyframes shimmer {
          0%   { transform: translateX(-240%) skewX(-18deg); }
          14%  { transform: translateX(340%) skewX(-18deg); }
          100% { transform: translateX(340%) skewX(-18deg); }
        }

        /* ── Combo steps: 1 -> 2 -> 3 ────────────────────────────────── */
        .steps {
          margin-top: auto;
          padding-top: 8px;
          margin-bottom: ${M.fillGap}px;
          display: flex;
          gap: 11px;
          animation: riseIn 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 960ms;
        }
        .step {
          flex: 1;
          text-align: center;
          background: #141414;
          border: 1px solid #262626;
          border-radius: 12px;
          padding: 11px 8px;
          animation: stepOn 5.4s ease-in-out infinite;
          animation-delay: calc(var(--s) * 1.8s);
        }
        @keyframes stepOn {
          0%, 100%  { border-color: #262626; background: #141414; transform: translateY(0); }
          8%        { border-color: rgba(255,160,0,0.75); background: #1b1508; transform: translateY(-4px); }
          26%       { border-color: rgba(255,160,0,0.75); background: #1b1508; transform: translateY(-4px); }
          40%       { border-color: #262626; background: #141414; transform: translateY(0); }
        }
        .stepNum {
          width: 32px;
          height: 32px;
          margin: 0 auto 7px;
          border-radius: 999px;
          background: ${ORANGE};
          color: #141414;
          font-family: 'Bebas Neue', cursive;
          font-size: 23px;
          line-height: 32px;
          animation: stepNumOn 5.4s ease-in-out infinite;
          animation-delay: calc(var(--s) * 1.8s);
        }
        @keyframes stepNumOn {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(255,160,0,0); }
          8%       { transform: scale(1.18); box-shadow: 0 0 24px rgba(255,160,0,0.9); }
          26%      { transform: scale(1.18); box-shadow: 0 0 24px rgba(255,160,0,0.9); }
          40%      { transform: scale(1); box-shadow: 0 0 0 rgba(255,160,0,0); }
        }
        .stepText {
          font-family: 'Bebas Neue', cursive;
          font-size: 25px;
          line-height: 1.05;
          color: #fff;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        .section { margin-top: ${M.sectionGap}px; }

        @media (prefers-reduced-motion: reduce) {
          .board.sweeping .rowLight, .board.sweeping .rowInner,
          .heroKb, .heroPrice::after { animation: none !important; }
        }
      `}</style>

      <div
        key={revision}
        className={`board${sweeping ? " sweeping" : ""}`}
        style={{ width: REF_W, height: REF_H, transform: `scale(${scale})` }}
      >
        {/* ─── Column 1: Fried Chicken Combos ─── */}
        <div className="col" style={{ "--c": 0 }}>
          <CategoryTitle title="Fried Chicken Combos" d={d(0, 0, 0)} b={0} />
          <div>
            {chicken.map((item, i) => (
              <ComboItem
                key={item.canonical_name}
                item={item}
                d={d(0, 0, i)}
                b={i + 1}
                flash={isFlashed(item.canonical_name)}
              />
            ))}
          </div>
          <div className="fill">
            <HeroCard item={bestValue} />
          </div>
        </div>

        {/* ─── Column 2: Burgers & Wraps + Sides ─── */}
        <div className="col" style={{ "--c": 1 }}>
          <CategoryTitle title="Burger & Wrap Combos" d={d(1, 0, 0)} b={0} />
          <div>
            {burgers.map((item, i) => (
              <ComboItem
                key={item.canonical_name}
                item={item}
                d={d(1, 0, i)}
                b={i + 1}
                flash={isFlashed(item.canonical_name)}
              />
            ))}
          </div>
          <div className="section">
            <CategoryTitle title="Sides" d={d(1, 1, 0)} b={6} />
            <div>
              {sides.map((item, i) => (
                <SimpleRow
                  key={item.canonical_name}
                  name={item.canonical_name}
                  price={item.pos_price}
                  d={d(1, 1, i)}
                  b={7 + i}
                  flash={isFlashed(item.canonical_name)}
                />
              ))}
            </div>
          </div>
          <ComboSteps />
        </div>

        {/* ─── Column 3: Products, Dips, Drinks ─── */}
        <div className="col" style={{ "--c": 2 }}>
          <CategoryTitle title="Products" d={d(2, 0, 0)} b={0} />
          <div>
            {products.map((item, i) => (
              <SimpleRow
                key={item.canonical_name}
                name={item.canonical_name}
                price={item.pos_price}
                d={d(2, 0, i)}
                b={i + 1}
                flash={isFlashed(item.canonical_name)}
              />
            ))}
          </div>

          <div className="section">
            <CategoryTitle title="Dips — €0.70" size="sm" d={d(2, 1, 0)} b={10} />
            <div className="chips">
              {dips.map((dip, i) => (
                <span key={dip.canonical_name} className="chip" style={{ "--k": i }}>
                  {dip.canonical_name}
                </span>
              ))}
            </div>
          </div>

          <div className="section">
            <CategoryTitle title="Drinks" size="sm" d={d(2, 1, 0) + 1.2} b={12} />
            <div>
              <SimpleRow name="Soft Drinks 330ml" price={softPrice} d={d(2, 1, 0) + 1.2} b={13} />
              {water && (
                <SimpleRow
                  name="Water"
                  price={water.pos_price}
                  d={d(2, 1, 1) + 1.2}
                  b={14}
                  flash={isFlashed(water.canonical_name)}
                />
              )}
            </div>
            {softNames && <p className="softNames">{softNames}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
