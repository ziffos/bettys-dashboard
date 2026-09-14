"use client";

import { useSyncExternalStore } from "react";
import { PageHeader, Segmented } from "../../components/ui";
import { useAuth } from "../../lib/AuthContext";
import {
  readPanel,
  readPanelOnServer,
  subscribePanel,
  writePanel,
} from "../../lib/panelStore";
import { usePanelItems } from "../../components/panel/usePanelItems";
import NotesAndTodo from "../../components/panel/NotesAndTodo";
import AskAI from "../../components/panel/AskAI";

const TABS = [
  { id: "list", label: "Notes & to-do" },
  { id: "chat", label: "Ask AI" },
];

/**
 * The phone's way in.
 *
 * A page rather than an overlay, so the bottom bar stays put and this behaves
 * like every other destination — back works, the tab you were on is the tab the
 * desktop panel is on, because both read the same store.
 *
 * It is reachable on a wide screen too; the desktop just has a better door in
 * the icon rail.
 */
export default function NotesPage() {
  const { profile } = useAuth();
  const panel = useSyncExternalStore(subscribePanel, readPanel, readPanelOnServer);
  const { openCount, isAdmin, ...items } = usePanelItems();

  if (profile && !isAdmin) return null; // the route guard is already moving them

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title="Notes"
        sub={panel.tab === "list" ? `${openCount} open` : "Ask AI is not connected yet"}
      />

      <Segmented
        options={TABS}
        value={panel.tab}
        onChange={(tab) => writePanel({ ...panel, tab })}
      />

      <div className="bg-surface border border-line rounded-xl flex flex-col min-h-[60vh]"
           style={{ boxShadow: "var(--shadow-card)" }}>
        {panel.tab === "list" ? <NotesAndTodo {...items} openCount={openCount} /> : <AskAI />}
      </div>
    </div>
  );
}
