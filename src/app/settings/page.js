"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, ShieldCheck, TriangleAlert } from "lucide-react";
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
import { MONTHS, euro2 } from "../../lib/format";

/**
 * The pages an employee can be granted. Deliberately the same nine the app has
 * always had — TV Displays is admin-only in practice, and adding it here is a
 * permissions decision rather than a design one.
 */
const PAGES = [
  { slug: "overview", label: "Overview", short: "OVER" },
  { slug: "sales", label: "Sales", short: "SALES" },
  { slug: "marketing", label: "Marketing", short: "MKTG" },
  { slug: "menu", label: "Menu", short: "MENU" },
  { slug: "products", label: "Products", short: "PROD" },
  { slug: "payouts", label: "Platform Payouts", short: "PAYOUT" },
  { slug: "reviews", label: "Reviews", short: "REVS" },
  { slug: "calendar", label: "Calendar", short: "CAL" },
  { slug: "my-payroll", label: "My Payroll", short: "MY PAY" },
];

const TABS = [
  { id: "people", label: "People" },
  { id: "permissions", label: "Who sees what" },
];

const CREATE_EMPLOYEE_URL =
  "https://nhtxpinnvuqpfwnatqre.supabase.co/functions/v1/create-employee";

/** The next twelve months, for when a pay change takes effect. */
function monthOptions() {
  const now = new Date();
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return {
      value: `${d.getFullYear()}-${d.getMonth() + 1}`,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    };
  });
}

