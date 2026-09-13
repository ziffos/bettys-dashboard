"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Download, TriangleAlert, Wallet } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import {
  Card,
  CardHeader,
  EmptyState,
  LoadingState,
  PageHeader,
} from "../../components/ui";
import { MONTHS, euro, euro2, fetchAllRows, parseDay } from "../../lib/format";
import { generatePayslip } from "../../lib/payslip";

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

export default function MyPayrollPage() {
  const { user, profile } = useAuth();
  const [store, setStore] = useState({ loaded: false, failure: null });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const [shifts, records, payments, rates] = await Promise.all([
          fetchAllRows(supabase, "shifts", "*", [
            { op: "eq", col: "employee_id", val: user.id },
          ]),
          fetchAllRows(supabase, "payroll_records", "*", [
            { op: "eq", col: "employee_id", val: user.id },
          ]),
          fetchAllRows(
            supabase,
            "payroll_payments",
            "*, payroll_records!inner(employee_id)",
            [{ op: "eq", col: "payroll_records.employee_id", val: user.id }]
          ),
          fetchAllRows(supabase, "rate_changes", "*", [
            { op: "eq", col: "employee_id", val: user.id },
          ]),
        ]);
        if (cancelled) return;
        setStore({ loaded: true, failure: null, shifts, records, payments, rates });
      } catch (err) {
        if (cancelled) return;
        console.error("My Payroll fetch failed:", err);
        setStore({ loaded: true, failure: err.message || "Could not load your payroll." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const model = useMemo(() => {
    if (!store.loaded || store.failure) return null;

    const byMonth = new Map();
    for (const s of store.shifts) {
      const key = String(s.shift_date || "").slice(0, 7);
      if (!key) continue;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(s);
    }

    const rateAt = (year, month) => {
      const applicable = store.rates
        .filter(
          (r) =>
            r.effective_year < year ||
            (r.effective_year === year && r.effective_month <= month)
        )
        .sort(
          (a, b) =>
            b.effective_year - a.effective_year || b.effective_month - a.effective_month
        );
      return applicable[0] ?? null;
    };

    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;

    const months = [...byMonth.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, shifts]) => {
        const [year, month] = key.split("-").map(Number);
        const hours = round2(shifts.reduce((a, s) => a + paidHours(s), 0));
        const record = store.records.find((r) => r.year === year && r.month === month);
        const effective = rateAt(year, month);
        const rate = Number(record?.hourly_rate ?? effective?.hourly_rate ?? 0);
        const bonus = Number(record?.monthly_bonus ?? effective?.monthly_bonus ?? 0);
        const gross = round2(hours * rate + bonus);
        const paid = Number(record?.amount_paid ?? 0);
        const remaining = round2(Math.max(0, gross - paid));
        const running = year === thisYear && month === thisMonth;

        return {
          key,
          year,
          month,
          label: `${MONTHS[month - 1]} ${year}`,
          shifts: [...shifts].sort((a, b) =>
            String(a.shift_date).localeCompare(String(b.shift_date))
          ),
          shiftCount: shifts.length,
          totalHours: hours,
          hourlyRate: rate,
          monthlyBonus: bonus,
          bonusDescription: record?.bonus_description ?? effective?.bonus_description ?? null,
          grossExpected: gross,
          amountPaid: paid,
          remaining,
          running,
          status: running
            ? "Still running"
            : paid <= 0
              ? "Not paid yet"
              : remaining <= 0.005
                ? "Paid in full"
                : "Partly paid",
          progress: gross > 0 ? Math.min(100, (paid / gross) * 100) : 0,
          payments: store.payments
            .filter((p) => p.payroll_id === record?.id)
            .sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at))),
        };
      });

    const current = rateAt(thisYear, thisMonth);
    const upcoming = store.rates
      .filter(
        (r) =>
          r.effective_year > thisYear ||
          (r.effective_year === thisYear && r.effective_month > thisMonth)
      )
      .sort(
        (a, b) =>
          a.effective_year - b.effective_year || a.effective_month - b.effective_month
      )[0];

    return { months, currentRate: current, upcoming };
  }, [store]);

  if (store.failure) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="My payroll" />
        <EmptyState
          icon={TriangleAlert}
          title="Could not load your payroll"
          body={store.failure}
        />
      </div>
    );
  }

  if (!model) {
    return <LoadingState kpis={0} shape="list" line="LOADING YOUR SHIFTS AND PAYMENTS" />;
  }

  const header = (
    <PageHeader
      title="My payroll"
      sub={
        model.currentRate
          ? `${profile?.full_name ?? ""} · ${euro2(model.currentRate.hourly_rate)} an hour`
          : (profile?.full_name ?? "")
      }
    />
  );

  if (model.months.length === 0) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        {header}
        <EmptyState
          icon={Wallet}
          title="No shifts on record yet"
          body="Once your first shift is logged it shows up here, with the pay for it."
        />
      </div>
    );
  }

  const active = model.months.find((m) => m.key === selected) ?? model.months[0];

  const headline = active.running
    ? `${euro(active.grossExpected)} so far`
    : active.remaining > 0.005
      ? `${active.remaining < 1 ? euro2(active.remaining) : euro(active.remaining)} still owed`
      : `${euro(active.grossExpected)} paid`;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}

      {/* The month in focus */}
      <Card>
        <div className="px-4 py-4">
          <div className="font-mono text-[10px] tracking-[0.06em] text-subtle">
            {active.label}
          </div>
          <div className="flex items-baseline gap-3 flex-wrap mt-1.5">
            <span className="text-[36px] md:text-[44px] font-semibold tracking-[-0.03em] leading-none">
              {headline}
            </span>
            <span
              className="text-[13px]"
              style={{
                color: active.running
                  ? "var(--color-muted)"
                  : active.remaining > 0.005
                    ? "var(--color-warn-ink)"
                    : "var(--color-muted)",
              }}
            >
              {active.status}
            </span>
          </div>
          <p className="mt-2.5 text-[13px] text-muted text-pretty">
            {active.shiftCount} shift{active.shiftCount === 1 ? "" : "s"} ·{" "}
            {active.totalHours.toFixed(1)}h · gross {euro(active.grossExpected)} · paid{" "}
            {euro(active.amountPaid)} · bonus{" "}
            {active.monthlyBonus ? euro2(active.monthlyBonus) : "—"}
          </p>
        </div>

        <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-3 flex-wrap">
          {model.upcoming ? (
            <span className="flex items-center gap-1.5 text-[13px] text-muted">
              <ArrowUpRight size={14} strokeWidth={2} className="text-accent shrink-0" />
              Your rate goes to {euro2(model.upcoming.hourly_rate)} an hour from{" "}
              {MONTHS[model.upcoming.effective_month - 1]} {model.upcoming.effective_year}
            </span>
          ) : (
            <span className="text-[13px] text-subtle">No rate change scheduled.</span>
          )}
          <button
            onClick={async () => {
              setBusy(true);
              try {
                await generatePayslip(active, profile ?? {});
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="flex items-center gap-2 h-8 px-3 border border-line rounded-md bg-surface text-[13px] font-medium hover:border-line-strong disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download size={14} strokeWidth={2} />
            {busy ? "Preparing…" : "Download payslip"}
          </button>
        </div>
      </Card>

      {/* Every month */}
      <Card>
        <CardHeader title="Every month" sub="Pick a month to see its shifts and payments" />
        {model.months.map((m) => {
          const on = m.key === active.key;
          return (
            <button
              key={m.key}
              onClick={() => setSelected(m.key)}
              className={`w-full text-left px-4 py-3 border-t border-line flex items-center gap-3 flex-wrap md:flex-nowrap hover:bg-wash-light ${
                on ? "bg-wash-light" : ""
              }`}
            >
              <div className="w-[150px] shrink-0">
                <div className="text-[13px] font-medium">{m.label}</div>
                <div className="font-mono text-[11px] text-subtle">
                  {m.shiftCount} shifts · {m.totalHours.toFixed(1)}h
                </div>
              </div>

              <div className="flex-1 min-w-[120px]">
                <div className="h-1.5 bg-wash rounded-full overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${m.progress}%`,
                      background:
                        m.status === "Paid in full"
                          ? "var(--color-ink-strong)"
                          : m.amountPaid > 0
                            ? "var(--color-warn)"
                            : "var(--color-line)",
                    }}
                  />
                </div>
                <div className="font-mono text-[11px] text-subtle mt-1">
                  {m.remaining > 0.005 && m.remaining < 1
                    ? `${euro2(m.amountPaid)} of ${euro2(m.grossExpected)}`
                    : `${euro(m.amountPaid)} of ${euro(m.grossExpected)}`}
                </div>
              </div>

              <span
                className="text-[12px] w-[92px] text-right shrink-0"
                style={{
                  color:
                    m.status === "Paid in full" || m.running
                      ? "var(--color-muted)"
                      : m.status === "Partly paid"
                        ? "var(--color-warn-ink)"
                        : "var(--color-danger)",
                }}
              >
                {m.status}
              </span>
            </button>
          );
        })}
      </Card>

      {/* Shifts and payments for the month in focus */}
      <div className="grid gap-3 items-start md:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader
            title={`Shifts in ${active.label}`}
            sub={`${active.shiftCount} shift${active.shiftCount === 1 ? "" : "s"} · ${active.totalHours.toFixed(1)}h after breaks`}
          />
          {active.shifts.map((s) => {
            const d = parseDay(s.shift_date);
            return (
              <div
                key={s.id}
                className="px-4 py-2.5 border-t border-line flex items-center gap-3 hover:bg-wash-light"
              >
                <span className="text-[13px] w-[86px] shrink-0">
                  {d.toLocaleDateString("en-GB", { weekday: "short" })} {d.getDate()}{" "}
                  {MONTHS[d.getMonth()]}
                </span>
                <span className="font-mono text-[12px] text-muted flex-1 min-w-0">
                  {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                </span>
                <span className="font-mono text-[11px] text-subtle shrink-0">
                  {s.break_minutes ?? 0} min
                </span>
                <span className="font-mono text-[13px] tabular-nums w-[52px] text-right shrink-0">
                  {paidHours(s).toFixed(1)}h
                </span>
              </div>
            );
          })}
        </Card>

        <Card>
          <CardHeader title="Payments" sub="What has landed for this month" />
          {active.payments.length === 0 ? (
            <p className="px-4 pb-4 pt-3 text-[13px] text-muted border-t border-line text-pretty">
              {active.running
                ? "The month is still running, so nothing has been paid out yet."
                : "Nothing has been paid for this month yet."}
            </p>
          ) : (
            active.payments.map((p) => (
              <div key={p.id} className="px-4 py-2.5 border-t border-line">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[13px] tabular-nums">
                    {euro2(p.amount)}
                  </span>
                  <span className="text-[12px] text-muted flex-1">{p.paid_at}</span>
                </div>
                {p.payment_note && (
                  <p className="text-[12px] text-subtle mt-1 text-pretty">{p.payment_note}</p>
                )}
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
