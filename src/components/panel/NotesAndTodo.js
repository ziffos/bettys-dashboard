"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { euro2 } from "../../lib/format";

/**
 * Three sections, in this order, and no others: Notes, To do, Done.
 *
 * Nothing groups by where a task came from — the source is a chip on the row,
 * which is provenance, not a category. That was settled with the owner; see
 * design/PANEL.md.
 */

const SOURCE_LABEL = {
  payouts: "PAYOUTS",
  menu: "MENU",
  payroll: "PAYROLL",
  sales: "SALES",
};

/** "2 h ago" / "this morning" / "4 days ago" — when a task was ticked. */
export function tickedAgo(iso) {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return "just now";
  if (hours < 12) return `${Math.round(hours)} h ago`;
  const days = Math.round(hours / 24);
  if (days <= 1) return "yesterday";
  return `${days} days ago`;
}

function SectionHead({ label, count, right }) {
  return (
    <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
      <span className="font-mono text-[9.5px] tracking-[0.07em] text-subtle uppercase">
        {label}
      </span>
      <span className="font-mono text-[9.5px] text-faint">{count}</span>
      {right}
    </div>
  );
}

function NoteRow({ item }) {
  return (
    <div className="px-3 py-2.5 border-t border-wash flex gap-2.5">
      <div className="w-[2px] rounded-full bg-warn shrink-0" />
      <div className="flex-1 min-w-0 text-[12.5px] leading-[1.4] text-muted text-pretty">
        {item.body}
      </div>
    </div>
  );
}

function TaskRow({ item }) {
  const struck = !!item.done_at;
  return (
    <div className="px-3 py-2 border-t border-wash flex gap-2.5 items-start">
      <span
        className={`w-[15px] h-[15px] mt-px shrink-0 rounded flex items-center justify-center border-[1.5px] ${
          struck ? "bg-ink-strong border-ink-strong" : "border-line-strong bg-surface"
        }`}
      >
        {struck && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className={`text-[12.5px] leading-[1.35] text-pretty ${
            struck ? "text-subtle line-through" : ""
          }`}
        >
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
    </div>
  );
}

export default function NotesAndTodo({ loading, failure, notes, todo, done }) {
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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <SectionHead label="Notes" count={notes.length} />
      {notes.map((n) => (
        <NoteRow key={n.id} item={n} />
      ))}

      <SectionHead label="To do" count={todo.length} />
      {todo.map((t) => (
        <TaskRow key={t.id} item={t} />
      ))}

      <SectionHead label="Done" count={done.length} />
      {done.map((t) => (
        <TaskRow key={t.id} item={t} />
      ))}
      <div className="h-2" />
    </div>
  );
}