const initialsOf = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [tab, setTab] = useState("people");
  const [store, setStore] = useState({ loaded: false, failure: null });
  const [panel, setPanel] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    (async () => {
      const [staffRes, rateRes, permRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name", { ascending: true }),
        supabase.from("rate_changes").select("*"),
        supabase.from("page_permissions").select("user_id, page_slug"),
      ]);
      if (cancelled) return;
      setStore({
        loaded: true,
        failure:
          staffRes.error?.message || rateRes.error?.message || permRes.error?.message || null,
        staff: staffRes.data || [],
        rates: rateRes.data || [],
        perms: permRes.data || [],
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey, isAdmin]);

  const model = useMemo(() => {
    if (!store.loaded || store.failure) return null;

    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;

    const ratesFor = (id) =>
      store.rates
        .filter((r) => r.employee_id === id)
        .sort(
          (a, b) =>
            a.effective_year - b.effective_year || a.effective_month - b.effective_month
        );

    const people = store.staff.map((p) => {
      const rates = ratesFor(p.id);
      const current = [...rates]
        .reverse()
        .find(
          (r) =>
            r.effective_year < thisYear ||
            (r.effective_year === thisYear && r.effective_month <= thisMonth)
        );
      const upcoming = rates.find(
        (r) =>
          r.effective_year > thisYear ||
          (r.effective_year === thisYear && r.effective_month > thisMonth)
      );
      return {
        ...p,
        rate: current ? Number(current.hourly_rate) : null,
        bonus: current ? Number(current.monthly_bonus || 0) : 0,
        upcoming: upcoming
          ? {
              rate: Number(upcoming.hourly_rate),
              label: `${MONTHS[upcoming.effective_month - 1]} ${upcoming.effective_year}`,
            }
          : null,
        grants: new Set(
          store.perms.filter((x) => x.user_id === p.id).map((x) => x.page_slug)
        ),
      };
    });

    const employees = people.filter((p) => p.role !== "admin");
    const admins = people.filter((p) => p.role === "admin");
    const scheduled = people.filter((p) => p.upcoming);

    return { people, employees, admins, scheduled };
  }, [store]);

  // ── Writes ───────────────────────────────────────────────────────────────

  const toggleActive = async (person) => {
    const next = !person.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: next })
      .eq("id", person.id);
    if (error) {
      setToast({ type: "error", message: "Could not change their status" });
      return;
    }
    setToast({
      type: "ok",
      message: next
        ? `${person.full_name} can sign in again`
        : `${person.full_name} can no longer sign in`,
    });
    reload();
  };

  const setGrant = async (person, slug, grant) => {
    const { error } = grant
      ? await supabase
          .from("page_permissions")
          .insert({ user_id: person.id, page_slug: slug, granted_by: user?.id })
      : await supabase
          .from("page_permissions")
          .delete()
          .eq("user_id", person.id)
          .eq("page_slug", slug);
    if (error) {
      setToast({ type: "error", message: "Could not change that permission" });
      return;
    }
    reload();
  };

  /** Grant or revoke one page for everyone at once. */
  const setColumn = async (slug) => {
    const everyone = model.employees;
    const all = everyone.every((p) => p.grants.has(slug));
    const page = PAGES.find((x) => x.slug === slug);
    for (const person of everyone) {
      if (all && person.grants.has(slug)) {
        await supabase
          .from("page_permissions")
          .delete()
          .eq("user_id", person.id)
          .eq("page_slug", slug);
      } else if (!all && !person.grants.has(slug)) {
        await supabase
          .from("page_permissions")
          .insert({ user_id: person.id, page_slug: slug, granted_by: user?.id });
      }
    }
    setToast({
      type: "ok",
      message: all
        ? `${page.label} hidden from everyone`
        : `${page.label} opened to everyone`,
    });
    reload();
  };

  const openPanel = (person) => {
    const months = monthOptions();
    if (!person) {
      setPanel({
        mode: "add",
        error: "",
        form: {
          full_name: "",
          email: "",
          password: "",
          job_title: "",
          role: "employee",
          hourly_rate: "",
          monthly_bonus: "0",
          bonus_description: "",
          from: months[0].value,
        },
      });
      return;
    }
    setPanel({
      mode: "edit",
      id: person.id,
      error: "",
      person,
      form: {
        full_name: person.full_name ?? "",
        email: person.email ?? "",
        password: "",
        job_title: person.job_title ?? "",
        role: person.role ?? "employee",
        hourly_rate: person.rate != null ? person.rate.toFixed(2) : "",
        monthly_bonus: person.bonus ? person.bonus.toFixed(2) : "0",
        bonus_description: "",
        from: months[0].value,
      },
    });
  };

  const setField = (key, value) =>
    setPanel((p) => (p ? { ...p, form: { ...p.form, [key]: value }, error: "" } : p));

  const save = async () => {
    if (!panel) return;
    const f = panel.form;
    const fail = (message) => setPanel({ ...panel, error: message });

    if (!f.full_name.trim()) return fail("Give them a name.");
    if (panel.mode === "add") {
      if (!f.email.trim()) return fail("An email is needed to sign in.");
      if (f.password.length < 8) return fail("The password needs at least 8 characters.");
    }

    const rate = f.hourly_rate === "" ? null : Number(String(f.hourly_rate).replace(",", "."));
    if (rate != null && !(Number.isFinite(rate) && rate >= 0))
      return fail("That hourly rate is not a number.");
    const bonus = Number(String(f.monthly_bonus || 0).replace(",", ".")) || 0;
    const [fromYear, fromMonth] = f.from.split("-").map(Number);

    setSaving(true);

    if (panel.mode === "add") {
      // Creating a login needs the service role, so it goes through an edge
      // function rather than the browser client.
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch(CREATE_EMPLOYEE_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: f.email.trim(),
            password: f.password,
            full_name: f.full_name.trim(),
            role: f.role,
            hourly_rate: rate ?? 0,
            monthly_bonus: bonus,
            bonus_description: f.bonus_description.trim() || null,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setSaving(false);
          return fail(body.error || body.message || "Could not create the account.");
        }
      } catch (err) {
        setSaving(false);
        return fail(
          `Could not reach the account service: ${err.message}. Creating a login needs a network connection.`
        );
      }
      setSaving(false);
      setPanel(null);
      setToast({ type: "ok", message: `${f.full_name.trim()} can now sign in` });
      reload();
      return;
    }

    // Editing: the profile itself, and a new effective-dated rate only when the
    // pay actually changed — rate_changes is a history, not a current value.
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: f.full_name.trim(),
        job_title: f.job_title.trim() || null,
        role: f.role,
      })
      .eq("id", panel.id);

    if (profileError) {
      setSaving(false);
      return fail(profileError.message || "Could not save.");
    }

    const rateChanged =
      rate != null && (panel.person.rate == null || Math.abs(rate - panel.person.rate) > 0.005);
    const bonusChanged = Math.abs(bonus - (panel.person.bonus ?? 0)) > 0.005;

    if (rateChanged || bonusChanged) {
      const { error } = await supabase.from("rate_changes").insert({
        employee_id: panel.id,
        hourly_rate: rate ?? panel.person.rate ?? 0,
        monthly_bonus: bonus,
        bonus_description: f.bonus_description.trim() || null,
        effective_year: fromYear,
        effective_month: fromMonth,
        created_by: user?.id,
      });
      if (error) {
        setSaving(false);
        return fail(error.message || "Saved the profile, but the pay change did not stick.");
      }
    }

    setSaving(false);
    setPanel(null);
    setToast({
      type: "ok",
      message:
        rateChanged || bonusChanged
          ? `Saved · new pay from ${MONTHS[fromMonth - 1]} ${fromYear}`
          : "Saved",
    });
    reload();
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Settings" />
        <EmptyState title="Settings is admin only" body="Ask Betty if something needs changing." />
      </div>
    );
  }

  if (store.failure) {
    return (
      <div className="flex flex-col gap-4 md:gap-5">
        <PageHeader title="Settings" />
        <EmptyState
          icon={TriangleAlert}
          title="Could not load settings"
          body={store.failure}
          action="Try again"
          onAction={reload}
        />
      </div>
    );
  }

  if (!model) {
    return <LoadingState kpis={0} shape="list" line="LOADING ACCOUNTS · 9 PAGES" />;
  }

  const peopleCols =
    "gap-x-3 grid-cols-[minmax(0,1fr)_86px_30px] md:grid-cols-[minmax(0,1.5fr)_96px_128px_84px_120px_30px]";
  // Inline rather than a Tailwind arbitrary class: Tailwind generates classes
  // by scanning source text, so one assembled at runtime from PAGES.length
  // never exists and the grid silently collapses to a single column.
  const permGrid = {
    gridTemplateColumns: `152px repeat(${PAGES.length}, minmax(0,1fr)) 46px`,
  };

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        title="Settings"
        sub="Accounts, pay rates, and which pages each person can open"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <Segmented options={TABS} value={tab} onChange={setTab} />
            <button
              onClick={() => openPanel(null)}
              className="flex items-center gap-[7px] h-8 px-3 rounded-md bg-ink-strong text-surface text-[13px] font-medium hover:bg-ink"
            >
              <Plus size={14} strokeWidth={2} />
              New person
            </button>
          </div>
        }
      />

      {tab === "people" && (
        <>
          {model.scheduled.length > 0 && (
            <Card className="px-4 py-3.5">
              <h2 className="text-[14px] font-semibold tracking-[-0.01em]">
                Pay changes already scheduled
              </h2>
              <div className="mt-2 flex flex-col gap-1">
                {model.scheduled.map((p) => (
                  <p key={p.id} className="text-[13px] text-muted">
                    {String(p.full_name).split(" ")[0]} goes from{" "}
                    {p.rate != null ? euro2(p.rate) : "—"} to {euro2(p.upcoming.rate)} in{" "}
                    {p.upcoming.label}
                  </p>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <div
              className={`grid px-4 py-3 font-mono text-[11px] tracking-[0.05em] text-muted ${peopleCols}`}
            >
              <span>PERSON</span>
              <span className="hidden md:block">ROLE</span>
              <span className="hidden md:block text-right">HOURLY</span>
              <span className="hidden md:block text-right">BONUS</span>
              <span className="text-right md:text-left">STATUS</span>
              <span />
            </div>

            {model.people.map((p) => (
              <div
                key={p.id}
                className={`grid px-4 py-2.5 border-t border-line items-center hover:bg-wash-light ${peopleCols}`}
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-wash text-muted font-mono text-[10px] flex items-center justify-center shrink-0">
                    {initialsOf(p.full_name)}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-[13px] font-medium truncate ${
                        p.is_active ? "" : "text-subtle"
                      }`}
                    >
                      {p.full_name}
                    </div>
                    <div className="text-[11px] text-subtle truncate">{p.email}</div>
                    <div className="md:hidden text-[11px] text-subtle truncate">
                      {p.job_title || (p.role === "admin" ? "Admin" : "Employee")}
                      {p.rate != null ? ` · ${euro2(p.rate)}` : ""}
                    </div>
                  </div>
                </div>

                <div className="hidden md:block">
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded"
                    style={{
                      color: p.role === "admin" ? "var(--color-accent)" : "var(--color-muted)",
                      background:
                        p.role === "admin" ? "rgba(0,112,243,0.08)" : "var(--color-wash-light)",
                    }}
                  >
                    {p.role === "admin" ? "Admin" : "Employee"}
                  </span>
                  {p.job_title && (
                    <div className="text-[11px] text-subtle truncate mt-0.5">{p.job_title}</div>
                  )}
                </div>

                <div className="hidden md:block text-right">
                  <div className="font-mono text-[13px] tabular-nums">
                    {p.rate != null ? euro2(p.rate) : "—"}
                  </div>
                  {p.upcoming && (
                    <div className="font-mono text-[11px] text-warn-ink whitespace-nowrap">
                      → {euro2(p.upcoming.rate)} from {p.upcoming.label.split(" ")[0]}
                    </div>
                  )}
                </div>

                <span className="hidden md:block font-mono text-[13px] tabular-nums text-right text-muted">
                  {p.bonus ? euro2(p.bonus) : "—"}
                </span>

                <div className="flex items-center justify-end md:justify-start gap-2">
                  <span
                    className="text-[12px]"
                    style={{
                      color: p.is_active ? "var(--color-muted)" : "var(--color-danger)",
                    }}
                  >
                    {p.is_active ? "Active" : "Inactive"}
                  </span>
                  {p.id !== user?.id && (
                    <button
                      onClick={() => toggleActive(p)}
                      className="hidden md:block h-7 px-2 border border-line rounded-md bg-surface text-[12px] text-muted hover:border-line-strong hover:text-ink whitespace-nowrap"
                    >
                      {p.is_active ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => openPanel(p)}
                  title="Edit"
                  className="justify-self-end w-7 h-7 flex items-center justify-center rounded-md text-subtle hover:text-ink hover:bg-wash shrink-0"
                >
                  <Pencil size={13} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </Card>
        </>
      )}

      {tab === "permissions" && (
        <>
          <div className="flex items-center gap-2.5 px-4 py-3 border border-line rounded-[10px] bg-wash-light">
            <ShieldCheck size={15} strokeWidth={2} className="text-accent shrink-0" />
            <span className="text-[13px] flex-1 min-w-0 text-pretty">
              {model.admins.map((a) => a.full_name).join(", ")}{" "}
              {model.admins.length === 1 ? "is an admin and sees" : "are admins and see"} every
              page.
            </span>
          </div>

          <Card>
            <CardHeader
              title="Who sees what"
              sub={
                <>
                  <span>Tap to grant or remove a page</span>
                  {/* There are no column headings in the narrow layout, so the
                      instruction about them only belongs on desktop. */}
                  <span className="hidden md:inline">
                    {" "}· tap a column heading to do the whole team at once
                  </span>
                </>
              }
            />

            {model.employees.length === 0 ? (
              <p className="px-4 pb-4 pt-3 border-t border-line text-[13px] text-muted">
                There are no employee accounts yet.
              </p>
            ) : (
              <>
                {/* Desktop: the matrix */}
                <div className="hidden md:block overflow-x-auto">
                  <div className="min-w-[720px]">
                    <div
                      className="grid gap-x-2 px-4 pb-2 font-mono text-[10px] tracking-[0.06em] text-muted"
                      style={permGrid}
                    >
                      <span>PERSON</span>
                      {PAGES.map((page) => {
                        const all = model.employees.every((p) => p.grants.has(page.slug));
                        return (
                          <button
                            key={page.slug}
                            onClick={() => setColumn(page.slug)}
                            title={`${all ? "Hide" : "Show"} ${page.label} for everyone`}
                            className="text-center hover:text-ink"
                            style={{ color: all ? "var(--color-ink)" : undefined }}
                          >
                            {page.short}
                          </button>
                        );
                      })}
                      <span className="text-right">ALL</span>
                    </div>

                    {model.employees.map((p) => (
                      <div
                        key={p.id}
                        className="grid gap-x-2 px-4 py-2 border-t border-line items-center hover:bg-wash-light"
                        style={permGrid}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-wash text-muted font-mono text-[9px] flex items-center justify-center shrink-0">
                            {initialsOf(p.full_name)}
                          </div>
                          <span className="text-[13px] truncate">{p.full_name}</span>
                        </div>
                        {PAGES.map((page) => {
                          const on = p.grants.has(page.slug);
                          return (
                            <div key={page.slug} className="flex justify-center">
                              <button
                                onClick={() => setGrant(p, page.slug, !on)}
                                title={`${on ? "Remove" : "Grant"} ${page.label}`}
                                className="w-5 h-5 rounded flex items-center justify-center border"
                                style={{
                                  background: on ? "var(--color-ink-strong)" : "var(--color-surface)",
                                  borderColor: on
                                    ? "var(--color-ink-strong)"
                                    : "var(--color-line)",
                                }}
                              >
                                {on && <Check size={12} strokeWidth={3} className="text-surface" />}
                              </button>
                            </div>
                          );
                        })}
                        <span className="font-mono text-[11px] text-subtle text-right">
                          {p.grants.size}/{PAGES.length}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Phone: chips per person. Nine columns do not fit, and a
                    matrix you have to scroll sideways to read is worse than a
                    list you can tap. */}
                <div className="md:hidden">
                  {model.employees.map((p) => (
                    <div key={p.id} className="border-t border-line px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-wash text-muted font-mono text-[10px] flex items-center justify-center shrink-0">
                          {initialsOf(p.full_name)}
                        </div>
                        <span className="text-[14px] font-medium flex-1 min-w-0 truncate">
                          {p.full_name}
                        </span>
                        <span className="font-mono text-[11px] text-subtle">
                          {p.grants.size}/{PAGES.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {PAGES.map((page) => {
                          const on = p.grants.has(page.slug);
                          return (
                            <button
                              key={page.slug}
                              onClick={() => setGrant(p, page.slug, !on)}
                              className="min-h-[34px] px-2.5 rounded-md border text-[12px]"
                              style={{
                                background: on ? "var(--color-ink-strong)" : "var(--color-surface)",
                                borderColor: on ? "var(--color-ink-strong)" : "var(--color-line)",
                                color: on ? "#fff" : "var(--color-muted)",
                              }}
                            >
                              {page.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {/* New / edit person */}
      <SidePanel
        open={!!panel}
        title={panel?.mode === "add" ? "New person" : "Edit person"}
        onClose={() => setPanel(null)}
        footer={
          <div className="px-4 py-3 flex gap-2">
            <button
              onClick={save}
              disabled={saving}
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
            {/* The row's own Deactivate button is desktop-only for width, so on
                a phone this is the only way to reach it. */}
            {panel?.mode === "edit" && panel.id !== user?.id && (
              <button
                onClick={async () => {
                  await toggleActive(panel.person);
                  setPanel(null);
                }}
                className="min-h-9 px-3 border border-line rounded-md bg-surface text-[13px] text-muted hover:border-line-strong hover:text-ink whitespace-nowrap"
              >
                {panel.person.is_active ? "Deactivate" : "Activate"}
              </button>
            )}
          </div>
        }
      >
        {panel && (
          <div className="p-4 flex flex-col gap-3.5">
            {panel.mode === "edit" && !panel.person.is_active && (
              <p className="text-[12px] text-danger bg-[rgba(238,0,0,0.04)] border border-[rgba(238,0,0,0.15)] rounded-md px-3 py-2">
                This account is deactivated and cannot sign in.
              </p>
            )}
            <div>
              <label className={FIELD_LABEL}>Full name</label>
              <input
                value={panel.form.full_name}
                onChange={(e) => setField("full_name", e.target.value)}
                placeholder="e.g. Maria Kyriakou"
                className={FIELD_INPUT}
              />
            </div>

            <div>
              <label className={FIELD_LABEL}>Email</label>
              <input
                type="email"
                value={panel.form.email}
                onChange={(e) => setField("email", e.target.value)}
                disabled={panel.mode === "edit"}
                placeholder="name@bettyscrispy.cy"
                className={FIELD_INPUT}
              />
              {panel.mode === "edit" && (
                <p className="text-[11px] text-subtle mt-1">
                  The sign-in address cannot be changed here.
                </p>
              )}
            </div>

            {panel.mode === "add" && (
              <div>
                <label className={FIELD_LABEL}>Temporary password</label>
                <input
                  type="text"
                  value={panel.form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  placeholder="At least 8 characters"
                  className={FIELD_INPUT}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL}>Job title</label>
                <input
                  value={panel.form.job_title}
                  onChange={(e) => setField("job_title", e.target.value)}
                  placeholder="e.g. Cook"
                  className={FIELD_INPUT}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Role</label>
                <select
                  value={panel.form.role}
                  onChange={(e) => setField("role", e.target.value)}
                  className={FIELD_INPUT}
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL}>Hourly rate</label>
                <input
                  inputMode="decimal"
                  value={panel.form.hourly_rate}
                  onChange={(e) => setField("hourly_rate", e.target.value)}
                  placeholder="0.00"
                  className={FIELD_INPUT}
                />
              </div>
              <div>
                <label className={FIELD_LABEL}>Monthly bonus</label>
                <input
                  inputMode="decimal"
                  value={panel.form.monthly_bonus}
                  onChange={(e) => setField("monthly_bonus", e.target.value)}
                  placeholder="0.00"
                  className={FIELD_INPUT}
                />
              </div>
            </div>

            <div>
              <label className={FIELD_LABEL}>Bonus note</label>
              <input
                value={panel.form.bonus_description}
                onChange={(e) => setField("bonus_description", e.target.value)}
                placeholder="Paid with the month's wages"
                className={FIELD_INPUT}
              />
            </div>

            {panel.mode === "edit" && (
              <div>
                <label className={FIELD_LABEL}>Pay applies from</label>
                <select
                  value={panel.form.from}
                  onChange={(e) => setField("from", e.target.value)}
                  className={FIELD_INPUT}
                >
                  {monthOptions().map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-subtle mt-1 text-pretty">
                  A new rate is only recorded if the pay actually changed. Months already paid
                  keep the rate they were paid at.
                </p>
              </div>
            )}

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
