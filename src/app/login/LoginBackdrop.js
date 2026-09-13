"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * The login background: a faint blueprint grid where occasional monochrome
 * light streaks travel along the grid lines. Chosen from four prototypes —
 * the stillest of them, so the form stays the loudest thing on the page.
 *
 * Everything is derived from the viewport size through useSyncExternalStore:
 * no effects, no setState, and the geometry is seeded from the size so a
 * re-render cannot reshuffle the streaks mid-flight. On the server it renders
 * nothing — the grid needs a viewport to draw in.
 */

const DIM = "#555"; // mask grey: how much of the grid survives behind the form

function subscribe(cb) {
  let t;
  const onResize = () => {
    clearTimeout(t);
    t = setTimeout(cb, 180); // regenerate once the resize settles, not per pixel
  };
  window.addEventListener("resize", onResize);
  return () => {
    clearTimeout(t);
    window.removeEventListener("resize", onResize);
  };
}
const getSize = () => `${window.innerWidth}x${window.innerHeight}`;
const getServerSize = () => "";

/** Deterministic PRNG so the same viewport always draws the same background. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Orthogonal polyline → SVG path with rounded corners. */
function orthoPath(pts, r) {
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const p = pts[i];
    const b = pts[i + 1];
    const da = { x: Math.sign(p.x - a.x), y: Math.sign(p.y - a.y) };
    const db = { x: Math.sign(b.x - p.x), y: Math.sign(b.y - p.y) };
    const legIn = Math.abs(p.x - a.x) + Math.abs(p.y - a.y);
    const legOut = Math.abs(b.x - p.x) + Math.abs(b.y - p.y);
    const rr = Math.min(r, legIn / 2, legOut / 2);
    d += ` L ${p.x - da.x * rr} ${p.y - da.y * rr} Q ${p.x} ${p.y} ${p.x + db.x * rr} ${p.y + db.y * rr}`;
  }
  const e = pts[pts.length - 1];
  return d + ` L ${e.x} ${e.y}`;
}

function buildScene(w, h) {
  const phone = w < 768;
  const cell = phone ? 44 : 48;
  const rand = mulberry32((w * 73856093) ^ (h * 19349663));
  const rnd = (a, b) => a + rand() * (b - a);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const snap = (v) => Math.round(v / cell) * cell;
  const clampY = (v, a, b) => Math.max(a, Math.min(b, v));

  const streaks = [];
  const add = (pts) => {
    const dur = rnd(8, 13);
    const len = phone ? 0.12 : 0.1;
    const period = len + 1 + rnd(0.6, 1.8); // off-path rest between runs
    streaks.push({
      d: orthoPath(pts, 8),
      period,
      dash: `${len} ${period - len}`,
      anim: `streakTravel ${dur.toFixed(1)}s linear ${(-rnd(0, dur)).toFixed(1)}s infinite`,
    });
  };

  if (phone) {
    // The column fills most of a phone, so the streaks keep to the free bands
    // above the logo and below the footer instead of crossing the form.
    for (const [bandTop, bandBottom] of [
      [0, h * 0.24],
      [h * 0.76, h],
    ]) {
      for (let i = 0; i < 3; i++) {
        const fromLeft = rand() < 0.5;
        let x = fromLeft ? 0 : snap(w);
        let y = snap(rnd(bandTop + 8, bandBottom - 8));
        const dir = fromLeft ? 1 : -1;
        const pts = [{ x, y }];
        for (let leg = 0; leg < 3; leg++) {
          if (leg % 2 === 0) x += dir * snap(rnd(cell * 3, cell * 6));
          else y = clampY(y + pick([-1, 1]) * snap(rnd(cell, cell * 2)), snap(bandTop), snap(bandBottom));
          pts.push({ x, y });
        }
        add(pts);
      }
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const fromLeft = rand() < 0.5;
      let x = fromLeft ? 0 : snap(w);
      let y = snap(rnd(h * 0.1, h * 0.9));
      const dir = fromLeft ? 1 : -1;
      const pts = [{ x, y }];
      const legs = 2 + Math.floor(rnd(1, 3));
      for (let leg = 0; leg < legs; leg++) {
        if (leg % 2 === 0) x += dir * snap(rnd(cell * 4, cell * 12));
        else y = clampY(y + pick([-1, 1]) * snap(rnd(cell * 2, cell * 6)), 0, snap(h));
        pts.push({ x, y });
      }
      add(pts);
    }
  }

  return {
    cell,
    streaks,
    // The mask dims (not erases) the grid behind the column; on a phone the
    // dim zone is taller because the column is.
    fade: { cx: w / 2, cy: h / 2, r: phone ? h * 0.58 : Math.min(w, h) * 0.6 },
    clearing: phone ? "ellipse 340px 560px" : "ellipse 540px 480px",
  };
}

export default function LoginBackdrop() {
  const size = useSyncExternalStore(subscribe, getSize, getServerSize);
  const scene = useMemo(() => {
    if (!size) return null;
    const [w, h] = size.split("x").map(Number);
    return buildScene(w, h);
  }, [size]);

  if (!scene) return null;

  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none">
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <pattern id="login-grid" width={scene.cell} height={scene.cell} patternUnits="userSpaceOnUse">
            <path d={`M ${scene.cell} 0 L 0 0 0 ${scene.cell}`} fill="none" stroke="#eeeeee" strokeWidth="1" />
          </pattern>
          <radialGradient
            id="login-fade"
            gradientUnits="userSpaceOnUse"
            cx={scene.fade.cx}
            cy={scene.fade.cy}
            r={scene.fade.r}
          >
            <stop offset="0" stopColor={DIM} />
            <stop offset=".55" stopColor={DIM} />
            <stop offset="1" stopColor="#fff" />
          </radialGradient>
          <mask id="login-fade-mask">
            <rect width="100%" height="100%" fill="url(#login-fade)" />
          </mask>
        </defs>

        <g mask="url(#login-fade-mask)">
          <rect width="100%" height="100%" fill="url(#login-grid)" />
          <g className="motion-reduce:hidden">
            {scene.streaks.map((s, i) => (
              <g key={i} style={{ "--p": s.period }}>
                <path
                  d={s.d}
                  pathLength="1"
                  fill="none"
                  stroke="rgba(23,23,23,.22)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  style={{ strokeDasharray: s.dash, animation: s.anim, filter: "blur(4px)", opacity: 0.6 }}
                />
                <path
                  d={s.d}
                  pathLength="1"
                  fill="none"
                  stroke="rgba(23,23,23,.22)"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  style={{ strokeDasharray: s.dash, animation: s.anim }}
                />
              </g>
            ))}
          </g>
        </g>
      </svg>

      {/* A soft clearing so the grid never competes with the form itself. */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.55,
          background: `radial-gradient(${scene.clearing} at 50% 52%, var(--color-canvas) 0%, var(--color-canvas) 30%, rgba(250,250,250,0) 78%)`,
        }}
      />
    </div>
  );
}
