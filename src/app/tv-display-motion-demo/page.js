"use client";

/*
 * All four in-store boards on one page.
 *
 * These are the real screens — as of the switch, /tv-display-1..4 render the
 * animated boards, so each pane below is exactly what is on the wall.
 *
 * Named tv-display-* so ClientLayout serves it with no sidebar and no login,
 * the same way the boards themselves are served.
 *
 * Each pane is a live iframe of a real board at native 1920x1080, scaled to
 * fit — the same technique as the previews on /tv-displays. No video to ship,
 * always current Supabase data, and "proposed" is the actual thing rather than
 * a recording. Screens 1-3 sit in one row so the shared spotlight can be seen
 * handing off between them.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  CALM_MS,
  DWELL_MS,
  MENU_SWEEP_PERIOD_MS,
  SLOTS_PER_TV,
  TOTAL_ITEMS,
  phaseAt,
  tvForPhase,
} from "../../components/tv/motionClock";

const NATIVE_W = 1920;
const NATIVE_H = 1080;
const ORANGE = "#FFA000";

const SHOWCASE = [1, 2, 3];

/* Real timing is the default. The fast option shortens only the calm phase, via
 * ?calm= on every board at once so they stay in step with each other. */
const FAST_CALM_S = 8;

const CHANGES = [
  `${Math.round(CALM_MS / 60000)} min calm phase — every dish activated at once`,
  `Then one dish at a time across all three screens, ${DWELL_MS / 1000}s each`,
  "Only the screen holding the turn dims; the other two stay normal",
  "Screens sync on wall-clock time — no channel between them needed",
  "Ken Burns drift on each photo, offset phases",
  "Gloss sweep on price pills, light running along the base bar",
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
          Loading…
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

/* Live readout of the shared cycle, so a multi-minute loop is reviewable
 * without staring at it wondering whether anything is meant to be happening. */
function CycleStatus({ calmMs }) {
  const [phase, setPhase] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const id = setInterval(() => {
      if (!cancelled) setPhase(phaseAt(Date.now(), calmMs));
    }, 250);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [calmMs]);

  if (!phase) {
    return <div className="h-[42px] rounded-lg bg-neutral-900 border border-neutral-800" />;
  }

  const secs = Math.ceil(phase.msLeft / 1000);
  const tv = tvForPhase(phase);
  const slot = phase.calm ? 0 : (phase.globalIndex % SLOTS_PER_TV) + 1;
  const progress = phase.calm
    ? 1 - phase.msLeft / calmMs
    : (phase.globalIndex + 1 - phase.msLeft / DWELL_MS) / TOTAL_ITEMS;

  return (
    <div className="rounded-lg bg-neutral-900 border border-neutral-800 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: phase.calm ? "#525252" : ORANGE }}
        />
        {phase.calm ? (
          <>
            <span className="font-semibold text-white">Calm phase</span>
            <span className="text-neutral-400">
              every dish activated — spotlight starts in {secs}s
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold text-white">
              Featuring {phase.globalIndex + 1} of {TOTAL_ITEMS}
            </span>
            <span className="text-neutral-400">
              TV {tv}, slot {slot} — next in {secs}s
            </span>
          </>
        )}
        <span className="ml-auto text-xs text-neutral-500 tabular-nums">
          {Math.round(phase.cycleMs / 1000)}s cycle
        </span>
      </div>
      <div className="mt-2 h-1 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-linear"
          style={{
            width: `${Math.max(0, Math.min(100, progress * 100))}%`,
            background: phase.calm ? "#525252" : ORANGE,
          }}
        />
      </div>
    </div>
  );
}

