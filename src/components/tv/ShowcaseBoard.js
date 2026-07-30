"use client";

/*
 * Animated showcase board for TV 1, 2 and 3 — a motion proposal, not yet wired
 * into the live displays. Same data contract as tv-display-1..3 (4 slots from
 * `menu_items` filtered on tv_number), same 1920x1080 scale-to-fit shell.
 *
 * The spotlight is shared across all three screens: see motionClock.js. During
 * the calm phase every dish on every screen wears the activated design; during
 * the feature phase only one dish anywhere across the three screens keeps it
 * and also widens, while the rest dim back. The turn walks slot 1..4 of TV1,
 * then TV2, then TV3.
 *
 * Motion layers, slowest to fastest:
 *   1. Ken Burns   — each photo drifts + zooms on its own 30s phase, forever.
 *   2. Spotlight   — clock-synced, one dish at a time across the three screens.
 *   3. Light bar   — a highlight runs along the shared orange base bar.
 *   4. Shimmer     — a gloss sweep crosses each price pill on its own phase.
 *   5. Boot        — one-shot cascade whenever the slot contents actually change.
 *
 * Everything animated is transform / opacity, except the panel width
 * (flex-grow), which reflows 4 boxes once per turn — cheap enough for the
 * Android sticks these run on, and it's what makes the spotlight read as
 * cinematic rather than as a brightness flicker.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "../../lib/supabase";
import {
  SLOTS_PER_TV,
  SPOTLIGHT_MS,
  calmOverrideFromUrl,
  heroForTv,
  phaseAt,
} from "./motionClock";

const REF_W = 1920;
const REF_H = 1080;
const ORANGE = "#FFA000";

const HERO_GROW = 1.62; // featured panel's flex-grow vs. 1 for the rest

/* Names are kept to a single line. A panel is at its narrowest while a sibling
 * on the same screen holds the spotlight: 1920 / (HERO_GROW + 3) minus the 32px
 * side padding. Sizing against that worst case means the font is fixed, so the
 * text never reflows while the panel animates. */
const NAME_AVAIL = Math.floor(REF_W / (HERO_GROW + SLOTS_PER_TV - 1)) - 64;
const NAME_MAX = 52;
const NAME_MIN = 24;
const BEBAS_CHAR_EM = 0.44; // measured average advance for Bebas Neue caps

function nameSize(name) {
  if (!name) return NAME_MAX;
  const fit = Math.floor(NAME_AVAIL / (name.length * BEBAS_CHAR_EM));
  return Math.max(NAME_MIN, Math.min(NAME_MAX, fit));
}

/* One size for all four panels on a screen — whatever the longest name needs.
 * Per-item sizing fits more text but makes neighbouring panels look mismatched. */
