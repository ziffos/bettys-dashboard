"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import SkeletonBlock from "../../components/SkeletonBlock";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { 
  Calendar, Filter, RefreshCw, DollarSign, Layers,
  ArrowUpRight, ArrowDownRight, Minus, User, ShoppingBag
} from "lucide-react";
import { parseISO, subDays, differenceInDays, format, getDay, getHours } from "date-fns";

const getFormattedDate = (date) => format(date, "yyyy-MM-dd");

const COLORS = {
    bolt: "#10b981", 
    wolt: "#3b82f6", 
    foody: "#f97316", 
    pos: "#ef4444",   
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activePreset, setActivePreset] = useState("1M");
  const [oldestAvailableDate, setOldestAvailableDate] = useState(null);
  const [lastUpdatedDate, setLastUpdatedDate] = useState(null);
  const [granularity, setGranularity] = useState("daily");
  const [selectedSources, setSelectedSources] = useState({
    pos: true,
    wolt: true,
    bolt: true,
    foody: true,
  });

  const [rawPosData, setRawPosData] = useState([]);
  const [rawDelData, setRawDelData] = useState([]);

  async function fetchAllRows(table, select, filters) {
    const PAGE_SIZE = 1000;
    let allRows = [];
    let from = 0;
    while (true) {
      let query = supabase.from(table).select(select).range(from, from + PAGE_SIZE - 1);
      for (const f of filters) {
        query = query[f.op](f.col, f.val);
      }
      const { data, error } = await query;
      if (error || !data) break;
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allRows;
  }

  async function fetchSalesData(start, end) {
    if (!start || !end) return;
    setLoading(true);

    const startD = parseISO(start);
    const endD = parseISO(end);
    const days = differenceInDays(endD, startD) + 1;
    const prevStartD = subDays(startD, days);

    const prevStartStr = getFormattedDate(prevStartD);
    const endDateTime = `${end}T23:59:59.999Z`;

    const posSales = await fetchAllRows("pos_sales", "order_placed, price", [
      { op: "gte", col: "order_placed", val: prevStartStr },
      { op: "lte", col: "order_placed", val: endDateTime },
    ]);

    const deliveryPurchases = await fetchAllRows("delivery_purchases", "order_placed, price, delivery_partner, delivery_status", [
      { op: "gte", col: "order_placed", val: prevStartStr },
      { op: "lte", col: "order_placed", val: endDateTime },
    ]);

    setRawPosData(posSales);
    setRawDelData(deliveryPurchases);
    setLoading(false);
  }

  useEffect(() => {
    async function initializeDashboard() {
      const { data: latestPos } = await supabase.from("pos_sales").select("order_placed").order("order_placed", { ascending: false }).limit(1).single();
      const { data: latestDel } = await supabase.from("delivery_purchases").select("order_placed").order("order_placed", { ascending: false }).limit(1).single();

      let latestDateObj = new Date();
      let lastSyncObj = null;

      if (latestPos && latestDel) {
        const p = new Date(latestPos.order_placed);
        const d = new Date(latestDel.order_placed);
        latestDateObj = p > d ? p : d;
        // The last fully synced date across all platforms is the minimum of the latest dates
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

      const startObj = new Date(lastSyncObj);
      startObj.setMonth(lastSyncObj.getMonth() - 1);
      
      setEndDate(getFormattedDate(lastSyncObj));
      setStartDate(getFormattedDate(startObj));
      setActivePreset("1M");
    }
    initializeDashboard();
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
        fetchSalesData(startDate, endDate);
    }
  }, [startDate, endDate]);

  const handleSourceToggle = (source) => setSelectedSources(p => ({ ...p, [source]: !p[source] }));
  const handleSelectAll = () => setSelectedSources({ pos: true, wolt: true, bolt: true, foody: true });
  const handleSelectNone = () => setSelectedSources({ pos: false, wolt: false, bolt: false, foody: false });

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
    setActivePreset(preset);
  };

  const processedData = useMemo(() => {
    if (!startDate || !endDate) return null;

    const startObj = parseISO(startDate);
    const endObj = parseISO(endDate);
    endObj.setHours(23, 59, 59, 999);
    
    const startObjMidnight = new Date(startObj);
    startObjMidnight.setHours(0,0,0,0);
    const endObjMidnight = parseISO(endDate);
    endObjMidnight.setHours(0,0,0,0);
    
    const days = differenceInDays(endObjMidnight, startObjMidnight) + 1;
    const prevStartObj = subDays(startObjMidnight, days);

    const isCurrent = (dStr) => {
        const d = parseISO(dStr);
        return d >= startObjMidnight && d <= endObj;
    };
    const isPrev = (dStr) => {
        const d = parseISO(dStr);
        return d >= prevStartObj && d < startObjMidnight;
    };

    let currRev = 0, prevRev = 0;
    let currOrders = 0, prevOrders = 0;
    const currDaysWithOrders = new Set();
    const prevDaysWithOrders = new Set();
    let prevDailyRevMap = {};

    const platforms = {
        pos: { revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 },
        wolt: { revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 },
        foody: { revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 },
        bolt: { revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0 }
    };

    const dailyMap = {};
    const dowMap = { 0: {name:"Sun"}, 1: {name:"Mon"}, 2: {name:"Tue"}, 3: {name:"Wed"}, 4: {name:"Thu"}, 5: {name:"Fri"}, 6: {name:"Sat"} };
    [0,1,2,3,4,5,6].forEach(d => {
        dowMap[d].pos = 0; dowMap[d].wolt = 0; dowMap[d].foody = 0; dowMap[d].bolt = 0; dowMap[d].total = 0;
    });

    const hodMap = {};
    for(let i=0; i<24; i++) {
        hodMap[i] = { name: `${i.toString().padStart(2, '0')}:00`, revenue: 0 };
    }

    const processRecord = (rec, source) => {
        if (!selectedSources[source]) return;
        const dStr = rec.order_placed;
        if (!dStr) return;

        const price = Number(rec.price || 0);
        const parsedDate = parseISO(dStr);
        const dateOnly = format(parsedDate, "yyyy-MM-dd");

        if (isCurrent(dStr)) {
            currRev += price;
            currOrders += 1;
            platforms[source].revenue += price;
            platforms[source].orders += 1;

            currDaysWithOrders.add(dateOnly);
            if (!dailyMap[dateOnly]) {
                dailyMap[dateOnly] = { report_date: dateOnly, pos_sales: 0, wolt_sales: 0, foody_sales: 0, bolt_sales: 0, pos_orders: 0, wolt_orders: 0, foody_orders: 0, bolt_orders: 0 };
            }
            dailyMap[dateOnly][`${source}_sales`] += price;
            dailyMap[dateOnly][`${source}_orders`] += 1;

            const dow = getDay(parsedDate);
            dowMap[dow][source] += price;
            dowMap[dow].total += price;

            const hod = getHours(parsedDate);
            hodMap[hod].revenue += price;

        } else if (isPrev(dStr)) {
            prevRev += price;
            prevOrders += 1;
            platforms[source].prevRevenue += price;
            platforms[source].prevOrders += 1;
            prevDaysWithOrders.add(dateOnly);
            prevDailyRevMap[dateOnly] = (prevDailyRevMap[dateOnly] || 0) + price;
        }
    };

    rawPosData.forEach(r => processRecord(r, 'pos'));
    rawDelData.forEach(r => {
        const partner = (r.delivery_partner || "").toLowerCase();
        const status = (r.delivery_status || "").toLowerCase();
        if (['wolt', 'bolt', 'foody'].includes(partner) && status === 'delivered') {
            processRecord(r, partner);
        }
    });

    const dailyTrend = [];
    if (days > 0 && days <= 365) {
        let tempD = new Date(startObjMidnight);
        
        // Use an object to group data based on selected granularity
        const groupedData = {};

        for(let i = 0; i < days; i++) {
            const dStr = getFormattedDate(tempD);
            if (dailyMap[dStr]) {
                const dayData = dailyMap[dStr];
                
                let groupKey = dStr;
                let displayLabel = dStr;

                if (granularity === "weekly") {
                    // Group by year-week (ISO week)
                    const tempDate = new Date(tempD);
                    const dayNum = tempDate.getUTCDay() || 7;
                    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
                    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(),0,1));
                    const weekNo = Math.ceil((((tempDate - yearStart) / 86400000) + 1)/7);
                    groupKey = `${tempDate.getUTCFullYear()}-W${weekNo}`;
                    // For display, use the start date of the week
                    const startOfWeek = new Date(tempD);
                    const currentDay = startOfWeek.getDay();
                    const diff = startOfWeek.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
                    startOfWeek.setDate(diff);
                    displayLabel = format(startOfWeek, "MMM dd");
                } else if (granularity === "monthly") {
                    // Group by year-month
                    groupKey = format(tempD, "yyyy-MM");
                    displayLabel = format(tempD, "MMM yyyy");
                }

                if (!groupedData[groupKey]) {
                    groupedData[groupKey] = {
                        report_date: displayLabel,
                        pos_sales: 0, wolt_sales: 0, foody_sales: 0, bolt_sales: 0,
                        pos_orders: 0, wolt_orders: 0, foody_orders: 0, bolt_orders: 0
                    };
                }

                groupedData[groupKey].pos_sales += dayData.pos_sales;
                groupedData[groupKey].wolt_sales += dayData.wolt_sales;
                groupedData[groupKey].foody_sales += dayData.foody_sales;
                groupedData[groupKey].bolt_sales += dayData.bolt_sales;
                groupedData[groupKey].pos_orders += dayData.pos_orders;
                groupedData[groupKey].wolt_orders += dayData.wolt_orders;
                groupedData[groupKey].foody_orders += dayData.foody_orders;
                groupedData[groupKey].bolt_orders += dayData.bolt_orders;
            }
            tempD.setDate(tempD.getDate() + 1);
        }

        // Convert the grouped object back to an array
        for (const key in groupedData) {
            dailyTrend.push(groupedData[key]);
        }
    }

    const dowCount = [0,0,0,0,0,0,0];
    let tempD2 = new Date(startObjMidnight);
    for(let i=0; i<days; i++) {
        dowCount[getDay(tempD2)]++;
        tempD2.setDate(tempD2.getDate() + 1);
    }

    const dowIndices = [1, 2, 3, 4, 5, 6, 0];
    const dowChart = dowIndices.map(dow => {
        const d = dowMap[dow];
        const pKeys = ['pos', 'wolt', 'foody', 'bolt'];
        let max = 0; let dom = 'pos';
        pKeys.forEach(x => { if (d[x] > max) { max = d[x]; dom = x; } });
        return { 
            name: d.name, 
            avgRevenue: dowCount[dow] ? Number((d.total / dowCount[dow]).toFixed(2)) : 0, 
            dominant: dom 
        };
    });

    const hodChart = Object.values(hodMap).map(h => ({ name: h.name, revenue: Number(h.revenue.toFixed(2)) })).filter(h => h.revenue > 0);

    const currAOV = currOrders > 0 ? currRev / currOrders : 0;
    const prevAOV = prevOrders > 0 ? prevRev / prevOrders : 0;
    
    const calcChange = (curr, prev) => prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);

    let hasValidPrevPeriod = true;
    if (oldestAvailableDate) {
        const oldestMidnight = new Date(oldestAvailableDate);
        oldestMidnight.setHours(0,0,0,0);
        if (prevStartObj < oldestMidnight) {
            hasValidPrevPeriod = false;
        }
    }

    const currDailyCount = currDaysWithOrders.size;
    const prevDailyCount = prevDaysWithOrders.size;
    const currAvgDailyOrderValue = currDailyCount > 0 ? currRev / currDailyCount : 0;
    const prevAvgDailyOrderValue = prevDailyCount > 0 ? prevRev / prevDailyCount : 0;

    const kpis = {
        revenue: { val: currRev, change: calcChange(currRev, prevRev) },
        orders: { val: currOrders, change: calcChange(currOrders, prevOrders) },
        aov: { val: currAOV, change: calcChange(currAOV, prevAOV) },
        avgDailyOrderValue: { val: currAvgDailyOrderValue, change: calcChange(currAvgDailyOrderValue, prevAvgDailyOrderValue) },
        hasValidPrevPeriod
    };

    const platformTable = Object.entries(platforms)
        .filter(([key]) => selectedSources[key])
        .map(([key, data]) => {
            const share = currRev > 0 ? (data.revenue / currRev) * 100 : 0;
            const aov = data.orders > 0 ? data.revenue / data.orders : 0;
            const change = calcChange(data.revenue, data.prevRevenue);
            return { id: key, name: key === 'pos' ? 'POS' : key.charAt(0).toUpperCase() + key.slice(1), revenue: data.revenue, orders: data.orders, aov, share, change, hasValidPrevPeriod };
        })
        .filter(p => p.orders > 0 || p.revenue > 0)
        .sort((a,b) => b.revenue - a.revenue);

    return { kpis, dailyTrend, dowChart, hodChart, platformTable };
  }, [rawPosData, rawDelData, startDate, endDate, selectedSources, oldestAvailableDate, granularity]);

  const renderTrend = (change) => {
      const isPositive = change > 0;
      const isNegative = change < 0;
      if (isPositive) return <span className="flex items-center gap-1 text-emerald-500 font-bold text-xs"><ArrowUpRight size={14}/> {change.toFixed(1)}%</span>;
      if (isNegative) return <span className="flex items-center gap-1 text-red-500 font-bold text-xs"><ArrowDownRight size={14}/> {Math.abs(change).toFixed(1)}%</span>;
      return <span className="flex items-center gap-1 text-neutral-500 font-bold text-xs"><Minus size={14}/> 0%</span>;
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold" pointerEvents="none">{`${(percent * 100).toFixed(0)}%`}</text>;
  };

  if (loading && (!processedData || processedData.dailyTrend.length === 0)) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <SkeletonBlock className="h-7 w-48 mb-2" />
            <SkeletonBlock className="h-4 w-80" />
          </div>
          <SkeletonBlock className="h-7 w-44 rounded-full" />
        </div>
        {/* Filter bar */}
        <SkeletonBlock className="h-16 w-full rounded-2xl" />
        {/* 4 KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800">
              <SkeletonBlock className="h-3 w-28 mb-3" />
              <SkeletonBlock className="h-8 w-36 mb-3" />
              <SkeletonBlock className="h-4 w-24" />
            </div>
          ))}
        </div>
        {/* 2 charts side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 h-[400px]">
            <SkeletonBlock className="h-5 w-32 mb-4" />
            <SkeletonBlock className="h-full w-full rounded-xl" />
          </div>
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 h-[400px]">
            <SkeletonBlock className="h-5 w-40 mb-4" />
            <SkeletonBlock className="h-full w-full rounded-xl" />
          </div>
        </div>
        {/* Table placeholder */}
        <SkeletonBlock className="h-64 w-full rounded-2xl" />
        {/* 2 bottom charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 h-[350px]">
            <SkeletonBlock className="h-5 w-44 mb-4" />
            <SkeletonBlock className="h-full w-full rounded-xl" />
          </div>
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 h-[350px]">
            <SkeletonBlock className="h-5 w-44 mb-4" />
            <SkeletonBlock className="h-full w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const pd = processedData || { kpis: { revenue:{val:0, change:0}, orders:{val:0, change:0}, aov:{val:0, change:0}, avgDailyOrderValue:{val:0, change:0}, hasValidPrevPeriod: true }, dailyTrend: [], dowChart: [], hodChart: [], platformTable: [] };
  const pieData = pd.platformTable.map(p => ({ name: p.name, value: p.revenue, color: COLORS[p.id] }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Sales Overview</h1>
            <p className="text-sm text-neutral-400 mt-1">Performance metrics, sales breakdown, and insights.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-900/50 px-3 py-1.5 rounded-full border border-neutral-800">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            Last updated: {lastUpdatedDate ? format(parseISO(lastUpdatedDate), "MMM dd, yyyy") : "..."}
        </div>
      </div>

      <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-500 shrink-0"><Calendar size={18} /><span className="font-semibold text-white text-sm">Range</span></div>
            <div className="flex items-center gap-2">
                 <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800 hover:border-emerald-500/50 transition-colors group">
                    <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setActivePreset(null); }} className="bg-transparent text-neutral-200 text-xs px-2 py-1 focus:outline-none focus:text-white cursor-pointer" />
                    <span className="text-neutral-600 text-xs">to</span>
                    <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setActivePreset(null); }} className="bg-transparent text-neutral-200 text-xs px-2 py-1 focus:outline-none focus:text-white cursor-pointer" />
                </div>
                 <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                    {["daily", "weekly", "monthly"].map((g) => (
                        <button key={g} onClick={() => setGranularity(g)}
                            className={`capitalize px-3 py-1 text-[10px] font-medium rounded-md transition-colors ${granularity === g ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}
                        >{g}</button>
                    ))}
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
                                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${isPresetDisabled ? "text-neutral-700 cursor-not-allowed bg-transparent" : activePreset === preset ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}
                            >{preset}</button>
                        );
                    })}
                </div>
            </div>
        </div>
        <div className="hidden md:block h-8 w-px bg-neutral-800"></div>
        <div className="flex flex-wrap items-center gap-4">
             <div className="flex items-center gap-2 text-emerald-500 shrink-0"><Filter size={18} /><span className="font-semibold text-white text-sm">Sources</span></div>
            <div className="flex items-center gap-2">
                {["pos", "wolt", "bolt", "foody"].map((source) => (
                    <button key={source} onClick={() => handleSourceToggle(source)}
                        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border cursor-pointer ${selectedSources[source] ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-neutral-950 border-neutral-800 text-neutral-500'}`}
                    >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedSources[source] ? COLORS[source] : '#525252' }} />
                        <span className="capitalize">{source === 'pos' ? 'POS' : source}</span>
                    </button>
                ))}
            </div>
        </div>
      </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
               <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Revenue</p>
               <h3 className="text-3xl font-bold text-white mb-2">€{pd.kpis.revenue.val.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
               {pd.kpis.hasValidPrevPeriod ? (
                   <div className="flex items-center justify-between">
                       {renderTrend(pd.kpis.revenue.change)}
                       <span className="text-[10px] text-neutral-500">vs prev period</span>
                   </div>
               ) : (
                   <div className="flex items-center justify-between h-[20px]">
                       <span className="text-[10px] text-neutral-500">No prior data to compare</span>
                   </div>
               )}
          </div>
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
               <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Orders</p>
               <h3 className="text-3xl font-bold text-white mb-2">{pd.kpis.orders.val.toLocaleString()}</h3>
               {pd.kpis.hasValidPrevPeriod ? (
                   <div className="flex items-center justify-between">
                       {renderTrend(pd.kpis.orders.change)}
                       <span className="text-[10px] text-neutral-500">vs prev period</span>
                   </div>
               ) : (
                   <div className="flex items-center justify-between h-[20px]">
                       <span className="text-[10px] text-neutral-500">No prior data to compare</span>
                   </div>
               )}
          </div>
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
               <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Avg Order Value</p>
               <h3 className="text-3xl font-bold text-white mb-2">€{pd.kpis.aov.val.toFixed(2)}</h3>
               {pd.kpis.hasValidPrevPeriod ? (
                   <div className="flex items-center justify-between">
                       {renderTrend(pd.kpis.aov.change)}
                       <span className="text-[10px] text-neutral-500">vs prev period</span>
                   </div>
               ) : (
                   <div className="flex items-center justify-between h-[20px]">
                       <span className="text-[10px] text-neutral-500">No prior data to compare</span>
                   </div>
               )}
          </div>
          <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
               <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Avg Daily Order Value</p>
               <h3 className="text-3xl font-bold text-white mb-2">€{pd.kpis.avgDailyOrderValue.val.toFixed(2)}</h3>
               {pd.kpis.hasValidPrevPeriod ? (
                   <div className="flex items-center justify-between">
                       {renderTrend(pd.kpis.avgDailyOrderValue.change)}
                       <span className="text-[10px] text-neutral-500">vs prev period</span>
                   </div>
               ) : (
                   <div className="flex items-center justify-between h-[20px]">
                       <span className="text-[10px] text-neutral-500">No prior data to compare</span>
                   </div>
               )}
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg h-[400px] flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4 shrink-0">Sales Trend</h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pd.dailyTrend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                        <XAxis dataKey="report_date" fontSize={10} axisLine={false} tickLine={false} stroke="#a3a3a3" />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#737373" tickFormatter={(val) => `€${val}`} />
                        <RechartsTooltip cursor={{ fill: '#ffffff', opacity: 0.05 }} content={({ active, payload, label }) => {
                            if (active && payload && payload.length > 0) {
                                const total = payload.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
                                return (
                                    <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}>
                                        <p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px" }}>{label}</p>
                                        {payload.map((entry, idx) => (
                                            <p key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", margin: "4px 0" }}>
                                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: entry.color, display: "inline-block" }}></span>
                                                <span style={{ color: "#a3a3a3" }}>{entry.name}:</span>
                                                <span style={{ fontWeight: "600" }}>€{Number(entry.value).toFixed(2)}</span>
                                            </p>
                                        ))}
                                        <div style={{ borderTop: "1px solid #404040", marginTop: "8px", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "700" }}>
                                            <span style={{ color: "#a3a3a3" }}>Total:</span>
                                            <span>€{total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }} />
                        {selectedSources.pos && <Bar dataKey="pos_sales" stackId="a" fill={COLORS.pos} name="POS" />}
                        {selectedSources.wolt && <Bar dataKey="wolt_sales" stackId="a" fill={COLORS.wolt} name="Wolt" />}
                        {selectedSources.bolt && <Bar dataKey="bolt_sales" stackId="a" fill={COLORS.bolt} name="Bolt" />}
                        {selectedSources.foody && <Bar dataKey="foody_sales" stackId="a" fill={COLORS.foody} name="Foody" radius={[4, 4, 0, 0]} />}
                    </BarChart>
                </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg h-[400px] flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4 shrink-0">Source Distribution</h3>
            {pieData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral-500"><p className="text-sm">No source data</p></div>
            ) : (
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={0} outerRadius={100} paddingAngle={2} dataKey="value" nameKey="name" labelLine={false} label={renderCustomizedLabel}>
                                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0)" />)}
                            </Pie>
                            <RechartsTooltip content={({active, payload}) => {
                                if (active && payload?.[0]) {
                                    const d = payload[0].payload;
                                    return (
                                        <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}>
                                            <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: d.color, display: "inline-block" }}></span>
                                                <span style={{ color: "#a3a3a3" }}>{d.name}:</span>
                                                <span style={{ fontWeight: "600" }}>€{d.value.toFixed(2)}</span>
                                            </p>
                                        </div>
                                    );
                                } return null;
                            }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            )}
          </div>
       </div>

       <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg overflow-hidden">
          <div className="p-6 border-b border-neutral-800">
              <h3 className="text-lg font-bold text-white">Revenue by Platform</h3>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-left">
                  <thead className="bg-neutral-950/50">
                      <tr>
                          <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Platform</th>
                          <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right">Revenue</th>
                          <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right">Orders</th>
                          <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right">AOV</th>
                          <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right">Share</th>
                          <th className="px-6 py-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right">Trend</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                      {pd.platformTable.length === 0 ? (
                          <tr><td colSpan="6" className="px-6 py-8 text-center text-sm text-neutral-500">No data for selected period</td></tr>
                      ) : pd.platformTable.map((p, idx) => (
                          <tr key={p.id} className="hover:bg-neutral-800/20 transition-colors">
                              <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[p.id] }}></div>
                                      <span className="font-bold text-white">{p.name}</span>
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-right text-sm font-medium text-neutral-200">€{p.revenue.toFixed(2)}</td>
                              <td className="px-6 py-4 text-right text-sm font-medium text-neutral-300">{p.orders}</td>
                              <td className="px-6 py-4 text-right text-sm font-medium text-neutral-300">€{p.aov.toFixed(2)}</td>
                              <td className="px-6 py-4 text-right">
                                  <span className="inline-block bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded text-xs">{p.share.toFixed(1)}%</span>
                              </td>
                              <td className="px-6 py-4 flex justify-end">
                                  {p.hasValidPrevPeriod ? renderTrend(p.change) : <span className="text-xs text-neutral-500">-</span>}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg h-[350px] flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 shrink-0">Revenue by Day of Week</h3>
              <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pd.dowChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                          <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} stroke="#a3a3a3" />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#737373" tickFormatter={(val) => `€${val}`} />
                          <RechartsTooltip cursor={{ fill: '#ffffff', opacity: 0.05 }} content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              return (
                                  <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}>
                                      <p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px" }}>{label}</p>
                                      <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: payload[0].color || "#10b981", display: "inline-block" }}></span>
                                          <span style={{ color: "#a3a3a3" }}>Daily Average:</span>
                                          <span style={{ fontWeight: "600" }}>€{Number(payload[0].value).toFixed(2)}</span>
                                      </p>
                                  </div>
                              );
                          }} />
                          <Bar dataKey="avgRevenue" radius={[4, 4, 0, 0]}>
                              {pd.dowChart.map((entry, idx) => (
                                  <Cell key={`cell-${idx}`} fill={COLORS[entry.dominant] || "#ef4444"} />
                              ))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
           </div>

           <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg h-[350px] flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 shrink-0">Revenue by Hour of Day</h3>
              <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={pd.hodChart} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                          <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} stroke="#a3a3a3" interval={3} />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#737373" tickFormatter={(val) => `€${val}`} />
                          <RechartsTooltip cursor={{ fill: '#ffffff', opacity: 0.05 }} content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              return (
                                  <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}>
                                      <p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px" }}>{label}</p>
                                      <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }}></span>
                                          <span style={{ color: "#a3a3a3" }}>Total Revenue:</span>
                                          <span style={{ fontWeight: "600" }}>€{Number(payload[0].value).toFixed(2)}</span>
                                      </p>
                                  </div>
                              );
                          }} />
                          <Bar dataKey="revenue" fill="#10b981" radius={[2, 2, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
           </div>
       </div>

    </div>
  );
}
