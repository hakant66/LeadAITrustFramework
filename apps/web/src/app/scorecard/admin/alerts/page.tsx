"use client";

import Header from "@/app/(components)/Header";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type UserEntity = { entity_id: string; name: string; slug: string; role: string };
type TrendAlert = {
  id: string;
  project_slug: string;
  alert_type: string;
  severity: string;
  message: string;
  metric_value_before?: number | null;
  metric_value_after?: number | null;
  status: string;
  created_at: string;
  resolved_at?: string | null;
  details_json?: Record<string, unknown> | null;
};
type AlertRule = {
  id: string;
  project_slug?: string | null;
  name: string;
  rule_type: string;
  metric: string;
  threshold_pct: number;
  window_days?: number | null;
  severity: string;
  enabled: boolean;
};
type ProjectOption = { slug: string; name: string };
type MetricOption = { value: string; label: string };
type PillarItem = { key: string; name: string; weight?: number | null };
const DEFAULT_METRIC_OPTIONS: MetricOption[] = [{ value: "overall", label: "Overall score" }];
const RULE_TYPES = [
  { value: "threshold", label: "Below threshold" },
  { value: "trend_drop", label: "Drop over time window" },
];
const SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export default function AlertsPage() {
  const [entities, setEntities] = useState<UserEntity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [trendAlerts, setTrendAlerts] = useState<TrendAlert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "">("open");
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [entitiesLoaded, setEntitiesLoaded] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [metricOptions, setMetricOptions] = useState<MetricOption[]>(DEFAULT_METRIC_OPTIONS);
  const [diagnostic, setDiagnostic] = useState<{
    summary?: { enabled_rules_count?: number; message?: string };
    rules?: Array<{
      name: string;
      rule_type: string;
      metric: string;
      threshold_pct: number;
      project_scope: string;
      projects_count: number;
      projects: Array<Record<string, unknown>>;
    }>;
  } | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);

  const loadEntities = useCallback(async () => {
    try {
      const res = await fetch("/api/core/user/entities", { cache: "no-store" });
      setEntitiesLoaded(true);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.entities)
          ? data.entities
          : data?.items ?? [];
      setEntities(list);
      if (list.length && !selectedEntityId) setSelectedEntityId(list[0].entity_id);
    } catch {
      setEntitiesLoaded(true);
    }
  }, [selectedEntityId]);

  const loadAlerts = useCallback(async () => {
    if (!selectedEntityId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ entity_id: selectedEntityId });
      if (statusFilter) params.set("status", statusFilter);
      const [alertsRes, rulesRes] = await Promise.all([
        fetch(`/api/core/scorecard/trend-alerts?${params}`, { cache: "no-store" }),
        fetch(`/api/core/scorecard/alert-rules?${params}`, { cache: "no-store" }),
      ]);
      if (alertsRes.ok) {
        const d = await alertsRes.json();
        setTrendAlerts(d.items ?? []);
        setTotalAlerts(d.total ?? 0);
      } else {
        const errBody = await alertsRes.json().catch(() => ({}));
        setError((errBody.detail as string) || `Trend alerts: ${alertsRes.status} ${alertsRes.statusText}`);
      }
      if (rulesRes.ok) {
        const d = await rulesRes.json();
        setAlertRules(d.items ?? []);
      } else if (!alertsRes.ok) {
        // Prefer showing trend-alerts error; otherwise show rules error below
      } else {
        const errBody = await rulesRes.json().catch(() => ({}));
        setError((errBody.detail as string) || `Alert rules: ${rulesRes.status} ${rulesRes.statusText}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [selectedEntityId, statusFilter]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const loadPillars = useCallback(async () => {
    if (!selectedEntityId) return;
    try {
      const res = await fetch(`/api/core/scorecard/pillars?entity_id=${selectedEntityId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const items: PillarItem[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const pillarOpts: MetricOption[] = items
        .filter((p) => p && typeof p.key === "string" && typeof p.name === "string")
        .map((p) => ({
          value: `pillar:${String(p.key).trim().toLowerCase()}`,
          label: `Pillar: ${p.name}`,
        }));
      setMetricOptions([...DEFAULT_METRIC_OPTIONS, ...pillarOpts]);
    } catch {
      // keep defaults
    }
  }, [selectedEntityId]);

  useEffect(() => {
    loadPillars();
  }, [loadPillars]);

  const loadProjects = useCallback(async () => {
    if (!selectedEntityId) return;
    try {
      const res = await fetch(`/api/core/projects?entity_id=${selectedEntityId}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setProjects(list.map((p: { slug: string; name?: string }) => ({ slug: p.slug, name: p.name || p.slug })));
    } catch {
      setProjects([]);
    }
  }, [selectedEntityId]);

  useEffect(() => {
    if (selectedEntityId && (showAddForm || editingRule)) loadProjects();
  }, [selectedEntityId, showAddForm, editingRule, loadProjects]);

  const handleResolve = async (alertId: string) => {
    if (!selectedEntityId) return;
    setResolvingId(alertId);
    try {
      const res = await fetch(
        `/api/core/scorecard/trend-alerts/${alertId}/resolve`,
        { method: "POST", headers: { "X-Entity-ID": selectedEntityId } }
      );
      if (res.ok) await loadAlerts();
    } finally {
      setResolvingId(null);
    }
  };

  const handleRuleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEntityId) return;
    const form = e.currentTarget;
    const name = (form.querySelector('[name="rule-name"]') as HTMLInputElement)?.value?.trim();
    const rule_type = (form.querySelector('[name="rule_type"]') as HTMLSelectElement)?.value as "threshold" | "trend_drop";
    const metric = (form.querySelector('[name="metric"]') as HTMLSelectElement)?.value;
    const threshold_pct = Number((form.querySelector('[name="threshold_pct"]') as HTMLInputElement)?.value);
    const window_daysRaw = (form.querySelector('[name="window_days"]') as HTMLInputElement)?.value;
    const window_days = window_daysRaw ? Number(window_daysRaw) : null;
    const severity = (form.querySelector('[name="severity"]') as HTMLSelectElement)?.value as "high" | "medium" | "low";
    const project_slugRaw = (form.querySelector('[name="project_slug"]') as HTMLSelectElement)?.value;
    const project_slug = project_slugRaw && project_slugRaw !== "" ? project_slugRaw : null;
    const enabled = (form.querySelector('[name="enabled"]') as HTMLInputElement)?.checked ?? true;
    setFormError(null);
    if (!name) {
      setFormError("Name is required.");
      return;
    }
    if (rule_type === "trend_drop" && (!window_days || window_days < 1 || window_days > 365)) {
      setFormError("Window (days) is required for trend drop (1–365).");
      return;
    }
    if (Number.isNaN(threshold_pct) || threshold_pct < 0 || threshold_pct > 100) {
      setFormError("Threshold must be 0–100.");
      return;
    }
    setSubmitting(true);
    try {
      const headers = { "Content-Type": "application/json", "X-Entity-ID": selectedEntityId };
      if (editingRule) {
        const res = await fetch(`/api/core/scorecard/alert-rules/${editingRule.id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            name,
            rule_type,
            metric,
            threshold_pct,
            window_days: rule_type === "trend_drop" ? window_days : undefined,
            severity,
            project_slug: project_slug || null,
            enabled,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setFormError((err.detail as string) || res.statusText);
          return;
        }
        setEditingRule(null);
      } else {
        const res = await fetch(`/api/core/scorecard/alert-rules?entity_id=${selectedEntityId}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name,
            rule_type,
            metric,
            threshold_pct,
            window_days: rule_type === "trend_drop" ? window_days : undefined,
            severity,
            project_slug,
            enabled,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setFormError((err.detail as string) || res.statusText);
          return;
        }
        setShowAddForm(false);
      }
      form.reset();
      await loadAlerts();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!selectedEntityId || !confirm("Delete this alert rule?")) return;
    setDeletingId(ruleId);
    try {
      const res = await fetch(`/api/core/scorecard/alert-rules/${ruleId}?entity_id=${selectedEntityId}`, {
        method: "DELETE",
        headers: { "X-Entity-ID": selectedEntityId },
      });
      if (res.ok) {
        setEditingRule((r) => (r?.id === ruleId ? null : r));
        await loadAlerts();
      } else {
        const err = await res.json().catch(() => ({}));
        setError((err.detail as string) || "Delete failed");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const openAddForm = () => {
    setEditingRule(null);
    setFormError(null);
    setShowAddForm(true);
  };
  const openEditForm = (rule: AlertRule) => {
    setShowAddForm(false);
    setFormError(null);
    setEditingRule(rule);
  };
  const closeRuleForm = () => {
    setShowAddForm(false);
    setEditingRule(null);
    setFormError(null);
  };

  const runDiagnostic = async () => {
    if (!selectedEntityId) return;
    setDiagnosticLoading(true);
    setDiagnostic(null);
    try {
      const res = await fetch(
        `/api/core/scorecard/trend-alerts/diagnostic?entity_id=${selectedEntityId}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setDiagnostic(data);
      }
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const selectedEntity = entities.find((e) => e.entity_id === selectedEntityId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Header title="Intelligent Alerts & Trends" subtitle="LeadAI · Governance" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/scorecard/admin"
              className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              ← Admin
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Intelligent Alerts &amp; Trends
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              View trend-based alerts and manage alert rules for score drops and thresholds.
            </p>
          </div>
          {entities.length > 1 && (
            <select
              value={selectedEntityId ?? ""}
              onChange={(e) => setSelectedEntityId(e.target.value || null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {entities.map((e) => (
                <option key={e.entity_id} value={e.entity_id}>
                  {e.name || e.slug || e.entity_id}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
            {error}
          </div>
        )}

        {entitiesLoaded && entities.length === 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            No entities. You need access to an entity to view alerts.
          </div>
        )}

        {/* Trend alerts */}
        <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Trend Alerts
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className={`rounded-lg px-3 py-1.5 text-sm ${statusFilter === "" ? "bg-slate-200 dark:bg-slate-700" : "bg-slate-100 dark:bg-slate-800"}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("open")}
              className={`rounded-lg px-3 py-1.5 text-sm ${statusFilter === "open" ? "bg-slate-200 dark:bg-slate-700" : "bg-slate-100 dark:bg-slate-800"}`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("resolved")}
              className={`rounded-lg px-3 py-1.5 text-sm ${statusFilter === "resolved" ? "bg-slate-200 dark:bg-slate-700" : "bg-slate-100 dark:bg-slate-800"}`}
            >
              Resolved
            </button>
          </div>
          {!selectedEntityId ? (
            <p className="mt-4 text-sm text-slate-500">
              {entitiesLoaded ? "Select an entity above to view trend alerts." : "Loading…"}
            </p>
          ) : loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : trendAlerts.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No trend alerts {statusFilter ? `with status "${statusFilter}"` : ""}.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="p-2 text-left">Project</th>
                    <th className="p-2 text-left">Severity</th>
                    <th className="p-2 text-left">Message</th>
                    <th className="p-2 text-left">Created</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trendAlerts.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="p-2">{a.project_slug}</td>
                      <td className="p-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            a.severity === "high"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                              : a.severity === "medium"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {a.severity}
                        </span>
                      </td>
                      <td className="p-2">{a.message}</td>
                      <td className="p-2 text-slate-500">
                        {a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}
                      </td>
                      <td className="p-2 text-right">
                        {a.status === "open" && (
                          <button
                            type="button"
                            disabled={resolvingId === a.id}
                            onClick={() => handleResolve(a.id)}
                            className="rounded bg-slate-200 px-2 py-1 text-xs hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                          >
                            {resolvingId === a.id ? "Resolving…" : "Resolve"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Alert rules */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Alert Rules
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Rules that generate trend alerts when scores fall below a threshold or drop over a time window.
              </p>
            </div>
            {selectedEntityId && !loading && !showAddForm && !editingRule && (
              <button
                type="button"
                onClick={openAddForm}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                Add rule
              </button>
            )}
          </div>
          {!selectedEntityId ? (
            <p className="mt-4 text-sm text-slate-500">
              {entitiesLoaded ? "Select an entity above to view alert rules." : "Loading…"}
            </p>
          ) : loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading…</p>
          ) : (showAddForm || editingRule) ? (
            <form onSubmit={handleRuleSubmit} className="mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              {editingRule && (
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Edit rule: {editingRule.name}</p>
              )}
              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="rule-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                  <input
                    id="rule-name"
                    name="rule-name"
                    type="text"
                    required
                    defaultValue={editingRule?.name}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    placeholder="e.g. Overall below 70%"
                  />
                </div>
                <div>
                  <label htmlFor="rule_type" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Rule type</label>
                  <select
                    id="rule_type"
                    name="rule_type"
                    defaultValue={editingRule?.rule_type ?? "threshold"}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {RULE_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="metric" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Metric</label>
                  <select
                    id="metric"
                    name="metric"
                    defaultValue={editingRule?.metric ?? "overall"}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {(() => {
                      const opts = metricOptions?.length ? metricOptions : DEFAULT_METRIC_OPTIONS;
                      const current = editingRule?.metric;
                      const withCurrent =
                        current && !opts.some((o) => o.value === current)
                          ? [{ value: current, label: current }, ...opts]
                          : opts;
                      return withCurrent.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ));
                    })()}
                  </select>
                </div>
                <div>
                  <label htmlFor="threshold_pct" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Threshold % (0–100)</label>
                  <input
                    id="threshold_pct"
                    name="threshold_pct"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    required
                    defaultValue={editingRule?.threshold_pct ?? 70}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div id="window_days-wrap">
                  <label htmlFor="window_days" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Window (days, for trend drop)</label>
                  <input
                    id="window_days"
                    name="window_days"
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={editingRule?.window_days ?? 7}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    placeholder="e.g. 7"
                  />
                </div>
                <div>
                  <label htmlFor="severity" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Severity</label>
                  <select
                    id="severity"
                    name="severity"
                    defaultValue={editingRule?.severity ?? "medium"}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {SEVERITIES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="project_slug" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Project (optional)</label>
                  <select
                    id="project_slug"
                    name="project_slug"
                    defaultValue={editingRule?.project_slug ?? ""}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    <option value="">All projects</option>
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>{p.name || p.slug}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    id="enabled"
                    name="enabled"
                    type="checkbox"
                    defaultChecked={editingRule?.enabled ?? true}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <label htmlFor="enabled" className="text-sm font-medium text-slate-700 dark:text-slate-300">Enabled</label>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  {submitting ? "Saving…" : editingRule ? "Update rule" : "Create rule"}
                </button>
                <button
                  type="button"
                  onClick={closeRuleForm}
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : alertRules.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              No alert rules yet. Click &quot;Add rule&quot; to create one.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {alertRules.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <div>
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {r.rule_type} · {r.metric} {r.rule_type === "threshold" ? `< ${r.threshold_pct}%` : `drop ≥ ${r.threshold_pct}% over ${r.window_days}d`}
                    </span>
                    {r.project_slug && (
                      <span className="ml-2 text-xs text-slate-400">· {r.project_slug}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${r.enabled ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"}`}
                    >
                      {r.enabled ? "On" : "Off"}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditForm(r)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(r.id)}
                      disabled={deletingId === r.id}
                      className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-slate-700 dark:text-red-300 dark:hover:bg-red-900/30"
                    >
                      {deletingId === r.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Run alerts diagnostic - at bottom */}
        {selectedEntityId && (
          <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Run alerts diagnostic
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Check why trend alerts may not be created: rules, projects, and metric data.
            </p>
            <button
              type="button"
              onClick={runDiagnostic}
              disabled={diagnosticLoading}
              className="mt-3 rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              {diagnosticLoading ? "Running…" : "Run diagnostic"}
            </button>
            {diagnostic && (
              <div className="mt-4 space-y-2 text-sm">
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  {diagnostic.summary?.enabled_rules_count ?? 0} enabled rule(s). {diagnostic.summary?.message ?? ""}
                </p>
                {diagnostic.rules && diagnostic.rules.length > 0 && (
                  <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-800/50">
                    <p className="mb-2 font-medium text-slate-700 dark:text-slate-200">Per-rule check (first 10 projects):</p>
                    <ul className="list-inside list-disc space-y-1 text-slate-600 dark:text-slate-300">
                      {diagnostic.rules.map((r) => (
                        <li key={r.name}>
                          <strong>{r.name}</strong> ({r.rule_type}, {r.metric} &lt; {r.threshold_pct}%): {r.projects_count} project(s).
                          {r.projects?.filter((p: Record<string, unknown>) => p.project_slug).map((p: Record<string, unknown>) => (
                            <span key={String(p.project_slug)} className="ml-2 block">
                              {String(p.project_slug)}: history={String(p.control_values_history_rows ?? 0)}, provenance={String(p.provenance_evaluations_rows ?? 0)}, value={p.current_metric_value ?? "—"}
                              {p.would_fire_threshold === true ? " (would fire)" : ""}
                            </span>
                          ))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
