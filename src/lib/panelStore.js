/**
 * Whether the side panel is open, and which of its two tabs you left it on.
 *
 * Kept in localStorage and read through `useSyncExternalStore`, the same way
 * the rail's pin is: the server gets a defined answer (shut, on the list) and
 * the client gets the stored one, with no effect that re-renders on mount.
 *
 * The panel starts shut. It only stays open because you opened it.
 */

const KEY = "bettys-panel";

const listeners = new Set();
export const subscribePanel = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const SHUT = { open: false, tab: "list" };

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
        ? { open: !!parsed.open, tab: parsed.tab === "chat" ? "chat" : "list" }
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
