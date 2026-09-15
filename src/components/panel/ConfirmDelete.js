"use client";

import { useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";

/**
 * The question before a deletion, asked inside the surface it belongs to.
 *
 * Not a page-wide modal: the panel is 334px of a dashboard and the phone
 * screen is its own thing, and throwing a dialog over the whole application to
 * ask about one line of a to-do list is out of proportion. This covers the
 * panel, or the phone screen, and nothing else — `absolute inset-0` inside a
 * `relative` parent.
 *
 * It quotes the row, because "are you sure?" about an unnamed thing is not a
 * question anybody can answer. Deleting is the destructive option and the
 * rightmost one; Escape and the backdrop both cancel.
 */
export default function ConfirmDelete({ item, busy, onCancel, onConfirm }) {
  const go = useRef(null);

  useEffect(() => {
    go.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const isNote = item.kind === "note";

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 confirm-scrim" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={`Delete this ${isNote ? "note" : "task"}?`}
        className="relative w-full max-w-[290px] bg-surface border border-line rounded-[14px] p-4 confirm-pop"
        style={{ boxShadow: "var(--shadow-pop)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Trash2 size={15} strokeWidth={1.9} className="text-danger shrink-0" />
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">
            Delete this {isNote ? "note" : "task"}?
          </h2>
        </div>
        <p className="text-[12.5px] leading-[1.45] text-subtle text-pretty border-l-2 border-line pl-2.5 mb-3.5 line-clamp-4">
          {item.body}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 h-9 border border-line rounded-[9px] text-[13px] text-muted hover:border-line-strong hover:text-ink"
          >
            Cancel
          </button>
          <button
            ref={go}
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 h-9 rounded-[9px] bg-danger text-white text-[13px] font-medium disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
