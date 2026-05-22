"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { ExternalLink, Pencil, Eye, Tv, X } from "lucide-react";
import { supabase } from "../../lib/supabase";

const NATIVE_W = 1920;
const NATIVE_H = 1080;

const DISPLAYS = [
  { id: 1, label: "TV Display 1", path: "/tv-display-1" },
  { id: 2, label: "TV Display 2", path: "/tv-display-2" },
  { id: 3, label: "TV Display 3", path: "/tv-display-3" },
  { id: 4, label: "TV Display 4", path: "/tv-display-4" },
];

const EDITABLE_TVS = [1, 2, 3];
const SLOTS_PER_TV = 4;

function DisplayPreview({ label, path }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
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
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2 min-w-0">
          <Tv size={14} className="text-emerald-400 shrink-0 md:w-4 md:h-4" />
          <h3 className="text-xs md:text-sm font-semibold text-white truncate">{label}</h3>
          <span className="hidden md:inline text-[10px] text-neutral-500 font-medium tracking-wider uppercase">
            1920×1080
          </span>
        </div>
        <a
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-medium text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors shrink-0"
        >
          <span>Open</span>
          <ExternalLink size={11} className="md:w-3 md:h-3" />
        </a>
      </div>

      <div
        ref={containerRef}
        className="relative w-full bg-black overflow-hidden"
        style={{ aspectRatio: "16 / 9" }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-xs">
            Loading preview…
          </div>
        )}
        <iframe
          src={path}
          title={label}
          onLoad={() => setLoaded(true)}
          tabIndex={-1}
          className="absolute top-0 left-0 border-0 origin-top-left"
          style={{
            width: NATIVE_W,
            height: NATIVE_H,
            transform: `scale(${scale})`,
            pointerEvents: "none",
            opacity: loaded && scale > 0 ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

function ProductCard({
  item,
  isSelected,
  isDragSource,
  onPick,
  onDragStart,
  onDragEnd,
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart(item);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onPick(item)}
      className={[
        "group relative flex items-center gap-2 w-full p-2 rounded-lg border text-left transition-all",
        "bg-neutral-900 hover:bg-neutral-800 active:scale-[0.98]",
        isSelected
          ? "border-emerald-400 ring-2 ring-emerald-400/40"
          : "border-neutral-800 hover:border-neutral-700",
        isDragSource ? "opacity-40" : "opacity-100",
      ].join(" ")}
    >
      <div className="relative w-10 h-10 shrink-0 rounded-md overflow-hidden bg-neutral-950">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.canonical_name}
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-700 text-[10px]">
            No img
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white truncate">{item.canonical_name}</p>
        {item.pos_price != null && (
          <p className="text-[11px] text-amber-400">€{Number(item.pos_price).toFixed(2)}</p>
        )}
      </div>
    </button>
  );
}

