/**
 * Whether the side panel is open, and which of its three tabs you left it on.
 *
 * Kept in localStorage and read through `useSyncExternalStore`, the same way
 * the rail's pin is: the server gets a defined answer (shut, on the to-dos)
 * and the client gets the stored one, with no effect that re-renders on mount.
 *
 * The panel starts shut. It only stays open because you opened it.
 */

const KEY = "bettys-panel";

const listeners = new Set();
export const subscribePanel = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const PANEL_TABS = ["notes", "todo", "chat"];

const SHUT = { open: false, tab: "todo" };

/**
 * Notes and to-dos used to share one tab called "list". Anyone who has used
 * the panel has that word in their browser; it means the to-dos now.
 */
const readTab = (tab) => (PANEL_TABS.includes(tab) ? tab : tab === "list" ? "todo" : "todo");

// The snapshot has to be referentially stable or useSyncExternalStore will
// re-render forever, so the parsed value is cached until something writes.
let cached = null;
let cachedRaw = null;

export const readPanel = () => {
  const raw = window.localStorage.getItem(KEY);
  if (raw === cachedRaw && cached) return cached;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    cached =
      parsed && typeof parsed === "object"
        ? { open: !!parsed.open, tab: readTab(parsed.tab) }
        : SHUT;
  } catch {
    cached = SHUT;
  }
  return cached;
};

export const readPanelOnServer = () => SHUT;

export const writePanel = (next) => {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  cachedRaw = null;
  listeners.forEach((cb) => cb());
};
