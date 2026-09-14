# Punch list — the side panel

The loop's source of truth. Work the first unchecked task, finish it completely,
tick it here, commit, push. Anything discovered on the way goes under "Findings"
so nothing is lost between iterations.

**Read `design/PANEL.md` first** — it is the agreed design, settled with the
owner over four prototypes. The working prototype is
`design/panel-prototype.html` (open it and step the buttons across the top);
its renders are `design/reference/panel-1..4.png`. Match it.

The previous punch list — the timezone fix, the data audit and the chart
sweep — is finished, and its findings are kept in `TASKS-audit.md`.

## 1 · The table and the demo data

- [ ] `panel_items` in Supabase: `id`, `kind` ('task' | 'note'), `body`,
      `done_at` (null until ticked), `source` (null | 'payouts' | 'menu' |
      'payroll' | 'sales'), `source_amount` (null | numeric), `created_at`,
      `created_by`
- [ ] RLS: admins only, read and write. Employees cannot see the table at all
- [ ] A migration through `tools/sql.sh`, and the schema noted in CLAUDE.md
- [ ] The demo client backs it with seeded rows in the three states — open,
      ticked within the last 24 h, and done — so every state is visible in a
      screenshot without clicking
- [ ] Rows leave Done after 30 days. Decide where that runs and say why in a
      comment: a DB policy, or a filter on read

## 2 · The shell

- [ ] The 46px icon rail on the right of `ClientLayout`, mirroring the left one,
      always visible for an admin, never rendered for an employee
- [ ] Two icons; a red dot on the checklist while anything is open
- [ ] Opening pushes the page, 334px, and does not overlay it
- [ ] Open/closed and which tab, remembered in `localStorage` through
      `useSyncExternalStore`, the way the rail's pin already is
- [ ] Phone: a fifth item in `MobileNav` labelled "Notes", with the dot, opening
      its own page with a `Segmented` at the top. The bar stays put
- [ ] Every screen, both widths, and it must not break any of the eleven
      existing screens at 1440px or 390px

## 3 · Notes & to-do

- [ ] Three sections in order — Notes, To do, Done — each folding from its
      header with a count
- [ ] Notes: gold bar, not tickable, deleted with an `x` and nothing else
- [ ] Ticking leaves the row in To do for 24 hours, struck through, with Undo
- [ ] After 24 hours it moves to Done by itself
- [ ] `Clear` in the Done header
- [ ] The composer: `Task` / `Note` toggle and one input
- [ ] Rows carry the money chip and the source chip, and nothing groups by them
- [ ] Long list: first nine plus `Show N more`, and a filter field once the
      total passes the threshold

## 4 · Ask AI, as a facade

- [ ] The chat: your messages right in ink, its messages left on a washed card,
      composer at the foot, no context line
- [ ] Sending does nothing, and the code says plainly that nothing is wired up.
      No fake replies, no spinner pretending to think
- [ ] An empty state that says what it will be for without promising a date

## 5 · Add as task

- [ ] Platform Payouts — one per "Not settled" row, carrying the money
- [ ] Products — from the unmatched-names banner
- [ ] Menu — from the priced-but-unnamed banner
- [ ] Payroll — from the unpriced-hours banner
- [ ] Adding the same finding twice must not make two rows; the button says so
      when it is already there
- [ ] Nowhere else. The button belongs where a finding is, not on every card

## 6 · Prove it

- [ ] `./tools/shot.sh --all` and look at every screen at both widths with the
      panel open and shut
- [ ] `node tools/sweep.mjs /` and `/sales` with the panel open — the pushed
      layout must not break a chart
- [ ] A Playwright pass over the panel itself: add a task, add a note, tick,
      undo, delete a note, fold a section, reopen the page and find the panel as
      you left it
- [ ] `npm run lint` clean for the new files, `npm run build` passes

---

## Findings

Recorded as they are found.
