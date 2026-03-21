"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import SkeletonBlock from "../../components/SkeletonBlock";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend
} from "recharts";
import { 
  Calendar, Filter, RefreshCw, ChevronDown, Check, ArrowUpRight, ArrowDownRight, Minus, TrendingUp
} from "lucide-react";
import { parseISO, subDays, differenceInDays, format } from "date-fns";

const CHART_COLORS = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#facc15", // yellow-400
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#fb923c", // orange-400
  "#0ea5e9", // sky-500
  "#f43f5e", // rose-500
];

const getAssignedColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
};

const CATEGORIES = [
  "Fried Chicken Combos", 
  "Burger & Wrap Combos", 
  "Products", 
  "Sides", 
  "Dips", 
  "Drinks"
];

// Consistent colors for categories across the page
const CATEGORY_COLORS = {
  "Fried Chicken Combos": "#facc15", // yellow-400
  "Burger & Wrap Combos": "#fb923c", // orange-400
  "Products": "#ef4444", // red-500
  "Sides": "#10b981", // emerald-500
  "Dips": "#8b5cf6", // violet-500
  "Drinks": "#3b82f6", // blue-500
  "Unknown": "#737373" // neutral-500
};

const getFormattedDate = (date) => format(date, "yyyy-MM-dd");

