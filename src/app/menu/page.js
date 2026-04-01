"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import SkeletonBlock from "../../components/SkeletonBlock";
import { Search, Table2, LayoutGrid, Pencil, Trash2, Plus, X, Check, ChevronDown } from "lucide-react";

const CATEGORIES = [
  "Fried Chicken Combos",
  "Burger & Wrap Combos",
  "Products",
  "Sides",
  "Dips",
  "Drinks",
];

const CATEGORY_COLORS = {
  "Fried Chicken Combos": "#facc15",
  "Burger & Wrap Combos": "#fb923c",
  Products: "#ef4444",
  Sides: "#10b981",
  Dips: "#8b5cf6",
  Drinks: "#3b82f6",
  Unknown: "#737373",
};

const CATEGORY_ORDER = Object.fromEntries(CATEGORIES.map((c, i) => [c, i]));

const formatPrice = (val) => (val != null ? `€${Number(val).toFixed(2)}` : null);

const EMPTY_ITEM = {
  canonical_name: "",
  category: "Fried Chicken Combos",
  description: "",
  wolt_price: "",
  foody_price: "",
  bolt_price: "",
  pos_price: "",
  sort_order: "",
  image_url: "",
  servings: "",
  is_active: true,
};

// ─── Inline editable cell (desktop) ──────────────────────────
function EditableCell({ value, onChange, onSave, type = "text", align = "left", placeholder }) {
  return (
    <input
      type={type}
      step={type === "number" ? "0.01" : undefined}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && onSave) onSave(); }}
      placeholder={placeholder}
      className={`w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-sm text-neutral-200 focus:outline-none transition-colors ${align === "right" ? "text-right" : ""}`}
    />
  );
}

