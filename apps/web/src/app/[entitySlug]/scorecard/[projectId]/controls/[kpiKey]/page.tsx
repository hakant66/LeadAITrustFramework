// apps/web/src/app/[entitySlug]/scorecard/[projectId]/controls/[kpiKey]/page.tsx
import { cookies } from "next/headers";
import Header from "@/app/(components)/Header";
import EditKpis from "@/app/(components)/EditKpis";
import ControlEvidenceMeta from "@/app/(components)/ControlEvidenceMeta";
import ArchivedProjectNotice from "@/app/(components)/ArchivedProjectNotice";
import HistoryBackButton from "@/app/(components)/HistoryBackButton";
import CloseWindowButton from "@/app/(components)/CloseWindowButton";

export const dynamic = "force-dynamic";

type ScorecardResponse = {
  kpis: any[];
  project?: { slug?: string; name?: string };
  project_slug?: string;
  project_name?: string;
};

type EntityBySlug = {
  id?: string;
  entity_id?: string;
  slug?: string;
  fullLegalName?: string;
  name?: string;
};

export default async function EntityControlEvidencePage({
  params,
}: {
  params: Promise<{ entitySlug: string; projectId: string; kpiKey: string }>;
}) {
  const { entitySlug, projectId, kpiKey } = await params;

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const appBase = appUrl.replace(/\/+$/, "");
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };

  const entityRes = await fetch(
    `${appBase}/api/core/entity/by-slug/${encodeURIComponent(entitySlug)}`,
    headers,
  );
  if (!entityRes.ok) {
    throw new Error(`Failed to resolve entity (${entityRes.status})`);
  }
  const entity = (await entityRes.json()) as EntityBySlug;
  const entityId = entity.entity_id ?? entity.id;
  if (!entityId) {
    throw new Error("Entity ID not found");
  }

  const scorecardRes = await fetch(
    `${appBase}/api/core/scorecard/${encodeURIComponent(projectId)}?entity_id=${encodeURIComponent(entityId)}`,
    headers,
  );
  if (scorecardRes.status === 410) {
    return (
      <ArchivedProjectNotice
        projectId={projectId}
        subtitle="LeadAI · Control Evidence"
      />
    );
  }
  if (!scorecardRes.ok) {
    throw new Error(`Failed to load scorecard (${scorecardRes.status})`);
  }

  const data = (await scorecardRes.json()) as ScorecardResponse;
  const kpis = Array.isArray(data.kpis) ? data.kpis : [];
  const match = kpis.find((k) => (k.key ?? "") === kpiKey);
  const projectLabel = data.project?.name ?? data.project_name ?? projectId;

  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        <Header
          title={match?.name ?? "Control Evidence"}
          subtitle={`Project: ${projectLabel}`}
        >
          <div className="flex items-center gap-2">
            <HistoryBackButton label="Back" />
            <CloseWindowButton
              label="Close"
              className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800"
            />
          </div>
        </Header>

        <ControlEvidenceMeta
          projectId={projectId}
          kpiKey={kpiKey}
          entityId={entityId}
        />

        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
          {match ? (
            <EditKpis
              projectId={projectId}
              kpis={[match]}
              entityId={entityId}
              entitySlug={entitySlug}
            />
          ) : (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              KPI "{kpiKey}" not found for this project.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
