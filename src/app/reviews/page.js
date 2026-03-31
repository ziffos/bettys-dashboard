"use client";
import { useState, useEffect } from "react";
import {
  Star,
  Search,
  Calendar,
  RefreshCw,
  MessageSquareOff,
  TrendingUp,
  TrendingDown,
  Minus,
  Utensils,
  Filter,
  ChevronDown
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import SkeletonBlock from "@/components/SkeletonBlock";
import { format, parseISO, isAfter, isBefore, subMonths, startOfMonth, startOfWeek, addWeeks, differenceInDays } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

// Helper to format Date objects into YYYY-MM-DD strings
const getFormattedDate = (date) => {
  return date.toISOString().split("T")[0];
};

export default function ReviewsPage() {
  // Data State
  const [originalReviews, setOriginalReviews] = useState([]);
  const [filteredReviews, setFilteredReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Filter State
  const [platformFilter, setPlatformFilter] = useState("all"); // all, google, wolt, foody, bolt
  const [starFilter, setStarFilter] = useState("all"); // all, 5, 4, 3, 2, 1
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activePreset, setActivePreset] = useState("1M");
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [oldestAvailableDate, setOldestAvailableDate] = useState(null);

  // 1. Fetch Data
  useEffect(() => {
    async function fetchReviews() {
        setLoading(true);
        try {
            // Fetch reviews
            const { data: reviewsData, error: reviewsError } = await supabase
                .from("reviews")
                .select("*")
                .order("review_date", { ascending: false });
                
            if (reviewsError) throw reviewsError;
            
            if (reviewsData.length > 0) {
                setLastUpdated(new Date(reviewsData[0].review_date));
                setOldestAvailableDate(new Date(reviewsData[reviewsData.length - 1].review_date));
            } else {
                setLastUpdated(new Date());
                setOldestAvailableDate(new Date());
            }

            // Default dates to 1M
            const end = new Date();
            const start = new Date();
            start.setMonth(end.getMonth() - 1);
            setEndDate(getFormattedDate(end));
            setStartDate(getFormattedDate(start));

            // Extract order_references to find ordered items
            const activeOrderRefs = reviewsData
              .map(r => r.order_reference)
              .filter(ref => ref != null && ref !== '');
            
            const itemMap = {};
            if (activeOrderRefs.length > 0) {
               // Fetch delivery_purchases for the items column
               // Chunking might be needed for thousands, but let's assume standard payload amounts for MVP
               const { data: purchasesData, error: purchasesError } = await supabase
                  .from("delivery_purchases")
                  .select("order_reference, items")
                  .in("order_reference", activeOrderRefs);

               if (!purchasesError && purchasesData) {
                  purchasesData.forEach(p => {
                      if (p.order_reference) {
                          itemMap[p.order_reference] = p.items;
                      }
                  });
               }
            }

            // Augment reviews with items
            const enriched = reviewsData.map(r => ({
                ...r,
                items: r.order_reference ? itemMap[r.order_reference] || null : null
            }));

            setOriginalReviews(enriched);
            setFilteredReviews(enriched); // Default

        } catch (error) {
            console.error("Error fetching reviews:", error);
        } finally {
            setLoading(false);
        }
    }

    fetchReviews();
  }, []);

  // 2. Apply Filters
  useEffect(() => {
    if (!originalReviews.length) return;

    let result = originalReviews;

    // Platform Filter
    if (platformFilter !== "all") {
        result = result.filter(r => r.source_platform?.toLowerCase() === platformFilter);
    }

    // Star Filter
    if (starFilter !== "all") {
        result = result.filter(r => r.rating === Number(starFilter));
    }

    // Date Range Filter
    if (startDate && endDate) {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        // Set end time to end of day to include the full day
        end.setHours(23, 59, 59, 999);
        
        result = result.filter(r => {
            if (!r.review_date) return false;
            const rDate = parseISO(r.review_date);
            return (isAfter(rDate, start) || rDate.getTime() === start.getTime()) && 
                   (isBefore(rDate, end) || rDate.getTime() === end.getTime());
        });
    }

    // Search Query
    if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        result = result.filter(r => 
            (r.review_text && r.review_text.toLowerCase().includes(query)) ||
            (r.reviewer_name && r.reviewer_name.toLowerCase().includes(query))
        );
    }

    setFilteredReviews(result);
  }, [originalReviews, platformFilter, starFilter, startDate, endDate, searchQuery]);


  // Helper for rendering presets
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

  // Helper to calculate card stats
  const calculateCardStats = (platform) => {
    let relevantReviews = originalReviews;
    if (startDate && endDate) {
       const start = parseISO(startDate);
       const end = parseISO(endDate);
       end.setHours(23, 59, 59, 999);
       relevantReviews = relevantReviews.filter(r => {
           if (!r.review_date) return false;
           const d = parseISO(r.review_date);
           return (isAfter(d, start) || d.getTime() === start.getTime()) && 
                  (isBefore(d, end) || d.getTime() === end.getTime());
       });
    }

    if (platform !== "all") {
        relevantReviews = relevantReviews.filter(r => r.source_platform?.toLowerCase() === platform);
    }

    const total = relevantReviews.length;
    const avg = total > 0 ? (relevantReviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1) : "0.0";

    // Trend: compare current month vs last month based on lastUpdated
    let trend = 0;
    if (lastUpdated) {
        const currentMonthStart = startOfMonth(lastUpdated);
        const lastMonthStart = subMonths(currentMonthStart, 1);
        
        const currentMonthReviews = originalReviews.filter(r => {
            if (platform !== "all" && r.source_platform?.toLowerCase() !== platform) return false;
            if (!r.review_date) return false;
            const d = parseISO(r.review_date);
            return d >= currentMonthStart;
        });
        const lastMonthReviews = originalReviews.filter(r => {
             if (platform !== "all" && r.source_platform?.toLowerCase() !== platform) return false;
             if (!r.review_date) return false;
             const d = parseISO(r.review_date);
             return d >= lastMonthStart && d < currentMonthStart;
        });

        const currAvg = currentMonthReviews.length > 0 ? currentMonthReviews.reduce((sum, r) => sum + r.rating, 0) / currentMonthReviews.length : 0;
        const lastAvg = lastMonthReviews.length > 0 ? lastMonthReviews.reduce((sum, r) => sum + r.rating, 0) / lastMonthReviews.length : 0;

        if (lastAvg > 0) {
            trend = (currAvg - lastAvg).toFixed(1);
        } else if (currAvg > 0) {
            trend = currAvg.toFixed(1); // if no previous data, trend is just the current average
        }
    }

    return { total, avg, trend: parseFloat(trend) };
  };

  const ratingBreakdown = [5, 4, 3, 2, 1].map(star => {
      const count = filteredReviews.filter(r => r.rating === star).length;
      return { star, count, percentage: filteredReviews.length ? (count / filteredReviews.length) * 100 : 0 };
  });

  const getChartData = () => {
      if (!startDate || !endDate) return [];

      const rangeStart = parseISO(startDate);
      const rangeEnd = parseISO(endDate);
      rangeEnd.setHours(23, 59, 59, 999);

      // Need at least 7 days for weekly data
      if (differenceInDays(rangeEnd, rangeStart) < 7) return [];

      const data = [];
      let weekStart = startOfWeek(rangeStart, { weekStartsOn: 1 }); // Monday

      while (weekStart < rangeEnd) {
          const weekEnd = addWeeks(weekStart, 1);
          const weekLabel = format(weekStart, "MMM dd");

          let weekReviews = originalReviews.filter(r => {
              if (!r.review_date) return false;
              const rd = parseISO(r.review_date);
              return rd >= weekStart && rd < weekEnd;
          });

          if (platformFilter !== "all") {
              weekReviews = weekReviews.filter(r => r.source_platform?.toLowerCase() === platformFilter);
          }

          const dataPoint = { name: weekLabel };
          if (weekReviews.length > 0) {
              dataPoint.rating = Number((weekReviews.reduce((sum, r) => sum + r.rating, 0) / weekReviews.length).toFixed(1));
          }

          data.push(dataPoint);
          weekStart = weekEnd;
      }
      return data;
  };

  const getChartLineColor = () => {
      if (platformFilter === "google") return "#ef4444";
      if (platformFilter === "wolt") return "#3b82f6";
      if (platformFilter === "foody") return "#f97316";
      if (platformFilter === "bolt") return "#10b981";
      return "#10b981"; // all — emerald
  };

  const getPlatformDetails = (pName) => {
      const lower = pName ? pName.toLowerCase() : "";
      if (lower === "google") return { border: "border-l-red-500", text: "text-red-500", bg: "bg-red-500/10" };
      if (lower === "wolt") return { border: "border-l-blue-500", text: "text-blue-500", bg: "bg-blue-500/10" };
      if (lower === "foody") return { border: "border-l-orange-500", text: "text-orange-500", bg: "bg-orange-500/10" };
      if (lower === "bolt") return { border: "border-l-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/10" };
      return { border: "border-l-neutral-500", text: "text-neutral-500", bg: "bg-neutral-500/10" };
  };

  const platformsConfig = [
    { id: "all", name: "Overall", icon: Star, color: "text-white", bg: "bg-neutral-800" },
    { id: "google", name: "Google", icon: Star, color: "text-red-500", bg: "bg-red-500/10" },
    { id: "wolt", name: "Wolt", icon: Star, color: "text-blue-500", bg: "bg-blue-500/10" },
    { id: "foody", name: "Foody", icon: Star, color: "text-orange-500", bg: "bg-orange-500/10" },
    { id: "bolt", name: "Bolt", icon: Star, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  if (loading && !originalReviews.length) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <SkeletonBlock className="h-7 w-52 mb-2" />
            <SkeletonBlock className="h-4 w-80" />
          </div>
          <SkeletonBlock className="h-7 w-44 rounded-full" />
        </div>
        {/* 5 platform rating cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-neutral-900 p-4 md:p-5 rounded-2xl border border-neutral-800">
              <div className="flex justify-between items-start mb-3">
                <SkeletonBlock className="h-4 w-16" />
                <SkeletonBlock className="h-8 w-8 rounded-lg" />
              </div>
              <SkeletonBlock className="h-10 w-16 mb-2" />
              <SkeletonBlock className="h-3 w-20 mb-4" />
              <SkeletonBlock className="h-3 w-full" />
            </div>
          ))}
        </div>
        {/* Filter bar */}
        <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
          <div className="flex flex-wrap gap-4">
            <SkeletonBlock className="h-10 w-96 rounded-xl" />
            <SkeletonBlock className="h-10 w-64 rounded-xl" />
          </div>
        </div>
        {/* Main area: feed + stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: 3 review card skeletons */}
          <div className="lg:col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-neutral-900 rounded-2xl border border-neutral-800 p-5 border-l-4 border-l-neutral-700">
                <div className="flex justify-between mb-3">
                  <div>
                    <SkeletonBlock className="h-4 w-32 mb-2" />
                    <SkeletonBlock className="h-3 w-40" />
                  </div>
                  <SkeletonBlock className="h-5 w-16 rounded" />
                </div>
                <SkeletonBlock className="h-3 w-24 mb-3" />
                <SkeletonBlock className="h-4 w-full mb-2" />
                <SkeletonBlock className="h-4 w-3/4" />
              </div>
            ))}
          </div>
          {/* Right: rating breakdown */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 h-[400px]">
            <SkeletonBlock className="h-5 w-32 mb-4" />
            <SkeletonBlock className="h-full w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Reviews & Feedback</h1>
            <p className="text-sm text-neutral-400">
                Customer satisfaction, platform ratings, and order feedback.
            </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-900/50 px-3 py-1.5 rounded-full border border-neutral-800 shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            Last updated: {lastUpdated ? format(lastUpdated, "MMM dd, yyyy") : "..."}
        </div>
      </div>

      {/* Top Platform Rating Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {platformsConfig.map((p) => {
            const stats = calculateCardStats(p.id);
            return (
                <div key={p.id} className="bg-neutral-900 p-4 md:p-5 rounded-2xl border border-neutral-800 shadow-lg relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs md:text-sm font-semibold text-neutral-400 uppercase tracking-wider">{p.name}</span>
                        <div className={`hidden md:block p-2 rounded-lg ${p.bg}`}>
                            <p.icon size={16} className={p.color} />
                        </div>
                    </div>
                    <div className="flex items-end gap-2 md:gap-3 mb-1">
                        <h3 className="text-2xl md:text-4xl font-black text-white">{stats.avg}</h3>
                        <div className="flex pb-1">
                            {[1, 2, 3, 4, 5].map(star => {
                                const avg = parseFloat(stats.avg);
                                const fill = Math.max(0, Math.min(1, avg - (star - 1)));
                                if (fill >= 1) return <Star key={star} size={14} className={p.color} fill="currentColor" />;
                                if (fill <= 0) return <Star key={star} size={14} className="text-neutral-700" fill="none" />;
                                const id = `star-clip-${p.id}-${star}`;
                                const starPath = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";
                                return (
                                  <svg key={star} width={14} height={14} viewBox="0 0 24 24" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <defs><clipPath id={id}><rect x="0" y="0" width={24 * fill} height="24" /></clipPath></defs>
                                    <path d={starPath} className="text-neutral-700" stroke="currentColor" />
                                    <path d={starPath} className={p.color} fill="currentColor" stroke="currentColor" clipPath={`url(#${id})`} />
                                  </svg>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs mt-4">
                        <span className="text-neutral-500 font-medium">{stats.total.toLocaleString()} reviews</span>
                        {stats.trend !== 0 && (
                            <div className={`flex items-center gap-1 font-bold ${stats.trend > 0 ? "text-emerald-500" : "text-red-500"}`}>
                                {stats.trend > 0 ? <TrendingUp size={12} strokeWidth={3} /> : <TrendingDown size={12} strokeWidth={3} />}
                                <span>{Math.abs(stats.trend)}</span>
                            </div>
                        )}
                        {stats.trend === 0 && (
                             <div className="flex items-center gap-1 font-bold text-neutral-500">
                                <Minus size={12} strokeWidth={3} />
                                <span>0.0</span>
                            </div>
                        )}
                    </div>
                </div>
            );
        })}
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
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Platform</p>
              <div className="flex flex-wrap gap-1.5">
                {platformsConfig.map(p => (
                  <button key={p.id} onClick={() => setPlatformFilter(p.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${platformFilter === p.id ? "bg-neutral-800 text-white border-neutral-700 shadow-md" : "text-neutral-400 border-neutral-800 hover:text-neutral-200"}`}>{p.name}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Stars</p>
              <div className="flex flex-wrap gap-1.5">
                {["all", "5", "4", "3", "2", "1"].map(star => (
                  <button key={star} onClick={() => setStarFilter(star)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1 ${starFilter === star ? "bg-neutral-800 text-white border-neutral-700 shadow-md" : "text-neutral-400 border-neutral-800 hover:text-neutral-200"}`}>
                    {star === "all" ? "All" : <>{star} <Star size={10} className={starFilter === star ? "text-yellow-500" : ""} fill={starFilter === star ? "currentColor" : "none"}/></>}
                  </button>
                ))}
                <button onClick={() => setCommentsOnly(!commentsOnly)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 ${commentsOnly ? "bg-neutral-800 text-white border-neutral-700 shadow-md" : "text-neutral-400 border-neutral-800 hover:text-neutral-200"}`}>
                  <MessageSquareOff size={12} /> Comments
                </button>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">Date Range</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[10px] text-neutral-500 mb-1 block">From</label>
                  <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setActivePreset(null); }} min={oldestAvailableDate ? getFormattedDate(oldestAvailableDate) : undefined} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 text-xs px-3 py-2 focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500 mb-1 block">To</label>
                  <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setActivePreset(null); }} max={getFormattedDate(new Date())} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 text-xs px-3 py-2 focus:outline-none focus:border-emerald-500/50" />
                </div>
              </div>
              <div className="flex bg-neutral-950 rounded-lg p-1 border border-neutral-800 w-fit">
                {["1M", "3M", "6M", "1Y"].map(preset => (
                  <button key={preset} onClick={() => handleDatePreset(preset)} className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${activePreset === preset ? "bg-emerald-500 text-white" : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"}`}>{preset}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Filter Bar */}
      <div className="hidden md:flex bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-lg flex-row items-center justify-between gap-3 filter-pattern">
        <div className="flex items-center gap-3">
            <div className="flex p-1 bg-neutral-950 rounded-lg border border-neutral-800">
                {platformsConfig.map(p => (
                    <button key={p.id} onClick={() => setPlatformFilter(p.id)} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 flex items-center gap-1.5 ${platformFilter === p.id ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"}`}>
                        {platformFilter === p.id && <p.icon size={12} className={p.color} />}
                        {p.name}
                    </button>
                ))}
            </div>
            <div className="h-6 w-px bg-neutral-800"></div>
            <div className="flex p-1 bg-neutral-950 rounded-lg border border-neutral-800">
                {["all", "5", "4", "3", "2", "1"].map(star => (
                    <button key={star} onClick={() => setStarFilter(star)} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 flex items-center gap-1 ${starFilter === star ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"}`}>
                        {star === "all" ? "All Stars" : <>{star} <Star size={10} className={starFilter === star ? "text-yellow-500" : ""} fill={starFilter === star ? "currentColor" : "none"}/></>}
                    </button>
                ))}
            </div>
            <button onClick={() => setCommentsOnly(!commentsOnly)} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 flex items-center gap-1.5 border ${commentsOnly ? "bg-neutral-800 text-white border-neutral-700 shadow-sm" : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border-neutral-800"}`}>
                <MessageSquareOff size={12} /> Comments
            </button>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center bg-neutral-950 rounded-lg border border-neutral-800 p-1">
                 <div className="flex items-center px-2 border-r border-white/10">
                    <Calendar size={12} className="text-neutral-400 mr-1.5" />
                    <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setActivePreset(null); }} min={oldestAvailableDate ? getFormattedDate(oldestAvailableDate) : undefined} className="bg-transparent text-xs text-neutral-300 focus:outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:invert-[0.8]" />
                    <span className="text-neutral-600 text-xs mx-1.5">to</span>
                    <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setActivePreset(null); }} max={getFormattedDate(new Date())} className="bg-transparent text-xs text-neutral-300 focus:outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:invert-[0.8]" />
                </div>
                <div className="flex px-1 gap-1">
                    {["1M", "3M", "6M", "1Y"].map(preset => (
                        <button key={preset} onClick={() => handleDatePreset(preset)} className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${activePreset === preset ? "bg-emerald-500 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"}`}>{preset}</button>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* Main Area: Feed & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rating Breakdown — appears first on mobile, right column on desktop */}
          <div className="order-first lg:order-last space-y-6">
            <div className="bg-neutral-900 p-4 md:p-6 rounded-2xl border border-neutral-800 shadow-lg">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                     <Filter size={16} className="text-emerald-500" />
                     Rating Breakdown
                </h3>
                {filteredReviews.length === 0 ? (
                     <p className="text-sm text-neutral-500 italic">No data to breakdown</p>
                ) : (
                    <div className="space-y-3">
                        {ratingBreakdown.map((row) => (
                            <div key={row.star} className="flex items-center gap-3">
                                <div className="flex items-center gap-1 w-10 shrink-0 text-sm font-medium text-neutral-400">
                                    {row.star} <Star size={12} className={row.star >= 4 ? "text-emerald-500" : row.star === 3 ? "text-yellow-500" : "text-red-500"} fill="currentColor" />
                                </div>
                                <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                                     <div
                                        className={`h-full rounded-full ${row.star >= 4 ? "bg-emerald-500" : row.star === 3 ? "bg-yellow-500" : "bg-red-500"}`}
                                        style={{ width: `${row.percentage}%` }}
                                     ></div>
                                </div>
                                <div className="shrink-0 text-right text-xs font-semibold text-white whitespace-nowrap">
                                    {row.count} <span className="text-neutral-500 font-medium">· {Math.round(row.percentage)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </div>

          {/* Feed Column */}
          <div className="lg:col-span-2 space-y-4">
               {(() => {
                 const displayedReviews = commentsOnly ? filteredReviews.filter(r => r.review_text && r.review_text.trim() !== "") : filteredReviews;
                 return displayedReviews.length === 0 ? (
                    <div className="bg-neutral-900 p-6 md:p-10 rounded-2xl border border-neutral-800 shadow-lg flex flex-col items-center justify-center text-center">
                        <MessageSquareOff size={48} className="text-neutral-700 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">No Reviews Found</h3>
                        <p className="text-sm text-neutral-400 max-w-sm">
                            We couldn't find any reviews matching your current filters. Try adjusting your platform, star rating, or date parameters.
                        </p>
                    </div>
               ) : (
                    <div className="space-y-4 h-[300px] md:h-[800px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                        {displayedReviews.map((review) => {
                            const pData = getPlatformDetails(review.source_platform);
                            return (
                                <div key={review.id} className={`bg-neutral-900 rounded-2xl border border-neutral-800 shadow-md overflow-hidden flex flex-col border-l-4 ${pData.border}`}>
                                    <div className="p-4 md:p-5 flex-1">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                {review.source_platform?.toLowerCase() === "google" && review.reviewer_name && (
                                                    <h4 className="text-white font-bold mb-1">
                                                        {review.reviewer_name}
                                                    </h4>
                                                )}
                                                <p className="text-xs text-neutral-500">{review.review_date ? format(parseISO(review.review_date), "MMM dd, yyyy - h:mm a") : "Unknown Date"}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                 <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${pData.bg} ${pData.text}`}>
                                                     {review.source_platform}
                                                 </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex mb-3">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <Star 
                                                    key={star} 
                                                    size={14} 
                                                    className={star <= review.rating ? "text-yellow-500" : "text-neutral-700"} 
                                                    fill={star <= review.rating ? "currentColor" : "none"}
                                                />
                                            ))}
                                        </div>

                                        {review.review_text ? (
                                            <p className="text-sm text-neutral-300 leading-relaxed">{review.review_text}</p>
                                        ) : (
                                            <p className="text-sm text-neutral-600 italic">No comment left</p>
                                        )}
                                    </div>

                                    {/* Order Details (if available) */}
                                    {review.order_reference && review.items && (
                                        <div className="bg-neutral-800/50 px-5 py-3 border-t border-neutral-800 flex items-start gap-3">
                                            <Utensils size={14} className="text-neutral-500 mt-0.5 shrink-0" />
                                            <div>
                                                <span className="text-xs font-semibold text-neutral-400 block mb-1">What they ordered:</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                  {review.items.split(', ').map((item, i) => {
                                                    const match = item.match(/^(\d+)\s+(.+)$/);
                                                    const qty = match ? match[1] : '';
                                                    const name = match ? match[2] : item;
                                                    return (
                                                      <span key={i} style={{
                                                        fontSize: '12px',
                                                        padding: '3px 10px',
                                                        borderRadius: '999px',
                                                        background: 'rgba(128,128,128,0.08)',
                                                        border: '0.5px solid rgba(128,128,128,0.2)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '3px'
                                                      }}>
                                                        {qty && <span style={{ fontWeight: 500, color: '#3b82f6', fontSize: '11px' }}>{qty}×</span>}
                                                        {name}
                                                      </span>
                                                    );
                                                  })}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
               );
               })()}
          </div>

      </div>

      {/* Bottom Chart */}
      <div className="bg-neutral-900 p-4 md:p-6 rounded-2xl border border-neutral-800 shadow-lg relative">
          <div className="mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <TrendingUp size={18} className="text-emerald-500" />
                   Rating Timeline
              </h3>
              <p className="text-xs text-neutral-500 mt-1">Weekly average rating for the selected date range{platformFilter !== "all" ? ` (${platformFilter})` : ""}.</p>
          </div>
          
          {originalReviews.length === 0 || getChartData().length === 0 ? (
              <div className="h-[200px] md:h-[300px] flex flex-col items-center justify-center text-center text-neutral-500">
                  <p className="text-sm font-semibold text-white">{originalReviews.length === 0 ? "No data available" : "Select a date range of at least 1 week"}</p>
              </div>
          ) : (
              <div className="h-[200px] md:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getChartData()} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                          <XAxis 
                              dataKey="name" 
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
                              domain={[1, 5]}
                              ticks={[1, 2, 3, 4, 5]}
                          />
                          <RechartsTooltip content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              const lineColor = getChartLineColor();
                              const labelText = platformFilter === "all" ? "Avg Rating" : platformFilter.charAt(0).toUpperCase() + platformFilter.slice(1);
                              return (
                                  <div style={{ backgroundColor: "#171717", border: "1px solid #404040", borderRadius: "12px", padding: "12px 14px", color: "#f5f5f5" }}>
                                      <p style={{ color: "#a3a3a3", marginBottom: "8px", fontSize: "12px" }}>{label}</p>
                                      <p style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: lineColor, display: "inline-block" }}></span>
                                          <span style={{ color: "#a3a3a3" }}>{labelText}:</span>
                                          <span style={{ fontWeight: "600" }}>{Number(payload[0].value).toFixed(1)}</span>
                                      </p>
                                  </div>
                              );
                          }} />
                          <Line type="monotone" dataKey="rating" name={platformFilter === "all" ? "Avg Rating" : platformFilter} stroke={getChartLineColor()} strokeWidth={3} dot={{ r: 4, fill: getChartLineColor(), strokeWidth: 0 }} activeDot={{ r: 6 }} connectNulls />
                      </LineChart>
                  </ResponsiveContainer>
              </div>
          )}
      </div>

    </div>
  );
}
