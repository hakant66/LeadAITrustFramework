// apps/web/src/app/scorecard/[projectId]/dashboard/pillars_admin/page.tsx
import Header from "@/app/(components)/Header";
import { PillarOverridesIO } from "@/app/(components)/AdminDataIO";
import PillarsWeightsCard from "./PillarsWeightsCard";

const apiBase =
  process.env.NEXT_PUBLIC_CORE_SVC_URL ??
  process.env.CORE_SVC_URL ??
  "http://localhost:8001";

type ScorecardResponse = {
  kpis: any[];
  project?: { slug?: string; name?: string };
  project_slug?: string;
  project_name?: string;
};

// Be flexible with backend field names (older/newer cores)
type PillarRow = {
  pillar_id?: string | null;         // override id if present
  id?: string | null;                // alternative name
  key: string;                       // pillar_key
  name: string;                      // pillar_name
  score_pct?: number | null;

  // weight variants the backend might return
  weight?: number | null;            // fraction 0..1
  pillar_weight?: number | null;     // fraction 0..1
  pillar_weight_pct?: number | null; // percent 0..100

  maturity?: number | null;
  updated_at?: string | null;
};

export default async function PillarsAdminPage({
  params,
}: {
  // Next 15: params is async
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: slug } = await params;

  // Project label
  const res = await fetch(`${apiBase}/scorecard/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load scorecard for ${slug}: ${res.status}`);
  }
  const data = (await res.json()) as ScorecardResponse;
  const projectLabel = data.project?.name || data.project_name || slug;

  // ✅ Use the existing core endpoint that returns pillars (with weight fields)
  const pillarsRes = await fetch(
    `${apiBase}/scorecard/${encodeURIComponent(slug)}/pillars`,
    { cache: "no-store" }
  );
  if (!pillarsRes.ok) {
    throw new Error(
      `Failed to load pillars for ${slug}: ${pillarsRes.status}`
    );
  }
  const pillarsJson = (await pillarsRes.json()) as PillarRow[];

  // Normalize to a fraction (0..1) regardless of backend field names
  const toFraction = (p: PillarRow): number => {
    if (typeof p.weight === "number") return p.weight;
    if (typeof p.pillar_weight === "number") return p.pillar_weight;
    if (typeof p.pillar_weight_pct === "number") return p.pillar_weight_pct / 100;
    return 0;
  };

  // Shape for the weights editor
  const rowsForEditor = pillarsJson.map((p) => ({
    id: p.pillar_id ?? p.id ?? null, // stable id if present (may be null)
    pillar_key: p.key,
    pillar_name: p.name,
    score_pct:
      typeof p.score_pct === "number" ? Math.round(p.score_pct) : null,
    weight: toFraction(p), // fraction 0..1 for editor's internal state
  }));

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
        <Header title="Pillars Admin" subtitle={`Project: ${projectLabel}`}>
          <div className="flex items-center gap-2">
            <a
              href={`/scorecard/${encodeURIComponent(slug)}/dashboard`}
              className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Back to Dashboard
            </a>
            <a
              href={`/scorecard/${encodeURIComponent(slug)}/dashboard/kpis_admin`}
              className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              KPIs Admin
            </a>
          </div>
        </Header>

        {/* Update Pillar Weights */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
          <PillarsWeightsCard initialRows={rowsForEditor} project={slug} />
        </div>

        {/* Pillar Overrides (.xlsx) */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <PillarOverridesIO slug={slug} />
        </div>
      </div>
    </main>
  );
}
