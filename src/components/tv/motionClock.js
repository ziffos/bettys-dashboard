/*
 * Shared clock for the display boards.
 *
 * Screens 1-3 are separate browsers on separate TVs with no channel between
 * them, so they synchronise on wall-clock time instead: every screen derives
 * the same phase from Date.now() against the Unix epoch, so they agree without
 * any coordination, and a screen that reboots rejoins mid-cycle in step.
 * Accuracy is whatever the TVs' clocks agree on — NTP-synced devices land
 * within a second of each other, which is inside a 3s dwell.
 *
 * One cycle on screens 1-3:
 *   0 .. CALM_MS            every dish on all three screens shown activated
 *   then TOTAL_ITEMS turns  one dish anywhere across the three screens is
 *                           singled out for DWELL_MS, in order — TV1 slots
 *                           1-4, then TV2 slots 1-4, then TV3 slots 1-4
 *
 * Slots per screen is fixed at 4 (the /tv-displays editor enforces it), so a
 * screen never needs to know what the others are showing to stay in step. An
 * empty slot simply takes its turn with nothing featured.
 *
 * Screen 4 runs on its own, much slower clock — see MENU_SWEEP_PERIOD_MS.
 */

export const CALM_MS = 180_000; // 3 min with every dish activated
export const DWELL_MS = 3_000; // per dish while the spotlight is running
export const SLOTS_PER_TV = 4;
export const SYNCED_TVS = 3;

/* Spotlight cross-fade. Kept well under DWELL_MS so a 3s turn reads as a
 * distinct beat rather than one continuous slide. */
export const SPOTLIGHT_MS = 650;

export const TOTAL_ITEMS = SLOTS_PER_TV * SYNCED_TVS; // 12
export const FEATURE_MS = TOTAL_ITEMS * DWELL_MS; //  36s
export const CYCLE_MS = CALM_MS + FEATURE_MS; // 216s

/* Screen 4's reading light runs once, then rests. */
export const MENU_SWEEP_PERIOD_MS = 240_000; // 4 min

/**
 * Phase of the shared cycle at `now` (ms since epoch).
 * `calmMs` can be overridden for review purposes (see the ?calm= param) — all
 * screens must use the same value or they will drift apart.
 */
export function phaseAt(now, calmMs = CALM_MS) {
  const cycle = calmMs + FEATURE_MS;
  const t = ((now % cycle) + cycle) % cycle;
  if (t < calmMs) {
    return { calm: true, globalIndex: -1, msLeft: calmMs - t, cycleMs: cycle };
  }
  const into = t - calmMs;
  const globalIndex = Math.min(TOTAL_ITEMS - 1, Math.floor(into / DWELL_MS));
  return {
    calm: false,
    globalIndex,
    msLeft: DWELL_MS - (into % DWELL_MS),
    cycleMs: cycle,
  };
}

/** Local slot index singled out on `tvNumber`, or -1 if the turn is elsewhere. */
export function heroForTv(tvNumber, phase) {
  if (!phase || phase.calm) return -1;
  const local = phase.globalIndex - (tvNumber - 1) * SLOTS_PER_TV;
  return local >= 0 && local < SLOTS_PER_TV ? local : -1;
}

/** Which screen owns the current turn (1-based), or -1 during the calm phase. */
export function tvForPhase(phase) {
  if (!phase || phase.calm) return -1;
  return Math.floor(phase.globalIndex / SLOTS_PER_TV) + 1;
}

/**
 * Screen 4's reading light: one pass every MENU_SWEEP_PERIOD_MS, resting in
 * between. `durationMs` is how long a full pass takes, which depends on how
 * many rows the menu has.
 */
export function menuSweepAt(now, durationMs, periodMs = MENU_SWEEP_PERIOD_MS) {
  const t = ((now % periodMs) + periodMs) % periodMs;
  return t < durationMs
    ? { sweeping: true, msLeft: durationMs - t }
    : { sweeping: false, msLeft: periodMs - t };
}

/** Review-only override, e.g. ?calm=10 to avoid waiting out the full 3 min. */
export function calmOverrideFromUrl() {
  if (typeof window === "undefined") return CALM_MS;
  const raw = new URLSearchParams(window.location.search).get("calm");
  if (!raw) return CALM_MS;
  const secs = Number(raw);
  return Number.isFinite(secs) && secs >= 1 ? secs * 1000 : CALM_MS;
}