// ─── Mobile/Add modal ────────────────────────────────────────
function ItemModal({ title, values, onChange, onSave, onCancel, onDelete, saving }) {
  const field = (label, key, type = "text", placeholder = "") => (
    <div>
      <label className="block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">{label}</label>
      {key === "category" ? (
        <select
          value={values[key] || ""}
          onChange={(e) => onChange(key, e.target.value)}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
        >
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : key === "description" ? (
        <textarea
          value={values[key] ?? ""}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500 resize-none"
        />
      ) : (
        <input
          type={type}
          step={type === "number" ? "0.01" : undefined}
          value={values[key] ?? ""}
          onChange={(e) => onChange(key, e.target.value)}
          placeholder={placeholder}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-t-2xl md:rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onCancel} className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors"><X size={18} /></button>
        </div>

        {field("Item Name", "canonical_name", "text", "e.g. Betty's Classic")}
        {field("Category", "category")}
        {field("Description", "description", "text", "Short description...")}

        <div className="grid grid-cols-2 gap-3">
          {field("Wolt Price", "wolt_price", "number", "0.00")}
          {field("Foody Price", "foody_price", "number", "0.00")}
          {field("Bolt Price", "bolt_price", "number", "0.00")}
          {field("POS Price", "pos_price", "number", "0.00")}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {field("Sort Order", "sort_order", "number", "0")}
          {field("Servings", "servings", "number", "1")}
          {field("Image URL", "image_url", "text", "https://...")}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onSave}
            disabled={saving || !values.canonical_name?.trim()}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={onCancel} className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium rounded-xl transition-colors">
            Cancel
          </button>
          {onDelete && (
            <button onClick={onDelete} className="p-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors" title="Delete item">
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirmation ─────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
          <Trash2 size={22} className="text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-white">Delete Item</h3>
        <p className="text-sm text-neutral-400">Are you sure you want to permanently delete <strong className="text-white">{name}</strong>? This cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm font-medium rounded-xl transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────
export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortConfig, setSortConfig] = useState({ key: "__default", direction: "asc" });
  const [togglingItems, setTogglingItems] = useState(new Set());

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);

  // Mobile edit modal
  const [mobileEditItem, setMobileEditItem] = useState(null);
  const [mobileEditValues, setMobileEditValues] = useState({});

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addValues, setAddValues] = useState({ ...EMPTY_ITEM });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch menu items
  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      const { data, error } = await supabase.from("menu_items").select("*");
      if (!error && data) setItems(data);
      setLoading(false);
    }
    fetchItems();
  }, []);

  // Toggle is_active
  const handleToggleActive = async (item) => {
    const id = item.id;
    const newVal = !item.is_active;
    setTogglingItems((prev) => new Set(prev).add(id));
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_active: newVal } : i)));
    const { error } = await supabase.from("menu_items").update({ is_active: newVal }).eq("id", id);
    if (error) setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_active: !newVal } : i)));
    setTogglingItems((prev) => { const n = new Set(prev); n.delete(id); return n; });
  };

  // Price discrepancy
  const hasDeliveryDiscrepancy = (item) => {
    const w = item.wolt_price;
    if (w == null) return false;
    return (item.foody_price != null && item.foody_price !== w) || (item.bolt_price != null && item.bolt_price !== w);
  };

  // ── Inline edit helpers (desktop) ──
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditValues({
      canonical_name: item.canonical_name || "",
      category: item.category || "Fried Chicken Combos",
      description: item.description || "",
      wolt_price: item.wolt_price ?? "",
      foody_price: item.foody_price ?? "",
      bolt_price: item.bolt_price ?? "",
      pos_price: item.pos_price ?? "",
      sort_order: item.sort_order ?? "",
      image_url: item.image_url || "",
      servings: item.servings ?? "",
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditValues({}); };

  const saveEdit = async () => {
    if (!editValues.canonical_name?.trim()) return;
    setSaving(true);
    try {
      const payload = {
        canonical_name: editValues.canonical_name.trim(),
        category: editValues.category,
        description: editValues.description?.trim() || null,
        wolt_price: editValues.wolt_price !== "" ? Number(editValues.wolt_price) : null,
        foody_price: editValues.foody_price !== "" ? Number(editValues.foody_price) : null,
        bolt_price: editValues.bolt_price !== "" ? Number(editValues.bolt_price) : null,
        pos_price: editValues.pos_price !== "" ? Number(editValues.pos_price) : null,
        sort_order: editValues.sort_order !== "" ? Number(editValues.sort_order) : null,
        image_url: editValues.image_url?.trim() || null,
        servings: editValues.servings !== "" ? Number(editValues.servings) : null,
      };
      const { data, error } = await supabase.from("menu_items").update(payload).eq("id", editingId).select();
      if (error) {
        console.error("Update error:", error);
        alert("Failed to save: " + error.message);
      } else {
        setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, ...payload } : i)));
        cancelEdit();
      }
    } catch (err) {
      console.error("Save exception:", err);
      alert("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  // ── Mobile edit helpers ──
  const startMobileEdit = (item) => {
    setMobileEditItem(item);
    setMobileEditValues({
      canonical_name: item.canonical_name || "",
      category: item.category || "Fried Chicken Combos",
      description: item.description || "",
      wolt_price: item.wolt_price ?? "",
      foody_price: item.foody_price ?? "",
      bolt_price: item.bolt_price ?? "",
      pos_price: item.pos_price ?? "",
      sort_order: item.sort_order ?? "",
      image_url: item.image_url || "",
      servings: item.servings ?? "",
    });
  };

  const saveMobileEdit = async () => {
    if (!mobileEditValues.canonical_name?.trim()) return;
    setSaving(true);
    try {
      const payload = {
        canonical_name: mobileEditValues.canonical_name.trim(),
        category: mobileEditValues.category,
        description: mobileEditValues.description?.trim() || null,
        wolt_price: mobileEditValues.wolt_price !== "" ? Number(mobileEditValues.wolt_price) : null,
        foody_price: mobileEditValues.foody_price !== "" ? Number(mobileEditValues.foody_price) : null,
        bolt_price: mobileEditValues.bolt_price !== "" ? Number(mobileEditValues.bolt_price) : null,
        pos_price: mobileEditValues.pos_price !== "" ? Number(mobileEditValues.pos_price) : null,
        sort_order: mobileEditValues.sort_order !== "" ? Number(mobileEditValues.sort_order) : null,
        image_url: mobileEditValues.image_url?.trim() || null,
        servings: mobileEditValues.servings !== "" ? Number(mobileEditValues.servings) : null,
      };
      const { data, error } = await supabase.from("menu_items").update(payload).eq("id", mobileEditItem.id).select();
      if (error) {
        console.error("Update error:", error);
        alert("Failed to save: " + error.message);
      } else {
        setItems((prev) => prev.map((i) => (i.id === mobileEditItem.id ? { ...i, ...payload } : i)));
        setMobileEditItem(null);
      }
    } catch (err) {
      console.error("Save exception:", err);
      alert("Failed to save: " + err.message);
    }
    setSaving(false);
  };

  // ── Add item ──
  const saveAdd = async () => {
    if (!addValues.canonical_name?.trim()) return;
    setSaving(true);
    const payload = {
      canonical_name: addValues.canonical_name.trim(),
      category: addValues.category,
      description: addValues.description?.trim() || null,
      wolt_price: addValues.wolt_price !== "" ? Number(addValues.wolt_price) : null,
      foody_price: addValues.foody_price !== "" ? Number(addValues.foody_price) : null,
      bolt_price: addValues.bolt_price !== "" ? Number(addValues.bolt_price) : null,
      pos_price: addValues.pos_price !== "" ? Number(addValues.pos_price) : null,
      sort_order: addValues.sort_order !== "" ? Number(addValues.sort_order) : 0,
      image_url: addValues.image_url?.trim() || null,
      servings: addValues.servings !== "" ? Number(addValues.servings) : null,
      is_active: true,
      foody_pieces_per_unit: 1,
    };
    const { data, error } = await supabase.from("menu_items").insert(payload).select();
    if (!error && data) {
      setItems((prev) => [...prev, ...data]);
      setShowAdd(false);
      setAddValues({ ...EMPTY_ITEM });
    }
    setSaving(false);
  };

  // ── Delete item ──
  const handleDelete = async (id) => {
    setDeleting(true);
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (!error) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setDeleteTarget(null);
      setMobileEditItem(null);
      cancelEdit();
    }
    setDeleting(false);
  };

  // ── Filtered + sorted items ──
  const displayItems = useMemo(() => {
    let filtered = items;
    if (activeCategory !== "All") filtered = filtered.filter((i) => i.category === activeCategory);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((i) => i.canonical_name.toLowerCase().includes(q));
    }
    const sorted = [...filtered];
    if (sortConfig.key === "__default") {
      sorted.sort((a, b) => {
        const catA = CATEGORY_ORDER[a.category] ?? 99;
        const catB = CATEGORY_ORDER[b.category] ?? 99;
        if (catA !== catB) return catA - catB;
        return (b.wolt_price || 0) - (a.wolt_price || 0);
      });
    } else {
      sorted.sort((a, b) => {
        let aVal = a[sortConfig.key], bVal = b[sortConfig.key];
        if (sortConfig.key === "category") { aVal = CATEGORY_ORDER[aVal] ?? 99; bVal = CATEGORY_ORDER[bVal] ?? 99; }
        if (typeof aVal === "string") aVal = aVal.toLowerCase();
        if (typeof bVal === "string") bVal = bVal.toLowerCase();
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [items, activeCategory, search, sortConfig]);

  const handleSort = (key) => {
    if (sortConfig.key === key) setSortConfig({ key, direction: sortConfig.direction === "asc" ? "desc" : "asc" });
    else setSortConfig({ key, direction: "asc" });
  };

  const SortArrow = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <span className="text-neutral-700 ml-1">↕</span>;
    return sortConfig.direction === "asc" ? <span className="text-emerald-500 ml-1">↑</span> : <span className="text-emerald-500 ml-1">↓</span>;
  };

  const categoryCounts = useMemo(() => {
    const counts = { All: items.length };
    CATEGORIES.forEach((c) => { counts[c] = items.filter((i) => i.category === c).length; });
    return counts;
  }, [items]);

  const columns = [
    { key: "canonical_name", label: "Item", align: "left" },
    { key: "category", label: "Category", align: "left" },
    { key: "wolt_price", label: "Wolt", align: "right" },
    { key: "foody_price", label: "Foody", align: "right" },
    { key: "bolt_price", label: "Bolt", align: "right" },
    { key: "pos_price", label: "POS", align: "right" },
    { key: "is_active", label: "Active", align: "center" },
    { key: "__edit", label: "", align: "center", noSort: true },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div><SkeletonBlock className="h-7 w-24 mb-2" /><SkeletonBlock className="h-4 w-72" /></div>
        <div className="flex gap-2">{[...Array(5)].map((_, i) => <SkeletonBlock key={i} className="h-9 w-28 rounded-xl" />)}</div>
        <SkeletonBlock className="h-10 w-64 rounded-xl" />
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-4 border-b border-neutral-800"><SkeletonBlock className="h-3 w-40" /><SkeletonBlock className="h-3 w-24" /><SkeletonBlock className="h-3 flex-1" /><SkeletonBlock className="h-3 w-16" /><SkeletonBlock className="h-3 w-16" /></div>
          {[...Array(8)].map((_, i) => <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-800/50"><SkeletonBlock className="h-4 w-40" /><SkeletonBlock className="h-4 w-24" /><SkeletonBlock className="h-4 flex-1" /><SkeletonBlock className="h-4 w-16" /><SkeletonBlock className="h-5 w-10 rounded-full" /></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Menu</h1>
        <p className="text-sm text-neutral-400 mt-1">Manage menu items, pricing, and availability.</p>
      </div>

      {/* Top Bar */}
      <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddValues({ ...EMPTY_ITEM }); }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
        >
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {["All", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setSortConfig({ key: "__default", direction: "asc" }); cancelEdit(); }}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${activeCategory === cat ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700"}`}
          >
            {cat}{cat === "All" && <span className="ml-1.5 text-neutral-500">({categoryCounts[cat] || 0})</span>}
          </button>
        ))}
      </div>

      {/* ─── Mobile cards ─── */}
      <div className="md:hidden space-y-3">
        {displayItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500 bg-neutral-900 rounded-2xl border border-neutral-800">
            {search.trim() ? "No items match your search" : "No items in this category"}
          </div>
        ) : displayItems.map((item) => {
          const dimmed = !item.is_active;
          const toggling = togglingItems.has(item.id);
          return (
            <div key={item.id} className="bg-neutral-900 rounded-2xl border border-neutral-800 p-4" style={{ opacity: dimmed ? 0.5 : 1 }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-bold text-white">{item.canonical_name}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase" style={{ backgroundColor: `${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Unknown}20`, color: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Unknown }}>{item.category}</span>
                </div>
                <button onClick={() => handleToggleActive(item)} disabled={toggling} className="shrink-0" style={{ opacity: dimmed ? 1 / 0.5 : 1 }}>
                  <div className={`relative w-9 h-5 rounded-full transition-colors ${item.is_active ? "bg-emerald-500" : "bg-neutral-700"}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${item.is_active ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                  </div>
                </button>
              </div>
              {item.description && <p className="text-xs text-neutral-500 mb-2">{item.description}</p>}
              <div className="grid grid-cols-4 gap-2 text-center mb-3">
                {[["Wolt", item.wolt_price], ["Foody", item.foody_price], ["Bolt", item.bolt_price], ["POS", item.pos_price]].map(([lbl, val]) => (
                  <div key={lbl}>
                    <p className="text-[9px] text-neutral-600 uppercase">{lbl}</p>
                    <p className="text-xs font-semibold text-neutral-300">{val != null ? formatPrice(val) : "—"}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => startMobileEdit(item)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => setDeleteTarget(item)} className="px-3 py-2 text-xs text-red-400 hover:text-red-300 bg-neutral-800 hover:bg-red-500/10 rounded-lg transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Desktop table ─── */}
      <div className="hidden md:block bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-neutral-950/50">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className={`px-5 py-3.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${!col.noSort ? "cursor-pointer select-none hover:text-neutral-200 transition-colors" : ""}`} onClick={() => !col.noSort && handleSort(col.key)}>
                    <span className="inline-flex items-center">{col.label}{!col.noSort && <SortArrow columnKey={col.key} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {displayItems.length === 0 ? (
                <tr><td colSpan={columns.length} className="px-6 py-16 text-center"><p className="text-sm text-neutral-500">{search.trim() ? "No items match your search" : "No items in this category"}</p></td></tr>
              ) : displayItems.map((item) => {
                const isEditing = editingId === item.id;
                const discrepancy = hasDeliveryDiscrepancy(item);
                const dimmed = !item.is_active && !isEditing;
                const toggling = togglingItems.has(item.id);

                const priceCell = (val, flagDiff) => {
                  if (val == null) return <span className="text-neutral-600">—</span>;
                  const differs = flagDiff && item.wolt_price != null && val !== item.wolt_price;
                  return <span className={differs ? "text-amber-400 font-semibold" : "text-neutral-300"}>{formatPrice(val)}</span>;
                };

                return (
                  <React.Fragment key={item.id}>
                  <tr className={`hover:bg-neutral-800/20 transition-colors group ${isEditing ? "bg-neutral-800/30" : ""}`} style={{ opacity: dimmed ? 0.45 : 1 }}>
                    {/* Item name */}
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <EditableCell value={editValues.canonical_name} onChange={(v) => setEditValues((p) => ({ ...p, canonical_name: v }))} onSave={saveEdit} placeholder="Item name" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{item.canonical_name}</span>
                          {discrepancy && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Price discrepancy" />}
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <select value={editValues.category} onChange={(e) => setEditValues((p) => ({ ...p, category: e.target.value }))} className="bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-[10px] font-bold text-neutral-200 focus:outline-none uppercase">
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: `${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Unknown}20`, color: CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Unknown }}>{item.category}</span>
                      )}
                    </td>

                    {/* Prices */}
                    {["wolt_price", "foody_price", "bolt_price", "pos_price"].map((key) => (
                      <td key={key} className="px-5 py-3 text-right text-sm">
                        {isEditing ? (
                          <EditableCell type="number" value={editValues[key]} onChange={(v) => setEditValues((p) => ({ ...p, [key]: v }))} onSave={saveEdit} align="right" placeholder="0.00" />
                        ) : (
                          priceCell(item[key], key === "foody_price" || key === "bolt_price")
                        )}
                      </td>
                    ))}

                    {/* Active toggle */}
                    <td className="px-5 py-3 text-center">
                      <button onClick={(e) => { e.stopPropagation(); handleToggleActive(item); }} disabled={toggling} className="inline-flex items-center cursor-pointer disabled:cursor-wait" style={{ opacity: dimmed ? 1 / 0.45 : 1 }}>
                        <div className={`relative w-9 h-5 rounded-full transition-colors ${item.is_active ? "bg-emerald-500" : "bg-neutral-700"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${item.is_active ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                        </div>
                      </button>
                    </td>

                    {/* Edit / Save / Delete */}
                    <td className="px-5 py-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={saveEdit} disabled={saving} className="px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 rounded-lg transition-colors" title="Save">Save</button>
                          <button onClick={cancelEdit} className="px-2 py-1.5 text-xs text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors" title="Cancel">Cancel</button>
                          <button onClick={() => setDeleteTarget(item)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(item)} className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer inline-flex items-center gap-1">
                          <Pencil size={11} /> Edit
                        </button>
                      )}
                    </td>
                  </tr>
                  {isEditing && (
                    <tr className="bg-neutral-800/20">
                      <td colSpan={columns.length} className="px-5 py-3">
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Description</label>
                            <textarea
                              value={editValues.description ?? ""}
                              onChange={(e) => setEditValues((p) => ({ ...p, description: e.target.value }))}
                              rows={2}
                              placeholder="Short description..."
                              className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-sm text-neutral-200 focus:outline-none transition-colors resize-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Sort Order</label>
                            <input
                              type="number"
                              value={editValues.sort_order ?? ""}
                              onChange={(e) => setEditValues((p) => ({ ...p, sort_order: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }}
                              placeholder="0"
                              className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-sm text-neutral-200 focus:outline-none transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Servings</label>
                            <input
                              type="number"
                              value={editValues.servings ?? ""}
                              onChange={(e) => setEditValues((p) => ({ ...p, servings: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }}
                              placeholder="1"
                              className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-sm text-neutral-200 focus:outline-none transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">Image URL</label>
                            <input
                              type="text"
                              value={editValues.image_url ?? ""}
                              onChange={(e) => setEditValues((p) => ({ ...p, image_url: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); }}
                              placeholder="https://..."
                              className="w-full bg-neutral-950 border border-neutral-700 focus:border-emerald-500 rounded-lg px-2 py-1.5 text-sm text-neutral-200 focus:outline-none transition-colors"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Modals ─── */}
      {showAdd && (
        <ItemModal
          title="Add Menu Item"
          values={addValues}
          onChange={(k, v) => setAddValues((p) => ({ ...p, [k]: v }))}
          onSave={saveAdd}
          onCancel={() => setShowAdd(false)}
          saving={saving}
        />
      )}

      {mobileEditItem && (
        <ItemModal
          title="Edit Item"
          values={mobileEditValues}
          onChange={(k, v) => setMobileEditValues((p) => ({ ...p, [k]: v }))}
          onSave={saveMobileEdit}
          onCancel={() => setMobileEditItem(null)}
          onDelete={() => { setDeleteTarget(mobileEditItem); }}
          saving={saving}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.canonical_name}
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
