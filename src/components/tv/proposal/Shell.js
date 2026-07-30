"use client";

/*
 * Shared 1920x1080 scale-to-fit shell for the menu-restructure proposal boards,
 * plus the styling every one of them uses. Same approach as the live boards:
 * lay out at native resolution, then scale the whole thing to the screen.
 */

import { useCallback, useEffect, useState } from "react";
import { ORANGE } from "./data";

const REF_W = 1920;
const REF_H = 1080;

export default function Shell({ step, title, hint, children }) {
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    setScale(Math.min(window.innerWidth / REF_W, window.innerHeight / REF_H));
  }, []);

  useEffect(() => {
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [updateScale]);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Nunito:wght@400;600;700;800&display=swap');
        body { margin: 0; padding: 0; overflow: hidden; background: #0d0d0d; }

        .pboard {
          position: relative;
          display: flex;
          flex-direction: column;
          background: #0d0d0d;
          font-family: 'Nunito', sans-serif;
          transform-origin: top left;
          overflow: hidden;
        }

        /* ── Header ─────────────────────────────────────────────────── */
        .phead {
          flex: none;
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 28px 44px 0;
        }
        .pstep {
          flex: none;
          font-family: 'Bebas Neue', cursive;
          font-size: 26px;
          line-height: 1;
          letter-spacing: 0.1em;
          color: #141414;
          background: ${ORANGE};
          padding: 11px 18px 8px;
          border-radius: 999px;
        }
        .ptitle {
          font-family: 'Bebas Neue', cursive;
          font-size: 62px;
          line-height: 1;
          color: #fff;
          margin: 0;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .phint {
          margin-left: auto;
          font-size: 24px;
          font-weight: 700;
          color: #8a8178;
          text-align: right;
          line-height: 1.25;
        }
        .phint b { color: ${ORANGE}; font-weight: 800; }

        .pbody { flex: 1; min-height: 0; display: flex; }

        /* ── Ken Burns, shared by every photo on these boards ───────── */
        .pkb {
          position: absolute;
          inset: 0;
          z-index: 0;
          animation: pKenburns 34s ease-in-out infinite alternate;
          will-change: transform;
        }
        .pkb.alt { animation-name: pKenburnsAlt; }
        @keyframes pKenburns {
          from { transform: scale(1.03) translate3d(0, 0, 0); }
          to   { transform: scale(1.13) translate3d(-1.5%, -1.5%, 0); }
        }
        @keyframes pKenburnsAlt {
          from { transform: scale(1.12) translate3d(1.4%, 1%, 0); }
          to   { transform: scale(1.02) translate3d(0, -0.5%, 0); }
        }

        /* ── Shared bits ────────────────────────────────────────────── */
        .ppill {
          display: inline-block;
          background: ${ORANGE};
          color: #141414;
          font-family: 'Bebas Neue', cursive;
          line-height: 1;
          border-radius: 999px;
          letter-spacing: 0.02em;
        }
        .pbar {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          height: 8px;
          background: ${ORANGE};
          overflow: hidden;
          z-index: 6;
        }
        .pbar::after {
          content: "";
          position: absolute;
          inset: 0;
          width: 18%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
          transform: translateX(-120%);
          animation: pRunner 7s linear infinite;
        }
        @keyframes pRunner {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(680%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .pkb, .pbar::after { animation: none !important; }
        }
      `}</style>

      <div
        className="pboard"
        style={{ width: REF_W, height: REF_H, transform: `scale(${scale})` }}
      >
        <div className="phead">
          {step && <span className="pstep">STEP {step}</span>}
          <h1 className="ptitle">{title}</h1>
          {hint && <div className="phint">{hint}</div>}
        </div>
        <div className="pbody">{children}</div>
        <div className="pbar" />
      </div>
    </>
  );
}
