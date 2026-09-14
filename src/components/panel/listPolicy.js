/**
 * The rules the list obeys, in one place, because there are two of it.
 *
 * The desktop panel is 334px of a dashboard; the phone screen is the whole
 * screen and a different type scale. They are drawn separately on purpose —
 * responsive classes for two layouts that share almost no measurement would be
 * worse than two honest components. What they must not disagree about is what
 * the list *means*: how many rows count as a first run, when a filter is worth
 * showing, how long ago something was ticked. That lives here.
 */

export const SOURCE_LABEL = {
  payouts: "PAYOUTS",
  menu: "MENU",
  payroll: "PAYROLL",
  sales: "SALES",
};

/** To do shows this many before it offers the rest. */
export const FIRST_RUN = 9;

/** And the filter appears only once there is this much to filter. */
export const FILTER_FROM = 12;

/** "2 h ago" / "yesterday" / "4 days ago" — when a task was ticked. */
export function tickedAgo(iso) {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return "just now";
  if (hours < 12) return `${Math.round(hours)} h ago`;
  const days = Math.round(hours / 24);
  if (days <= 1) return "yesterday";
  return `${days} days ago`;
}

/** Case-insensitive substring over the body, and nothing cleverer. */
export const matcher = (query) => {
  const q = query.trim().toLowerCase();
  return (row) => !q || row.body.toLowerCase().includes(q);
};
