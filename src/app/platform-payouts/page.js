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
              <SkeletonBlock className="h-8 w-36 mb-2" />
            </div>
          ))}
        </div>
        {/* 2 charts side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-neutral-900 rounded-2xl border border-neutral-800 p-6 h-[400px]">
            <SkeletonBlock className="h-5 w-44 mb-4" />
            <SkeletonBlock className="h-full w-full rounded-xl" />
          </div>
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 h-[400px]">
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

      <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-500 shrink-0"><Calendar size={18} /><span className="font-semibold text-white text-sm">Date Range</span></div>
            <div className="flex items-center gap-2">
                 <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                    {["1M", "3M", "All"].map((preset) => (
                        <button key={preset} onClick={() => setDateRange(preset)}
                            className={`px-3 py-1 text-[10px] font-medium rounded-md transition-colors ${dateRange === preset ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}
                        >{preset}</button>
                    ))}
                </div>
            </div>
        </div>
        <div className="hidden md:block h-8 w-px bg-neutral-800"></div>
        <div className="flex flex-wrap items-center gap-4">
             <div className="flex items-center gap-2 text-emerald-500 shrink-0"><Filter size={18} /><span className="font-semibold text-white text-sm">Platform</span></div>
            <div className="flex items-center bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                {["all", "wolt", "foody", "bolt"].map((platform) => (
                    <button key={platform} onClick={() => setPlatformFilter(platform)}
                        className={`capitalize px-3 py-1 text-[10px] font-medium rounded-md transition-colors ${platformFilter === platform ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-pointer"}`}
                    >
                        {platform}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Gross Sales</p>
                <h3 className="text-3xl font-bold text-white mb-2">€{kpis.gross_sales.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
           </div>
           <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Net Payout</p>
                <h3 className="text-3xl font-bold text-white mb-2 text-emerald-400">€{kpis.net_payout.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
           </div>
           <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Platform Fees</p>
                <h3 className="text-3xl font-bold text-white mb-2 text-red-400">€{kpis.platform_fees.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
           </div>
           <div className="bg-neutral-900 p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Effective Fee %</p>
                <h3 className="text-3xl font-bold text-white mb-2">{kpis.effective_fee_pct.toFixed(2)}%</h3>
           </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg h-[400px] flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4 shrink-0">Net Payout Over Time</h3>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                        <XAxis dataKey="period_from" fontSize={10} axisLine={false} tickLine={false} stroke="#a3a3a3" />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} stroke="#737373" tickFormatter={(val) => `€${val}`} />
                        <RechartsTooltip cursor={{ fill: '#ffffff', opacity: 0.05 }} content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
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
                                    {payload.length > 1 && (
                                        <div style={{ borderTop: "1px solid #404040", marginTop: "8px", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "700" }}>
                                            <span style={{ color: "#a3a3a3" }}>Total:</span>
                                            <span>€{total.toFixed(2)}</span>
                                        </div>
                                    )}
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
          
          <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 shadow-lg h-[400px] flex flex-col">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedTableData.length === 0 ? (
              <div className="col-span-full p-8 text-center text-sm text-neutral-500 bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg">No records found</div>
          ) : sortedTableData.map((row) => (
             <div key={row.id} className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-lg p-5">
                 <div className="flex items-center justify-between mb-4">
                     {row.platform ? (
                         <span className="inline-block px-3 py-1 text-xs font-bold rounded-full capitalize" style={{ backgroundColor: `${PLATFORM_COLORS[row.platform]}1A`, color: PLATFORM_COLORS[row.platform], border: `1px solid ${PLATFORM_COLORS[row.platform]}33` }}>
                             {row.platform}
                         </span>
                     ) : <div></div>}
                     <span className="text-sm font-medium text-neutral-300">
                         {row.period_from} &rarr; {row.period_to}
                     </span>
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

    </div>
  );
}
