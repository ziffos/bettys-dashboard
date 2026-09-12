repo: ziffos/bettys-dashboard
branch: master

## Last sync

date: 2026-09-12T17:33:59Z

### Updated in this project

- TV Displays rebuilt: the preview mode and the layout editor became one view — each screen shows its four slots as they appear on the wall and is arranged in place — plus an on-air heartbeat per display and a warning for empty slots
- My Payroll rebuilt: the one-at-a-time month accordion became a month list with payment progress, a headline answering "what am I owed", and the month's shifts and payments side by side
- Settings rebuilt: the per-employee permissions accordion became a matrix (people down, the nine pages across, column headings grant or revoke for the whole team), people moved from cards to a table, and scheduled pay changes are shown up front instead of only inside the edit modal
- Calendar rebuilt: the month grid of name chips became a week timeline (a row per day, bars placed by time, an hourly coverage strip and per-day hours and labour cost), with the month grid kept as a second view and a side panel replacing the add/edit modal
- Payroll rebuilt: the one-at-a-time accordion became a table where hours, rate, gross, paid and owed are all visible at once, with a payment progress bar per person, a month total showing what is still outstanding, and the "log payment" side panel replacing the modal
- Platform Payouts rebuilt: the 3-column card grid became one sortable statement table with a per-payout fee-mix bar (replacing the aggregate donut), a CHECK column reconciling platform-reported gross against our own order log, KPI period comparisons, and a totals row
- Menu rebuilt: inline row editing replaced by a side panel so the table never reflows, a "Markup vs POS" view shows what each platform price adds over the in-store price, and items priced the same on delivery as in-store are flagged and filterable
- Reviews rebuilt: one rating hero with per-platform comparison replaces five rating cards, the rating breakdown doubles as the star filter, review themes added, the search input the old page filtered on but never rendered is now real
- Products rebuilt: category chips replace the nested category/item dropdowns, one sortable item table with per-item sparkline and channel mix replaces the top-10 bar chart plus top-5 line chart, attach rate and items-per-order added, never-sold items surfaced
- Marketing rebuilt: reach-vs-revenue correlation chart promoted to the top, cost-per-1k-reach KPI, reach split by platform, follower growth
- Sales rebuilt: source filters, stacked revenue-by-source chart with hover readout, platform table, rejected-order breakdown, hour-by-day heatmap
- Overview rebuilt on a light Geist / nextjs.org design language, mobile-first

## Screen map

| Project screen | Repo files |
| --- | --- |
| Betty's Dashboard — Current.dc.html | src/app/page.js, src/components/ClientLayout.js, src/components/Sidebar.js, src/components/SkeletonBlock.js, src/app/globals.css, src/app/layout.js |
| Betty's Dashboard v2.dc.html — Overview | src/app/page.js, src/components/Sidebar.js, src/components/ClientLayout.js |
| Betty's Dashboard v2.dc.html — Sales | src/app/sales/page.js |
| Betty's Dashboard v2.dc.html — Marketing | src/app/marketing/page.js |
| Betty's Dashboard v2.dc.html — Products | src/app/products/page.js |
| Betty's Dashboard v2.dc.html — Reviews | src/app/reviews/page.js |
| Betty's Dashboard v2.dc.html — Menu | src/app/menu/page.js |
| Betty's Dashboard v2.dc.html — Platform Payouts | src/app/platform-payouts/page.js |
| Betty's Dashboard v2.dc.html — Payroll | src/app/payroll/page.js |
| Betty's Dashboard v2.dc.html — Calendar | src/app/calendar/page.js |
| Betty's Dashboard v2.dc.html — Settings | src/app/settings/page.js |
| Betty's Dashboard v2.dc.html — TV Displays | src/app/tv-displays/page.js |
| Betty's Dashboard v2.dc.html — My Payroll | src/app/my-payroll/page.js |

## Notes

- Icons are lucide (lucide-icons/lucide@main), matching the repo's lucide-react usage
- Brand mark copied from public/images/betty_logo.png
- Data is representative mock data shaped like delivery_purchases, pos_sales, platform_payouts, menu_items, reviews and social_stats; item volumes are reconciled against the Sales order counts (~3.6 items per order)
- Product categories and colours follow the repo's CATEGORIES / CATEGORY_COLORS, remapped onto the Geist palette
- Sales replaces the repo's separate day-of-week and hour-of-day bar charts with one day x hour heatmap, and merges the source donut into the platform table
- Marketing collapses the repo's three near-identical area charts into KPI sparklines plus one platform-split chart
- TV slot arrangement is real in the prototype (tap an item, tap a slot); the live 1920x1080 iframe previews of /tv-display-N are represented by the slot contents instead, and menu_items.image_url art is not wired up
- My Payroll shows the signed-in employee as Maria Kyriakou; the payslip button is not wired to the repo's jsPDF generator
- Settings permissions toggle for real in the prototype; the new/edit person panel does not persist (the repo creates accounts through a Supabase edge function)
- Calendar shifts are real in the prototype (add, edit, delete, with the repo's own validation rules) but nothing is written back to Supabase
- Payroll payments are real in the prototype (log and void update the totals) but nothing is written back to Supabase; src/app/my-payroll/page.js (the employee's own view) is not rebuilt yet
- Menu edits are real in the prototype (price, category, availability, add and delete are held in component state) but nothing is written back to Supabase

## Sync history

- 2026-09-12T17:29:24Z — Settings screen built from src/app/settings/page.js
- 2026-09-12T17:05:10Z — Calendar screen built from src/app/calendar/page.js
- 2026-09-12T16:57:29Z — Payroll screen built from src/app/payroll/page.js
- 2026-09-12T16:50:14Z — Platform Payouts screen built from src/app/platform-payouts/page.js
- 2026-09-12T16:38:47Z — Menu screen built from src/app/menu/page.js
- 2026-09-12T08:53:27Z — Reviews screen built from src/app/reviews/page.js
- 2026-09-12T08:45:42Z — Products screen built from src/app/products/page.js
- 2026-09-12T08:34:28Z — Marketing screen built from src/app/marketing/page.js
- 2026-09-12T08:05:14Z — Sales screen built from src/app/sales/page.js
- 2026-09-11T13:32:50Z — first import: recreated current Overview, built v2 Overview
