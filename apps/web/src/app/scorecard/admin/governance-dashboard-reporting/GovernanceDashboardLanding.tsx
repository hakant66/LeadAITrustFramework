import Link from "next/link";
import Header from "@/app/(components)/Header";
import MiniTrustDonut from "@/app/(components)/MiniTrustDonut";
import EntitySwitcher from "@/app/scorecard/admin/governance-dashboard-reporting/EntitySwitcher";
import BackButton from "@/app/scorecard/admin/governance-dashboard-reporting/BackButton";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import { getLocale, getTranslations } from "next-intl/server";
import { auth } from "@/auth";

type Project = {
  id: string;
  slug: string;
  name: string;
  risk_level: string | null;
  priority: string | null;
  sponsor: string | null;
  owner: string | null;
  target_threshold: number;
  status?: string | null;
};

type ProjectScore = {
  slug: string;
  overall_pct: number | null;
};

type ProjectSummary = Project & {
  overall_pct: number | null;
  target_pct: number;
  trust_status: "onTarget" | "belowTarget" | "noData";
  project_status: string | null;
};

type PolicyAlert = {
  id: string;
  policy_title?: string | null;
  project_slug?: string | null;
  alert_type?: string | null;
  severity?: string | null;
  message?: string | null;
  created_at?: string | null;
};

type UserEntity = {
  entity_id: string;
  role: string;
  name: string;
  slug: string;
  status: string | null;
};

const formatProjectStatus = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  const lowered = normalized.toLowerCase();
  if (lowered === "in review" || lowered === "in_review") return "In-review";
  if (lowered === "experimenta") return "Experimental";
  return normalized.replace(/_/g, "-");
};

