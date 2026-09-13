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

## 4 · Platform payouts: what has not landed — **done**

- [x] Compare every delivery sales day against statement coverage per platform
- [x] Separate genuinely missing statements from "too recent to be settled"
- [x] Surface it on `/platform-payouts` — a statement gap is money not received
- [x] Give the owner the list (also in "Payout gaps" below)

## 5 · Data audit against Supabase — **done**

Per screen: compute the headline numbers independently in SQL, compare with what
the page renders, and write down every disagreement. Tick a screen only after
looking at it in a screenshot with real data, not demo data.

- [x] Overview — KPIs, per-day bars, top dishes, day drawer
- [x] Sales — gross/orders/avg/per-day/lost, platform table, fee rates, heatmap
- [x] Products — units, revenue, per-platform split, price flags
- [x] Reviews — counts, average, distribution, per-platform
- [x] Menu — prices vs `menu_item_price_history`, alias coverage
- [x] Platform Payouts — statement totals vs computed sales for the same period
- [x] Calendar — 53 shifts, Feb–Mar only. Check the empty months read as empty
- [x] Payroll / My Payroll — 2 records, Feb 2026. Same
- [x] Settings — 3 profiles, permissions matrix
- [x] TV Displays — slots vs `menu_items.tv_number` / `position`

## 6 · Charts across every filter, both widths

For each screen with a chart: step every range (7d/30d/90d/custom), every
platform/source filter, and every interval (daily/weekly/monthly), at 1440px and
390px. Look for: axes that collapse, series drawn outside the plot, legends
overlapping data, empty states that render as a broken chart rather than a
sentence, and a filter combination that produces `NaN` or an infinite axis.

- [x] Overview
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
| Foody | 2026-09-06 → 2026-09-12 | 7 | 30 | €544.20 |
| Bolt | 2026-09-07 → 2026-09-12 | 6 | 6 | €84.50 |

Statement cadence, for judging whether a gap is real: Wolt settles every 5 days,
Bolt every 7, Foody every 4–5.

**€2,688.24 of gross is unsettled in total, €1,790.84 of it genuinely missing.**
Spans count calendar days, so a closed Sunday inside a gap is part of it.
`tools/audit-payout-gaps.mjs` reproduces this list from the app's own
`findPayoutGaps`, and it matches the SQL island query row for row.

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
- **Gap islands must be cut on coverage, not on sales.** Islanding on sales days
  split Wolt's June gap into three (6th, 8th–12th, 15th) because the shop is
  shut on Sundays. Cutting on coverage gives the one real answer: 6–15 June, ten
  days, 76 orders, €1,264.32 — a Wolt invoice number jump of 93592 → 102751,
  which is two statements.
- **The unsettled card cannot live inside the header range.** A statement
  missing since June is still missing while you look at last week, and the
  range-empty state is exactly when you most want to see it. It scans every
  statement there is and renders in the empty branch too.
- **Two-step fetch keeps it cheap.** Coverage alone tells you where the gaps
  are, so the order query starts at the first uncovered day instead of pulling
  all 3,695 deliveries. It shrinks as statements arrive.

### Overview (task 5)

Reconciled with `tools/audit-overview.mjs`, which runs the real model over live
rows, plus `tools/sql.sh` for the independent numbers.

- **Top dishes ranked spellings, not dishes.** It counted the raw `items`
  string, and the three platforms disagree: `Hungry Hero` / `HUNGRY HERO`,
  `Betty's Classic` / `BETTY'S CLASSIC` / `Betty\`s Classic`. Over the last 7
  days that split 324 units across **76** "dishes" instead of 35, and pushed
  **Betty's Classic — 24 units, joint fourth — out of the top five entirely**.
  Fixed by routing every line through `buildMenuMatcher`, the same matcher
  Products already used; an unmatched line keeps its raw name rather than
  vanishing (3 units of 324 in that window). SQL agrees with the corrected list
  exactly: Hungry Hero 36, Wicked Wings 29, Crispy Chicken 25, Betty's Classic
  24, Double Delight 24.