export default function TvMotionDemoPage() {
  const [fast, setFast] = useState(false);
  const calmMs = fast ? FAST_CALM_S * 1000 : CALM_MS;
  // Applied to every showcase board at once, so they stay in step with each other.
  const q = fast ? `?calm=${FAST_CALM_S}` : "";

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <div className="max-w-[1600px] mx-auto px-5 md:px-8 py-8 md:py-10">
        <header className="mb-5">
          <p
            className="text-[11px] font-bold tracking-[0.2em] uppercase mb-1"
            style={{ color: ORANGE }}
          >
            Betty&apos;s Crispy Chicken
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            In-store displays — live
          </h1>
          <p className="text-sm text-neutral-400 mt-1.5 max-w-3xl">
            This is what is on the wall right now:{" "}
            <code className="text-neutral-300">/tv-display-1…4</code> on real menu
            data. A TV already showing a board needs a refresh to pick up a code
            change; menu edits come through by themselves.
          </p>
        </header>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-stretch gap-3">
          <div className="flex-1 min-w-0">
            <CycleStatus calmMs={calmMs} />
          </div>
          <button
            type="button"
            onClick={() => setFast((v) => !v)}
            className={[
              "shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors",
              fast
                ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700",
            ].join(" ")}
            title={`Shorten the calm phase to ${FAST_CALM_S}s so the spotlight comes round quickly. Review only — the real boards use the full ${Math.round(CALM_MS / 60000)} min.`}
          >
            {fast
              ? `Fast preview on · ${FAST_CALM_S}s calm`
              : `Fast preview · skip the ${Math.round(CALM_MS / 60000)} min wait`}
          </button>
        </div>

        {/* Screens 1-3: one row, so the hand-off is visible */}
        <section className="mb-10">
          <div className="flex flex-wrap items-baseline gap-3 mb-3">
            <h2 className="text-lg md:text-xl font-semibold text-white">
              Screens 1 – 3 · synchronised spotlight
            </h2>
            <span className="text-xs text-neutral-500">
              One dish at a time across all three — watch it hand off from screen to
              screen
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {SHOWCASE.map((n) => (
              <div key={n} className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: ORANGE }}
                  />
                  <span className="text-xs font-bold tracking-wider uppercase text-white">
                    TV {n}
                  </span>
                  <span className="text-xs text-neutral-500">slots {(n - 1) * 4 + 1}–{n * 4}</span>
                  <a
                    href={`/tv-display-${n}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-neutral-400 hover:text-white underline shrink-0"
                  >
                    Full screen
                  </a>
                </div>
                <BoardFrame
                  key={q}
                  src={`/tv-display-${n}${q}`}
                  title={`TV ${n}`}
                />
              </div>
            ))}
          </div>

          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5">
            {CHANGES.map((c) => (
              <li key={c} className="flex gap-2 text-sm text-neutral-300">
                <span style={{ color: ORANGE }}>›</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Screen 4 */}
        <section className="mb-10">
          <div className="flex flex-wrap items-baseline gap-3 mb-3">
            <h2 className="text-lg md:text-xl font-semibold text-white">
              Screen 4 · full menu board
            </h2>
            <span className="text-xs text-neutral-500">
              Independent of the spotlight — its reading light passes once every{" "}
              {Math.round(MENU_SWEEP_PERIOD_MS / 60000)} min
            </span>
            <a
              href="/tv-display-4"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-neutral-400 hover:text-white underline"
            >
              Full screen
            </a>
          </div>
          <div className="max-w-4xl">
            <BoardFrame src="/tv-display-4" title="TV 4" />
          </div>
        </section>

        <footer className="text-xs text-neutral-500 border-t border-neutral-900 pt-4 leading-relaxed">
          Scaled-down panes are only for monitoring — judge the motion on an actual
          TV. The
          calm phase ({Math.round(CALM_MS / 60000)} min), the dwell per dish (
          {DWELL_MS / 1000}s) and screen 4&apos;s sweep interval (
          {Math.round(MENU_SWEEP_PERIOD_MS / 60000)} min) are all one-line changes in{" "}
          <code className="text-neutral-300">components/tv/motionClock.js</code>.
          Fast preview only affects this page.
        </footer>
      </div>
    </div>
  );
}
