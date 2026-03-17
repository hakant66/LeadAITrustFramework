"use client";

import { useEffect, useMemo, useState } from "react";
import { coreApiBase } from "@/lib/coreApiBase";

const POLICY_FORM = {
  retention_class: "",
  archive_after_days: "",
  delete_after_days: "",
  notes: "",
};

const SUGGESTED_POLICIES = [
  {
    retention_class: "12 months (analytics)",
    archive_after_days: "180",
    delete_after_days: "365",
    notes:
      "Aggregated analytics data retained for 12 months for trend analysis; archive after 6 months.",
  },
  {
    retention_class: "24 months (model monitoring)",
    archive_after_days: "365",
    delete_after_days: "730",
    notes:
      "Model monitoring logs retained for 24 months to support auditability and post-deployment review.",
  },
  {
    retention_class: "7 years (financial/regulatory)",
    archive_after_days: "1095",
    delete_after_days: "2555",
    notes:
      "Financial/compliance records retained for 7 years per regulatory obligations; archive after 3 years.",
  },
  {
    retention_class: "Contract + 90 days",
    archive_after_days: "",
    delete_after_days: "90",
    notes:
      "Customer datasets retained for contract term plus 90 days for dispute resolution.",
  },
  {
    retention_class: "PII minimal retention (180 days)",
    archive_after_days: "",
    delete_after_days: "180",
    notes:
      "PII retained only as long as needed for stated purpose; delete after 180 days unless consent allows more.",
  },
  {
    retention_class: "Incident evidence (5 years)",
    archive_after_days: "730",
    delete_after_days: "1825",
    notes:
      "Security incident evidence retained for 5 years to support investigations.",
  },
];

const RECORD_FORM = {
  assignment_id: "",
  retention_class: "",
  start_date: "",
  status: "active",
  notes: "",
};

const USAGE_FORM = {
  assignment_id: "",
  usage_type: "training",
  purpose: "",
};

const STATUSES = ["active", "archived", "on_hold", "deleted"] as const;
const USAGE_TYPES = [
  "training",
  "analytics",
  "inference",
  "monitoring",
  "other",
] as const;

type Policy = {
  id: string;
  retention_class: string;
  archive_after_days?: number | null;
  delete_after_days: number;
  notes?: string | null;
};

type Assignment = {
  id: string;
  connector_id: string;
  name?: string | null;
  id_number?: string | null;
  table_name?: string | null;
  schema_name?: string | null;
  tag_name?: string | null;
  retention_class?: string | null;
};

type Record = {
  id: string;
  assignment_id: string;
  retention_class: string;
  start_date: string;
  status: string;
  notes?: string | null;
  archived_at?: string | null;
  deleted_at?: string | null;
};

type Warning = {
  id: string;
  assignment_id: string;
  warning_type: string;
  severity: string;
  message: string;
  created_at?: string | null;
  resolved_at?: string | null;
};

