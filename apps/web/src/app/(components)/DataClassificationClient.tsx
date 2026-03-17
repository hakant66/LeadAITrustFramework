"use client";

import { useEffect, useMemo, useState } from "react";
import { coreApiBase } from "@/lib/coreApiBase";

const defaultTagForm = {
  tag_name: "",
  sensitivity_tier: "",
  pii_flag: false,
  allowed_usage: "",
  retention_class: "",
};

const defaultAssignForm = {
  connector_id: "",
  schema_name: "",
  table_name: "",
  name: "",
  id_number: "",
  tag_id: "",
};

type Connector = {
  id: string;
  name: string;
  host: string;
  database: string;
};

type Tag = {
  id: string;
  tag_name: string;
  sensitivity_tier?: string | null;
  pii_flag?: boolean | null;
  allowed_usage?: string | null;
  retention_class?: string | null;
};

type Assignment = {
  id: string;
  connector_id: string;
  schema_name?: string | null;
  table_name?: string | null;
  name?: string | null;
  id_number?: string | null;
  tag_id: string;
  tag_name?: string | null;
  sensitivity_tier?: string | null;
  pii_flag?: boolean | null;
  allowed_usage?: string | null;
  retention_class?: string | null;
};

export default function DataClassificationClient() {
  const apiBase = useMemo(() => coreApiBase(), []);
  const [tags, setTags] = useState<Tag[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<{ schema: string; table: string }[]>([]);
  const [tagForm, setTagForm] = useState(defaultTagForm);
  const [assignForm, setAssignForm] = useState(defaultAssignForm);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingAssignId, setEditingAssignId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);

  const loadAll = async () => {
    setBusy(true);
    setError(null);
    try {
      const [tagRes, assignRes, connRes] = await Promise.all([
        fetch(`${apiBase}/admin/data-classification/tags`, {
          cache: "no-store",
        }),
        fetch(`${apiBase}/admin/data-classification/assignments`, {
          cache: "no-store",
        }),
        fetch(`${apiBase}/admin/data-sources`, { cache: "no-store" }),
      ]);
      if (!tagRes.ok) throw new Error("Failed to load tags");
      if (!assignRes.ok) throw new Error("Failed to load assignments");
      if (!connRes.ok) throw new Error("Failed to load connectors");
      setTags((await tagRes.json()) as Tag[]);
      setAssignments((await assignRes.json()) as Assignment[]);
      setConnectors((await connRes.json()) as Connector[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleTagChange = (key: keyof typeof defaultTagForm) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        event.target.type === "checkbox"
          ? (event.target as HTMLInputElement).checked
          : event.target.value;
      setTagForm((prev) => ({ ...prev, [key]: value }));
    };

  const handleAssignChange = (key: keyof typeof defaultAssignForm) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setAssignForm((prev) => {
        const next = { ...prev, [key]: value };
        if (key === "connector_id") {
          next.schema_name = "";
          next.table_name = "";
        }
        if (key === "schema_name") {
          next.table_name = "";
        }
        return next;
      });
      if (key === "connector_id") {
        void loadSchemas(value);
      }
      if (key === "schema_name") {
        void loadTables(assignForm.connector_id, value);
      }
    };

  const loadSchemas = async (connectorId: string) => {
    if (!connectorId) {
      setSchemas([]);
      setTables([]);
      return;
    }
    setLoadingSchemas(true);
    try {
      const res = await fetch(
        `${apiBase}/admin/data-sources/${connectorId}/schemas`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to load schemas");
      }
      const data = (await res.json()) as { schemas?: string[] };
      setSchemas(data.schemas ?? []);
      setTables([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schemas");
    } finally {
      setLoadingSchemas(false);
    }
  };

  const loadTables = async (connectorId: string, schemaName: string) => {
    if (!connectorId || !schemaName) {
      setTables([]);
      return;
    }
    setLoadingTables(true);
    try {
      const res = await fetch(
        `${apiBase}/admin/data-sources/${connectorId}/tables?schema=${encodeURIComponent(
          schemaName
        )}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to load tables");
      }
      const data = (await res.json()) as {
        tables?: { schema: string; table: string }[];
      };
      setTables(data.tables ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tables");
    } finally {
      setLoadingTables(false);
    }
  };

  const saveTag = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = {
        tag_name: tagForm.tag_name.trim(),
        sensitivity_tier: tagForm.sensitivity_tier.trim() || undefined,
        pii_flag: tagForm.pii_flag,
        allowed_usage: tagForm.allowed_usage.trim() || undefined,
        retention_class: tagForm.retention_class.trim() || undefined,
      };
      const url = editingTagId
        ? `${apiBase}/admin/data-classification/tags/${editingTagId}`
        : `${apiBase}/admin/data-classification/tags`;
      const method = editingTagId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to save tag");
      }
      setTagForm(defaultTagForm);
      setEditingTagId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save tag");
    } finally {
      setBusy(false);
    }
  };

  const startEditTag = (tag: Tag) => {
    setEditingTagId(tag.id);
    setTagForm({
      tag_name: tag.tag_name ?? "",
      sensitivity_tier: tag.sensitivity_tier ?? "",
      pii_flag: Boolean(tag.pii_flag),
      allowed_usage: tag.allowed_usage ?? "",
      retention_class: tag.retention_class ?? "",
    });
  };

  const deleteTag = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/admin/data-classification/tags/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to delete tag");
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag");
    } finally {
      setBusy(false);
    }
  };

  const saveAssignment = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const payload = {
        connector_id: assignForm.connector_id,
        schema_name: assignForm.schema_name.trim() || undefined,
        table_name: assignForm.table_name.trim() || undefined,
        name: assignForm.name.trim() || undefined,
        id_number: assignForm.id_number.trim() || undefined,
        tag_id: assignForm.tag_id,
      };
      const url = editingAssignId
        ? `${apiBase}/admin/data-classification/assignments/${editingAssignId}`
        : `${apiBase}/admin/data-classification/assignments`;
      const method = editingAssignId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to save assignment");
      }
      setAssignForm(defaultAssignForm);
      setEditingAssignId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save assignment");
    } finally {
      setBusy(false);
    }
  };

  const startEditAssignment = (assignment: Assignment) => {
    setEditingAssignId(assignment.id);
    setAssignForm({
      connector_id: assignment.connector_id ?? "",
      schema_name: assignment.schema_name ?? "",
      table_name: assignment.table_name ?? "",
      name: assignment.name ?? "",
      id_number: assignment.id_number ?? "",
      tag_id: assignment.tag_id ?? "",
    });
    void loadSchemas(assignment.connector_id ?? "");
    if (assignment.schema_name) {
      void loadTables(assignment.connector_id ?? "", assignment.schema_name);
    }
  };

  const deleteAssignment = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/admin/data-classification/assignments/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Failed to delete assignment");
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete assignment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Define Classification Tags
        </h2>
        <form onSubmit={saveTag} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Tag Name
            </label>
            <input
              value={tagForm.tag_name}
              onChange={handleTagChange("tag_name")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Confidential"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Sensitivity Tier
            </label>
            <input
              value={tagForm.sensitivity_tier}
              onChange={handleTagChange("sensitivity_tier")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Sensitive"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={tagForm.pii_flag}
              onChange={handleTagChange("pii_flag")}
              className="h-4 w-4"
            />
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              PII flag
            </label>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Allowed Usage
            </label>
            <input
              value={tagForm.allowed_usage}
              onChange={handleTagChange("allowed_usage")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Analytics only"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Retention Class
            </label>
            <input
              value={tagForm.retention_class}
              onChange={handleTagChange("retention_class")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="12 months"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
              disabled={busy}
            >
              {editingTagId ? "Update Tag" : "Save Tag"}
            </button>
          </div>
        </form>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-4">Tag</th>
                <th className="py-2 pr-4">Sensitivity</th>
                <th className="py-2 pr-4">PII</th>
                <th className="py-2 pr-4">Allowed Usage</th>
                <th className="py-2 pr-4">Retention</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-200">
              {tags.length === 0 ? (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={6}>
                    {busy ? "Loading..." : "No tags yet."}
                  </td>
                </tr>
              ) : (
                tags.map((tag) => (
                  <tr key={tag.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {tag.tag_name}
                    </td>
                    <td className="py-3 pr-4">{tag.sensitivity_tier || "-"}</td>
                    <td className="py-3 pr-4">{tag.pii_flag ? "Yes" : "No"}</td>
                    <td className="py-3 pr-4">{tag.allowed_usage || "-"}</td>
                    <td className="py-3 pr-4">{tag.retention_class || "-"}</td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditTag(tag)}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTag(tag.id)}
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
          Apply Tags to Sources or Tables
        </h2>
        <form onSubmit={saveAssignment} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Data Source
            </label>
            <select
              value={assignForm.connector_id}
              onChange={handleAssignChange("connector_id")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              required
            >
              <option value="">Select source</option>
              {connectors.map((connector) => (
                <option key={connector.id} value={connector.id}>
                  {connector.name} ({connector.host}/{connector.database})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Schema
            </label>
            <select
              value={assignForm.schema_name}
              onChange={handleAssignChange("schema_name")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              disabled={!assignForm.connector_id}
            >
              <option value="">Select schema</option>
              {schemas.map((schema) => (
                <option key={schema} value={schema}>
                  {schema}
                </option>
              ))}
            </select>
            {loadingSchemas ? (
              <div className="mt-1 text-xs text-slate-400">Loading schemas...</div>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Table
            </label>
            <select
              value={assignForm.table_name}
              onChange={handleAssignChange("table_name")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              disabled={!assignForm.schema_name}
            >
              <option value="">Select table</option>
              {tables.map((entry) => (
                <option key={`${entry.schema}.${entry.table}`} value={entry.table}>
                  {entry.table}
                </option>
              ))}
            </select>
            {loadingTables ? (
              <div className="mt-1 text-xs text-slate-400">Loading tables...</div>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Name
            </label>
            <input
              value={assignForm.name}
              onChange={handleAssignChange("name")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Customer records"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              ID Number
            </label>
            <input
              value={assignForm.id_number}
              onChange={handleAssignChange("id_number")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="DS-001"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Tag
            </label>
            <select
              value={assignForm.tag_id}
              onChange={handleAssignChange("tag_id")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              required
            >
              <option value="">Select tag</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.tag_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
              disabled={busy}
            >
              {editingAssignId ? "Update Assignment" : "Apply Tag"}
            </button>
          </div>
        </form>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Schema.Table</th>
                <th className="py-2 pr-4">Name / ID</th>
                <th className="py-2 pr-4">Tag</th>
                <th className="py-2 pr-4">PII</th>
                <th className="py-2 pr-4">Retention</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-200">
              {assignments.length === 0 ? (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={7}>
                    {busy ? "Loading..." : "No assignments yet."}
                  </td>
                </tr>
              ) : (
                assignments.map((assignment) => {
                  const connector = connectors.find(
                    (c) => c.id === assignment.connector_id
                  );
                  return (
                    <tr
                      key={assignment.id}
                      className="border-t border-slate-200 dark:border-slate-700"
                    >
                      <td className="py-3 pr-4">
                        {connector ? connector.name : assignment.connector_id}
                      </td>
                      <td className="py-3 pr-4">
                        {(assignment.schema_name || "-") +
                          "." +
                          (assignment.table_name || "-")}
                      </td>
                      <td className="py-3 pr-4">
                        <div>{assignment.name || "-"}</div>
                        <div className="text-xs text-slate-400">
                          {assignment.id_number || "-"}
                        </div>
                      </td>
                      <td className="py-3 pr-4">{assignment.tag_name}</td>
                      <td className="py-3 pr-4">
                        {assignment.pii_flag ? "Yes" : "No"}
                      </td>
                      <td className="py-3 pr-4">
                        {assignment.retention_class || "-"}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditAssignment(assignment)}
                            className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAssignment(assignment.id)}
                            className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
