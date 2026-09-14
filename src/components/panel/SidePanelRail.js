"use client";

import { useSyncExternalStore } from "react";
import { MessageCircle, ListChecks, X } from "lucide-react";
import {
  readPanel,
  readPanelOnServer,
  subscribePanel,
  writePanel,
} from "../../lib/panelStore";
import { usePanelItems } from "./usePanelItems";
import NotesAndTodo from "./NotesAndTodo";
import AskAI from "./AskAI";

const TABS = [
  { id: "chat", label: "Ask AI", Icon: MessageCircle },
  { id: "list", label: "Notes & to-do", Icon: ListChecks },
];

/**
 * The second rail, on the right of the shell.
 *
 * It mirrors the navigation rail on the left and is always there, even with
 * the panel shut, so the panel never goes out of mind — that was the whole
 * argument for this shape over a thin edge tab. Opening puts the panel to the
 * left of it, inside the flex row, so the page is **pushed** rather than
 * covered: this is a dashboard, and the point is to read a number and write it
 * down without either hiding the other.
 *
 * Desktop only. The phone gets its own full-screen version of
 * the same content at /assistant — see PhoneAssistant.
 */
export default function SidePanelRail() {
  const panel = useSyncExternalStore(subscribePanel, readPanel, readPanelOnServer);
  const { openCount, isAdmin, ...items } = usePanelItems();

  if (!isAdmin) return null;

  const pick = (tab) =>
    writePanel(panel.open && panel.tab === tab ? { open: false, tab } : { open: true, tab });

  return (
    <>
      {/* Exactly the viewport, never the page. The shell holds still and only
          the middle column scrolls, so the whole panel — list and composer —
          stays on screen whatever is on the page, and the list scrolls inside
          itself. */}
      {panel.open && (
        <aside className="hidden md:flex w-[334px] shrink-0 flex-col h-screen bg-surface border-l border-line">
          <div className="px-3 py-2.5 border-b border-line flex items-center gap-2 shrink-0">
            <span className="text-[13.5px] font-semibold tracking-[-0.01em]">
              {panel.tab === "list" ? "Notes & to-do" : "Ask AI"}
            </span>
            <span className="font-mono text-[10px] text-subtle">
              {panel.tab === "list"
                ? `${openCount} open`
                : "not connected yet"}
            </span>
            <button
              onClick={() => writePanel({ ...panel, open: false })}
              title="Close"
              className="ml-auto w-[26px] h-[26px] flex items-center justify-center border border-line rounded-[7px] text-subtle hover:border-line-strong hover:text-ink"
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>
          {panel.tab === "list" ? <NotesAndTodo {...items} openCount={openCount} /> : <AskAI />}
        </aside>
      )}

      <div className="hidden md:flex w-[46px] shrink-0 flex-col items-center gap-1.5 py-2.5 h-screen bg-surface border-l border-line">
        {TABS.map(({ id, label, Icon }) => {
          const on = panel.open && panel.tab === id;
          return (
            <button
              key={id}
              onClick={() => pick(id)}
              title={label}
              aria-pressed={on}
              className={`relative w-8 h-8 rounded-lg flex items-center justify-center ${
                on ? "bg-ink-strong text-surface" : "text-subtle hover:text-ink hover:bg-wash-light"
              }`}
            >
              <Icon size={15} strokeWidth={1.9} />
              {id === "list" && openCount > 0 && (
                <span
                  className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-danger"
                  style={{ boxShadow: `0 0 0 1.5px ${on ? "var(--color-ink-strong)" : "var(--color-surface)"}` }}
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
