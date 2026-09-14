"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";

/** A ticked task stays in To do this long before it moves to Done. */
export const SETTLE_HOURS = 24;

/** And it leaves Done this long after it was ticked. */
export const KEEP_DONE_DAYS = 30;

const hoursSince = (iso) => (Date.now() - new Date(iso).getTime()) / 3_600_000;

/**
 * Everything the panel shows, in one place, because the icon rail's dot and the
 * list itself have to agree about what "open" means.
 *
 * Rows are sorted into the three sections the design has and no others:
 *
 *   notes    — kind "note", never ticked (the table refuses it)
 *   todo     — open tasks, plus anything ticked in the last 24 hours, so you
 *              can see what you got through today and take back a mis-tap
 *   done     — ticked more than 24 hours ago
 *
 * Anything ticked more than 30 days ago is dropped on read. See CLAUDE.md for
 * why that is a filter rather than a scheduled job.
 */
// The rail and the phone bar both want the count, and on a desktop both are
// mounted even though only one is visible. One cache, one request, and every
// mounted copy re-renders together when anything writes.
let cache = null;
let inFlight = null;
const subscribers = new Set();

const fetchRows = async () => {
  const { data, error } = await supabase
    .from("panel_items")
    .select("id, kind, body, done_at, source, source_amount, source_key, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message || "Could not load the panel.");
  return data || [];
};

/** Re-read the table and tell every mounted panel. Call it after any write. */
export async function refreshPanelItems() {
  inFlight = fetchRows();
  cache = await inFlight;
  inFlight = null;
  subscribers.forEach((cb) => cb(cache));
  return cache;
}

export function usePanelItems() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [rows, setRows] = useState(cache);
  const [failure, setFailure] = useState(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setFailure(null);
      setRows(await refreshPanelItems());
    } catch (err) {
      setFailure(err.message);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    subscribers.add(setRows);
    // Nothing is set synchronously here on purpose: the first fetch resolves
    // into state, it does not clear it on the way in.
    const pending = inFlight ?? (cache === null ? refreshPanelItems() : null);
    pending?.then(setRows).catch((err) => setFailure(err.message));
    return () => subscribers.delete(setRows);
  }, [isAdmin]);

  const all = isAdmin ? rows ?? [] : [];
  const fresh = all.filter(
    (r) => !r.done_at || hoursSince(r.done_at) <= KEEP_DONE_DAYS * 24
  );

  const notes = fresh.filter((r) => r.kind === "note");
  const todo = fresh.filter(
    (r) => r.kind === "task" && (!r.done_at || hoursSince(r.done_at) < SETTLE_HOURS)
  );
  const done = fresh.filter(
    (r) => r.kind === "task" && r.done_at && hoursSince(r.done_at) >= SETTLE_HOURS
  );

  // The dot on the rail counts work, not reading material: open tasks only.
  const openCount = todo.filter((r) => !r.done_at).length;

  return {
    loading: isAdmin && rows === null,
    failure,
    notes,
    todo,
    done,
    openCount,
    reload: load,
    isAdmin,
  };
}
