// /src/app/(components)/KpiTable.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Row = {
  pillar: string;
  kpi_id: string;
  key: string; // kpi_key
  name: string;

  // legacy / fallback (kept for display)
  unit?: string;
  raw_value?: number | string | null;
  normalized?: number | null;
  updated_at?: string | null;

  // optional columns that may arrive from upstream
  owner_role?: string | null;
  target_text?: string | null;
  target_numeric?: number | null;
  current_value?: number | string | null;
  kpi_score?: number | null;
  evidence_source?: string | null;
  as_of?: string | null;
  notes?: string | null;
};

type ControlValue = {
  // from GET /scorecard/{slug}/controls
  kpi_key?: string | null;
  unit?: string | null;
  raw_value?: number | null;
  normalized_pct?: number | null;
  updated_at?: string | null;

  // extra metadata
  owner_role?: string | null;
  target_numeric?: number | null;
  kpi_score?: number | null;
  evidence_source?: string | null;

  // optional fallbacks if present in scorecard()
  observed_at?: string | null;
  target_text?: string | null;
};

async function fetchJsonOk(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/* ---------------- KPI description helper (lazy, cached) ---------------- */
type KpiMeta = {
  key?: string;
  kpi_key?: string;
  name?: string;
  description?: string | null;
};
const kpiDescCache: Record<string, string | null | undefined> = {};

async function fetchKpiDescriptions(
  keys: string[]
): Promise<Record<string, string | null>> {
  const uniq = Array.from(new Set(keys.filter(Boolean)));
  const toGet = uniq.filter((k) => !(k in kpiDescCache));
  if (toGet.length) {
    // Same-origin proxy route at /api/kpis?keys=...
    const res = await fetch(
      `/api/kpis?keys=${encodeURIComponent(toGet.join(","))}`,
      {
        cache: "no-store",
      }
    );
    const arr: KpiMeta[] = res.ok ? await res.json() : [];
    for (const m of arr) {
      const k = (m.key || m.kpi_key || "").toString();
      if (!k) continue;
      kpiDescCache[k] = m.description ?? null;
    }
    // mark misses so we don't refetch needlessly
    toGet.forEach((k) => {
      if (!(k in kpiDescCache)) kpiDescCache[k] = null;
    });
  }
  const out: Record<string, string | null> = {};
  uniq.forEach((k) => (out[k] = kpiDescCache[k] ?? null));
  return out;
}
/* ---------------- end KPI description helper ---------------- */

/* -------- fetchControlValues (only supported endpoints) -------- */
async function fetchControlValues(
  slug: string,
  apiBase: string
): Promise<ControlValue[]> {
  const base = apiBase.replace(/\/+$/, "");

  // 1) Preferred endpoint
  try {
    const raw = await fetchJsonOk(
      `${base}/scorecard/${encodeURIComponent(slug)}/controls`,
      { cache: "no-store" }
    );
    const list: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.rows)
      ? raw.rows
      : [];

    return list.map((cv) => ({
      kpi_key: (cv.kpi_key ?? cv.key ?? null) as string | null,
      unit: cv.unit ?? null,
      raw_value: typeof cv.raw_value === "number" ? cv.raw_value : null,
      normalized_pct:
        typeof cv.normalized_pct === "number" ? cv.normalized_pct : null,
      updated_at: cv.updated_at ?? null,
      owner_role: (cv.owner ?? cv.owner_role ?? null) as string | null,
      target_numeric:
        typeof cv.target_numeric === "number" ? cv.target_numeric : null,
      kpi_score:
        typeof cv.kpi_score === "number" ? cv.kpi_score : null,
      evidence_source: cv.evidence_source ?? null,
    }));
  } catch {
    // fall through to (2)
  }

  // 2) Fallback: embedded values in scorecard payload (if you ever add them)
  try {
    const sc = await fetchJsonOk(
      `${base}/scorecard/${encodeURIComponent(slug)}`,
      { cache: "no-store" }
    );
    const embedded: any[] = Array.isArray(sc?.control_values)
      ? sc.control_values
      : Array.isArray(sc?.controls)
      ? sc.controls
      : Array.isArray(sc?.values)
      ? sc.values
      : [];
    return embedded.map((cv) => ({
      kpi_key: (cv.kpi_key ?? cv.key ?? null) as string | null,
      unit: cv.unit ?? null,
      raw_value: typeof cv.raw_value === "number" ? cv.raw_value : null,
      normalized_pct:
        typeof cv.normalized_pct === "number" ? cv.normalized_pct : null,
      updated_at: cv.updated_at ?? null,
      owner_role: (cv.owner ?? cv.owner_role ?? null) as string | null,
      target_numeric:
        typeof cv.target_numeric === "number" ? cv.target_numeric : null,
      kpi_score:
        typeof cv.kpi_score === "number" ? cv.kpi_score : null,
      evidence_source: cv.evidence_source ?? null,
      observed_at: cv.observed_at ?? null,
      target_text: cv.target_text ?? null,
    }));
  } catch {
    /* ignore */
  }

  return [];
}
/* -------- fetchControlValues end -------- */

