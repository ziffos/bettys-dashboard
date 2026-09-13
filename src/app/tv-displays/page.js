"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, CircleAlert, ExternalLink, Tv, TriangleAlert, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  Card,
  CardHeader,
  EmptyState,
  LoadingState,
  PageHeader,
  Toast,
} from "../../components/ui";
import { euro2 } from "../../lib/format";

const NATIVE_W = 1920;
const NATIVE_H = 1080;

/** Displays 1–3 show four featured dishes each; display 4 is the whole menu. */
const SLOT_DISPLAYS = [1, 2, 3];
const SLOTS_PER_DISPLAY = 4;
const MENU_DISPLAY = 4;

const CATEGORY_SHORT = {
  "Fried Chicken Combos": "Chicken",
  "Burger & Wrap Combos": "Burgers",
  Products: "Products",
  Sides: "Sides",
  Dips: "Dips",
  Drinks: "Drinks",
};

/**
 * A live, scaled-down render of what the screen on the wall is showing.
 *
 * The design replaced this with the slot names alone. Seeing the actual board —
 * the art, the prices as they are typeset, whether it is mid-rotation — is the
 * only way to know the wall is right, so it stays, behind a toggle rather than
 * loading four 1920×1080 iframes on every visit.
 */
function LivePreview({ path, label }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / NATIVE_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={box}
      className="relative w-full bg-black overflow-hidden rounded-lg border border-line"
      style={{ aspectRatio: "16 / 9" }}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] text-subtle">
          Loading what is on the wall…
        </div>
      )}
      <iframe
        src={path}
        title={label}
        tabIndex={-1}
        onLoad={() => setLoaded(true)}
        className="absolute top-0 left-0 border-0 origin-top-left"
        style={{
          width: NATIVE_W,
          height: NATIVE_H,
          transform: `scale(${scale})`,
          pointerEvents: "none",
          opacity: loaded && scale > 0 ? 1 : 0,
          transition: "opacity .3s ease",
        }}
      />
    </div>
  );
}

