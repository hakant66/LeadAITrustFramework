// apps/web/src/app/(components)/ControlValuesTable.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Kpi = {
  pillar?: string | null;
  key: string;
  name: string;
  unit?: string | null;
  raw_value?: number | string | null;
  normalized_pct?: number | null;
  updated_at?: string | null;

  // sometimes present in scorecard payload:
  target_text?: string | null;
  target_numeric?: number | null;
  current_value?: number | string | null;
  evidence_source?: string | null;
  as_of?: string | null;
};

type Scorecard = {
  project: { slug: string; name: string };
  overall_pct: number;
  kpis: Kpi[];
};

type ControlApiItem = {
  // from GET /scorecard/{slug}/controls
  kpi_key: string;
  control_name?: string | null;
  owner_role?: string | null;
  target_text?: string | null;
  target_numeric?: number | null;
  raw_value?: number | string | null;
  normalized_pct?: number | null;
  updated_at?: string | null;
  observed_at?: string | null;
  evidence_source?: string | null;
};

function formatDateDDMMYYYY(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY
}

async function fetchJsonOk<T = any>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${txt || res.statusText}`);
  }
  return res.json();
}

/** Fetch *only* the supported controls endpoint; no legacy fallbacks. */
async function fetchControls(
  slug: string,
  apiBase: string,
): Promise<ControlApiItem[]> {
  const base = apiBase.replace(/\/+$/, "");
  const res = await fetch(
    `${base}/scorecard/${encodeURIComponent(slug)}/controls`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];

  const payload = await res.json();
  const list: any[] = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.rows)
    ? payload.rows
    : [];

  // Normalize to the fields we need
  return list.map((it) => ({
    kpi_key: String(it.kpi_key ?? it.key ?? ""),
    control_name: it.control_name ?? it.name ?? null,
    owner_role: it.owner_role ?? null,
    target_text: it.target_text ?? null,
    target_numeric:
      typeof it.target_numeric === "number" ? it.target_numeric : null,
    raw_value:
      typeof it.raw_value === "number" || typeof it.raw_value === "string"
        ? it.raw_value
        : null,
    normalized_pct:
      typeof it.normalized_pct === "number" ? it.normalized_pct : null,
    updated_at: it.updated_at ?? null,
    observed_at: it.observed_at ?? null,
    evidence_source: it.evidence_source ?? null,
  })) as ControlApiItem[];
}

export default function ControlValuesTable({
  slug,
  apiBase,
}: {
  slug: string;
  apiBase: string;
}) {
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [controls, setControls] = useState<ControlApiItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      // 1) KPI metadata
      const sc = await fetchJsonOk<Scorecard>(
        `${apiBase.replace(/\/+$/, "")}/scorecard/${encodeURIComponent(slug)}`,
        { cache: "no-store" },
      );
      setScorecard(sc);

      // 2) Control values (single supported endpoint)
      const cvs = await fetchControls(slug, apiBase);
      setControls(cvs);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setControls(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  // Build index by kpi_key (lowercased)
  const cvIndex = useMemo(() => {
    const idx = new Map<string, ControlApiItem>();
    (controls ?? []).forEach((cv) => {
      const k = (cv.kpi_key ?? "").toString().trim().toLowerCase();
      if (k) idx.set(k, cv);
    });
    return idx;
  }, [controls]);

  const rows = useMemo(() => {
    const kpis = scorecard?.kpis ?? [];
    return kpis.map((k) => {
      const kKey = (k.key ?? "").toString().trim().toLowerCase();
      const cv = cvIndex.get(kKey);

      // Target precedence: text → numeric → empty
      const target =
        (k.target_text && k.target_text.trim() !== "")
          ? k.target_text
          : (cv?.target_text && cv.target_text.trim() !== "")
          ? cv.target_text
          : typeof k.target_numeric === "number"
          ? k.target_numeric
          : typeof cv?.target_numeric === "number"
          ? cv.target_numeric
          : null;

      // Current value precedence: current_value → raw_value → normalized_pct → empty
      const currentValue =
        (k.current_value ?? null) ??
        (cv?.raw_value ?? null) ??
        (typeof k.raw_value !== "undefined" ? k.raw_value : null) ??
        (typeof cv?.normalized_pct === "number" ? cv.normalized_pct : null) ??
        (typeof k.normalized_pct === "number" ? k.normalized_pct : null);

      // Evidence
      const evidence =
        (k.evidence_source && String(k.evidence_source).trim()) ||
        (cv?.evidence_source && String(cv.evidence_source).trim()) ||
        "";

      // As-of precedence (prefer cv.updated_at/observed_at)
      const asOf =
        k.as_of ??
        k.updated_at ??
        cv?.updated_at ??
        cv?.observed_at ??
        null;

      return {
        pillar: k.pillar ?? "",
        kpiName: k.name,
        kpiKey: k.key,
        target,
        currentValue,
        evidence: evidence === "" ? null : evidence,
        asOf,
      };
    });
  }, [scorecard, cvIndex]);

  return (
    <section className="border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 shadow-sm p-4 text-slate-900 dark:text-slate-50">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">KPIs</h2>
        <button
          className="text-sm rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600 dark:text-slate-300 mt-3">
          Loading...
        </div>
      ) : err ? (
        <div className="text-sm text-red-600 dark:text-red-400 mt-3">
          {err}
        </div>
      ) : !rows.length ? (
        <div className="text-sm text-gray-600 dark:text-slate-300 mt-3">
          No KPIs yet.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-900/60">
              <tr>
                <th className="text-left p-2 text-gray-600 dark:text-slate-300">
                  Pillar
                </th>
                <th className="text-left p-2 text-gray-600 dark:text-slate-300">
                  KPI
                </th>
                <th className="text-left p-2 text-gray-600 dark:text-slate-300">
                  Target
                </th>
                <th className="text-left p-2 text-gray-600 dark:text-slate-300">
                  Current Value
                </th>
                <th className="text-left p-2 text-gray-600 dark:text-slate-300">
                  Evidence
                </th>
                <th className="text-left p-2 text-gray-600 dark:text-slate-300">
                  As of
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.kpiKey}
                  className="border-b border-slate-200 dark:border-slate-700"
                >
                  <td className="p-2 align-top">{r.pillar}</td>
                  <td className="p-2 align-top">
                    <div className="font-medium">{r.kpiName}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 font-mono">
                      {r.kpiKey}
                    </div>
                  </td>
                  <td className="p-2 align-top">{r.target ?? ""}</td>
                  <td className="p-2 align-top">{r.currentValue ?? ""}</td>
                  <td className="p-2 align-top">{r.evidence ?? ""}</td>
                  <td className="p-2 align-top">
                    {formatDateDDMMYYYY(r.asOf)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
