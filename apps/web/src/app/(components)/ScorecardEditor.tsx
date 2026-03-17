"use client";
// src/app/(components)/ScorecardEditor.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";

type KPI = {
  pillar: string;
  kpi_id: string;
  key: string;
  name: string;
  unit: string;
  raw_value: number | null;
  normalized: number;
  notes?: string | null;
};

export default function ScorecardEditor({ projectId, kpis }: { projectId: string; kpis: KPI[] }) {
  const [rows, setRows] = useState<KPI[]>(kpis);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const setValue = (i: number, val: string) => {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, raw_value: val === "" ? null : Number(val) } : r));
  };
  const setNotes = (i: number, txt: string) => {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, notes: txt } : r));
  };

  async function save() {
    setSaving(true);
    try {
      const payload = {
        project_id: projectId,
        values: rows
          .filter(r => r.raw_value !== null && !Number.isNaN(r.raw_value))
          .map(r => ({ kpi_id: r.kpi_id, raw_value: Number(r.raw_value), notes: r.notes ?? undefined })),
      };

      const resp = await fetch(`/api/scorecard/${projectId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const msg = await resp.text();
        throw new Error(msg || `Save failed (${resp.status})`);
      }

      // Optionally revalidate the dashboard page in dev (if you added /api/revalidate)
      // await fetch("/api/revalidate", { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({ path: `/scorecard/${projectId}/dashboard` }) });

      alert("Saved ✔");
      // Revisit dashboard to see updated scores
      router.push(`/scorecard/${projectId}/dashboard`);
      router.refresh();
    } catch (err: any) {
      alert(err?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">KPIs ({rows.length})</h2>
        <div className="space-x-2">
          <a className="px-3 py-1.5 rounded border" href={`/scorecard/${projectId}/dashboard`}>Back</a>
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded bg-black text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className="mt-3 border rounded overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2">Pillar</th>
              <th className="p-2">KPI</th>
              <th className="p-2" title="Enter raw values (%, days, hours, ms, count)">Raw</th>
              <th className="p-2">Unit</th>
              <th className="p-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.kpi_id} className="border-t align-top">
                <td className="p-2 whitespace-nowrap">{r.pillar}</td>
                <td className="p-2">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-[11px] text-gray-500 font-mono">{r.key}</div>
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    step="any"
                    className="border rounded px-2 py-1 w-36"
                    value={r.raw_value ?? ""}
                    onChange={e => setValue(i, e.target.value)}
                    placeholder="e.g., 85"
                  />
                </td>
                <td className="p-2">{r.unit}</td>
                <td className="p-2">
                  <input
                    className="border rounded px-2 py-1 w-full"
                    value={r.notes ?? ""}
                    onChange={e => setNotes(i, e.target.value)}
                    placeholder="optional notes"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Time-based KPIs (days/hours/ms) will be automatically normalized (inverted) on save according to your KPI config.
      </p>
    </section>
  );
}
