// scorecard/controls/page.tsx
"use client";

import { useEffect, useState } from "react";
import Header from "@/app/(components)/Header";

type Control = {
  control_id: string;
  name: string;
  pillar?: string | null;
  unit?: string | null;
  norm_min?: number | null;
  norm_max?: number | null;
  higher_is_better: boolean;
  weight: number;
};

const base =
  process.env.NEXT_PUBLIC_CORE_SVC_URL ??
  process.env.CORE_SVC_URL ??
  "http://localhost:8001";

export default function ControlsManagerPage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [draft, setDraft] = useState<Control>({
    control_id: "",
    name: "",
    pillar: "",
    unit: "",
    norm_min: undefined as any,
    norm_max: undefined as any,
    higher_is_better: true,
    weight: 1,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    const res = await fetch(`${base}/admin/controls`, { cache: "no-store" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j?.detail || `Load failed (${res.status})`);
      return;
    }
    const data = await res.json();
    setControls(data);
  };

  useEffect(() => {
    void load();
  }, []);

  const resetDraft = () =>
    setDraft({
      control_id: "",
      name: "",
      pillar: "",
      unit: "",
      norm_min: undefined as any,
      norm_max: undefined as any,
      higher_is_better: true,
      weight: 1,
    });

  const createOne = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/admin/controls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || `Create failed (${res.status})`);
      }
      resetDraft();
      await load();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const updateOne = async (row: Control) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${base}/admin/controls/${encodeURIComponent(row.control_id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(row),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || `Update failed (${res.status})`);
      }
      await load();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteOne = async (id: string) => {
    if (!confirm(`Delete control '${id}'?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${base}/admin/controls/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || `Delete failed (${res.status})`);
      }
      await load();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="px-6 py-6 max-w-6xl mx-auto space-y-4">
        <Header
          title="Global Controls"
          subtitle="LeadAI · Trust Scorecard"
        >
          <div className="flex gap-3">
            <a
              href="/scorecard/admin"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              ← Capture Project
            </a>
          </div>
        </Header>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          Manage canonical controls used across all AI projects. These feed into
          project-level control values and KPI scoring.
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </div>
        )}

        {/* Create row */}
        <div className="grid grid-cols-1 md:grid-cols-8 gap-2 mb-4">
          <input
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="control_id"
            value={draft.control_id}
            onChange={(e) =>
              setDraft({ ...draft, control_id: e.target.value })
            }
          />
          <input
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <input
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="pillar"
            value={draft.pillar ?? ""}
            onChange={(e) => setDraft({ ...draft, pillar: e.target.value })}
          />
          <input
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="unit"
            value={draft.unit ?? ""}
            onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
          />
          <input
            type="number"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="norm_min"
            value={draft.norm_min ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                norm_min:
                  e.target.value === "" ? (undefined as any) : +e.target.value,
              })
            }
          />
          <input
            type="number"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="norm_max"
            value={draft.norm_max ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                norm_max:
                  e.target.value === "" ? (undefined as any) : +e.target.value,
              })
            }
          />
          <button
            disabled={busy || !draft.control_id || !draft.name}
            onClick={createOne}
            className="md:col-span-2 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Control
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <tr>
                <th className="text-left p-2 font-medium">control_id</th>
                <th className="text-left p-2 font-medium">name</th>
                <th className="text-left p-2 font-medium">pillar</th>
                <th className="text-left p-2 font-medium">unit</th>
                <th className="text-left p-2 font-medium">norm_min</th>
                <th className="text-left p-2 font-medium">norm_max</th>
                <th className="text-left p-2 font-medium">higher_is_better</th>
                <th className="text-left p-2 font-medium">weight</th>
                <th className="text-right p-2 font-medium">actions</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((c) => (
                <Row
                  key={c.control_id}
                  row={c}
                  onSave={updateOne}
                  onDelete={deleteOne}
                  busy={busy}
                />
              ))}
              {controls.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-4 text-sm text-slate-500 dark:text-slate-400"
                  >
                    No controls defined yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Row({
  row,
  onSave,
  onDelete,
  busy,
}: {
  row: Control;
  onSave: (r: Control) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const [edit, setEdit] = useState<Control>(row);

  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      <td className="p-2 font-mono text-xs text-slate-700 dark:text-slate-300">
        {row.control_id}
      </td>
      <td className="p-2">
        <input
          className="w-44 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          value={edit.name}
          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
        />
      </td>
      <td className="p-2">
        <input
          className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          value={edit.pillar ?? ""}
          onChange={(e) => setEdit({ ...edit, pillar: e.target.value })}
        />
      </td>
      <td className="p-2">
        <input
          className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          value={edit.unit ?? ""}
          onChange={(e) => setEdit({ ...edit, unit: e.target.value })}
        />
      </td>
      <td className="p-2">
        <input
          type="number"
          className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          value={edit.norm_min ?? ""}
          onChange={(e) =>
            setEdit({
              ...edit,
              norm_min:
                e.target.value === "" ? (undefined as any) : +e.target.value,
            })
          }
        />
      </td>
      <td className="p-2">
        <input
          type="number"
          className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          value={edit.norm_max ?? ""}
          onChange={(e) =>
            setEdit({
              ...edit,
              norm_max:
                e.target.value === "" ? (undefined as any) : +e.target.value,
            })
          }
        />
      </td>
      <td className="p-2">
        <input
          type="checkbox"
          checked={!!edit.higher_is_better}
          onChange={(e) =>
            setEdit({ ...edit, higher_is_better: e.target.checked })
          }
          className="h-4 w-4 accent-indigo-600"
        />
      </td>
      <td className="p-2">
        <input
          type="number"
          step="0.1"
          className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          value={edit.weight}
          onChange={(e) => setEdit({ ...edit, weight: +e.target.value })}
        />
      </td>
      <td className="p-2 text-right space-x-2">
        <button
          disabled={busy}
          onClick={() => onSave(edit)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Save
        </button>
        <button
          disabled={busy}
          onClick={() => onDelete(row.control_id)}
          className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/70 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
