"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  Loader2,
  Plus,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { euro2 } from "../../lib/format";
import { panelActions } from "./usePanelItems";
import { FIRST_RUN, SOURCE_LABEL, matcher, tickedAgo } from "./listPolicy";
import { LEAVE_MS, reducedMotion, useFlipList } from "./useFlipList";
import ConfirmDelete from "./ConfirmDelete";
import AskAI from "./AskAI";

/**
 * The Assistant, on a phone: the whole screen, and nothing else on it.
 *
 * The old phone screen was the 334px desktop panel dropped into a card — the
 * same 12.5px type meant for a narrow column, with a page title above it, a
 * card border eating 32px of the width, and the bottom bar underneath. Four
 * things competing for a 390px screen.
 *
 * So this one takes the lot. It is `fixed inset-0` rather than a change to the
 * shell, which keeps the blast radius to this file: the header and the bottom
 * bar are still rendered, just behind it, and a back chevron returns you to
 * whatever you were on.
 *
 * Two things follow from the screen being small and the list being long:
 *
 *  - **No composer parked at the bottom.** That is eighty pixels of empty
 *    input sitting there all day for the one moment a week you use it. It is a
 *    round + instead, and a sheet when you actually have something to write.
 *    Four more rows fit. Which kind it writes is decided by the tab you are
 *    on, so the sheet has nothing to ask you.
 *  - **The filter hides behind the magnifier.** Same argument, less of it.
 *
 * Ask AI is the third tab, and says plainly that it is not connected. The page
 * is called Assistant now; the tab it names is still a facade, and a name is
 * not a reason to start pretending otherwise.
 */

/** Every row is wrapped: the wrapper travels and collapses, the row is drawn. */
function Wrap({ item, leaving, children }) {
  return (
    <div data-flip={item.id} className={leaving ? "row-leave" : undefined}>
      {children}
    </div>
  );
}

