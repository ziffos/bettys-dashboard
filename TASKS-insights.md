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

- [x] A `weather_daily` table: `day date primary key, code smallint,
      temp_max numeric, temp_min numeric, rain_mm numeric, wind_kmh numeric`.
- [x] Backfilled **290 days, 1 Dec 2025 – 16 Sep 2026** from the Open-Meteo
      archive — no key, `latitude=34.707&longitude=33.022&timezone=Europe/Nicosia`.
- [x] `tools/weather.mjs` tops it up and re-fetches the last stored day,
      because the archive revises recent ones. Documented in CLAUDE.md.
- [x] The demo generates a Limassol year rather than fetching one — it is
      anchored to today and half its days are in the future.
- [x] Nothing renders yet. Task 8 is where it earns its place — **and task 8
      now has to say something different from what I expected**, see below.

## 3. Overview — revenue per open day, and fees in euros

- [x] A **NET PER DAY** KPI beside the others, with **thirteen weekly points**
      behind it rather than the range. The other four sparklines run inside the
      range and compare with the period before; this one deliberately does not,
      because a slide that took a quarter to happen is invisible to a
      week-on-week comparison. Weekly, so a closed Monday does not read as a
      collapse. Its sub names where the trend started: "€885 a day thirteen
      weeks ago".
- [x] The fee-rate KPI keeps its percentage and gains the euro: "€3.48 out of
      an average order · Foody is the expensive one".
- [x] The grid goes to five across, matching Sales. The label is **NET PER
      DAY** rather than PER OPEN DAY — the longer one truncated on a phone, and
      Sales already owns "PER DAY" for the gross figure.

## 4. Reviews — which dish is being rated

- [x] **Which dish is being rated** leads the page under the breakdown:
      average, count and the share of 1–2 star orders, worst first, over
      **every review on record rather than the range** — a 7-day window holds
      about ten reviews in total, which is nothing split across forty dishes.
      Twelve rows, then "Show the other N, all better rated".
- [x] **By hour ordered** beside it, bars running one star to five, red under
      3.5, hours with fewer than five reviews left out.
- [x] **"What people mention" demoted** — it was the first card under the
      breakdown and is now below both new ones. It was already an
      `UpcomingCard` that says only 49 of 298 reviews carry text, so it did
      not need rewriting, only moving out of the lead.
- [x] The platform table already said "none since 22 Jan" in a cell. It now
      says what that **means** underneath: the platform has sent nothing since
      then while still taking orders, so the average above is the other
      platforms only and does not compare with a period before that.

## 5. Menu — what you actually keep

- [x] A third price mode, **What you keep**, beside Prices and Markup vs POS:
      each platform's price less that platform's own take, from its own
      statements rather than a rate card. Red when what is left falls below
      three quarters of the till price, which on production is every Wolt and
      Foody row.
- [x] A note under the table saying the rates and where they come from, and
      that they already include whatever advertising and customer credits the
      platform deducted.
- [x] Image and description coverage, as a quiet line under the table rather
      than a banner: 13 of 40 carry a photo, 26 a description.
- [x] **The phone carried none of this and neither did the two modes before
      it** — a 390px screen hides all three platform columns, so Prices,
      Markup and What you keep all looked identical there. The row now carries
      `W €4.79 · F €4.71 · B €5.03` under the name, in the current mode.

## 6. Platform payouts — what the advertising bought

- [x] **Where the fee goes** — a stacked bar per platform, commission ·
      advertising · credits and other, in points of gross, with what the
      platform keeps beside it. Commission is a rate; the rest is a decision.
- [x] **What the advertising bought** — spend per platform divided by the
      orders the same statements cover. Framed as what each order carries, not
      as a return: nobody here knows which orders the advertising caused, and
      spend follows a busy week as readily as it makes one.
- [x] Handles the case production actually has — Foody's itemised charges come
      to **more** than the gap between its gross and its net, so its "rest" is
      −8pp. The bar is scaled by its positive parts so it cannot spill, and the
      card says what a negative rest means.

## 7. Products — what each dish does in a day

- [x] **Sold per open day** under the unit count on every row, so a week and a
      month can be read side by side. Open days, not calendar days: Betty's is
      shut one day in seven and the Sundays have to come out of the
      denominator or every dish reads a fifth slower than it is.
- [x] A **Pareto line** under the table — how much of everything sold is
      carried by the five biggest sellers, and by the top fourteen.

## 8. Sales — weather and takings

> **Rewritten after task 2 measured it.** The card cannot say rain sells
> chicken, because within a month it does not. It answers *was it the sky?*
> with, on this evidence, *probably not — look elsewhere*, which is the more
> useful answer and the only honest one.

- [x] **Weather and takings** on Sales: gross per open day split by rain and by
      temperature band, over whatever range is set.
- [x] The confound is stated in the card itself, in as many words: the weather
      looks like it matters and it is the season wearing its coat. Wet days
      average €44 more than dry ones until you compare them inside the same
      month, where the gap falls to €17 across 46 wet days and changes sign.
      **The card exists to rule the weather out, not to blame it.**
- [x] The day's weather in the bar tooltip and in the day drawer's eyebrow —
      "DAY DETAIL · Clear · 31°". `weatherLabel` in `format.js` reads the WMO
      codes Open-Meteo returns.
