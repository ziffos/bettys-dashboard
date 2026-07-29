/*
 * Shared clock for the showcase boards (TV 1, 2, 3).
 *
 * The three screens are separate browsers on separate TVs with no channel
 * between them, so they synchronise on wall-clock time instead: every screen
 * derives the same phase from Date.now() against the Unix epoch, so they agree
 * without any coordination, and a screen that reboots rejoins mid-cycle in step.
 * Accuracy is whatever the TVs' clocks agree on — NTP-synced devices land within
 * a second of each other, which is well inside a 7s dwell.
 *
 * One cycle:
 *   0 .. CALM_MS            every dish on all three screens shown normally
 *   then TOTAL_ITEMS turns  one dish anywhere across the three screens is
 *                           featured for DWELL_MS, in order — TV1 slots 1-4,
 *                           then TV2 slots 1-4, then TV3 slots 1-4
 *
 * Slots per screen is fixed at 4 (the /tv-displays editor enforces it), so a
 * screen never needs to know what the others are showing to stay in step. An
 * empty slot simply takes its turn with nothing featured.
 */

export const CALM_MS = 55_000;
export const DWELL_MS = 7_000;
export const SLOTS_PER_TV = 4;
export const SYNCED_TVS = 3;

export const TOTAL_ITEMS = SLOTS_PER_TV * SYNCED_TVS; // 12
export const FEATURE_MS = TOTAL_ITEMS * DWELL_MS; //  84s
export const CYCLE_MS = CALM_MS + FEATURE_MS; // 139s

/** Phase of the shared cycle at `now` (ms since epoch). */
export function phaseAt(now) {
  const t = ((now % CYCLE_MS) + CYCLE_MS) % CYCLE_MS;
  if (t < CALM_MS) {
    return { calm: true, globalIndex: -1, msLeft: CALM_MS - t };
  }
  const into = t - CALM_MS;
  const globalIndex = Math.min(TOTAL_ITEMS - 1, Math.floor(into / DWELL_MS));
  return { calm: false, globalIndex, msLeft: DWELL_MS - (into % DWELL_MS) };
}

/** Local slot index featured on `tvNumber`, or -1 if the turn belongs elsewhere. */
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
