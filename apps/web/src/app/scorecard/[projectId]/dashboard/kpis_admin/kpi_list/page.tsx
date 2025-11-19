// apps/web/src/app/scorecard/[projectId]/dashboard/kpis_admin/kpi_list/page.tsx

import Header from "@/app/(components)/Header";

/*
  KPI List Report Page

  This page fetches the hierarchical KPI report from the core service and
  displays the pillars and KPIs for the *current* project only.

  It calls:
    GET {CORE_SVC_URL}/admin/reports/projects-pillars-kpis?project_slug={slug}

  where {slug} is the [projectId] route param, e.g. "ai-document-processing".
*/

const apiBase =
  process.env.NEXT_PUBLIC_CORE_SVC_URL ??
  process.env.CORE_SVC_URL ??
  "http://localhost:8001";

type KpiItem = {
  kpi_name: string;
  kpi_description?: string | null;
  kpi_evidence_source?: string | null;
  kpi_example?: string | null;
};

type PillarItem = {
  pillar_name: string;
  kpis: KpiItem[];
};

type ProjectReport = {
  project_name: string;
  pillars: PillarItem[];
};

async function fetchReport(slug: string): Promise<ProjectReport | null> {
  const base = apiBase.replace(/\/+$/, "");
  const res = await fetch(
    `${base}/admin/reports/projects-pillars-kpis?project_slug=${encodeURIComponent(
      slug
    )}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`Failed to load KPI report: ${res.status}`);
  }

  const data = (await res.json()) as ProjectReport[];
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  // For a single slug there should be exactly one project.
  return data[0];
}

export default async function KpiListReportPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { projectId: slug } = params;
  const project = await fetchReport(slug);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="px-6 py-6 max-w-5xl mx-auto space-y-6">
        <Header
          title="KPI List"
          subtitle={
            project
              ? `Pillars and KPIs for project: ${project.project_name}`
              : `No KPIs found for project: ${slug}`
          }
        >
          <div className="flex items-center gap-2">
            <a
              href={`/scorecard/${encodeURIComponent(
                slug
              )}/dashboard/kpis_admin`}
              className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800"
            >
              Back to KPIs Admin
            </a>
          </div>
        </Header>

        {!project ? (
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm text-sm text-gray-700 dark:text-slate-300">
            No KPI records were returned for this project.
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
            {project.pillars.length === 0 ? (
              <div className="text-sm text-gray-700 dark:text-slate-300">
                Project is present, but no pillars / KPIs were found.
              </div>
            ) : (
              project.pillars.map((pillar) => (
                <div key={pillar.pillar_name} className="mb-6">
                  <h2 className="text-base md:text-lg font-semibold text-gray-800 dark:text-slate-100">
                    {pillar.pillar_name}
                  </h2>
                  <ul className="list-disc list-inside ml-4 space-y-2 mt-2">
                    {pillar.kpis.map((kpi) => (
                      <li key={kpi.kpi_name}>
                        <div className="text-sm text-slate-800 dark:text-slate-100">
                          <strong>{kpi.kpi_name}</strong>
                          {kpi.kpi_description
                            ? ` – ${kpi.kpi_description}`
                            : ""}
                        </div>
                        {kpi.kpi_evidence_source && (
                          <div className="text-xs text-gray-500 dark:text-slate-400 ml-4">
                            <span className="font-semibold">
                              Evidence source:
                            </span>{" "}
                            {kpi.kpi_evidence_source}
                          </div>
                        )}
                        {kpi.kpi_example && (
                          <div className="text-xs text-gray-500 dark:text-slate-400 ml-4">
                            <span className="font-semibold">Example:</span>{" "}
                            {kpi.kpi_example}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
