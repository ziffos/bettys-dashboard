# The side panel — Notes & to-do, and Ask AI

Agreed with the owner in September 2026 after four prototyped directions. The
chosen design is the working prototype at `design/panel-prototype.html` (open it
in a browser; the buttons across the top step every state), rendered into
`design/reference/panel-1..4.png`.

Read this with `design/DESIGN.md` — the panel uses the same tokens, the same
`Segmented`, the same card and list conventions as every other screen.

## What it is

A second panel on the right of the shell, holding two things you switch
between:

1. **Notes & to-do** — the working surface.
2. **Ask AI** — a chat. **Design only for now.** No integration, no model, no
   backend. It renders messages and a composer and does nothing when you send.

## Who sees it

Admins only. It is not shown to employees at all — not in the rail, not in the
phone bar, not as a route.

## Where it lives

**Desktop.** A 46px icon rail pinned to the right edge of the shell, mirroring
the navigation rail on the left. It is always visible, even when the panel is
shut, so the panel never goes out of mind. Two icons: a chat bubble for Ask AI,
a checklist for Notes & to-do. A red dot on the checklist when anything is open.

Opening puts a **334px panel to the left of the icon rail**, and it **pushes the
page** rather than floating over it — this is a dashboard, and the point is to
read a number and write it down without either hiding the other.

**Phone.** A **fifth item in the bottom bar**, labelled "Notes", with the same
red dot. It opens its own page, not an overlay, so the bar stays put. A
`Segmented` at the top switches between "Notes & to-do" and "Ask AI".

**Everywhere.** The panel is on every screen an admin can open. That is the
whole point of the "Add as task" buttons — a finding on Payouts has to be able
to become a task without leaving Payouts.

## Open and closed

Starts **closed**, and remembers the last choice in `localStorage` — the same
mechanism as the rail's pin (`bettys-rail-pinned`). Reopening the dashboard puts
it back the way you left it, on whichever of the two tabs you were on.

## Notes & to-do

**Three sections, in this order, and no others.** No grouping by source, no
priorities, no folders.

1. **Notes** — free text, one gold bar down the left. Not tickable. **Deleted
   with an `x` on the row**, nothing more: no confirm, no archive.
2. **To do** — tickable tasks.
3. **Done** — folded, with a count.

Each section header folds its section and shows a count.

### What happens when you tick something

It **stays in To&nbsp;do for 24 hours**, struck through and greyed, with an
**Undo** on the row. You can see what you got through today, and a mis-tap
costs nothing. After 24 hours it moves to **Done** on its own.

Rows **leave Done after 30 days**. `Clear` in the Done header empties it sooner.
A to-do list should not quietly turn into an archive.

### A long list

Three things, in this order, and nothing more:

- **To do shows the first nine**, with `Show N more` under them. The panel opens
  at a readable length however much is in it.
- **A filter field appears above the sections once the total passes a
  threshold** — it is not there for six items.
- Sections fold from their headers.

### Rows

A task row is a checkbox, the text, and a meta line carrying:

- the **money at stake** where there is any, in the danger colour — `€1,264`;
- **where it came from**, as a quiet mono chip — `PAYOUTS`, `MENU`, `PAYROLL`,
  `SALES`. This is provenance, not a category: it does not group anything.

### The composer

Pinned to the foot of the panel: a `Task` / `Note` toggle, then one input.

## Add as task

The button that makes this worth having. It puts a pre-written task in the list
from wherever you are, carrying its money and its source chip.

It goes **where the dashboard already has a finding**, not on every card:

| Screen | From | The task it writes |
|---|---|---|
| Platform Payouts | each row of "Not settled" | `Chase Wolt's statement for 6–15 June` · `€1,264` · `PAYOUTS` |
| Products | the unmatched-names banner | `Add the Wolt name for Coca-Cola 330ml` · `MENU` |
| Menu | the priced-but-unnamed banner | `Add a till name for Halloumi Burger` · `MENU` |
| Payroll | the unpriced-hours banner | `Set an hourly rate for Dinos` · `PAYROLL` |

## Ask AI

A chat, and only the shape of one. Messages from you on the right in ink, from
it on the left on a washed card. A composer at the foot.

**No context line.** The owner asked for a plain chat, not one that announces
which screen it can see.

Nothing is wired up. It must be obvious from the code that this is a facade —
no fake replies, no spinner pretending to think.