function Row({ item, leaving, onToggle, onDelete, offerUndo }) {
  const ticked = !!item.done_at;
  return (
    <Wrap item={item} leaving={leaving}>
      <div className="px-4 py-3 border-t border-wash flex gap-3 items-start">
        <button
          onClick={() => onToggle(item.id, !ticked)}
          role="checkbox"
          aria-checked={ticked}
          aria-label={item.body}
          className={`w-5 h-5 mt-px shrink-0 rounded-md flex items-center justify-center border-[1.5px] transition-colors duration-150 ${
            ticked ? "bg-ink-strong border-ink-strong" : "border-line-strong bg-surface"
          }`}
        >
          {ticked && (
            <svg className="row-ticked" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className={`text-[14.5px] leading-[1.4] text-pretty ${ticked ? "text-subtle line-through" : ""}`}>
            {item.body}
          </div>
          {(item.source_amount != null || item.source || item.done_at) && (
            <div className="mt-[5px] flex flex-wrap items-center gap-[7px]">
              {item.source_amount != null && (
                <span className="font-mono text-[10px] px-1.5 py-px rounded text-danger bg-[rgba(238,0,0,0.06)]">
                  {euro2(item.source_amount)}
                </span>
              )}
              {item.source && (
                <span className="font-mono text-[10px] px-1.5 py-px rounded bg-wash text-subtle">
                  {SOURCE_LABEL[item.source] ?? item.source.toUpperCase()}
                </span>
              )}
              {item.done_at && (
                <span className="font-mono text-[10px] text-faint">{tickedAgo(item.done_at)}</span>
              )}
            </div>
          )}
        </div>

        {ticked && offerUndo && (
          <button
            onClick={() => onToggle(item.id, false)}
            className="text-[12.5px] text-accent shrink-0 whitespace-nowrap pt-px"
          >
            Undo
          </button>
        )}
        <button
          onClick={() => onDelete(item)}
          aria-label={`Delete task: ${item.body}`}
          className="w-7 h-7 -mr-1 shrink-0 rounded-lg flex items-center justify-center text-faint"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    </Wrap>
  );
}

function NoteCard({ item, leaving, onDelete }) {
  return (
    <Wrap item={item} leaving={leaving}>
      <div className="px-4 py-3 border-t border-wash flex gap-3">
        <div className="w-[3px] rounded-full bg-warn shrink-0" />
        <div className="flex-1 min-w-0 text-[14.5px] leading-[1.45] text-muted text-pretty">
          {item.body}
        </div>
        <button
          onClick={() => onDelete(item)}
          aria-label={`Delete note: ${item.body}`}
          className="w-7 h-7 -mr-1 shrink-0 rounded-lg flex items-center justify-center text-faint"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>
    </Wrap>
  );
}

function Head({ label, count, open, onToggle, action }) {
  return (
    <div className="px-4 pt-4 pb-1.5 flex items-center gap-[7px]">
      <button onClick={onToggle} aria-expanded={open} className="flex items-center gap-[7px] flex-1 min-w-0 text-left">
        <span className="font-mono text-[10px] tracking-[0.08em] text-subtle uppercase">{label}</span>
        <span className="font-mono text-[10px] text-faint">{count}</span>
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          className="text-faint ml-auto"
          style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s" }}
        />
      </button>
      {open && action}
    </div>
  );
}

/** The sheet the + raises. The tab already said which kind, so it does not ask. */
function Compose({ kind, onClose, onAdd }) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await onAdd({ kind, body });
      onClose();
    } catch (err) {
      console.error("Panel write failed:", err);
      setBusy(false);
    }
  };

  return (
    <div className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 confirm-scrim" onClick={onClose} />
      <div
        className="relative bg-surface rounded-t-[22px] pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        style={{ boxShadow: "0 -10px 40px rgba(0,0,0,0.2)", animation: "sheetIn .18s ease" }}
      >
        <div className="h-5 flex items-center justify-center">
          <div className="w-9 h-1 rounded-full bg-line-strong" />
        </div>
        <div className="px-4 pb-3 flex items-center gap-2.5">
          <h2 className="text-[16px] font-semibold tracking-[-0.015em]">
            {kind === "task" ? "New task" : "New note"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto w-9 h-9 border border-line rounded-[10px] flex items-center justify-center text-muted"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>
        <div className="px-4">
          <textarea
            ref={field}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder={kind === "task" ? "What needs doing?" : "Write it down…"}
            className="w-full px-3 py-3 border border-line rounded-[13px] bg-surface text-[14.5px] leading-[1.45] outline-none resize-none placeholder:text-faint focus:border-ink-strong"
          />
          <button
            onClick={save}
            disabled={!draft.trim() || busy}
            className="w-full h-11 mt-3 rounded-[11px] bg-ink-strong text-surface text-[15px] font-medium flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {kind === "task" ? "Add task" : "Add note"}
          </button>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { id: "notes", label: "Notes" },
  { id: "todo", label: "To-dos" },
  { id: "chat", label: "Ask AI" },
];

export default function PhoneAssistant({ tab, setTab, openCount, loading, failure, notes, todo, done }) {
  const router = useRouter();
  const [folded, setFolded] = useState({ done: true });
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [composing, setComposing] = useState(false);
  const [asking, setAsking] = useState(null);
  const [leaving, setLeaving] = useState(null);
  const swipe = useRef(null);
  const list = useFlipList();

  const onNotes = tab === "notes";
  const onChat = tab === "chat";

  const fold = (key) => setFolded((f) => ({ ...f, [key]: !f[key] }));
  const isOpen = (key) => !folded[key];

  const run = async (fn) => {
    try {
      await fn();
    } catch (err) {
      console.error("Panel write failed:", err);
    }
  };
  const toggle = (id, next) => run(() => panelActions.setDone(id, next));

  const destroy = async () => {
    const item = asking;
    setAsking(null);
    setLeaving(item.id);
    if (!reducedMotion()) await new Promise((r) => setTimeout(r, LEAVE_MS));
    await run(() => panelActions.remove(item.id));
    setLeaving(null);
  };

  const back = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };

  // Swipe between the three tabs. Only a clearly horizontal drag counts, so a
  // flick down the list never lands you in the chat.
  const onTouchStart = (e) => {
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const i = TABS.findIndex((x) => x.id === tab);
    const next = TABS[Math.min(TABS.length - 1, Math.max(0, i + (dx < 0 ? 1 : -1)))];
    setTab(next.id);
  };

  const match = matcher(query);
  const q = query.trim();
  const shownNotes = notes.filter(match);
  const shownTodo = todo.filter(match);
  const shownDone = done.filter(match);
  const stillOpen = shownTodo.filter((r) => !r.done_at);
  const justDone = shownTodo.filter((r) => r.done_at);
  const capped = !showAll && !q && stillOpen.length > FIRST_RUN;

  const subtitle = onChat
    ? "not connected yet"
    : onNotes
      ? `${notes.length} written`
      : `${openCount} open`;

  return (
    <div className="md:hidden fixed inset-0 z-50 bg-surface flex flex-col">
      <div className="shrink-0 flex items-center gap-2.5 px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2">
        <button
          onClick={back}
          aria-label="Back"
          className="w-10 h-10 shrink-0 rounded-[10px] flex items-center justify-center text-muted"
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <h1 className="text-[19px] font-semibold tracking-[-0.02em]">Assistant</h1>
        <span className="font-mono text-[11px] text-subtle truncate">{subtitle}</span>
        {!onChat && (
          <button
            onClick={() => {
              setSearching((s) => !s);
              setQuery("");
            }}
            aria-label={searching ? "Close filter" : "Filter"}
            aria-pressed={searching}
            className="ml-auto w-10 h-10 shrink-0 rounded-[10px] flex items-center justify-center text-muted"
          >
            {searching ? <X size={19} strokeWidth={2} /> : <Search size={19} strokeWidth={1.9} />}
          </button>
        )}
      </div>

      <div className="shrink-0 flex border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`flex-1 pt-[11px] pb-2.5 text-[14px] relative ${
              tab === t.id ? "text-ink font-medium" : "text-subtle"
            }`}
          >
            <span className="relative">
              {t.label}
              {t.id === "todo" && openCount > 0 && tab !== "todo" && (
                <span className="absolute -top-px -right-2 w-1.5 h-1.5 rounded-full bg-danger" />
              )}
            </span>
            {tab === t.id && (
              <span className="absolute left-[22%] right-[22%] -bottom-px h-[2px] rounded-full bg-ink-strong" />
            )}
          </button>
        ))}
      </div>

      {!onChat && searching && (
        <div className="shrink-0 px-4 py-2.5 border-b border-line">
          <div className="h-10 px-3 border border-line rounded-[10px] flex items-center gap-2 focus-within:border-ink-strong">
            <Search size={15} strokeWidth={2} className="text-faint shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${onNotes ? `${notes.length} notes` : `${todo.length + done.length} tasks`}…`}
              className="flex-1 min-w-0 bg-transparent text-[14.5px] outline-none placeholder:text-faint"
            />
          </div>
        </div>
      )}

      <div
        className="flex-1 min-h-0 flex flex-col"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {onChat ? (
          <AskAI />
        ) : failure ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2.5 px-8 text-center">
            <TriangleAlert size={18} className="text-warn-ink" />
            <p className="text-[14px] text-muted text-pretty">{failure}</p>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center text-subtle">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <div ref={list} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {onNotes ? (
              shownNotes.length === 0 ? (
                <p className="px-4 pt-4 text-[13px] text-faint">
                  {q ? "Nothing matches." : "Nothing written down."}
                </p>
              ) : (
                shownNotes.map((n) => (
                  <NoteCard key={n.id} item={n} leaving={leaving === n.id} onDelete={setAsking} />
                ))
              )
            ) : (
              <>
                <Head label="To do" count={shownTodo.length} open={isOpen("todo")} onToggle={() => fold("todo")} />
                {isOpen("todo") &&
                  (shownTodo.length === 0 ? (
                    <p className="px-4 pb-2 text-[13px] text-faint">
                      {q ? "Nothing matches." : "Nothing to do."}
                    </p>
                  ) : (
                    <>
                      {(capped ? stillOpen.slice(0, FIRST_RUN) : stillOpen).map((t) => (
                        <Row key={t.id} item={t} leaving={leaving === t.id} onToggle={toggle} onDelete={setAsking} offerUndo />
                      ))}
                      {capped && (
                        <button
                          onClick={() => setShowAll(true)}
                          className="w-full px-4 py-3 border-t border-wash text-left text-[13.5px] text-accent"
                        >
                          Show {stillOpen.length - FIRST_RUN} more
                        </button>
                      )}
                      {justDone.map((t) => (
                        <Row key={t.id} item={t} leaving={leaving === t.id} onToggle={toggle} onDelete={setAsking} offerUndo />
                      ))}
                    </>
                  ))}

                <Head
                  label="Done"
                  count={shownDone.length}
                  open={isOpen("done")}
                  onToggle={() => fold("done")}
                  action={
                    shownDone.length > 0 && (
                      <button
                        onClick={() => run(() => panelActions.clearDone(done.map((d) => d.id)))}
                        className="text-[12.5px] text-subtle shrink-0"
                      >
                        Clear
                      </button>
                    )
                  }
                />
                {isOpen("done") &&
                  (shownDone.length === 0 ? (
                    <p className="px-4 pb-2 text-[13px] text-faint">
                      {q ? "Nothing matches." : "Cleared automatically after 30 days."}
                    </p>
                  ) : (
                    shownDone.map((t) => (
                      <Row key={t.id} item={t} leaving={leaving === t.id} onToggle={toggle} onDelete={setAsking} />
                    ))
                  ))}
              </>
            )}
            {/* clearance for the + so it never covers the last row */}
            <div className="h-[86px]" />
          </div>
        )}
      </div>

      {!onChat && !composing && (
        <button
          onClick={() => setComposing(true)}
          aria-label={onNotes ? "New note" : "New task"}
          className="absolute right-[18px] bottom-[calc(1.5rem+env(safe-area-inset-bottom))] w-[54px] h-[54px] rounded-full bg-ink-strong text-surface flex items-center justify-center"
          style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.26)" }}
        >
          <Plus size={24} strokeWidth={2} />
        </button>
      )}

      {composing && (
        <Compose
          kind={onNotes ? "note" : "task"}
          onClose={() => setComposing(false)}
          onAdd={panelActions.add}
        />
      )}

      {asking && (
        <ConfirmDelete item={asking} onCancel={() => setAsking(null)} onConfirm={destroy} />
      )}
    </div>
  );
}
