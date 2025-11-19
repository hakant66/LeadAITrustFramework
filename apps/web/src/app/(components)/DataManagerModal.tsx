// apps/web/src/app/(components)/DataManagerModal.tsx
"use client";

import { useEffect, useState } from "react";

type ControlRow = {
  id?: string | null; // new: used for row key fallback
  control_id: string;
  kpi_key: string;
  name?: string | null;
  pillar?: string | null;
  unit?: string | null;
  norm_min?: number | null;
  norm_max?: number | null;
  higher_is_better?: boolean | null;
  weight?: number | null;
  target_text?: string | null;
  target_numeric?: number | null;
  evidence_source?: string | null;
  owner_role?: string | null;
  frequency?: number | null;
  failure_action?: number | null;
  maturity_anchor_l3?: number | null;
  current_value?: number | null;
  as_of?: number | null;
  kpi_score?: number | null;
  description?: string | null;
  example?: string | null;
  notes?: string | null;
};

type KpiRow = {
  kpi_id: string; // kept in type for backend payloads, but not rendered
  key: string;
  name: string;
  unit?: string | null;
  pillar?: string | null;
  pillar_name?: string | null; // display-friendly pillar name
  pillar_key?: string | null;  // display-friendly pillar key
  description?: string | null;
  weight?: number | null;
  min_ideal?: number | null;
  max_ideal?: number | null;
  invert?: boolean | null;
  example?: string | null;
};

const CORE =
  process.env.NEXT_PUBLIC_CORE_SVC_URL ??
  process.env.CORE_SVC_URL ??
  "http://localhost:8001";

