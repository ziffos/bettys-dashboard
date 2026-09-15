"use client";

import { useState } from "react";
import { ChevronDown, Loader2, Search, TriangleAlert, X } from "lucide-react";
import { euro2 } from "../../lib/format";
import { panelActions } from "./usePanelItems";
import { FILTER_FROM, FIRST_RUN, SOURCE_LABEL, matcher, tickedAgo } from "./listPolicy";
import { LEAVE_MS, reducedMotion, useFlipList } from "./useFlipList";
import ConfirmDelete from "./ConfirmDelete";

/**
 * The panel's list, on whichever of the two list tabs you are on.
 *
 * Notes and to-dos are separate tabs now rather than two sections of one, so
 * this renders one or the other. Done stays inside To-dos, folded, because a
 * finished task is still a task and it has nowhere else to belong.
 *
 * Nothing groups by where a task came from — the source is a chip on the row,
 * which is provenance, not a category. Settled with the owner; see
 * design/PANEL.md.
 */

function SectionHead({ label, count, open, onToggle, action }) {
  return (
    <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        aria-expanded={open}
      >
        <span className="font-mono text-[9.5px] tracking-[0.07em] text-subtle uppercase">
          {label}
        </span>
        <span className="font-mono text-[9.5px] text-faint">{count}</span>
        <ChevronDown
          size={12}
          strokeWidth={2.2}
          className="text-faint ml-auto"
          style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s" }}
        />
      </button>
      {open && action}
    </div>
  );
}

/** Every row is wrapped: the wrapper travels and collapses, the row is drawn. */
function Row({ item, leaving, children }) {
  return (
    <div data-flip={item.id} className={leaving ? "row-leave" : undefined}>
      {children}
    </div>
  );
}

function NoteRow({ item, leaving, onDelete }) {
  return (
    <Row item={item} leaving={leaving}>
      <div className="group px-3 py-2.5 border-t border-wash flex gap-2.5">
        <div className="w-[2px] rounded-full bg-warn shrink-0" />
        <div className="flex-1 min-w-0 text-[12.5px] leading-[1.4] text-muted text-pretty">
          {item.body}
        </div>
        <button
          onClick={() => onDelete(item)}
          title="Delete"
          aria-label={`Delete note: ${item.body}`}
          className="w-5 h-5 shrink-0 -mt-px rounded flex items-center justify-center text-faint hover:text-danger hover:bg-wash"
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>
    </Row>
  );
}

