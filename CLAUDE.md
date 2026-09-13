# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Run production server
npm run lint       # ESLint (Next.js Core Web Vitals config)

NEXT_PUBLIC_DEMO=1 npm run dev      # Same app on synthetic data, logged in as admin
./tools/shot.sh --all               # Screenshot every screen at desktop + phone
./tools/shot.sh /sales              # One route, both widths
./tools/shot.sh --restart /sales    # After npm run build clobbered .next
./tools/shot.sh --stop              # Stop the demo-mode dev server
```

No test framework is configured — there are no tests. `npm run lint` is clean
for every dashboard screen; the handful of remaining problems are all in the
out-of-scope files (`/qr-menu`, `src/components/tv/`, the design export) plus one
pre-existing `exhaustive-deps` warning in `AuthContext`. A new error in
`src/app/` or `src/components/ui/` is a regression.

## The redesign

Every screen has been rebuilt against the light Geist design. **Read
`design/DESIGN.md` before touching any UI** — it has the palette, type scale,
component patterns and, at the end, the numbered list of places where the built
app deliberately differs from the design and why. Rendered reference images of
the design live in `design/reference/`, named to match the screenshots
`./tools/shot.sh` writes.

Screens, in rail order: `/` Overview, `/sales`, `/marketing`, `/products`,
`/reviews`, `/menu`, `/platform-payouts`, `/calendar`, `/payroll`,
`/my-payroll`, `/tv-displays`, `/settings`, plus `/login` and the shell.

**Out of scope, do not modify:** `/qr-menu`, `/tv-display-1..4`,
`/tv-display-menu-*`, `/tv-display-motion-*`, `src/components/tv/`. These render
on the four physical screens in the shop. `/tv-displays` embeds
`/tv-display-1..4` in a read-only iframe to preview them — it never changes
them; it only moves dishes between `menu_items.tv_number` / `position`.

## Verifying UI changes

Typecheck and lint say nothing about a column that breaks or a gap in the middle
of a view. After changing a screen, screenshot it and look at the image:

```bash
./tools/shot.sh /sales                     # → .shots/desktop-sales.png, .shots/phone-sales.png
```

Compare against `design/reference/desktop-sales.png` and `phone-sales.png` —
same filenames on purpose.

The tool runs the app in demo mode because **the real database is stale**: the
last order is 20 Aug 2026, the last social stat 24 Apr 2026, and `profiles`,
`shifts`, `payroll_*`, `rate_changes` and `page_permissions` are RLS-locked to
an authenticated session. Demo mode fills every screen with seeded data anchored
to today. See `src/lib/demo/README.md`.

## Architecture

**Betty's Dashboard** is a restaurant management dashboard for "Betty's Crispy
Chicken" built with **Next.js 16 App Router**, **React 19**, **Supabase** and
**Tailwind CSS v4**. All page components are client-side (`"use client"`).

### Key directories

- `src/app/` — Next.js App Router pages (file-based routing)
- `src/components/` — The shell (ClientLayout, Sidebar, AppHeader, MobileNav)
- `src/components/ui/` — The pieces every rebuilt screen composes from
- `src/lib/format.js` — Money, dates, sparklines, item parsing, paginated reads
- `src/lib/salesModel.js` — Per-day revenue and the prorated fee model
- `src/lib/menuMatch.js` — Order lines → menu items, and effective-dated prices
- `src/components/tv/` — The in-store display boards (out of scope)
- `src/lib/` — Supabase client (`supabase.js`) and auth context (`AuthContext.js`)
- `src/lib/demo/` — In-memory Supabase stand-in for demo mode
- `design/` — The redesign spec and reference renders
- `tools/` — Screenshot tooling, plus `sql.sh` (read-only SQL against
  production through the Management API, which unlike the anon key can see the
  RLS-locked tables) and `node-app.mjs` (run a script that imports the app's own
  modules under plain `node`, for checking the model against SQL)

### Auth & access control

`AuthContext.js` provides authentication and role-based authorization:
- Supabase Auth with email/password, session persisted under key `bettys-auth`
- Two roles: **admin** (full access) and **employee** (permission-gated)
- Page permissions stored in `page_permissions`; checked via `canAccess(slug)`
- Admin-only pages: `payroll`, `settings`
- Employees auto-redirect to `/calendar` on login; admins go to `/`
- The sidebar is permission-filtered, and `my-payroll` is hidden from admins and
  from employees with no shifts. The design only ever shows the admin case.

### Database

All data access is direct client-side Supabase SDK queries (no API routes).

| Table | Notes |
|---|---|
| `profiles` | `full_name, email, role, job_title, is_active` |
| `page_permissions` | `user_id, page_slug, granted_by` |
| `delivery_purchases` | One row per order. `delivery_partner`, `delivery_status`, `items` as a comma-separated string |
| `pos_sales` | In-store orders. No status column — POS orders are never rejected |
| `platform_payouts` | Weekly-ish statements. Periods are **not** week aligned: Bolt 7 days, Wolt mostly 5, Foody 1–9 |
| `reviews` | `source_platform` is wolt/foody/bolt only. `reviewer_name` is always null, and only 40 of 231 rows have `review_text` |
| `social_stats` | `platform` is facebook / instagram / **`facebook_instagram`** (combined campaigns — count these only in "Both") |
| `shifts` | `shift_date`, `start_time`, `end_time`, `break_minutes`, `hourly_rate` snapshot |
| `payroll_records` | One per employee per month. `amount_paid` and `status` are maintained by a DB trigger — never recalculate them in JS |
| `payroll_payments` | Individual payments against a `payroll_id` |
| `rate_changes` | Effective-dated pay rates (`effective_year`, `effective_month`) |
| `menu_items` | Includes `tv_number` / `position` (the slot a dish occupies on displays 1–3) and the per-platform alias names |
| `menu_item_price_history` | Effective-dated prices per platform |
| `quotes` | Quote of the day |

New employees are created through the `create-employee` edge function, which does
not set `job_title` — it is filled in afterwards from the Settings panel.

### Data patterns

- Parallel fetches via `Promise.all()` in `useEffect`
- Paginate with `fetchAllRows` — PostgREST caps at 1000 rows per request
- **Timestamps are Cyprus wall clock, not UTC.** `pos_sales.order_placed` is a
  naive `timestamp`; `delivery_purchases.order_placed` and `reviews.review_date`
  are `timestamptz` carrying a `+00` tag the importer never earned. Read them
  with `dayOf` / `timeOf` / `hourOf` / `stampLabel` from `salesModel.js`, which
  parse the wall clock and ignore the offset. Converting the tag to
  Europe/Nicosia shifts every delivery order three hours late — see the note on
  `WALL_CLOCK`. `RangeContext` still uses Europe/Nicosia, correctly, because
  "today" is a real instant
- Delivery platforms: Wolt, Foody, Bolt, plus in-store POS
- Rejected and cancelled orders are filtered out of revenue
- Order lines are parsed out of the comma-separated `items` string with a regex,
  then matched to `menu_items` through the per-platform alias columns. The three
  platforms genuinely disagree on names — Wolt writes "Betty's Classic", Foody
  writes it with a backtick, the till shouts it in capitals — which is what
  those columns are for. `buildMenuMatcher` falls back to a normalised canonical
  name so a dish added before its aliases were filled in is not reported as
  selling nothing
- Per-order fees do not exist. Commission is prorated from `platform_payouts`,
  sales-weighted across the days a statement covers, and a day with no statement
  is marked *estimated* rather than confirmed

### The shell

- `ClientLayout` composes `Sidebar` (the desktop rail), `AppHeader` and
  `MobileNav`. The rail expands on hover and can be pinned; the pin is in
  localStorage under `bettys-rail-pinned`.
- `RangeContext` holds the one date range the header owns. It is relative to
  **today**, and carries the equal-length previous period for comparisons.
  Screens read it with `useRange()` instead of owning a picker.
- `CommandPalette` is ⌘K: pages, dishes, people, and orders matched on their
  reference or item string.
- Design tokens are Tailwind v4 `@theme` variables in `globals.css`, so a screen
  writes `text-subtle` / `border-line` / `font-mono`, not raw hex.

## Conventions

- Recharts for charts, Lucide React for icons
- Path alias: `@/*` → `./src/*`
- Mobile breakpoint at `md` (768px)
- React Compiler is enabled in `next.config.mjs`
- Dev origins allow `*.trycloudfare.com` (Cloudflare tunnel) and `127.0.0.1`
  (the screenshot tool)
- `next build` and `next dev` share `.next/` — stop the dev server before
  building, or the screenshots come back from a half-written bundle

## Deployment

Vercel builds production from `master`, and `/tv-display-1..4` are what the four
screens in the shop render. **Pushing to master changes the in-store menu boards
on their next reload.** Commit to `master` directly — no feature branches, no
PRs — but only after `npm run build` passes and the screen has been looked at in
a screenshot.
