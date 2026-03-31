"use client";
import { useState, useEffect, useMemo } from "react";
import { Megaphone, Globe, TrendingUp, Facebook, Instagram, Calendar, Users, DollarSign, Layers, RefreshCw, Filter, ChevronDown } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import { supabase } from "@/lib/supabase";
import SkeletonBlock from "@/components/SkeletonBlock";
import { format, parseISO, isAfter, isBefore, getISOWeek, getYear } from "date-fns";

// Helper to format Date objects into YYYY-MM-DD strings
const getFormattedDate = (date) => {
  return date.toISOString().split("T")[0];
};

export default function MarketingPage() {
  // Date Range State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [oldestAvailableDate, setOldestAvailableDate] = useState(null);
  const [latestAvailableDate, setLatestAvailableDate] = useState(null);
  const [activePreset, setActivePreset] = useState(null);

  // Data State
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Chart View State
  const [chartView, setChartView] = useState("daily"); // "daily" or "weekly"
  const [platformFilter, setPlatformFilter] = useState("both"); // "both", "facebook", "instagram"

  // Mobile UI state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeMarketingChart, setActiveMarketingChart] = useState("reach");

  // Reach vs Revenue chart
  const [salesData, setSalesData] = useState([]);

  // Metrics state
  const [totalReach, setTotalReach] = useState(0);
  const [totalAdSpend, setTotalAdSpend] = useState(0);
  const [latestFbFollowers, setLatestFbFollowers] = useState(0);
  const [latestIgFollowers, setLatestIgFollowers] = useState(0);
  const [chartData, setChartData] = useState([]);

  // 1. Initialize logic on first load (find oldest/newest dates)
  useEffect(() => {
    async function initializeDashboard() {
      // Find latest date in social_stats
      const { data: latestStat, error: latestError } = await supabase
        .from("social_stats")
        .select("stat_date")
        .order("stat_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestError || !latestStat) {
          console.error("Couldn't find any latest dates", JSON.stringify(latestError));
          setLoading(false);
          return;
      }

      const latestDateObj = new Date(latestStat.stat_date);
      setLatestAvailableDate(latestDateObj);

      // Find oldest date in social_stats
      const { data: oldestStat } = await supabase
        .from("social_stats")
        .select("stat_date")
        .order("stat_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (oldestStat) {
          setOldestAvailableDate(new Date(oldestStat.stat_date));
      } else {
          setOldestAvailableDate(latestDateObj);
      }

      // Default to 1 Month
      const oneMonthPriorObj = new Date(latestDateObj);
      oneMonthPriorObj.setMonth(latestDateObj.getMonth() - 1);

      const formattedEnd = getFormattedDate(latestDateObj);
      const formattedStart = getFormattedDate(oneMonthPriorObj);

      setEndDate(formattedEnd);
      setStartDate(formattedStart);
      setActivePreset("1M"); 
    }

    initializeDashboard();
  }, []);

  // 2. Fetch stats + sales data when date changes
  useEffect(() => {
    async function fetchStats() {
      if (!startDate || !endDate) return;

      setLoading(true);
      try {
        const endDateTime = `${endDate}T23:59:59.999Z`;
        const [socialRes, posRes, delRes] = await Promise.all([
          supabase
            .from("social_stats")
            .select("*")
            .gte("stat_date", startDate)
            .lte("stat_date", endDateTime)
            .order("stat_date", { ascending: true }),
          supabase
            .from("pos_sales")
            .select("order_placed, price")
            .gte("order_placed", startDate)
            .lte("order_placed", endDateTime)
            .limit(1000),
          supabase
            .from("delivery_purchases")
            .select("order_placed, price, delivery_status")
            .gte("order_placed", startDate)
            .lte("order_placed", endDateTime)
            .limit(1000),
        ]);

        if (socialRes.error) throw socialRes.error;

        setStats(socialRes.data);
        setSalesData([...(posRes.data || []), ...(delRes.data || []).filter(d => d.delivery_status === "delivered")]);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [startDate, endDate]);

  // 3. Process data when stats, chartView, or platform changes
  useEffect(() => {
    if (stats) {
      processData(stats, chartView, platformFilter);
    }
  }, [stats, chartView, platformFilter]);

  const processData = (rawData, viewType, platform) => {
    if (!rawData || rawData.length === 0) {
        setChartData([]);
        setTotalReach(0);
        setTotalAdSpend(0);
        setLatestFbFollowers(0);
        setLatestIgFollowers(0);
        return;
    }

    // Aggregate Metrics over the fetched dataset
    let calculatedReach = 0;
    let calculatedSpend = 0;
    
    // To get the latest follower count, we need the most recent entry for each platform
    let maxFbDate = new Date(0);
    let maxIgDate = new Date(0);
    let currentFbFollowers = 0;
    let currentIgFollowers = 0;

    rawData.forEach(item => {
      // 1. Accumulate totals for cards (always all platforms regardless of filter for reach/spend?
      // Wait, let's filter the cards too!)
      const isMatch = platform === "both" || item.platform === platform;

      if (isMatch) {
         calculatedReach += item.total_reach || 0;
         calculatedSpend += Number(item.ad_spend) || 0;
      }

      const itemDate = parseISO(item.stat_date);
      
      if (item.platform === 'facebook' && isAfter(itemDate, maxFbDate)) {
         maxFbDate = itemDate;
         currentFbFollowers = item.follower_count || 0;
      }
      
      if (item.platform === 'instagram' && isAfter(itemDate, maxIgDate)) {
         maxIgDate = itemDate;
         currentIgFollowers = item.follower_count || 0;
      }
    });

    setTotalReach(calculatedReach);
    setTotalAdSpend(calculatedSpend);
    setLatestFbFollowers(currentFbFollowers);
    setLatestIgFollowers(currentIgFollowers);

    // Prepare Chart Data (Group by Day or Week)
    const groupedDataMap = new Map();

    // To calculate a running total of followers over time for the chart, we iterate chronologically.
    let runningFb = 0;
    let runningIg = 0;

    rawData.forEach(item => {
      const dateObj = parseISO(item.stat_date);
      let groupKey;

      if (viewType === "daily") {
          groupKey = format(dateObj, "MMM dd");
      } else {
          const week = getISOWeek(dateObj);
          const year = getYear(dateObj);
          groupKey = `Week ${week}, ${year}`;
      }
      
      if (!groupedDataMap.has(groupKey)) {
        groupedDataMap.set(groupKey, {
          label: groupKey,
          total_reach: 0,
          ad_spend: 0,
          followers: 0,
          sortDate: dateObj // keep for sorting
        });
      }

      const currentGroup = groupedDataMap.get(groupKey);
      
      // Keep track of latest followers seen so far
      if (item.platform === "facebook") runningFb = item.follower_count || runningFb;
      if (item.platform === "instagram") runningIg = item.follower_count || runningIg;

      // Update the group's follower count to the latest known total at this point in time
      if (platform === "both") currentGroup.followers = runningFb + runningIg;
      else if (platform === "facebook") currentGroup.followers = runningFb;
      else if (platform === "instagram") currentGroup.followers = runningIg;

      // Only add to reach/spend if the platform matches our filter
      const isMatch = platform === "both" || item.platform === platform;
      if (isMatch) {
        currentGroup.total_reach += (item.total_reach || 0);
        currentGroup.ad_spend += (Number(item.ad_spend) || 0);
      }
    });

    // Convert map to array and sort chronologically
    const finalChartData = Array.from(groupedDataMap.values())
      .sort((a, b) => a.sortDate - b.sortDate)
      .map(({ sortDate, ...rest }) => rest);

    setChartData(finalChartData);
  };

  const handleDatePreset = (preset) => {
    const end = new Date();
    const start = new Date();

    switch (preset) {
        case "1M":
            start.setMonth(end.getMonth() - 1);
            break;
        case "3M":
            start.setMonth(end.getMonth() - 3);
            break;
        case "6M":
            start.setMonth(end.getMonth() - 6);
            break;
        case "1Y":
            start.setFullYear(end.getFullYear() - 1);
            break;
        default:
            return;
    }

    setStartDate(getFormattedDate(start));
    setEndDate(getFormattedDate(end));
    setActivePreset(preset);
  };

  // ── Reach vs Revenue combo chart data ──────────────────────────────────
  const comboChartData = useMemo(() => {
    if (!startDate || !endDate || stats.length === 0) return [];

    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    const days = Math.round((endObj - startObj) / 86400000) + 1;
    if (days <= 0 || days > 365) return [];

    // Build daily revenue map from sales data and find the latest sales date
    const revenueMap = {};
    let latestSalesDate = null;
    salesData.forEach((s) => {
      const d = (s.order_placed || "").split("T")[0];
      if (!d) return;
      revenueMap[d] = (revenueMap[d] || 0) + (Number(s.price) || 0);
      if (!latestSalesDate || d > latestSalesDate) latestSalesDate = d;
    });

    // Cap end date to the latest date with sales data
    if (!latestSalesDate) return [];
    const cappedEnd = latestSalesDate < endDate ? new Date(latestSalesDate) : endObj;
    const cappedDays = Math.round((cappedEnd - startObj) / 86400000) + 1;
    if (cappedDays <= 0) return [];

    // Build daily reach map from social stats
    const reachMap = {};
    stats.forEach((s) => {
      const d = (s.stat_date || "").split("T")[0];
      if (!d) return;
      reachMap[d] = (reachMap[d] || 0) + (s.total_reach || 0);
    });

    // Build daily entries up to the latest sales date
    const entries = [];
    const tempD = new Date(startObj);
    for (let i = 0; i < cappedDays; i++) {
      const dateStr = getFormattedDate(tempD);
      entries.push({
        report_date: dateStr,
        label: format(tempD, "MMM dd"),
        revenue: Number((revenueMap[dateStr] || 0).toFixed(2)),
        totalReach: reachMap[dateStr] || 0,
      });
      tempD.setDate(tempD.getDate() + 1);
    }

    // 7-day rolling average
    entries.forEach((entry, idx, arr) => {
      let sumRev = 0, sumReach = 0, count = 0;
      for (let i = Math.max(0, idx - 6); i <= idx; i++) {
        sumRev += arr[i].revenue;
        sumReach += arr[i].totalReach;
        count++;
      }
      entry.smoothedRevenue = Number((sumRev / count).toFixed(2));
      entry.smoothedTotalReach = Math.round(sumReach / count);
    });

    return entries.filter((e) => e.revenue > 0);
  }, [stats, salesData, startDate, endDate]);

  if (loading && !stats.length && !startDate) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <SkeletonBlock className="h-7 w-56 mb-2" />
            <SkeletonBlock className="h-4 w-72" />
          </div>
          <SkeletonBlock className="h-7 w-44 rounded-full" />
        </div>
        {/* Filter bar */}
        <SkeletonBlock className="h-16 w-full rounded-2xl" />
        {/* 4 KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-neutral-900 p-4 md:p-5 rounded-2xl border border-neutral-800">
              <SkeletonBlock className="h-3 w-24 mb-3" />
              <SkeletonBlock className="h-8 w-32 mb-2" />
              <SkeletonBlock className="h-3 w-28" />
            </div>
          ))}
        </div>
        {/* Charts */}
        <SkeletonBlock className="h-[250px] md:h-[300px] w-full rounded-2xl" />
        <SkeletonBlock className="h-[250px] md:h-[300px] w-full rounded-2xl" />
        {/* Bottom chart */}
        <SkeletonBlock className="h-[250px] md:h-[400px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Marketing</h1>
            <p className="text-sm text-neutral-400">
                Campaign performance, reach, and follower insights.
            </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-900/50 px-3 py-1.5 rounded-full border border-neutral-800">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            Last updated: {latestAvailableDate ? format(latestAvailableDate, "MMM dd, yyyy") : "..."}
        </div>
      </div>
      
      {/* Mobile Filter Bar */}
      <div className="md:hidden">
        <button onClick={() => setFiltersOpen(!filtersOpen)} className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg filter-pattern">
          <div className="flex items-center gap-2"><Filter size={16} className="text-emerald-500" /><span className="text-sm font-semibold text-white">Filters</span></div>
          <ChevronDown size={16} className={`text-neutral-400 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
        {filtersOpen && (
          <div className="mt-1 bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3 filter-pattern">
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Date Range</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-500 mb-1 block">From</label>
                  <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setActivePreset(null); }} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 text-xs px-3 py-2 focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 mb-1 block">To</label>
                  <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setActivePreset(null); }} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 text-xs px-3 py-2 focus:outline-none focus:border-emerald-500/50" />
                </div>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Quick Range</p>
              <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800 w-fit">
                {["1M", "3M", "6M", "1Y"].map((preset) => {
                  const targetStart = new Date();
                  switch (preset) { case "1M": targetStart.setMonth(targetStart.getMonth() - 1); break; case "3M": targetStart.setMonth(targetStart.getMonth() - 3); break; case "6M": targetStart.setMonth(targetStart.getMonth() - 6); break; case "1Y": targetStart.setFullYear(targetStart.getFullYear() - 1); break; }
                  const isPresetDisabled = oldestAvailableDate ? (targetStart < oldestAvailableDate) : false;
                  return (<button key={preset} onClick={() => !isPresetDisabled && handleDatePreset(preset)} disabled={isPresetDisabled} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${isPresetDisabled ? "text-neutral-700 cursor-not-allowed bg-transparent" : activePreset === preset ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}>{preset}</button>);
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Platform</p>
              <div className="flex flex-wrap gap-1.5">
                {[{id:"both",label:"Both",active:"bg-neutral-800 text-white border-neutral-700",inactive:"text-neutral-500 border-neutral-800"},{id:"facebook",label:"Facebook",active:"bg-blue-900/40 text-blue-400 border-blue-800/50",inactive:"text-neutral-500 border-neutral-800"},{id:"instagram",label:"Instagram",active:"bg-pink-900/40 text-pink-400 border-pink-800/50",inactive:"text-neutral-500 border-neutral-800"}].map(p => (
                  <button key={p.id} onClick={() => setPlatformFilter(p.id)} className={`text-xs px-2.5 py-1.5 rounded-md font-medium border transition-colors ${platformFilter === p.id ? p.active : p.inactive}`}>{p.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">View</p>
              <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800 w-fit">
                <button onClick={() => setChartView("daily")} className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${chartView === "daily" ? "bg-neutral-800 text-white border-neutral-700 shadow-sm" : "text-neutral-500"}`}>Daily</button>
                <button onClick={() => setChartView("weekly")} className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${chartView === "weekly" ? "bg-neutral-800 text-white border-neutral-700 shadow-sm" : "text-neutral-500"}`}>Weekly</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Filter Bar (unchanged) */}
      <div className="hidden md:flex bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-lg flex-row items-center justify-between gap-6 filter-pattern">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-500 shrink-0"><Calendar size={18} /><span className="font-semibold text-white text-sm">Range</span></div>
            <div className="flex items-center gap-2">
                 <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800 hover:border-emerald-500/50 transition-colors group cursor-pointer">
                    <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setActivePreset(null); }} className="bg-transparent text-neutral-200 text-xs px-2 py-1 focus:outline-none focus:text-white cursor-pointer [color-scheme:dark]" />
                    <span className="text-neutral-600 text-xs">to</span>
                    <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setActivePreset(null); }} className="bg-transparent text-neutral-200 text-xs px-2 py-1 focus:outline-none focus:text-white cursor-pointer [color-scheme:dark]" />
                </div>
                <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                    {["1M", "3M", "6M", "1Y"].map((preset) => {
                        const targetStart = new Date();
                        switch (preset) { case "1M": targetStart.setMonth(targetStart.getMonth() - 1); break; case "3M": targetStart.setMonth(targetStart.getMonth() - 3); break; case "6M": targetStart.setMonth(targetStart.getMonth() - 6); break; case "1Y": targetStart.setFullYear(targetStart.getFullYear() - 1); break; }
                        const isPresetDisabled = oldestAvailableDate ? (targetStart < oldestAvailableDate) : false;
                        return (<button key={preset} onClick={() => !isPresetDisabled && handleDatePreset(preset)} disabled={isPresetDisabled} className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${isPresetDisabled ? "text-neutral-700 cursor-not-allowed bg-transparent" : activePreset === preset ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}>{preset}</button>);
                    })}
                </div>
            </div>
        </div>
        <div className="h-8 w-px bg-neutral-800"></div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-blue-400 shrink-0"><Filter size={18} /><span className="font-semibold text-white text-sm">Platform</span></div>
                <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                    <button onClick={() => setPlatformFilter("both")} className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium border border-transparent ${platformFilter === "both" ? "bg-neutral-800 text-white border-neutral-700 shadow-sm" : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/50"}`}>Both</button>
                    <button onClick={() => setPlatformFilter("facebook")} className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium border border-transparent ${platformFilter === "facebook" ? "bg-blue-900/40 text-blue-400 border-blue-800/50 shadow-sm" : "text-neutral-500 hover:text-blue-400/70 hover:bg-neutral-900/50"}`}>Facebook</button>
                    <button onClick={() => setPlatformFilter("instagram")} className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium border border-transparent ${platformFilter === "instagram" ? "bg-pink-900/40 text-pink-400 border-pink-800/50 shadow-sm" : "text-neutral-500 hover:text-pink-400/70 hover:bg-neutral-900/50"}`}>Instagram</button>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-purple-400 shrink-0"><Layers size={18} /><span className="font-semibold text-white text-sm">View</span></div>
                <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                    <button onClick={() => setChartView("daily")} className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium border border-transparent ${chartView === "daily" ? "bg-neutral-800 text-white border-neutral-700 shadow-sm" : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/50"}`}>Daily</button>
                    <button onClick={() => setChartView("weekly")} className={`text-xs px-3 py-1.5 rounded-md transition-colors font-medium border border-transparent ${chartView === "weekly" ? "bg-neutral-800 text-white border-neutral-700 shadow-sm" : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/50"}`}>Weekly</button>
                </div>
            </div>
        </div>
      </div>
      
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Total Reach */}
          <div className="bg-neutral-900 p-4 md:p-6 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
              <div className="hidden md:block absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Users size={48} className="text-emerald-500" />
              </div>
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Total Reach</p>
              <p className="text-xl md:text-3xl font-bold text-white mt-1">
                  {loading ? "..." : totalReach.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-neutral-500 mt-2">Combined platforms</p>
          </div>

          {/* Total Ad Spend */}
          <div className="bg-neutral-900 p-4 md:p-6 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden group hover:border-blue-600/30 transition-colors">
              <div className="hidden md:block absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <DollarSign size={48} className="text-blue-600" />
              </div>
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Ad Spend</p>
              <p className="text-xl md:text-3xl font-bold text-white mt-1">
                  {loading ? "..." : `€${totalAdSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </p>
              <p className="text-xs text-neutral-500 mt-2">Total budget spent</p>
          </div>

          {/* Facebook Followers */}
          <div className="bg-neutral-900 p-4 md:p-6 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden group hover:border-blue-600/30 transition-colors">
              <div className="hidden md:block absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Facebook size={48} className="text-blue-600" />
              </div>
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Facebook</p>
              <p className="text-xl md:text-3xl font-bold text-white mt-1">
                  {loading ? "..." : latestFbFollowers.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-neutral-500 mt-2">Current Page Likes</p>
          </div>

           {/* Instagram Followers */}
           <div className="bg-neutral-900 p-4 md:p-6 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden group hover:border-pink-500/30 transition-colors">
              <div className="hidden md:block absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Instagram size={48} className="text-pink-500" />
              </div>
              <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider">Instagram</p>
              <p className="text-xl md:text-3xl font-bold text-white mt-1">
                  {loading ? "..." : latestIgFollowers.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-neutral-500 mt-2">Current Followers</p>
          </div>
      </div>

       {/* Mobile: Tabbed charts */}
       <div className="md:hidden">
           <div className="flex bg-neutral-900 rounded-xl p-1 border border-neutral-800 mb-4">
               <button onClick={() => setActiveMarketingChart("reach")} className={`flex-1 px-2 py-2 text-xs font-medium rounded-lg transition-colors ${activeMarketingChart === "reach" ? "bg-emerald-500 text-white" : "text-neutral-400"}`}>Reach</button>
               <button onClick={() => setActiveMarketingChart("adspend")} className={`flex-1 px-2 py-2 text-xs font-medium rounded-lg transition-colors ${activeMarketingChart === "adspend" ? "bg-emerald-500 text-white" : "text-neutral-400"}`}>Ad Spend</button>
               <button onClick={() => setActiveMarketingChart("followers")} className={`flex-1 px-2 py-2 text-xs font-medium rounded-lg transition-colors ${activeMarketingChart === "followers" ? "bg-emerald-500 text-white" : "text-neutral-400"}`}>Followers</button>
           </div>
           <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-lg relative">
               <div className="mb-3">
                   <h3 className="text-sm font-bold text-white">{activeMarketingChart === "reach" ? "Reach History" : activeMarketingChart === "adspend" ? "Ad Spend History" : "Follower History"}</h3>
               </div>
               {loading && <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl"><p className="animate-pulse font-semibold text-emerald-500 flex items-center gap-2"><RefreshCw className="animate-spin"/> Updating...</p></div>}
               {chartData.length === 0 && !loading ? (
                   <div className="h-[200px] flex flex-col items-center justify-center text-center text-neutral-500">
                       <Layers size={32} className="mb-2 opacity-50" />
                       <p className="text-sm font-semibold text-white">No data available</p>
                   </div>
               ) : (
                   <div className="h-[200px]">
                       <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={chartData}>
                               <defs>
                                   <linearGradient id="colorMobileChart" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor={activeMarketingChart === "reach" ? "#10b981" : activeMarketingChart === "adspend" ? "#3b82f6" : "#a855f7"} stopOpacity={0.3}/>
                                       <stop offset="95%" stopColor={activeMarketingChart === "reach" ? "#10b981" : activeMarketingChart === "adspend" ? "#3b82f6" : "#a855f7"} stopOpacity={0}/>
                                   </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                               <XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} stroke="#a3a3a3" />
                               <YAxis fontSize={10} tickLine={false} axisLine={false} stroke="#a3a3a3" tickFormatter={(value) => activeMarketingChart === "adspend" ? `€${value}` : value.toLocaleString()} />
                               <Tooltip cursor={{ fill: '#ffffff', opacity: 0.05 }} content={({ active, payload, label }) => {
                                   if (!active || !payload?.length) return null;
                                   const color = activeMarketingChart === "reach" ? "#10b981" : activeMarketingChart === "adspend" ? "#3b82f6" : "#a855f7";
                                   const name = activeMarketingChart === "reach" ? "Total Reach" : activeMarketingChart === "adspend" ? "Ad Spend" : "Followers";
                                   const val = activeMarketingChart === "adspend" ? `€${Number(payload[0].value).toFixed(2)}` : Number(payload[0].value).toLocaleString();
                                   return (<div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}><p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px" }}>{label}</p><p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: color, display: "inline-block" }}></span><span style={{ color: "#a3a3a3" }}>{name}:</span><span style={{ fontWeight: "600" }}>{val}</span></p></div>);
                               }} />
                               <Area type="monotone" dataKey={activeMarketingChart === "reach" ? "total_reach" : activeMarketingChart === "adspend" ? "ad_spend" : "followers"} stroke={activeMarketingChart === "reach" ? "#10b981" : activeMarketingChart === "adspend" ? "#3b82f6" : "#a855f7"} strokeWidth={2} fillOpacity={1} fill="url(#colorMobileChart)" />
                           </AreaChart>
                       </ResponsiveContainer>
                   </div>
               )}
           </div>
       </div>

       {/* Desktop: Reach Graphs */}
       <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Total Reach History */}
            <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg relative">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                             <Globe size={18} className="text-emerald-500" />
                             Reach History
                        </h3>
                        <p className="text-xs text-neutral-500 capitalize">Cumulative visibility ({chartView})</p>
                    </div>
                </div>
                {loading && <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl"><p className="animate-pulse font-semibold text-emerald-500 flex items-center gap-2"><RefreshCw className="animate-spin"/> Updating...</p></div>}
                
                {chartData.length === 0 && !loading ? (
                    <div className="h-[200px] flex flex-col items-center justify-center text-center text-neutral-500">
                        <Layers size={32} className="mb-2 opacity-50" />
                        <p className="text-sm font-semibold text-white">No data available</p>
                    </div>
                ) : (
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                                <XAxis 
                                    dataKey="label" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    stroke="#a3a3a3" 
                                />
                                <YAxis 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    stroke="#a3a3a3" 
                                    tickFormatter={(value) => value.toLocaleString()}
                                />
                                <Tooltip cursor={{ fill: '#ffffff', opacity: 0.05 }} content={({ active, payload, label }) => {
                                    if (!active || !payload?.length) return null;
                                    return (
                                        <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}>
                                            <p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px" }}>{label}</p>
                                            <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#10b981", display: "inline-block" }}></span>
                                                <span style={{ color: "#a3a3a3" }}>Total Reach:</span>
                                                <span style={{ fontWeight: "600" }}>{Number(payload[0].value).toLocaleString()}</span>
                                            </p>
                                        </div>
                                    );
                                }} />
                                <Area 
                                    type="monotone" 
                                    dataKey="total_reach" 
                                    stroke="#10b981" 
                                    strokeWidth={2}
                                    fillOpacity={1} 
                                    fill="url(#colorReach)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

             {/* Ad Spend History */}
             <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg relative">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                             <Megaphone size={18} className="text-blue-500" />
                             Ad Spend History
                        </h3>
                        <p className="text-xs text-neutral-500 capitalize">Marketing budget utilization ({chartView})</p>
                    </div>
                </div>
                {loading && <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl"><p className="animate-pulse font-semibold text-emerald-500 flex items-center gap-2"><RefreshCw className="animate-spin"/> Updating...</p></div>}

                {chartData.length === 0 && !loading ? (
                    <div className="h-[200px] flex flex-col items-center justify-center text-center text-neutral-500">
                        <Layers size={32} className="mb-2 opacity-50" />
                        <p className="text-sm font-semibold text-white">No data available</p>
                    </div>
                ) : (
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                                <XAxis 
                                    dataKey="label" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    stroke="#a3a3a3" 
                                />
                                <YAxis 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    stroke="#a3a3a3" 
                                    tickFormatter={(value) => `€${value}`}
                                />
                                <Tooltip cursor={{ fill: '#ffffff', opacity: 0.05 }} content={({ active, payload, label }) => {
                                    if (!active || !payload?.length) return null;
                                    return (
                                        <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}>
                                            <p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px" }}>{label}</p>
                                            <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#3b82f6", display: "inline-block" }}></span>
                                                <span style={{ color: "#a3a3a3" }}>Ad Spend:</span>
                                                <span style={{ fontWeight: "600" }}>&euro;{Number(payload[0].value).toFixed(2)}</span>
                                            </p>
                                        </div>
                                    );
                                }} />
                                <Area 
                                    type="monotone" 
                                    dataKey="ad_spend" 
                                    stroke="#3b82f6" 
                                    strokeWidth={2}
                                    fillOpacity={1} 
                                    fill="url(#colorSpend)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

             {/* Follower History */}
             <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg relative lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                             <Users size={18} className="text-purple-500" />
                             Follower History
                        </h3>
                        <p className="text-xs text-neutral-500 capitalize">Audience growth over time ({chartView})</p>
                    </div>
                </div>
                {loading && <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl"><p className="animate-pulse font-semibold text-emerald-500 flex items-center gap-2"><RefreshCw className="animate-spin"/> Updating...</p></div>}

                {chartData.length === 0 && !loading ? (
                    <div className="h-[200px] flex flex-col items-center justify-center text-center text-neutral-500">
                        <Layers size={32} className="mb-2 opacity-50" />
                        <p className="text-sm font-semibold text-white">No data available</p>
                    </div>
                ) : (
                    <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                                <XAxis 
                                    dataKey="label" 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    stroke="#a3a3a3" 
                                />
                                <YAxis 
                                    fontSize={10} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    stroke="#a3a3a3" 
                                    tickFormatter={(value) => value.toLocaleString()}
                                    domain={['auto', 'auto']}
                                />
                                <Tooltip cursor={{ fill: '#ffffff', opacity: 0.05 }} content={({ active, payload, label }) => {
                                    if (!active || !payload?.length) return null;
                                    return (
                                        <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}>
                                            <p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px" }}>{label}</p>
                                            <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#a855f7", display: "inline-block" }}></span>
                                                <span style={{ color: "#a3a3a3" }}>Followers:</span>
                                                <span style={{ fontWeight: "600" }}>{Number(payload[0].value).toLocaleString()}</span>
                                            </p>
                                        </div>
                                    );
                                }} />
                                <Area 
                                    type="monotone" 
                                    dataKey="followers" 
                                    stroke="#a855f7" 
                                    strokeWidth={2}
                                    fillOpacity={1} 
                                    fill="url(#colorFollowers)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>

        {/* Marketing Reach vs Sales Revenue */}
        {comboChartData.length > 0 && (() => {
          const maxRevenue = Math.max(...comboChartData.map(d => d.revenue || 0));
          const revenueDomainMax = Math.ceil(maxRevenue * 1.5);
          return (
          <div className="bg-neutral-900 p-4 md:p-6 rounded-2xl border border-neutral-800 shadow-lg flex flex-col h-[300px] md:h-[400px]">
              <div className="mb-3 md:mb-4 shrink-0">
                  <h3 className="text-sm md:text-lg font-bold text-white mb-1"><span className="md:hidden">Reach vs Revenue</span><span className="hidden md:inline">Marketing Reach vs Sales Revenue</span></h3>
                  <p className="text-xs text-neutral-500">Does your reach drive sales?</p>
              </div>
              <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={comboChartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                          <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} stroke="#a3a3a3" />
                          <YAxis yAxisId="left" fontSize={10} axisLine={false} tickLine={false} stroke="#a3a3a3" tickCount={3} tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val} />
                          <YAxis yAxisId="right" orientation="right" fontSize={10} axisLine={false} tickLine={false} stroke="#eab308" tickFormatter={(val) => `€${val}`} domain={[0, revenueDomainMax]} hide className="hidden md:block" />
                          <Tooltip cursor={{ fill: '#ffffff', opacity: 0.05 }} content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              return (
                                  <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}>
                                      <p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px" }}>{label}</p>
                                      {payload.map((entry, idx) => (
                                          <p key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", margin: "4px 0" }}>
                                              <span style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: entry.color, display: "inline-block" }}></span>
                                              <span style={{ color: "#a3a3a3" }}>{entry.name}:</span>
                                              <span style={{ fontWeight: "600" }}>{entry.name === "Sales Revenue" ? `\u20AC${Number(entry.value).toFixed(2)}` : Number(entry.value).toLocaleString()}</span>
                                          </p>
                                      ))}
                                  </div>
                              );
                          }} />
                          <Legend content={({ payload }) => (
                              <div style={{ display: "flex", justifyContent: "center", gap: "16px", paddingTop: "8px", fontSize: "12px" }}>
                                  {payload.map((entry, idx) => (
                                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                          <span style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: entry.color, display: "inline-block" }}></span>
                                          <span style={{ color: "#a3a3a3" }}>{entry.value}</span>
                                      </div>
                                  ))}
                              </div>
                          )} />
                          <Line yAxisId="left" type="natural" dataKey="totalReach" name="Total Reach" stroke="#8b5cf6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                          <Line yAxisId="right" type="natural" dataKey="revenue" name="Sales Revenue" stroke="#eab308" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          </div>
          );
        })()}

    </div>
  );
}
