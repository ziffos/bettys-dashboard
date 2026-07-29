"use client";

/*
 * Side-by-side review page for the TV motion proposal.
 *
 * Named tv-display-* so ClientLayout serves it with no sidebar and no login,
 * the same way the boards themselves are served.
 *
 * Each pane is a live iframe of a real board at native 1920x1080, scaled to
 * fit — the same technique as the previews on /tv-displays. That keeps this
 * page a few KB (no video assets to ship), always shows current Supabase data,
 * and means "proposed" is the actual thing rather than a recording of it.
 */

import { useLayoutEffect, useRef, useState } from "react";

const NATIVE_W = 1920;
const NATIVE_H = 1080;
const ORANGE = "#FFA000";

const BOARDS = [
  {
    id: 1,
    title: "TV 1 — product showcase",
    note: "TV 2 and TV 3 use the same layout.",
    now: "/tv-display-1",
    proposed: "/tv-display-motion-1",
    changes: [
      "Spotlight cycle — one panel widens and brightens every 7s",
      "Ken Burns drift on each photo, offset phases",
      "Boot cascade: name → price pop → description → servings",
      "Gloss sweep on price pills and the FEEDS badge",
      "Light travelling along the shared base bar",
      "Stable two-line name box so price pills stop shifting",
    ],
  },
  {
    id: 4,
    title: "TV 4 — full menu board",
    note: "Also fixes the bottom-of-board clipping.",
    now: "/tv-display-4",
    proposed: "/tv-display-motion-4",
    changes: [
      "Reading light walks row by row down col 1 → 2 → 3",
      "Category rules pulse as the light enters them",
      "Combo steps pulse 1 → 2 → 3 in sequence",
      "Ken Burns + border glow on the Family Deal card",
      "Breathing QR card, staggered dip chips",
      "Fits 1080 — the live board overflows by 62px",
    ],
  },
];

function BoardFrame({ src, title }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / NATIVE_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black overflow-hidden rounded-xl border border-neutral-800"
      style={{ aspectRatio: "16 / 9" }}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-xs">
          Loading board…
        </div>
      )}
      <iframe
        src={src}
        title={title}
        onLoad={() => setLoaded(true)}
        tabIndex={-1}
        className="absolute top-0 left-0 border-0 origin-top-left"
        style={{
          width: NATIVE_W,
          height: NATIVE_H,
          transform: `scale(${scale})`,
          pointerEvents: "none",
          opacity: loaded && scale > 0 ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />
    </div>
  );
}

function Pane({ label, caption, tone, src, title, href }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-2.5 h-2.5 rounded-sm shrink-0"
          style={{ background: tone === "proposed" ? ORANGE : "#525252" }}
        />
        <span className="text-xs font-bold tracking-wider uppercase text-white">
          {label}
        </span>
        <span className="text-xs text-neutral-500 truncate">{caption}</span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-neutral-400 hover:text-white underline shrink-0"
        >
          Full screen
        </a>
      </div>
      <BoardFrame src={src} title={title} />
    </div>
  );
}

export default function TvMotionDemoPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <div className="max-w-[1500px] mx-auto px-5 md:px-8 py-8 md:py-10">
        <header className="mb-8">
          <p
            className="text-[11px] font-bold tracking-[0.2em] uppercase mb-1"
            style={{ color: ORANGE }}
          >
            Betty&apos;s Crispy Chicken
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            In-store display — motion proposal
          </h1>
          <p className="text-sm text-neutral-400 mt-1.5 max-w-3xl">
            Both panes below are live boards on real menu data, side by side. The
            in-store TVs are unchanged and still point at{" "}
            <code className="text-neutral-300">/tv-display-1…4</code> — nothing here
            is switched on yet.
          </p>
        </header>

        {BOARDS.map((b) => (
          <section key={b.id} className="mb-12">
            <div className="flex items-baseline gap-3 mb-3">
              <h2 className="text-lg md:text-xl font-semibold text-white">
                {b.title}
              </h2>
              <span className="text-xs text-neutral-500">{b.note}</span>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mb-4">
              <Pane
                label="Now"
                caption="live board — no motion"
                tone="now"
                src={b.now}
                href={b.now}
                title={`TV ${b.id} today`}
              />
              <Pane
                label="Proposed"
                caption="live — give it a few seconds"
                tone="proposed"
                src={b.proposed}
                href={b.proposed}
                title={`TV ${b.id} proposed`}
              />
            </div>

            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
              {b.changes.map((c) => (
                <li key={c} className="flex gap-2 text-sm text-neutral-300">
                  <span style={{ color: ORANGE }}>›</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <footer className="text-xs text-neutral-500 border-t border-neutral-900 pt-4 leading-relaxed">
          Scaled-down panes are only for comparison — judge the motion at{" "}
          <span className="text-neutral-300">Full screen</span> on an actual TV.
          The spotlight dwell (currently 7s) and the reading-light speed are the two
          numbers worth tuning in-store.
        </footer>
      </div>
    </div>
  );
}