- **Verified sound:** gross, orders and average order match SQL for all five
  ranges; the per-day bars sum to the headline for every range; the channel
  rates sum back to the headline fee; each statement's fees spread across its
  days to the cent (worst drift 0.000000) and a day's fee never exceeds that
  day's revenue.
- **Our order log and the platforms' reported gross disagree systematically**,
  and by platform: our delivered revenue averages **94.9%** of Wolt's reported
  gross, **94.9%** of Bolt's — rejected orders account for nearly all of that —
  but **121.3%** of Foody's, every statement, min 113% max 133%. So any rate of
  the form *statement fees ÷ our revenue* is overstated for Wolt and Bolt and
  understated for Foody. Overview's FEE RATE and the Payouts variance check both
  rest on it. → carry into the Platform Payouts row.
- **The 2% variance flag fires on 79 of 118 statements (67%).** A warning that
  is on two thirds of the time is not a warning. It is measuring the
  definitional gap above, not a data error. → fix on the Platform Payouts row,
  by flagging drift from that platform's own normal rather than from zero.
- **A 67% fee week is real, not a bug.** Wolt 6–10 Sep took €181.47 of customer
  deductions on €646.85 of gross. The model is right to show it.
- **Some Wolt item names contain a comma** — "Chilled Coca Cola Regular Can,
  330 ml" — so the comma split breaks them in two. `parseItems`' unit guard
  drops the orphan "330 ml", so the drink still counts, just under a name
  without its size. 32 lines in all of history; left alone.

### Sales (task 5)

Reconciled with `tools/audit-sales.mjs` and `tools/sql.sh`.

- **`delivery_status` has five values, and two of them were invisible.**
  delivered 3,579 · rejected 65 · cancelled 47 · **failed 2** · **courier near
  pick up 2**. The page counted the first three and silently dropped the rest,
  so four orders worth €70.80 were neither revenue nor loss, and the loss-rate
  denominator was short by the same four. CLAUDE.md and DESIGN.md both claimed
  three statuses; both corrected. The card is now driven by the data — one row
  per non-delivered status found, so the next unexpected status announces
  itself. `failed` counts as a loss; anything not terminal is tagged IN FLIGHT
  and sits in the denominator but not the numerator.
- **Verified sound:** for the 28-day range the platform table matches SQL
  exactly — total €8,881.00 / 594 orders / €14.95 average, POS €2,997.69 / 241 /
  €12.44, Wolt €2,907.56 / 198 / €14.68, Foody €2,231.55 / 115 / €19.40, Bolt
  €744.20 / 40 / €18.61.
- **Open days are counted, not assumed.** 22 of 28 in that window: four Sundays
  plus **Mon 17 and Tue 18 August, which have zero orders on every source** — a
  real two-day closure (or an import hole), and either way correctly excluded
  from the per-day average.
- **The heatmap axis now reads 11:00 → 22:00**, twelve columns, twelve dead
  hours dropped, Sunday row empty. Peak Fri 20:00.

### Products (task 5)

Reconciled with `tools/audit-products.mjs` and `tools/sql.sh`.

