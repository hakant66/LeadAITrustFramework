import Header from "@/app/(components)/Header";
import Link from "next/link";
import { cookies } from "next/headers";
import { validateEntityAccess } from "@/lib/entityScopedPage";
import BackButton from "@/app/scorecard/admin/governance-dashboard-reporting/BackButton";
import { auth } from "@/auth";

const appBase =
  process.env.INTERNAL_APP_URL ??
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";

type Project = {
  slug: string;
  name?: string | null;
};

async function fetchJson<T>(
  url: string,
  cookieHeader: string
): Promise<{ ok: boolean; status: number; data?: T }> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Cookie: cookieHeader },
  });
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  try {
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: res.status };
  }
}

export default async function EvidenceCaptureIndexPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const session = await auth();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "";
  const entity = await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin",
    fallbackRedirect: "/scorecard/admin/governance-execution",
    callbackPath: "/scorecard/admin/governance-execution/evidence-capture",
    redirectToFirstPath: "/scorecard/admin/governance-execution/evidence-capture",
  });

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const entityId = entity.entity_id;
  const prefix = `/${encodeURIComponent(entitySlug)}`;

  const policyStatusRes = await fetchJson<{ status?: string }>(
    `${appBase.replace(/\/+$/, "")}/api/core/admin/policies/finalize-status?entity_id=${encodeURIComponent(
      entityId
    )}`,
    cookieHeader
  );
  const policyFinalised = policyStatusRes.ok && policyStatusRes.data?.status === "finalised";

  const projectsRes = await fetchJson<Project[]>(
    `${appBase.replace(/\/+$/, "")}/api/core/projects?entity_id=${encodeURIComponent(
      entityId
    )}`,
    cookieHeader
  );
  const projects = projectsRes.ok && Array.isArray(projectsRes.data) ? projectsRes.data : [];

  const eligibleProjects = policyFinalised
    ? (
        await Promise.all(
          projects.map(async (project) => {
            if (!project?.slug) return null;
            const [sysRes, reqRes, ctrlRes] = await Promise.all([
              fetchJson<{ total?: number; items?: unknown[] }>(
                `${appBase.replace(
                  /\/+$/,
                  ""
                )}/api/core/admin/ai-systems?limit=1&project_slug=${encodeURIComponent(
                  project.slug
                )}&entity_id=${encodeURIComponent(entityId)}`,
                cookieHeader
              ),
              fetchJson<{ total?: number }>(
                `${appBase.replace(
                  /\/+$/,
                  ""
                )}/api/core/admin/requirements?limit=1&project_slug=${encodeURIComponent(
                  project.slug
                )}&entity_id=${encodeURIComponent(entityId)}`,
                cookieHeader
              ),
              fetchJson<{ items?: unknown[] }>(
                `${appBase.replace(/\/+$/, "")}/api/core/admin/projects/${encodeURIComponent(
                  project.slug
                )}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`,
                cookieHeader
              ),
            ]);
            const hasSystem = Boolean(
              sysRes.ok &&
                ((Array.isArray(sysRes.data?.items) && sysRes.data.items.length > 0) ||
                  Number(sysRes.data?.total ?? 0) > 0)
            );
            const hasRequirements = Boolean(reqRes.ok && Number(reqRes.data?.total ?? 0) > 0);
            const hasControls = Boolean(
              ctrlRes.ok && Array.isArray(ctrlRes.data?.items) && ctrlRes.data?.items?.length
            );
            if (!hasSystem || !hasRequirements || !hasControls) return null;
            return {
              slug: project.slug,
              name: project.name ?? project.slug,
            };
          })
        )
      ).filter(Boolean) as Project[]
    : [];
  eligibleProjects.sort((a, b) =>
    String(a.name ?? a.slug).localeCompare(String(b.name ?? b.slug))
  );

  return (
    <div className="space-y-6">
      <Header
        title="Evidence Capture"
        subtitle="Governance Execution"
        titleNote="Choose a project to capture evidence"
      >
        <div className="flex flex-col items-end gap-2">
          <BackButton label="Back" />
          {userLabel ? (
            <div className="text-sm font-medium text-white/80">{userLabel}</div>
          ) : null}
        </div>
      </Header>
      {!policyFinalised && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-100">
          <div className="font-semibold">Governance setup not finalised</div>
          <div className="mt-1">
            Projects appear here after AI Governance Setup is finalised for the entity.
          </div>
        </div>
      )}
      {policyFinalised && eligibleProjects.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <div className="text-base font-semibold">No eligible projects yet</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Projects appear here after AI Governance Setup is finalised for the entity and the project has systems, requirements, and controls.
          </div>
        </div>
      )}
      {policyFinalised && eligibleProjects.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Evidence Capture Projects
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Select a project to capture KPI evidence.
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {eligibleProjects.map((project) => (
              <Link
                key={project.slug}
                href={`${prefix}/scorecard/${encodeURIComponent(project.slug)}/dashboard/kpis_admin`}
                className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-indigo-500/60"
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {project.name ?? project.slug}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {project.slug}
                </div>
                <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                  Open Evidence Capture
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