function boardNameSize(names) {
  return names.reduce((min, n) => Math.min(min, nameSize(n)), NAME_MAX);
}

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
  // null on first paint so the server-rendered markup and the client agree;
  // the ticker below fills it in a frame later.
  const [phase, setPhase] = useState(null);
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

  // Re-render once per phase change rather than on a fast interval: 13 renders
  // per cycle instead of a few hundred.
  useEffect(() => {
    let cancelled = false;
    let id;
    const calmMs = calmOverrideFromUrl();
    const step = () => {
      if (cancelled) return;
      const next = phaseAt(Date.now(), calmMs);
      setPhase(next);
      id = setTimeout(step, Math.max(120, next.msLeft));
    };
    id = setTimeout(step, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, []);

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

  const displayed = useMemo(() => items.slice(0, SLOTS_PER_TV), [items]);
  const nameFont = useMemo(
    () => boardNameSize(displayed.map((d) => d.canonical_name)),
    [displayed],
  );

  const calm = !phase || phase.calm;
  const hero = heroForTv(tvNumber, phase);

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
          transition: flex-grow ${SPOTLIGHT_MS}ms cubic-bezier(0.65, 0, 0.35, 1);
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
          transition: filter ${SPOTLIGHT_MS}ms ease;
          filter: saturate(0.7);
        }
        /* Full colour when nothing is featured, or when this panel is. */
        .panel.activated .kb { filter: none; }
        @keyframes kenburns {
          from { transform: scale(1.03) translate3d(0, 0, 0); }
          to   { transform: scale(1.13) translate3d(-1.6%, -1.4%, 0); }
        }
        /* Even panels drift the other way so the board never pulses in unison. */
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
          transition: opacity ${SPOTLIGHT_MS}ms cubic-bezier(0.65, 0, 0.35, 1);
        }
        .panel.activated .dim { opacity: 0; }

        /* Orange rim-light on the featured panel only. */
        .rim {
          inset: 0; z-index: 3;
          box-shadow: inset 0 0 0 3px rgba(255,160,0,0.85),
                      inset 0 0 90px rgba(255,160,0,0.16);
          opacity: 0;
          transition: opacity ${SPOTLIGHT_MS}ms ease;
        }
        .panel.activated .rim { opacity: 1; }

        /* ── Content ─────────────────────────────────────────────────── */
        .top {
          position: relative;
          z-index: 4;
          padding: 40px 32px 0;
          text-align: center;
          transform-origin: top center;
          transition: transform ${SPOTLIGHT_MS}ms cubic-bezier(0.65, 0, 0.35, 1),
                      opacity ${SPOTLIGHT_MS}ms ease;
          transform: scale(0.94);
          opacity: 0.86;
        }
        .panel.activated .top { transform: scale(1); opacity: 1; }

        .bottom {
          position: relative;
          z-index: 4;
          margin-top: auto;
          padding: 0 28px 44px;
          text-align: center;
          transform-origin: bottom center;
          transition: transform ${SPOTLIGHT_MS}ms cubic-bezier(0.65, 0, 0.35, 1),
                      opacity ${SPOTLIGHT_MS}ms ease;
          transform: scale(0.94);
          opacity: 0.82;
        }
        .panel.activated .bottom { transform: scale(1); opacity: 1; }

        /* Single line, always. Font size is picked per item to fit the narrow
         * state; the fixed box height keeps every price pill on one baseline. */
        .nameBox {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 62px;
        }
        .name {
          font-family: 'Bebas Neue', cursive;
          color: #fff;
          margin: 0;
          line-height: 1;
          letter-spacing: 0.02em;
          white-space: nowrap;
          text-shadow: 0 2px 10px rgba(0,0,0,0.6);
          animation: riseIn 800ms cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: calc(var(--i) * 140ms + 200ms);
        }
        /* Rule that draws itself under the featured item's name. */
        .nameRule {
          height: 3px;
          width: 96px;
          margin: 10px auto 0;
          background: ${ORANGE};
          border-radius: 2px;
          transform: scaleX(0);
          transition: transform ${SPOTLIGHT_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .panel.activated .nameRule { transform: scaleX(1); }

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
          transition: box-shadow ${SPOTLIGHT_MS}ms ease;
        }
        .panel.activated .pill {
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
          .kb, .bar::after, .pill::after { animation: none !important; }
        }
      `}</style>

      <div
        key={revision}
        className={`board${calm ? " calm" : ""}`}
        style={{ width: REF_W, height: REF_H, transform: `scale(${scale})` }}
      >
        {displayed.map((item, i) => {
          const isHero = !calm && i === hero;
          // During the calm phase every dish wears the activated design; during
          // the feature phase only the one whose turn it is.
          const isActivated = calm || isHero;
          return (
            <div
              key={`${item.canonical_name}-${i}`}
              className={`panel${isHero ? " hero" : ""}${isActivated ? " activated" : ""}`}
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

              <div className="top">
                <div className="nameBox">
                  <h2 className="name" style={{ "--i": i, fontSize: nameFont }}>
                    {item.canonical_name}
                  </h2>
                </div>
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