/* -------- Small child component for Name + Key + Tooltip -------- */
function KpiNameCell({
  row,
  initialDesc,
}: {
  row: Row;
  initialDesc?: string | null;
}) {
  const [desc, setDesc] = useState<string | null | undefined>(initialDesc);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDesc(initialDesc);
  }, [initialDesc]);

  const primeDescription = () => {
    if (desc !== undefined) return; // already decided
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(async () => {
      const map = await fetchKpiDescriptions([row.key]);
      setDesc(map[row.key] ?? null);
    }, 120);
  };

  const cancelPrime = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  return (
    <div
      className="relative group inline-block"
      onMouseEnter={primeDescription}
      onMouseLeave={cancelPrime}
      title={desc || undefined}
    >
      <div className="font-medium text-slate-900 dark:text-slate-50">
        {row.name || "—"}
      </div>
      <div className="text-[11px] text-gray-500 dark:text-slate-400 font-mono">
        {row.key}
      </div>

      {desc ? (
        <div
          className="pointer-events-none absolute z-20 hidden w-80 group-hover:block left-0 top-full mt-2
                     rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-3 text-xs text-slate-700 dark:text-slate-100 shadow-lg"
          role="tooltip"
        >
          {desc}
        </div>
      ) : null}
    </div>
  );
}
/* -------- end child component -------- */