export default async function GovernanceDashboardLanding({
  dashboardPath = "dashboard",
  entitySlug,
  entityId,
  entities: entitiesProp,
  showAlerts = false,
  showExecutiveMenu = false,
  headerVariant = "default",
  titleOverride,
  subtitleOverride,
  showProjectCards = true,
  executionMenuItems,
  hideEntityBadge = false,
  hideSignOut = false,
}: {
  dashboardPath?: "dashboard" | "vipdashboard";
  entitySlug?: string;
  entityId?: string;
  entities?: UserEntity[];
  showAlerts?: boolean;
  showExecutiveMenu?: boolean;
  headerVariant?: "default" | "back-entity";
  titleOverride?: string;
  subtitleOverride?: string;
  showProjectCards?: boolean;
  executionMenuItems?: Array<{ label: string; href: string }>;
  hideEntityBadge?: boolean;
  hideSignOut?: boolean;
}) {
  const t = await getTranslations("GovernanceDashboard");
  const locale = await getLocale();
  const session = await auth();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "";
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard");
  }

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };

  const entityParam = entityId ? `&entity_id=${encodeURIComponent(entityId)}` : "";
  const projectsUrl = `${appUrl.replace(/\/+$/, "")}/api/core/projects?locale=${encodeURIComponent(locale)}${entityParam}`;

  let projects: Project[];
  let entities: UserEntity[] = entitiesProp ?? [];
  try {
    const [projectsRes, entitiesRes] = await Promise.all([
      fetch(projectsUrl, headers),
      entitiesProp ? Promise.resolve(null as Response | null) : fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers),
    ]);
    if (entitiesProp) {
      entities = entitiesProp;
    } else if (entitiesRes?.ok) {
      entities = (await entitiesRes.json()) as UserEntity[];
    }
    if (!projectsRes.ok) {
      const status = projectsRes.status;
      const text = await projectsRes.text();
      let detail: string;
      try {
        const body = JSON.parse(text) as { detail?: string };
        detail = typeof body.detail === "string" ? body.detail : "";
      } catch {
        detail = text || `Failed to load projects (${status})`;
      }
      throw new Error(status === 401 ? "Unauthorized" : detail);
    }
    projects = (await projectsRes.json()) as Project[];
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load projects";
    const callbackUrl = entitySlug
      ? `/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-dashboard-reporting`
      : "/scorecard/admin/governance-dashboard-reporting";
    if (message === "Unauthorized") {
      redirect("/register?callbackUrl=" + encodeURIComponent(callbackUrl));
    }
    const isNoEntityAccess =
      /no entity access|need to be granted access to an entity/i.test(message);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
        <Header title={t("title")} subtitle={t("subtitle")} />
        <div className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              {isNoEntityAccess ? "Entity access required" : "Unable to load dashboard"}
            </p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
              {isNoEntityAccess
                ? "You’re signed in but don’t have access to any entity. Ask your administrator to grant you access to an entity, then try again."
                : message}
            </p>
            <div className="mt-4 flex gap-3">
              {!isNoEntityAccess && (
                <Link
                  href={
                    entitySlug
                      ? `/register?callbackUrl=${encodeURIComponent(`/${entitySlug}/scorecard/admin/governance-dashboard-reporting`)}`
                      : "/register?callbackUrl=/scorecard/admin/governance-dashboard-reporting"
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  Sign in
                </Link>
              )}
              <Link
                href={
                  entitySlug
                    ? `/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-dashboard-reporting`
                    : "/scorecard/admin/governance-dashboard-reporting"
                }
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Retry
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentEntity: UserEntity | null =
    entities.length > 0
      ? (entitySlug ? entities.find((e) => e.slug === entitySlug) ?? entities[0] : entities[0])
      : null;

  const scorecardEntityParam = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : "";
  const scorecards = await Promise.all(
    projects.map(async (p): Promise<ProjectScore> => {
      try {
        const scoreRes = await fetch(
          `${appUrl.replace(/\/+$/, "")}/api/core/scorecard/${encodeURIComponent(p.slug)}${scorecardEntityParam}`,
          {
            cache: "no-store",
            headers: { Cookie: cookieStore.toString() },
          }
        );
        if (!scoreRes.ok) throw new Error(String(scoreRes.status));
        const data = await scoreRes.json();
        const pct = typeof data.overall_pct === "number" ? data.overall_pct : null;
        return { slug: p.slug, overall_pct: pct };
      } catch {
        return { slug: p.slug, overall_pct: null };
      }
    })
  );

  const scoreBySlug = new Map<string, number | null>(
    scorecards.map((s) => [s.slug, s.overall_pct])
  );

  let policyAlerts: PolicyAlert[] = [];
  if (showAlerts && projects.length > 0) {
    const alerts = await Promise.all(
      projects.map(async (p) => {
        try {
          const alertRes = await fetch(
            `${appUrl.replace(/\/+$/, "")}/api/core/admin/policy-alerts?project_slug=${encodeURIComponent(
              p.slug
            )}&status=open&include_global=true&limit=50`,
            headers
          );
          if (!alertRes.ok) return [];
          const data = await alertRes.json();
          const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
          return items.map((item: PolicyAlert) => ({
            ...item,
            project_slug: item.project_slug ?? p.slug,
          }));
        } catch {
          return [];
        }
      })
    );
    const alertMap = new Map<string, PolicyAlert>();
    alerts.flat().forEach((alert) => {
      if (alert?.id) alertMap.set(alert.id, alert);
    });
    policyAlerts = Array.from(alertMap.values()).sort((a, b) => {
      const aTime = a.created_at ? Date.parse(a.created_at) : 0;
      const bTime = b.created_at ? Date.parse(b.created_at) : 0;
      return bTime - aTime;
    });
  }

  const summaries: ProjectSummary[] = projects.map((p) => {
    const rawTarget =
      typeof p.target_threshold === "number"
        ? p.target_threshold
        : Number(p.target_threshold ?? 0.75);
    const target =
      Number.isFinite(rawTarget) && !Number.isNaN(rawTarget)
        ? Math.max(0, Math.min(1, rawTarget))
        : 0.75;
    const targetPct = Math.round(target * 100);
    const overall = scoreBySlug.get(p.slug) ?? null;
    const trust_status =
      overall === null
        ? "noData"
        : overall >= targetPct
        ? "onTarget"
        : "belowTarget";
    return {
      ...p,
      overall_pct: overall,
      target_pct: targetPct,
      trust_status,
      project_status: formatProjectStatus(p.status),
    };
  });

  const totalProjects = summaries.length;
  const onTargetCount = summaries.filter((p) => p.trust_status === "onTarget").length;
  const belowTargetCount = summaries.filter((p) => p.trust_status === "belowTarget").length;
  const noDataCount = summaries.filter((p) => p.trust_status === "noData").length;
  const scored = summaries.filter((p) => p.overall_pct !== null);
  const avgTrust =
    scored.length > 0
      ? Math.round(
          scored.reduce((acc, p) => acc + (p.overall_pct ?? 0), 0) / scored.length
        )
      : null;
  const highRiskCount = summaries.filter((p) => {
    const risk = (p.risk_level ?? "").toLowerCase();
    return risk === "high" || risk === "critical";
  }).length;
  const basePath = entitySlug ? `/${encodeURIComponent(entitySlug)}` : "";
  const entitySwitcherPath =
    dashboardPath === "vipdashboard"
      ? "/scorecard/PortfolioSummary"
      : "/scorecard/admin/governance-dashboard-reporting";

  return (
    <div className="space-y-6">
      <Header
        title={titleOverride ?? t("title")}
        subtitle={subtitleOverride ?? t("subtitle")}
        entityName={hideEntityBadge ? undefined : currentEntity?.name ?? undefined}
      >
        {headerVariant === "back-entity" ? (
          <div className="flex w-full flex-wrap items-start gap-3">
            <BackButton />
            <div className="ml-auto flex flex-col items-end self-start">
              {!hideEntityBadge && currentEntity && entitySlug && entities.length > 1 ? (
                <EntitySwitcher
                  entities={entities}
                  currentSlug={entitySlug}
                  basePath={entitySwitcherPath}
                />
              ) : !hideEntityBadge && currentEntity ? (
                <span
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white shadow-sm dark:border-white/20 dark:bg-white/5"
                  title={currentEntity.slug}
                >
                  {currentEntity.name}
                </span>
              ) : null}
              {userLabel ? (
                <span className="mt-1 text-xs text-white/80">{userLabel}</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {!hideEntityBadge && currentEntity && entitySlug && entities.length > 1 ? (
              <EntitySwitcher entities={entities} currentSlug={entitySlug} />
            ) : !hideEntityBadge && currentEntity ? (
              <span
                className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white shadow-sm dark:border-white/20 dark:bg-white/5"
                title={currentEntity.slug}
              >
                {t("viewingEntity", { name: currentEntity.name })}
              </span>
            ) : null}
            {!hideSignOut ? (
              <Link
                href="/"
                className="inline-flex items-center px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-600 text-sm font-medium shadow-sm transition hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t("signOut")}
              </Link>
            ) : null}
          </div>
        )}
      </Header>

      {executionMenuItems && executionMenuItems.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Execution Menu
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Quick links to execution workflows for this entity.
            </p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {executionMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-800 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-400/60 dark:hover:bg-indigo-950/40"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {showExecutiveMenu && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {t("dashboardMenu.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t("dashboardMenu.subtitle")}
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Link
              href={`${basePath}/scorecard/admin/governance-dashboard-reporting/high-level-report`}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-400/60 dark:hover:bg-indigo-950/40"
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("dashboardMenu.highLevel.title")}
              </div>
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                {t("dashboardMenu.highLevel.summary")}
              </div>
            </Link>

            <Link
              href={`${basePath}/scorecard/PortfolioSummary`}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-400/60 dark:hover:bg-indigo-950/40"
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("dashboardMenu.portfolio.title")}
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <div className="font-semibold text-slate-700 dark:text-slate-200">
                  {t("dashboardMenu.portfolio.summaryTitle")}
                </div>
                <div>{t("dashboardMenu.portfolio.coverage", { count: totalProjects })}</div>
                <div>{t("dashboardMenu.portfolio.summary")}</div>
              </div>
            </Link>

            <Link
              href={`${basePath}/scorecard`}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-400/60 dark:hover:bg-indigo-950/40"
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("dashboardMenu.scorecards.title")}
              </div>
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                {t("dashboardMenu.scorecards.summary")}
              </div>
            </Link>

            <Link
              href={`${basePath}/scorecard/admin/governance-dashboard-reporting/presentation-deck`}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-400/60 dark:hover:bg-indigo-950/40"
            >
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("dashboardMenu.presentation.title")}
              </div>
              <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                {t("dashboardMenu.presentation.summary")}
              </div>
            </Link>
          </div>
        </section>
      )}

      {showExecutiveMenu && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {t("executiveReport.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t("executiveReport.subtitle")}
            </p>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {t("executiveReport.note")}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("executiveReport.stats.total")}
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {totalProjects}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("executiveReport.stats.onTarget")}
            </div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">
              {onTargetCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("executiveReport.stats.belowTarget")}
            </div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">
              {belowTargetCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("executiveReport.stats.noData")}
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-600 dark:text-slate-200">
              {noDataCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("executiveReport.stats.avgTrust")}
            </div>
            <div className="mt-1 text-2xl font-semibold text-indigo-600">
              {avgTrust === null ? "—" : `${avgTrust}%`}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {t("executiveReport.stats.highRisk")}: {highRiskCount}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 text-left">{t("executiveReport.table.project")}</th>
                <th className="py-2 text-left">{t("executiveReport.table.risk")}</th>
                <th className="py-2 text-left">{t("executiveReport.table.priority")}</th>
                <th className="py-2 text-left">{t("executiveReport.table.sponsor")}</th>
                <th className="py-2 text-left">{t("executiveReport.table.owner")}</th>
                <th className="py-2 text-left">{t("executiveReport.table.projectStatus")}</th>
                <th className="py-2 text-left">{t("executiveReport.table.trust")}</th>
                <th className="py-2 text-left">{t("executiveReport.table.target")}</th>
                <th className="py-2 text-left">{t("executiveReport.table.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {summaries.map((p) => {
                const riskLabel = p.risk_level ?? t("projectCard.na");
                const priorityLabel = p.priority ?? p.risk_level ?? t("projectCard.na");
                const statusLabel =
                  p.trust_status === "onTarget"
                    ? t("executiveReport.status.onTarget")
                    : p.trust_status === "belowTarget"
                    ? t("executiveReport.status.belowTarget")
                    : t("executiveReport.status.noData");
                const statusClass =
                  p.trust_status === "onTarget"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : p.trust_status === "belowTarget"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-slate-50 text-slate-600 border-slate-200";
                const projectHref =
                  dashboardPath === "vipdashboard"
                    ? `/scorecard/${encodeURIComponent(p.slug)}/${dashboardPath}`
                    : entitySlug
                    ? `/${encodeURIComponent(entitySlug)}/scorecard/${encodeURIComponent(
                        p.slug
                      )}/${dashboardPath}`
                    : `/scorecard/${encodeURIComponent(p.slug)}/${dashboardPath}`;

                return (
                  <tr key={p.slug} className="align-top">
                    <td className="py-2 pr-4 font-medium text-slate-900 dark:text-slate-50">
                      <Link
                        href={projectHref}
                        className="text-indigo-600 hover:underline dark:text-indigo-300"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {riskLabel}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {priorityLabel}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {p.sponsor ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {p.owner ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {p.project_status ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-900 dark:text-slate-50">
                      {p.overall_pct === null ? "—" : `${Math.round(p.overall_pct)}%`}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {p.target_pct}%
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </section>
      )}

      {!showExecutiveMenu && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {t("executiveReport.title")}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {t("executiveReport.subtitle")}
              </p>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t("executiveReport.note")}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("executiveReport.stats.total")}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">
                {totalProjects}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("executiveReport.stats.onTarget")}
              </div>
              <div className="mt-1 text-2xl font-semibold text-emerald-600">
                {onTargetCount}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("executiveReport.stats.belowTarget")}
              </div>
              <div className="mt-1 text-2xl font-semibold text-amber-600">
                {belowTargetCount}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("executiveReport.stats.noData")}
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-600 dark:text-slate-200">
                {noDataCount}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {t("executiveReport.stats.avgTrust")}
              </div>
              <div className="mt-1 text-2xl font-semibold text-indigo-600">
                {avgTrust === null ? "—" : `${avgTrust}%`}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {t("executiveReport.stats.highRisk")}: {highRiskCount}
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 text-left">{t("executiveReport.table.project")}</th>
                  <th className="py-2 text-left">{t("executiveReport.table.risk")}</th>
                  <th className="py-2 text-left">{t("executiveReport.table.priority")}</th>
                  <th className="py-2 text-left">{t("executiveReport.table.sponsor")}</th>
                  <th className="py-2 text-left">{t("executiveReport.table.owner")}</th>
                  <th className="py-2 text-left">{t("executiveReport.table.projectStatus")}</th>
                  <th className="py-2 text-left">{t("executiveReport.table.trust")}</th>
                  <th className="py-2 text-left">{t("executiveReport.table.target")}</th>
                  <th className="py-2 text-left">{t("executiveReport.table.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {summaries.map((p) => {
                  const riskLabel = p.risk_level ?? t("projectCard.na");
                  const priorityLabel = p.priority ?? p.risk_level ?? t("projectCard.na");
                  const statusLabel =
                    p.trust_status === "onTarget"
                      ? t("executiveReport.status.onTarget")
                      : p.trust_status === "belowTarget"
                      ? t("executiveReport.status.belowTarget")
                      : t("executiveReport.status.noData");
                  const statusClass =
                    p.trust_status === "onTarget"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : p.trust_status === "belowTarget"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-50 text-slate-600 border-slate-200";
                  const projectHref =
                    dashboardPath === "vipdashboard"
                      ? `/scorecard/${encodeURIComponent(p.slug)}/${dashboardPath}`
                      : entitySlug
                      ? `/${encodeURIComponent(entitySlug)}/scorecard/${encodeURIComponent(
                          p.slug
                        )}/${dashboardPath}`
                      : `/scorecard/${encodeURIComponent(p.slug)}/${dashboardPath}`;

                  return (
                    <tr key={p.slug} className="align-top">
                      <td className="py-2 pr-4 font-medium text-slate-900 dark:text-slate-50">
                        <Link
                          href={projectHref}
                          className="text-indigo-600 hover:underline dark:text-indigo-300"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                        {riskLabel}
                      </td>
                      <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                        {priorityLabel}
                      </td>
                      <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                        {p.sponsor ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                        {p.owner ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                        {p.project_status ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-slate-900 dark:text-slate-50">
                        {p.overall_pct === null ? "—" : `${Math.round(p.overall_pct)}%`}
                      </td>
                      <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                        {p.target_pct}%
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!showExecutiveMenu && showAlerts && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                {t("alerts.title")}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {t("alerts.subtitle")}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              {t("alerts.countLabel", { count: policyAlerts.length })}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 text-left">{t("alerts.columns.policy")}</th>
                  <th className="py-2 text-left">{t("alerts.columns.project")}</th>
                  <th className="py-2 text-left">{t("alerts.columns.severity")}</th>
                  <th className="py-2 text-left">{t("alerts.columns.type")}</th>
                  <th className="py-2 text-left">{t("alerts.columns.message")}</th>
                  <th className="py-2 text-left">{t("alerts.columns.created")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {policyAlerts.map((alert) => (
                  <tr key={alert.id} className="align-top">
                    <td className="py-2 pr-4 font-medium text-slate-900 dark:text-slate-50">
                      {alert.policy_title ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {alert.project_slug ?? "global"}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${alertSeverityClass(
                          alert.severity || ""
                        )}`}
                      >
                        {alert.severity ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {alert.alert_type ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {alert.message ?? "—"}
                    </td>
                    <td className="py-2 text-slate-500 dark:text-slate-400">
                      {formatTimestamp(alert.created_at)}
                    </td>
                  </tr>
                ))}
                {policyAlerts.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-4 text-center text-sm text-slate-500 dark:text-slate-400"
                    >
                      {t("alerts.empty")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!showExecutiveMenu && showProjectCards && (
        <div
          id="project-scorecards"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {projects.map((p) => {
          const riskLabel = p.risk_level ?? t("projectCard.na");
          const priorityLabel = p.priority ?? p.risk_level ?? t("projectCard.na");
          const sponsorLabel = p.sponsor ?? null;
          const ownerLabel = p.owner ?? null;
          const rawTarget =
            typeof p.target_threshold === "number"
              ? p.target_threshold
              : Number(p.target_threshold ?? 0.75);
          const target =
            Number.isFinite(rawTarget) && !Number.isNaN(rawTarget)
              ? Math.max(0, Math.min(1, rawTarget))
              : 0.75;

          return (
            <a
              key={p.id}
              className="group block border rounded-2xl bg-white shadow-sm p-4 hover:shadow-md transition-shadow border-slate-200 dark:border-slate-700 dark:bg-slate-900"
              href={`/scorecard/${p.slug}/${dashboardPath}`}
              title={t("projectCard.openTitle", { name: p.name })}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-lg font-medium truncate text-slate-900 dark:text-slate-50">
                    {p.name}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-700 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1 rounded-full border bg-gray-100 px-2 py-0.5 border-slate-200 dark:border-slate-600 dark:bg-slate-800">
                      <span className="font-semibold">{t("projectCard.risk")}</span>
                      <span className="truncate">{riskLabel}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border bg-gray-100 px-2 py-0.5 border-slate-200 dark:border-slate-600 dark:bg-slate-800">
                      <span className="font-semibold">{t("projectCard.priority")}</span>
                      <span className="truncate">{priorityLabel}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border bg-gray-100 px-2 py-0.5 border-slate-200 dark:border-slate-600 dark:bg-slate-800">
                      <span className="font-semibold">{t("projectCard.status")}</span>
                      <span className="truncate">
                        {formatProjectStatus(p.status) ?? t("projectCard.na")}
                      </span>
                    </span>
                  </div>
                  {(sponsorLabel || ownerLabel) && (
                    <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-slate-400">
                      {sponsorLabel ? (
                        <div
                          className="truncate"
                          title={`${t("projectCard.sponsor")}: ${sponsorLabel}`}
                        >
                          {t("projectCard.sponsor")}: {sponsorLabel}
                        </div>
                      ) : null}
                      {ownerLabel ? (
                        <div
                          className="truncate"
                          title={`${t("projectCard.owner")}: ${ownerLabel}`}
                        >
                          {t("projectCard.owner")}: {ownerLabel}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                <MiniTrustDonut slug={p.slug} size={56} />
              </div>

              <div className="mt-4">
                <div className="text-xs text-gray-500 dark:text-slate-400">
                  {t("projectCard.targetThreshold")}
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {(target * 100).toFixed(0)}%
                </div>
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden dark:bg-slate-800">
                  <div
                    className="h-2 bg-indigo-500"
                    style={{ width: `${target * 100}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 text-indigo-600 dark:text-indigo-300 text-sm group-hover:underline">
                {t("projectCard.openDashboard")} →
              </div>
            </a>
          );
          })}
        </div>
      )}
    </div>
  );
}

function formatTimestamp(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function alertSeverityClass(severity: string) {
  const level = (severity || "").toLowerCase();
  if (level === "high") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (level === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}
