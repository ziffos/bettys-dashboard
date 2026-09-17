/**
 * Screens parked on purpose.
 *
 * Empty right now, and the mechanism stays because it earned its keep.
 *
 * Marketing was parked in September 2026: it drew entirely from `social_stats`,
 * whose newest row is 24 Apr 2026, and a page of flat lines running off the end
 * of April is worse than no page. It came back the same month on a different
 * source — website traffic from `site_traffic`, which arrives nightly — and the
 * social half now says what happened to it instead of pretending.
 *
 * Nothing is ever deleted to park a screen. **Add a slug here to park it, take
 * it out to re-open it** — that is the whole change.
 */
export const PARKED_PAGES = new Set();

export const isParked = (slug) => PARKED_PAGES.has(slug);
