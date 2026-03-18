import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import Header from "@/app/(components)/Header";
import { resolveNavMode } from "@/lib/navMode";
import { findEntityBySlug } from "@/lib/entityValidation";
import BackButton from "@/app/scorecard/admin/governance-dashboard-reporting/BackButton";
import { auth } from "@/auth";

type ProjectSummary = {
  id: string;
  slug: string;
  name: string;
  risk_level: string | null;
  priority: string | null;
  status: string | null;
  hasSystem: boolean;
  hasRequirements: boolean;
  hasControls: boolean;
};

export default async function EntityProjectsViewPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin");
  }

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const session = await auth();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "";
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };

  const entity = await findEntityBySlug(entitySlug);
  if (!entity) {
    const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
    if (res.ok) {
      const entities = (await res.json()) as Array<{ slug: string }>;
      const first = entities[0];
      if (first) {
        redirect(`/${encodeURIComponent(first.slug)}/projects/view`);
      }
    }
    if (!res.ok && res.status === 401) {
      redirect(
        "/register?callbackUrl=" + encodeURIComponent(`/${encodeURIComponent(entitySlug)}/projects/view`)
      );
    }
    redirect("/projects/view");
  }

  const projectsRes = await fetch(
    `${appUrl.replace(/\/+$/, "")}/api/core/projects?entity_id=${encodeURIComponent(
      entity.entity_id
    )}`,
    headers
  );
  const rawProjects = projectsRes.ok ? await projectsRes.json() : [];
  const projectsBase: ProjectSummary[] = Array.isArray(rawProjects)
    ? rawProjects.map((p: Record<string, unknown>) => {
        const risk =
          typeof p.risk_level === "string" && p.risk_level.trim().length > 0
            ? p.risk_level
            : null;
        const priority =
          typeof p.priority === "string" && p.priority.trim().length > 0
            ? p.priority
            : risk;
        return {
          id: String(p.id ?? ""),
          slug: String(p.slug ?? ""),
          name: String(p.name ?? p.slug ?? ""),
          risk_level: risk,
          priority,
          status:
            typeof p.status === "string" && p.status.trim().length > 0
              ? p.status
              : null,
          hasSystem: false,
          hasRequirements: false,
          hasControls: false,
        };
      })
    : [];

  const systemsRes = await fetch(
    `${appUrl.replace(/\/+$/, "")}/api/core/admin/ai-systems?entity_id=${encodeURIComponent(
      entity.entity_id
    )}&limit=500`,
    headers
  );
  const systemsData = systemsRes.ok ? await systemsRes.json().catch(() => null) : null;
  const systems = Array.isArray(systemsData?.items) ? systemsData.items : [];
  const systemProjectSet = new Set(
    systems
      .map((item: { project_slug?: unknown }) => String(item?.project_slug ?? "").trim())
      .filter((slug: string) => slug.length > 0)
  );

  const projects = await Promise.all(
    projectsBase.map(async (project) => {
      if (!project.slug) return project;
      const hasSystem = systemProjectSet.has(project.slug);
      const reqRes = await fetch(
        `${appUrl.replace(
          /\/+$/,
          ""
        )}/api/core/admin/requirements?limit=1&project_slug=${encodeURIComponent(
          project.slug
        )}&entity_id=${encodeURIComponent(entity.entity_id)}`,
        headers
      );
      const reqData = reqRes.ok ? await reqRes.json() : null;
      const hasRequirements = Boolean(reqData && Number(reqData.total) > 0);
      const controlsRes = await fetch(
        `${appUrl.replace(/\/+$/, "")}/api/core/admin/projects/${encodeURIComponent(
          project.slug
        )}/control-values-exec?entity_id=${encodeURIComponent(entity.entity_id)}`,
        headers
      );
      let hasControls = false;
      if (controlsRes.ok) {
        const controlsData = await controlsRes.json().catch(() => null);
        if (Array.isArray(controlsData)) {
          hasControls = controlsData.length > 0;
        } else if (Array.isArray(controlsData?.items)) {
          hasControls = controlsData.items.length > 0;
        } else if (typeof controlsData?.total === "number") {
          hasControls = controlsData.total > 0;
        }
      }
      return { ...project, hasSystem, hasRequirements, hasControls };
    })
  );
  const readyProjects = projects.filter(
    (project) => project.hasSystem && project.hasRequirements && project.hasControls
  );

  return (
    <div className="space-y-6">
      <Header
        title="Projects"
        subtitle="Governance Execution"
      >
        <div className="flex flex-col items-end gap-2">
          <BackButton label="Back" />
          {userLabel ? (
            <div className="text-sm font-medium text-white/80">{userLabel}</div>
          ) : null}
        </div>
      </Header>

      <section>
        <div className="border rounded-2xl bg-white shadow-sm p-4 border-slate-200 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">Registered AI Projects</div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Projects ready to execute for this entity.
                </p>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {readyProjects.length} ready
              </div>
            </div>

            <div className="mt-3">
              {readyProjects.length === 0 ? (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  No projects are ready to execute yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {readyProjects.map((project) => (
                    <div
                      key={project.slug}
                      className="py-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {project.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {project.slug}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {project.status && (
                          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            {project.status}
                          </span>
                        )}
                        {project.risk_level && (
                          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            Risk: {project.risk_level}
                          </span>
                        )}
                        {project.priority && (
                          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                            Priority: {project.priority}
                          </span>
                        )}
                        <Link
                          href={`/${encodeURIComponent(
                            entitySlug
                          )}/scorecard/admin/governance-setup/ai-requirements-register`}
                          className="rounded-full border border-emerald-200 px-2 py-0.5 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
                        >
                          KPIs
                        </Link>
                        <Link
                          href={`/${encodeURIComponent(
                            entitySlug
                          )}/scorecard/${encodeURIComponent(project.slug)}/dashboard`}
                          className="rounded-full border border-indigo-200 px-2 py-0.5 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-200 dark:hover:bg-indigo-500/10"
                        >
                          View
                        </Link>
                        <Link
                          href={`/${encodeURIComponent(
                            entitySlug
                          )}/scorecard/admin/governance-execution/action-assignment/${encodeURIComponent(
                            project.slug
                          )}`}
                          className="rounded-full border border-rose-200 px-2 py-0.5 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-200 dark:hover:bg-rose-500/10"
                        >
                          Go
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      </section>
    </div>
  );
}
