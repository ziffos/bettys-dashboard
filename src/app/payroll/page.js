"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Loader2,
  X,
  Check,
  DollarSign,
  Clock,
  Banknote,
  CreditCard,
  FileText,
  User,
  Calendar,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import SkeletonBlock from "@/components/SkeletonBlock";
import { useAuth } from "@/lib/AuthContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────


/** Calculate worked hours from a single shift row */
function shiftHours(shift) {
  const [sh, sm] = (shift.start_time || "00:00").split(":").map(Number);
  const [eh, em] = (shift.end_time || "00:00").split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const worked = endMins - startMins - (shift.break_minutes || 0);
  return Math.max(worked, 0) / 60;
}

/** Round to 2 decimal places */
function r2(n) {
  return Math.round(n * 100) / 100;
}

// Status badge colours
const STATUS_STYLES = {
  paid: "bg-emerald-500/15 text-emerald-400",
  partial: "bg-amber-500/15 text-amber-400",
  unpaid: "bg-red-500/15 text-red-400",
};

// ─── Main page ───────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const isAdmin = profile?.role === "admin";

  // Redirect non-admins
  useEffect(() => {
    if (profile && !isAdmin) router.push("/");
  }, [profile, isAdmin, router]);

  const [selectedMonth, setSelectedMonth] = useState(null);

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [records, setRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [rateChanges, setRateChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Accordion
  const [expandedEmp, setExpandedEmp] = useState(null);
  const [expandedPayments, setExpandedPayments] = useState(null);

  // Payment modal
  const [payModal, setPayModal] = useState(null); // { employeeId, prefill }

  // ── Fetch all data ────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [empRes, shiftRes, recRes, payRes, rateRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("is_active", true).order("full_name", { ascending: true }),
      supabase.from("shifts").select("*").limit(1000),
      supabase.from("payroll_records").select("*").limit(1000),
      supabase.from("payroll_payments").select("*, profiles!payroll_payments_created_by_fkey(full_name)").limit(1000),
      supabase.from("rate_changes").select("*").order("effective_year", { ascending: false }).order("effective_month", { ascending: false }),
    ]);

    if (empRes.error) console.error("Employees fetch error:", JSON.stringify(empRes.error));
    if (shiftRes.error) console.error("Shifts fetch error:", JSON.stringify(shiftRes.error));
    if (recRes.error) console.error("Records fetch error:", JSON.stringify(recRes.error));
    if (payRes.error) console.error("Payments fetch error:", JSON.stringify(payRes.error));
    if (rateRes.error) console.error("Rate changes fetch error:", JSON.stringify(rateRes.error));

    setEmployees(empRes.data || []);
    setShifts(shiftRes.data || []);
    setRecords(recRes.data || []);
    setPayments(payRes.data || []);
    setRateChanges(rateRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin, fetchAll]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // ── Build month options from shifts that actually exist ───────────────────
  const monthOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    for (const s of shifts) {
      const [sy, sm] = (s.shift_date || "").split("-").map(Number);
      if (!sy || !sm) continue;
      const key = `${sy}-${sm}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const d = new Date(sy, sm - 1, 1);
      options.push({
        year: sy,
        month: sm,
        label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      });
    }
    // Sort newest first, cap at 12
    options.sort((a, b) => b.year - a.year || b.month - a.month);
    return options.slice(0, 12);
  }, [shifts]);

  // Auto-select first month when options change
  useEffect(() => {
    if (monthOptions.length > 0 && !selectedMonth) {
      setSelectedMonth(monthOptions[0]);
    } else if (
      monthOptions.length > 0 &&
      selectedMonth &&
      !monthOptions.find((o) => o.year === selectedMonth.year && o.month === selectedMonth.month)
    ) {
      setSelectedMonth(monthOptions[0]);
    }
  }, [monthOptions, selectedMonth]);

  // ── Derived data for selected month ───────────────────────────────────────
  const employeeRows = useMemo(() => {
    if (!selectedMonth) return [];
    const { year, month } = selectedMonth;

    return employees.map((emp) => {
      // Shifts for this employee in this month
      const empShifts = shifts.filter((s) => {
        if (s.employee_id !== emp.id) return false;
        const [sy, sm] = (s.shift_date || "").split("-").map(Number);
        return sy === year && sm === month;
      });

      const totalHours = r2(empShifts.reduce((sum, s) => sum + shiftHours(s), 0));

      // Payroll record for this month
      const record = records.find(
        (r) => r.employee_id === emp.id && r.year === year && r.month === month
      );

      // Get effective rate from rate_changes for this month
      const effectiveRate = rateChanges.find(
        (rc) =>
          rc.employee_id === emp.id &&
          (rc.effective_year < year ||
            (rc.effective_year === year && rc.effective_month <= month))
      );
      const fallbackRate = record?.hourly_rate ?? effectiveRate?.hourly_rate ?? 0;
      const grossFromShifts = r2(empShifts.reduce((sum, s) => {
        return sum + shiftHours(s) * fallbackRate;
      }, 0));
      const hourlyRate = fallbackRate;
      const monthlyBonus = record?.monthly_bonus ?? effectiveRate?.monthly_bonus ?? 0;
      const grossExpected = r2(grossFromShifts + monthlyBonus);
      const amountPaid = record?.amount_paid ?? 0;
      const amountRemaining = r2(grossExpected - amountPaid);

      // Use the database status (set by trigger) instead of recalculating in JS
      const status = record?.status ?? "unpaid";

      // Payments for this record
      const recordPayments = record
        ? payments
            .filter((p) => p.payroll_id === record.id)
            .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
        : [];

      return {
        employee: emp,
        totalHours,
        hourlyRate,
        monthlyBonus,
        grossExpected,
        amountPaid,
        amountRemaining,
        status,
        record,
        firstPaidAt: record?.first_paid_at ?? null,
        payments: recordPayments,
        shiftCount: empShifts.length,
      };
    });
  }, [employees, shifts, records, payments, rateChanges, selectedMonth]);

  // ── Check if selected month has fully passed ─────────────────────────────
  const monthHasPassed = useMemo(() => {
    if (!selectedMonth) return false;
    const now = new Date();
    const { year, month } = selectedMonth;
    // First day of the month AFTER the selected month
    const firstOfNextMonth = new Date(year, month, 1);
    return now >= firstOfNextMonth;
  }, [selectedMonth]);

  // ── Handle payment submission ─────────────────────────────────────────────
  const handlePayment = async ({ employeeId, amount, date, note }) => {
    const { year, month } = selectedMonth;
    const emp = employees.find((e) => e.id === employeeId);
    const row = employeeRows.find((r) => r.employee.id === employeeId);

    // Validate amount doesn't exceed remaining
    const remaining = row?.amountRemaining ?? 0;
    if (parseFloat(amount) > remaining) {
      return {
        error: `Amount exceeds the remaining balance. Remaining: €${r2(remaining)}`,
      };
    }

    let payrollId;
    let existingRecord = records.find(
      (r) => r.employee_id === employeeId && r.year === year && r.month === month
    );

    // 1. Create payroll_records row if needed
    if (!existingRecord) {
      // Get effective rate from rate_changes for this month
      const effectiveRate = rateChanges.find(
        (rc) =>
          rc.employee_id === employeeId &&
          (rc.effective_year < year ||
            (rc.effective_year === year && rc.effective_month <= month))
      );

      const { data, error } = await supabase
        .from("payroll_records")
        .insert({
          employee_id: employeeId,
          year,
          month,
          total_hours: row?.totalHours || 0,
          hourly_rate: effectiveRate?.hourly_rate || 0,
          monthly_bonus: effectiveRate?.monthly_bonus || 0,
          bonus_description: effectiveRate?.bonus_description || null,
          gross_expected: row?.grossExpected || 0,
          amount_paid: 0,
          status: "unpaid",
          updated_by: user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Create payroll record error:", JSON.stringify(error));
        return { error: error.message || "Failed to create payroll record" };
      }
      payrollId = data.id;
    } else {
      payrollId = existingRecord.id;

      // Sync gross_expected with current shift data so the trigger calculates status correctly
      if (row && existingRecord.gross_expected !== row.grossExpected) {
        await supabase
          .from("payroll_records")
          .update({
            total_hours: row.totalHours,
            gross_expected: row.grossExpected,
            updated_by: user.id,
          })
          .eq("id", payrollId);
      }
    }

    // 2. Insert payment
    const { error: payErr } = await supabase.from("payroll_payments").insert({
      payroll_id: payrollId,
      amount: parseFloat(amount),
      paid_at: date,
      payment_note: note || null,
      created_by: user.id,
    });

    if (payErr) {
      console.error("Insert payment error:", JSON.stringify(payErr));
      return { error: payErr.message || "Failed to log payment" };
    }

    // The database trigger (sync_payroll_record) automatically updates
    // amount_paid, status, and paid_at on payroll_records — no JS recalculation needed.

    // Refresh data to pick up trigger's updates
    await fetchAll();
    return { error: null };
  };

  // ── Delete a payment ─────────────────────────────────────────────────────
  const handleDeletePayment = async (payment, row) => {
    const { error } = await supabase
      .from("payroll_payments")
      .delete()
      .eq("id", payment.id);

    if (error) {
      setToast({ type: "error", message: "Failed to delete payment" });
      return;
    }

    // The database trigger (sync_payroll_record) automatically recalculates
    // amount_paid and status on payroll_records — no JS recalculation needed.

    await fetchAll();
    setToast({ type: "success", message: "Payment deleted" });
  };

  if (!profile || !isAdmin) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Payroll</h1>
          <p className="text-neutral-400 text-sm mt-1">Manage employee payments and payroll records.</p>
        </div>
      </div>

      {/* Month selector */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-wrap items-center gap-4">
        <Calendar size={18} className="text-neutral-500 shrink-0" />
        {monthOptions.length === 0 ? (
          <p className="text-neutral-500 text-sm">No shifts logged yet</p>
        ) : (
        <select
          value={selectedMonth ? `${selectedMonth.year}-${selectedMonth.month}` : ""}
          onChange={(e) => {
            const [y, m] = e.target.value.split("-").map(Number);
            const opt = monthOptions.find((o) => o.year === y && o.month === m);
            if (opt) setSelectedMonth(opt);
          }}
          className="bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
        >
          {monthOptions.map((o) => (
            <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
              {o.label}
            </option>
          ))}
        </select>
        )}
      </div>

      {/* Employee list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <SkeletonBlock className="h-10 w-10 rounded-full" />
                  <div>
                    <SkeletonBlock className="h-4 w-36 mb-2" />
                    <SkeletonBlock className="h-3 w-24" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <SkeletonBlock className="h-6 w-20 rounded-full" />
                  <SkeletonBlock className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : employeeRows.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 text-center text-neutral-500 text-sm">
          No active employees found.
        </div>
      ) : (
        <div className="space-y-3">
          {employeeRows.map((row) => {
            const isOpen = expandedEmp === row.employee.id;
            const paymentsOpen = expandedPayments === row.employee.id;

            return (
              <div
                key={row.employee.id}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden"
              >
                {/* Accordion header */}
                <button
                  onClick={() => setExpandedEmp(isOpen ? null : row.employee.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-bold shrink-0">
                      {(row.employee.full_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{row.employee.full_name}</p>
                      <p className="text-neutral-500 text-xs mt-0.5">
                        {row.shiftCount} shift{row.shiftCount !== 1 ? "s" : ""} &middot; {row.totalHours}h
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2">
                      {row.status === "partial" && (
                        <span className="text-xs font-semibold text-amber-400">
                          €{row.amountPaid}/€{row.grossExpected}
                        </span>
                      )}
                      <span
                        className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${STATUS_STYLES[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-neutral-800 p-5 space-y-5">
                    {/* Summary grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      <StatCell icon={<Clock size={14} />} label="Total Hours" value={`${row.totalHours}h`} />
                      <StatCell icon={<DollarSign size={14} />} label="Hourly Rate" value={`€${row.hourlyRate}`} />
                      <StatCell icon={<Banknote size={14} />} label="Monthly Bonus" value={`€${row.monthlyBonus}`} />
                      <StatCell icon={<CreditCard size={14} />} label="Gross Expected" value={`€${row.grossExpected}`} highlight />
                      <StatCell icon={<Check size={14} />} label="Amount Paid" value={`€${row.amountPaid}`} success={row.amountPaid > 0} />
                      <StatCell
                        icon={<DollarSign size={14} />}
                        label="Remaining"
                        value={`€${row.amountRemaining}`}
                        danger={row.amountRemaining > 0}
                      />
                    </div>

                    {row.firstPaidAt && (
                      <p className="text-xs text-neutral-500">
                        First payment: {new Date(row.firstPaidAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <div className="relative group">
                        <button
                          onClick={() =>
                            setPayModal({
                              employeeId: row.employee.id,
                              prefill: row.amountRemaining > 0 ? row.amountRemaining : 0,
                            })
                          }
                          disabled={!monthHasPassed}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors ${
                            monthHasPassed
                              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                              : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                          }`}
                        >
                          <DollarSign size={16} />
                          Log Payment
                        </button>
                        {!monthHasPassed && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            This month has not ended yet
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Payment history toggle */}
                    {row.payments.length > 0 && (
                      <div>
                        <button
                          onClick={() => setExpandedPayments(paymentsOpen ? null : row.employee.id)}
                          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                        >
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${paymentsOpen ? "rotate-180" : ""}`}
                          />
                          Payment History ({row.payments.length})
                        </button>

                        {paymentsOpen && (
                          <div className="mt-3 space-y-2">
                            {row.payments.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-start justify-between bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3"
                              >
                                <div className="space-y-0.5">
                                  <p className="text-sm text-white font-medium">€{p.amount}</p>
                                  <p className="text-xs text-neutral-500">
                                    {new Date(p.paid_at).toLocaleDateString("en-GB", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                    {p.profiles?.full_name && (
                                      <span> &middot; by {p.profiles.full_name}</span>
                                    )}
                                  </p>
                                  {p.payment_note && (
                                    <p className="text-xs text-neutral-400 mt-1">{p.payment_note}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeletePayment(p, row)}
                                  className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0 ml-3"
                                  title="Delete payment"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Payment modal ──────────────────────────────────────────────────── */}
      {payModal && (
        <PaymentModal
          employeeId={payModal.employeeId}
          prefill={payModal.prefill}
          employeeName={employees.find((e) => e.id === payModal.employeeId)?.full_name || "Employee"}
          onClose={() => setPayModal(null)}
          onSubmit={async (data) => {
            const result = await handlePayment(data);
            if (result.error) {
              setToast({ type: "error", message: result.error });
            } else {
              setToast({ type: "success", message: "Payment logged successfully" });
              setPayModal(null);
            }
            return result;
          }}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
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

// ─── Stat cell ───────────────────────────────────────────────────────────────

function StatCell({ icon, label, value, highlight, success, danger }) {
  let valueColour = "text-white";
  if (success) valueColour = "text-emerald-400";
  if (danger) valueColour = "text-red-400";
  if (highlight) valueColour = "text-emerald-400";

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-neutral-500 mb-1">
        {icon}
        <p className="text-[10px] uppercase tracking-wider font-semibold">{label}</p>
      </div>
      <p className={`text-sm font-bold ${valueColour}`}>{value}</p>
    </div>
  );
}

// ─── Payment modal ───────────────────────────────────────────────────────────

function PaymentModal({ employeeId, prefill, employeeName, onClose, onSubmit }) {
  const [amount, setAmount] = useState(prefill > 0 ? prefill.toString() : "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!amount || parseFloat(amount) <= 0) {
      setError("Amount must be greater than 0");
      return;
    }

    setSaving(true);
    const result = await onSubmit({
      employeeId,
      amount: parseFloat(amount),
      date,
      note,
    });

    if (result?.error) {
      setError(result.error);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Log Payment</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-neutral-400">
          Recording payment for <span className="text-white font-medium">{employeeName}</span>
        </p>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">Amount (€)</label>
          <input
            type="number"
            required
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">Payment Date</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">Note</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          Log Payment
        </button>
      </form>
    </div>
  );
}
