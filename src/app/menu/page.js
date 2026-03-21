"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import SkeletonBlock from "../../components/SkeletonBlock";
import { Search, LayoutGrid, Table2, Pencil } from "lucide-react";

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

const formatPrice = (val) =>
  val != null ? `€${Number(val).toFixed(2)}` : null;

export default function MenuPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortConfig, setSortConfig] = useState({
    key: "__default",
    direction: "asc",
  });
  const [togglingItems, setTogglingItems] = useState(new Set());

  // Fetch menu items
  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      const { data, error } = await supabase
        .from("menu_items")
        .select("*");
      if (!error && data) setItems(data);
      setLoading(false);
    }
    fetchItems();
  }, []);

  // Toggle is_active
  const handleToggleActive = async (item) => {
    const name = item.canonical_name;
    const newVal = !item.is_active;

    setTogglingItems((prev) => new Set(prev).add(name));

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.canonical_name === name ? { ...i, is_active: newVal } : i
      )
    );

    const { error } = await supabase
      .from("menu_items")
      .update({ is_active: newVal })
      .eq("canonical_name", name);

    if (error) {
      // Revert
      setItems((prev) =>
        prev.map((i) =>
          i.canonical_name === name ? { ...i, is_active: !newVal } : i
        )
      );
    }

    setTogglingItems((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  };

  // Price discrepancy check (foody or bolt differs from wolt)
  const hasDeliveryDiscrepancy = (item) => {
    const w = item.wolt_price;
    if (w == null) return false;
    if (item.foody_price != null && item.foody_price !== w) return true;
    if (item.bolt_price != null && item.bolt_price !== w) return true;
    return false;
  };


  // Filtered + sorted items
  const displayItems = useMemo(() => {
    let filtered = items;

    // Category filter
    if (activeCategory !== "All") {
      filtered = filtered.filter((i) => i.category === activeCategory);
    }

    // Search filter
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((i) =>
        i.canonical_name.toLowerCase().includes(q)
      );
    }

    // Sort
    const sorted = [...filtered];
    if (sortConfig.key === "__default") {
      // Default: category order asc, then wolt_price desc
      sorted.sort((a, b) => {
        const catA = CATEGORY_ORDER[a.category] ?? 99;
        const catB = CATEGORY_ORDER[b.category] ?? 99;
        if (catA !== catB) return catA - catB;
        return (b.wolt_price || 0) - (a.wolt_price || 0);
      });
    } else {
      sorted.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === "category") {
          aVal = CATEGORY_ORDER[aVal] ?? 99;
          bVal = CATEGORY_ORDER[bVal] ?? 99;
        }

        if (typeof aVal === "string") aVal = aVal.toLowerCase();
        if (typeof bVal === "string") bVal = bVal.toLowerCase();

        // Nulls last
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
    if (sortConfig.key === key) {
      setSortConfig({
        key,
        direction: sortConfig.direction === "asc" ? "desc" : "asc",
      });
    } else {
      setSortConfig({ key, direction: "asc" });
    }
  };

  const SortArrow = ({ columnKey }) => {
    if (sortConfig.key !== columnKey)
      return <span className="text-neutral-700 ml-1">↕</span>;
    return sortConfig.direction === "asc" ? (
      <span className="text-emerald-500 ml-1">↑</span>
    ) : (
      <span className="text-emerald-500 ml-1">↓</span>
    );
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts = { All: items.length };
    CATEGORIES.forEach((c) => {
      counts[c] = items.filter((i) => i.category === c).length;
    });
    return counts;
  }, [items]);

  // Column defs for the table header
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

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <SkeletonBlock className="h-7 w-24 mb-2" />
          <SkeletonBlock className="h-4 w-72" />
        </div>
        {/* Category tabs */}
        <div className="flex gap-2">
          {[...Array(5)].map((_, i) => (
            <SkeletonBlock key={i} className="h-9 w-28 rounded-xl" />
          ))}
        </div>
        {/* Search bar */}
        <SkeletonBlock className="h-10 w-64 rounded-xl" />
        {/* Table */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg overflow-hidden">
          {/* Header row */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-neutral-800">
            <SkeletonBlock className="h-3 w-40" />
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-3 flex-1" />
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-3 w-16" />
          </div>
          {/* 8 content rows */}
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-800/50">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-4 flex-1" />
              <SkeletonBlock className="h-4 w-16" />
              <SkeletonBlock className="h-5 w-10 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Menu</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Manage menu items, pricing, and availability.
        </p>
      </div>

      {/* Top Bar */}
      <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
          />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* View Toggle */}
        <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800 shrink-0">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-500 text-white shadow-sm"
            title="Table view"
          >
            <Table2 size={14} />
            Table
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-neutral-600 cursor-not-allowed"
            disabled
            title="Cards view (coming soon)"
          >
            <LayoutGrid size={14} />
            Cards
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {["All", ...CATEGORIES].map((cat) => {
          const isActive = activeCategory === cat;
          const count = categoryCounts[cat] || 0;
          return (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setSortConfig({ key: "__default", direction: "asc" });
              }}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                isActive
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700"
              }`}
            >
              {cat}
              {cat === "All" && (
                <span className="ml-1.5 text-neutral-500">({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-neutral-950/50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-5 py-3.5 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left"
                    } ${
                      !col.noSort ? "cursor-pointer select-none hover:text-neutral-200 transition-colors" : ""
                    }`}
                    onClick={() => !col.noSort && handleSort(col.key)}
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      {!col.noSort && <SortArrow columnKey={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {displayItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-16 text-center"
                  >
                    <p className="text-sm text-neutral-500">
                      {search.trim()
                        ? "No items match your search"
                        : "No items in this category"}
                    </p>
                  </td>
                </tr>
              ) : (
                displayItems.map((item) => {
                  const discrepancy = hasDeliveryDiscrepancy(item);
                  const dimmed = !item.is_active;
                  const toggling = togglingItems.has(item.canonical_name);

                  const priceCell = (val, flagDiff) => {
                    if (val == null)
                      return (
                        <span className="text-neutral-600">—</span>
                      );
                    const differs =
                      flagDiff &&
                      item.wolt_price != null &&
                      val !== item.wolt_price;
                    return (
                      <span
                        className={
                          differs
                            ? "text-amber-400 font-semibold"
                            : "text-neutral-300"
                        }
                      >
                        {formatPrice(val)}
                      </span>
                    );
                  };

                  return (
                    <tr
                      key={item.canonical_name}
                      className="hover:bg-neutral-800/20 transition-colors group"
                      style={{ opacity: dimmed ? 0.45 : 1 }}
                    >
                      {/* Item name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                            {item.canonical_name}
                          </span>
                          {discrepancy && (
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                              title="Price discrepancy across delivery platforms"
                            />
                          )}
                        </div>
                      </td>

                      {/* Category badge */}
                      <td className="px-5 py-3.5">
                        <span
                          className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            backgroundColor: `${
                              CATEGORY_COLORS[item.category] ||
                              CATEGORY_COLORS.Unknown
                            }20`,
                            color:
                              CATEGORY_COLORS[item.category] ||
                              CATEGORY_COLORS.Unknown,
                          }}
                        >
                          {item.category}
                        </span>
                      </td>


                      {/* Wolt price */}
                      <td className="px-5 py-3.5 text-right text-sm">
                        {priceCell(item.wolt_price, false)}
                      </td>

                      {/* Foody price */}
                      <td className="px-5 py-3.5 text-right text-sm">
                        {priceCell(item.foody_price, true)}
                      </td>

                      {/* Bolt price */}
                      <td className="px-5 py-3.5 text-right text-sm">
                        {priceCell(item.bolt_price, true)}
                      </td>

                      {/* POS price */}
                      <td className="px-5 py-3.5 text-right text-sm">
                        {priceCell(item.pos_price, false)}
                      </td>

                      {/* Active toggle */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(item);
                          }}
                          disabled={toggling}
                          className="inline-flex items-center cursor-pointer disabled:cursor-wait"
                          style={{ opacity: dimmed ? 1 / 0.45 : 1 }}
                          title={
                            item.is_active
                              ? "Click to deactivate"
                              : "Click to activate"
                          }
                        >
                          <div
                            className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
                              item.is_active
                                ? "bg-emerald-500"
                                : "bg-neutral-700"
                            }`}
                          >
                            <div
                              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                                item.is_active
                                  ? "translate-x-[18px]"
                                  : "translate-x-0.5"
                              }`}
                            />
                          </div>
                        </button>
                      </td>

                      {/* Edit link */}
                      <td className="px-5 py-3.5 text-center">
                        <button className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors cursor-default inline-flex items-center gap-1">
                          <Pencil size={11} />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