const CustomTrendTooltip = ({ active, payload, label, setHoveredLine }) => {
    if (active && payload && payload.length) {
        const sorted = [...payload].sort((a, b) => b.value - a.value);
        const total = sorted.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
        return (
            <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5", minWidth: "180px" }} onMouseLeave={() => setHoveredLine(null)}>
                <p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px" }}>{label}</p>
                {sorted.map((entry, index) => (
                    <p
                       key={`item-${index}`}
                       style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", margin: "4px 0", cursor: "default" }}
                       onMouseEnter={() => setHoveredLine(entry.name)}
                    >
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: entry.stroke, display: "inline-block" }}></span>
                        <span style={{ color: "#a3a3a3" }}>{entry.name}:</span>
                        <span style={{ fontWeight: "600" }}>€{Number(entry.value).toFixed(2)}</span>
                    </p>
                ))}
                {sorted.length > 1 && (
                    <div style={{ borderTop: "1px solid #404040", marginTop: "8px", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "700" }}>
                        <span style={{ color: "#a3a3a3" }}>Total:</span>
                        <span>€{total.toFixed(2)}</span>
                    </div>
                )}
            </div>
        );
    }
    return null;
};

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  
  // Date range filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeDatePreset, setActiveDatePreset] = useState("1M");
  const [lastUpdatedDate, setLastUpdatedDate] = useState(null);
  const [oldestAvailableDate, setOldestAvailableDate] = useState(null);

  // Other filters
  const [platformFilter, setPlatformFilter] = useState("All"); // All, wolt, foody, bolt, pos
  const [selectedCategories, setSelectedCategories] = useState(CATEGORIES);
  const [selectedItems, setSelectedItems] = useState([]);
  
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isItemsOpen, setIsItemsOpen] = useState(false);
  const categoryRef = useRef(null);
  const itemsRef = useRef(null);

  // Sorting state for table
  const [sortConfig, setSortConfig] = useState({ key: 'revenue', direction: 'desc' });

  // Chart local state
  const [trendGranularity, setTrendGranularity] = useState("daily"); // "daily" or "weekly"
  const [hoveredLine, setHoveredLine] = useState(null);

  // Raw data state
  const [menuItems, setMenuItems] = useState([]);
  const [rawPosData, setRawPosData] = useState([]);
  const [rawDelData, setRawDelData] = useState([]);
  const [rawPriceHistory, setRawPriceHistory] = useState([]);

  // Fetch initial last updated date and setup defaults
  useEffect(() => {
    async function initializeDashboard() {
      // Find the latest order date across POS and Delivery
      const { data: latestPos } = await supabase.from("pos_sales").select("order_placed").order("order_placed", { ascending: false }).limit(1).single();
      const { data: latestDel } = await supabase.from("delivery_purchases").select("order_placed").order("order_placed", { ascending: false }).limit(1).single();

      let latestDateObj = new Date();
      let lastSyncObj = null;

      if (latestPos && latestDel) {
        const p = new Date(latestPos.order_placed);
        const d = new Date(latestDel.order_placed);
        latestDateObj = p > d ? p : d;
        lastSyncObj = p < d ? p : d;
      } else if (latestPos) {
        latestDateObj = new Date(latestPos.order_placed);
        lastSyncObj = new Date(latestPos.order_placed);
      } else if (latestDel) {
        latestDateObj = new Date(latestDel.order_placed);
        lastSyncObj = new Date(latestDel.order_placed);
      } else {
        setLoading(false);
        return;
      }
      
      setLastUpdatedDate(getFormattedDate(lastSyncObj));

      // Get oldest date bounds
      const { data: oldestPos } = await supabase.from("pos_sales").select("order_placed").order("order_placed", { ascending: true }).limit(1).single();
      const { data: oldestDel } = await supabase.from("delivery_purchases").select("order_placed").order("order_placed", { ascending: true }).limit(1).single();

      let oldestDateObj = new Date(latestDateObj);
      if (oldestPos && oldestDel) {
         const p = new Date(oldestPos.order_placed);
         const d = new Date(oldestDel.order_placed);
         oldestDateObj = p < d ? p : d;
      } else if (oldestPos) {
         oldestDateObj = new Date(oldestPos.order_placed);
      } else if (oldestDel) {
         oldestDateObj = new Date(oldestDel.order_placed);
      }
      setOldestAvailableDate(oldestDateObj);

      // Default date range (1 Month)
      const startObj = new Date(lastSyncObj);
      startObj.setMonth(lastSyncObj.getMonth() - 1);
      
      setEndDate(getFormattedDate(lastSyncObj));
      setStartDate(getFormattedDate(startObj));
      setActiveDatePreset("1M");
      
      // Fetch menu items once
      const { data: itemsData } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_active", true);
        
      setMenuItems(itemsData || []);
      setSelectedItems((itemsData || []).map(item => item.canonical_name)); // Select all initially
    }
    
    initializeDashboard();
  }, []);

  // Fetch sales data when dates change
  useEffect(() => {
    async function fetchSalesData() {
      if (!startDate || !endDate) return;
      setLoading(true);

      const startD = parseISO(startDate);
      const endD = parseISO(endDate);
      const days = differenceInDays(endD, startD) + 1;
      const prevStartD = subDays(startD, days);

      const prevStartStr = getFormattedDate(prevStartD);
      const endDateTime = `${endDate}T23:59:59.999Z`;

      const [{ data: posSales }, { data: deliveryPurchases }, { data: priceHistory }] = await Promise.all([
        supabase
          .from("pos_sales")
          .select("order_placed, items, price")
          .gte("order_placed", prevStartStr)
          .lte("order_placed", endDateTime),
        supabase
          .from("delivery_purchases")
          .select("order_placed, items, price, delivery_partner")
          .gte("order_placed", prevStartStr)
          .lte("order_placed", endDateTime),
        supabase
          .from("menu_item_price_history")
          .select("canonical_name, platform, price, valid_from, valid_to")
      ]);

      setRawPosData(posSales || []);
      setRawDelData(deliveryPurchases || []);
      setRawPriceHistory(priceHistory || []);
      setLoading(false);
    }
    
    fetchSalesData();
  }, [startDate, endDate]);

  // Handle clicking outside custom dropdowns
  useEffect(() => {
    function handleClickOutside(event) {
      if (categoryRef.current && !categoryRef.current.contains(event.target)) {
        setIsCategoryOpen(false);
      }
      if (itemsRef.current && !itemsRef.current.contains(event.target)) {
        setIsItemsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDatePreset = (preset) => {
    const end = lastUpdatedDate ? parseISO(lastUpdatedDate) : new Date();
    const start = lastUpdatedDate ? parseISO(lastUpdatedDate) : new Date();
    switch (preset) {
        case "1M": start.setMonth(end.getMonth() - 1); break;
        case "3M": start.setMonth(end.getMonth() - 3); break;
        case "6M": start.setMonth(end.getMonth() - 6); break;
        case "1Y": start.setFullYear(end.getFullYear() - 1); break;
        default: return;
    }
    setStartDate(getFormattedDate(start));
    setEndDate(getFormattedDate(end));
    setActiveDatePreset(preset);
  };

  const toggleCategory = (cat) => {
    let newCats = [];
    if (selectedCategories.includes(cat)) {
      newCats = selectedCategories.filter(c => c !== cat);
    } else {
      newCats = [...selectedCategories, cat];
    }
    setSelectedCategories(newCats);
    
    // Also toggle all items in this category
    const catItems = menuItems.filter(item => item.category === cat).map(item => item.canonical_name);
    if (!selectedCategories.includes(cat)) {
        // We just added this category, add its items
        setSelectedItems(prev => [...new Set([...prev, ...catItems])]);
    } else {
        // We just removed this category, remove its items
        setSelectedItems(prev => prev.filter(i => !catItems.includes(i)));
    }
  };

  const toggleAllCategories = () => {
    if (selectedCategories.length === CATEGORIES.length) {
      setSelectedCategories([]);
      setSelectedItems([]);
    } else {
      setSelectedCategories(CATEGORIES);
      setSelectedItems(menuItems.map(item => item.canonical_name));
    }
  };

  const toggleItem = (itemName) => {
    setSelectedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(i => i !== itemName) 
        : [...prev, itemName]
    );
  };

  const toggleAllItems = () => {
    // Only toggle items whose categories are selected
    const activeCategoryItems = menuItems
      .filter(item => selectedCategories.includes(item.category))
      .map(item => item.canonical_name);
      
    const allSelected = activeCategoryItems.every(i => selectedItems.includes(i));
    
    if (allSelected) {
      // Remove these category items
      setSelectedItems(prev => prev.filter(i => !activeCategoryItems.includes(i)));
    } else {
      // Add all category items
      setSelectedItems(prev => [...new Set([...prev, ...activeCategoryItems])]);
    }
  };

  // Group active menu items by category for the item filter dropdown
  const parsedItemsGrouped = menuItems
    .filter(item => selectedCategories.includes(item.category))
    .reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

  const activeCategoryItemsCount = Object.values(parsedItemsGrouped).flat().length;
  const currentSelectedItemsInActiveCats = selectedItems.filter(i => 
    Object.values(parsedItemsGrouped).flat().some(item => item.canonical_name === i)
  ).length;

  const processedData = useMemo(() => {
    if (!startDate || !endDate || menuItems.length === 0) return null;

    // Build price history lookup: { "canonical_name::platform" -> [{price, valid_from, valid_to}, ...] }
    // Sorted by valid_from descending for efficient lookup (most recent first)
    const priceHistoryMap = {};
    rawPriceHistory.forEach(ph => {
      const key = `${ph.canonical_name}::${ph.platform}`;
      if (!priceHistoryMap[key]) priceHistoryMap[key] = [];
      priceHistoryMap[key].push({
        price: Number(ph.price),
        validFrom: new Date(ph.valid_from),
        validTo: ph.valid_to ? new Date(ph.valid_to) : null,
      });
    });
    // Sort each array by valid_from descending
    Object.values(priceHistoryMap).forEach(arr =>
      arr.sort((a, b) => b.validFrom - a.validFrom)
    );

    // Get historical price for a given item, platform, and order timestamp
    // Falls back to current menu_items price if no history row matches
    const getHistoricalPrice = (canonicalName, platform, orderDate, fallbackPrice) => {
      const key = `${canonicalName}::${platform}`;
      const history = priceHistoryMap[key];
      if (history) {
        const d = new Date(orderDate);
        for (const entry of history) {
          if (d >= entry.validFrom && (entry.validTo === null || d < entry.validTo)) {
            return entry.price;
          }
        }
      }
      // No matching history row — fall back to current price
      return fallbackPrice;
    };

    const startObj = parseISO(startDate);
    const endObj = parseISO(endDate);
    endObj.setHours(23, 59, 59, 999);
    
    const startObjMidnight = new Date(startObj);
    startObjMidnight.setHours(0,0,0,0);
    const prevStartObj = subDays(startObjMidnight, differenceInDays(endObj, startObjMidnight) + 1);

    const isCurrent = (dStr) => {
        const d = parseISO(dStr);
        return d >= startObjMidnight && d <= endObj;
    };
    const isPrev = (dStr) => {
        const d = parseISO(dStr);
        return d >= prevStartObj && d < startObjMidnight;
    };

    let currItemsSold = 0, prevItemsSold = 0;
    
    // Aggregate by item
    // itemStats will map canonical_name to { quantity, revenue, prevQuantity, prevRevenue, woltCount, foodyCount, boltCount, posCount, category }
    const itemStats = {};
    menuItems.forEach(mi => {
        itemStats[mi.canonical_name] = {
            canonical_name: mi.canonical_name,
            category: mi.category,
            quantity: 0,
            revenue: 0,
            prevQuantity: 0,
            prevRevenue: 0,
            woltCount: 0,
            foodyCount: 0,
            boltCount: 0,
            posCount: 0
        };
    });

    const processOrderLine = (platformStr, itemsStr, isCurr, isPrv, orderDateStr) => {
        if (!itemsStr || (!isCurr && !isPrv)) return;
        const tokens = itemsStr.split(',').map(t => t.trim()).filter(Boolean);
        
        for (const token of tokens) {
            // "2 Betty's Classic" -> qty: 2, name: "Betty's Classic"
            const match = token.match(/^(\d+)\s+(.+)$/);
            if (!match) continue; // Skip unparseable
            
            const qty = parseInt(match[1], 10);
            const rawName = match[2].trim();
            
            // Look up the canonical item using the platform-specific name
            const platformKey = platformStr === 'pos' ? 'pos_name' : `${platformStr}_name`;
            const priceKey = platformStr === 'pos' ? 'pos_price' : `${platformStr}_price`;
            
            const matchedItem = menuItems.find(mi => mi[platformKey] === rawName);
            if (!matchedItem) continue; // Silently skip if no match
            
            // Check filters (only applies if the token matches category AND item filters)
            if (!selectedCategories.includes(matchedItem.category)) continue;
            if (!selectedItems.includes(matchedItem.canonical_name)) continue;
            
            const fallbackPrice = matchedItem[priceKey] || 0;
            const itemPrice = getHistoricalPrice(matchedItem.canonical_name, platformStr, orderDateStr, fallbackPrice);
            const revenue = qty * itemPrice;
            const cannon = matchedItem.canonical_name;

            if (isCurr) {
                currItemsSold += qty;
                itemStats[cannon].quantity += qty;
                itemStats[cannon].revenue += revenue;
                itemStats[cannon][`${platformStr}Count`] += qty;
                
                if (orderDateStr) {
                    const orderDate = new Date(orderDateStr);
                    let groupKey;
                    if (trendGranularity === "weekly") {
                        const targetDate = new Date(orderDate);
                        const dayNum = targetDate.getDay();
                        const diff = targetDate.getDate() - dayNum + (dayNum === 0 ? -6 : 1);
                        targetDate.setDate(diff);
                        targetDate.setHours(0,0,0,0);
                        groupKey = getFormattedDate(targetDate);
                    } else {
                        groupKey = getFormattedDate(orderDate);
                    }
                    if (timelineGroups[groupKey]) {
                        timelineGroups[groupKey][cannon] = (timelineGroups[groupKey][cannon] || 0) + revenue;
                    }
                }
            } else if (isPrv) {
                prevItemsSold += qty;
                itemStats[cannon].prevQuantity += qty;
                itemStats[cannon].prevRevenue += revenue;
            }
        }
    };

    // Filter by platform logic applied here
    // Timeline aggregation for Trend Chart
    const timelineGroups = {}; // Key: YYYY-MM-DD or YYYY-Wxx, Value: total revenue

    const timelineStartDate = new Date(startObjMidnight);
    
    // Pre-fill timeline to ensure continuous data points even if zero revenue
    let tempD = new Date(timelineStartDate);
    const dayCount = differenceInDays(endObj, timelineStartDate) + 1;
    for(let i = 0; i < dayCount; i++) {
        let groupKey;
        let displayLabel;

        if (trendGranularity === "weekly") {
            const targetDate = new Date(tempD);
            // Get Monday of the week
            const dayNum = targetDate.getDay();
            const diff = targetDate.getDate() - dayNum + (dayNum === 0 ? -6 : 1);
            targetDate.setDate(diff);
            targetDate.setHours(0,0,0,0);
            
            groupKey = getFormattedDate(targetDate);
            displayLabel = format(targetDate, "MMM dd");
        } else {
            groupKey = getFormattedDate(tempD);
            displayLabel = getFormattedDate(tempD);
        }

        if (!timelineGroups[groupKey]) {
            timelineGroups[groupKey] = {
                report_date: groupKey,
                label: displayLabel,
                revenue: 0
            };
        }
        
        tempD.setDate(tempD.getDate() + 1);
    }

    rawPosData.forEach(r => {
        if (platformFilter !== "All" && platformFilter !== "pos") return;
        processOrderLine('pos', r.items, isCurrent(r.order_placed), isPrev(r.order_placed), r.order_placed);
    });

    rawDelData.forEach(r => {
        const partner = (r.delivery_partner || "").toLowerCase();
        if (platformFilter !== "All" && platformFilter !== partner) return;
        if (['wolt', 'bolt', 'foody'].includes(partner)) {
            processOrderLine(partner, r.items, isCurrent(r.order_placed), isPrev(r.order_placed), r.order_placed);
        }
    });

    // Best and Slowest Seller calculation (exclude Sides, Dips, Drinks)
    const validItemsForSellerCalc = Object.values(itemStats).filter(
        i => !['Sides', 'Dips', 'Drinks'].includes(i.category) && i.revenue > 0
    );

    let bestSeller = null;
    let slowestMover = null;

    if (validItemsForSellerCalc.length > 0) {
        validItemsForSellerCalc.sort((a,b) => b.revenue - a.revenue);
        bestSeller = validItemsForSellerCalc[0];
        // Slowest mover should be minimum revenue > 0
        const slowestItems = [...validItemsForSellerCalc].sort((a,b) => a.revenue - b.revenue);
        slowestMover = slowestItems[0];
    }

    const calcChange = (curr, prev) => prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);
    
    let hasValidPrevPeriod = true;
    if (oldestAvailableDate) {
        const oldestMidnight = new Date(oldestAvailableDate);
        oldestMidnight.setHours(0,0,0,0);
        if (prevStartObj < oldestMidnight) {
            hasValidPrevPeriod = false;
        }
    }

    const totalSoldChange = calcChange(currItemsSold, prevItemsSold);

    // Top items chart: top 10 ranked by total revenue
    const chartData = Object.values(itemStats)
        .filter(i => i.revenue > 0)
        .sort((a,b) => b.revenue - a.revenue)
        .slice(0, 10);

    const rawTimelineData = Object.values(timelineGroups)
        .sort((a, b) => new Date(a.report_date) - new Date(b.report_date));
        
    const top5TrendItems = chartData.slice(0, 5).map(i => i.canonical_name);

    // Exclude dates where no items were sold (for the top 5 tracked items)
    const timelineData = rawTimelineData
        .filter(d => top5TrendItems.some(item => (d[item] || 0) > 0))
        .map(d => {
            const row = { ...d };
            top5TrendItems.forEach(item => {
                row[item] = row[item] || 0;
            });
            return row;
        });

    const daysSelected = differenceInDays(endObj, startObjMidnight) + 1;
    const isTimelineTooShortForWeekly = trendGranularity === 'weekly' && daysSelected < 4;
    const hasTimelineData = timelineData.length > 0;

    // Platform table
    const tableData = Object.values(itemStats)
        .filter(i => i.quantity > 0 || i.prevQuantity > 0)
        .map(i => {
            return {
                ...i,
                totalOrders: i.quantity,
                trend: calcChange(i.quantity, i.prevQuantity)
            };
        });

    return {
        kpis: {
            totalSold: { val: currItemsSold, change: totalSoldChange },
            bestSeller: bestSeller ? { name: bestSeller.canonical_name, val: bestSeller.revenue } : null,
            slowestMover: slowestMover ? { name: slowestMover.canonical_name, val: slowestMover.revenue } : null,
            hasValidPrevPeriod
        },
        chartData,
        tableData,
        trend: {
            data: timelineData,
            isTooShort: isTimelineTooShortForWeekly,
            hasData: hasTimelineData,
            topItems: top5TrendItems
        }
    };
  }, [rawPosData, rawDelData, rawPriceHistory, menuItems, startDate, endDate, platformFilter, selectedCategories, selectedItems, oldestAvailableDate, trendGranularity]);

  const sortedTableData = useMemo(() => {
     if (!processedData?.tableData) return [];
     const sortableItems = [...processedData.tableData];
     if (sortConfig !== null) {
         sortableItems.sort((a, b) => {
             let aVal = a[sortConfig.key];
             let bVal = b[sortConfig.key];
             
             if (typeof aVal === 'string') aVal = aVal.toLowerCase();
             if (typeof bVal === 'string') bVal = bVal.toLowerCase();
             
             if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
             if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
             return 0;
         });
     }
     return sortableItems;
  }, [processedData, sortConfig]);

  const requestSort = (key) => {
      let direction = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const renderTrend = (change) => {
      const isPositive = change > 0;
      const isNegative = change < 0;
      if (isPositive) return <span className="flex items-center gap-1 text-emerald-500 font-bold text-xs"><ArrowUpRight size={14}/> {change.toFixed(1)}%</span>;
      if (isNegative) return <span className="flex items-center gap-1 text-red-500 font-bold text-xs"><ArrowDownRight size={14}/> {Math.abs(change).toFixed(1)}%</span>;
      return <span className="flex items-center gap-1 text-neutral-500 font-bold text-xs"><Minus size={14}/> 0%</span>;
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig?.key !== columnKey) return <span className="text-neutral-600 ml-1">↕</span>;
    return sortConfig.direction === 'asc' 
        ? <span className="text-emerald-500 ml-1">↑</span> 
        : <span className="text-emerald-500 ml-1">↓</span>;
  };

  const pd = processedData || { kpis: null, chartData: [], tableData: [] };

  if (loading && rawPosData.length === 0 && rawDelData.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <SkeletonBlock className="h-7 w-52 mb-2" />
            <SkeletonBlock className="h-4 w-72" />
          </div>
          <SkeletonBlock className="h-7 w-44 rounded-full" />
        </div>
        {/* Filter bar */}
        <SkeletonBlock className="h-16 w-full rounded-2xl" />
        {/* 3 KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800">
              <SkeletonBlock className="h-3 w-28 mb-3" />
              <SkeletonBlock className="h-8 w-36 mb-3" />
              <SkeletonBlock className="h-4 w-24" />
            </div>
          ))}
        </div>
        {/* 2 charts side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 h-[500px]">
            <SkeletonBlock className="h-5 w-40 mb-4" />
            <SkeletonBlock className="h-full w-full rounded-xl" />
          </div>
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 h-[500px]">
            <SkeletonBlock className="h-5 w-36 mb-4" />
            <SkeletonBlock className="h-full w-full rounded-xl" />
          </div>
        </div>
        {/* Table skeleton */}
        <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
          <div className="p-4 border-b border-neutral-800">
            <SkeletonBlock className="h-5 w-36" />
          </div>
          {/* Header row */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-neutral-800">
            {[...Array(6)].map((_, i) => (
              <SkeletonBlock key={i} className="h-3 w-20 flex-1" />
            ))}
          </div>
          {/* 8 content rows */}
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-800/50">
              {[...Array(6)].map((_, j) => (
                <SkeletonBlock key={j} className="h-4 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Products Overview</h1>
            <p className="text-sm text-neutral-400 mt-1">Item-level performance analysis, best sellers, and sales breakdown.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-900/50 px-3 py-1.5 rounded-full border border-neutral-800">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            Last updated: {lastUpdatedDate ? format(parseISO(lastUpdatedDate), "MMM dd, yyyy") : "..."}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        
        {/* Left: Date Range */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-500 shrink-0"><Calendar size={18} /><span className="font-semibold text-white text-sm">Range</span></div>
            <div className="flex items-center gap-2">
                 <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800 hover:border-emerald-500/50 transition-colors group">
                    <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setActiveDatePreset(null); }} className="bg-transparent text-neutral-200 text-xs px-2 py-1 focus:outline-none focus:text-white cursor-pointer" />
                    <span className="text-neutral-600 text-xs">to</span>
                    <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setActiveDatePreset(null); }} className="bg-transparent text-neutral-200 text-xs px-2 py-1 focus:outline-none focus:text-white cursor-pointer" />
                </div>
                <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                    {["1M", "3M", "6M", "1Y"].map((preset) => {
                        const targetStart = lastUpdatedDate ? parseISO(lastUpdatedDate) : new Date();
                        switch (preset) {
                            case "1M": targetStart.setMonth(targetStart.getMonth() - 1); break;
                            case "3M": targetStart.setMonth(targetStart.getMonth() - 3); break;
                            case "6M": targetStart.setMonth(targetStart.getMonth() - 6); break;
                            case "1Y": targetStart.setFullYear(targetStart.getFullYear() - 1); break;
                        }
                        const isPresetDisabled = oldestAvailableDate ? (targetStart < oldestAvailableDate) : false;
                        return (
                            <button key={preset} onClick={() => !isPresetDisabled && handleDatePreset(preset)} disabled={isPresetDisabled}
                                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${isPresetDisabled ? "text-neutral-700 cursor-not-allowed bg-transparent" : activeDatePreset === preset ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}
                            >{preset}</button>
                        );
                    })}
                </div>
            </div>
        </div>

        <div className="hidden xl:block h-8 w-px bg-neutral-800"></div>
        
        {/* Right: Dimension Filters */}
        <div className="flex flex-wrap lg:flex-nowrap items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-500 shrink-0"><Filter size={18} /><span className="font-semibold text-white text-sm">Filters</span></div>
            
            {/* Platform Filter (Toggle) */}
            <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800 shrink-0">
                {["All", "wolt", "foody", "bolt", "pos"].map((p) => (
                    <button key={p} onClick={() => setPlatformFilter(p)}
                        className={`capitalize px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${platformFilter === p ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}
                    >{p === "pos" ? "POS" : p}</button>
                ))}
            </div>

            {/* Category Multi-select Dropdown */}
            <div className="relative shrink-0" ref={categoryRef}>
                <button 
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  className="flex items-center justify-between gap-2 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-300 w-44 transition-colors"
                >
                  <span className="truncate">
                    {selectedCategories.length === CATEGORIES.length 
                        ? "All categories" 
                        : `${selectedCategories.length} categories`}
                  </span>
                  <ChevronDown size={14} className="text-neutral-500" />
                </button>
                
                {isCategoryOpen && (
                  <div className="absolute top-10 right-0 z-50 w-56 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-neutral-800 flex justify-between items-center">
                        <span className="text-xs font-semibold text-neutral-400">Categories</span>
                        <button onClick={toggleAllCategories} className="text-xs text-emerald-500 hover:text-emerald-400 font-medium">
                            {selectedCategories.length === CATEGORIES.length ? "Deselect All" : "Select All"}
                        </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1">
                        {CATEGORIES.map(cat => (
                           <label key={cat} onClick={() => toggleCategory(cat)} className="flex items-center gap-3 px-2 py-2 hover:bg-neutral-800 rounded-lg cursor-pointer transition-colors group text-sm">
                             <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${selectedCategories.includes(cat) ? "bg-emerald-500 border-emerald-500" : "bg-neutral-950 border-neutral-700 flex-shrink-0"}`}>
                               {selectedCategories.includes(cat) && <Check size={12} className="text-white" strokeWidth={3} />}
                             </div>
                             <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: CATEGORY_COLORS[cat]}}></div>
                             <span className="text-neutral-300 group-hover:text-white flex-1 truncate">{cat}</span>
                           </label>
                        ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Items Multi-select Dropdown */}
            <div className="relative shrink-0" ref={itemsRef}>
                <button 
                  onClick={() => setIsItemsOpen(!isItemsOpen)}
                  disabled={activeCategoryItemsCount === 0}
                  className={`flex items-center justify-between gap-2 bg-neutral-950 border border-neutral-800 px-3 py-1.5 rounded-lg text-xs font-medium w-36 transition-colors ${activeCategoryItemsCount === 0 ? "opacity-50 cursor-not-allowed text-neutral-500" : "text-neutral-300 hover:border-neutral-700"}`}
                >
                  <span className="truncate">
                    Items ({currentSelectedItemsInActiveCats})
                  </span>
                  <ChevronDown size={14} className="text-neutral-500" />
                </button>
                
                {isItemsOpen && activeCategoryItemsCount > 0 && (
                  <div className="absolute top-10 right-0 z-50 w-64 bg-neutral-900 border border-neutral-800 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-neutral-800 flex justify-between items-center">
                        <span className="text-xs font-semibold text-neutral-400">Menu Items</span>
                        <button onClick={toggleAllItems} className="text-xs text-emerald-500 hover:text-emerald-400 font-medium">
                            {currentSelectedItemsInActiveCats === activeCategoryItemsCount ? "Deselect All" : "Select All"}
                        </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto p-1">
                        {CATEGORIES.filter(cat => parsedItemsGrouped[cat]).map(cat => (
                            <div key={cat} className="mb-2 last:mb-0">
                                <div className="px-2 py-1.5 text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2 sticky top-0 bg-neutral-900/90 backdrop-blur-sm z-10">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: CATEGORY_COLORS[cat]}}></div>
                                    {cat}
                                </div>
                                {parsedItemsGrouped[cat].map(item => (
                                   <label key={item.canonical_name} onClick={() => toggleItem(item.canonical_name)} className="flex items-center gap-3 px-2 py-1.5 hover:bg-neutral-800 rounded-lg cursor-pointer transition-colors group text-sm ml-2">
                                     <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${selectedItems.includes(item.canonical_name) ? "bg-emerald-500 border-emerald-500" : "bg-neutral-950 border-neutral-700 mx-0 flex-shrink-0"}`}>
                                       {selectedItems.includes(item.canonical_name) && <Check size={12} className="text-white" strokeWidth={3} />}
                                     </div>
                                     <span className="text-neutral-300 group-hover:text-white flex-1 truncate">{item.canonical_name}</span>
                                   </label>
                                ))}
                            </div>
                        ))}
                    </div>
                  </div>
                )}
            </div>

        </div>
      </div>

      {/* KPI Row */}
      {pd.kpis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total items sold</p>
                <h3 className="text-3xl font-bold text-white mb-2">{pd.kpis.totalSold.val.toLocaleString()}</h3>
                {pd.kpis.hasValidPrevPeriod ? (
                    <div className="flex items-center justify-between">
                        {renderTrend(pd.kpis.totalSold.change)}
                        <span className="text-[10px] text-neutral-500">vs prev period</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-between h-[20px]">
                        <span className="text-[10px] text-neutral-500">No prior data to compare</span>
                    </div>
                )}
            </div>
            
            <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Best seller</p>
                {pd.kpis.bestSeller ? (
                    <>
                        <h3 className="text-xl font-bold text-white mb-1 truncate" title={pd.kpis.bestSeller.name}>{pd.kpis.bestSeller.name}</h3>
                        <div className="flex items-center justify-between mt-auto">
                            <span className="text-sm font-medium text-emerald-400">€{pd.kpis.bestSeller.val.toFixed(2)}</span>
                            <span className="text-[10px] text-neutral-500">Excl. sides/drinks</span>
                        </div>
                    </>
                ) : (
                    <h3 className="text-lg font-bold text-neutral-600 mb-2">No valid sales</h3>
                )}
            </div>

            <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Slowest mover</p>
                {pd.kpis.slowestMover ? (
                    <>
                        <h3 className="text-xl font-bold text-white mb-1 truncate" title={pd.kpis.slowestMover.name}>{pd.kpis.slowestMover.name}</h3>
                        <div className="flex items-center justify-between mt-auto">
                            <span className="text-sm font-medium text-red-400">€{pd.kpis.slowestMover.val.toFixed(2)}</span>
                            <span className="text-[10px] text-neutral-500">Excl. sides/drinks</span>
                        </div>
                    </>
                ) : (
                    <h3 className="text-lg font-bold text-neutral-600 mb-2">No valid sales</h3>
                )}
            </div>
          </div>
      )}

      {/* Top Items Chart (Horizontal Bar Code) */}
      <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg flex flex-col h-[450px]">
         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 shrink-0 gap-4">
             <h3 className="text-lg font-bold text-white">Revenue by item <span className="text-sm font-medium text-neutral-500 ml-2">(Top 10)</span></h3>
             
             {/* Legend */}
             <div className="flex flex-wrap items-center gap-3">
                 {CATEGORIES.filter(c => selectedCategories.includes(c)).map(cat => (
                     <div key={cat} className="flex items-center gap-1.5 opacity-80">
                         <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: CATEGORY_COLORS[cat]}}></div>
                         <span className="text-[10px] font-medium text-neutral-400">{cat}</span>
                     </div>
                 ))}
             </div>
         </div>
         <div className="flex-1 min-h-0">
             {pd.chartData.length === 0 ? (
                 <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
                     <p>No orders found for the selected filters</p>
                 </div>
             ) : (
                 <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={pd.chartData} layout="vertical" margin={{ top: 0, right: 30, left: 100, bottom: 0 }}>
                         <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#262626" />
                         <XAxis type="number" fontSize={10} axisLine={false} tickLine={false} stroke="#a3a3a3" tickFormatter={(val) => `€${val}`} />
                         <YAxis dataKey="canonical_name" type="category" width={120} fontSize={11} axisLine={false} tickLine={false} stroke="#d4d4d4" tick={{ fill: '#d4d4d4' }} />
                         <RechartsTooltip cursor={{ fill: '#ffffff', opacity: 0.05 }} content={({ active, payload, label }) => {
                             if (!active || !payload?.length) return null;
                             return (
                                 <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}>
                                     <p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px", fontWeight: "bold" }}>{label}</p>
                                     <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                                         <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: payload[0].color || "#10b981", display: "inline-block" }}></span>
                                         <span style={{ color: "#a3a3a3" }}>Revenue:</span>
                                         <span style={{ fontWeight: "600" }}>€{Number(payload[0].value).toFixed(2)}</span>
                                     </p>
                                 </div>
                             );
                         }} />
                         <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={30}>
                             {pd.chartData.map((entry, idx) => (
                                 <Cell key={`cell-${idx}`} fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.Unknown} />
                             ))}
                         </Bar>
                     </BarChart>
                 </ResponsiveContainer>
             )}
         </div>
      </div>

      {/* Revenue Trend Line Chart */}
      <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg flex flex-col h-[400px]">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 shrink-0 gap-4">
              <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><TrendingUp size={20} className="text-emerald-500"/> Revenue trend</h3>
                  <p className="text-xs text-neutral-500 mt-1">Total revenue over time for selected filters</p>
              </div>
              
              <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                  {["daily", "weekly"].map((g) => (
                      <button key={g} onClick={() => setTrendGranularity(g)}
                          className={`capitalize px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${trendGranularity === g ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}
                      >{g}</button>
                  ))}
              </div>
          </div>

          <div className="flex-1 min-h-0 relative">
              {pd.trend?.isTooShort ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
                      <p>Select a wider date range to see weekly data</p>
                  </div>
              ) : !pd.trend?.hasData ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500">
                      <p>No revenue data for the selected filters</p>
                  </div>
              ) : (
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={pd.trend.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} onMouseLeave={() => setHoveredLine(null)}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                          <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} stroke="#a3a3a3" />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#737373" tickFormatter={(val) => `€${val}`} />
                          <RechartsTooltip 
                              cursor={{ stroke: '#525252', strokeWidth: 1, strokeDasharray: '3 3' }} 
                              content={<CustomTrendTooltip setHoveredLine={setHoveredLine} />}
                          />
                          <Legend 
                              verticalAlign="bottom" 
                              height={36} 
                              iconType="circle"
                              wrapperStyle={{ fontSize: '11px', color: '#a3a3a3', paddingTop: '10px' }}
                              onMouseEnter={(e) => setHoveredLine(e.dataKey)}
                              onMouseLeave={() => setHoveredLine(null)}
                          />
                          {pd.trend.topItems.map((item) => {
                               const color = getAssignedColor(item);
                               const opacity = hoveredLine && hoveredLine !== item ? 0.2 : 1;
                               return (
                                   <Line 
                                      key={item} 
                                      type="monotone" 
                                      dataKey={item} 
                                      name={item}
                                      stroke={color} 
                                      strokeWidth={Math.max(2, opacity * 3)} 
                                      strokeOpacity={opacity}
                                      dot={false}
                                      activeDot={{ r: 4, fill: color, strokeOpacity: 1 }}
                                      onMouseEnter={() => setHoveredLine(item)}
                                   />
                               );
                          })}
                      </LineChart>
                  </ResponsiveContainer>
             )}
          </div>
      </div>

      {/* Platform Breakdown Table */}
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg overflow-hidden flex flex-col">
          <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Items Platform Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-neutral-950/50">
                      <tr>
                          <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider cursor-pointer select-none hover:text-white group" onClick={() => requestSort('canonical_name')}>
                              Item <SortIcon columnKey="canonical_name" />
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider cursor-pointer select-none hover:text-white group" onClick={() => requestSort('category')}>
                              Category <SortIcon columnKey="category" />
                          </th>
                          <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-right ${platformFilter !== 'All' && platformFilter !== 'wolt' ? 'text-neutral-700' : 'text-neutral-400 cursor-pointer hover:text-white group'}`} onClick={() => platformFilter === 'All' || platformFilter === 'wolt' ? requestSort('woltCount') : null}>
                              Wolt {(platformFilter === 'All' || platformFilter === 'wolt') && <SortIcon columnKey="woltCount" />}
                          </th>
                          <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-right ${platformFilter !== 'All' && platformFilter !== 'foody' ? 'text-neutral-700' : 'text-neutral-400 cursor-pointer hover:text-white group'}`} onClick={() => platformFilter === 'All' || platformFilter === 'foody' ? requestSort('foodyCount') : null}>
                              Foody {(platformFilter === 'All' || platformFilter === 'foody') && <SortIcon columnKey="foodyCount" />}
                          </th>
                          <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-right ${platformFilter !== 'All' && platformFilter !== 'bolt' ? 'text-neutral-700' : 'text-neutral-400 cursor-pointer hover:text-white group'}`} onClick={() => platformFilter === 'All' || platformFilter === 'bolt' ? requestSort('boltCount') : null}>
                              Bolt {(platformFilter === 'All' || platformFilter === 'bolt') && <SortIcon columnKey="boltCount" />}
                          </th>
                          <th className={`px-6 py-4 text-xs font-semibold uppercase tracking-wider text-right ${platformFilter !== 'All' && platformFilter !== 'pos' ? 'text-neutral-700' : 'text-neutral-400 cursor-pointer hover:text-white group'}`} onClick={() => platformFilter === 'All' || platformFilter === 'pos' ? requestSort('posCount') : null}>
                              POS {(platformFilter === 'All' || platformFilter === 'pos') && <SortIcon columnKey="posCount" />}
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right cursor-pointer select-none hover:text-white group border-l border-neutral-800" onClick={() => requestSort('totalOrders')}>
                              Total orders <SortIcon columnKey="totalOrders" />
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right cursor-pointer select-none hover:text-white group" onClick={() => requestSort('revenue')}>
                              Revenue (€) <SortIcon columnKey="revenue" />
                          </th>
                          <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right cursor-pointer select-none hover:text-white group" onClick={() => requestSort('trend')}>
                              Trend <SortIcon columnKey="trend" />
                          </th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                      {sortedTableData.length === 0 ? (
                          <tr><td colSpan="9" className="px-6 py-12 text-center text-sm text-neutral-500">No orders found for the selected filters</td></tr>
                      ) : sortedTableData.map((row, idx) => {
                          const isWoltGrey = platformFilter !== 'All' && platformFilter !== 'wolt';
                          const isFoodyGrey = platformFilter !== 'All' && platformFilter !== 'foody';
                          const isBoltGrey = platformFilter !== 'All' && platformFilter !== 'bolt';
                          const isPosGrey = platformFilter !== 'All' && platformFilter !== 'pos';
                          
                          return (
                              <tr key={`${row.canonical_name}-${idx}`} className="hover:bg-neutral-800/20 transition-colors group">
                                  <td className="px-6 py-3 font-medium text-white text-sm">
                                      {row.canonical_name}
                                  </td>
                                  <td className="px-6 py-3">
                                      <div className="flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[row.category] || CATEGORY_COLORS.Unknown }}></div>
                                          <span className="text-xs text-neutral-400 truncate max-w-[120px]" title={row.category}>{row.category}</span>
                                      </div>
                                  </td>
                                  <td className={`px-6 py-3 text-right text-sm ${isWoltGrey ? 'text-neutral-700' : 'text-neutral-300'}`}>
                                      {row.woltCount > 0 ? row.woltCount : '-'}
                                  </td>
                                  <td className={`px-6 py-3 text-right text-sm ${isFoodyGrey ? 'text-neutral-700' : 'text-neutral-300'}`}>
                                      {row.foodyCount > 0 ? row.foodyCount : '-'}
                                  </td>
                                  <td className={`px-6 py-3 text-right text-sm ${isBoltGrey ? 'text-neutral-700' : 'text-neutral-300'}`}>
                                      {row.boltCount > 0 ? row.boltCount : '-'}
                                  </td>
                                  <td className={`px-6 py-3 text-right text-sm ${isPosGrey ? 'text-neutral-700' : 'text-neutral-300'}`}>
                                      {row.posCount > 0 ? row.posCount : '-'}
                                  </td>
                                  <td className="px-6 py-3 text-right text-sm font-bold text-white border-l border-neutral-800">
                                      {row.totalOrders}
                                  </td>
                                  <td className="px-6 py-3 text-right text-sm font-medium text-emerald-400">
                                      €{row.revenue.toFixed(2)}
                                  </td>
                                  <td className="px-6 py-3 flex justify-end">
                                      {pd.kpis?.hasValidPrevPeriod ? renderTrend(row.trend) : <span className="text-xs text-neutral-500">-</span>}
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>
      
    </div>
  );
}
