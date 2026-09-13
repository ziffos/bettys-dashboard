# Design system — Betty's Dashboard v2

The dashboard is being rebuilt against a light, Geist/Vercel-flavoured design.
This file is the spec. It exists so that a screen can be built without reading
the 364 KB source export first — and so that screen 7 uses the same grey as
screen 3.

## Sources of truth

| What | Where |
|---|---|
| The design itself | `Betty's dashboard redesign/Betty's Dashboard v2.dc.html` |
| Rendered reference, 12 screens × desktop + phone | `design/reference/{desktop,phone}-<screen>.png` |
| What the designer changed and why | `Betty's dashboard redesign/github.md` |

The `.dc.html` is a template (lines 9–2555) plus the logic and mock data that
feeds it (lines 2556–5030). The template is where exact styling lives; the
logic is where a chart's maths lives. Both are worth reading for the screen
being built — the reference PNG shows what it should end up looking like, but
not the hover state, the open panel or the empty state.

To re-render the design (needs network — it pulls React from unpkg):

```bash
python3 -m http.server 8899 --directory "Betty's dashboard redesign"
# then point a browser at /Betty's%20Dashboard%20v2.dc.html
```

The PREVIEW bar at the top toggles Desktop/Phone and Ready/Loading/Empty.

## Colour

Everything is a neutral grey except one blue accent, and colour only carries
meaning for platforms, categories and status.

| Token | Value | Used for |
|---|---|---|
| Page background | `#fafafa` | Behind the cards |
| Surface | `#fff` | Cards, panels, table rows |
| Ink | `#000` | Primary text, headings, numbers |
| Ink strong | `#171717` | Buttons, filled bars, sparkline strokes |
| Muted | `#666` | Secondary text, table headers |
| Subtle | `#8f8f8f` | Labels, captions, axis ticks |
| Faint | `#b3b3b3` | Placeholder text |
| Border | `#eaeaea` | Every card, row divider and input |
| Border hover | `#d4d4d4` | Border on hover |
| Wash | `#f2f2f2` | Sparkline fill, active nav background |
| Wash light | `#fafafa` | Row hover, selected row, segmented track |

Accents:

| Token | Value | Meaning |
|---|---|---|
| Blue | `#0070f3` | Positive delta, links, today, selected bar |
| Red | `#ee0000` | Negative delta, offline, flagged |
| Amber | `#f5a623` | Partial, warning; also Foody |
| Amber text | `#b26a00` | Amber text on white (contrast) |

Platform colours — these are fixed, do not remap them:

| | |
|---|---|
| Wolt | `#007cf0` |
| Foody | `#f5a623` |
| Bolt | `#50e3c2` |
| POS / in-store | `#171717` |
| Instagram | `#7928ca` |
| Facebook | `#0070f3` |

Menu categories:

| | |
|---|---|
| Fried Chicken Combos | `#171717` |
| Burger & Wrap Combos | `#0070f3` |
| Products | `#7928ca` |
| Sides | `#f5a623` |
| Dips | `#50e3c2` |
| Drinks | `#8f8f8f` |

Categories have short labels in tight spaces: Chicken, Burgers, Products,
Sides, Dips, Drinks.

Delta pills use a tinted background: `rgba(0,112,243,0.08)` for good,
`rgba(238,0,0,0.07)` for bad. "Good" is not always "up" — on FEE RATE,
REJECTED and PLATFORM FEES a fall is the good direction.

## Type

Two families, both from Google Fonts:

- **Geist** — everything by default.
- **Geist Mono** — labels, table headers, axis ticks, invoice numbers, times,
  and any number in a column that should line up. This is what gives the design
  its character; a mono label is not decoration, it is the label style.

| Size | Weight | Tracking | Use |
|---|---|---|---|
| 40–52px | 600 | -0.03em | Hero number (My Payroll, Payroll headline) |
| 24–28px | 600 | -0.03em | Page title (`h1`), 22px on phone |
| 27px | 600 | -0.03em | KPI value |
| 16px | 600 | -0.02em | Card title, panel title |
| 14px | 500 | — | Section heading |
| 13px | 400/500 | — | Body, table cell, input |
| 12px | 500 | — | Button, segmented control |
| 11px | 400 | 0.05em | Table header (mono), caption |
| 10px | 400 | 0.06em | KPI label, field label (mono) |

Only weights 400, 500 and 600 are used. Nothing is bold.

Body copy that wraps gets `text-wrap: pretty`.

## Shape and depth

