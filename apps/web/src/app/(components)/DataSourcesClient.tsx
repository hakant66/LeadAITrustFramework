"use client";

import { useEffect, useMemo, useState } from "react";
import { coreApiBase } from "@/lib/coreApiBase";

const SSL_OPTIONS = ["disable", "require", "verify-ca", "verify-full"] as const;

type DataSource = {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl_mode?: string | null;
  status: string;
  last_tested_at?: string | null;
  last_test_status?: string | null;
  last_test_error?: string | null;
};

type FormState = {
  name: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  ssl_mode: string;
};

const initialForm: FormState = {
  name: "",
  host: "",
  port: "5432",
  database: "",
  username: "",
  password: "",
  ssl_mode: "disable",
};

export default function DataSourcesClient() {
  const [items, setItems] = useState<DataSource[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const apiBase = useMemo(() => coreApiBase(), []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/admin/data-sources`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = (await res.json()) as DataSource[];
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleChange = (key: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
    };

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const beginEdit = (item: DataSource) => {
    setError(null);
    setEditingId(item.id);
    setForm({
      name: item.name,
      host: item.host,
      port: String(item.port),
      database: item.database,
      username: item.username,
      password: "",
      ssl_mode: item.ssl_mode || "disable",
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        host: form.host.trim(),
        port: Number(form.port || 5432),
        database: form.database.trim(),
        username: form.username.trim(),
        ssl_mode: form.ssl_mode || undefined,
      };

      if (editingId) {
        if (form.password) payload.password = form.password;
      } else {
        payload.type = "postgres";
        payload.password = form.password || undefined;
      }

      const res = await fetch(
        editingId ? `${apiBase}/admin/data-sources/${editingId}` : `${apiBase}/admin/data-sources`,
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Failed to ${editingId ? "update" : "save"} (${res.status})`);
      }

      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${editingId ? "update" : "save"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/admin/data-sources/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Failed to delete (${res.status})`);
      }
      if (editingId === id) resetForm();
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  };

  const handleTest = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/admin/data-sources/${id}:test`, {
        method: "POST",
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `Test failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Database Connector
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Store connection details for Postgres sources. Use Test to validate.
            </p>
          </div>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          ) : null}
        </div>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Name
            </label>
            <input
              value={form.name}
              onChange={handleChange("name")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Analytics warehouse"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Host
            </label>
            <input
              value={form.host}
              onChange={handleChange("host")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="db.company.internal"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Port
            </label>
            <input
              value={form.port}
              onChange={handleChange("port")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              type="number"
              min="1"
              max="65535"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Database
            </label>
            <input
              value={form.database}
              onChange={handleChange("database")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="warehouse"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Username
            </label>
            <input
              value={form.username}
              onChange={handleChange("username")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="readonly_user"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Password
            </label>
            <input
              value={form.password}
              onChange={handleChange("password")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              type="password"
              placeholder={editingId ? "Leave blank to keep current password" : "••••••••"}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              SSL Mode
            </label>
            <select
              value={form.ssl_mode}
              onChange={handleChange("ssl_mode")}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {SSL_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
              disabled={loading}
            >
              {loading
                ? editingId
                  ? "Updating..."
                  : "Saving..."
                : editingId
                ? "Update Connector"
                : "Save Connector"}
            </button>
          </div>
        </form>
        {error ? (
          <div className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Connected Sources
          </h2>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Host</th>
                <th className="py-2 pr-4">Database</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Last Test</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td className="py-4 text-sm text-slate-500" colSpan={6}>
                    {loading ? "Loading..." : "No connectors yet."}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-3 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {item.name}
                      <div className="text-xs text-slate-400">
                        {item.username}@{item.host}:{item.port}
                      </div>
                    </td>
                    <td className="py-3 pr-4">{item.host}</td>
                    <td className="py-3 pr-4">{item.database}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full border px-2 py-0.5 text-xs">
                        {item.last_test_status ?? item.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="text-xs text-slate-500">
                        {item.last_tested_at
                          ? new Date(item.last_tested_at).toLocaleString()
                          : "Not tested"}
                      </div>
                      {item.last_test_error ? (
                        <div className="text-[11px] text-red-500">
                          {item.last_test_error}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => beginEdit(item)}
                          className="rounded-lg border border-sky-300 px-2 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
                          disabled={busyId === item.id}
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleTest(item.id)}
                          className="rounded-lg border border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                          disabled={busyId === item.id}
                        >
                          {busyId === item.id ? "Testing..." : "Test"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.id)}
                          className="rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                          disabled={busyId === item.id}
                        >
                          {busyId === item.id ? "Deleting..." : "Delete"}
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
    </div>
  );
}