export default function DataManagerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"kpis" | "controls">("kpis");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kpiRows, setKpiRows] = useState<KpiRow[]>([]);
  const [controls, setControls] = useState<ControlRow[]>([]);

  // ----------------- helpers -----------------
  const download = async (url: string, filename: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // ----------------- KPIs -----------------
  const loadKpis = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/kpis`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load KPIs (${res.status})`);
      const data = await res.json();
      setKpiRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportKpis = () => download(`${CORE}/admin/kpis.xlsx`, `kpis.xlsx`);

  const importKpis = async (file: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${CORE}/admin/kpis`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`Import failed (${res.status})`);
      await loadKpis();
      alert("KPI import completed.");
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // ----------------- Controls -----------------
  const loadControls = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE}/admin/controls`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load controls (${res.status})`);
      const data = await res.json();
      const normalized = (Array.isArray(data) ? data : []).map((r: any) => ({
        ...r,
        control_id: r.control_id ?? r.id ?? r.controlId ?? r.ID, // fallback safety
      }));
      setControls(normalized);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const exportControls = () =>
    download(`${CORE}/admin/controls.xlsx`, `controls.xlsx`);

  const importControls = async (file: File) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // bulk import
      const res = await fetch(`${CORE}/admin/controls`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`Import failed (${res.status})`);
      await loadControls();
      alert("Controls import completed.");
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  // auto-load when opening / switching tabs
  useEffect(() => {
    if (!open) return;
    if (tab === "kpis") void loadKpis();
    if (tab === "controls") void loadControls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="w-[min(1100px,95vw)] max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gray-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/80">
          <div className="text-base font-semibold text-slate-900 dark:text-slate-50">
            Data Manager
          </div>
          <button
            className="text-sm rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-gray-50 p-1 dark:border-slate-700 dark:bg-slate-900/60">
            {[
              { id: "kpis", label: "KPIs" },
              { id: "controls", label: "Controls" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`min-w-[120px] rounded-lg px-4 py-2 text-sm ${
                  tab === (t.id as any)
                    ? "border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-50"
                    : "text-gray-600 dark:text-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[65vh] overflow-auto p-5">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-900/40 dark:text-red-100">
              {error}
            </div>
          )}

          {tab === "kpis" && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={exportKpis}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Export KPIs (.xlsx)
                </button>
                <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Import KPIs (.xlsx)
                  <input
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && importKpis(e.target.files[0])
                    }
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={loadKpis}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>

              {/* KPI table (hide `key` column, keep data) */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <tr>
                      {/* removed: <th className="text-left p-2">key</th> */}
                      <th className="p-2 text-left">pillar</th>
                      <th className="p-2 text-left">name</th>
                      <th className="p-2 text-left">unit</th>
                      <th className="p-2 text-left">description</th>
                      <th className="p-2 text-left">example</th>
                      <th className="p-2 text-left">weight</th>
                      <th className="p-2 text-left">min_ideal</th>
                      <th className="p-2 text-left">max_ideal</th>
                      <th className="p-2 text-left">invert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiRows.map((r) => (
                      // keep key in React key (fallback to r.key if kpi_id missing),
                      // but don't render the column
                      <tr
                        key={r.kpi_id || r.key}
                        className="border-b border-slate-100 dark:border-slate-700/70"
                      >
                        {/* removed: <td className="p-2">{r.key}</td> */}
                        <td className="p-2">
                          {r.pillar_name ?? r.pillar_key ?? r.pillar ?? ""}
                        </td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2">{r.unit ?? ""}</td>
                        <td className="p-2">{r.description ?? ""}</td>
                        <td className="p-2">{r.example ?? ""}</td>
                        <td className="p-2">{r.weight ?? ""}</td>
                        <td className="p-2">{r.min_ideal ?? ""}</td>
                        <td className="p-2">{r.max_ideal ?? ""}</td>
                        <td className="p-2">
                          {r.invert === true
                            ? "true"
                            : r.invert === false
                            ? "false"
                            : ""}
                        </td>
                      </tr>
                    ))}
                    {kpiRows.length === 0 && (
                      <tr>
                        <td
                          className="p-3 text-sm text-gray-500 dark:text-slate-400"
                          colSpan={9}
                        >
                          No KPIs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "controls" && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy}
                  onClick={exportControls}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Export Controls (.xlsx)
                </button>
                <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  Import Controls (.xlsx)
                  <input
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) =>
                      e.target.files?.[0] && importControls(e.target.files[0])
                    }
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={loadControls}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Refresh
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                    <tr>
                      {/* id / kpi_key intentionally hidden in UI */}
                      <th className="p-2 text-left">pillar</th>
                      <th className="p-2 text-left">name</th>
                      <th className="p-2 text-left">unit</th>
                      <th className="p-2 text-left">higher_is_better</th>
                      <th className="p-2 text-left">norm_min</th>
                      <th className="p-2 text-left">norm_max</th>
                      <th className="p-2 text-left">weight</th>
                      <th className="p-2 text-left">target_text</th>
                      <th className="p-2 text-left">target_numeric</th>
                      <th className="p-2 text-left">evidence_source</th>
                      <th className="p-2 text-left">owner_role</th>
                      <th className="p-2 text-left">frequency</th>
                      <th className="p-2 text-left">failure_action</th>
                      <th className="p-2 text-left">maturity_anchor_l3</th>
                      <th className="p-2 text-left">current_value</th>
                      <th className="p-2 text-left">as_of</th>
                      <th className="p-2 text-left">kpi_score</th>
                      <th className="p-2 text-left">description</th>
                      <th className="p-2 text-left">example</th>
                      <th className="p-2 text-left">notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {controls.map((c) => (
                      <tr
                        key={c.id ?? c.control_id}
                        className="border-b border-slate-100 dark:border-slate-700/70"
                      >
                        <td className="p-2">{c.pillar ?? ""}</td>
                        <td className="p-2">{c.name ?? ""}</td>
                        <td className="p-2">{c.unit ?? ""}</td>
                        <td className="p-2">
                          {c.higher_is_better === true
                            ? "true"
                            : c.higher_is_better === false
                            ? "false"
                            : ""}
                        </td>
                        <td className="p-2">{c.norm_min ?? ""}</td>
                        <td className="p-2">{c.norm_max ?? ""}</td>
                        <td className="p-2">{c.weight ?? ""}</td>
                        <td className="p-2">{c.target_text ?? ""}</td>
                        <td className="p-2">{c.target_numeric ?? ""}</td>
                        <td className="p-2">{c.evidence_source ?? ""}</td>
                        <td className="p-2">{c.owner_role ?? ""}</td>
                        <td className="p-2">{c.frequency ?? ""}</td>
                        <td className="p-2">{c.failure_action ?? ""}</td>
                        <td className="p-2">{c.maturity_anchor_l3 ?? ""}</td>
                        <td className="p-2">{c.current_value ?? ""}</td>
                        <td className="p-2">{c.as_of ?? ""}</td>
                        <td className="p-2">{c.kpi_score ?? ""}</td>
                        <td className="p-2">{c.description ?? ""}</td>
                        <td className="p-2">{c.example ?? ""}</td>
                        <td className="p-2">{c.notes ?? ""}</td>
                      </tr>
                    ))}
                    {controls.length === 0 && (
                      <tr>
                        <td
                          className="p-2 text-sm text-gray-500 dark:text-slate-400"
                          colSpan={20}
                        >
                          No controls yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-gray-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/80">
          <button
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