- Card radius `12px`. Buttons, inputs and small controls `6px`. Segmented
  control track `8px`. Category dots `2px`. Pills and dots `9999px`.
- One shadow, everywhere: `0 1px 2px rgba(0,0,0,0.03)`.
- Dropdowns get `0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08)`.
- Side panels get `-8px 0 32px rgba(0,0,0,0.06)`.
- Depth comes from the border, not the shadow. A card is a `1px solid #eaeaea`
  box on `#fafafa`.

Three keyframes, defined once globally:

```css
@keyframes shimmer  { 0% { background-position:-320px 0 } 100% { background-position:320px 0 } }
@keyframes drawerIn { from { transform:translateX(24px); opacity:0 } to { transform:translateX(0); opacity:1 } }
@keyframes riseIn   { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
```

## Spacing

- Body padding `24px` desktop, `16px 12px 24px` phone.
- Gap between sections `20px` desktop, `16px` phone.
- Gap inside a grid of cards `12px`.
- Card padding `14px`–`16px`.
- Table row padding `10px 16px`, header `0 16px 8px`.

## Layout

Single breakpoint at **768px** (`md`). Below it the app is the phone layout;
above it the desktop layout. There is no tablet case.

**Desktop.** A left rail, `60px` collapsed, `224px` on hover, holding the brand,
the nav in three groups (Analytics / Operations / System) and the signed-in
person at the bottom. Then a sticky header with breadcrumb, search, the date
range, Export and notifications. Then the page.

The rail expands on hover and pushes the content. Active item is `#f2f2f2`
background, `#000` text, weight 500; inactive is `#666`, weight 400.

**Phone.** No rail. A compact header with the logo and page title, and a fixed
bottom nav with five items: Overview, Sales, Marketing, Reviews, More. "More"
opens a sheet with everything else, grouped the same way as the rail.

Two-column pages use `minmax(0,1.9fr) minmax(280px,1fr)` on desktop and a
single column on phone. **Use `align-items: start` and let the shorter column
end where it ends** — see "Where we depart from the design" below.

## Components

### KPI card

```
border 1px #eaeaea · radius 12px · padding 14px · bg #fff
shadow 0 1px 2px rgba(0,0,0,0.03) · hover border #d4d4d4
  row:  LABEL (mono 10px, 0.06em, #8f8f8f)   ·   delta pill (11px/500, tinted)
  value: 27px / 600 / -0.03em / line-height 1
  sub:   11px #8f8f8f, min-height 30px so cards stay level
  spark: svg 120×28, area #f2f2f2, line #171717 1.25px non-scaling
```

Grids: five KPIs on Sales, four elsewhere. Two columns on phone.

### Segmented control

Track `#fafafa`, `1px #eaeaea`, radius 8px, 2px padding. Buttons 12px/500,
radius 6px. Selected: `#fff` background, `#000` text,
`0 1px 2px rgba(0,0,0,0.06)`. Unselected: transparent, `#8f8f8f`.

Used for Daily/Weekly/Monthly, platform filters, Week/Month, Prices/Markup.

### Filter chip

A toggle, not a segment: `#fff` on, `#fafafa` off; border `#171717` on,
`#eaeaea` off; a coloured dot that goes `#e5e5e5` when off; text `#000` / `#8f8f8f`.
Often carries a count in `#8f8f8f`.

### Table

Not a `<table>` — a CSS grid with an explicit `grid-template-columns` per
screen, so columns line up between the header and the rows.

Header: mono 11px, `0.05em`, `#666`, sortable cells get `cursor:pointer` and go
`#000` on hover, with ` ↑` / ` ↓` appended to the label. Rows: `10px 16px`,
`border-top 1px #eaeaea`, `#fafafa` on hover. Numbers right-aligned, names left.

On phone the same data becomes a card list — never a horizontally scrolling
table. Each screen defines its own narrow layout (`listWide` / `listNarrow` in
the design).

### Side panel

Replaces the modal everywhere. Overlay `rgba(0,0,0,0.2)`, panel `440px` on
desktop / `390px` centred on phone, `#fff`, `border-left 1px #eaeaea`,
`animation: drawerIn .16s ease`.

Header: 14px 16px, title 16px/600, close button 28×28 with a 6px border.
Body: `16px` padding, `14px` gap, scrolls.
Fields: mono 10px `0.06em` `#666` label, then a 36px input with a 6px border
that goes `#171717` on focus.
Errors render above the actions in red.

### Buttons

