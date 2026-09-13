/**
 * Screens parked on purpose.
 *
 * Marketing draws entirely from `social_stats`, whose newest row is 24 Apr 2026
 * — the import stopped and the owner will restart it. A page of flat lines
 * running off the end of April is worse than no page, so the whole screen is
 * parked: it leaves the rail, the phone bar, the More sheet, ⌘K and the
 * permissions matrix, and the route itself says it is coming back rather than
 * drawing an empty chart. Overview's "Social reach" card reads the same table,
 * so it is parked with it.
 *
 * Nothing is deleted. **To re-open a screen, take its slug out of this set** —
 * that is the whole change.
 */
export const PARKED_PAGES = new Set(["marketing"]);

export const isParked = (slug) => PARKED_PAGES.has(slug);