function TaskRow({ item, leaving, onToggle, onDelete, offerUndo }) {
  const ticked = !!item.done_at;
  return (
    <Row item={item} leaving={leaving}>
      <div className="px-3 py-2 border-t border-wash flex gap-2.5 items-start">
        <button
          onClick={() => onToggle(item.id, !ticked)}
          role="checkbox"
          aria-checked={ticked}
          aria-label={item.body}
          className={`w-[15px] h-[15px] mt-px shrink-0 rounded flex items-center justify-center border-[1.5px] transition-colors duration-150 ${
            ticked ? "bg-ink-strong border-ink-strong" : "border-line-strong bg-surface hover:border-ink"
          }`}
        >
          {ticked && (
            <svg className="row-ticked" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className={`text-[12.5px] leading-[1.35] text-pretty ${ticked ? "text-subtle line-through" : ""}`}>
            {item.body}
          </div>
          {(item.source_amount != null || item.source || item.done_at) && (
            <div className="mt-[3px] flex flex-wrap items-center gap-1.5">
              {item.source_amount != null && (
                <span className="font-mono text-[9.5px] px-1.5 py-px rounded text-danger bg-[rgba(238,0,0,0.06)]">
                  {euro2(item.source_amount)}
                </span>
              )}
              {item.source && (
                <span className="font-mono text-[9.5px] px-1.5 py-px rounded bg-wash text-subtle">
                  {SOURCE_LABEL[item.source] ?? item.source.toUpperCase()}
                </span>
              )}
              {item.done_at && (
                <span className="font-mono text-[9.5px] text-faint">{tickedAgo(item.done_at)}</span>
              )}
            </div>
          )}
        </div>

        {/* Only while it is still sitting in To do, inside its 24 hours. Once it
            has moved to Done, taking it back is a deliberate act and the
            checkbox is the way — an Undo on a fortnight-old row means nothing. */}
        {ticked && offerUndo && (
          <button
            onClick={() => onToggle(item.id, false)}
            className="text-[11px] text-accent shrink-0 whitespace-nowrap"
          >
            Undo
          </button>
        )}

        <button
          onClick={() => onDelete(item)}
          title="Delete"
          aria-label={`Delete task: ${item.body}`}
          className="w-5 h-5 shrink-0 -mt-px rounded flex items-center justify-center text-faint hover:text-danger hover:bg-wash"
        >
          <X size={12} strokeWidth={2} />
        </button>
      </div>
    </Row>
  );
}

export default function NotesAndTodo({ tab, loading, failure, notes, todo, done }) {
  const onNotes = tab === "notes";
  const [folded, setFolded] = useState({ done: true });
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [asking, setAsking] = useState(null); // the row the confirm is about
  const [leaving, setLeaving] = useState(null); // and the one on its way out
  const list = useFlipList();

  const fold = (key) => setFolded((f) => ({ ...f, [key]: !f[key] }));
  const isOpen = (key) => !folded[key];

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error("Panel write failed:", err);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || busy) return;
    setDraft("");
    await run(() => panelActions.add({ kind: onNotes ? "note" : "task", body }));
  };

  // Confirmed: let the row collapse where it stands, then write the deletion.
  // The row is gone from the table either way; this only decides whether you
  // see it go.
  const destroy = async () => {
    const item = asking;
    setAsking(null);
    setLeaving(item.id);
    if (!reducedMotion()) await new Promise((r) => setTimeout(r, LEAVE_MS));
    try {
      await panelActions.remove(item.id);
    } catch (err) {
      console.error("Panel write failed:", err);
    } finally {
      setLeaving(null);
    }
  };

  const toggle = (id, next) => run(() => panelActions.setDone(id, next));

  if (failure) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <TriangleAlert size={16} className="text-warn-ink" />
        <p className="text-[12.5px] text-muted text-pretty">{failure}</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-subtle">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const match = matcher(query);
  const shownNotes = notes.filter(match);
  const shownTodo = todo.filter(match);
  const shownDone = done.filter(match);

  const total = onNotes ? notes.length : todo.length + done.length;

  // The cap applies to work still waiting, never to the rows ticked in the last
  // 24 hours. Those are in To do precisely so you can see what you got through
  // today; hiding them behind "Show more" would defeat the whole window.
  const stillOpen = shownTodo.filter((r) => !r.done_at);
  const justDone = shownTodo.filter((r) => r.done_at);
  const capped = !showAll && !q && stillOpen.length > FIRST_RUN;

  return (
    <>
      {total >= FILTER_FROM && (
        <div className="px-3 py-2 border-b border-line shrink-0">
          <div className="h-7 px-2.5 border border-line rounded-[7px] flex items-center gap-1.5 focus-within:border-ink-strong">
            <Search size={12} strokeWidth={2} className="text-faint shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${total} ${onNotes ? "notes" : "tasks"}…`}
              className="flex-1 min-w-0 bg-transparent text-[12px] outline-none placeholder:text-faint"
            />
            {q && (
              <button onClick={() => setQuery("")} className="text-faint hover:text-ink">
                <X size={11} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      )}

      <div ref={list} className="flex-1 min-h-0 overflow-y-auto">
        {onNotes ? (
          shownNotes.length === 0 ? (
            <p className="px-3 pt-3 text-[11.5px] text-faint">
              {q ? "Nothing matches." : "Nothing written down."}
            </p>
          ) : (
            shownNotes.map((n) => (
              <NoteRow key={n.id} item={n} leaving={leaving === n.id} onDelete={setAsking} />
            ))
          )
        ) : (
          <>
            <SectionHead
              label="To do"
              count={shownTodo.length}
              open={isOpen("todo")}
              onToggle={() => fold("todo")}
            />
            {isOpen("todo") && (
              <>
                {shownTodo.length === 0 ? (
                  <p className="px-3 pb-2 text-[11.5px] text-faint">
                    {q ? "Nothing matches." : "Nothing to do."}
                  </p>
                ) : (
                  <>
                    {(capped ? stillOpen.slice(0, FIRST_RUN) : stillOpen).map((t) => (
                      <TaskRow
                        key={t.id}
                        item={t}
                        leaving={leaving === t.id}
                        onToggle={toggle}
                        onDelete={setAsking}
                        offerUndo
                      />
                    ))}
                    {capped && (
                      <button
                        onClick={() => setShowAll(true)}
                        className="w-full px-3 py-2.5 border-t border-wash text-left text-[12px] text-accent"
                      >
                        Show {stillOpen.length - FIRST_RUN} more
                      </button>
                    )}
                    {justDone.map((t) => (
                      <TaskRow
                        key={t.id}
                        item={t}
                        leaving={leaving === t.id}
                        onToggle={toggle}
                        onDelete={setAsking}
                        offerUndo
                      />
                    ))}
                  </>
                )}
              </>
            )}

            <SectionHead
              label="Done"
              count={shownDone.length}
              open={isOpen("done")}
              onToggle={() => fold("done")}
              action={
                shownDone.length > 0 && (
                  <button
                    onClick={() => run(() => panelActions.clearDone(done.map((d) => d.id)))}
                    className="text-[11px] text-subtle hover:text-danger shrink-0"
                  >
                    Clear
                  </button>
                )
              }
            />
            {isOpen("done") &&
              (shownDone.length === 0 ? (
                <p className="px-3 pb-2 text-[11.5px] text-faint">
                  {q ? "Nothing matches." : "Cleared automatically after 30 days."}
                </p>
              ) : (
                shownDone.map((t) => (
                  <TaskRow
                    key={t.id}
                    item={t}
                    leaving={leaving === t.id}
                    onToggle={toggle}
                    onDelete={setAsking}
                  />
                ))
              ))}
          </>
        )}
        <div className="h-2" />
      </div>

      <form onSubmit={submit} className="border-t border-line p-3 shrink-0">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={onNotes ? "Write it down…" : "What needs doing?"}
          className="w-full h-8 px-2.5 border border-line rounded-lg bg-surface text-[12.5px] outline-none placeholder:text-faint focus:border-ink-strong"
        />
      </form>

      {asking && (
        <ConfirmDelete
          item={asking}
          busy={busy}
          onCancel={() => setAsking(null)}
          onConfirm={destroy}
        />
      )}
    </>
  );
}
