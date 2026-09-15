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
import PhoneAssistant from "../../components/panel/PhoneAssistant";
import AskAI from "../../components/panel/AskAI";

const TABS = [
  { id: "notes", label: "Notes" },
  { id: "todo", label: "To-dos" },
  { id: "chat", label: "Ask AI" },
];

/**
 * The Assistant: notes, a to-do list, and a chat that is not connected yet.
 *
 * Two layouts, not one responsive one. On a wide screen this is an ordinary
 * page, because the desktop already has a better door — the icon rail on the
 * right — and anyone arriving here by URL should get the page they expect. On
 * a phone it is the whole screen, drawn by PhoneAssistant, which explains
 * itself there.
 *
 * Both read the same store as the desktop panel, so the tab you left it on is
 * the tab you come back to, whichever door you used.
 */
export default function AssistantPage() {
  const { profile } = useAuth();
  const panel = useSyncExternalStore(subscribePanel, readPanel, readPanelOnServer);
  const { openCount, isAdmin, ...items } = usePanelItems();

  if (profile && !isAdmin) return null; // the route guard is already moving them

  const setTab = (tab) => writePanel({ ...panel, tab });

  return (
    <>
      <PhoneAssistant tab={panel.tab} setTab={setTab} openCount={openCount} {...items} />

      <div className="hidden md:flex flex-col gap-5">
        <PageHeader
          title="Assistant"
          sub={
            panel.tab === "chat"
              ? "Ask AI is not connected yet"
              : panel.tab === "notes"
                ? `${items.notes.length} written down`
                : `${openCount} open`
          }
        />

        <Segmented options={TABS} value={panel.tab} onChange={setTab} />

        <div
          className="relative bg-surface border border-line rounded-xl flex flex-col min-h-[60vh] overflow-hidden"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          {panel.tab === "chat" ? <AskAI /> : <NotesAndTodo tab={panel.tab} {...items} />}
        </div>
      </div>
    </>
  );
}
