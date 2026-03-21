"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Loader2,
  DollarSign,
  Clock,
  Banknote,
  CreditCard,
  Check,
  Calendar,
  FileText,
  Coffee,
  Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import SkeletonBlock from "@/components/SkeletonBlock";
import { useAuth } from "@/lib/AuthContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shiftHours(shift) {
  const [sh, sm] = (shift.start_time || "00:00").split(":").map(Number);
  const [eh, em] = (shift.end_time || "00:00").split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const worked = endMins - startMins - (shift.break_minutes || 0);
  return Math.max(worked, 0) / 60;
}

function r2(n) {
  return Math.round(n * 100) / 100;
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

const STATUS_STYLES = {
  paid: "bg-emerald-500/15 text-emerald-400",
  partial: "bg-amber-500/15 text-amber-400",
  unpaid: "bg-red-500/15 text-red-400",
};

// ─── Main page ───────────────────────────────────────────────────────────────

export default function MyPayrollPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const isAdmin = profile?.role === "admin";

  // Redirect admins to /payroll
  useEffect(() => {
    if (profile && isAdmin) router.push("/payroll");
  }, [profile, isAdmin, router]);

  const [shifts, setShifts] = useState([]);
  const [records, setRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [expandedMonth, setExpandedMonth] = useState(null);
  const [expandedSection, setExpandedSection] = useState(null); // "shifts" | "payments"

  // ── Fetch data ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [shiftRes, recRes, payRes] = await Promise.all([
      supabase
        .from("shifts")
        .select("*")
        .eq("employee_id", user.id)
        .order("shift_date", { ascending: true })
        .limit(1000),
      supabase
        .from("payroll_records")
        .select("*")
        .eq("employee_id", user.id)
        .order("year", { ascending: false })
        .order("month", { ascending: false }),
      supabase
        .from("payroll_payments")
        .select("*, payroll_records!inner(employee_id)")
        .eq("payroll_records.employee_id", user.id)
        .limit(1000),
    ]);

    if (shiftRes.error) console.error("Shifts fetch error:", JSON.stringify(shiftRes.error));
    if (recRes.error) console.error("Records fetch error:", JSON.stringify(recRes.error));
    if (payRes.error) console.error("Payments fetch error:", JSON.stringify(payRes.error));

    setShifts(shiftRes.data || []);
    setRecords(recRes.data || []);
    setPayments(payRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user && !isAdmin) fetchAll();
  }, [user, isAdmin, fetchAll]);

  // ── Derived month rows ──────────────────────────────────────────────────
  const monthRows = useMemo(() => {
    // Group shifts by year-month
    const monthMap = {};
    for (const s of shifts) {
      const [sy, sm] = (s.shift_date || "").split("-").map(Number);
      if (!sy || !sm) continue;
      const key = `${sy}-${sm}`;
      if (!monthMap[key]) monthMap[key] = { year: sy, month: sm, shifts: [] };
      monthMap[key].shifts.push(s);
    }

    // Sort newest first
    const sorted = Object.values(monthMap).sort(
      (a, b) => b.year - a.year || b.month - a.month
    );

    return sorted.map((m) => {
      const totalHours = r2(m.shifts.reduce((sum, s) => sum + shiftHours(s), 0));

      const record = records.find(
        (r) => r.year === m.year && r.month === m.month
      );

      const hourlyRate = record?.hourly_rate ?? profile?.hourly_rate ?? 0;
      const monthlyBonus = record?.monthly_bonus ?? profile?.monthly_bonus ?? 0;
      const bonusDescription = record?.bonus_description ?? profile?.bonus_description ?? "";
      const grossExpected = r2(totalHours * hourlyRate + monthlyBonus);
      const amountPaid = record?.amount_paid ?? 0;
      const amountRemaining = r2(grossExpected - amountPaid);

      let status = "unpaid";
      if (amountPaid > 0 && amountPaid >= grossExpected && grossExpected > 0) {
        status = "paid";
      } else if (amountPaid > 0) {
        status = "partial";
      }

      const monthLabel = new Date(m.year, m.month - 1, 1).toLocaleDateString(
        "en-GB",
        { month: "long", year: "numeric" }
      );

      // Payments for this record
      const recordPayments = record
        ? payments
            .filter((p) => p.payroll_id === record.id)
            .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
        : [];

      // Sort shifts by date
      const sortedShifts = [...m.shifts].sort(
        (a, b) => a.shift_date.localeCompare(b.shift_date)
      );

      return {
        key: `${m.year}-${m.month}`,
        year: m.year,
        month: m.month,
        label: monthLabel,
        totalHours,
        hourlyRate,
        monthlyBonus,
        grossExpected,
        amountPaid,
        amountRemaining,
        status,
        bonusDescription,
        shifts: sortedShifts,
        payments: recordPayments,
      };
    });
  }, [shifts, records, payments, profile]);

  // ── Payslip PDF generation ───────────────────────────────────────────────
  const generatePayslip = async (row) => {
    const jsPDFModule = await import("jspdf");
    const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
    const autoTableModule = await import("jspdf-autotable");
    autoTableModule.applyPlugin(jsPDF);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // Load logo
    let logoImg = null;
    try {
      const response = await fetch("/images/betty_logo.png");
      const blob = await response.blob();
      logoImg = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch {
      // Continue without logo
    }

    // ── HEADER ──
    if (logoImg) {
      doc.addImage(logoImg, "PNG", margin, y, 22, 22);
    }
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(33, 33, 33);
    doc.text("Payslip", pageWidth - margin, y + 14, { align: "right" });

    y += 28;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 14;

    // ── EMPLOYEE DETAILS ──
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("EMPLOYEE DETAILS", margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(33, 33, 33);
    doc.setFontSize(10);

    const details = [
      ["Employee", profile.full_name],
      ["Period", row.label],
      ["Generated", new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
    ];
    for (const [label, value] of details) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(label + ":", margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text(value, margin + 40, y);
      y += 6;
    }
    y += 10;

    // ── EARNINGS ──
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("EARNINGS", margin, y);
    y += 4;

    const earningsBody = [
      [`Basic pay (${row.totalHours}h x \u20AC${row.hourlyRate})`, `\u20AC${r2(row.totalHours * row.hourlyRate).toFixed(2)}`],
    ];
    if (row.monthlyBonus > 0) {
      earningsBody.push([
        row.bonusDescription || "Monthly bonus",
        `\u20AC${Number(row.monthlyBonus).toFixed(2)}`,
      ]);
    }
    earningsBody.push([
      { content: "Gross Total", styles: { fontStyle: "bold" } },
      { content: `\u20AC${row.grossExpected.toFixed(2)}`, styles: { fontStyle: "bold" } },
    ]);

    doc.autoTable({
      startY: y,
      head: [["Description", "Amount"]],
      body: earningsBody,
      margin: { left: margin, right: margin },
      theme: "plain",
      headStyles: { fillColor: [245, 245, 245], textColor: [80, 80, 80], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [33, 33, 33] },
      columnStyles: { 1: { halign: "right" } },
      styles: { cellPadding: 4, lineColor: [230, 230, 230], lineWidth: 0.3 },
    });
    y = doc.lastAutoTable.finalY + 14;

    // ── HOURS SUMMARY ──
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("HOURS SUMMARY", margin, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(33, 33, 33);
    doc.setFontSize(10);

    const hoursSummary = [
      ["Total hours worked", `${row.totalHours} hours`],
      ["Hourly rate", `\u20AC${row.hourlyRate} / hour`],
    ];
    for (const [label, value] of hoursSummary) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(label + ":", margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 33, 33);
      doc.text(value, margin + 55, y);
      y += 6;
    }
    y += 10;

    // ── PAYMENT HISTORY ──
    if (row.payments.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text("PAYMENT HISTORY", margin, y);
      y += 4;

      const paymentBody = row.payments.map((p) => [
        new Date(p.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
        `\u20AC${Number(p.amount).toFixed(2)}`,
        p.payment_note || "-",
      ]);
      paymentBody.push([
        { content: "Total Paid", styles: { fontStyle: "bold" } },
        { content: `\u20AC${Number(row.amountPaid).toFixed(2)}`, styles: { fontStyle: "bold" } },
        "",
      ]);

      doc.autoTable({
        startY: y,
        head: [["Date", "Amount", "Note"]],
        body: paymentBody,
        margin: { left: margin, right: margin },
        theme: "plain",
        headStyles: { fillColor: [245, 245, 245], textColor: [80, 80, 80], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [33, 33, 33] },
        columnStyles: { 1: { halign: "right" } },
        styles: { cellPadding: 4, lineColor: [230, 230, 230], lineWidth: 0.3 },
      });
      y = doc.lastAutoTable.finalY + 10;
    }

    // ── FOOTER ──
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(160, 160, 160);
    doc.text("This is an automatically generated payslip.", margin, footerY);
    doc.text("Betty's Crispy Chicken, Limassol, Cyprus", pageWidth - margin, footerY, { align: "right" });

    // ── SAVE ──
    const monthName = new Date(row.year, row.month - 1, 1).toLocaleDateString("en-GB", { month: "long" });
    const empName = (profile.full_name || "Employee").split(" ")[0];
    doc.save(`Payslip_${empName}_${monthName}_${row.year}.pdf`);
  };

  if (!profile || isAdmin) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">My Payroll</h1>
        <p className="text-neutral-400 text-sm mt-1">View your pay and shift history.</p>
      </div>

      {/* Info card */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-emerald-400" />
            <span className="text-sm text-white font-semibold">
              &euro;{profile.hourly_rate ?? 0} / hour
            </span>
          </div>
          {(profile.monthly_bonus ?? 0) > 0 && (
            <div className="flex items-center gap-2">
              <Banknote size={16} className="text-emerald-400" />
              <span className="text-sm text-white font-semibold">
                + &euro;{profile.monthly_bonus} / month
              </span>
            </div>
          )}
          {profile.bonus_description && (
            <span className="text-xs text-neutral-400 italic">
              {profile.bonus_description}
            </span>
          )}
        </div>
      </div>

      {/* Month list */}
      {loading ? (
        <div className="space-y-4">
          {/* Info card skeleton */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <SkeletonBlock className="h-10 w-10 rounded-xl" />
              <SkeletonBlock className="h-5 w-40" />
            </div>
            <div className="flex gap-6">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-4 w-36" />
            </div>
          </div>
          {/* 3 month row skeletons */}
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <SkeletonBlock className="h-4 w-36 mb-2" />
                  <SkeletonBlock className="h-3 w-28" />
                </div>
                <div className="flex items-center gap-3">
                  <SkeletonBlock className="h-6 w-20 rounded-full" />
                  <SkeletonBlock className="h-5 w-5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : monthRows.length === 0 ? (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-10 text-center text-neutral-500 text-sm">
          No shifts logged yet.
        </div>
      ) : (
        <div className="space-y-3">
          {monthRows.map((row) => {
            const isOpen = expandedMonth === row.key;
            const now = new Date();
            const isCurrentMonth = row.year === now.getFullYear() && row.month === now.getMonth() + 1;
            const canDownload = row.status === "paid" && !isCurrentMonth;

            return (
              <div
                key={row.key}
                className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden"
              >
                {/* Accordion header */}
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      setExpandedMonth(isOpen ? null : row.key);
                      setExpandedSection(null);
                    }}
                    className="flex-1 flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors min-w-0"
                  >
                    <div className="min-w-0">
                      <p className="text-white font-semibold">{row.label}</p>
                      <p className="text-neutral-500 text-xs mt-0.5">
                        {row.shifts.length} shift{row.shifts.length !== 1 ? "s" : ""} &middot; {row.totalHours}h
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {row.status === "partial" && (
                        <span className="text-xs font-semibold text-amber-400">
                          &euro;{row.amountPaid}/&euro;{row.grossExpected}
                        </span>
                      )}
                      <span
                        className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${STATUS_STYLES[row.status]}`}
                      >
                        {row.status === "partial" ? "partially paid" : row.status}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-neutral-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>
                  {canDownload && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        generatePayslip(row);
                      }}
                      className="flex items-center gap-2 px-4 py-2 mr-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
                    >
                      <Download size={14} />
                      Download Payslip
                    </button>
                  )}
                </div>

                {/* Expanded content */}
                {isOpen && (
                  <div className="border-t border-neutral-800 p-5 space-y-5">
                    {/* Summary grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      <StatCell icon={<Clock size={14} />} label="Total Hours" value={`${row.totalHours}h`} />
                      <StatCell icon={<CreditCard size={14} />} label="Gross Expected" value={`\u20AC${row.grossExpected}`} highlight />
                      <StatCell icon={<Check size={14} />} label="Amount Paid" value={`\u20AC${row.amountPaid}`} success={row.amountPaid > 0} />
                      <StatCell
                        icon={<DollarSign size={14} />}
                        label="Remaining"
                        value={`\u20AC${row.amountRemaining}`}
                        danger={row.amountRemaining > 0}
                      />
                      <StatCell icon={<Banknote size={14} />} label="Bonus" value={`\u20AC${row.monthlyBonus}`} />
                    </div>

                    {/* Shifts list */}
                    <div>
                      <button
                        onClick={() => setExpandedSection(expandedSection === "shifts" ? null : "shifts")}
                        className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                      >
                        <ChevronDown
                          size={14}
                          className={`transition-transform ${expandedSection === "shifts" ? "rotate-180" : ""}`}
                        />
                        Shifts ({row.shifts.length})
                      </button>

                      {expandedSection === "shifts" && (
                        <div className="mt-3 space-y-2">
                          {row.shifts.map((s) => {
                            const hours = r2(shiftHours(s));
                            const dateLabel = new Date(
                              ...s.shift_date.split("-").map((v, i) => (i === 1 ? v - 1 : +v))
                            ).toLocaleDateString("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            });
                            return (
                              <div
                                key={s.id}
                                className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3"
                              >
                                <div className="flex items-center gap-3">
                                  <Calendar size={14} className="text-neutral-500 shrink-0" />
                                  <div>
                                    <p className="text-sm text-white font-medium">{dateLabel}</p>
                                    <p className="text-xs text-neutral-500">
                                      {formatTime(s.start_time)} &rarr; {formatTime(s.end_time)}
                                      {(s.break_minutes || 0) > 0 && (
                                        <span className="ml-2">
                                          <Coffee size={10} className="inline -mt-0.5 mr-0.5" />
                                          {s.break_minutes}min break
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-sm text-white font-semibold shrink-0">{hours}h</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Payments list */}
                    {row.payments.length > 0 && (
                      <div>
                        <button
                          onClick={() => setExpandedSection(expandedSection === "payments" ? null : "payments")}
                          className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
                        >
                          <ChevronDown
                            size={14}
                            className={`transition-transform ${expandedSection === "payments" ? "rotate-180" : ""}`}
                          />
                          Payments ({row.payments.length})
                        </button>

                        {expandedSection === "payments" && (
                          <div className="mt-3 space-y-2">
                            {row.payments.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-start justify-between bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3"
                              >
                                <div className="space-y-0.5">
                                  <p className="text-sm text-white font-medium">&euro;{p.amount}</p>
                                  <p className="text-xs text-neutral-500">
                                    {new Date(p.paid_at).toLocaleDateString("en-GB", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </p>
                                  {p.payment_note && (
                                    <p className="text-xs text-neutral-400 mt-1">{p.payment_note}</p>
                                  )}
                                </div>
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