export default function KpiTable({
  rows,
  limit = 60,
  slug,
  apiBase,
}: {
  rows: Row[];
  limit?: number;
  slug?: string;
  apiBase?: string;
}) {
  const [cvs, setCvs] = useState<ControlValue[] | null>(null);
  const [descMap, setDescMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    (async () => {
      if (!slug || !apiBase) return;
      try {
        const vals = await fetchControlValues(slug, apiBase);
        setCvs(vals);
      } catch {
        setCvs(null);
      }
    })();
  }, [slug, apiBase]);

  // Prefetch descriptions for the currently shown keys
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          (a.pillar || "").localeCompare(b.pillar || "") ||
          (a.name || "").localeCompare(b.name || "")
      ),
    [rows]
  );
  const shown = useMemo(() => sorted.slice(0, limit), [sorted, limit]);

  useEffect(() => {
    (async () => {
      const keys = Array.from(new Set(shown.map((r) => r.key)));
      if (!keys.length) return;
      const fetched = await fetchKpiDescriptions(keys);
      setDescMap((m) => ({ ...m, ...fetched }));
    })();
  }, [shown]);

  const cvIndex = useMemo(() => {
    const idx = new Map<string, ControlValue>();
    (cvs ?? []).forEach((cv) => {
      const k1 = (cv.kpi_key ?? "").toString().trim().toLowerCase();
      if (k1) idx.set(k1, cv);
    });
    return idx;
  }, [cvs]);

  const formatDate = (s?: string | null) => {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime())
      ? "—"
      : d.toLocaleDateString("en-GB"); // DD/MM/YYYY
  };

  const pickTarget = (r: Row, cv?: ControlValue) =>
    r.target_text && r.target_text !== ""
      ? r.target_text
      : typeof r.target_numeric === "number"
      ? r.target_numeric
      : typeof cv?.target_numeric === "number"
      ? cv.target_numeric
      : "—";

  const pickCurrent = (r: Row, cv?: ControlValue) =>
    r.current_value ??
    r.raw_value ??
    (typeof r.normalized === "number" ? r.normalized : undefined) ??
    cv?.raw_value ??
    (typeof cv?.normalized_pct === "number"
      ? cv.normalized_pct
      : "—");

  const pickEvidence = (r: Row, cv?: ControlValue) => {
    const val =
      (r.evidence_source && String(r.evidence_source).trim()) ||
      (cv?.evidence_source && String(cv.evidence_source).trim()) ||
      "";
    return val === "" ? "—" : val;
  };

  const pickAsOf = (r: Row, cv?: ControlValue) =>
    formatDate(
      r.as_of ?? r.updated_at ?? cv?.updated_at ?? cv?.observed_at ?? null
    );

  const renderKpiScore = (r: Row, cv?: ControlValue) => {
    const val =
      typeof r.kpi_score === "number"
        ? r.kpi_score
        : typeof cv?.kpi_score === "number"
        ? cv.kpi_score
        : null;
    if (typeof val !== "number") return "—";
    const pct = Math.round(val);
    const ok = pct >= 75;
    const cls = ok
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-500/60"
      : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-500/60";
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${cls}`}
      >
        {pct}%
      </span>
    );
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-slate-900/60 text-left">
          <tr>
            <th className="p-2 text-gray-700 dark:text-slate-300">Pillar</th>
            <th className="p-2 text-gray-700 dark:text-slate-300">KPI</th>
            <th className="p-2 text-gray-700 dark:text-slate-300">Target</th>
            <th className="p-2 text-gray-700 dark:text-slate-300">
              Current Value
            </th>
            <th className="p-2 text-gray-700 dark:text-slate-300">
              KPI Score
            </th>
            <th className="p-2 text-gray-700 dark:text-slate-300">Evidence</th>
            <th className="p-2 text-gray-700 dark:text-slate-300">Owner</th>
            <th className="p-2 text-gray-700 dark:text-slate-300">Date</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const kKey = (r.key ?? "").toString().trim().toLowerCase();
            const cv = cvIndex.get(kKey);

            return (
              <tr
                key={r.kpi_id}
                className="border-t border-slate-200 dark:border-slate-700"
              >
                <td className="p-2 align-top">{r.pillar || "—"}</td>
                <td className="p-2 align-top">
                  <KpiNameCell row={r} initialDesc={descMap[r.key]} />
                </td>
                <td className="p-2 align-top">{pickTarget(r, cv)}</td>
                <td className="p-2 align-top">{pickCurrent(r, cv)}</td>
                <td className="p-2 align-top">{renderKpiScore(r, cv)}</td>
                <td className="p-2 align-top">{pickEvidence(r, cv)}</td>
                <td className="p-2 align-top">
                  {r.owner_role ?? cv?.owner_role ?? "—"}
                </td>
                <td className="p-2 align-top">{pickAsOf(r, cv)}</td>
              </tr>
            );
          })}
          {shown.length === 0 && (
            <tr>
              <td
                className="p-3 text-gray-500 dark:text-slate-400"
                colSpan={8}
              >
                No KPIs to display.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="p-2 text-[11px] text-gray-500 dark:text-slate-400">
        Showing first {Math.min(limit, rows.length)} of {rows.length}.
      </div>
    </div>
  );
}