export default function DataRetentionClient() {
  const apiBase = useMemo(() => coreApiBase(), []);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [records, setRecords] = useState<Record[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [policyForm, setPolicyForm] = useState(POLICY_FORM);
  const [recordForm, setRecordForm] = useState(RECORD_FORM);
  const [usageForm, setUsageForm] = useState(USAGE_FORM);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAll = async () => {
    setBusy(true);
    setError(null);
    try {
      const [policyRes, recordRes, assignmentRes, warningRes] =
        await Promise.all([
          fetch(`${apiBase}/admin/retention/policies`, { cache: "no-store" }),
          fetch(`${apiBase}/admin/retention/records`, { cache: "no-store" }),
          fetch(`${apiBase}/admin/data-classification/assignments`, {
            cache: "no-store",
          }),
          fetch(`${apiBase}/admin/data-governance/warnings:compute`, {
            method: "POST",
          }),
        ]);
      if (!policyRes.ok) throw new Error("Failed to load retention policies");
      if (!recordRes.ok) throw new Error("Failed to load retention records");
      if (!assignmentRes.ok)
        throw new Error("Failed to load classification assignments");
      if (!warningRes.ok) throw new Error("Failed to load warnings");
      setPolicies((await policyRes.json()) as Policy[]);
      setRecords((await recordRes.json()) as Record[]);
      setAssignments((await assignmentRes.json()) as Assignment[]);
      const warningPayload = (await warningRes.json()) as {
        warnings?: Warning[];
      };
      setWarnings(warningPayload.warnings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handlePolicyChange = (key: keyof typeof POLICY_FORM) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPolicyForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleRecordChange = (key: keyof typeof RECORD_FORM) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setRecordForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const handleUsageChange = (key: keyof typeof USAGE_FORM) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setUsageForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const savePolicy = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        retention_class: policyForm.retention_class.trim(),
        archive_after_days: policyForm.archive_after_days
          ? Number(policyForm.archive_after_days)
          : undefined,
        delete_after_days: Number(policyForm.delete_after_days),
        notes: policyForm.notes.trim() || undefined,
      };
      const url = editingPolicyId
        ? `${apiBase}/admin/retention/policies/${editingPolicyId}`
        : `${apiBase}/admin/retention/policies`;
      const method = editingPolicyId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to save policy");
      }
      setPolicyForm(POLICY_FORM);
      setEditingPolicyId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save policy");
    } finally {
      setBusy(false);
    }
  };

  const applySuggestedPolicy = (policy: (typeof SUGGESTED_POLICIES)[number]) => {
    setEditingPolicyId(null);
    setPolicyForm({
      retention_class: policy.retention_class,
      archive_after_days: policy.archive_after_days,
      delete_after_days: policy.delete_after_days,
      notes: policy.notes,
    });
  };

  const startPolicyEdit = (policy: Policy) => {
    setEditingPolicyId(policy.id);
    setPolicyForm({
      retention_class: policy.retention_class ?? "",
      archive_after_days:
        policy.archive_after_days !== null && policy.archive_after_days !== undefined
          ? String(policy.archive_after_days)
          : "",
      delete_after_days: String(policy.delete_after_days ?? ""),
      notes: policy.notes ?? "",
    });
  };

  const deletePolicy = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/admin/retention/policies/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to delete policy");
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete policy");
    } finally {
      setBusy(false);
    }
  };

  const saveRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        assignment_id: recordForm.assignment_id,
        retention_class: recordForm.retention_class,
        start_date: recordForm.start_date,
        status: recordForm.status,
        notes: recordForm.notes.trim() || undefined,
      };
      const url = editingRecordId
        ? `${apiBase}/admin/retention/records/${editingRecordId}`
        : `${apiBase}/admin/retention/records`;
      const method = editingRecordId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to save record");
      }
      setRecordForm(RECORD_FORM);
      setEditingRecordId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save record");
    } finally {
      setBusy(false);
    }
  };

  const startRecordEdit = (record: Record) => {
    setEditingRecordId(record.id);
    setRecordForm({
      assignment_id: record.assignment_id ?? "",
      retention_class: record.retention_class ?? "",
      start_date: record.start_date ? record.start_date.slice(0, 10) : "",
      status: record.status ?? "active",
      notes: record.notes ?? "",
    });
  };

  const deleteRecord = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/admin/retention/records/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to delete record");
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete record");
    } finally {
      setBusy(false);
    }
  };

  const submitUsage = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        assignment_id: usageForm.assignment_id,
        usage_type: usageForm.usage_type,
        purpose: usageForm.purpose.trim() || undefined,
      };
      const res = await fetch(`${apiBase}/admin/data-usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to record usage");
      }
      await runWarnings();
      setUsageForm(USAGE_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record usage");
    } finally {
      setBusy(false);
    }
  };

  const runWarnings = async () => {
    const res = await fetch(`${apiBase}/admin/data-governance/warnings:compute`, {
      method: "POST",
    });
    if (res.ok) {
      const data = (await res.json()) as { warnings?: Warning[] };
      if (data.warnings) setWarnings(data.warnings);
    } else {
      const msg = await res.text();
      setError(msg || "Failed to compute warnings");
    }
  };

  const resolveWarning = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/admin/data-governance/warnings/${id}/resolve`,
        { method: "POST" }
      );
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to resolve warning");
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve warning");
    } finally {
      setBusy(false);
    }
  };

  const policyMap = useMemo(() => {
    const map = new Map<string, Policy>();
    policies.forEach((policy) => map.set(policy.retention_class, policy));
    return map;
  }, [policies]);

  const getAssignmentLabel = (assignmentId: string) => {
    const assignment = assignments.find((a) => a.id === assignmentId);
    if (!assignment) return assignmentId;
    const name = assignment.name || assignment.id_number || "Unnamed";
    const table = assignment.table_name
      ? `${assignment.schema_name ?? ""}.${assignment.table_name}`
      : "";
    return `${name}${table ? ` (${table})` : ""}`;
  };

  const formatDate = (dateValue?: string | null) => {
    if (!dateValue) return "-";
    return new Date(dateValue).toLocaleDateString();
  };

  const getDueDate = (record: Record, kind: "archive" | "delete") => {
    const policy = policyMap.get(record.retention_class);
    if (!policy) return "-";
    const days = kind === "archive" ? policy.archive_after_days : policy.delete_after_days;
    if (!days) return "-";
    const base = new Date(record.start_date);
    base.setDate(base.getDate() + days);
    return base.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Retention Policies
        </h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTED_POLICIES.map((policy) => (
            <button
              key={policy.retention_class}
              type="button"
              onClick={() => applySuggestedPolicy(policy)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {policy.retention_class}
            </button>
          ))}
        </div>
        <form onSubmit={savePolicy} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Retention Class
            </label>
            <input
              value={policyForm.retention_class}
              onChange={handlePolicyChange("retention_class")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="12 months"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Archive After (days)
            </label>
            <input
              value={policyForm.archive_after_days}
              onChange={handlePolicyChange("archive_after_days")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              type="number"
              min="1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Delete After (days)
            </label>
            <input
              value={policyForm.delete_after_days}
              onChange={handlePolicyChange("delete_after_days")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              type="number"
              min="1"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Notes
            </label>
            <input
              value={policyForm.notes}
              onChange={handlePolicyChange("notes")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Retention policy details"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
              disabled={busy}
            >
              {editingPolicyId ? "Update Policy" : "Save Policy"}
            </button>
          </div>
        </form>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-4">Class</th>
                <th className="py-2 pr-4">Archive After</th>
                <th className="py-2 pr-4">Delete After</th>
                <th className="py-2 pr-4">Notes</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-200">
              {policies.length === 0 ? (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={5}>
                    {busy ? "Loading..." : "No policies yet."}
                  </td>
                </tr>
              ) : (
                policies.map((policy) => (
                  <tr key={policy.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {policy.retention_class}
                    </td>
                    <td className="py-3 pr-4">
                      {policy.archive_after_days ?? "-"}
                    </td>
                    <td className="py-3 pr-4">{policy.delete_after_days}</td>
                    <td className="py-3 pr-4">{policy.notes ?? "-"}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startPolicyEdit(policy)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePolicy(policy.id)}
                          className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Retention Records
        </h2>
        <form onSubmit={saveRecord} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Classified Asset
            </label>
            <select
              value={recordForm.assignment_id}
              onChange={handleRecordChange("assignment_id")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              required
            >
              <option value="">Select asset</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {getAssignmentLabel(assignment.id)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Retention Class
            </label>
            <select
              value={recordForm.retention_class}
              onChange={handleRecordChange("retention_class")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              required
            >
              <option value="">Select retention class</option>
              {policies.map((policy) => (
                <option key={policy.id} value={policy.retention_class}>
                  {policy.retention_class}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Start Date
            </label>
            <input
              type="date"
              value={recordForm.start_date}
              onChange={handleRecordChange("start_date")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Status
            </label>
            <select
              value={recordForm.status}
              onChange={handleRecordChange("status")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Notes
            </label>
            <input
              value={recordForm.notes}
              onChange={handleRecordChange("notes")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Retention notes"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
              disabled={busy}
            >
              {editingRecordId ? "Update Record" : "Save Record"}
            </button>
          </div>
        </form>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-4">Asset</th>
                <th className="py-2 pr-4">Retention Class</th>
                <th className="py-2 pr-4">Start</th>
                <th className="py-2 pr-4">Archive Due</th>
                <th className="py-2 pr-4">Delete Due</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-200">
              {records.length === 0 ? (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={7}>
                    {busy ? "Loading..." : "No retention records yet."}
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-3 pr-4">{getAssignmentLabel(record.assignment_id)}</td>
                    <td className="py-3 pr-4">{record.retention_class}</td>
                    <td className="py-3 pr-4">{formatDate(record.start_date)}</td>
                    <td className="py-3 pr-4">{getDueDate(record, "archive")}</td>
                    <td className="py-3 pr-4">{getDueDate(record, "delete")}</td>
                    <td className="py-3 pr-4">{record.status}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startRecordEdit(record)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRecord(record.id)}
                          className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Record Data Usage
        </h2>
        <form onSubmit={submitUsage} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Classified Asset
            </label>
            <select
              value={usageForm.assignment_id}
              onChange={handleUsageChange("assignment_id")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              required
            >
              <option value="">Select asset</option>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {getAssignmentLabel(assignment.id)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Usage Type
            </label>
            <select
              value={usageForm.usage_type}
              onChange={handleUsageChange("usage_type")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {USAGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Purpose
            </label>
            <input
              value={usageForm.purpose}
              onChange={handleUsageChange("purpose")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Model training for churn prediction"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
              disabled={busy}
            >
              Record Usage
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Governance Warnings
          </h2>
          <button
            type="button"
            onClick={() => void runWarnings()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Run Checks
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-4">Asset</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Severity</th>
                <th className="py-2 pr-4">Message</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-200">
              {warnings.length === 0 ? (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={6}>
                    {busy ? "Loading..." : "No warnings yet."}
                  </td>
                </tr>
              ) : (
                warnings.map((warning) => (
                  <tr key={warning.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-3 pr-4">{getAssignmentLabel(warning.assignment_id)}</td>
                    <td className="py-3 pr-4">{warning.warning_type}</td>
                    <td className="py-3 pr-4">{warning.severity}</td>
                    <td className="py-3 pr-4">{warning.message}</td>
                    <td className="py-3 pr-4">{formatDate(warning.created_at)}</td>
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => resolveWarning(warning.id)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                      >
                        Resolve
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {error ? (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      ) : null}
    </div>
  );
}
