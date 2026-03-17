"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type PillarRow = { pillar: string; score: number; maturity?: number };

export default function EditPillars({
  projectId,
  initial,
}: {
  projectId: string;
  initial: PillarRow[];
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [rows, setRows] = useState<PillarRow[]>(
    () =>
      initial?.map((p) => ({
        pillar: String(p.pillar || ""),
        // integers 0–100
        score: Number.isFinite(p.score)
          ? Math.max(0, Math.min(100, Math.round(p.score)))
          : 0,
        maturity: p.maturity,
      })) ?? []
  );

  const onChange = (i: number, field: "pillar" | "score", val: string) => {
    setRows((curr) => {
      const copy = [...curr];
      if (field === "pillar") {
        copy[i] = { ...copy[i], pillar: val };
      } else {
        const n = Math.trunc(Number(val));
        copy[i] = {
          ...copy[i],
          score: Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0,
        };
      }
      return copy;
    });
  };

  const addRow = () => setRows((r) => [...r, { pillar: "", score: 0 }]);
  const delRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const pillars = rows
      .map((r) => ({
        pillar: r.pillar.trim(),
        score_pct: Math.trunc(r.score),
        maturity: r.maturity,
      }))
      .filter((r) => r.pillar.length > 0);

    if (!pillars.length) {
      alert("Please add at least one pillar with a name.");
      return;
    }

    const res = await fetch(`/api/scorecard/${projectId}/pillars`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, pillars }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      alert(`Save failed (${res.status}):\n${text}`);
      return;
    }
    start(() => router.refresh());
  };

  return (
    <form onSubmit={onSave} className="space-y-3">
      <div className="text-sm text-gray-600 dark:text-slate-300">
        Edit pillar names and integer scores (0–100). Click “Save” to persist to
        the backend.
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-slate-400">
              <th className="py-2 pr-4">Pillar</th>
              <th className="py-2 pr-4">Score (0–100)</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.pillar || "new"}-${i}`}
                className="border-t border-slate-200 dark:border-slate-700"
              >
                <td className="py-2 pr-4">
                  <input
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    value={r.pillar}
                    onChange={(e) => onChange(i, "pillar", e.target.value)}
                    placeholder={`Pillar ${i + 1}`}
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    inputMode="numeric"
                    type="number"
                    step={1}
                    min={0}
                    max={100}
                    className="w-28 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-right bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    value={r.score}
                    onChange={(e) => onChange(i, "score", e.target.value)}
                  />
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => delRow(i)}
                    className="text-red-600 dark:text-red-400 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="pt-3">
                <button
                  type="button"
                  onClick={addRow}
                  className="rounded-xl px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  + Add pillar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center rounded-xl px-3 py-2 border border-slate-900 dark:border-indigo-500 bg-slate-900 dark:bg-indigo-600 text-white text-sm hover:bg-slate-800 dark:hover:bg-indigo-500 disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save Pillars"}
      </button>
    </form>
  );
}
