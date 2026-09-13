"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, TriangleAlert } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import {
  Card,
  EmptyState,
  FIELD_INPUT,
  FIELD_LABEL,
  LoadingState,
  PageHeader,
  Segmented,
  SidePanel,
  Toast,
} from "../../components/ui";
import { MONTHS, euro, euro2, fetchAllRows, fmtDay } from "../../lib/format";

const MONTHS_BACK = 6;

const toMinutes = (time) => {
  const [h, m] = String(time || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const paidHours = (shift) =>
  Math.max(
    0,
    toMinutes(shift.end_time) - toMinutes(shift.start_time) - (shift.break_minutes || 0)
  ) / 60;

const round2 = (n) => Math.round(n * 100) / 100;

export default function PayrollPage() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [store, setStore] = useState({ loaded: false, failure: null });
  const [monthKey, setMonthKey] = useState(null);
  const [open, setOpen] = useState({});
  const [panel, setPanel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    (async () => {
      // Bounded to the months the picker can reach, and paginated. A bare
      // .limit(1000) over every shift ever worked silently drops whichever
      // rows fall outside an arbitrary first thousand, and the hours it adds
      // up look perfectly reasonable while being wrong.
      const from = new Date();
      from.setMonth(from.getMonth() - MONTHS_BACK);
      const since = fmtDay(new Date(from.getFullYear(), from.getMonth(), 1));

      try {
        const [staffRes, shifts, records, payments, rateRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, job_title, role, is_active")
            .eq("is_active", true)
            .order("full_name", { ascending: true }),
          fetchAllRows(supabase, "shifts", "*", [
            { op: "gte", col: "shift_date", val: since },
          ]),
          fetchAllRows(supabase, "payroll_records", "*", [
            { op: "gte", col: "year", val: from.getFullYear() },
          ]),
          fetchAllRows(
            supabase,
            "payroll_payments",
            "*, profiles!payroll_payments_created_by_fkey(full_name)",
            []
          ),
          supabase.from("rate_changes").select("*"),
        ]);
        if (cancelled) return;
        setStore({
          loaded: true,
          failure: staffRes.error?.message || rateRes.error?.message || null,
          staff: staffRes.data || [],
          shifts,
          records,
          payments,
          rates: rateRes.data || [],
        });
      } catch (err) {
        if (cancelled) return;
        setStore({ loaded: true, failure: err.message || "Could not load payroll." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey, isAdmin]);

  const model = useMemo(() => {
    if (!store.loaded) return null;

    // Months are offered from the shifts that exist, newest first, so an empty
    // month never appears in the picker just because the calendar ticked over.
    const monthsWithShifts = new Set(
      store.shifts.map((s) => String(s.shift_date || "").slice(0, 7)).filter(Boolean)
    );
    const months = [...monthsWithShifts]
      .sort()
      .reverse()
      .slice(0, MONTHS_BACK)
      .reverse()
      .map((key) => {
        const [y, m] = key.split("-").map(Number);
        return {
          id: key,
          key,
          year: y,
          month: m,
          label: `${MONTHS[m - 1]} ${y}`,
          // A month still running has hours that keep changing, so paying it
          // out would be paying against a moving total.
          ended: new Date() >= new Date(y, m, 1),
        };
      });

    const active = months.find((m) => m.key === monthKey) ?? months[months.length - 1];
    if (!active) return { months: [], rows: [], empty: true };

    const rateFor = (employeeId) => {
      const applicable = store.rates
        .filter((r) => r.employee_id === employeeId)
        .filter(
          (r) =>
            r.effective_year < active.year ||
            (r.effective_year === active.year && r.effective_month <= active.month)
        )
        .sort(
          (a, b) =>
            b.effective_year - a.effective_year || b.effective_month - a.effective_month
        );
      return applicable[0] ?? null;
    };

    // Everyone who worked, whatever their role. An owner who takes shifts is
    // owed for them, and excluding them by title would quietly lose the hours.
    const rows = store.staff
      .map((person) => {
        const shifts = store.shifts.filter(
          (s) => s.employee_id === person.id && String(s.shift_date || "").slice(0, 7) === active.key
        );
        const hours = round2(shifts.reduce((a, s) => a + paidHours(s), 0));

        const record = store.records.find(
          (r) =>
            r.employee_id === person.id && r.year === active.year && r.month === active.month
        );
        const effective = rateFor(person.id);
        const rate = Number(record?.hourly_rate ?? effective?.hourly_rate ?? 0);
        const bonus = Number(record?.monthly_bonus ?? effective?.monthly_bonus ?? 0);
        const gross = round2(hours * rate + bonus);

        // amount_paid and status are kept in step by a database trigger on
        // payroll_payments — recomputing them here would only invent a second
        // opinion that drifts from the one the database acts on.
        const paid = Number(record?.amount_paid ?? 0);
        const remaining = round2(Math.max(0, gross - paid));
        const dbStatus = record?.status ?? null;

        // The trigger judges against gross_expected as it was when the record
        // was written. Shifts added since then make the real total higher, so
        // "paid" and "still owed" can both be true at once — and that is the
        // case worth naming rather than papering over.
        const staleTotal =
          dbStatus === "paid" && remaining > 0.005 ? round2(gross - Number(record.gross_expected ?? gross)) : 0;

        const payments = record
          ? store.payments
              .filter((p) => p.payroll_id === record.id)
              .sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)))
          : [];

        return {
          person,
          record,
          shifts: shifts.length,
          hours,
          rate,
          bonus,
          gross,
          paid,
          remaining,
          status,
          payments,
          dbStatus,
          staleTotal,
          progress: gross > 0 ? Math.min(100, (paid / gross) * 100) : 0,
          settled: remaining <= 0.005 && gross > 0,
        };
      })
      .filter((r) => r.shifts > 0 || r.gross > 0 || r.paid > 0);

    const totals = rows.reduce(
      (a, r) => ({
        gross: a.gross + r.gross,
        paid: a.paid + r.paid,
        remaining: a.remaining + r.remaining,
      }),
      { gross: 0, paid: 0, remaining: 0 }
    );
    const owing = rows.filter((r) => r.remaining > 0.005).length;

    return { months, active, rows, totals, owing, empty: rows.length === 0 };
  }, [store, monthKey]);

  // ── Writes ───────────────────────────────────────────────────────────────

  const openPayPanel = (row) => {
    setPanel({
      row,
      amount: row.remaining > 0 ? row.remaining.toFixed(2) : "",
      date: fmtDay(new Date()),
      note: "",
      error: "",
    });
  };

  const logPayment = async () => {
    if (!panel) return;
    const { row } = panel;
    const amount = Number(String(panel.amount).trim().replace(",", "."));

    if (!Number.isFinite(amount) || amount <= 0) {
      setPanel({ ...panel, error: "Enter an amount greater than zero." });
      return;
    }
    if (amount > row.remaining + 0.005) {
      setPanel({
        ...panel,
        error: `That is more than the ${euro2(row.remaining)} still owed.`,
      });
      return;
    }

    setSaving(true);
    let payrollId = row.record?.id;

    // The record is created on first payment, not up front — an unpaid month
    // has nothing to record yet.
    if (!payrollId) {
      const { data, error } = await supabase
        .from("payroll_records")
        .insert({
          employee_id: row.person.id,
          year: model.active.year,
          month: model.active.month,
          total_hours: row.hours,
          hourly_rate: row.rate,
          monthly_bonus: row.bonus,
          gross_expected: row.gross,
          amount_paid: 0,
          status: "unpaid",
          updated_by: user?.id,
        })
        .select()
        .single();
      if (error) {
        setSaving(false);
        setPanel({ ...panel, error: error.message || "Could not create the payroll record." });
        return;
      }
      payrollId = data.id;
    } else if (Math.abs(Number(row.record.gross_expected ?? 0) - row.gross) > 0.005) {
      // Shifts may have moved since the record was made; the trigger decides
      // "paid" against gross_expected, so it has to agree with the hours.
      await supabase
        .from("payroll_records")
        .update({
          total_hours: row.hours,
          gross_expected: row.gross,
          updated_by: user?.id,
        })
        .eq("id", payrollId);
    }

    const { error } = await supabase.from("payroll_payments").insert({
      payroll_id: payrollId,
      amount,
      paid_at: panel.date,
      payment_note: panel.note.trim() || null,
      created_by: user?.id,
    });
    setSaving(false);

    if (error) {
      setPanel({ ...panel, error: error.message || "Could not log the payment." });
      return;
    }

    setPanel(null);
    setOpen((o) => ({ ...o, [row.person.id]: true }));
    setToast({ type: "ok", message: `${euro2(amount)} logged for ${row.person.full_name}` });
    reload();
  };

  const voidPayment = async (payment) => {
    const { error } = await supabase.from("payroll_payments").delete().eq("id", payment.id);
    if (error) {
      setToast({ type: "error", message: "Could not void the payment" });
      return;
    }
    setToast({ type: "ok", message: "Payment voided" });
    reload();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Payroll" />
        <EmptyState
          title="Payroll is admin only"
          body="Your own hours and payments are on My Payroll."
        />
      </div>
    );
  }

  if (store.failure) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Payroll" />
        <EmptyState
          icon={TriangleAlert}
          title="Could not load payroll"
          body={store.failure}
          action="Try again"
          onAction={reload}
        />
      </div>
    );
  }

  if (!model) {
    return <LoadingState kpis={4} shape="list" line="LOADING STAFF · SHIFTS · PAYMENTS" />;
  }

  if (!model.active) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Payroll" sub="Hours worked, what each person is owed, and what has been paid" />
        <EmptyState
          title="No shifts on record"
          body="Nobody has worked a shift yet, so there is nothing to pay. Add shifts on the calendar and the month appears here."
        />
      </div>
    );
  }

  const header = (
    <PageHeader
      title="Payroll"
      sub="Hours worked, what each person is owed, and what has been paid"
      right={
        <Segmented
          options={model.months.map((m) => ({ id: m.id, label: m.label }))}
          value={model.active.id}
          onChange={setMonthKey}
        />
      }
    />
  );

  const cols =
    "gap-x-3 grid-cols-[minmax(0,1fr)_58px_86px_30px] md:grid-cols-[minmax(0,1.2fr)_60px_58px_84px_minmax(120px,1fr)_82px_112px_30px]";

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}

      {!model.active.ended && (
        <div className="flex items-start gap-2.5 px-4 py-3 border border-line rounded-[10px] bg-wash-light">
          <TriangleAlert size={15} strokeWidth={2} className="text-warn-ink shrink-0 mt-px" />
          <span className="text-[13px] flex-1 min-w-0 text-pretty">
            {model.active.label} is still running — hours keep changing, so payments open
            once the month closes.
          </span>
        </div>
      )}

      {/* Totals */}
      <Card className="grid grid-cols-2 md:grid-cols-4">
        {[
          ["GROSS", euro(model.totals.gross), "hours plus bonuses"],
          ["PAID", euro(model.totals.paid), "logged so far"],
          [
            "OUTSTANDING",
            euro(model.totals.remaining),
            model.owing === 0
              ? "everyone settled"
              : `${model.owing} of ${model.rows.length} still owed`,
          ],
          ["MONTH", model.active.label, `${model.rows.length} people on the books`],
        ].map(([label, value, sub], i) => (
          <div
            key={label}
            className={`px-4 py-3.5 ${i < 3 ? "md:border-r" : ""} ${i < 2 ? "border-b md:border-b-0" : ""} ${
              i === 2 ? "border-b md:border-b-0" : ""
            } border-line`}
          >
            <div className="font-mono text-[10px] tracking-[0.06em] text-subtle">{label}</div>
            <div className="text-[24px] font-semibold tracking-[-0.03em] mt-1">{value}</div>
            <div className="text-[11px] text-subtle mt-[3px]">{sub}</div>
          </div>
        ))}
      </Card>

      {model.empty ? (
        <EmptyState
          title={`No shifts logged in ${model.active.label}`}
          body="Nobody worked a shift in this month, so there is nothing to pay. Check the schedule if that looks wrong."
        />
      ) : (
        <Card>
          <div
            className={`md:hidden grid gap-y-2 px-4 py-3 font-mono text-[11px] tracking-[0.05em] text-muted ${cols}`}
          >
            <span>EMPLOYEE</span>
            <span className="text-right">HOURS</span>
            <span className="text-right">OWED</span>
            <span />
          </div>
          <div
            className={`hidden md:grid gap-y-2 px-4 py-3 font-mono text-[11px] tracking-[0.05em] text-muted ${cols}`}
          >
            <span>EMPLOYEE</span>
            <span className="text-right">HOURS</span>
            <span className="text-right">RATE</span>
            <span className="text-right">GROSS</span>
            <span>PAID</span>
            <span className="text-right">OWED</span>
            <span />
            <span />
          </div>

          {model.rows.map((r) => {
            const isOpen = !!open[r.person.id];
            const canPay = model.active.ended && r.remaining > 0.005;
            return (
              <div key={r.person.id}>
                <div className={`grid gap-y-2 px-4 py-2.5 border-t border-line items-center ${cols}`}>
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-wash text-muted font-mono text-[10px] flex items-center justify-center shrink-0">
                      {String(r.person.full_name)
                        .split(" ")
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium truncate">
                        {r.person.full_name}
                      </div>
                      <div className="text-[11px] text-muted truncate">
                        {r.person.job_title || "Employee"}
                      </div>
                    </div>
                  </div>

                  <span className="font-mono text-[13px] tabular-nums text-right">
                    {r.hours.toFixed(1)}h
                  </span>
                  <span className="hidden md:block font-mono text-[13px] tabular-nums text-right text-muted">
                    {r.rate ? euro2(r.rate) : "—"}
                  </span>
                  <span className="hidden md:block font-mono text-[13px] tabular-nums text-right">
                    {euro(r.gross)}
                  </span>

                  <div className="hidden md:block min-w-0">
                    <div className="h-1.5 bg-wash rounded-full overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${r.progress}%`,
                          background: r.settled
                            ? "var(--color-ink-strong)"
                            : r.paid > 0
                              ? "var(--color-warn)"
                              : "var(--color-line)",
                        }}
                      />
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="font-mono text-[12px] tabular-nums">{euro(r.paid)}</span>
                      <span
                        className="text-[11px]"
                        style={{
                          color: r.settled
                            ? "var(--color-muted)"
                            : r.paid > 0
                              ? "var(--color-warn-ink)"
                              : "var(--color-danger)",
                        }}
                        title={
                          r.staleTotal > 0
                            ? `Marked paid against the total recorded then; hours since have added ${euro2(r.staleTotal)}.`
                            : undefined
                        }
                      >
                        {r.settled
                          ? "Paid"
                          : r.staleTotal > 0
                            ? "Paid · hours changed"
                            : r.paid > 0
                              ? "Partial"
                              : "Unpaid"}
                      </span>
                    </div>
                  </div>

                  <span className="font-mono text-[13px] tabular-nums text-right font-medium">
                    {r.remaining <= 0.005
                      ? "—"
                      : r.remaining < 1
                        ? euro2(r.remaining)
                        : euro(r.remaining)}
                  </span>

                  <div className="hidden md:block">
                    {canPay ? (
                      <button
                        onClick={() => openPayPanel(r)}
                        className="w-full h-[30px] px-2.5 rounded-md bg-ink-strong text-surface text-[12px] font-medium hover:bg-ink"
                      >
                        Log payment
                      </button>
                    ) : r.settled ? (
                      <span className="flex items-center justify-center gap-1.5 text-[12px] text-muted">
                        <Check size={13} strokeWidth={2.5} />
                        Settled
                      </span>
                    ) : (
                      <span className="block text-center text-[12px] text-faint">
                        opens {model.active.label.split(" ")[0]} end
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setOpen((o) => ({ ...o, [r.person.id]: !o[r.person.id] }))}
                    className="flex justify-end text-subtle hover:text-ink"
                  >
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      style={{
                        transform: isOpen ? "rotate(180deg)" : "none",
                        transition: "transform .15s ease",
                      }}
                    />
                  </button>
                </div>

                {isOpen && (
                  <div className="px-4 md:pl-[54px] py-3 bg-wash-light border-t border-line">
                    <div className="font-mono text-[10px] tracking-[0.06em] text-subtle mb-2">
                      {r.payments.length
                        ? `${r.payments.length} payment${r.payments.length === 1 ? "" : "s"}`
                        : "No payments yet"}
                    </div>

                    {r.payments.map((p) => (
                      <div key={p.id} className="flex items-start gap-3 mb-2">
                        <span className="font-mono text-[13px] tabular-nums w-[68px] shrink-0">
                          {euro2(p.amount)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] text-muted">
                            {p.paid_at}
                            {p.profiles?.full_name ? ` · by ${p.profiles.full_name}` : ""}
                          </div>
                          {p.payment_note && (
                            <div className="text-[12px] text-muted mt-0.5 text-pretty">
                              {p.payment_note}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => voidPayment(p)}
                          className="h-[26px] px-2 border border-line rounded-md bg-surface text-[12px] text-muted hover:border-danger hover:text-danger shrink-0"
                        >
                          Void
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-5 mt-3.5 pt-3 border-t border-line">
                      {[
                        ["BONUS", r.bonus ? euro2(r.bonus) : "—"],
                        ["SHIFTS", r.shifts],
                        ["HOURS", `${r.hours.toFixed(1)}h`],
                        ["RATE", r.rate ? euro2(r.rate) : "—"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <span className="font-mono text-[10px] tracking-[0.06em] text-subtle">
                            {label}
                          </span>
                          <div className="font-mono text-[13px]">{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* The pay button lives in the row on desktop; on phone the
                        row has no space for it, so it belongs here. */}
                    {canPay && (
                      <button
                        onClick={() => openPayPanel(r)}
                        className="md:hidden w-full h-9 mt-3 rounded-md bg-ink-strong text-surface text-[13px] font-medium"
                      >
                        Log payment
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div
            className={`grid gap-y-2 px-4 py-3 border-t-2 border-line items-center font-mono text-[13px] ${cols}`}
          >
            <span className="tracking-[0.05em] text-muted text-[11px]">TOTAL</span>
            <span className="tabular-nums text-right">
              {model.rows.reduce((a, r) => a + r.hours, 0).toFixed(1)}h
            </span>
            <span className="hidden md:block" />
            <span className="hidden md:block tabular-nums text-right font-medium">
              {euro(model.totals.gross)}
            </span>
            <span className="hidden md:block tabular-nums">{euro(model.totals.paid)}</span>
            <span className="tabular-nums text-right font-medium">
              {euro(model.totals.remaining)}
            </span>
            <span className="hidden md:block" />
            <span />
          </div>
        </Card>
      )}

      {/* Log payment */}
      <SidePanel
        open={!!panel}
        eyebrow="LOG PAYMENT"
        title={panel?.row.person.full_name ?? ""}
        onClose={() => setPanel(null)}
        footer={
          <div className="px-4 py-3 flex gap-2">
            <button
              onClick={logPayment}
              disabled={saving}
              className="flex-1 min-h-9 rounded-md bg-ink-strong text-surface text-[13px] font-medium hover:bg-ink disabled:opacity-50"
            >
              {saving ? "Logging…" : "Log payment"}
            </button>
            <button
              onClick={() => setPanel(null)}
              className="min-h-9 px-3 border border-line rounded-md bg-surface text-[13px] hover:border-line-strong"
            >
              Cancel
            </button>
          </div>
        }
      >
        {panel && (
          <div className="p-4 flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-3 border border-line rounded-lg px-3 py-2.5 bg-wash-light">
              <span className="text-[13px] text-muted">
                Still owed for {model.active.label}
              </span>
              <span className="text-[17px] font-semibold tracking-[-0.02em]">
                {euro2(panel.row.remaining)}
              </span>
            </div>

            <div>
              <label className={FIELD_LABEL}>Amount</label>
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  value={panel.amount}
                  onChange={(e) => setPanel({ ...panel, amount: e.target.value, error: "" })}
                  placeholder="0.00"
                  className={FIELD_INPUT}
                />
                <button
                  onClick={() =>
                    setPanel({ ...panel, amount: panel.row.remaining.toFixed(2), error: "" })
                  }
                  className="h-9 px-3 border border-line rounded-md bg-surface text-[13px] whitespace-nowrap hover:border-line-strong"
                >
                  Pay all
                </button>
              </div>
            </div>

            <div>
              <label className={FIELD_LABEL}>Paid on</label>
              <input
                type="date"
                value={panel.date}
                onChange={(e) => setPanel({ ...panel, date: e.target.value, error: "" })}
                className={FIELD_INPUT}
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>Note</label>
              <textarea
                value={panel.note}
                onChange={(e) => setPanel({ ...panel, note: e.target.value })}
                rows={2}
                placeholder="Optional — cash, transfer, advance"
                className="w-full px-2.5 py-2 border border-line rounded-md bg-surface text-[13px] outline-none focus:border-ink-strong resize-none placeholder:text-faint"
              />
            </div>

            {panel.error && (
              <p className="text-[12px] text-danger bg-[rgba(238,0,0,0.04)] border border-[rgba(238,0,0,0.15)] rounded-md px-3 py-2 text-pretty">
                {panel.error}
              </p>
            )}
          </div>
        )}
      </SidePanel>

      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
