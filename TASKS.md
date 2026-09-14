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

## 1 · The table and the demo data — **done**

- [x] `panel_items` in Supabase: `id`, `kind` ('task' | 'note'), `body`,
      `done_at` (null until ticked), `source` (null | 'payouts' | 'menu' |
      'payroll' | 'sales'), `source_amount` (null | numeric), `created_at`,
      `created_by`
- [x] RLS: admins only, read and write. Employees cannot see the table at all
- [x] A migration through `tools/sql.sh`, and the schema noted in CLAUDE.md
- [x] The demo client backs it with seeded rows in the three states — open,
      ticked within the last 24 h, and done — so every state is visible in a
      screenshot without clicking
- [x] Rows leave Done after 30 days. Decide where that runs and say why in a
      comment: a DB policy, or a filter on read

## 2 · The shell — **done**

- [x] The 46px icon rail on the right of `ClientLayout`, mirroring the left one,
      always visible for an admin, never rendered for an employee
- [x] Two icons; a red dot on the checklist while anything is open
- [x] Opening pushes the page, 334px, and does not overlay it
- [x] Open/closed and which tab, remembered in `localStorage` through
      `useSyncExternalStore`, the way the rail's pin already is
- [x] Phone: a fifth item in `MobileNav` labelled "Notes", with the dot, opening
      its own page with a `Segmented` at the top. The bar stays put
- [x] Every screen, both widths, and it must not break any of the eleven
      existing screens at 1440px or 390px

## 3 · Notes & to-do — **done**

- [x] Three sections in order — Notes, To do, Done — each folding from its
      header with a count
- [x] Notes: gold bar, not tickable, deleted with an `x` and nothing else
- [x] Ticking leaves the row in To do for 24 hours, struck through, with Undo
- [x] After 24 hours it moves to Done by itself
- [x] `Clear` in the Done header
- [x] The composer: `Task` / `Note` toggle and one input
- [x] Rows carry the money chip and the source chip, and nothing groups by them
- [x] Long list: first nine plus `Show N more`, and a filter field once the
      total passes the threshold

## 4 · Ask AI, as a facade — **done**

- [x] The chat: your messages right in ink, its messages left on a washed card,
      composer at the foot, no context line
- [x] Sending does nothing, and the code says plainly that nothing is wired up.
      No fake replies, no spinner pretending to think
- [x] An empty state that says what it will be for without promising a date

## 5 · Add as task — **done**

- [x] Platform Payouts — one per "Not settled" row, carrying the money
- [x] Products — from the unmatched-names banner
- [x] Menu — from the priced-but-unnamed banner
- [x] Payroll — from the unpriced-hours banner
- [x] Adding the same finding twice must not make two rows; the button says so
      when it is already there
- [x] Nowhere else. The button belongs where a finding is, not on every card

## 6 · Prove it — **done**

- [x] `./tools/shot.sh --all` and look at every screen at both widths with the
      panel open and shut
- [x] `node tools/sweep.mjs /` and `/sales` with the panel open — the pushed
      layout must not break a chart
- [x] A Playwright pass over the panel itself: add a task, add a note, tick,
      undo, delete a note, fold a section, reopen the page and find the panel as
      you left it
- [x] `npm run lint` clean for the new files, `npm run build` passes

---

## Findings

Recorded as they are found.

- **`panel_items` is live** with admin-only RLS matching the pattern the other
  tables use (`exists (select 1 from profiles where id = auth.uid() and role =
  'admin')`). Checked with the anon key: it returns `[]`, which is how PostgREST
  reports "nothing you may see".
- **Two constraints worth knowing.** A note can never carry a `done_at` — the
  table refuses it, so the three sections cannot drift out of step with the
  data. And `source_key` is uniquely indexed where it is not null, so the "Add
  as task" buttons cannot write the same finding twice however many times they
  are pressed.
- **Done rows are filtered out on read after 30 days rather than deleted by a
  job.** `pg_cron` is available but not installed; turning on an extension to
  tidy a to-do list is a worse trade than a `where` clause. The rows stay in the
  table, which nobody will notice at a few hundred a year, and one `delete`
  fixes it if it ever matters. Recorded in CLAUDE.md.
- **Demo seeds all three states plus the edge.** 2 notes, 9 open tasks, 2 ticked
  within the last 24 h, 4 in Done, and **one ticked 34 days ago that must not
  appear anywhere** — the 30-day rule has a test case sitting in the data.
- **The push is exactly 334px.** Measured in the browser: `main` is 1334px with
  the panel shut and 1000px with it open, at 1440px. It is a flex sibling of the
  page column, not an overlay, so nothing floats over a table.
- **Open, shut and which tab all survive a reload.** Opened on Ask AI, reloaded,
  came back on Ask AI. Closed, reloaded, stayed closed with the rail still
  there. `bettys-panel` in localStorage, read through `useSyncExternalStore`
  like the rail's pin.
- **One fetch, however many consumers.** The rail and the phone bar both want
  the count and on a desktop both are mounted, so `usePanelItems` keeps a
  module-level cache and a set of subscribers: one request, and every mounted
  copy re-renders together when anything writes. (Not observable in demo, where
  the client never touches the network.)
