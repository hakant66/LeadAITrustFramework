// apps/web/src/app/scorecard/[projectId]/kpis/[kpiKey]/page.tsx
import Link from "next/link";
import Header from "@/app/(components)/Header";

export const revalidate = 15;

type KpiDetail = {
  // from control_values
  project_slug: string;
  kpi_key: string;
  raw_value: number | null;
  normalized_value: number | null;
  target_text: string | null;
  target_numeric: number | null;
  evidence_source: string | null;
  owner_role: string | null;
  observed_at: string | null;
  updated_at: string | null;

  // from kpi_definition
  kpi_name: string;
  unit: string | null;
  min_ideal: number | null;
  max_ideal: number | null;
  invert: boolean | null;
  description: string | null;
  definition: string | null;
  example: string | null;
  iso_42001_clause: string | null;
  eu_ai_act_clause: string | null;

  // from evidence
  evidence_name: string | null;
  evidence_created_by: string | null;
  evidence_updated_at: string | null;
};

async function fetchJsonOk<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export default async function KpiDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; kpiKey: string }>;
}) {
  const { projectId, kpiKey } = await params;

  const base =
    process.env.NEXT_PUBLIC_CORE_SVC_URL ??
    process.env.CORE_SVC_URL ??
    "http://localhost:8001";

  const data = await fetchJsonOk<KpiDetail>(
    `${base}/scorecard/${encodeURIComponent(
      projectId,
    )}/kpis/${encodeURIComponent(kpiKey)}`,
    { cache: "no-store" },
  );

  const kpiScore =
    typeof data.normalized_value === "number"
      ? Math.round(data.normalized_value)
      : null;

  const kpiScoreChipCls =
    typeof kpiScore === "number"
      ? kpiScore >= 75
        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/60"
        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/60"
      : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700";

  const rawDisplay =
    typeof data.raw_value === "number"
      ? data.unit === "%"
        ? `${data.raw_value}%`
        : `${data.raw_value}${data.unit ? ` ${data.unit}` : ""}`
      : "—";

  const targetNumericDisplay =
    typeof data.target_numeric === "number"
      ? data.unit === "%"
        ? `${data.target_numeric}%`
        : `${data.target_numeric}${data.unit ? ` ${data.unit}` : ""}`
      : "—";

  const idealRangeDisplay =
    typeof data.min_ideal === "number" && typeof data.max_ideal === "number"
      ? `${data.min_ideal} – ${data.max_ideal}${data.unit ? ` ${data.unit}` : ""}`
      : "—";

  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <Header
          title={data.kpi_name}
          subtitle={`KPI: ${data.kpi_key.toUpperCase()} · PROJECT: ${projectId.toUpperCase()}`}
        >
          <Link
            href={`/scorecard/${encodeURIComponent(projectId)}/pillars/CRA`}
            className="
              inline-flex items-center justify-center h-9 px-3 rounded-xl border
              border-gray-200 bg-white/60 text-indigo-700 hover:bg-white
              dark:border-slate-600 dark:bg-slate-900/60 dark:text-indigo-200 dark:hover:bg-slate-900
            "
          >
            Back to scorecard
          </Link>
        </Header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
          {/* Current Values */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Current Values
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  KPI Score
                </span>
                <span>
                  {kpiScore !== null ? (
                    <span
                      className={`
                        inline-flex items-center px-2 py-0.5 rounded-full border text-xs
                        ${kpiScoreChipCls}
                      `}
                    >
                      {kpiScore}%
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Raw value
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {rawDisplay}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Target (numeric)
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {targetNumericDisplay}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Target (text)
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {data.target_text || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Ideal range
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {idealRangeDisplay}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Unit</span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {data.unit || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Ownership & Governance */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Ownership &amp; Governance
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Owner role
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {data.owner_role || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Evidence source (type)
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {data.evidence_source || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Observed at
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {data.observed_at
                    ? new Date(data.observed_at).toLocaleString("en-GB")
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Last updated
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {data.updated_at
                    ? new Date(data.updated_at).toLocaleString("en-GB")
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Invert / lower is better
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {data.invert ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>

          {/* Evidence Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Evidence Details
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Evidence name
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {data.evidence_name || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Created by
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {data.evidence_created_by || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">
                  Evidence updated at
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {data.evidence_updated_at
                    ? new Date(data.evidence_updated_at).toLocaleString("en-GB")
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lower description cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Description
            </div>
            <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
              {data.description || "—"}
            </p>
			{/* Creates a distinct empty space */}
			<div className="h-4" /> 
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              iso_42001_clause
            </div>
            <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
              {data.iso_42001_clause || "—"}
            </p>
			{/* Creates a distinct empty space */}
			<div className="h-4" /> 
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              eu_ai_act_clause
            </div>
            <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
              {data.eu_ai_act_clause || "—"}
            </p>			
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Definition
            </div>
            <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
              {data.definition || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Example
            </div>
            <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
              {data.example || "—"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
