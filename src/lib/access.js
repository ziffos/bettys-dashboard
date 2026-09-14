import { isParked } from "./features";

/** Page slugs to their routes. */
export const SLUG_TO_PATH = {
  overview: "/",
  sales: "/sales",
  marketing: "/marketing",
  menu: "/menu",
  products: "/products",
  payouts: "/platform-payouts",
  reviews: "/reviews",
  calendar: "/calendar",
  "my-payroll": "/my-payroll",
  payroll: "/payroll",
  "tv-displays": "/tv-displays",
  settings: "/settings",
  notes: "/notes",
};

export const PATH_TO_SLUG = Object.fromEntries(
  Object.entries(SLUG_TO_PATH).map(([slug, path]) => [path, slug])
);

/** Never shown to an employee, whatever `page_permissions` says. */
export const ADMIN_ONLY_SLUGS = new Set(["payroll", "settings", "notes"]);

/**
 * Where to send an employee who has nowhere in particular to be: their first
 * granted page, in the order the rail lists them.
 *
 * This used to be hardcoded to `/calendar`, which is fine right up until
 * somebody has not been granted the calendar. Then landing there fails the
 * route guard, which redirects to `/calendar`, which fails the guard — a loop
 * with a toast flashing on every pass. An employee in the production database
 * has zero grants and hits exactly that.
 *
 * Returns null when nothing has been shared at all, so the caller can say so
 * instead of bouncing them to a page they cannot open either.
 */
const LANDING_ORDER = [
  "calendar",
  "my-payroll",
  "overview",
  "sales",
  "products",
  "reviews",
  "menu",
  "payouts",
  "marketing",
  "tv-displays",
];

export function landingSlugFor(permissions = []) {
  return (
    LANDING_ORDER.find(
      (slug) =>
        !ADMIN_ONLY_SLUGS.has(slug) && !isParked(slug) && permissions.includes(slug)
    ) ?? null
  );
}
