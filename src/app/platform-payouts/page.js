"use client";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../../lib/supabase";
import SkeletonBlock from "../../components/SkeletonBlock";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Legend
} from "recharts";
import { RefreshCw, Filter, Calendar, Info, FileText, ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { parseISO, subMonths, format } from "date-fns";

const PLATFORM_COLORS = {
  wolt: "#3b82f6",
  foody: "#f59e0b",
  bolt: "#10b981",
};

const EXPENSE_COLORS = {
  net_payout: "#10b981",
  commission: "#ef4444",
  ad_spend: "#f59e0b",
  other_fees: "#737373",
};

const getFormattedDate = (date) => format(date, "MMM dd, yyyy");

const formatCurrency = (val) => {
    if (val === null || val === undefined || val === 0) return "—";
    return `€${Number(val).toFixed(2)}`;
};

export default function PlatformPayoutsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  
  const [platformFilter, setPlatformFilter] = useState("all"); // 'all', 'wolt', 'foody', 'bolt'
  const [dateRange, setDateRange] = useState("3M"); // '1M', '3M', 'All'
  
  const [sortConfig, setSortConfig] = useState({ key: "period_from", direction: "desc" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedPayouts, setExpandedPayouts] = useState({});
  const [chartMode, setChartMode] = useState("net"); // 'net' | 'fee'
  const [visibleRecords, setVisibleRecords] = useState(9);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: payouts, error } = await supabase
        .from("platform_payouts")
        .select("*")
        .order("period_from", { ascending: false })
        .limit(1000);
      
      if (!error && payouts) {
        setData(payouts);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // Reset visible records when filters change
  useEffect(() => { setVisibleRecords(9); }, [platformFilter, dateRange]);

  const filteredData = useMemo(() => {
    if (!data.length) return [];
    
    // Determine the reference date for "3M" and "1M" filtering
    // We'll use the most recent period_from in the data
    let referenceDate = new Date();
    if (data.length > 0 && data[0].period_from) {
        referenceDate = parseISO(data[0].period_from);
    }

    let thresholdDate = null;
    if (dateRange === "1M") thresholdDate = subMonths(referenceDate, 1);
    if (dateRange === "3M") thresholdDate = subMonths(referenceDate, 3);
    
    return data.filter(row => {
        // Date filter
        if (thresholdDate && row.period_from) {
            const rowDate = parseISO(row.period_from);
            if (rowDate < thresholdDate) return false;
        }
        
        // Platform filter
        if (platformFilter !== "all" && row.platform !== platformFilter) {
            return false;
        }
        
        return true;
    });
  }, [data, platformFilter, dateRange]);

  // Last Updated Date
  const lastUpdatedDate = useMemo(() => {
    if (!data.length) return null;
    let latest = data[0].period_to;
    data.forEach(row => {
        if (row.period_to && row.period_to > latest) {
            latest = row.period_to;
        }
    });
    return latest;
  }, [data]);

  // KPI Calculations
  const kpis = useMemo(() => {
    let gross_sales = 0;
    let net_payout = 0;
    let platform_fees = 0;
    
    filteredData.forEach(row => {
        gross_sales += Number(row.gross_sales || 0);
        net_payout += Number(row.net_payout || 0);
        platform_fees += Number(row.commission_total || 0) + Number(row.ad_spend || 0) + Number(row.other_fees || 0);
    });
    
    const effective_fee_pct = gross_sales > 0 ? (platform_fees / gross_sales) * 100 : 0;
    
    return { gross_sales, net_payout, platform_fees, effective_fee_pct };
  }, [filteredData]);

  // Chart 1: Net Payout Over Time (Ignores Platform Filter)
  const lineChartData = useMemo(() => {
    if (!data.length) return [];
    
    // We still apply the dateRange filter, but IGNORE the platformFilter.
    let referenceDate = new Date();
    if (data.length > 0 && data[0].period_from) {
        referenceDate = parseISO(data[0].period_from);
    }

    let thresholdDate = null;
    if (dateRange === "1M") thresholdDate = subMonths(referenceDate, 1);
    if (dateRange === "3M") thresholdDate = subMonths(referenceDate, 3);

    const dateMap = {}; // Group by period_from
    
    data.forEach(row => {
        if (thresholdDate && row.period_from) {
            const rowDate = parseISO(row.period_from);
            if (rowDate < thresholdDate) return;
        }
        
        const dateStr = row.period_from;
        if (!dateMap[dateStr]) {
            dateMap[dateStr] = { period_from: dateStr };
        }
        
        if (row.platform) {
            dateMap[dateStr][row.platform] = Number(row.net_payout || 0);
        }
    });

    return Object.values(dateMap).sort((a, b) => a.period_from.localeCompare(b.period_from));
  }, [data, dateRange]);

  // Chart 1b: Effective Fee % Over Time (same date filtering, ignores platform filter)
  const feeChartData = useMemo(() => {
    if (!data.length) return [];

    let referenceDate = new Date();
    if (data.length > 0 && data[0].period_from) {
        referenceDate = parseISO(data[0].period_from);
    }
    let thresholdDate = null;
    if (dateRange === "1M") thresholdDate = subMonths(referenceDate, 1);
    if (dateRange === "3M") thresholdDate = subMonths(referenceDate, 3);

    const dateMap = {};
    data.forEach(row => {
        if (thresholdDate && row.period_from) {
            if (parseISO(row.period_from) < thresholdDate) return;
        }
        const dateStr = row.period_from;
        if (!dateMap[dateStr]) dateMap[dateStr] = { period_from: dateStr };
        if (row.platform) {
            const gross = Number(row.gross_sales || 0);
            const fees = Number(row.commission_total || 0) + Number(row.ad_spend || 0) + Number(row.other_fees || 0);
            dateMap[dateStr][row.platform] = gross > 0 ? Math.round((fees / gross) * 1000) / 10 : 0;
        }
    });
    return Object.values(dateMap).sort((a, b) => a.period_from.localeCompare(b.period_from));
  }, [data, dateRange]);

  // Chart 2: Fee Breakdown (Donut)
  const donutChartData = useMemo(() => {
      let commission = 0;
      let adSpend = 0;
      let otherFees = 0;
      
      filteredData.forEach(row => {
          commission += Number(row.commission_total || 0);
          adSpend += Number(row.ad_spend || 0);
          otherFees += Number(row.other_fees || 0);
      });
      
      return [
          { name: "Commission", value: commission, color: EXPENSE_COLORS.commission, pct: kpis.gross_sales > 0 ? (commission / kpis.gross_sales) * 100 : 0 },
          { name: "Ad Spend", value: adSpend, color: EXPENSE_COLORS.ad_spend, pct: kpis.gross_sales > 0 ? (adSpend / kpis.gross_sales) * 100 : 0 },
          { name: "Other Fees", value: otherFees, color: EXPENSE_COLORS.other_fees, pct: kpis.gross_sales > 0 ? (otherFees / kpis.gross_sales) * 100 : 0 }
      ].filter(d => d.value > 0);
  }, [filteredData, kpis.gross_sales]);



  // Sortable Table Data
  const sortedTableData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (aVal === null || aVal === undefined) aVal = "";
        if (bVal === null || bVal === undefined) bVal = "";

        if (typeof aVal === "number" && typeof bVal === "number") {
             return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal);
        const bStr = String(bVal);
        
        if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };
  
  const renderSortIcon = (colKey) => {
      if (sortConfig.key !== colKey) return <ArrowUpDown size={14} className="ml-1 inline-block text-neutral-600" />;
      if (sortConfig.direction === "asc") return <ChevronUp size={14} className="ml-1 inline-block text-emerald-500" />;
      return <ChevronDown size={14} className="ml-1 inline-block text-emerald-500" />;
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, payload }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (!payload || payload.pct < 0.1) return null;
    return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold" pointerEvents="none">{`${(payload.pct).toFixed(1)}%`}</text>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <SkeletonBlock className="h-7 w-48 mb-2" />
            <SkeletonBlock className="h-4 w-80" />
          </div>
          <SkeletonBlock className="h-7 w-44 rounded-full" />
        </div>
        {/* Filter bar */}
        <SkeletonBlock className="h-16 w-full rounded-2xl" />
        {/* 4 KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-neutral-900 p-4 md:p-5 rounded-2xl border border-neutral-800">
              <SkeletonBlock className="h-3 w-28 mb-3" />
              <SkeletonBlock className="h-8 w-36 mb-2" />
            </div>
          ))}
        </div>
        {/* 2 charts side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-neutral-900 rounded-2xl border border-neutral-800 p-4 md:p-6 h-[250px] md:h-[400px]">
            <SkeletonBlock className="h-5 w-44 mb-4" />
            <SkeletonBlock className="h-full w-full rounded-xl" />
          </div>
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-4 md:p-6 h-[250px] md:h-[400px]">
            <SkeletonBlock className="h-5 w-32 mb-4" />
            <SkeletonBlock className="h-full w-full rounded-xl" />
          </div>
        </div>
        {/* Payout records header */}
        <SkeletonBlock className="h-6 w-36 mt-6" />
        {/* 6 payout card skeletons in 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-neutral-900 rounded-2xl border border-neutral-800 p-5">
              <div className="flex justify-between mb-4">
                <SkeletonBlock className="h-6 w-16 rounded-full" />
                <SkeletonBlock className="h-4 w-36" />
              </div>
              <SkeletonBlock className="h-px w-full mb-4" />
              <div className="space-y-3">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="flex justify-between">
                    <SkeletonBlock className="h-4 w-24" />
                    <SkeletonBlock className="h-4 w-20" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex items-end justify-between">
        <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Platform Payouts</h1>
            <p className="text-sm text-neutral-400 mt-1">Review net payouts, commissions, and fees from delivery platforms.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-900/50 px-3 py-1.5 rounded-full border border-neutral-800 hidden sm:flex">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            Last updated: {lastUpdatedDate ? getFormattedDate(parseISO(lastUpdatedDate)) : "..."}
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
              <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800 w-fit">
                {["1M", "3M", "All"].map((preset) => (
                  <button key={preset} onClick={() => setDateRange(preset)} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${dateRange === preset ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}>{preset}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Platform</p>
              <div className="flex flex-wrap gap-1.5">
                {["all", "wolt", "foody", "bolt"].map((platform) => (
                  <button key={platform} onClick={() => setPlatformFilter(platform)} className={`capitalize px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors border ${platformFilter === platform ? "bg-emerald-500 text-white border-emerald-500 shadow-sm" : "text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800"}`}>{platform}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Filter Bar */}
      <div className="hidden md:flex bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-lg flex-row items-center justify-between gap-6 filter-pattern">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-500 shrink-0"><Calendar size={18} /><span className="font-semibold text-white text-sm">Date Range</span></div>
            <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                {["1M", "3M", "All"].map((preset) => (
                    <button key={preset} onClick={() => setDateRange(preset)} className={`px-3 py-1 text-[10px] font-medium rounded-md transition-colors ${dateRange === preset ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}>{preset}</button>
                ))}
            </div>
        </div>
        <div className="h-8 w-px bg-neutral-800"></div>
        <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-emerald-500 shrink-0"><Filter size={18} /><span className="font-semibold text-white text-sm">Platform</span></div>
            <div className="flex items-center bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                {["all", "wolt", "foody", "bolt"].map((platform) => (
                    <button key={platform} onClick={() => setPlatformFilter(platform)} className={`capitalize px-3 py-1 text-[10px] font-medium rounded-md transition-colors ${platformFilter === platform ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}>{platform}</button>
                ))}
            </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="bg-neutral-900 p-4 md:p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Gross Sales</p>
                <h3 className="text-xl md:text-3xl font-bold text-white mb-2">€{kpis.gross_sales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
           </div>
           <div className="bg-neutral-900 p-4 md:p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Net Payout</p>
                <h3 className="text-xl md:text-3xl font-bold text-white mb-2 text-emerald-400">€{kpis.net_payout.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
           </div>
           <div className="bg-neutral-900 p-4 md:p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Platform Fees</p>
                <h3 className="text-xl md:text-3xl font-bold text-white mb-2 text-red-400">€{kpis.platform_fees.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
           </div>
           <div className="bg-neutral-900 p-4 md:p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Effective Fee %</p>
                <h3 className="text-xl md:text-3xl font-bold text-white mb-2">{kpis.effective_fee_pct.toFixed(2)}%</h3>
           </div>
      </div>

      {/* Charts Row */}

      {/* Mobile: Tab bar above chart */}
      <div className="md:hidden">
        <div className="flex bg-neutral-900 rounded-xl p-1 border border-neutral-800 mb-4">
          <button onClick={() => setChartMode("net")} className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${chartMode === "net" ? "bg-emerald-500 text-white" : "text-neutral-400"}`}>Net Payout</button>
          <button onClick={() => setChartMode("fee")} className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${chartMode === "fee" ? "bg-emerald-500 text-white" : "text-neutral-400"}`}>Fee %</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-neutral-900 p-4 md:p-6 rounded-2xl border border-neutral-800 shadow-lg h-[250px] md:h-[400px] flex flex-col">
            {/* Desktop: inline toggle */}
            <div className="hidden md:flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-lg font-bold text-white">{chartMode === "net" ? "Net Payout Over Time" : "Effective Fee % Over Time"}</h3>
              <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                <button onClick={() => setChartMode("net")} className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${chartMode === "net" ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}>Net Payout</button>
                <button onClick={() => setChartMode("fee")} className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${chartMode === "fee" ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}>Fee %</button>
              </div>
            </div>
            {/* Mobile: title only */}
            <h3 className="md:hidden text-sm font-bold text-white mb-3 shrink-0">{chartMode === "net" ? "Net Payout Over Time" : "Effective Fee % Over Time"}</h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartMode === "net" ? lineChartData : feeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                        <XAxis dataKey="period_from" fontSize={10} axisLine={false} tickLine={false} stroke="#a3a3a3" />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#737373" tickFormatter={(val) => chartMode === "net" ? `€${val}` : `${val}%`} />
                        <RechartsTooltip cursor={{ fill: '#ffffff', opacity: 0.05 }} content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            return (
                                <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}>
                                    <p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px" }}>{label}</p>
                                    {payload.map((entry, idx) => (
                                        <p key={idx} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", margin: "4px 0" }}>
                                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: entry.color, display: "inline-block" }}></span>
                                            <span style={{ color: "#a3a3a3" }}>{entry.name}:</span>
                                            <span style={{ fontWeight: "600" }}>{chartMode === "net" ? `€${Number(entry.value).toFixed(2)}` : `${Number(entry.value).toFixed(1)}%`}</span>
                                        </p>
                                    ))}
                                </div>
                            );
                        }} />
                        <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                        {(platformFilter === "all" || platformFilter === "wolt") && <Line type="monotone" connectNulls={true} dataKey="wolt" name="Wolt" stroke={PLATFORM_COLORS.wolt} strokeWidth={3} dot={{ r: 3, fill: PLATFORM_COLORS.wolt, strokeWidth: 0 }} activeDot={{ r: 5 }} />}
                        {(platformFilter === "all" || platformFilter === "foody") && <Line type="monotone" connectNulls={true} dataKey="foody" name="Foody" stroke={PLATFORM_COLORS.foody} strokeWidth={3} dot={{ r: 3, fill: PLATFORM_COLORS.foody, strokeWidth: 0 }} activeDot={{ r: 5 }} />}
                        {(platformFilter === "all" || platformFilter === "bolt") && <Line type="monotone" connectNulls={true} dataKey="bolt" name="Bolt" stroke={PLATFORM_COLORS.bolt} strokeWidth={3} dot={{ r: 3, fill: PLATFORM_COLORS.bolt, strokeWidth: 0 }} activeDot={{ r: 5 }} />}
                    </LineChart>
                </ResponsiveContainer>
            </div>
          </div>
          
          {/* Mobile: Compact fee breakdown */}
          <div className="md:hidden bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-3">Fee Breakdown</h3>
            {donutChartData.length === 0 ? (
                <p className="text-sm text-neutral-500">No fee data</p>
            ) : (
                <div>
                    <div className="w-full h-[120px] mb-3">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={donutChartData} cx="50%" cy="50%" innerRadius={25} outerRadius={50} paddingAngle={2} dataKey="value" nameKey="name" labelLine={false}>
                                    {donutChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0)" />)}
                                </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                        {donutChartData.map((entry, idx) => {
                            const total = donutChartData.reduce((s, e) => s + e.value, 0);
                            const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";
                            return (
                                <div key={idx} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-sm shrink-0" style={{backgroundColor: entry.color}}></div>
                                        <span className="text-xs text-neutral-300">{entry.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-white">€{entry.value.toFixed(0)}</span>
                                        <span className="text-[10px] text-neutral-500">{pct}%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
          </div>

          {/* Desktop: Full doughnut */}
          <div className="hidden md:flex bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg h-[400px] flex-col">
            <h3 className="text-lg font-bold text-white mb-4 shrink-0">Fee Breakdown</h3>
            {donutChartData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral-500"><p className="text-sm">No fee data</p></div>
            ) : (
                <div className="flex-1 min-h-0 flex flex-col relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={donutChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" nameKey="name" labelLine={false} label={renderCustomizedLabel}>
                                {donutChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0)" />)}
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
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {donutChartData.map((entry, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-neutral-300">
                                <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: entry.color}}></div>
                                <span>{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </div>
      </div>



      {/* Payout Records */}
      <div className="flex items-center justify-between mb-4 mt-6">
          <h3 className="text-lg font-bold text-white shrink-0">Payout Records</h3>
      </div>
      {/* Mobile: Collapsible payout cards */}
      <div className="md:hidden space-y-3">
          {sortedTableData.length === 0 ? (
              <div className="p-8 text-center text-sm text-neutral-500 bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg">No records found</div>
          ) : sortedTableData.slice(0, visibleRecords).map((row) => {
              const totalFees = (Number(row.commission_total) || 0) + (Number(row.ad_spend) || 0) + (Number(row.other_fees) || 0);
              const isExpanded = expandedPayouts[row.id];
              return (
              <div key={row.id} className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                      {row.platform ? (
                          <span className="inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full capitalize" style={{ backgroundColor: `${PLATFORM_COLORS[row.platform]}1A`, color: PLATFORM_COLORS[row.platform], border: `1px solid ${PLATFORM_COLORS[row.platform]}33` }}>{row.platform}</span>
                      ) : <div></div>}
                      <span className="text-xs text-neutral-400">{row.period_from} → {row.period_to}</span>
                  </div>
                  <div className="h-px bg-neutral-800 w-full mb-3"></div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                          <p className="text-[10px] text-neutral-500 uppercase mb-0.5">Gross</p>
                          <p className="text-sm font-semibold text-white">{formatCurrency(row.gross_sales)}</p>
                      </div>
                      <div>
                          <p className="text-[10px] text-neutral-500 uppercase mb-0.5">Fees</p>
                          <p className="text-sm font-semibold text-red-400">{totalFees > 0 ? `€${totalFees.toFixed(2)}` : "—"}</p>
                          {totalFees > 0 && Number(row.gross_sales) > 0 && <p className="text-[10px] text-red-400/70 mt-0.5">{((totalFees / Number(row.gross_sales)) * 100).toFixed(1)}%</p>}
                      </div>
                      <div>
                          <p className="text-[10px] text-neutral-500 uppercase mb-0.5">Net</p>
                          <p className="text-sm font-bold text-emerald-400">{formatCurrency(row.net_payout)}</p>
                      </div>
                  </div>
                  <button onClick={() => setExpandedPayouts(prev => ({ ...prev, [row.id]: !prev[row.id] }))} className="w-full flex items-center justify-center gap-1 mt-3 pt-2 border-t border-neutral-800/50 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors">
                      {isExpanded ? "Hide details" : "Show details"}
                      <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-neutral-800/50 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                          <div className="text-neutral-500">Commission</div>
                          <div className="text-right text-red-500/90 font-medium">{formatCurrency(row.commission_total)}</div>
                          <div className="text-neutral-500">Ad spend</div>
                          <div className="text-right text-red-500/90 font-medium">{formatCurrency(row.ad_spend)}</div>
                          <div className="text-neutral-500">Other fees</div>
                          <div className="text-right text-red-500/90 font-medium">{formatCurrency(row.other_fees)}</div>
                          {row.invoice_number && (
                              <>
                                  <div className="text-neutral-500 text-xs mt-1">Invoice</div>
                                  <div className="text-right text-xs mt-1"><span className="flex items-center justify-end gap-1.5 text-neutral-400"><FileText size={12}/> {row.invoice_number}</span></div>
                              </>
                          )}
                          {row.notes && (
                              <div className="col-span-2 mt-2 text-xs text-neutral-500">
                                  <span className="block mb-1 font-medium text-neutral-400">Notes</span>
                                  {row.notes}
                              </div>
                          )}
                      </div>
                  )}
              </div>
              );
          })}
          {sortedTableData.length > visibleRecords && (
            <button onClick={() => setVisibleRecords((v) => v + 9)} className="w-full py-3 text-sm font-medium text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-colors">
              Show More ({sortedTableData.length - visibleRecords} remaining)
            </button>
          )}
      </div>

      {/* Desktop: Full payout cards */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTableData.length === 0 ? (
              <div className="col-span-full p-8 text-center text-sm text-neutral-500 bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg">No records found</div>
          ) : sortedTableData.slice(0, visibleRecords).map((row) => (
             <div key={row.id} className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg p-5">
                 <div className="flex items-center justify-between mb-4">
                     {row.platform ? (
                         <span className="inline-block px-3 py-1 text-xs font-bold rounded-full capitalize" style={{ backgroundColor: `${PLATFORM_COLORS[row.platform]}1A`, color: PLATFORM_COLORS[row.platform], border: `1px solid ${PLATFORM_COLORS[row.platform]}33` }}>{row.platform}</span>
                     ) : <div></div>}
                     <span className="text-sm font-medium text-neutral-300">{row.period_from} &rarr; {row.period_to}</span>
                 </div>
                 <div className="h-px bg-neutral-800 w-full mb-4"></div>
                 <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                     <div className="text-neutral-500">Gross sales</div>
                     <div className="text-right text-neutral-200 font-medium">{formatCurrency(row.gross_sales)}</div>
                     <div className="text-neutral-500">Commission</div>
                     <div className="text-right text-red-500/90 font-medium">{formatCurrency(row.commission_total)}</div>
                     <div className="text-neutral-500">Ad spend</div>
                     <div className="text-right text-red-500/90 font-medium">{formatCurrency(row.ad_spend)}</div>
                     <div className="text-neutral-500">Other fees</div>
                     <div className="text-right text-red-500/90 font-medium">{formatCurrency(row.other_fees)}</div>
                     {(() => { const tf = (Number(row.commission_total) || 0) + (Number(row.ad_spend) || 0) + (Number(row.other_fees) || 0); const pct = Number(row.gross_sales) > 0 ? ((tf / Number(row.gross_sales)) * 100).toFixed(1) : "0.0"; return tf > 0 ? (<><div className="text-neutral-500 text-xs mt-1">Total fees</div><div className="text-right mt-1 flex items-center justify-end gap-2"><span className="text-sm font-medium text-red-400">€{tf.toFixed(2)}</span><span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">{pct}%</span></div></>) : null; })()}
                     <div className="text-neutral-500 font-medium mt-1">Net payout</div>
                     <div className="text-right text-emerald-400 font-bold text-lg mt-1">{formatCurrency(row.net_payout)}</div>
                     <div className="text-neutral-500 text-xs mt-2">Invoice</div>
                     <div className="text-right text-neutral-500 text-xs mt-2 flex justify-end">
                         {row.invoice_number ? (
                              <span className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors"><FileText size={14}/> {row.invoice_number}</span>
                         ) : "—"}
                     </div>
                 </div>
                 {row.notes && (
                     <div className="mt-4 pt-3 border-t border-neutral-800/50 text-xs text-neutral-500">
                         <span className="block mb-1 font-medium text-neutral-400">Notes</span>
                         {row.notes}
                     </div>
                 )}
             </div>
          ))}
      </div>
      {sortedTableData.length > visibleRecords && (
        <button onClick={() => setVisibleRecords((v) => v + 9)} className="hidden md:block w-full py-3 text-sm font-medium text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-colors">
          Show More ({sortedTableData.length - visibleRecords} remaining)
        </button>
      )}

    </div>
  );
}
