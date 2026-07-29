"use client";

/*
 * Animated version of the TV 1/2/3 showcase board — a motion proposal, not yet
 * wired into the live displays. Same data contract as tv-display-1..3 (4 slots
 * from `menu_items` filtered on tv_number), same 1920x1080 scale-to-fit shell.
 *
 * Motion layers, slowest to fastest:
 *   1. Ken Burns   — each photo drifts + zooms on its own 30s phase, forever.
 *   2. Spotlight   — every HERO_MS one panel widens and brightens; siblings dim.
 *   3. Light bar   — a highlight runs along the shared orange base bar.
 *   4. Shimmer     — a gloss sweep crosses each price pill on its own phase.
 *   5. Boot        — one-shot cascade whenever the slot contents actually change.
 *
 * Everything animated is transform / opacity / box-shadow, except the panel
 * width (flex-grow), which reflows 4 boxes once every 7s — cheap enough for the
 * Android sticks these run on, and it's what makes the spotlight read as
 * cinematic rather than as a brightness flicker.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "../../lib/supabase";

const REF_W = 1920;
const REF_H = 1080;
const ORANGE = "#FFA000";

const SLOTS = 4;
const HERO_MS = 7000; // spotlight dwell per panel
const HERO_GROW = 1.62; // hero flex-grow vs. 1 for the rest

function DescriptionLines({ text }) {
  if (!text) return null;
  const parts = text.split("·").map((s) => s.trim()).filter(Boolean);
  return (
    <div className="descWrap">
      {parts.map((part, i) => {
        const match = part.match(/^(\d+)\s*(pcs|pieces?)?\s*(.+)$/i);
        return (
          <p key={i} className="descLine" style={{ "--i": i }}>
            {match ? (
              <>
                <span className="qty">{match[1]}x</span> {match[3].trim()}
              </>
            ) : (
              part
            )}
          </p>
        );
      })}
    </div>
  );
}

export default function ShowcaseBoard({ tvNumber }) {
  const [items, setItems] = useState([]);
  const [scale, setScale] = useState(1);
  const [tick, setTick] = useState(0);
  // Bumped only when the slot contents change, so the boot cascade replays on a
  // real menu edit but not on every realtime echo.
  const [revision, setRevision] = useState(0);
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
        .select("canonical_name, description, pos_price, image_url, servings, position")
        .eq("is_active", true)
        .eq("tv_number", tvNumber)
        .order("position", { ascending: true });
      if (!data) return;
      const signature = data
        .map((d) => `${d.canonical_name}|${d.pos_price}|${d.image_url}|${d.description}`)
        .join("~");
      setItems(data);
      if (signature !== signatureRef.current) {
        signatureRef.current = signature;
        setRevision((r) => r + 1);
      }
    }
    fetchItems();
    const channel = supabase
      .channel(`tv-motion-${tvNumber}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        fetchItems,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tvNumber]);

  const displayed = useMemo(() => items.slice(0, SLOTS), [items]);

  // Advance the spotlight. `tick` counts up forever and the hero index is
  // derived from it, so a slot count change can never leave hero out of range.
  useEffect(() => {
    if (displayed.length < 2) return;
    const id = setInterval(() => setTick((t) => t + 1), HERO_MS);
    return () => clearInterval(id);
  }, [displayed.length]);

  const hero = displayed.length ? tick % displayed.length : 0;

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600;700;800&display=swap');
        body { margin: 0; padding: 0; overflow: hidden; background: #000; }

        .board {
          position: relative;
          display: flex;
          background: #000;
          font-family: 'Nunito', sans-serif;
          transform-origin: top left;
        }

        /* ── Panel shell ─────────────────────────────────────────────── */
        .panel {
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          flex-basis: 0;
          min-width: 0;
          transition: flex-grow 1100ms cubic-bezier(0.65, 0, 0.35, 1);
          animation: panelIn 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(var(--i) * 140ms);
          will-change: flex-grow;
        }
        .panel + .panel { border-left: 6px solid #000; }

        @keyframes panelIn {
          from { opacity: 0; transform: translateY(40px) scale(1.03); }
          to   { opacity: 1; transform: none; }
        }

        /* ── Ken Burns ───────────────────────────────────────────────── */
        .kb {
          position: absolute;
          inset: 0;
          z-index: 0;
          animation: kenburns 30s ease-in-out infinite alternate;
          animation-delay: calc(var(--i) * -7.5s);
          will-change: transform;
          transition: filter 1100ms ease;
        }
        .panel:not(.hero) .kb { filter: saturate(0.7); }
        @keyframes kenburns {
          from { transform: scale(1.03) translate3d(0, 0, 0); }
          to   { transform: scale(1.13) translate3d(-1.6%, -1.4%, 0); }
        }
        /* Odd panels drift the other way so the board never pulses in unison. */
        .panel:nth-child(even) .kb { animation-name: kenburnsAlt; }
        @keyframes kenburnsAlt {
          from { transform: scale(1.12) translate3d(1.5%, 1%, 0); }
          to   { transform: scale(1.02) translate3d(0, -0.5%, 0); }
        }

        /* ── Legibility + spotlight dimming ──────────────────────────── */
        .gradTop, .gradBot, .dim, .rim, .vignette {
          position: absolute;
          pointer-events: none;
        }
        .gradTop {
          top: 0; left: 0; right: 0; height: 48%;
          background: linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 60%, transparent 100%);
          z-index: 1;
        }
        .gradBot {
          bottom: 0; left: 0; right: 0; height: 42%;
          background: linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 55%, transparent 100%);
          z-index: 1;
        }
        .vignette {
          inset: 0; z-index: 1;
          background: radial-gradient(120% 90% at 50% 45%, transparent 45%, rgba(0,0,0,0.42) 100%);
        }
        .dim {
          inset: 0; z-index: 2;
          background: #000;
          opacity: 0.46;
          transition: opacity 1100ms cubic-bezier(0.65, 0, 0.35, 1);
        }
        .hero .dim { opacity: 0; }

        /* Orange rim-light on the featured panel. */
        .rim {
          inset: 0; z-index: 3;
          box-shadow: inset 0 0 0 3px rgba(255,160,0,0.85),
                      inset 0 0 90px rgba(255,160,0,0.16);
          opacity: 0;
          transition: opacity 900ms ease;
        }
        .hero .rim { opacity: 1; }

        /* ── Content ─────────────────────────────────────────────────── */
        .top {
          position: relative;
          z-index: 4;
          padding: 36px 32px 0;
          text-align: center;
          transform-origin: top center;
          transition: transform 1100ms cubic-bezier(0.65, 0, 0.35, 1),
                      opacity 1100ms ease;
          transform: scale(0.94);
          opacity: 0.86;
        }
        .hero .top { transform: scale(1); opacity: 1; }
        .top.hasBadge { padding-top: 84px; }

        .bottom {
          position: relative;
          z-index: 4;
          margin-top: auto;
          padding: 0 28px 44px;
          text-align: center;
          transform-origin: bottom center;
          transition: transform 1100ms cubic-bezier(0.65, 0, 0.35, 1),
                      opacity 1100ms ease;
          transform: scale(0.94);
          opacity: 0.82;
        }
        .hero .bottom { transform: scale(1); opacity: 1; }

        /* Fixed two-line box: long names wrap when a panel is in its narrow
         * state, and reserving the height keeps every panel's price pill on the
         * same baseline as the spotlight moves. */
        .name {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 2.1em;
          font-family: 'Bebas Neue', cursive;
          font-size: 52px;
          color: #fff;
          margin: 0;
          line-height: 1.05;
          letter-spacing: 0.02em;
          text-align: center;
          text-wrap: balance;
          text-shadow: 0 2px 10px rgba(0,0,0,0.6);
          animation: riseIn 800ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(var(--i) * 140ms + 200ms);
        }
        /* Rule that draws itself under the featured item's name. */
        .nameRule {
          height: 3px;
          width: 96px;
          margin: 12px auto 0;
          background: ${ORANGE};
          border-radius: 2px;
          transform: scaleX(0);
          transition: transform 900ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .hero .nameRule { transform: scaleX(1); }

        @keyframes riseIn {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: none; }
        }

        .pillWrap {
          margin-top: 14px;
          animation: pillPop 900ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(var(--i) * 140ms + 340ms);
        }
        @keyframes pillPop {
          0%   { opacity: 0; transform: scale(0.55); }
          62%  { opacity: 1; transform: scale(1.09); }
          100% { opacity: 1; transform: scale(1); }
        }

        .pill {
          position: relative;
          overflow: hidden;
          display: inline-block;
          background: ${ORANGE};
          color: #141414;
          font-family: 'Bebas Neue', cursive;
          font-size: 52px;
          line-height: 1;
          padding: 10px 28px 6px;
          border-radius: 999px;
          letter-spacing: 0.03em;
          box-shadow: 0 6px 18px rgba(0,0,0,0.45);
          transition: box-shadow 1100ms ease;
        }
        .hero .pill {
          box-shadow: 0 6px 18px rgba(0,0,0,0.45),
                      0 0 46px rgba(255,160,0,0.55);
        }
        /* Gloss sweep — GPU-only, phase-offset per panel. */
        .pill::after {
          content: "";
          position: absolute;
          top: 0; left: 0;
          width: 45%;
          height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.6), transparent);
          transform: translateX(-240%) skewX(-18deg);
          animation: shimmer 9s linear infinite;
          animation-delay: calc(var(--i) * 1.7s + 1.6s);
        }
        @keyframes shimmer {
          0%   { transform: translateX(-240%) skewX(-18deg); }
          14%  { transform: translateX(340%) skewX(-18deg); }
          100% { transform: translateX(340%) skewX(-18deg); }
        }

        /* ── Feeds badge ─────────────────────────────────────────────── */
        .badge {
          position: absolute;
          top: 24px;
          left: 50%;
          z-index: 5;
          overflow: hidden;
          background: ${ORANGE};
          color: #141414;
          font-weight: 800;
          font-size: 22px;
          padding: 10px 20px;
          border-radius: 999px;
          letter-spacing: 0.06em;
          white-space: nowrap;
          animation: badgeIn 900ms cubic-bezier(0.22, 1, 0.36, 1) both,
                     badgeGlow 3.4s ease-in-out 1.2s infinite;
          animation-delay: calc(var(--i) * 140ms + 480ms), 1.2s;
        }
        @keyframes badgeIn {
          0%   { opacity: 0; transform: translate(-50%, -14px) scale(0.8); }
          100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        @keyframes badgeGlow {
          0%, 100% { box-shadow: 0 6px 16px rgba(0,0,0,0.5), 0 0 0 rgba(255,160,0,0); }
          50%      { box-shadow: 0 6px 16px rgba(0,0,0,0.5), 0 0 34px rgba(255,160,0,0.75); }
        }
        .badge::after {
          content: "";
          position: absolute;
          top: 0; left: 0;
          width: 40%;
          height: 100%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.75), transparent);
          transform: translateX(-260%) skewX(-18deg);
          animation: shimmer 7s linear 2.2s infinite;
        }

        /* ── Description + servings ──────────────────────────────────── */
        .descWrap { display: flex; flex-direction: column; gap: 4px; align-items: center; }
        .descLine {
          font-size: 24px;
          color: #fff;
          margin: 0;
          line-height: 1.3;
          font-weight: 600;
          text-shadow: 0 2px 8px rgba(0,0,0,0.85);
          animation: riseIn 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(var(--p) * 140ms + var(--i) * 70ms + 560ms);
        }
        .qty { color: ${ORANGE}; font-weight: 800; }

        .servings { display: flex; justify-content: center; gap: 6px; margin-top: 14px; }
        .servings svg {
          animation: popIn 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(var(--p) * 140ms + var(--i) * 90ms + 820ms);
        }
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.3); }
          70%  { opacity: 1; transform: scale(1.18); }
          100% { opacity: 1; transform: scale(1); }
        }

        /* ── Shared base bar with a travelling highlight ─────────────── */
        .bar {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 8px;
          background: ${ORANGE};
          overflow: hidden;
          z-index: 6;
        }
        .bar::after {
          content: "";
          position: absolute;
          inset: 0;
          width: 18%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
          transform: translateX(-120%);
          animation: runner 7s linear infinite;
        }
        @keyframes runner {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(680%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .kb, .bar::after, .pill::after, .badge::after { animation: none !important; }
        }
      `}</style>

      <div
        key={revision}
        className="board"
        style={{ width: REF_W, height: REF_H, transform: `scale(${scale})` }}
      >
        {displayed.map((item, i) => {
          const isFeatured = item.servings >= 4;
          const isHero = i === hero;
          return (
            <div
              key={`${item.canonical_name}-${i}`}
              className={`panel${isHero ? " hero" : ""}`}
              style={{ "--i": i, flexGrow: isHero ? HERO_GROW : 1 }}
            >
              <div className="kb" style={{ "--i": i }}>
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.canonical_name}
                    fill
                    sizes="50vw"
                    quality={80}
                    priority={i === 0}
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ position: "absolute", inset: 0, background: "#1a1a1a" }} />
                )}
              </div>

              <div className="vignette" />
              <div className="gradTop" />
              <div className="gradBot" />
              <div className="dim" />
              <div className="rim" />

              {isFeatured && (
                <div className="badge" style={{ "--i": i }}>
                  ★ FEEDS {item.servings}
                </div>
              )}

              <div className={`top${isFeatured ? " hasBadge" : ""}`}>
                <h2 className="name" style={{ "--i": i }}>
                  {item.canonical_name}
                </h2>
                <div className="nameRule" />
                {item.pos_price != null && (
                  <div className="pillWrap" style={{ "--i": i }}>
                    <span className="pill" style={{ "--i": i }}>
                      €{Number(item.pos_price).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="bottom" style={{ "--p": i }}>
                <DescriptionLines text={item.description} />
                {item.servings > 0 && (
                  <div className="servings">
                    {[...Array(item.servings)].map((_, si) => (
                      <svg
                        key={si}
                        style={{ "--i": si }}
                        width={22}
                        height={22}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={ORANGE}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className="bar" />
      </div>
    </>
  );
}