- **Order lines that matched no menu item were dropped without a trace.** 8
  lines, 9 units, 0.8% of the 28-day window — small, but it is exactly how a
  missing alias becomes a dish that looks like it never sold. They now appear in
  a banner naming the platform, the exact spelling and the count, with the fix
  (add it to that dish's platform name in Menu).
- **`parseItems` broke any item name containing a comma.** Wolt sells a "Chilled
  Coca Cola Regular Can, 330 ml"; splitting on commas stranded the size, the
  unit guard dropped it, and the name was truncated — which cost the line its
  match. Six of the nine dropped units were this. The stranded token is
  reattached now. SQL counts 5 such tokens in the window, 1,048 item lines and
  1,241 units in total, which the parser agrees with exactly.
- **The Coke still will not match, and that is the owner's data.** The Wolt
  alias is `Coca-Cola`; Wolt writes `Chilled Coca Cola Regular Can, 330 ml`.
  Also unmatched: `Coca Cola Zero Can 330ml` (Wolt), `Chicken` (Bolt),
  `MAYONNAISE` (POS). The banner now says so.
- **Item revenue is a reconstruction and runs above what was charged.** It is
  priced from `menu_item_price_history`, not from the order, because no per-line
  price exists anywhere. Over the 28-day window that is €9,267.70 against
  €8,881.00 actually taken — **4.4% high**, which is discounts and promotions
  the price list does not know about. The KPI already reads "at menu price,
  before fees", which is the honest label.
- **Three active items carry no aliases at all** — Vegetable Burger, Vegetable
  Burger Combo, Sweet Potatoes — and Halloumi Burger has no `pos_name`. Not a
  false zero in any case: `Sweet Potatoes` appears in 19 orders spelled exactly
  as its canonical name and matches on the fallback, POS writes Halloumi Burger
  normalisably, and the two Vegetable Burger rows appear in no order ever
  placed. They really do sell nothing.

### Reviews (task 5)

Reconciled with `tools/audit-reviews.mjs` and `tools/sql.sh`.

- **Foody's review feed died on 1 May 2026.** 12–15 reviews a month through
  April, one in May, then **zero for June, July, August and September** — while
  Foody kept taking 115 orders in a 28-day window. The per-platform row said
  "none yet", which reads as "Foody customers do not review" rather than "this
  import stopped". It now reads **"none since 1 May"** when a platform has
  history but nothing in range, and keeps "none yet" for one that has genuinely
  never had any — which is Google, the platform kept in the UI on purpose
  (DESIGN.md departure 1).
- **The data itself is clean.** 298 reviews; three platforms only (wolt 194,
  foody 56, bolt 48); every rating 1–5; all-time average 3.849. 297 of 298 carry
  an `order_reference` and **all 297 resolve to a real order**, with the review's
  platform matching the order's platform **every single time**, and not one
  review dated before the order it rates.
- **`reviewer_name` is null on all 298 rows** and only **49** carry
  `review_text` — CLAUDE.md still said 40 of 231; corrected.
- **Demo was lying about this screen.** It invented Google reviews with
  reviewer names, linked only 40% of them to an order, and gave 78% of them
  text. Production has none of that. Demo now takes the order first and lets it
  decide the platform (so the reference always resolves and the platforms always
  agree), never sets a name, writes text on 16%, and stalls Foody's feed partway
  through — so the screen looks like what the owner will actually see.

### Menu (task 5)

Reconciled with `tools/sql.sh`.

- **Prices agree.** For all 38 items × 4 platforms the newest
  `menu_item_price_history` row equals the matching `menu_items.*_price`
  column — zero disagreements — so what Menu shows is what Products values
  orders at. 150 history rows, 149 still open; the single closed one is
  Halloumi Burger's POS price moving off €9.50 on 31 March.
- **A dish priced on a platform with no name for it can never be counted
  there.** Its orders end up in Products' "could not be matched" banner and the
  dish itself looks like it sells nothing. Menu now names them: **Halloumi
  Burger has no till name**, **Sweet Potatoes has none of the four** despite
  being priced on all of them, and **Vegetable Burger has no till name**. A
  dish with no *price* on a platform is simply not sold there and wants no
  name, so it is not flagged.
- **The price flag is right and catches one real thing.** Halloumi Burger is
  €8.00 on Foody and €8.00 in store — Foody's ~48% cut comes straight out of
  the margin.
- **Vegetable Burger is a ghost.** Active, priced in store only, no aliases, and
  it appears in no order ever placed (checked on Products). Worth deactivating.
- **Demo never exercised the name matcher.** It gave all four alias columns the
  identical canonical name, so `buildMenuMatcher` had nothing to do and the
  Overview bug — counting raw spellings — could not have shown up in a
  screenshot. Demo now writes what the platforms really write: the till in
  capitals, Foody lower-case with a backtick, Wolt and Bolt as-is, and Halloumi
  Burger with no till name at all. Verified after the change that Products still
  matches everything except the deliberate long drink names, and Overview's top
  dishes still resolve to canonical names.

### Platform Payouts (task 5)

Reconciled with `tools/audit-payouts.mjs` and `tools/sql.sh`.

- **The variance flag was measuring the wrong thing, and fired on two thirds of
  statements.** Each platform sits at its own steady offset against our order
  log — median reported/ours is **Bolt 1.0000, Wolt 1.0377, Foody 0.8256**, and
  Foody's is that tight on *every single statement* (0.754–0.885). Against a
  2% tolerance from zero, 77 of 118 were "wrong". The check is now drift from
  the platform's **own median**, at 15%, which flags **9 of 118** — a list worth
  reading. The tooltip says what normal is for that platform so the number can
  be interpreted.
- **The outliers it now finds are real.** Worst is **Bolt 29 Dec – 4 Jan,
  reported €187.55 against €78.95 in our log, 138% above Bolt's normal**
  (CY1426-891). Then three more Bolt weeks around +36%, and **Wolt 21–25 July,
  €1,672.30 against €1,266.63, +27%** (invoice …125164).
- **`net_payout` did not agree with the four fee columns on 33 of 118
  statements.** Foody in particular charges a flat **€71.40** that appears in no
  column; the worst single gap was €181.47. So "fees" is now defined as **gross
  minus the net that actually landed** — every statement states a net, none
  implies a negative or impossible fee — and the four columns are shown as a
  breakdown of it, with the remainder as its own **"Not itemised"** slice so the
  panel always adds up. Across all statements that moves total fees from
  €23,660.98 to €23,787.58: **€126.60 more actually left the account than the
  columns admit.**
- **Demo could not have shown either problem.** Its `net_payout` was defined as
  gross minus the four columns, so there was never a remainder, and its reported
  gross was always exactly our own, so nothing ever drifted. Demo now carries a
  flat unlisted Foody charge and the occasional statement reporting well away
  from its orders.

### Calendar (task 5)

Checked with `tools/sql.sh` — `shifts` and `profiles` are RLS-locked, so the
anon-key audit scripts cannot see them and the management API is the only way in.

- **The whole roster is test data.** Three profiles: `Dinos` (admin, the owner),
  `Test Employee` and `Maria Test` — hourly rates €5 and €9.50, `job_title` null
  on all three. 53 shifts, 31 in February and 22 in March, nothing since **30
  March**. Calendar, Payroll, My Payroll and Settings are all running on
  placeholders until real staff are entered.
- **An empty week now says why.** It read "Nothing scheduled for this week" —
  true, but useless when the roster stopped five months ago. It now adds **"The
  roster runs to 30 March"** whenever the week you are looking at sits past the
  end of it.
- **Shifts were fetched with a bare `.limit(1000)` ordered newest-first**, so
  once the roster passed roughly a year of four people the oldest shifts would
  have vanished from the calendar with no sign. Paginated through
  `fetchAllRows` now. Harmless today at 53 rows; silent later.
- **The shift data itself is sound.** No shift ends before it starts, none is
  missing an hourly rate or a break, and they run 09:00–22:00 — consistent with
  a kitchen that trades 11:00–22:00 and preps beforehand.
- **Four shifts fall on a Sunday**, which is the day the shop takes no orders at
  all. All four are test rows, so this is not evidence against the closed-Sunday
  rule the screens rely on (DESIGN.md departure 18) — but worth re-checking once
  the real roster is in.

### Payroll / My Payroll (task 5)

Checked with `tools/sql.sh` — these tables are RLS-locked too.

- **February reconciles exactly.** Both records carry the same hours the shifts
  add up to (Maria Test 105.50, Test Employee 128.00 — 233.50 together, which is
  February's shift total to the minute), `amount_paid` equals `gross_expected`
  on both, and the three `payroll_payments` rows sum to them precisely
  (640.00, and 500.00 + 502.25 = 1,002.25). The trigger is doing its job.
- **March was worked and never rolled into payroll.** 166 hours across three
  people — Test Employee 82.5, Maria Test 67.5, Dinos 16.0 — and no
  `payroll_records` row at all. The screen handles it correctly by pricing the
  hours from `rate_changes` and showing the month unpaid; it is the data that is
  outstanding, not the code.
- **Hours with no rate on file were priced at €0, which reads as "owes them
  nothing".** Dinos has 16 March hours and no `rate_changes` row anywhere, so
  the row said €0 and the month looked settled. Rate and gross now show "—", the
  person is left out of the owed total, and a banner names them and points at
  Settings. Hours still count, because they were worked.
- **One rate change is already in the past.** Test Employee went €5.00 → €7.00
  effective April 2026; the other two rows are the original rates from March.
  Nothing is pending, so Settings correctly announces no scheduled change.
- **Demo gave everyone a rate**, so the unpriced path could not appear in a
  screenshot. One person is now on the rota with no rate, mirroring production.

### Settings (task 5)

Checked with `tools/sql.sh`.

- **An employee with no pages granted was stuck in a redirect loop.** Login sent
  every employee to `/calendar`; the route guard then found they could not open
  it and redirected them to `/calendar`, over and over, with a toast firing on
  each pass. **`Maria Test` in production has zero `page_permissions` rows** and
  hits exactly that. Landing is now their first granted page in rail order, and
  when nothing has been granted the layout says so — "Nothing has been shared
  with you yet" — with a way out. `tools/audit-access.mjs` checks every shape,
  including grants for only a parked page or only an admin-only page, and no
  case lands somewhere it cannot open.
- **The access maps moved to `src/lib/access.js`**, a pure module, so the
  landing rule can be tested outside the browser and the layout does not have to
  import the whole auth context to ask one question.
- **The rest of Settings is consistent with the data.** Three profiles — the
  owner on a real address plus two test accounts — all active, `job_title` null
  on all three. Grants: Test Employee has calendar, my-payroll and reviews;
  Maria Test has none; no grant points at a profile that does not exist.
- **Someone with no rate reads "—" here too**, matching what Payroll now shows,
  and Payroll's banner points at this screen to fix it.

### TV Displays (task 5)

Checked with `tools/sql.sh`.

- **The slot data is clean and the database enforces every rule the screen
  assumes.** All twelve slots filled, nothing half-assigned, nothing inactive on
  a screen, every `tv_number` 1–3 and every `position` 1–4, 28 items off-screen.
  The constraints: `menu_items_tv_slot_unique` (partial unique on
  `(tv_number, position)`), `menu_items_tv_slot_paired` (both set or both null),
  and range checks matching `SLOT_DISPLAYS` and `SLOTS_PER_DISPLAY`. So the
  three-step swap in `placeAt` is **required**, not defensive.
- **Hiding a dish took it off the wall but left it holding the slot.** The
  boards filter on `is_active`, so a hidden dish stops rendering and the wall
  shows a gap — while its row still owned `(tv_number, position)`. TV Displays
  filtered on `is_active` too, so the slot looked empty in the editor, and
  dropping anything into it would have hit the unique index with nothing to
  explain why. Hiding a dish now clears its slot in the same write and the toast
  says so ("… is hidden, and off TV 1"), and the editor fetches hidden items as
  well so an occupant left over from before is visible and clearable, marked
  HIDDEN · NOT ON THE WALL. The library still only offers active dishes.
- Verified end to end in one page load: hide `Betty's Classic` on Menu → toast
  reads "hidden, and off TV 1" → slot 1 of display 1 reads **Empty slot** →
  library holds 25, the hidden dish correctly not among them.

### Charts across every filter (task 6)

`tools/sweep.mjs <route>` steps a screen through every range and interval at
1440px and 390px and fails on anything that cannot be right: NaN or Infinity in
the text or in an SVG attribute, a chart that rendered with no height, content
wider than the viewport, or a page error. Screenshots of anything it flags land
in `.shots/sweep/`.

- **Overview — 30 combinations, clean.** Today falls through to a proper empty
  state with a way out; This quarter on Monthly gives three month bars with the
  estimated-fee cap drawn correctly; the 76-point sparklines stay legible.
- **"compared with previous 1 days".** Four screens built that sentence by
  pasting a number in front of "days", so every one-day range read "the 1 days
  before" — and Sales said it twice, "1 days · compared with the 1 days before".
  Replaced with `dayCount` and `priorPhrase` in `format.js`; it now reads
  "compared with the day before".
