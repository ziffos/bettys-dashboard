# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run start      # Run production server
npm run lint       # ESLint (Next.js Core Web Vitals config)
```

No test framework is configured — there are no tests.

## Architecture

**Betty's Dashboard** is a restaurant management dashboard for "Betty's Crispy Chicken" built with **Next.js 16 App Router**, **React 19**, **Supabase**, and **Tailwind CSS v4**. All page components are client-side (`"use client"`).

### Key directories

- `src/app/` — Next.js App Router pages (file-based routing)
- `src/components/` — Shared UI components (ClientLayout, Sidebar, SkeletonBlock)
- `src/lib/` — Supabase client (`supabase.js`) and auth context (`AuthContext.js`)

### Auth & access control

`AuthContext.js` provides authentication and role-based authorization:
- Supabase Auth with email/password, session persisted under key `bettys-auth`
- Two roles: **admin** (full access) and **employee** (permission-gated)
- Page permissions stored in `page_permissions` table; checked via `canAccess(slug)`
- Admin-only pages: `payroll`, `settings`
- Employees auto-redirect to `/calendar` on login; admins go to `/`

### Database

All data access is direct client-side Supabase SDK queries (no API routes). Key tables: `profiles`, `page_permissions`, `delivery_purchases`, `pos_sales`, `platform_payouts`, `reviews`, `social_stats`, `shifts`.

### Data patterns

- Parallel fetches via `Promise.all()` in `useEffect` hooks
- Timezone: `Europe/Nicosia` (Cyprus) used throughout for date calculations
- Delivery platforms: Wolt (blue), Foody (orange), Bolt (teal), POS (green)
- Rejected orders are filtered out of revenue calculations
- Menu items parsed from comma-separated strings with regex

### UI conventions

- **Mobile-first**: This is a mobile-first app. All code changes must work well and be easy to use on all screen sizes, especially mobile. Design for small screens first, then enhance for larger ones.
- Dark theme: neutral-950 background, emerald green accents
- Recharts for charts (AreaChart, ComposedChart, BarChart)
- Lucide React for icons
- Path alias: `@/*` → `./src/*`
- Responsive with mobile breakpoint at `md` (768px)
- Next.js React Compiler enabled in `next.config.mjs`
- Dev origins allow `*.trycloudfare.com` (Cloudflare tunnel access)
