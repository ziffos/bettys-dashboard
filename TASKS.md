# Punch list — Sep 2026

The loop's source of truth. Work the first unchecked task, finish it completely,
tick it here, commit, push. Findings that do not fit a task go under
"Audit findings" at the bottom so nothing discovered is lost between iterations.

Facts established before the list was written are in "Groundwork" — do not
re-derive them.

## 1 · Timezone: orders are three hours late — **done**

- [x] Read `delivery_purchases.order_placed` and `reviews.review_date` as naive
      Cyprus wall-clock instead of converting the `+00` tag to Europe/Nicosia
- [x] Re-check every consumer of `dayOf` / `hourOf` / `timeOf`
- [x] Sales heatmap axis: the cyclic-quiet-run logic was compensating for the
      bug. With real hours (11:00–22:00) it should read plainly
- [x] Demo generator: make synthetic timestamps the same shape as production
      (naive local, 11:00–22:00, closed Sundays) so demo screenshots stay honest
- [x] Verify: 0 orders on Sundays, last order 12 Sep 21:46 not 13 Sep 00:46

## 2 · Mobile navigation — **done**

- [x] There is no way to sign out on a phone. Add it to the More sheet
- [x] Bottom bar sticky/fixed so it survives a long page and iOS URL-bar chrome
- [x] More sheet opens properly: animates, scrolls, closes on backdrop tap and
      on Escape, does not sit under the bar, does not scroll the page behind it
- [x] Show who is signed in in the sheet, as the desktop rail does

## 3 · Hide Marketing — **done**

- [x] Temporary, not deleted. `social_stats` stops at 2026-04-24, so the screen
      has nothing recent to draw. Owner will re-open it when data is added
- [x] One flag, one place, documented so re-opening is a one-line change
- [x] Gone from rail, mobile bar, More sheet, ⌘K palette, permissions matrix
- [x] Route itself returns a "coming back" state rather than a broken chart

## 4 · Platform payouts: what has not landed

- [ ] Compare every delivery sales day against statement coverage per platform
- [ ] Separate genuinely missing statements from "too recent to be settled"
- [ ] Surface it on `/platform-payouts` — a statement gap is money not received
- [ ] Give the owner the list (also in "Payout gaps" below)

## 5 · Data audit against Supabase

Per screen: compute the headline numbers independently in SQL, compare with what
the page renders, and write down every disagreement. Tick a screen only after
looking at it in a screenshot with real data, not demo data.

- [ ] Overview — KPIs, per-day bars, top dishes, day drawer
- [ ] Sales — gross/orders/avg/per-day/lost, platform table, fee rates, heatmap
- [ ] Products — units, revenue, per-platform split, price flags
- [ ] Reviews — counts, average, distribution, per-platform
- [ ] Menu — prices vs `menu_item_price_history`, alias coverage
- [ ] Platform Payouts — statement totals vs computed sales for the same period
- [ ] Calendar — 53 shifts, Feb–Mar only. Check the empty months read as empty
- [ ] Payroll / My Payroll — 2 records, Feb 2026. Same
- [ ] Settings — 3 profiles, permissions matrix
- [ ] TV Displays — slots vs `menu_items.tv_number` / `position`

## 6 · Charts across every filter, both widths

For each screen with a chart: step every range (7d/30d/90d/custom), every
platform/source filter, and every interval (daily/weekly/monthly), at 1440px and
390px. Look for: axes that collapse, series drawn outside the plot, legends
overlapping data, empty states that render as a broken chart rather than a
sentence, and a filter combination that produces `NaN` or an infinite axis.

- [ ] Overview
- [ ] Sales
- [ ] Products
- [ ] Reviews
- [ ] Platform Payouts
- [ ] Calendar
- [ ] Payroll / My Payroll

---

## Groundwork

### The timezone bug, proven

`delivery_purchases.order_placed` is `timestamptz`; `pos_sales.order_placed` is
`timestamp` (naive). Both hold **Cyprus wall-clock time**, but the delivery
column carries a `+00` tag it has not earned. Converting that tag to
Europe/Nicosia (UTC+3 in summer) pushes every delivery order three hours later.

Two independent proofs:

1. Hour histograms of the two tables have the same shape when the delivery tag
   is ignored — nothing before 10:00, lunch peak 12–14, dinner peak 19–21,
   nothing after 22:00. A takeaway's day, on both tables.
2. Read naively, **Sundays have 0 orders** — the shop is shut. Read as the app
   reads it today, Sunday collects 33 phantom orders, which are Saturday's
   after-21:00 orders rolled past midnight.

`order_date` on `delivery_purchases` agrees with the naive date, which is the
correct business day.

### Data freshness, as of 13 Sep 2026

