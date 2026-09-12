# Demo mode

Runs the whole dashboard on synthetic data so it can be screenshotted, shown in
a portfolio or demoed to someone without exposing the real business.

```bash
NEXT_PUBLIC_DEMO=1 npm run dev
```

You are logged straight in as an admin — no login screen, no Supabase session.

## What it does

`src/lib/supabase.js` exports either the real Supabase client or `demo/client.js`
depending on `NEXT_PUBLIC_DEMO`. Every page imports that one module, so the swap
covers the whole app without touching a single page component.

The demo client is a small in-memory stand-in for the PostgREST query builder
(`select` / `eq` / `gte` / `lte` / `in` / `like` / `ilike` / `or` / `order` /
`limit` / `range` / `single` / `maybeSingle`, plus embedded foreign-key selects), the auth calls
`AuthContext` needs, and no-op realtime channels. **It has no network access**,
so demo mode cannot read from or write to production. That also makes the
write-capable screens — the menu editor and the TV layout editor — safe to click
through; edits apply in memory and vanish on reload.

## What is fake and what is real

Fake (`generate.js`): all orders and revenue, platform payouts, commissions and
take-rates, invoice numbers, staff, wages, shifts, payroll, customers, reviews,
social reach and ad spend.

Real (`menuSnapshot.js`): the menu — item names, descriptions, prices and
photos. That information is already published on bettyscrispychicken.com and on
the Wolt / Foody / Bolt listings, so keeping it real costs nothing and makes the
TV boards and the menu screen look like the product they actually are.

## Notes

- Generation is **seeded**, so the same day always produces the same numbers.
  Charts do not reshuffle between screenshots.
- Generation is **lazy** — nothing runs until the first query, so a production
  build that never enters demo mode pays nothing for it.
- Trading history covers 14 months (so the `1Y` preset has data). Shifts only
  cover the last 8 months plus two weeks ahead, because `/calendar` reads shifts
  with `.limit(1000)` ordered oldest-first — a deeper roster would spend the
  whole quota on old rows and leave the current month blank.
- Hours follow the real trading pattern: Mon–Sat 11:30–22:30, closed Sunday,
  with a lunch bump and a bigger dinner peak.