- Primary: `#171717` background, `#fff` text, 32px tall, radius 6px, 13px/500,
  `#000` on hover.
- Secondary: `#fff`, `1px #eaeaea`, `#d4d4d4` on hover.
- Destructive: red text on white.

### Loading

Every screen has a real skeleton, not a spinner: shimmering blocks in the shape
of what is coming (KPI cards, then a chart or a list), plus one mono 11px line
in `#8f8f8f` saying what is being loaded — `LOADING 5 483 ORDERS · 1 OF 4
SOURCES READY`. The per-screen strings are in the design's `loadingLine` map.

Shimmer: `linear-gradient(90deg,#f2f2f2 0%,#fafafa 50%,#f2f2f2 100%)`,
`background-size:320px 100%`, `animation: shimmer 1.2s linear infinite`.

### Empty

A dashed `#eaeaea` box on `#fafafa`, `56px 24px`, centred: a 40px rounded icon
tile, a 16px/600 title, a 13px `#666` body capped at 380px, and two buttons.
The copy is specific per screen and explains *why* it is empty — the
`emptyTitle` / `emptyBody` / `emptyAction` maps in the design have all of it.

## Where we depart from the design

Agreed with the owner before the rebuild started. Do not "fix" these back.

1. **No Google reviews.** `reviews.source_platform` only has wolt/foody/bolt.
   The platform stays in the UI so it lights up when the data arrives.
2. **Review themes are an `Upcoming` card.** Only 40 of 231 reviews have text
   and there is no theme column; the classifier is a later decision.
3. **No rejection reasons.** `delivery_status` is delivered/rejected/cancelled
   and nothing more. Show the two totals, drop the four-reason breakdown.
4. **No TV display status.** No heartbeat, no on-air/offline, no "seen 2
   minutes ago", and no physical spot label ("Above the counter"). Show the
   screens and their slots.
5. **`facebook_instagram` rows count only in "Both".** They are combined
   campaigns and cannot be split between Facebook and Instagram.
6. **"Needs attention" is an `Upcoming` card.** Same reason as themes.
7. **Export is disabled.** Renders, but `cursor: not-allowed` and no click.
8. **Let short columns end.** The design leaves a 200–300px white gap under the
   left column on Overview and Products because the right column is taller.
   Let the left column grow or reflow instead.
9. **Calendar on phone is a per-day list**, not the week timeline. The timeline
   overflows the viewport and drops the hours/cost column off-screen.
10. **"Does reach drive sales?"**: lower the area fill opacity and index both
    series to 100 at period start, so the revenue line is actually visible.
11. **TV Displays keeps the live preview.** The slot editor is as designed, but
    each display also gets a "Preview" toggle that reveals the existing scaled
    1920×1080 iframe of `/tv-display-N`. Seeing the actual wall matters.
12. **The rail has a pin.** Hover-to-expand flickers on a trackpad; a pinned
    state persists.
13. **Logout exists.** On the person at the bottom of the rail. The design has
    no sign-out affordance at all.
14. **The Menu panel keeps the advanced fields** — `image_url`, `sort_order`,
    `wolt_name` / `foody_name` / `bolt_name` / `pos_name`,
    `foody_pieces_per_unit` — under a collapsed "Advanced" section. The alias
    names are what match order lines to menu items on Products; `image_url` and
    `sort_order` drive the QR menu and the TV boards.
15. **Payouts filters by statement, not by week.** Real periods are not week
    aligned: Bolt settles every 7 days, Wolt mostly every 5, Foody anywhere
    from 1 to 9. The table follows the header range and shows each statement's
    real period and length; the trend uses the last 12 statements per platform,
    since a seven-day window cannot show one.
16. **`customer_deductions` is a fourth fee segment**, alongside commission,
    ads and other.
17. **The calendar axis fits the week** — earliest start to latest end — rather
    than the design's hardcoded 10:00–23:59. Same for the Sales heatmap.
18. **A day with nobody rostered is closed, not short-staffed.** Betty's shuts
    on Sundays; counting a shut day among the days that are "short at peak"
    makes the headline useless. Fewer than two on at 19:00/20:00 only counts as
    a gap on a day that has shifts at all.

## Out of scope — do not touch

`/qr-menu`, `/tv-display-1..4`, `/tv-display-menu-*`, `/tv-display-motion-*`
and everything in `src/components/tv/`. These are the in-store screens. The
admin page `/tv-displays` reads them through an iframe and never modifies them.

`/login` **is** in scope: same theme, no sidebar.
