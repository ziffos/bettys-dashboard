"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Rows that move because of something you did should be seen to move.
 *
 * Tick a to-do and it leaves the open rows and lands with the ones you got
 * through today, on its way to Done; delete one and everything under it closes
 * the gap. Both are real journeys, and a list that simply repaints makes you
 * check whether the right thing happened.
 *
 * This is FLIP, which is the cheap way to do it: read where every row is
 * before React repaints (First), read where it ended up (Last), put each row
 * back where it started with a transform (Invert), then let it transition to
 * nothing (Play). No library, no wrapper components, no measuring heights —
 * the browser does the layout and we only animate the difference.
 *
 * Mark each row with `data-flip="<stable id>"` inside the returned ref's
 * subtree. Anything that appears gets the enter animation instead, and anyone
 * who has asked their machine to stop moving things gets none of it.
 *
 * `forget(id)` is the way to say "this one did not travel, it left and came
 * back": a ticked row slides out to the right and returns further down, and
 * making it also glide there would be the same journey told twice.
 */
const REDUCED = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useFlipList() {
  const box = useRef(null);
  const seen = useRef(new Map());
  const forget = (id) => seen.current.delete(id);

  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    const rows = root.querySelectorAll("[data-flip]");
    const before = seen.current;
    const after = new Map();

    if (REDUCED()) {
      rows.forEach((el) => after.set(el.dataset.flip, el.getBoundingClientRect().top));
      seen.current = after;
      return;
    }

    rows.forEach((el) => {
      const id = el.dataset.flip;
      const top = el.getBoundingClientRect().top;
      after.set(id, top);
      const was = before.get(id);

      if (was === undefined) {
        // New to the list. Nothing to invert, so introduce it instead.
        if (before.size > 0) el.classList.add("row-enter");
        return;
      }
      const delta = was - top;
      if (Math.abs(delta) < 1) return;

      // Invert, then play on the next frame so the browser has a start value
      // to transition from rather than collapsing both writes into one paint.
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 320ms cubic-bezier(0.2, 0.7, 0.3, 1)";
        el.style.transform = "";
      });
    });

    seen.current = after;
  });

  return { ref: box, forget };
}

/** How long a row spends leaving, in ms. Must match `row-leave` in globals.css. */
export const LEAVE_MS = 330;

/** True while the machine has been asked not to animate. */
export const reducedMotion = REDUCED;
