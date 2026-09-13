"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Plus, TriangleAlert } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/AuthContext";
import {
  Card,
  CardHeader,
  EmptyState,
  FIELD_INPUT,
  FIELD_LABEL,
  LoadingState,
  PageHeader,
  Segmented,
  SidePanel,
  Toast,
} from "../../components/ui";
import { MONTHS, euro, fmtDay, parseDay } from "../../lib/format";

const VIEWS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

/** Betty's is busiest in the evening; this is where cover actually matters. */
const PEAK_HOURS = [19, 20];
const MIN_AT_PEAK = 2;

/** The colours the roster uses for people, in assignment order. */
const PERSON_COLORS = [
  "#171717", "#0070f3", "#7928ca", "#f5a623", "#50e3c2", "#8f8f8f",
  "#ee0000", "#b26a00",
];

const PATTERNS = [
  { label: "Open 10:00–16:30", start: "10:00", end: "16:30", brk: 30 },
  { label: "Mid 15:00–22:00", start: "15:00", end: "22:00", brk: 30 },
  { label: "Close 17:00–23:30", start: "17:00", end: "23:30", brk: 30 },
];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_HEAD = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const toMinutes = (time) => {
  const [h, m] = String(time || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toClock = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Monday of the week a date falls in. */
function mondayOf(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

const paidHours = (shift) =>
  Math.max(0, toMinutes(shift.end_time) - toMinutes(shift.start_time) - (shift.break_minutes || 0)) /
  60;

export default function CalendarPage() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [view, setView] = useState("week");
  const [anchor, setAnchor] = useState(() => mondayOf(new Date()));
  const [store, setStore] = useState({ loaded: false, shifts: [], staff: [], rates: [], failure: null });
  const [panel, setPanel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [shiftRes, staffRes, rateRes] = await Promise.all([
        supabase
          .from("shifts")
          .select("*, profiles!shifts_employee_id_fkey(full_name)")
          .order("shift_date", { ascending: false })
          .limit(1000),
        supabase.from("profiles").select("id, full_name, role, is_active").eq("is_active", true),
        supabase.from("rate_changes").select("*"),
      ]);
      if (cancelled) return;
      const failure =
        shiftRes.error?.message || staffRes.error?.message || rateRes.error?.message || null;
      setStore({
        loaded: true,
        shifts: shiftRes.data || [],
        staff: staffRes.data || [],
        rates: rateRes.data || [],
        failure,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const model = useMemo(() => {
    if (!store.loaded) return null;

    const colorOf = {};
    const nameOf = {};
    [...store.staff]
      .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)))
      .forEach((p, i) => {
        colorOf[p.id] = PERSON_COLORS[i % PERSON_COLORS.length];
        nameOf[p.id] = p.full_name;
      });

    /** The hourly rate in force for an employee in a given month. */
    const rateFor = (employeeId, day) => {
      const [y, m] = day.split("-").map(Number);
      const applicable = store.rates
        .filter((r) => r.employee_id === employeeId)
        .filter(
          (r) =>
            r.effective_year < y || (r.effective_year === y && r.effective_month <= m)
        )
        .sort(
          (a, b) =>
            b.effective_year - a.effective_year || b.effective_month - a.effective_month
        );
      return applicable.length ? Number(applicable[0].hourly_rate || 0) : null;
    };

    const shiftsOn = (day) =>
      store.shifts
        .filter((s) => s.shift_date === day)
        .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));

    // ── Week.
    const weekDays = Array.from({ length: 7 }, (_, i) =>
      fmtDay(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + i))
    );
    const weekShifts = weekDays.flatMap(shiftsOn);

    // The axis covers the hours actually worked, rounded out to the hour, not a
    // fixed 10–24 window. A shop that opens at 08:00 or runs to midnight would
    // otherwise have its shifts clipped at the edge of the chart.
    const starts = weekShifts.map((s) => toMinutes(s.start_time));
    const ends = weekShifts.map((s) => toMinutes(s.end_time));
    const axisFrom = weekShifts.length ? Math.floor(Math.min(...starts) / 60) * 60 : 10 * 60;
    const axisTo = weekShifts.length ? Math.ceil(Math.max(...ends) / 60) * 60 : 24 * 60;
    const axisSpan = Math.max(60, axisTo - axisFrom);
    const axisHours = [];
    for (let m = axisFrom; m <= axisTo; m += 60) axisHours.push(m / 60);

    const dayRows = weekDays.map((day) => {
      const list = shiftsOn(day);
      let hours = 0;
      let cost = 0;
      const lanes = [];
      const bars = list.map((s) => {
        const start = toMinutes(s.start_time);
        const end = toMinutes(s.end_time);
        const h = paidHours(s);
        const rate = s.hourly_rate != null ? Number(s.hourly_rate) : rateFor(s.employee_id, day);
        hours += h;
        cost += h * (rate ?? 0);
        let lane = 0;
        while (lanes[lane] !== undefined && lanes[lane] > start) lane++;
        lanes[lane] = end;
        const width = ((Math.min(axisTo, end) - Math.max(axisFrom, start)) / axisSpan) * 100;
        return {
          shift: s,
          lane,
          left: `${((Math.max(axisFrom, start) - axisFrom) / axisSpan) * 100}%`,
          width: `${Math.max(1, width)}%`,
          color: colorOf[s.employee_id] ?? "#8f8f8f",
          name: (s.profiles?.full_name ?? nameOf[s.employee_id] ?? "?").split(" ")[0],
          clock: `${s.start_time?.slice(0, 5)}–${s.end_time?.slice(0, 5)}`,
          wide: width > 24,
          medium: width > 11,
        };
      });

      // Cover per hour, and how thin the evening is.
      const cover = axisHours.slice(0, -1).map((h) => ({
        hour: h,
        count: list.filter((s) => toMinutes(s.start_time) <= h * 60 && toMinutes(s.end_time) > h * 60)
          .length,
      }));
      const peak = Math.min(
        ...PEAK_HOURS.map(
          (h) =>
            list.filter(
              (s) => toMinutes(s.start_time) <= h * 60 && toMinutes(s.end_time) > h * 60
            ).length
        )
      );

      const d = parseDay(day);
      return {
        day,
        dow: DOW[d.getDay()],
        date: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
        isToday: day === fmtDay(new Date()),
        bars,
        list,
        cover,
        laneHeight: Math.max(30, lanes.length * 26 + 4),
        hours,
        cost,
        people: list.length,
        peak,
        // A day with nobody rostered at all is closed, not understaffed.
        // Counting it as short makes the headline meaningless — Betty's shuts
        // on Sundays, and a shut day is not a gap to fix.
        closed: list.length === 0,
        short: list.length > 0 && peak < MIN_AT_PEAK,
        tight: list.length > 0 && peak === MIN_AT_PEAK,
      };
    });

    const weekHours = dayRows.reduce((a, d) => a + d.hours, 0);
    const weekCost = dayRows.reduce((a, d) => a + d.cost, 0);
    const shortDays = dayRows.filter((d) => d.short).length;

    // ── Month grid, Monday-first.
    const monthAnchor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const lead = (monthAnchor.getDay() + 6) % 7;
    const monthCells = Array.from({ length: 42 }, (_, i) => {
      const d = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1 - lead + i);
      const day = fmtDay(d);
      const list = shiftsOn(day);
      return {
        day,
        num: d.getDate(),
        inMonth: d.getMonth() === monthAnchor.getMonth(),
        isToday: day === fmtDay(new Date()),
        chips: list.slice(0, 4).map((s) => ({
          shift: s,
          label: `${(s.profiles?.full_name ?? nameOf[s.employee_id] ?? "?").split(" ")[0]} ${s.start_time?.slice(0, 5)}`,
          color: colorOf[s.employee_id] ?? "#8f8f8f",
        })),
        more: Math.max(0, list.length - 4),
      };
    }).slice(0, lead + new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0).getDate() > 35 ? 42 : 35);

    // The summary describes whatever is on screen, so switching to Month does
    // not leave the week's hours sitting under a month of shifts.
    const monthDays = [];
    {
      const m = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
      for (let i = 1; i <= last; i++) {
        monthDays.push(fmtDay(new Date(m.getFullYear(), m.getMonth(), i)));
      }
    }
    const monthSummary = monthDays.reduce(
      (acc, day) => {
        const list = shiftsOn(day);
        for (const s2 of list) {
          const h = paidHours(s2);
          const rate = s2.hourly_rate != null ? Number(s2.hourly_rate) : rateFor(s2.employee_id, day);
          acc.hours += h;
          acc.cost += h * (rate ?? 0);
        }
        if (list.length > 0) {
          const peak = Math.min(
            ...PEAK_HOURS.map(
              (h) =>
                list.filter(
                  (s2) => toMinutes(s2.start_time) <= h * 60 && toMinutes(s2.end_time) > h * 60
                ).length
            )
          );
          if (peak < MIN_AT_PEAK) acc.short += 1;
        }
        return acc;
      },
      { hours: 0, cost: 0, short: 0 }
    );

    const legend = [...store.staff]
      .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)))
      .map((p) => ({
        id: p.id,
        name: String(p.full_name).split(" ")[0],
        color: colorOf[p.id],
      }));

    return {
      weekDays,
      dayRows,
      axisHours,
      axisFrom,
      axisSpan,
      weekHours,
      weekCost,
      shortDays,
      monthSummary,
      monthDayCount: monthDays.length,
      monthCells,
      monthLabel: `${MONTHS[monthAnchor.getMonth()]} ${monthAnchor.getFullYear()}`,
      legend,
      staff: [...store.staff].sort((a, b) => String(a.full_name).localeCompare(String(b.full_name))),
      rateFor,
      hasAny: store.shifts.length > 0,
      weekEmpty: weekShifts.length === 0,
    };
  }, [store, anchor]);

  // ── Panel ────────────────────────────────────────────────────────────────

  const openPanel = (mode, shift, day) => {
    if (mode === "add") {
      setPanel({
        mode: "add",
        error: "",
        locked: false,
        form: {
          employee_id: isAdmin ? "" : user?.id ?? "",
          shift_date: day ?? fmtDay(new Date()),
          start_time: "15:00",
          end_time: "22:00",
          break_minutes: "30",
          notes: "",
        },
      });
      return;
    }
    setPanel({
      mode: "edit",
      id: shift.id,
      error: "",
      locked: false,
      form: {
        employee_id: shift.employee_id,
        shift_date: shift.shift_date,
        start_time: shift.start_time?.slice(0, 5) ?? "",
        end_time: shift.end_time?.slice(0, 5) ?? "",
        break_minutes: String(shift.break_minutes ?? 0),
        notes: shift.notes ?? "",
      },
    });
  };

  // A month whose payroll has been settled must not move under the payment.
  // Admins may still correct it; everyone else is blocked.
  //
  // Keyed on the two fields that decide the answer rather than the whole form,
  // so typing a note does not re-ask the database.
  const panelEmployee = panel?.form?.employee_id;
  const panelDate = panel?.form?.shift_date;

  useEffect(() => {
    if (!panelEmployee || !panelDate) return;
    let cancelled = false;
    const [year, month] = panelDate.split("-").map(Number);
    (async () => {
      const { data } = await supabase
        .from("payroll_records")
        .select("status")
        .eq("employee_id", panelEmployee)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      if (cancelled) return;
      setPanel((p) =>
        p && p.form.employee_id === panelEmployee && p.form.shift_date === panelDate
          ? { ...p, locked: data?.status === "paid" }
          : p
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [panelEmployee, panelDate]);

  const setField = (key, value) =>
    setPanel((p) => (p ? { ...p, form: { ...p.form, [key]: value }, error: "" } : p));

  const save = async () => {
    if (!panel) return;
    const f = panel.form;
    const fail = (message) => setPanel({ ...panel, error: message });

    if (!f.employee_id) return fail("Pick who is working.");
    if (!f.shift_date) return fail("Pick a date.");

    const start = toMinutes(f.start_time);
    const end = toMinutes(f.end_time);
    const brk = Number(f.break_minutes) || 0;

    if (!f.start_time || !f.end_time) return fail("Enter both a start and an end time.");
    if (start === end) return fail("Start and end cannot be the same time.");
    if (start > end)
      return fail(
        "Shifts crossing midnight are not supported — split them into two, one ending 23:59 and one starting 00:00."
      );
    if (brk >= end - start) return fail(`The break (${brk} min) is longer than the shift itself.`);
    if (end - start > 960) return fail("That is over 16 hours — check the times.");
    if (panel.locked && !isAdmin)
      return fail("This month is locked — a payment has already been logged against it.");

    const rate = model.rateFor(f.employee_id, f.shift_date);
    const payload = {
      employee_id: f.employee_id,
      shift_date: f.shift_date,
      start_time: f.start_time,
      end_time: f.end_time,
      break_minutes: brk,
      notes: f.notes.trim() || null,
      hourly_rate: rate ?? 0,
    };

    setSaving(true);
    const { error } =
      panel.mode === "add"
        ? await supabase.from("shifts").insert({ ...payload, created_by: user?.id })
        : await supabase.from("shifts").update(payload).eq("id", panel.id);
    setSaving(false);

    if (error) {
      const message = error.message || "";
      if (/shifts_employee_date_start_unique|duplicate key/.test(message)) {
        return fail("That person already has a shift starting at this time on this date.");
      }
      return fail(message || "Could not save the shift.");
    }

    setPanel(null);
    setToast({ type: "ok", message: panel.mode === "add" ? "Shift added" : "Shift saved" });
    reload();
  };

  const remove = async () => {
    if (!panel?.id) return;
    if (panel.locked && !isAdmin) {
      setPanel({ ...panel, error: "This month is locked — a payment has already been logged." });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("shifts").delete().eq("id", panel.id);
    setSaving(false);
    if (error) {
      setPanel({ ...panel, error: error.message || "Could not delete the shift." });
      return;
    }
    setPanel(null);
    setToast({ type: "ok", message: "Shift deleted" });
    reload();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (store.failure) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Calendar" />
        <EmptyState
          icon={TriangleAlert}
          title="Could not load the roster"
          body={store.failure}
          action="Try again"
          onAction={reload}
        />
      </div>
    );
  }

  if (!model) {
    return <LoadingState kpis={4} shape="list" line="LOADING SHIFTS · ALL STAFF" />;
  }

  const first = parseDay(model.weekDays[0]);
  const last = parseDay(model.weekDays[6]);
  const weekLabel =
    view === "week"
      ? `${first.getDate()} ${MONTHS[first.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`
      : model.monthLabel;

  const shortCount = view === "week" ? model.shortDays : model.monthSummary.short;

  const step = (delta) => {
    const d = new Date(anchor);
    if (view === "week") d.setDate(d.getDate() + delta * 7);
    else d.setMonth(d.getMonth() + delta);
    setAnchor(view === "week" ? mondayOf(d) : d);
  };

  const header = (
    <PageHeader
      title="Calendar"
      sub={weekLabel}
      right={
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              onClick={() => step(-1)}
              className="w-8 h-8 flex items-center justify-center border border-line rounded-md bg-surface text-muted hover:border-line-strong"
              title={view === "week" ? "Previous week" : "Previous month"}
            >
              <ChevronLeft size={15} strokeWidth={2} />
            </button>
            <button
              onClick={() => setAnchor(view === "week" ? mondayOf(new Date()) : new Date())}
              className="h-8 px-2.5 border border-line rounded-md bg-surface text-[12px] font-medium hover:border-line-strong"
            >
              Today
            </button>
            <button
              onClick={() => step(1)}
              className="w-8 h-8 flex items-center justify-center border border-line rounded-md bg-surface text-muted hover:border-line-strong"
              title={view === "week" ? "Next week" : "Next month"}
            >
              <ChevronRight size={15} strokeWidth={2} />
            </button>
          </div>
          <Segmented options={VIEWS} value={view} onChange={setView} />
          <button
            onClick={() => openPanel("add", null, model.weekDays[0])}
            className="flex items-center gap-[7px] h-8 px-3 rounded-md bg-ink-strong text-surface text-[13px] font-medium hover:bg-ink"
          >
            <Plus size={14} strokeWidth={2} />
            Add shift
          </button>
        </div>
      }
    />
  );

  if (!model.hasAny) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        {header}
        <EmptyState
          title="Nothing is scheduled yet"
          body="No shifts have been added. Add the first one and the week fills in around it."
          action="Add the first shift"
          onAction={() => openPanel("add", null, model.weekDays[0])}
        />
        {renderPanel()}
        <Toast toast={toast} onDone={() => setToast(null)} />
      </div>
    );
  }

  function renderPanel() {
    if (!panel) return null;
    const blocked = panel.locked && !isAdmin;
    return (
      <SidePanel
        open
        title={panel.mode === "add" ? "New shift" : "Edit shift"}
        onClose={() => setPanel(null)}
        footer={
          <div className="px-4 py-3 flex gap-2">
            <button
              onClick={save}
              disabled={saving || blocked}
              className="flex-1 min-h-9 rounded-md bg-ink-strong text-surface text-[13px] font-medium hover:bg-ink disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setPanel(null)}
              className="min-h-9 px-3 border border-line rounded-md bg-surface text-[13px] hover:border-line-strong"
            >
              Cancel
            </button>
            {panel.mode === "edit" && (
              <button
                onClick={remove}
                disabled={saving || blocked}
                className="min-h-9 px-3 border border-line rounded-md bg-surface text-[13px] text-danger hover:border-danger disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </div>
        }
      >
        <div className="p-4 flex flex-col gap-3.5">
          {panel.locked && (
            <div className="flex items-start gap-2 px-3 py-2.5 border border-line rounded-md bg-wash-light">
              <Lock size={13} strokeWidth={2} className="text-warn-ink shrink-0 mt-0.5" />
              <p className="text-[12px] text-muted text-pretty">
                {isAdmin
                  ? "This month has been paid. Changing it will not change what was already paid out."
                  : "This month has been paid, so its shifts are locked. Ask Betty if something is wrong."}
              </p>
            </div>
          )}

          <div>
            <label className={FIELD_LABEL}>Who</label>
            <select
              value={panel.form.employee_id}
              onChange={(e) => setField("employee_id", e.target.value)}
              disabled={!isAdmin}
              className={FIELD_INPUT}
            >
              <option value="">Pick a person</option>
              {model.staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={FIELD_LABEL}>Date</label>
            <input
              type="date"
              value={panel.form.shift_date}
              onChange={(e) => setField("shift_date", e.target.value)}
              className={FIELD_INPUT}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={FIELD_LABEL}>Start</label>
              <input
                type="time"
                value={panel.form.start_time}
                onChange={(e) => setField("start_time", e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>End</label>
              <input
                type="time"
                value={panel.form.end_time}
                onChange={(e) => setField("end_time", e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>Break</label>
              <input
                inputMode="numeric"
                value={panel.form.break_minutes}
                onChange={(e) => setField("break_minutes", e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PATTERNS.map((p) => {
              const on =
                panel.form.start_time === p.start && panel.form.end_time === p.end;
              return (
                <button
                  key={p.label}
                  onClick={() =>
                    setPanel((prev) => ({
                      ...prev,
                      error: "",
                      form: {
                        ...prev.form,
                        start_time: p.start,
                        end_time: p.end,
                        break_minutes: String(p.brk),
                      },
                    }))
                  }
                  className={`h-8 px-2.5 rounded-md border text-[12px] ${
                    on
                      ? "border-ink-strong bg-ink-strong text-surface"
                      : "border-line bg-surface hover:border-line-strong"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div>
            <label className={FIELD_LABEL}>Notes</label>
            <textarea
              value={panel.form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={2}
              placeholder="Anything the shift needs to know"
              className="w-full px-2.5 py-2 border border-line rounded-md bg-surface text-[13px] outline-none focus:border-ink-strong resize-none placeholder:text-faint"
            />
          </div>

          {(() => {
            const start = toMinutes(panel.form.start_time);
            const end = toMinutes(panel.form.end_time);
            const brk = Number(panel.form.break_minutes) || 0;
            const h = (end - start - brk) / 60;
            if (!(h > 0)) return null;
            const rate = model.rateFor(panel.form.employee_id, panel.form.shift_date);
            return (
              <p className="text-[12px] text-subtle">
                {h.toFixed(1)} paid hours
                {rate ? ` · ${euro(h * rate)} at €${rate.toFixed(2)} an hour` : ""}
              </p>
            );
          })()}

          {panel.error && (
            <p className="text-[12px] text-danger bg-[rgba(238,0,0,0.04)] border border-[rgba(238,0,0,0.15)] rounded-md px-3 py-2 text-pretty">
              {panel.error}
            </p>
          )}
        </div>
      </SidePanel>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {header}

      {/* Summary for whichever period is on screen */}
      <Card className="grid grid-cols-2 md:grid-cols-3">
        <div className="px-4 py-3.5 border-r border-b md:border-b-0 border-line">
          <div className="font-mono text-[10px] tracking-[0.06em] text-subtle">SCHEDULED</div>
          <div className="text-[24px] font-semibold tracking-[-0.03em] mt-1">
            {(view === "week" ? model.weekHours : model.monthSummary.hours).toFixed(1)}h
          </div>
          <div className="text-[11px] text-subtle mt-[3px]">
            paid hours this {view === "week" ? "week" : "month"}
          </div>
        </div>
        <div className="px-4 py-3.5 border-b md:border-b-0 md:border-r border-line">
          <div className="font-mono text-[10px] tracking-[0.06em] text-subtle">LABOUR COST</div>
          <div className="text-[24px] font-semibold tracking-[-0.03em] mt-1">
            {euro(view === "week" ? model.weekCost : model.monthSummary.cost)}
          </div>
          <div className="text-[11px] text-subtle mt-[3px]">at each person&apos;s rate</div>
        </div>
        <div className="px-4 py-3.5 col-span-2 md:col-span-1">
          <div className="font-mono text-[10px] tracking-[0.06em] text-subtle">EVENING COVER</div>
          <div
            className="text-[15px] font-medium mt-1"
            style={{ color: shortCount ? "var(--color-danger)" : "var(--color-ink)" }}
          >
            {shortCount
              ? `${shortCount} day${shortCount === 1 ? " is" : "s are"} short at peak`
              : `at least ${MIN_AT_PEAK} on every open evening`}
          </div>
          <div className="text-[11px] text-subtle mt-[5px]">
            measured at {PEAK_HOURS.map((h) => `${h}:00`).join(" and ")}
          </div>
        </div>
      </Card>

      {view === "week" && (
        <Card>
          <div className="border-b border-line">
            <CardHeader
              title="Who is on, and when"
              sub="Click a block to edit it · the strip under each day is how many people are on that hour"
              right={
                <div className="hidden md:flex flex-wrap gap-2.5 text-[11px] text-muted">
                  {model.legend.map((l) => (
                    <span key={l.id} className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-[2px]"
                        style={{ background: l.color }}
                      />
                      {l.name}
                    </span>
                  ))}
                </div>
              }
            />
          </div>

          {model.weekEmpty ? (
            <p className="px-4 py-10 text-[13px] text-muted text-center">
              Nothing scheduled for this week.{" "}
              <button
                onClick={() => openPanel("add", null, model.weekDays[0])}
                className="text-accent font-medium"
              >
                Add the first shift
              </button>
              .
            </p>
          ) : (
            <>
              {/* Desktop: the timeline */}
              <div className="hidden md:block overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="flex gap-2.5 px-4 pb-1.5 border-b border-line">
                    <div className="w-[104px] shrink-0" />
                    <div className="flex-1 min-w-0 relative h-4">
                      {model.axisHours.map((h) => (
                        <span
                          key={h}
                          className="absolute font-mono text-[11px] text-muted -translate-x-1/2"
                          style={{
                            left: `${((h * 60 - model.axisFrom) / model.axisSpan) * 100}%`,
                          }}
                        >
                          {h % 24}
                        </span>
                      ))}
                    </div>
                    <div className="w-[96px] shrink-0 text-right font-mono text-[11px] tracking-[0.05em] text-muted">
                      HOURS
                    </div>
                  </div>

                  {model.dayRows.map((d) => (
                    <div
                      key={d.day}
                      className="flex gap-2.5 px-4 py-2.5 border-b border-line hover:bg-wash-light"
                    >
                      <div className="w-[104px] shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-[5px] h-[5px] rounded-full"
                            style={{ background: d.isToday ? "var(--color-accent)" : "transparent" }}
                          />
                          <span
                            className="text-[13px] font-medium"
                            style={{ color: d.isToday ? "var(--color-accent)" : undefined }}
                          >
                            {d.dow}
                          </span>
                          <span className="font-mono text-[11px] text-subtle">{d.date}</span>
                        </div>
                        <div className="text-[11px] text-subtle mt-0.5">
                          {d.people} {d.people === 1 ? "person" : "people"}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="relative" style={{ height: d.laneHeight }}>
                          {d.bars.map((b) => (
                            <div
                              key={b.shift.id}
                              onClick={() => openPanel("edit", b.shift)}
                              className="absolute h-[22px] rounded flex items-center px-1.5 text-[11px] font-medium cursor-pointer overflow-hidden whitespace-nowrap hover:brightness-[0.97]"
                              style={{
                                top: b.lane * 26,
                                left: b.left,
                                width: b.width,
                                background: `color-mix(in srgb, ${b.color} 14%, #fff)`,
                                borderLeft: `2px solid ${b.color}`,
                                color: b.color,
                              }}
                              title={`${b.name} ${b.clock}`}
                            >
                              {b.wide ? `${b.name}  ${b.clock}` : b.medium ? b.name : ""}
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-px mt-1.5">
                          {d.cover.map((c) => (
                            <div
                              key={c.hour}
                              title={`${c.hour}:00 — ${c.count} on`}
                              className="flex-1 h-[5px] rounded-[1px]"
                              style={{
                                background:
                                  c.count === 0
                                    ? "#f7f7f7"
                                    : `rgba(23,23,23,${(0.1 + Math.min(3, c.count) * 0.22).toFixed(2)})`,
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="w-[96px] shrink-0 text-right">
                        <div className="font-mono text-[13px]">{d.hours.toFixed(1)}h</div>
                        <div className="font-mono text-[11px] text-subtle">{euro(d.cost)}</div>
                        {(d.short || d.tight) && (
                          <div
                            className="text-[11px] mt-0.5"
                            style={{
                              color: d.short ? "var(--color-danger)" : "var(--color-warn-ink)",
                            }}
                          >
                            {d.short
                              ? d.peak === 0
                                ? "nobody on at peak"
                                : "only 1 on at peak"
                              : "2 on at peak"}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Phone: a list per day. The timeline needs horizontal room the
                  design did not have — on 390px it ran off the edge and took
                  the hours column with it. */}
              <div className="md:hidden">
                {model.dayRows.map((d) => (
                  <div key={d.day} className="border-b border-line">
                    <div className="flex items-baseline gap-2 px-4 pt-3 pb-1.5">
                      <span
                        className="text-[13px] font-medium"
                        style={{ color: d.isToday ? "var(--color-accent)" : undefined }}
                      >
                        {d.dow}
                      </span>
                      <span className="font-mono text-[11px] text-subtle">{d.date}</span>
                      <div className="flex-1" />
                      <span className="font-mono text-[12px]">{d.hours.toFixed(1)}h</span>
                      <span className="font-mono text-[11px] text-subtle">{euro(d.cost)}</span>
                    </div>

                    {d.list.length === 0 ? (
                      <button
                        onClick={() => openPanel("add", null, d.day)}
                        className="w-full text-left px-4 pb-3 text-[12px] text-faint"
                      >
                        Nobody on — add a shift
                      </button>
                    ) : (
                      <div className="pb-2">
                        {d.bars.map((b) => (
                          <div
                            key={b.shift.id}
                            onClick={() => openPanel("edit", b.shift)}
                            className="flex items-center gap-2.5 px-4 py-2 active:bg-wash-light"
                          >
                            <span
                              className="w-1 h-7 rounded-full shrink-0"
                              style={{ background: b.color }}
                            />
                            <span className="text-[13px] flex-1 min-w-0 truncate">{b.name}</span>
                            <span className="font-mono text-[12px] text-muted">{b.clock}</span>
                          </div>
                        ))}
                        {(d.short || d.tight) && (
                          <p
                            className="px-4 pt-1 text-[11px]"
                            style={{
                              color: d.short ? "var(--color-danger)" : "var(--color-warn-ink)",
                            }}
                          >
                            {d.short
                              ? d.peak === 0
                                ? "nobody on at peak"
                                : "only 1 on at peak"
                              : "2 on at peak"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {view === "month" && (
        <Card>
          <CardHeader
            title={model.monthLabel}
            sub="Click a shift to edit, or the plus on a day to add one"
          />
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-7 border-b border-line">
                {DOW_HEAD.map((d) => (
                  <span
                    key={d}
                    className="px-2.5 py-2 font-mono text-[10px] tracking-[0.06em] text-subtle"
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {model.monthCells.map((c) => (
                  <div
                    key={c.day}
                    className="min-h-[104px] border-r border-b border-wash p-1.5"
                    style={{ opacity: c.inMonth ? 1 : 0.45 }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="font-mono text-[11px]"
                        style={{
                          color: c.isToday
                            ? "var(--color-accent)"
                            : c.inMonth
                              ? "var(--color-ink)"
                              : "var(--color-faint)",
                        }}
                      >
                        {c.num}
                      </span>
                      <button
                        onClick={() => openPanel("add", null, c.day)}
                        className="w-[18px] h-[18px] flex items-center justify-center rounded text-subtle hover:bg-wash hover:text-ink"
                        title="Add a shift"
                      >
                        <Plus size={12} strokeWidth={2} />
                      </button>
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1">
                      {c.chips.map((ch) => (
                        <div
                          key={ch.shift.id}
                          onClick={() => openPanel("edit", ch.shift)}
                          className="rounded-[3px] px-1 py-0.5 text-[11px] cursor-pointer truncate"
                          style={{
                            background: `color-mix(in srgb, ${ch.color} 14%, #fff)`,
                            borderLeft: `2px solid ${ch.color}`,
                            color: ch.color,
                          }}
                        >
                          {ch.label}
                        </div>
                      ))}
                      {c.more > 0 && (
                        <span className="text-[11px] text-muted pl-0.5">+{c.more} more</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {renderPanel()}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}
