"use client";

import { useEffect, useState } from "react";

type KpiDefinitionRow = {
  kpi_key: string;
  kpi_name: string;
  description?: string | null;
  iso_42001_clause?: string | null;
  euaiact_clause?: string | null;
  nist_clause?: string | null;
};

export default function KnowledgeBaseKpiTable({
  rows,
}: {
  rows: KpiDefinitionRow[];
}) {
  const [nistMap, setNistMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    rows.forEach((row) => {
      next[row.kpi_key] = row.nist_clause ?? "";
    });
    setNistMap(next);
  }, [rows]);

  const openKpi = (kpiKey: string) => {
    if (typeof window === "undefined") return;
    const url = `/scorecard/admin/knowledgebase/kpi/${encodeURIComponent(
      kpiKey
    )}`;
    window.open(
      url,
      "knowledgebase_kpi",
      "width=1200,height=900,noopener,noreferrer"
    );
  };

  const saveNistClause = async (kpiKey: string) => {
    setSaving((prev) => ({ ...prev, [kpiKey]: true }));
    setSaveError((prev) => ({ ...prev, [kpiKey]: "" }));
    try {
      const res = await fetch(
        `/api/core/admin/knowledgebase/kpis/${encodeURIComponent(kpiKey)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nist_clause: nistMap[kpiKey] || null }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Save failed (${res.status})`);
      }
    } catch (err: any) {
      setSaveError((prev) => ({
        ...prev,
        [kpiKey]: err?.message ?? String(err),
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [kpiKey]: false }));
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
          <tr>
            <th className="p-2 text-left">KPI</th>
            <th className="p-2 text-left">Description</th>
            <th className="p-2 text-left">ISO 42001 Clause</th>
            <th className="p-2 text-left">EU AI Act Clause</th>
            <th className="p-2 text-left">NIST Clause</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((kpi) => (
            <tr
              key={kpi.kpi_key}
              className="border-b border-slate-100 dark:border-slate-700/70 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
              onClick={() => openKpi(kpi.kpi_key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openKpi(kpi.kpi_key);
                }
              }}
            >
              <td className="p-2 font-medium text-indigo-700 dark:text-indigo-300">
                {kpi.kpi_name}
              </td>
              <td className="p-2 text-slate-700 dark:text-slate-300">
                {kpi.description ?? "—"}
              </td>
              <td className="p-2 text-slate-700 dark:text-slate-300">
                {kpi.iso_42001_clause ?? "—"}
              </td>
              <td className="p-2 text-slate-700 dark:text-slate-300">
                {kpi.euaiact_clause ?? "—"}
              </td>
              <td className="p-2 text-slate-700 dark:text-slate-300">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                      placeholder="e.g. GOVERN 1.1"
                      value={nistMap[kpi.kpi_key] ?? ""}
                      onChange={(e) =>
                        setNistMap((prev) => ({
                          ...prev,
                          [kpi.kpi_key]: e.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        saveNistClause(kpi.kpi_key);
                      }}
                      disabled={saving[kpi.kpi_key]}
                    >
                      {saving[kpi.kpi_key] ? "Saving" : "Save"}
                    </button>
                  </div>
                  {saveError[kpi.kpi_key] ? (
                    <div className="text-[11px] text-rose-600">
                      {saveError[kpi.kpi_key]}
                    </div>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                className="p-2 text-sm text-gray-500 dark:text-slate-400"
                colSpan={5}
              >
                No KPI definitions found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
