// apps/web/src/app/scorecard/[projectId]/pillars/[pillarKey]/page.tsx
import Link from "next/link";
import Header from "@/app/(components)/Header";
import { fetchControlMetaMap } from "@/lib/scorecard";

export const revalidate = 15;

type ScorecardResp = {
  project: { slug: string; name: string; target_threshold?: number };
  kpis: {
    pillar?: string | null;
    key: string;               // kpi_key
    name: string;
    unit?: string | null;
    raw_value?: number | null;
    normalized_pct?: number | null;
    kpi_score?: number | null;
    updated_at?: string | null;
  }[];
};

type PillarRow = {
  key: string;                 // canonical key (e.g., GOV, CRA)
  name: string;                // display name
  score_pct: number | null;
  maturity: number | null;
};

type ControlMeta = {
  kpi_key?: string;
  key?: string;
  kpi_score?: number | null;
  owner_role?: string | null;
  evidence_source?: string | null;
  target_numeric?: number | null;
  unit?: string | null;
  raw_value?: number | null;
  normalized_pct?: number | null;
  updated_at?: string | null;
};

async function fetchJsonOk<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export default async function PillarDetailsPage({
  params,
}: {
  params: Promise<{ projectId: string; pillarKey: string }>;
}) {
  const { projectId, pillarKey } = await params;

  const base =
    process.env.NEXT_PUBLIC_CORE_SVC_URL ??
    process.env.CORE_SVC_URL ??
    "http://localhost:8001";

  // Load scorecard
  const sc = await fetchJsonOk<ScorecardResp>(
    `${base}/scorecard/${encodeURIComponent(projectId)}`,
    { cache: "no-store" },
  );

  // Load pillars to resolve display name / score / maturity
  const pillars = await fetchJsonOk<PillarRow[]>(
    `${base}/scorecard/${encodeURIComponent(projectId)}/pillars`,
    { cache: "no-store" },
  );

  const wanted = decodeURIComponent(pillarKey).toLowerCase();
  const pillarRow =
    pillars.find((p) => p.key.toLowerCase() === wanted) ??
    pillars.find((p) => p.name.toLowerCase() === wanted) ??
    null;

  const displayName = pillarRow?.name ?? pillarKey;
  const scorePct =
    typeof pillarRow?.score_pct === "number" ? Math.round(pillarRow!.score_pct) : null;
  const maturity = pillarRow?.maturity ?? null;

  const metaMap = await fetchControlMetaMap(base, projectId);

  // Filter KPIs by pillar display name
  const kpis = (sc.kpis || []).filter(
    (k) => (k.pillar || "").toLowerCase() === displayName.toLowerCase(),
  );

  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <Header title={displayName} subtitle={`Project: ${sc.project.name}`}>
          <div className="flex items-center gap-2">
            <Link
              href={`/scorecard/${encodeURIComponent(sc.project.slug)}/dashboard`}
              className="
                inline-flex items-center justify-center h-9 px-3 rounded-xl border
                border-gray-200 bg-white/60 text-indigo-700 hover:bg-white
                dark:border-slate-600 dark:bg-slate-900/60 dark:text-indigo-200 dark:hover:bg-slate-900
              "
            >
              Back to Dashboard
            </Link>
            <ScoreChip value={scorePct} />
            <MaturityChip value={maturity} />
          </div>
        </Header>

        <div
          className="
            border rounded-2xl bg-white shadow-sm
            border-slate-200
            dark:bg-slate-900 dark:border-slate-700
          "
        >
          <div
            className="
              px-4 py-3 text-sm font-semibold
              text-slate-800 border-b border-slate-200
              dark:text-slate-100 dark:border-slate-700 dark:bg-slate-900/70
            "
          >
            KPIs in “{displayName}”
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 dark:bg-slate-800/60">
                <tr className="text-left text-slate-600 dark:text-slate-200">
                  <th className="px-4 py-2">KPI</th>
                  <th className="px-4 py-2">Owner</th>
                  <th className="px-4 py-2">Evidence</th>
                  <th className="px-4 py-2">Target</th>
                  <th className="px-4 py-2">Raw</th>
                  <th className="px-4 py-2">KPI Score</th>
                  <th className="px-4 py-2">Normalized</th>
                  <th className="px-4 py-2">As of</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {kpis.length ? (
                  kpis.map((k) => {
                    const m: ControlMeta = metaMap[k.key] ?? {};
                    const rawNum = k.raw_value;
                    const unit = k.unit ?? m.unit ?? "";
                    const rawDisplay =
                      typeof rawNum === "number"
                        ? `${rawNum}${unit ? ` ${unit}` : ""}`
                        : "—";

                    const target =
                      typeof m.target_numeric === "number"
                        ? `${m.target_numeric}${unit ? ` ${unit}` : ""}`
                        : "—";

                    const kpiScore =
                      typeof k.kpi_score === "number"
                        ? k.kpi_score
                        : typeof m.kpi_score === "number"
                        ? m.kpi_score
                        : null;

                    const kpiScoreDisplay =
                      typeof kpiScore === "number" ? `${Math.round(kpiScore)}%` : "—";

                    const chipCls =
                      typeof k.normalized_pct === "number"
                        ? k.normalized_pct >= 75
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/60"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/60"
                        : "bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700";

                    return (
                      <tr
                        key={k.key}
                        className="hover:bg-gray-50/60 dark:hover:bg-slate-800/60"
                      >
                        <td className="px-4 py-2">
                          <div className="font-medium text-slate-900 dark:text-slate-50">
                            {k.name}
                          </div>
                          <div className="text-xs text-slate-500 font-mono dark:text-slate-400">
                            {k.key}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                          {m.owner_role ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                          {m.evidence_source ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                          {target}
                        </td>
                        <td className="px-4 py-2 text-slate-800 dark:text-slate-100">
                          {rawDisplay}
                        </td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-200">
                          {kpiScoreDisplay}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`
                              inline-flex items-center px-2 py-0.5 rounded-full border text-xs
                              ${chipCls}
                            `}
                          >
                            {typeof k.normalized_pct === "number"
                              ? `${Math.round(k.normalized_pct)}%`
                              : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                          {k.updated_at
                            ? new Date(k.updated_at).toLocaleDateString("en-GB")
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      className="px-4 py-6 text-slate-500 dark:text-slate-400"
                      colSpan={8}
                    >
                      No KPIs for this pillar yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

/* --- Chips that match your dashboard look --- */

function ScoreChip({ value }: { value: number | null }) {
  const ok = typeof value === "number" ? value >= 75 : false;
  const cls = ok
    ? "bg-green-50 text-green-700 border-green-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/60"
    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/60";

  return (
    <span
      className={`
        inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm border
        ${cls}
      `}
    >
      <span>Score</span>
      <span className="font-medium">{value != null ? `${value}%` : "—"}</span>
    </span>
  );
}

function MaturityChip({ value }: { value: number | null }) {
  return (
    <span
      className="
        inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm border
        bg-white text-slate-700 border-slate-200
        dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600
      "
    >
      <span>Maturity</span>
      <span className="font-medium">{value ?? "—"}</span>
    </span>
  );
}