function Slot({
  tvNumber,
  position,
  item,
  isSelected,
  isDragSource,
  isDropTarget,
  onPick,
  onClear,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) {
  const empty = !item;
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={[
        "relative aspect-[16/9] rounded-lg overflow-hidden border-2 transition-all",
        empty ? "bg-neutral-950 border-dashed border-neutral-700" : "bg-black border-neutral-700",
        isDropTarget ? "border-emerald-400 ring-2 ring-emerald-400/40" : "",
        isSelected ? "border-emerald-400 ring-2 ring-emerald-400/40" : "",
        isDragSource ? "opacity-40" : "",
      ].join(" ")}
    >
      <button
        type="button"
        draggable={!empty}
        onDragStart={(e) => {
          if (empty) return;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", item.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onClick={() => onPick({ tvNumber, position, item })}
        className="absolute inset-0 w-full h-full text-left"
      >
        {item?.image_url ? (
          <Image
            src={item.image_url}
            alt={item.canonical_name}
            fill
            sizes="(max-width: 768px) 50vw, 200px"
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute top-1.5 left-1.5 bg-black/70 text-[10px] text-white font-semibold px-1.5 py-0.5 rounded">
          Slot {position}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2">
          {item ? (
            <>
              <p className="text-[11px] md:text-xs font-semibold text-white truncate">
                {item.canonical_name}
              </p>
              {item.pos_price != null && (
                <p className="text-[10px] md:text-[11px] text-amber-400">
                  €{Number(item.pos_price).toFixed(2)}
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-neutral-500 text-center">Drop or tap</p>
          )}
        </div>
      </button>
      {item && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          aria-label="Remove from slot"
          className="absolute top-1 right-1 bg-black/70 hover:bg-red-500/80 text-white rounded-full p-1 transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function LayoutEditor({ onDone }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Selection (tap to pick) and drag state
  const [selected, setSelected] = useState(null); // { id, tvNumber, position } | null
  const [dragSource, setDragSource] = useState(null); // same shape
  const [dropTarget, setDropTarget] = useState(null); // { tvNumber, position } | null

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, canonical_name, pos_price, image_url, tv_number, position")
      .eq("is_active", true)
      .order("canonical_name", { ascending: true });
    if (error) {
      setError(error.message);
    } else if (data) {
      setItems(data);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const byId = (id) => items.find((it) => it.id === id);
  const slotItem = (tv, pos) =>
    items.find((it) => it.tv_number === tv && it.position === pos);
  const unassigned = items.filter((it) => it.tv_number == null);

  // Place `movingId` into (targetTv, targetPos). If a different item already
  // sits there, swap it into wherever movingId came from (which may be null,
  // i.e. back to the library).
  const placeAt = useCallback(
    async (movingId, targetTv, targetPos) => {
      const moving = items.find((it) => it.id === movingId);
      if (!moving) return;
      // No-op when dropping onto the same slot you came from
      if (moving.tv_number === targetTv && moving.position === targetPos) return;

      const occupant = items.find(
        (it) => it.tv_number === targetTv && it.position === targetPos,
      );
      const origTv = moving.tv_number;
      const origPos = moving.position;

      setSaving(true);
      try {
        // Step 1: free moving slot (avoids unique conflict)
        const { error: e1 } = await supabase
          .from("menu_items")
          .update({ tv_number: null, position: null })
          .eq("id", movingId);
        if (e1) throw e1;

        // Step 2: relocate occupant to moving's old slot (which may be null)
        if (occupant && occupant.id !== movingId) {
          const { error: e2 } = await supabase
            .from("menu_items")
            .update({ tv_number: origTv ?? null, position: origPos ?? null })
            .eq("id", occupant.id);
          if (e2) throw e2;
        }

        // Step 3: put moving into target slot
        const { error: e3 } = await supabase
          .from("menu_items")
          .update({ tv_number: targetTv, position: targetPos })
          .eq("id", movingId);
        if (e3) throw e3;

        await fetchItems();
      } catch (err) {
        setError(err.message || "Failed to update");
      } finally {
        setSaving(false);
      }
    },
    [items, fetchItems],
  );

  const clearSlot = useCallback(
    async (itemId) => {
      setSaving(true);
      try {
        const { error } = await supabase
          .from("menu_items")
          .update({ tv_number: null, position: null })
          .eq("id", itemId);
        if (error) throw error;
        await fetchItems();
      } catch (err) {
        setError(err.message || "Failed to clear slot");
      } finally {
        setSaving(false);
      }
    },
    [fetchItems],
  );

  // Tap interaction: pick something, then tap a destination
  const pickItem = (item) => {
    if (selected?.id === item.id) {
      setSelected(null);
      return;
    }
    setSelected({ id: item.id, tvNumber: item.tv_number, position: item.position });
  };

  const pickSlot = ({ tvNumber, position, item }) => {
    if (!selected) {
      if (item) pickItem(item);
      return;
    }
    // Place the selected item into this slot
    placeAt(selected.id, tvNumber, position);
    setSelected(null);
  };

  // Drag handlers
  const onProductDragStart = (item) =>
    setDragSource({ id: item.id, tvNumber: item.tv_number, position: item.position });
  const onSlotDragStart = (tvNumber, position, item) =>
    item && setDragSource({ id: item.id, tvNumber, position });
  const onDragEnd = () => {
    setDragSource(null);
    setDropTarget(null);
  };
  const onSlotDragOver = (tvNumber, position) =>
    setDropTarget({ tvNumber, position });
  const onSlotDragLeave = (tvNumber, position) => {
    setDropTarget((cur) =>
      cur && cur.tvNumber === tvNumber && cur.position === position ? null : cur,
    );
  };
  const onSlotDrop = (tvNumber, position) => {
    if (dragSource) placeAt(dragSource.id, tvNumber, position);
    setDragSource(null);
    setDropTarget(null);
  };

  if (loading) {
    return <p className="text-sm text-neutral-400">Loading layout…</p>;
  }

  return (
    <div className="space-y-5 md:space-y-6">
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          {error}
        </div>
      )}

      {selected && (
        <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-2">
          <span className="truncate">
            Selected: <strong>{byId(selected.id)?.canonical_name}</strong> — tap a slot to place
            it.
          </span>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Library */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 md:p-4">
        <h3 className="text-xs md:text-sm font-semibold text-white mb-2">
          Available products{" "}
          <span className="text-neutral-500 font-normal">({unassigned.length})</span>
        </h3>
        {unassigned.length === 0 ? (
          <p className="text-xs text-neutral-500">
            All active products are placed on a TV slot.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {unassigned.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                isSelected={selected?.id === item.id}
                isDragSource={dragSource?.id === item.id}
                onPick={pickItem}
                onDragStart={onProductDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
          </div>
        )}
      </section>

      {/* TV slot editors */}
      {EDITABLE_TVS.map((tv) => (
        <section
          key={tv}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-3 md:p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Tv size={14} className="text-emerald-400" />
            <h3 className="text-xs md:text-sm font-semibold text-white">TV Display {tv}</h3>
            <a
              href={`/tv-display-${tv}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-[11px] text-neutral-400 hover:text-emerald-400"
            >
              Open <ExternalLink size={10} />
            </a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            {Array.from({ length: SLOTS_PER_TV }, (_, i) => i + 1).map((pos) => {
              const item = slotItem(tv, pos);
              const isTarget =
                dropTarget?.tvNumber === tv && dropTarget?.position === pos;
              const isSelectedSlot =
                selected?.id && item?.id === selected.id;
              const isSrc =
                dragSource?.id && item?.id === dragSource.id;
              return (
                <Slot
                  key={pos}
                  tvNumber={tv}
                  position={pos}
                  item={item}
                  isSelected={isSelectedSlot}
                  isDragSource={isSrc}
                  isDropTarget={isTarget}
                  onPick={pickSlot}
                  onClear={() => item && clearSlot(item.id)}
                  onDragStart={() => onSlotDragStart(tv, pos, item)}
                  onDragEnd={onDragEnd}
                  onDragOver={() => onSlotDragOver(tv, pos)}
                  onDragLeave={() => onSlotDragLeave(tv, pos)}
                  onDrop={() => onSlotDrop(tv, pos)}
                />
              );
            })}
          </div>
        </section>
      ))}

      <p className="text-[11px] text-neutral-500">
        TV Display 4 shows the full menu grouped by category — its layout is not edited here.
      </p>

      <div className="sticky bottom-3 flex justify-end">
        <button
          type="button"
          onClick={onDone}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg disabled:opacity-60"
        >
          <Eye size={14} />
          {saving ? "Saving…" : "Done"}
        </button>
      </div>
    </div>
  );
}

export default function TvDisplaysPage() {
  const [editing, setEditing] = useState(false);

  return (
    <div>
      <header className="mb-6 md:mb-8">
        <div className="flex items-start md:items-center gap-3">
          <div className="p-2 md:p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shrink-0">
            <Tv size={18} className="text-emerald-400 md:w-5 md:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
              TV Displays
            </h1>
            <p className="text-xs md:text-sm text-neutral-400 mt-0.5">
              {editing
                ? "Drag products onto slots, or tap one then tap a destination."
                : "Live previews of in-store displays at native 1920×1080 resolution."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-medium rounded-lg transition-colors shrink-0",
              editing
                ? "bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700"
                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
            ].join(" ")}
          >
            {editing ? <Eye size={14} /> : <Pencil size={14} />}
            {editing ? "View previews" : "Edit layout"}
          </button>
        </div>
      </header>

      {editing ? (
        <LayoutEditor onDone={() => setEditing(false)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {DISPLAYS.map((d) => (
            <DisplayPreview key={d.id} label={d.label} path={d.path} />
          ))}
        </div>
      )}
    </div>
  );
}