- **The 24-hour and 30-day rules are visible in the first screenshot.** Notes 2,
  To do 11 — nine open plus two ticked today, struck through and reading "2 h
  ago" and "7 h ago" — and Done 4 running from yesterday to 26 days. The row
  ticked 34 days ago appears nowhere, which is the 30-day rule doing its job.
- **`/notes` is admin-only at the route, not just hidden.** Added to
  `ADMIN_ONLY_SLUGS`, so an employee who types the URL is redirected by the
  guard rather than being shown an empty page. It is deliberately not in
  `NAV_GROUPS` or the permissions matrix — it is not a page anyone can be
  granted.
- **Exercised in the browser, not assumed.** Added a task (it lands at the top,
  counts rise), ticked it (it stays in To do, struck through, header count drops
  and the row count does not), undid it, added a note, deleted it with the `x`,
  folded To do and watched the rows go, opened Done and found Clear. No console
  errors.
- **The cap must never hide a row ticked today.** Applying "first nine" to all
  of To do pushed both ticked-today rows behind "Show more", because they are
  old tasks by `created_at` and the list is newest-first — which defeats the
  entire point of the 24-hour window. The cap now counts only work still
  waiting; anything ticked in the last 24 hours always renders, after the
  capped run.
- **Undo belongs to the window, not to Done.** It showed on every ticked row,
  including ones cleared a fortnight ago, where it means nothing. It is now
  offered only while the row is still sitting in To do; in Done the checkbox is
  the way back.
- **The demo client was inserting rows with no `created_at`.** Postgres fills it
  from a column default and the in-memory store has no defaults, so a row added
  through the panel sorted as if it had no age and landed at the wrong end of
  the list — invisible behind the cap. The demo client now stamps `created_at`
  on insert for any table whose rows carry one. That was hiding a real bug in
  demo, and it would have hidden others.
- **What you type appears; the reply says it went nowhere.** The shape cannot be
  judged without a message in it, so the composer keeps yours — right, in ink —
  and puts a plain line where the answer will sit: *"Not connected yet, so this
  went nowhere."* Italic and muted on the washed card, so it reads as the panel
  telling you what happened rather than as something answering. That is the line
  between a facade and a lie, and it matters more here than usual: an invented
  figure on a screen full of real ones is the most expensive kind of wrong this
  dashboard could be.
- **Verified it goes nowhere.** Playwright watched the network while sending:
  **zero non-GET requests**. Messages live in component state, so a reload
  empties them — checked, and it does. Nothing is stored, nothing is sent.
- The panel header reads `not connected yet` on this tab instead of a count,
  which says it before you type anything.
- **Four screens, one button, and it writes what the screen already knows.**
  Payouts puts one on each "Not settled" row carrying the money —
  `Chase Wolt about 4 – 14 Sep` with `€4,654.25`. Products puts one beside each
  unmatched name. Menu puts one beside each priced-but-unnamed dish. Payroll
  puts one under the unpriced-hours banner, one per person.
- **Pressing it twice cannot write two rows.** `source_key` is uniquely indexed,
  and the button reads the keys already on the list: it flips to **"On your
  list"** with a tick and stops responding. Exercised — clicked, saw the count
  go 9 to 10, clicked the same button again, count unchanged.
- **It opens the panel on the list when it adds.** A task written into a drawer
  you cannot see is a task you will not trust; seeing it land is the point.
- **Counts on the day:** Payouts 3, Products 6 (the banner's capped run), Menu
  1, Payroll 1. All admin-only — the button renders nothing for an employee,
  who has no panel to put it in.
- **48 combinations, clean.** `tools/prove-panel.mjs` walks all twelve screens at
  1440px and 390px with the panel shut and open, running the same DOM checks the
  chart sweeps use. Nothing NaN, no chart without height, nothing wider than its
  viewport, no page errors.
- **The charts survive the push.** `PANEL=open node tools/sweep.mjs` re-runs the
  full range/interval/filter sweep against the 334px-narrower layout: 30
  combinations on Overview and 90 on Sales, both clean. The sweep gained a
  `PANEL=open` switch that pre-seeds `localStorage` before the page loads.
- **Looked at the screens most likely to suffer:** Sales, Products, Settings,
  Calendar, TV Displays and Payroll with the panel open. The Calendar timeline
  compresses cleanly, the permissions matrix keeps its columns, the stacked bar
  chart re-fits, the TV slot grid drops to two columns per board. Nothing
  clipped, nothing overlapping.
- **The whole journey, driven end to end:** panel starts shut → open → add a
  task (9→10 open) → add a note → tick it (stays in To do, Undo shown, open
  count drops) → undo → delete the note by its x → fold To do → switch to Ask AI
  → reload → comes back on Ask AI. Ten steps, no console errors.
- **Lint is clean for everything new.** The six remaining repo-wide problems are
  all in the out-of-scope files and the pre-existing `AuthContext` warning,
  unchanged since before the panel existed.
