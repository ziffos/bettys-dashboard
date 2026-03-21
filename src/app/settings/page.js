"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  ShieldCheck,
  Plus,
  X,
  Loader2,
  Check,
  Pencil,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import SkeletonBlock from "@/components/SkeletonBlock";
import { useAuth } from "@/lib/AuthContext";

// ─── Page slugs available to employees ───────────────────────────────────────
const PAGE_OPTIONS = [
  { slug: "overview", label: "Overview" },
  { slug: "sales", label: "Sales" },
  { slug: "marketing", label: "Marketing" },
  { slug: "menu", label: "Menu" },
  { slug: "products", label: "Products" },
  { slug: "payouts", label: "Platform Payouts" },
  { slug: "reviews", label: "Reviews" },
  { slug: "calendar", label: "Calendar" },
  { slug: "my-payroll", label: "My Payroll" },
];

// ─── Main page ───────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const { profile, user } = useAuth();

  const [tab, setTab] = useState("employees");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null); // null = create

  // Guard: redirect non-admins
  useEffect(() => {
    if (profile && profile.role !== "admin") {
      router.push("/");
    }
  }, [profile, router]);

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Fetch employees error:", JSON.stringify(error));
    }
    setEmployees(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Toast auto‑dismiss
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Toggle active
  const toggleActive = async (emp) => {
    const newVal = !emp.is_active;
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: newVal })
      .eq("id", emp.id);

    if (error) {
      setToast({ type: "error", message: "Failed to update status" });
      return;
    }
    setEmployees((prev) =>
      prev.map((e) => (e.id === emp.id ? { ...e, is_active: newVal } : e))
    );
    setToast({
      type: "success",
      message: `${emp.full_name} is now ${newVal ? "active" : "inactive"}`,
    });
  };

  if (!profile || profile.role !== "admin") return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Settings
          </h1>
          <p className="text-neutral-400 text-sm mt-1">
            Manage employees and page permissions.
          </p>
        </div>

        {tab === "employees" && (
          <button
            onClick={() => {
              setEditingEmployee(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus size={18} />
            New Employee
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-900 p-1 rounded-xl w-fit border border-neutral-800">
        <TabButton
          active={tab === "employees"}
          onClick={() => setTab("employees")}
          icon={Users}
          label="Employees"
        />
        <TabButton
          active={tab === "permissions"}
          onClick={() => setTab("permissions")}
          icon={ShieldCheck}
          label="Permissions"
        />
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="space-y-6">
          {/* 2 tab skeletons */}
          <div className="flex gap-1 bg-neutral-900 p-1 rounded-xl w-fit border border-neutral-800">
            <SkeletonBlock className="h-9 w-28 rounded-lg" />
            <SkeletonBlock className="h-9 w-28 rounded-lg" />
          </div>
          {/* 4 employee card skeletons in 2-col grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5">
                <div className="flex items-center gap-4 mb-4">
                  <SkeletonBlock className="h-12 w-12 rounded-full" />
                  <div>
                    <SkeletonBlock className="h-4 w-32 mb-2" />
                    <SkeletonBlock className="h-3 w-44" />
                  </div>
                </div>
                <div className="flex justify-between">
                  <SkeletonBlock className="h-6 w-16 rounded-full" />
                  <SkeletonBlock className="h-6 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === "employees" ? (
        <EmployeesTab
          employees={employees}
          onEdit={(emp) => {
            setEditingEmployee(emp);
            setModalOpen(true);
          }}
          onToggleActive={toggleActive}
        />
      ) : (
        <PermissionsTab employees={employees} adminId={user?.id} />
      )}

      {/* Modal */}
      {modalOpen && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            fetchEmployees();
            setToast({
              type: "success",
              message: editingEmployee
                ? "Employee updated"
                : "Employee created",
            });
          }}
          sessionRef={
            /* We need the access token for the edge function */
            null
          }
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 text-sm font-medium rounded-xl shadow-lg backdrop-blur-sm ${
            toast.type === "error"
              ? "bg-red-500/90 text-white"
              : "bg-emerald-500/90 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ─── Tab button ──────────────────────────────────────────────────────────────
function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? "bg-emerald-500 text-white"
          : "text-neutral-400 hover:text-white hover:bg-white/5"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

// ─── Employees Tab ───────────────────────────────────────────────────────────
function EmployeesTab({ employees, onEdit, onToggleActive }) {
  return (
    <div className="grid gap-3">
      {employees.map((emp) => (
        <div
          key={emp.id}
          className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
        >
          {/* Left: name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-white font-semibold truncate">
                {emp.full_name}
              </h3>
              <span
                className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${
                  emp.role === "admin"
                    ? "bg-blue-500/15 text-blue-400"
                    : "bg-neutral-700/50 text-neutral-400"
                }`}
              >
                {emp.role}
              </span>
              <span
                className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md ${
                  emp.is_active
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {emp.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-neutral-500 truncate">{emp.email}</p>
          </div>

          {/* Middle: pay info */}
          <div className="flex items-center gap-6 text-sm">
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wider">
                Hourly
              </p>
              <p className="text-white font-medium">
                &euro;{Number(emp.hourly_rate || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs uppercase tracking-wider">
                Bonus
              </p>
              <p className="text-white font-medium">
                &euro;{Number(emp.monthly_bonus || 0).toFixed(2)}
              </p>
            </div>
            {emp.bonus_description && (
              <div className="hidden lg:block max-w-[200px]">
                <p className="text-neutral-500 text-xs uppercase tracking-wider">
                  Bonus Note
                </p>
                <p className="text-neutral-300 text-xs truncate">
                  {emp.bonus_description}
                </p>
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onToggleActive(emp)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                emp.is_active
                  ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
                  : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              {emp.is_active ? "Deactivate" : "Activate"}
            </button>
            <button
              onClick={() => onEdit(emp)}
              className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Pencil size={16} />
            </button>
          </div>
        </div>
      ))}

      {employees.length === 0 && (
        <p className="text-neutral-500 text-sm text-center py-10">
          No employees found.
        </p>
      )}
    </div>
  );
}

// ─── Employee Modal ──────────────────────────────────────────────────────────
function EmployeeModal({ employee, onClose, onSaved }) {
  const isEdit = !!employee;

  const [fullName, setFullName] = useState(employee?.full_name || "");
  const [email, setEmail] = useState(employee?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(employee?.role || "employee");
  const [hourlyRate, setHourlyRate] = useState(
    employee?.hourly_rate?.toString() || "0"
  );
  const [monthlyBonus, setMonthlyBonus] = useState(
    employee?.monthly_bonus?.toString() || "0"
  );
  const [bonusDesc, setBonusDesc] = useState(
    employee?.bonus_description || ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (isEdit) {
        // PATCH profile
        const { error: patchError } = await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            hourly_rate: parseFloat(hourlyRate) || 0,
            monthly_bonus: parseFloat(monthlyBonus) || 0,
            bonus_description: bonusDesc || null,
          })
          .eq("id", employee.id);

        if (patchError) {
          setError(patchError.message || "Failed to update employee");
          setSaving(false);
          return;
        }
      } else {
        // Create via edge function
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const res = await fetch(
          "https://nhtxpinnvuqpfwnatqre.supabase.co/functions/v1/create-employee",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password,
              full_name: fullName,
              role,
              hourly_rate: parseFloat(hourlyRate) || 0,
              monthly_bonus: parseFloat(monthlyBonus) || 0,
              bonus_description: bonusDesc || null,
            }),
          }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || body.message || "Failed to create employee");
          setSaving(false);
          return;
        }
      }

      onSaved();
    } catch (err) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <form
        onSubmit={handleSubmit}
        className="relative bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? "Edit Employee" : "New Employee"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Fields */}
        <Field
          label="Full Name"
          required
          value={fullName}
          onChange={setFullName}
        />

        {!isEdit && (
          <>
            <Field
              label="Email"
              type="email"
              required
              value={email}
              onChange={setEmail}
            />
            <Field
              label="Password"
              type="password"
              required
              value={password}
              onChange={setPassword}
            />
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Hourly Rate"
            type="number"
            step="0.01"
            value={hourlyRate}
            onChange={setHourlyRate}
          />
          <Field
            label="Monthly Bonus"
            type="number"
            step="0.01"
            value={monthlyBonus}
            onChange={setMonthlyBonus}
          />
        </div>

        <Field
          label="Bonus Description"
          value={bonusDesc}
          onChange={setBonusDesc}
          placeholder="Optional"
        />

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
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Check size={18} />
          )}
          {isEdit ? "Save Changes" : "Create Employee"}
        </button>
      </form>
    </div>
  );
}

// ─── Permissions Tab ─────────────────────────────────────────────────────────
function PermissionsTab({ employees, adminId }) {
  const nonAdmins = employees.filter((e) => e.role !== "admin");
  const admins = employees.filter((e) => e.role === "admin");
  const [expanded, setExpanded] = useState(null);
  const [permMap, setPermMap] = useState({}); // { [userId]: Set<slug> }
  const [loadingPerms, setLoadingPerms] = useState(null);

  const loadPerms = useCallback(
    async (userId) => {
      if (permMap[userId]) return; // already loaded
      setLoadingPerms(userId);

      const { data, error } = await supabase
        .from("page_permissions")
        .select("page_slug")
        .eq("user_id", userId);

      if (error) {
        console.error("Perm fetch error:", JSON.stringify(error));
      }

      setPermMap((prev) => ({
        ...prev,
        [userId]: new Set((data || []).map((r) => r.page_slug)),
      }));
      setLoadingPerms(null);
    },
    [permMap]
  );

  const toggle = async (userId, slug) => {
    const current = permMap[userId] || new Set();
    const has = current.has(slug);

    // Optimistic update
    const next = new Set(current);
    if (has) next.delete(slug);
    else next.add(slug);
    setPermMap((prev) => ({ ...prev, [userId]: next }));

    if (has) {
      const { error } = await supabase
        .from("page_permissions")
        .delete()
        .eq("user_id", userId)
        .eq("page_slug", slug);

      if (error) {
        // Revert
        setPermMap((prev) => ({ ...prev, [userId]: current }));
        console.error("Perm delete error:", JSON.stringify(error));
      }
    } else {
      const { error } = await supabase
        .from("page_permissions")
        .insert({ user_id: userId, page_slug: slug, granted_by: adminId });

      if (error) {
        setPermMap((prev) => ({ ...prev, [userId]: current }));
        console.error("Perm insert error:", JSON.stringify(error));
      }
    }
  };

  const handleExpand = (userId) => {
    if (expanded === userId) {
      setExpanded(null);
      return;
    }
    setExpanded(userId);
    loadPerms(userId);
  };

  return (
    <div className="space-y-3">
      {/* Admins notice */}
      {admins.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
          <span className="font-semibold">
            {admins.map((a) => a.full_name).join(", ")}
          </span>{" "}
          {admins.length === 1 ? "is an admin and has" : "are admins and have"}{" "}
          access to all pages.
        </div>
      )}

      {/* Employee list */}
      {nonAdmins.map((emp) => {
        const isOpen = expanded === emp.id;
        const perms = permMap[emp.id];
        const isLoading = loadingPerms === emp.id;

        return (
          <div
            key={emp.id}
            className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden"
          >
            {/* Header row */}
            <button
              onClick={() => handleExpand(emp.id)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
            >
              <div>
                <p className="text-white font-semibold">{emp.full_name}</p>
                <p className="text-neutral-500 text-sm">{emp.email}</p>
              </div>
              <div className="flex items-center gap-3">
                {perms && (
                  <span className="text-xs text-neutral-500">
                    {perms.size}/{PAGE_OPTIONS.length} pages
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-neutral-500 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {/* Checklist */}
            {isOpen && (
              <div className="border-t border-neutral-800 p-5 pt-4">
                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2
                      className="animate-spin text-emerald-500"
                      size={20}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {PAGE_OPTIONS.map((page) => {
                      const checked = perms?.has(page.slug) ?? false;
                      return (
                        <label
                          key={page.slug}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-colors"
                        >
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                              checked
                                ? "bg-emerald-500 border-emerald-500"
                                : "border-neutral-600 bg-neutral-950"
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              toggle(emp.id, page.slug);
                            }}
                          >
                            {checked && (
                              <Check size={14} className="text-white" />
                            )}
                          </div>
                          <span
                            className={`text-sm ${
                              checked ? "text-white" : "text-neutral-400"
                            }`}
                          >
                            {page.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {nonAdmins.length === 0 && (
        <p className="text-neutral-500 text-sm text-center py-10">
          No employee accounts found.
        </p>
      )}
    </div>
  );
}

// ─── Reusable field ──────────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  step,
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-300 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        step={step}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
      />
    </div>
  );
}
