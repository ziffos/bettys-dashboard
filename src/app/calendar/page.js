"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  Check,
  Pencil,
  Trash2,
  Clock,
  Coffee,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import { supabase } from "@/lib/supabase";
import SkeletonBlock from "@/components/SkeletonBlock";
import { useAuth } from "@/lib/AuthContext";

/** Format a time string "HH:mm:ss" or "HH:mm" into "HH:mm".
 *  Times are stored as plain values (no timezone) — display as-is. */
function formatTime(_dateStr, timeStr) {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

/** Format a date string "YYYY-MM-DD" into a readable date */
function formatDateCy(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Consistent colours per employee ─────────────────────────────────────────
const PALETTE = [
  { bg: "bg-emerald-500/20", border: "border-emerald-500/40", text: "text-emerald-300" },
  { bg: "bg-blue-500/20", border: "border-blue-500/40", text: "text-blue-300" },
  { bg: "bg-violet-500/20", border: "border-violet-500/40", text: "text-violet-300" },
  { bg: "bg-amber-500/20", border: "border-amber-500/40", text: "text-amber-300" },
  { bg: "bg-rose-500/20", border: "border-rose-500/40", text: "text-rose-300" },
  { bg: "bg-cyan-500/20", border: "border-cyan-500/40", text: "text-cyan-300" },
  { bg: "bg-pink-500/20", border: "border-pink-500/40", text: "text-pink-300" },
  { bg: "bg-lime-500/20", border: "border-lime-500/40", text: "text-lime-300" },
  { bg: "bg-orange-500/20", border: "border-orange-500/40", text: "text-orange-300" },
  { bg: "bg-teal-500/20", border: "border-teal-500/40", text: "text-teal-300" },
];

function getColour(employeeId, colourMap) {
  if (!colourMap.has(employeeId)) {
    colourMap.set(employeeId, PALETTE[colourMap.size % PALETTE.length]);
  }
  return colourMap.get(employeeId);
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Modals
  const [shiftModal, setShiftModal] = useState(null); // null | { mode: "add"|"edit", shift?, date? }
  const [detailShift, setDetailShift] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Paid-month cache: "empId-YYYY-MM" → boolean
  const [paidCache, setPaidCache] = useState({});

  // Colour map (stable across renders via useMemo on shift data)
  const colourMap = useMemo(() => {
    const m = new Map();
    shifts.forEach((s) => getColour(s.employee_id, m));
    return m;
  }, [shifts]);

  // ── Fetch shifts ──────────────────────────────────────────────────────────
  const fetchShifts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("shifts")
      .select("*, profiles!shifts_employee_id_fkey(full_name)")
      .order("shift_date", { ascending: true })
      .limit(1000);

    if (error) console.error("Shift fetch error:", JSON.stringify(error));
    setShifts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // ── Toast auto-dismiss ────────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // ── Check if a month is paid for an employee ──────────────────────────────
  const checkPaid = useCallback(
    async (employeeId, year, month) => {
      const key = `${employeeId}-${year}-${month}`;
      if (key in paidCache) return paidCache[key];

      const { data } = await supabase
        .from("payroll_records")
        .select("status, amount_paid")
        .eq("employee_id", employeeId)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();

      const paid = data?.amount_paid > 0;
      setPaidCache((prev) => ({ ...prev, [key]: paid }));
      return paid;
    },
    [paidCache]
  );

  // ── Delete shift ──────────────────────────────────────────────────────────
  const handleDelete = async (shift) => {
    const { error } = await supabase.from("shifts").delete().eq("id", shift.id);
    if (error) {
      setToast({ type: "error", message: "Failed to delete shift" });
    } else {
      setShifts((prev) => prev.filter((s) => s.id !== shift.id));
      setToast({ type: "success", message: "Shift deleted" });
    }
    setDeleteConfirm(null);
    setDetailShift(null);
  };

  // ── Calendar grid helpers ─────────────────────────────────────────────────
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Group shifts by date string
  const shiftsByDate = useMemo(() => {
    const map = {};
    shifts.forEach((s) => {
      const d = s.shift_date;
      if (!map[d]) map[d] = [];
      map[d].push(s);
    });
    return map;
  }, [shifts]);

  // Can this user edit/delete a shift?
  const canModify = (shift) => {
    if (isAdmin) return true;
    if (shift.employee_id !== user?.id) return false;
    const d = parseISO(shift.shift_date);
    const key = `${shift.employee_id}-${d.getFullYear()}-${d.getMonth() + 1}`;
    return !paidCache[key];
  };

  // Pre-load paid status for visible months
  useEffect(() => {
    if (!user || isAdmin) return;
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth() + 1;
    checkPaid(user.id, year, month);
  }, [currentMonth, user, isAdmin, checkPaid, monthStart]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Calendar</h1>
          <p className="text-neutral-400 text-sm mt-1">View and manage work shifts.</p>
        </div>
        <button
          onClick={() => setShiftModal({ mode: "add", date: format(new Date(), "yyyy-MM-dd") })}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus size={18} />
          Add Shift
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
        <button
          onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
          className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-white">
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
          className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-neutral-800">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="p-3 flex justify-center">
                <SkeletonBlock className="h-3 w-8" />
              </div>
            ))}
          </div>
          {/* 5 rows x 7 cols */}
          {[...Array(5)].map((_, row) => (
            <div key={row} className="grid grid-cols-7 border-b border-neutral-800 last:border-b-0">
              {[...Array(7)].map((_, col) => (
                <div key={col} className="p-3 min-h-[100px] border-r border-neutral-800 last:border-r-0">
                  <SkeletonBlock className="h-4 w-6 mb-2" />
                  <SkeletonBlock className="h-5 w-full rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-neutral-800">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="p-3 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              const dayShifts = shiftsByDate[dateStr] || [];

              return (
                <div
                  key={dateStr}
                  className={`min-h-[100px] md:min-h-[120px] border-b border-r border-neutral-800 p-1.5 ${
                    inMonth ? "" : "opacity-30"
                  }`}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1 px-1">
                    <span
                      className={`text-xs font-medium ${
                        isToday
                          ? "bg-emerald-500 text-white w-6 h-6 rounded-full flex items-center justify-center"
                          : "text-neutral-400"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {inMonth && (
                      <button
                        onClick={() => setShiftModal({ mode: "add", date: dateStr })}
                        className="p-0.5 text-neutral-600 hover:text-emerald-400 transition-colors"
                        title="Add shift"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>

                  {/* Shift blocks */}
                  <div className="space-y-0.5">
                    {dayShifts.map((shift) => {
                      const c = getColour(shift.employee_id, colourMap);
                      const firstName = (shift.profiles?.full_name || "?").split(" ")[0];
                      return (
                        <button
                          key={shift.id}
                          onClick={() => setDetailShift(shift)}
                          className={`w-full text-left px-1.5 py-0.5 rounded-md text-[10px] md:text-xs border truncate ${c.bg} ${c.border} ${c.text} hover:brightness-125 transition-all`}
                        >
                          <span className="font-medium">{firstName}</span>{" "}
                          <span className="opacity-75 hidden sm:inline">
                            {formatTime(shift.shift_date, shift.start_time)}–{formatTime(shift.shift_date, shift.end_time)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Detail popup ─────────────────────────────────────────────────── */}
      {detailShift && (
        <DetailPopup
          shift={detailShift}
          canModify={canModify(detailShift)}
          isAdmin={isAdmin}
          onClose={() => setDetailShift(null)}
          onEdit={() => {
            setDetailShift(null);
            setShiftModal({ mode: "edit", shift: detailShift });
          }}
          onDelete={() => setDeleteConfirm(detailShift)}
        />
      )}

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      {deleteConfirm && (
        <ConfirmDialog
          message={`Delete shift for ${deleteConfirm.profiles?.full_name || "this employee"} on ${formatDateCy(deleteConfirm.shift_date)}?`}
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* ── Shift modal (add/edit) ───────────────────────────────────────── */}
      {shiftModal && (
        <ShiftModal
          mode={shiftModal.mode}
          shift={shiftModal.shift}
          defaultDate={shiftModal.date}
          isAdmin={isAdmin}
          userId={user?.id}
          onClose={() => setShiftModal(null)}
          onSaved={() => {
            setShiftModal(null);
            fetchShifts();
            setToast({
              type: "success",
              message: shiftModal.mode === "add" ? "Shift added" : "Shift updated",
            });
          }}
        />
      )}

      {/* ── Toast ────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 text-sm font-medium rounded-xl shadow-lg backdrop-blur-sm ${
            toast.type === "error" ? "bg-red-500/90 text-white" : "bg-emerald-500/90 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ─── Detail popup ────────────────────────────────────────────────────────────
function DetailPopup({ shift, canModify, isAdmin, onClose, onEdit, onDelete }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Shift Details</h2>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <Row icon={<Users size={16} />} label="Employee" value={shift.profiles?.full_name || "Unknown"} />
          <Row icon={<CalendarIcon size={16} />} label="Date" value={formatDateCy(shift.shift_date)} />
          <Row icon={<Clock size={16} />} label="Time" value={`${formatTime(shift.shift_date, shift.start_time)} → ${formatTime(shift.shift_date, shift.end_time)}`} />
          <Row icon={<Coffee size={16} />} label="Break" value={`${shift.break_minutes ?? 0} minutes`} />
          {shift.notes && <Row icon={<FileText size={16} />} label="Notes" value={shift.notes} />}
        </div>

        {canModify && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors"
            >
              <Pencil size={14} /> Edit
            </button>
            <button
              onClick={onDelete}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex gap-3">
      <div className="text-neutral-500 mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-xs text-neutral-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-white">{value}</p>
      </div>
    </div>
  );
}

// Tiny inline calendar icon to avoid importing from lucide twice with same name
function CalendarIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// Also need Users icon in detail popup - small inline version
function Users({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
        <div className="flex items-center gap-3 text-amber-400">
          <AlertTriangle size={22} />
          <h2 className="text-lg font-bold text-white">Confirm Delete</h2>
        </div>
        <p className="text-sm text-neutral-300">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shift modal (add / edit) ────────────────────────────────────────────────
function ShiftModal({ mode, shift, defaultDate, isAdmin, userId, onClose, onSaved }) {
  const isEdit = mode === "edit";

  const [employeeId, setEmployeeId] = useState(shift?.employee_id || (isAdmin ? "" : userId));
  const [date, setDate] = useState(shift?.shift_date || defaultDate || "");
  const [startTime, setStartTime] = useState(shift?.start_time?.slice(0, 5) || "09:00");
  const [endTime, setEndTime] = useState(shift?.end_time?.slice(0, 5) || "17:00");
  const [breakMins, setBreakMins] = useState(shift?.break_minutes?.toString() || "0");
  const [notes, setNotes] = useState(shift?.notes || "");

  const [recentShifts, setRecentShifts] = useState([]);
  const [activeRecent, setActiveRecent] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [locked, setLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(false);

  // Fetch active employees for admin dropdown
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name", { ascending: true })
      .then(({ data }) => setEmployees(data || []));
  }, [isAdmin]);

  // Check payroll lock when employee or date changes — direct query, no cache
  useEffect(() => {
    // For employees: always use their own userId
    // For admins: use the selected employee from the dropdown
    const empId = isAdmin ? employeeId : userId;
    if (!empId || !date) {
      setLocked(false);
      setCheckingLock(false);
      return;
    }

    // Admins bypass the lock
    if (isAdmin) {
      setLocked(false);
      setCheckingLock(false);
      return;
    }

    // Extract year and month directly from the date string (no Date parsing)
    const [year, month] = date.split("-").map(Number);
    if (!year || !month) return;

    let cancelled = false;
    setCheckingLock(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from("payroll_records")
          .select("status, amount_paid")
          .eq("employee_id", empId)
          .eq("year", year)
          .eq("month", month)
          .limit(1)
          .single();

        if (cancelled) return;

        if (error) {
          // .single() errors when 0 rows — that means no record = not locked
          console.log("Payroll lock check: no record found for", empId, year, month);
          setLocked(false);
        } else {
          const hasPayment = data?.amount_paid > 0;
          console.log("Payroll lock check:", empId, year, month, "amount_paid =", data?.amount_paid, "locked =", hasPayment);
          setLocked(hasPayment);
        }
      } catch (err) {
        console.error("Payroll lock check failed:", err);
        if (!cancelled) setLocked(false);
      } finally {
        if (!cancelled) setCheckingLock(false);
      }
    })();

    return () => { cancelled = true; };
  }, [employeeId, date, userId, isAdmin]);

  // Fetch recent shift patterns for this employee
  useEffect(() => {
    const empId = isAdmin ? employeeId : userId;
    if (!empId) { setRecentShifts([]); return; }

    let cancelled = false;
    (async () => {
      const sixWeeksAgo = new Date();
      sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

      const { data } = await supabase
        .from("shifts")
        .select("start_time, end_time, break_minutes")
        .eq("employee_id", empId)
        .gte("shift_date", sixWeeksAgo.toISOString().split("T")[0]);

      if (cancelled) return;
      if (!data || data.length === 0) { setRecentShifts([]); return; }

      // Group by pattern and count frequency
      const counts = {};
      data.forEach((s) => {
        const key = `${s.start_time}|${s.end_time}|${s.break_minutes}`;
        if (!counts[key]) counts[key] = { ...s, count: 0 };
        counts[key].count++;
      });

      const top = Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 2);

      setRecentShifts(top);
    })();

    return () => { cancelled = true; };
  }, [isAdmin ? employeeId : userId]);

  const applyRecent = (s) => {
    setStartTime(s.start_time.slice(0, 5));
    setEndTime(s.end_time.slice(0, 5));
    setBreakMins(String(s.break_minutes));
    setActiveRecent(`${s.start_time}|${s.end_time}|${s.break_minutes}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (locked && !isAdmin) {
      setError("This month is locked — a payment has already been logged");
      return;
    }

    setSaving(true);

    const payload = {
      employee_id: employeeId || userId,
      shift_date: date,
      start_time: startTime,
      end_time: endTime,
      break_minutes: parseInt(breakMins) || 0,
      notes: notes || null,
    };

    try {
      if (isEdit) {
        const { error: err } = await supabase
          .from("shifts")
          .update(payload)
          .eq("id", shift.id);
        if (err) throw err;
      } else {
        payload.created_by = userId;
        const { error: err } = await supabase.from("shifts").insert(payload);
        if (err) throw err;
      }
      onSaved();
    } catch (err) {
      setError(err.message || "Failed to save shift");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? "Edit Shift" : "Add Shift"}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Admin: employee selector */}
        {isAdmin && !isEdit && (
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">Employee</label>
            <select
              required
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            >
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Recent shifts */}
        {recentShifts.length > 0 && (
          <div>
            <span className="block text-xs text-neutral-500 mb-2">Recent shifts</span>
            <div className="flex flex-wrap gap-2">
              {recentShifts.map((s) => {
                const key = `${s.start_time}|${s.end_time}|${s.break_minutes}`;
                const brk = s.break_minutes > 0 ? `${s.break_minutes}min break` : "No break";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyRecent(s)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      activeRecent === key
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-500"
                    }`}
                  >
                    {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}  •  {brk}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-neutral-800 mt-4" />
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">Start Time</label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => { setStartTime(e.target.value); setActiveRecent(null); }}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">End Time</label>
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => { setEndTime(e.target.value); setActiveRecent(null); }}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Break */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">Break (minutes)</label>
          <input
            type="number"
            min="0"
            value={breakMins}
            onChange={(e) => { setBreakMins(e.target.value); setActiveRecent(null); }}
            className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
          />
        </div>

        {/* Lock warning */}
        {locked && !isAdmin && (
          <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
            <AlertTriangle size={16} className="shrink-0" />
            This month is locked — a payment has already been logged
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || checkingLock || (locked && !isAdmin)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {isEdit ? "Save Changes" : "Add Shift"}
        </button>
      </form>
    </div>
  );
}