| Table | Rows | Covers |
|---|---|---|
| `delivery_purchases` | 3,695 | → 12 Sep 2026 |
| `pos_sales` | 2,110 | → 12 Sep 2026 |
| `platform_payouts` | 122 | → 10 Sep (Wolt), 5 Sep (Foody), 6 Sep (Bolt) |
| `reviews` | 298 | → 10 Sep 2026 |
| `social_stats` | 276 | → **24 Apr 2026** — why Marketing is being hidden |
| `shifts` | 53 | Feb–Mar 2026 only |
| `payroll_records` | 2 | Feb 2026 only |
| `profiles` | 3 | — |
| `menu_items` | 40 | 38 active |

### Payout gaps

Days with delivered orders that no statement covers.

**Missing statements** — settled periods on both sides, so these are genuinely
absent from the database:

| Platform | Period | Days | Orders | Gross | Note |
|---|---|---|---|---|---|
| Wolt | 2026-06-06 → 2026-06-15 | 10 | 76 | €1,264.32 | invoices jump 93592 → 102751, two statements |
| Wolt | 2026-08-26 → 2026-08-31 | 6 | 36 | €526.52 | invoices jump 142984 → 151836, one statement |

**Not settled yet** — the trailing edge, expected to arrive:

| Platform | Period | Days | Orders | Gross |
|---|---|---|---|---|
| Wolt | 2026-09-11 → 2026-09-12 | 2 | 19 | €268.70 |
| Foody | 2026-09-06 → 2026-09-12 | 6 | 30 | €544.20 |
| Bolt | 2026-09-07 → 2026-09-12 | 4 | 6 | €84.50 |

Statement cadence, for judging whether a gap is real: Wolt settles every 5 days,
Bolt every 7, Foody every 4–5.

### Tools

`./tools/sql.sh "select …"` runs read-only SQL against production through the
Supabase Management API, which unlike the anon key can see the RLS-locked
tables. Use it for every audit claim — do not eyeball a screenshot and call a
number verified.

---

## Audit findings

Recorded as they are found; each one either becomes a task above or is written
off here with a reason.

- **`social_stats` has no `stat_date` after 2026-04-24.** Not a bug — Marketing
  is being hidden for exactly this reason (task 3).
- **`shifts` covers Feb–Mar 2026 only (53 rows).** Calendar's current month is
  legitimately empty; what matters is that it says so.
- **`reviews.review_date`** carries the same mis-tagged `+00` as the delivery
  table, so it needs the same naive read (task 1).
- **Sales heatmap axis.** The "longest cyclic quiet run" logic existed only
  because the bug made orders look like they ran past midnight. Replaced with a
  plain earliest→latest traded-hour axis; it now reads 11:00 → 22:00.
- **The query window was already naive, the bucketing was not.** Pages fetch
  with bare bounds (`gte '2026-09-01'`, `lte '2026-09-13T23:59:59.999'`) which
  Postgres reads in UTC — correct under the wall-clock reading. Only the
  day/hour bucketing was shifted, so a range's last evening was dropped and the
  day before its start leaked in. Both ends are right now.
- **Verified against production, not demo.** `tools/audit-timezone.mjs` runs the
  real `buildSalesModel` over live rows for 1–12 Sep: per-day gross and order
  counts match `tools/sql.sh` to the cent on all 11 trading days, Sunday 6 Sep
  is €0.00 / 0 orders, and the newest order reads 12 Sep 21:46 rather than
  13 Sep 00:46.
- **Signing out was impossible on a phone.** The rail carries it on desktop; the
  More sheet listed pages only. It now opens with the person and a Sign out
  button, the way the rail does.
- **The bar was `sticky`, which is not the same as staying put.** Now `fixed`,
  with the page given `4.75rem + safe-area` of clearance so the last card is
  never underneath it. Verified: the More button sits at the same y after
  scrolling to the bottom of Overview, and the last card clears the bar by 76px.
- **Overview's "Social reach" card reads `social_stats` too.** Parked with
  Marketing under the same flag, so one edit brings both back.
- **Demo invents Google reviews.** `reviews.source_platform` in production is
  wolt/foody/bolt only (DESIGN.md departure 1), but the demo generator emits
  GOOGLE, so demo screenshots show a platform the real screen can never show.
  Worth correcting when task 5 reaches Reviews.
- **Parking is one import, not a search-and-replace.** The rail, ⌘K, the phone
  bar and the More sheet all derive from `useVisibleNav`, so a single check
  there covers four surfaces; the permissions matrix keeps its own list and
  needed the second. Verified with Playwright that Marketing is absent from all
  six, including the matrix, which now reads 8 columns and "3/8" rather than
  "3/9".
- **`page_permissions` grants for a parked page are left alone.** Nothing is
  deleted from the database, so whoever had Marketing still has it when it
  comes back.
