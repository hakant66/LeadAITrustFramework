import Header from "@/app/(components)/Header";
import PillarsWeightsCard from "@/app/scorecard/[projectId]/dashboard/pillars_admin/PillarsWeightsCard";
import { cookies } from "next/headers";

const apiBase =
  process.env.NEXT_PUBLIC_CORE_SVC_URL ??
  process.env.CORE_SVC_URL ??
  "http://localhost:8001";
const appBase =
  process.env.INTERNAL_APP_URL ??
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";

type ScorecardResponse = {
  kpis: unknown[];
  project?: { slug?: string; name?: string };
  project_slug?: string;
  project_name?: string;
};

type EntityBySlugResponse = {
  id: string;
  fullLegalName?: string | null;
  name?: string | null;
};

type ProjectRow = {
  slug: string;
};

type PillarRow = {
  pillar_id?: string | null;
  id?: string | null;
  key: string;
  name: string;
  score_pct?: number | null;
  weight?: number | null;
  pillar_weight?: number | null;
  pillar_weight_pct?: number | null;
  maturity?: number | null;
  updated_at?: string | null;
};

export default async function EntityLevelPillarsAdminPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const cookieStore = await cookies();
  const headers = {
    cache: "no-store" as const,
    headers: { Cookie: cookieStore.toString() },
  };

  const entityRes = await fetch(
    `${appBase.replace(/\/+$/, "")}/api/core/entity/by-slug/${encodeURIComponent(entitySlug)}`,
    headers
  );
  if (!entityRes.ok) {
    throw new Error(`Failed to load entity ${entitySlug}: ${entityRes.status}`);
  }
  const entity = (await entityRes.json()) as EntityBySlugResponse;
  const entityLabel =
    entity.fullLegalName?.trim() ||
    entity.name?.trim() ||
    entitySlug;

  const projectsRes = await fetch(
    `${appBase.replace(/\/+$/, "")}/api/core/projects?entity_id=${encodeURIComponent(entity.id)}`,
    headers
  );
  if (!projectsRes.ok) {
    throw new Error(`Failed to load projects for entity ${entitySlug}: ${projectsRes.status}`);
  }
  const projects = (await projectsRes.json()) as ProjectRow[];
  const projectSlugs = Array.from(
    new Set(
      (Array.isArray(projects) ? projects : [])
        .map((p) => p?.slug)
        .filter((p): p is string => Boolean(p))
    )
  );
  if (!projectSlugs.length) {
    throw new Error(`No projects found for entity ${entitySlug}`);
  }
  const sourceProjectSlug = projectSlugs[0];

  const scorecardRes = await fetch(
    `${apiBase}/scorecard/${encodeURIComponent(sourceProjectSlug)}`,
    { cache: "no-store" }
  );
  if (!scorecardRes.ok) {
    throw new Error(`Failed to load scorecard for ${sourceProjectSlug}: ${scorecardRes.status}`);
  }
  const scorecardData = (await scorecardRes.json()) as ScorecardResponse;
  const sourceProjectLabel =
    scorecardData.project?.name || scorecardData.project_name || sourceProjectSlug;

  const pillarsRes = await fetch(
    `${apiBase}/scorecard/${encodeURIComponent(sourceProjectSlug)}/pillars`,
    { cache: "no-store" }
  );
  if (!pillarsRes.ok) {
    throw new Error(`Failed to load pillars for ${sourceProjectSlug}: ${pillarsRes.status}`);
  }
  const pillarsJson = (await pillarsRes.json()) as PillarRow[];

  const toFraction = (p: PillarRow): number => {
    if (typeof p.weight === "number") return p.weight;
    if (typeof p.pillar_weight === "number") return p.pillar_weight;
    if (typeof p.pillar_weight_pct === "number") return p.pillar_weight_pct / 100;
    return 0;
  };

  const rowsForEditor = pillarsJson.map((p) => ({
    id: p.pillar_id ?? p.id ?? null,
    pillar_key: p.key,
    pillar_name: p.name,
    score_pct: typeof p.score_pct === "number" ? Math.round(p.score_pct) : null,
    weight: toFraction(p),
  }));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Header title="Pillars Admin" subtitle={`Entity: ${entityLabel}`}>
        <div />
      </Header>

      <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
        <PillarsWeightsCard initialRows={rowsForEditor} projects={projectSlugs} />
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Source project for displayed scores: {sourceProjectLabel}. Saving weights applies across all entity projects.
      </p>
    </div>
  );
}