- [x] The thin-data note is scoped to the rain half rather than the whole card,
      because a summer range in Limassol has 23 usable days of temperature and
      one of rain — saying "too few to compare" over the whole thing would have
      been wrong about the half that works.

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

**Per open day is stable across ranges, which is the whole point.** The same
dish reads 8.6/day over seven days and 8.5/day over twenty-eight. The raw unit
count moves from 60 to 238 between those two and says nothing about whether
anything changed. On production the menu is a Pareto: **the top five names are
31% of all units and the top fourteen 62%**, out of 195 distinct order-line
names.

**Advertising is not a fixed share, which is what makes it a decision.** Wolt's
ad spend ranges from 0.5% to 18% of a statement's gross (sd 4.7), Foody's from
11.8% to 27.2% (sd 4.5). If it were a flat rate there would be nothing to
decide; it is not. Foody's spend and its order count move together at r = 0.71
across 40 statements, Wolt's at 0.30 across 32 — which is worth knowing and is
not proof of anything, since spending more in a week that was always going to
be busy produces exactly that correlation.

Per order: Foody €3.02, Wolt €1.71, Bolt nothing at all. Foody's average order
is €20.29, so **three euros in fifteen of every order goes to Foody's own
advertising**, on top of 28pp of commission.

**Foody's fee columns overshoot its own net by 8pp of gross.** Commission
(28pp) plus advertising (20pp) comes to 48pp while the gap between what Foody
reported and what it paid is 39pp. That is the same disagreement the September
audit found on 33 of 118 statements, and it means either the net is more
generous than the columns say or a column is overstated. The card shows it as
a negative rest rather than clamping it to zero, and scales the bar by its
positive parts so nothing spills.

**Wolt has the lowest commission of the three and keeps the most.** Rebasing
on each platform's own statements:

| | Keeps | of which commission | everything else | statements |
|---|---|---|---|---|
| Wolt | 42% | 27pp | **16pp** | 48 |
| Foody | 39% | 28pp | **21pp** | 40 |
| Bolt | 29% | 26pp | 2pp | 37 |

All three charge the same commission, near enough. The entire difference
between Bolt at 29% and Wolt at 42% is advertising, customer credits and
"other fees" — the part that is a decision rather than a rate. That is the
negotiable half, and it is what task 6 puts on the Payouts page.

What it does to a dish: Betty's Classic is €6.50 over the counter and €7.20 on
Wolt, which after Wolt's take leaves **€4.79**. The menu's 11% platform markup
does not begin to cover a 42% take, and until now no screen said so.

**The dish table needed the menu matcher, and it changed the answer.** Run
through `buildMenuMatcher` — the same path Products uses — production's 297
resolvable reviews touch 39 dishes, 21 with ten or more. Worst first:

| Dish | n | Avg | 1–2 star |
|---|---|---|---|
| Chicken Burger Combo | 10 | 2.80 | 50% |
| **Betty's Classic** | **39** | **3.08** | **46%** |
| Crispy Chicken | 13 | 3.31 | 23% |
| Spicy Wings | 32 | 3.34 | 44% |
| Betty's Family Deal | 26 | 3.38 | 38% |
| Double Delight | 41 | 3.54 | 27% |
| Hungry Hero | 56 | 3.82 | 21% |
| Chicken Stripes Combo | 27 | 4.04 | 11% |

My first pass, matching on normalised strings instead, put Betty's Classic at
2.98 on 41 reviews. The matcher collapses the spellings properly and one order
now casts one vote per dish, which moves it to **3.08 on 39** — the finding
stands either way, and the second-biggest seller on the menu is second from
the bottom of its own review table.

**The thirteen-week trend needed its own fetch, and it is worth the cost.**
Overview loads the range and the period before it, which for a 7-day window is
14 days — nowhere near enough to see the slide. The trend now comes from a
second, deliberately lean query: order day, price, status and partner over 91
days, with no `items` string, because the menu matching does not run over that
window. On production the last thirteen weeks read €428, 329, 414, 413, 361,
484, 391, 426, 383, 417, 414, 420, 368 — mean €404 gross per open day, flat.
That flatness is the point: the fall happened between January and April and
nothing has moved since.

**The weather does not move takings, and the raw numbers say it does.** Over
the whole year, days with at least 1mm of rain averaged **€469–470 against
€425 on dry days** — a tempting +10%. It is the season. Compare wet and dry
days *inside the same month* and the gap collapses to **+€17 across 46 wet
days**, with the sign flipping month to month: +19, −43, −49, +83, −40.
Temperature looks even stronger and is even more confounded — days under 20°C
averaged €480 against €401 in the 30–35°C band, but the cold days are January
and February, when Betty's was taking €526 a day for reasons that have nothing
to do with a coat. With one year on record the season and the weather cannot be
told apart, and the Sales card has to say so rather than flatter the obvious
story.

**The demo had to learn the calendar too.** Its closed days were Sundays only,
so a range containing 15 August showed a trading Saturday in demo and a closed
one in production. `generate.js` now computes the same holidays and shuts for
the same four, which is also what makes the feature visible in a screenshot.
