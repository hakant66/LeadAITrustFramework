// apps/web/src/app/scorecard/[project]/dashboard/pillars_admin/PillarsWeightsCard.tsx
"use client";

import { useMemo, useState, useTransition } from "react";

type InputRow = {
  id: string | null | undefined;   // backend override id (may be missing)
  pillar_key: string;              // unique per pillar
  pillar_name: string;
  score_pct: number | null;        // read-only
  weight: number;                  // fraction from backend, e.g., 0.20
};

type RowState = InputRow & {
  uid: string;        // local unique id (pillar_key)
  weight_pct: number; // 0..100 for UI editing
  saving: boolean;
};

export default function PillarsWeightsCard({
  initialRows,
  project,
}: {
  initialRows: InputRow[];
  project: string;
}) {
  const [rows, setRows] = useState<RowState[]>(
    initialRows.map((r) => ({
      ...r,
      uid: r.pillar_key,
      weight_pct: Number.isFinite(r.weight) ? Math.round(r.weight * 100) : 0,
      saving: false,
    })),
  );

  const [pendingAll, startTransitionAll] = useTransition();
  const canSaveAll = useMemo(() => rows.length > 0, [rows]);

  const clampPct = (v: number) => Math.max(0, Math.min(100, v));

  // Update by uid (pillar_key), so one field change doesn't affect others
  const onWeightPctChange = (uid: string, v: string) => {
    const next = Number(v);
    setRows((prev) =>
      prev.map((r) =>
        r.uid === uid
          ? { ...r, weight_pct: Number.isFinite(next) ? clampPct(next) : r.weight_pct }
          : r,
      ),
    );
  };

  // Save ONE
  const saveOne = async (uid: string) => {
    const r = rows.find((x) => x.uid === uid);
    if (!r) return;

    setRows((prev) => prev.map((x) => (x.uid === uid ? { ...x, saving: true } : x)));
    try {
      // convert percent -> fraction (two decimals)
      const fraction = Number((r.weight_pct / 100).toFixed(2));

      const payload = {
        items: [
          {
            id: r.id ?? null,
            pillar_key: r.pillar_key,
            // IMPORTANT: 'weight' (fraction 0..1), not 'weight_pct'
            weight: fraction,
          },
        ],
      };
      // console.log("PUT payload (saveOne)", payload);

      const res = await fetch(
        `/api/scorecard/${encodeURIComponent(project)}/pillar_weights`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        console.error("Save failed", await res.text());
        return;
      }

      setRows((prev) =>
        prev.map((x) => (x.uid === uid ? { ...x, weight: fraction } : x)),
      );
    } finally {
      setRows((prev) =>
        prev.map((x) => (x.uid === uid ? { ...x, saving: false } : x)),
      );
    }
  };

  // Save ALL
  const saveAll = async () => {
    const payload = rows.map((r) => ({
      id: r.id ?? null,
      pillar_key: r.pillar_key,
      // send 'weight' (fraction 0..1)
      weight: Number((r.weight_pct / 100).toFixed(2)),
    }));

    startTransitionAll(async () => {
      const res = await fetch(
        `/api/scorecard/${encodeURIComponent(project)}/pillar_weights`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          // wrap in { items: [...] }
          body: JSON.stringify({ items: payload }),
        },
      );
      if (!res.ok) {
        console.error("Save failed", await res.text());
        return;
      }
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          weight: Number((r.weight_pct / 100).toFixed(2)),
        })),
      );
    });
  };

  return (
    <div
      className="
        border rounded-2xl p-4 space-y-4 bg-white shadow-sm
        border-slate-200 text-slate-900
        dark:bg-slate-900 dark:border-slate-700 dark:text-slate-50
      "
    >
      <div className="text-lg font-semibold">Update Pillar Weights</div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Edit pillar weights (0–100%). Click “Save” to update.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {rows.map((r) => (
          <div
            key={r.uid}
            className="
              border rounded-xl p-3 space-y-2
              bg-white border-slate-200
              dark:bg-slate-950/40 dark:border-slate-700
            "
          >
            <div className="font-medium">
              {r.pillar_name}{" "}
              <span className="text-slate-500 dark:text-slate-400">
                ({r.pillar_key})
              </span>
            </div>

            {/* Score (read-only) */}
            <label className="block text-xs text-slate-500 dark:text-slate-400">
              Score
            </label>
            <input
              className="
                w-full rounded-md border px-2 py-1
                bg-gray-50 text-slate-700 border-slate-200
                dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600
              "
              value={r.score_pct ?? ""}
              readOnly
              disabled={r.saving}
            />

            {/* Pillar Weight as percent (0–100) */}
            <label className="block mt-2 text-xs text-slate-500 dark:text-slate-400">
              Pillar Weight (%)
            </label>
            <input
              className="
                w-full rounded-md border px-2 py-1
                bg-white text-slate-900 border-slate-200
                dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600
              "
              type="number"
              step={1}
              min={0}
              max={100}
              value={r.weight_pct}
              onChange={(e) => onWeightPctChange(r.uid, e.target.value)}
              disabled={r.saving}
            />

            {/* Per-pillar Save */}
            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                onClick={() => saveOne(r.uid)}
                disabled={r.saving}
                className="
                  rounded-xl px-3 py-1.5 text-sm font-medium
                  bg-indigo-600 text-white hover:bg-indigo-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80
                  focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50
                  dark:focus-visible:ring-offset-slate-900
                "
                title="Save this pillar"
                type="button"
              >
                {r.saving ? "Saving..." : "Save"}
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Stored value:{" "}
                {Number.isFinite(r.weight) ? r.weight.toFixed(2) : "—"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Optional Save All */}
      <div className="pt-2 flex gap-2">
        <button
          onClick={saveAll}
          disabled={!canSaveAll || pendingAll}
          className="
            rounded-xl px-4 py-2 text-sm font-medium
            bg-emerald-600 text-white hover:bg-emerald-500
            disabled:opacity-50 disabled:cursor-not-allowed
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80
            focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50
            dark:focus-visible:ring-offset-slate-900
          "
          type="button"
        >
          {pendingAll ? "Saving…" : "Save Pillars"}
        </button>
      </div>
    </div>
  );
}
