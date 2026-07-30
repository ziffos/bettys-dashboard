"use client";

/*
 * Review page for the menu restructure proposal — all four screens plus the
 * reasoning behind the prices.
 *
 * Named tv-display-* so ClientLayout serves it without the sidebar or a login.
 * Nothing here touches the live boards or the menu_items table.
 */

import { useLayoutEffect, useRef, useState } from "react";

const NATIVE_W = 1920;
const NATIVE_H = 1080;
const ORANGE = "#FFA000";

const SCREENS = [
  {
    n: 1,
    title: "Pick your chicken",
    note: "Crispy, wings, stripes, mix box — each with its own piece ladder",
  },
  {
    n: 2,
    title: "Make it a meal",
    note: "The entire upsell is one number: +€3.50 for a side and a drink",
  },
  {
    n: 3,
    title: "Or go big",
    note: "Sharing boxes, each priced under the sum of its parts",
  },
  {
    n: 4,
    title: "Burgers, wraps & extras",
    note: "Same +€3.50 rule, so there is only ever one mechanic to learn",
  },
];

const FINDINGS = [
  {
    h: "Your menu is already linear",
    p: "Hungry Hero minus Betty's Classic is 3 pieces for €3.10 — €1.03 each. Wicked Wings minus Spicy Wings is 3 wings for €1.60 — €0.53 each. Side + drink falls out at ~€3.40. Every chicken combo you sell sits within about 15c of pieces × unit + €3.40, so this restructure is close to price-neutral.",
  },
  {
    h: "Side + drink has two prices",
    p: "Every burger combo is exactly €2.00 over the à la carte burger — wrap €6→€8, chicken €8→€10, beef €10→€12, halloumi €8→€10, sandwich €7→€9. The same side + drink costs €3.40 with chicken. One mechanic forces you to pick a number.",
  },
  {
    h: "Mega Wing Pack is a value trap",
    p: "€15.30 for 20 wings, while two Wicked Wings is €16.00 for 18 wings plus two sides and two drinks. Anyone who compares feels cheated. The Wing Box on screen 3 replaces it.",
  },
  {
    h: "À la carte is a 2× tax",
    p: "Crispy chicken is €2.00 a piece on the board but €1.03 inside a combo; wings €1.00 versus €0.53. That punishes exactly the walk-up customer this menu is built to serve. Setting a minimum order size protects margin without the penalty.",
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

export default function MenuProposalDemoPage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <div className="max-w-[1600px] mx-auto px-5 md:px-8 py-8 md:py-10">
        <header className="mb-6">
          <p
            className="text-[11px] font-bold tracking-[0.2em] uppercase mb-1"
            style={{ color: ORANGE }}
          >
            Betty&apos;s Crispy Chicken
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Menu restructure — proposal
          </h1>
          <p className="text-sm text-neutral-400 mt-1.5 max-w-3xl">
            Buy by the piece, then one flat upgrade for a meal. Four screens
            below, at the size they would run in store.
          </p>
        </header>

        <div className="mb-8 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-amber-200/90">
            <strong className="text-amber-200">Nothing here is live.</strong> These
            are static mock boards — they do not read from or write to your menu
            data, and your in-store screens are untouched on{" "}
            <code className="text-amber-100">/tv-display-1…4</code>. Prices are
            reverse-engineered from your current menu&apos;s own arithmetic and hold
            today&apos;s meal prices to within about 40c, but they have not been
            checked against food cost.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-10">
          {SCREENS.map((s) => (
            <section key={s.n}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: ORANGE }}
                />
                <span className="text-xs font-bold tracking-wider uppercase text-white">
                  Screen {s.n}
                </span>
                <span className="text-xs text-neutral-400">{s.title}</span>
                <a
                  href={`/tv-display-menu-${s.n}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-xs text-neutral-400 hover:text-white underline shrink-0"
                >
                  Full screen
                </a>
              </div>
              <BoardFrame
                src={`/tv-display-menu-${s.n}`}
                title={`Proposal screen ${s.n}`}
              />
              <p className="text-xs text-neutral-500 mt-2">{s.note}</p>
            </section>
          ))}
        </div>

        <section className="mb-10">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-1">
            What the current menu&apos;s numbers say
          </h2>
          <p className="text-sm text-neutral-500 mb-4">
            All four of these came out of your live menu data, not from guesswork.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {FINDINGS.map((f) => (
              <div
                key={f.h}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
              >
                <h3 className="text-sm font-bold text-white mb-1.5">{f.h}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{f.p}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-lg md:text-xl font-semibold text-white mb-3">
            Two calls that are yours
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <h3 className="text-sm font-bold text-white mb-1.5">
                Which meal price wins
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                €3.50 protects chicken margin and corrects the burger undercharge,
                but raises every burger meal by €1.50. €3.00 is softer: it costs 40c
                per chicken meal and gains €1.00 per burger meal. Which is better
                depends on your chicken-to-burger mix — your POS data would answer
                that.
              </p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <h3 className="text-sm font-bold text-white mb-1.5">
                Keep a few named favourites
              </h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Pure build-your-own slows a queue, because not everyone wants to
                design lunch. A short &ldquo;most ordered&rdquo; rail — Classic,
                Hungry Hero, Family Box — as one-tap shortcuts keeps throughput while
                everyone else builds their own.
              </p>
            </div>
          </div>
        </section>

        <footer className="text-xs text-neutral-500 border-t border-neutral-900 pt-4 leading-relaxed">
          Prices and items live in{" "}
          <code className="text-neutral-300">
            components/tv/proposal/data.js
          </code>{" "}
          — one file, easy to rework. The live boards are at{" "}
          <a
            href="/tv-display-motion-demo"
            className="underline hover:text-neutral-300"
          >
            /tv-display-motion-demo
          </a>
          .
        </footer>
      </div>
    </div>
  );
}
