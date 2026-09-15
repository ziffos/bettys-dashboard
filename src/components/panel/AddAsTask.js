"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { panelActions, usePanelItems } from "./usePanelItems";
import { writePanel } from "../../lib/panelStore";

/**
 * Puts a finding straight into the to-do list from wherever it was found.
 *
 * This is the button the whole panel exists for. The dashboard already knows
 * about a missing Wolt statement, an alias nobody filled in, a month never
 * rolled into payroll — before this, reading one meant copying it out by hand
 * onto something that was not the dashboard.
 *
 * `sourceKey` is uniquely indexed in the table, so pressing this twice cannot
 * write two rows. It reports that instead: a finding already on the list says
 * so rather than quietly doing nothing.
 *
 * Shown to admins only, because nobody else has the panel to put it in.
 */
export default function AddAsTask({ body, source, amount = null, sourceKey, className = "" }) {
  const { isAdmin, sourceKeys } = usePanelItems();
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  const already = sourceKeys.has(sourceKey);

  const add = async () => {
    if (busy || already) return;
    setBusy(true);
    try {
      await panelActions.add({
        kind: "task",
        body,
        source,
        source_amount: amount,
        source_key: sourceKey,
      });
      // Open the panel on the list, so you can see where it went.
      writePanel({ open: true, tab: "todo" });
    } catch (err) {
      console.error("Could not add the task:", err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={add}
      disabled={already || busy}
      title={already ? "Already on your list" : body}
      className={`shrink-0 inline-flex items-center gap-1.5 h-6 px-2 border rounded-md text-[11px] whitespace-nowrap ${
        already
          ? "border-line text-subtle cursor-default"
          : "border-line text-muted hover:border-line-strong hover:text-ink"
      } ${className}`}
    >
      {already ? <Check size={11} strokeWidth={2.2} /> : <Plus size={11} strokeWidth={2.2} />}
      {already ? "On your list" : "Add as task"}
    </button>
  );
}
