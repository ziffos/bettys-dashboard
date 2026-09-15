# The Assistant — Notes, To-dos, and Ask AI

Agreed with the owner in September 2026 after four prototyped directions. The
chosen design is the working prototype at `design/panel-prototype.html` (open it
in a browser; the buttons across the top step every state), rendered into
`design/reference/panel-1..4.png`.

Read this with `design/DESIGN.md` — the panel uses the same tokens, the same
`Segmented`, the same card and list conventions as every other screen.

## What it is

A second panel on the right of the shell, holding three things you switch
between:

1. **Notes** — things worth remembering. Not tickable, never finished.
2. **To-dos** — work, with **Done** folded underneath it.
3. **Ask AI** — a chat. **Design only for now.** No integration, no model, no
   backend. It renders messages and a composer and does nothing when you send.

Notes and to-dos shared one tab to begin with and were split in September 2026.
They are different things: a note is read, a task is finished. Sharing a surface
meant the notes sat permanently above the work, and the count in the header
could only describe one of them.

## Who sees it

Admins only. It is not shown to employees at all — not in the rail, not in the
phone bar, not as a route.

## Where it lives

**Desktop.** A 46px icon rail pinned to the right edge of the shell, mirroring
the navigation rail on the left. It is always visible, even when the panel is
shut, so the panel never goes out of mind. Three icons, in this order: a note
for Notes, a checklist for To-dos, a bubble for Ask AI. The red dot goes on the
checklist, because it counts open work.

Opening puts a **334px panel to the left of the icon rail**, and it **pushes the
page** rather than floating over it — this is a dashboard, and the point is to
read a number and write it down without either hiding the other.

**Phone.** A **fifth item in the bottom bar**, labelled "Assistant", with the
same red dot. It opens `/assistant`, which takes **the whole screen** — no app
header above it, no bottom bar below, no card border around it. Three underlined
tabs — Notes, To-dos, Ask AI — and a horizontal swipe steps between them. There is **no composer parked at the bottom**: a round `+` raises a
sheet when you have something to write, which buys four more rows. **The tab
decides what the `+` writes**, so the sheet has nothing to ask you. The filter
hides behind a magnifier for the same reason. See `PhoneAssistant.js`.

The phone runs a **larger type scale** than the desktop panel — 14.5px rows,
20px checkboxes, 44px targets. The panel's 12.5px is sized for a 334px column
beside a dashboard; on a 390px screen with nothing else on it, it reads as a
widget that wandered onto the wrong device.

**Everywhere.** The panel is on every screen an admin can open. That is the
whole point of the "Add as task" buttons — a finding on Payouts has to be able
to become a task without leaving Payouts.

## Open and closed

Starts **closed**, and remembers the last choice in `localStorage` — the same
mechanism as the rail's pin (`bettys-rail-pinned`). Reopening the dashboard puts
it back the way you left it, on whichever of the three tabs you were on. The
old two-tab value `list` reads as `todo`; anyone who has used the panel has that
word in their browser.

## The two list tabs

No grouping by source, no priorities, no folders.

**Notes** — free text, one gold bar down the left. Not tickable.

**To-dos** — tickable tasks, with **Done** folded underneath and counted. A
finished task is still a task; it has nowhere else to belong.

Every row carries an `x`. Ticking means you did it, deleting means it never
needed doing, and both endings have to exist — including in Done, for clearing
one row without clearing the section.

### Deleting asks first

There is no undo on a deletion, so the `x` opens a short question that quotes
the row, with Cancel and a red Delete. It is **not** a page-wide modal: it
covers the panel, or the phone screen, and nothing else. Throwing a dialog over
the whole application to ask about one line of a list is out of proportion.

### Leaving is one movement, and it goes right

**Ticking and deleting look the same, because they are the same event: the row
is finished with.** The checkbox fills, the row slides **out to the right** and
fades, and once it is gone the space it held closes. Two movements in sequence,
not at once — overlapping them reads as a smudge.

A deleted row never comes back. A ticked one returns where it now belongs,
entering from the right it left by, which is how you know it is the same row.
`forget()` in `useFlipList.js` is what stops the list from *also* gliding it
there: one leaving is enough, and telling the journey twice is worse than not
telling it at all.

Everything else that shifts — the rows closing the gap — is FLIP, measured
before and after the repaint. A list that repaints silently makes you check
whether the right thing happened.

Anyone whose machine asks for reduced motion gets none of it.

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