export default function TvDisplaysPage() {
  const [items, setItems] = useState(null);
  const [failure, setFailure] = useState(null);
  const [held, setHeld] = useState(null);
  const [preview, setPreview] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, canonical_name, category, pos_price, image_url, tv_number, position")
        .eq("is_active", true)
        .order("canonical_name", { ascending: true });
      if (cancelled) return;
      if (error) {
        setFailure(error.message || "Could not load the boards.");
        return;
      }
      setFailure(null);
      setItems(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const slotItem = (tv, pos) =>
    (items || []).find((it) => it.tv_number === tv && it.position === pos) ?? null;

  /**
   * Move an item into a slot, swapping with whatever is there.
   *
   * Three writes rather than one: (tv_number, position) is unique, so the slot
   * has to be vacated before anything else can claim it.
   */
  const placeAt = useCallback(
    async (movingId, tv, pos) => {
      const moving = (items || []).find((it) => it.id === movingId);
      if (!moving) return;
      if (moving.tv_number === tv && moving.position === pos) return;

      const occupant = (items || []).find(
        (it) => it.tv_number === tv && it.position === pos
      );
      const fromTv = moving.tv_number ?? null;
      const fromPos = moving.position ?? null;

      setSaving(true);
      try {
        const free = await supabase
          .from("menu_items")
          .update({ tv_number: null, position: null })
          .eq("id", movingId);
        if (free.error) throw free.error;

        if (occupant && occupant.id !== movingId) {
          const swap = await supabase
            .from("menu_items")
            .update({ tv_number: fromTv, position: fromPos })
            .eq("id", occupant.id);
          if (swap.error) throw swap.error;
        }

        const put = await supabase
          .from("menu_items")
          .update({ tv_number: tv, position: pos })
          .eq("id", movingId);
        if (put.error) throw put.error;

        setToast({
          type: "ok",
          message: occupant
            ? `${moving.canonical_name} swapped with ${occupant.canonical_name}`
            : `${moving.canonical_name} is on display ${tv}`,
        });
        reload();
      } catch (err) {
        setToast({ type: "error", message: err.message || "Could not move that item" });
        reload();
      } finally {
        setSaving(false);
      }
    },
    [items]
  );

  const clearSlot = async (item) => {
    setSaving(true);
    const { error } = await supabase
      .from("menu_items")
      .update({ tv_number: null, position: null })
      .eq("id", item.id);
    setSaving(false);
    if (error) {
      setToast({ type: "error", message: "Could not clear that slot" });
      return;
    }
    setToast({ type: "ok", message: `${item.canonical_name} taken off the wall` });
    reload();
  };

  const tapSlot = (tv, pos) => {
    const occupant = slotItem(tv, pos);
    if (!held) {
      if (occupant) setHeld(occupant);
      return;
    }
    placeAt(held.id, tv, pos);
    setHeld(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (failure) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="TV displays" />
        <EmptyState
          icon={TriangleAlert}
          title="Could not load the boards"
          body={failure}
          action="Try again"
          onAction={reload}
        />
      </div>
    );
  }

  if (!items) {
    return <LoadingState kpis={0} shape="list" line="LOADING 4 DISPLAYS" />;
  }

  const library = items.filter((it) => it.tv_number == null);
  const emptySlots = SLOT_DISPLAYS.flatMap((tv) =>
    Array.from({ length: SLOTS_PER_DISPLAY }, (_, i) => slotItem(tv, i + 1))
  ).filter((x) => !x).length;

  const header = (
    <PageHeader
      title="TV displays"
      sub="What is on each screen in the shop right now"
    />
  );

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        {header}
        <EmptyState
          icon={Tv}
          title="Nothing to put on a screen"
          body="The boards are filled from the menu, and there are no active items yet."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}

      {emptySlots > 0 && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 border border-line rounded-[10px] bg-wash-light">
          <CircleAlert size={15} strokeWidth={2} className="text-danger shrink-0 mt-[2px]" />
          <span className="text-[13px] flex-1 min-w-0 text-pretty">
            {emptySlots} slot{emptySlots === 1 ? " is" : "s are"} empty and{" "}
            {emptySlots === 1 ? "shows" : "show"} a blank panel in the shop.
          </span>
        </div>
      )}

      <div className="grid gap-3 items-start md:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        {/* The boards */}
        <div className="flex flex-col gap-3 min-w-0">
          {SLOT_DISPLAYS.map((tv) => {
            const path = `/tv-display-${tv}`;
            const open = !!preview[tv];
            return (
              <Card key={tv}>
                <div className="px-3.5 py-3 border-b border-line flex items-center gap-2.5 flex-wrap">
                  <Tv size={14} strokeWidth={1.75} className="text-muted shrink-0" />
                  <h2 className="text-[13px] font-semibold tracking-[-0.01em] whitespace-nowrap">
                    TV display {tv}
                  </h2>
                  <div className="flex-1" />
                  <button
                    onClick={() => setPreview((p) => ({ ...p, [tv]: !p[tv] }))}
                    className="flex items-center gap-1.5 h-7 px-2.5 border border-line rounded-md bg-surface text-[12px] text-muted hover:border-line-strong hover:text-ink"
                  >
                    <ChevronDown
                      size={13}
                      strokeWidth={2}
                      style={{
                        transform: open ? "rotate(180deg)" : "none",
                        transition: "transform .15s ease",
                      }}
                    />
                    Preview
                  </button>
                  <a
                    href={path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 h-7 px-2.5 border border-line rounded-md bg-surface text-[12px] text-muted hover:border-line-strong hover:text-ink"
                  >
                    Open
                    <ExternalLink size={11} strokeWidth={2} />
                  </a>
                </div>

                {open && (
                  <div className="p-4 border-b border-line">
                    <LivePreview key={reloadKey} path={path} label={`TV display ${tv}`} />
                  </div>
                )}

                <div className="px-3.5 py-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {Array.from({ length: SLOTS_PER_DISPLAY }, (_, i) => i + 1).map((pos) => {
                    const item = slotItem(tv, pos);
                    const isHeld = held?.id === item?.id;
                    return (
                      <div
                        key={pos}
                        onClick={() => tapSlot(tv, pos)}
                        className="relative min-h-[96px] rounded-lg px-2 pt-6 pb-2 flex flex-col justify-end cursor-pointer overflow-hidden hover:border-ink-strong"
                        style={{
                          background: item ? "var(--color-wash-light)" : "var(--color-surface)",
                          border: `1px ${item ? "solid" : "dashed"} ${
                            isHeld
                              ? "var(--color-ink-strong)"
                              : item
                                ? "var(--color-line)"
                                : "var(--color-line-strong)"
                          }`,
                        }}
                      >
                        <span className="absolute top-1.5 left-2 font-mono text-[10px] text-subtle">
                          {pos}
                        </span>
                        {item ? (
                          <div className="min-w-0">
                            <div className="text-[12px] font-medium leading-[1.25] text-pretty line-clamp-2">
                              {item.canonical_name}
                            </div>
                            <div className="font-mono text-[11px] text-subtle mt-0.5 truncate">
                              {item.pos_price != null ? euro2(item.pos_price) : "—"} ·{" "}
                              {CATEGORY_SHORT[item.category] ?? item.category}
                            </div>
                          </div>
                        ) : (
                          <span className="my-auto self-center text-center text-[12px] text-subtle text-pretty">
                            {held ? `Put ${held.canonical_name} here` : "Empty slot"}
                          </span>
                        )}
                        {item && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearSlot(item);
                            }}
                            title="Take this off the wall"
                            className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded text-faint hover:text-danger hover:bg-wash"
                          >
                            <X size={12} strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {/* The menu board */}
          <div className="border border-line rounded-xl bg-wash-light">
            <div className="px-3.5 py-3 flex items-center gap-2.5 flex-wrap">
              <Tv size={14} strokeWidth={1.75} className="text-muted shrink-0" />
              <h2 className="text-[13px] font-semibold tracking-[-0.01em] whitespace-nowrap">
                TV display {MENU_DISPLAY}
              </h2>
              <span className="text-[12px] text-muted order-last basis-full md:order-none md:basis-0 md:flex-1 min-w-0 text-pretty">
                shows the whole menu by category · nothing to arrange
              </span>
              <button
                onClick={() =>
                  setPreview((p) => ({ ...p, [MENU_DISPLAY]: !p[MENU_DISPLAY] }))
                }
                className="flex items-center gap-1.5 h-7 px-2.5 border border-line rounded-md bg-surface text-[12px] text-muted hover:border-line-strong hover:text-ink"
              >
                <ChevronDown
                  size={13}
                  strokeWidth={2}
                  style={{
                    transform: preview[MENU_DISPLAY] ? "rotate(180deg)" : "none",
                    transition: "transform .15s ease",
                  }}
                />
                Preview
              </button>
              <a
                href={`/tv-display-${MENU_DISPLAY}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 h-7 px-2.5 border border-line rounded-md bg-surface text-[12px] text-muted hover:border-line-strong hover:text-ink"
              >
                Open
                <ExternalLink size={11} strokeWidth={2} />
              </a>
            </div>
            {preview[MENU_DISPLAY] && (
              <div className="px-3.5 pb-3.5 pt-0">
                <LivePreview
                  key={reloadKey}
                  path={`/tv-display-${MENU_DISPLAY}`}
                  label={`TV display ${MENU_DISPLAY}`}
                />
              </div>
            )}
          </div>
        </div>

        {/* The library */}
        <Card>
          <CardHeader
            title="Not on a screen"
            sub={
              held
                ? `Holding ${held.canonical_name} — tap the slot it should go in`
                : "Tap an item, then tap the slot it should go in"
            }
            right={
              held && (
                <button
                  onClick={() => setHeld(null)}
                  className="h-7 px-2.5 border border-line rounded-md bg-surface text-[12px] text-muted hover:border-line-strong hover:text-ink"
                >
                  Cancel
                </button>
              )
            }
          />
          <div className="px-4 pb-2 font-mono text-[11px] text-subtle">
            {library.length} item{library.length === 1 ? "" : "s"} not on a screen
          </div>
          <div className="px-4 pb-4">
            <div className="flex flex-col gap-1.5 md:max-h-[420px] md:overflow-y-auto">
            {library.length === 0 ? (
              <p className="py-4 text-[13px] text-muted text-center text-pretty">
                Every active item is on a screen.
              </p>
            ) : (
              library.map((item) => {
                const isHeld = held?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setHeld(isHeld ? null : item)}
                    className="flex items-center justify-between gap-2.5 min-h-[38px] px-2.5 py-1.5 rounded-lg text-[13px] text-left"
                    style={{
                      border: `1px solid ${isHeld ? "var(--color-ink-strong)" : "var(--color-line)"}`,
                      background: isHeld ? "var(--color-ink-strong)" : "var(--color-surface)",
                      color: isHeld ? "#fff" : "var(--color-ink)",
                    }}
                  >
                    <span className="min-w-0 truncate">{item.canonical_name}</span>
                    <span
                      className="font-mono text-[11px] shrink-0"
                      style={{ color: isHeld ? "rgba(255,255,255,0.72)" : "var(--color-muted)" }}
                    >
                      {item.pos_price != null ? euro2(item.pos_price) : "—"}
                    </span>
                  </button>
                );
              })
            )}
            </div>
          </div>
        </Card>
      </div>

      <Toast toast={toast} onDone={() => setToast(null)} />
      {saving && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-[105] font-mono text-[11px] text-subtle">
          saving…
        </div>
      )}
    </div>
  );
}
