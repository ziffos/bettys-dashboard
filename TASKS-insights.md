# Insights build — what the data already knows and the screens do not

Agreed 16 Sep 2026 after a walk-through of every page against production.
One numbered task per loop iteration, finished completely before the next.

**The findings these come from**, so the wording on the screens can be exact:

- Revenue per open day fell from **€526 in January to ~€405 since April (−23%)**
  and has been flat there for five months. No screen shows it; a 7-day window
  compared with the 7 before cannot.
- **Betty's Classic is the worst-rated dish on the menu** — 2.98 average,
  **49% of its reviewed orders are 1–2 stars**, on 41 reviews — and it is the
  second biggest seller. Spicy Wings (3.34, 44% bad) and Betty's Family Deal
  (3.38) are next. Chicken Sandwich is the best at 4.76.
- Orders over €12 are rated badly twice as often as small ones (30–35% vs 16%).
- Platforms keep **28.8% (Bolt), 39.4% (Foody), 41.9% (Wolt)** of gross, while
  platform menu prices are only **11% above the till price**.
- Pure commission is 26–28% on all three. What separates them is **ads**
  (Foody €3,636 = 20% of its own gross; Wolt €2,455) and Wolt's **€2,352 of
  "other fees"** — €6,091 of advertising in eight months with no screen asking
  whether it sold anything.
- Top 5 dishes are 31% of units, top 14 are 62%, and 40 items are on the menu.
  Vegetable Burger has never been ordered.
- 13 of 40 items have an image, 26 of 40 a description.
- **Foody's review feed stopped on 1 May 2026** while Foody kept selling.
- Limassol had 55 days with ≥1mm of rain and 23 days at or above 35°C in the
  first 255 days of 2026 — enough of both to be worth plotting against takings.

**Not doing, and why:** attach rate per channel — every combo already bundles
`1 Side dish · 1 Soft drink`, so the drink is inside the combo line and a
string match undercounts it. Needs attention stays `UPCOMING`. Staffing over
the heatmap and rejections per hour are parked. The header's disabled Export
and Notifications stay as they are.

---

## 1. Cyprus public holidays, in the database

- [x] A `public_holidays` table: `day date primary key, name text`. **No
      `closed` column** — see the finding below; a holiday is not a closure.
- [x] Seed 2025–2027 from the Cyprus calendar, including the moveable ones
      (Green Monday, Orthodox Good Friday and Easter Monday, Kataklysmos),
      computed from Orthodox Easter. 48 rows.
- [x] `salesModel` gains `holidayOn(day)`. `openOn` is unchanged: the orders
      still decide whether the kitchen ran, the calendar only supplies a name.
- [x] Overview and Sales name the closure — in the marker's tooltip and, so
      that someone who never hovers still learns it, on a line under the chart.
- [x] The demo seeds the same real calendar and shuts for the same four days,
      so demo and production cannot disagree about something now named on screen.

## 2. Weather for Limassol, in the database

- [ ] A `weather_daily` table: `day date primary key, code smallint,
      temp_max numeric, temp_min numeric, rain_mm numeric, wind_kmh numeric`.
- [ ] Backfill from 2026-01-01 through the Open-Meteo archive API — no key,
      `latitude=34.707&longitude=33.022&timezone=Europe/Nicosia`.
- [ ] `tools/weather.mjs` to top it up, documented in CLAUDE.md.
- [ ] Nothing renders yet. Task 8 is where it earns its place.

## 3. Overview — revenue per open day, and fees in euros

- [ ] A **per-open-day** KPI beside the others, with the three-month trend
      behind it. This is the number the owner steers on and the one that fell
      23%.
- [ ] The fee-rate KPI keeps its percentage but gains the euro: what a platform
      takes out of an average order. Nobody feels 21.8%; everybody feels €6.80.

## 4. Reviews — which dish is being rated

- [ ] Lead the page with **rating per dish**: average, count, and the share of
      1–2 star orders, for every dish with enough reviews to mean anything.
      297 of 298 reviews resolve to an order, so this is already on the record.
- [ ] Rating by hour of day next to it.
- [ ] **Tone down "What people mention"** — only 49 of 298 reviews carry text,
      which is too little to lead with.
- [ ] Say on the page that **Foody's feed stopped on 1 May 2026**, rather than
      letting the average drift without explanation.

## 5. Menu — what you actually keep

- [ ] Beside "Markup vs POS", a **net per item per channel**: price less that
      platform's own take rate, so €8.00 on Foody reads as what reaches the
      bank. Rebase the take rate on each platform's own statements.
- [ ] Image and description coverage, since both are columns already on the
      table and both move conversion on the platforms.

## 6. Platform payouts — what the advertising bought

- [ ] Split **pure commission** from ads, deductions and other fees. All three
      platforms charge 26–28% commission; the spread between 28.8% and 41.9%
      is everything else, and that is the negotiable part.
- [ ] An **advertising card**: spend per platform per period against orders in
      the same period, and cost per order. €6,091 in eight months deserves the
      question.

## 7. Products — what each dish does in a day

- [ ] **Sold per open day** per item, so a slow dish is a decision rather than
      a feeling, and so ranges of different lengths compare.
- [ ] A Pareto read on the movers table: how few dishes carry the volume.

## 8. Sales — weather and takings

- [ ] A card answering *was that a bad night, or a bad sky?* — takings per open
      day split by rain and by temperature band, over whatever range is set.
- [ ] The day's weather in the bar tooltip and in the day drill-down.
- [ ] Say plainly when a range holds too few wet days to mean anything.

---

## Findings

**A public holiday is not a closed day, and the table must not pretend it is.**
The first design had a `closed boolean`. The orders say otherwise: in 2026
Betty's **traded through** New Year's Day, Epiphany, Greek Independence Day,
Cyprus National Day, Orthodox Good Friday and Labour Day, and **shut for**
Green Monday (23 Feb), Orthodox Easter Monday (13 Apr), Kataklysmos (1 Jun)
and the Assumption (15 Aug). Only the orders know which. So the table carries
the day and the name, nothing else, and `openOn` still counts orders.

**Four of the seven non-Sunday closures this year are now explained**, which
is what makes the other three worth asking about: **14 April** — the Tuesday
after Easter Monday, so probably the tail of the Easter break — and **17–18
August**, which remain unexplained and are already a to-do in the Assistant.

**The demo had to learn the calendar too.** Its closed days were Sundays only,
so a range containing 15 August showed a trading Saturday in demo and a closed
one in production. `generate.js` now computes the same holidays and shuts for
the same four, which is also what makes the feature visible in a screenshot.
