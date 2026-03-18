// src/app/[entitySlug]/scorecard/page.tsx (Server Component)
export const dynamic = "force-dynamic";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import MiniTrustDonut from "@/app/(components)/MiniTrustDonut";
import Header from "@/app/(components)/Header";
import { resolveNavMode } from "@/lib/navMode";
import { getLocale, getTranslations } from "next-intl/server";
import EntitySwitcher from "@/app/scorecard/admin/governance-dashboard-reporting/EntitySwitcher";
import BackButton from "@/app/scorecard/admin/governance-dashboard-reporting/BackButton";
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

type UserEntity = {
  entity_id: string;
  role: string;
  name: string;
  slug: string;
  status: string | null;
};

export default async function EntityScorecardHome({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("GovernanceDashboard");
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard");
  }

  const session = await auth();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "";

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };

  // Check if user is master admin
  const masterAdminRes = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/is-master-admin`, headers);
  const isMasterAdmin = masterAdminRes.ok && (await masterAdminRes.json()) === true;

  // Validate entity access
  const entitiesRes = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
  if (!entitiesRes.ok) {
    if (entitiesRes.status === 401) {
      redirect("/register?callbackUrl=" + encodeURIComponent(`/${encodeURIComponent(entitySlug)}/scorecard`));
    }
    redirect("/scorecard");
  }
  const entities = (await entitiesRes.json()) as UserEntity[];
  let entity = entities.find((e) => e.slug === entitySlug);

  // If not found in user_entity_access but user is master admin, fetch entity by slug
  if (!entity && isMasterAdmin) {
    const entityBySlugRes = await fetch(
      `${appUrl.replace(/\/+$/, "")}/api/core/entity/by-slug/${encodeURIComponent(entitySlug)}`,
      headers
    );
    if (entityBySlugRes.ok) {
      const entityData = await entityBySlugRes.json();
      entity = {
        entity_id: entityData.id,
        role: "admin",
        name: entityData.fullLegalName,
        slug: entityData.slug ?? entitySlug,
        status: entityData.status,
      };
    }
  }

  if (!entity) {
    const first = entities[0];
    if (first) {
      redirect(`/${encodeURIComponent(first.slug)}/scorecard`);
    }
    redirect("/scorecard");
  }

  const entityParam = `&entity_id=${encodeURIComponent(entity.entity_id)}`;

  // Fetch projects for this entity
  const res = await fetch(
    `${appUrl.replace(/\/+$/, "")}/api/core/projects?locale=${encodeURIComponent(locale)}${entityParam}`,
    headers
  );
  if (!res.ok) {
    if (res.status === 401) {
      redirect("/register?callbackUrl=" + encodeURIComponent(`/${encodeURIComponent(entitySlug)}/scorecard`));
    }
    throw new Error(`Failed to load projects (${res.status})`);
  }
  const projects = (await res.json()) as Project[];
  const projectSummaries = await Promise.all(
    projects.map(async (p) => {
      let trustPct: number | null = null;
      let trustLabel = t("projectCard.na");
      try {
        const trustRes = await fetch(
          `${appUrl.replace(/\/+$/, "")}/api/scorecard/${encodeURIComponent(p.slug)}`,
          headers
        );
        if (trustRes.ok) {
          const trustData = await trustRes.json();
          if (typeof trustData?.overall_pct === "number") {
            trustPct = Math.round(trustData.overall_pct);
            trustLabel =
              trustPct >= 80
                ? t("trustLabels.strong")
                : trustPct >= 60
                ? t("trustLabels.moderate")
                : trustPct >= 40
                ? t("trustLabels.weak")
                : t("trustLabels.critical");
          }
        }
      } catch {
        trustPct = null;
      }

      let alertsCount: number | null = null;
      try {
        const alertRes = await fetch(
          `${appUrl.replace(/\/+$/, "")}/api/core/admin/policy-alerts?project_slug=${encodeURIComponent(
            p.slug
          )}`,
          headers
        );
        if (alertRes.ok) {
          const alertData = await alertRes.json();
          if (typeof alertData?.total === "number") {
            alertsCount = alertData.total;
          } else if (Array.isArray(alertData?.items)) {
            alertsCount = alertData.items.length;
          } else {
            alertsCount = 0;
          }
        }
      } catch {
        alertsCount = null;
      }

      return {
        ...p,
        trustPct,
        trustLabel,
        alertsCount,
      };
    })
  );

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <Header title={t("title")} subtitle="Executive Reporting" entityName={entity.name}>
          <div className="flex w-full flex-wrap items-start gap-3">
            <BackButton />
            <div className="ml-auto flex flex-col items-end self-start">
              {entities.length > 1 ? (
                <EntitySwitcher
                  entities={entities}
                  currentSlug={entitySlug}
                  basePath="/scorecard"
                />
              ) : (
                <span
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white shadow-sm dark:border-white/20 dark:bg-white/5"
                  title={entity.slug}
                >
                  {entity.name}
                </span>
              )}
              {userLabel ? (
                <span className="mt-1 text-xs text-white/80">{userLabel}</span>
              ) : null}
            </div>
          </div>
        </Header>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                href={`/${encodeURIComponent(entitySlug)}/scorecard/${encodeURIComponent(p.slug)}/vipdashboard`}
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

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                List of Projects
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t("executiveReport.coverageTitle", { count: projectSummaries.length })}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("executiveReport.summary")}
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t("executiveReport.entityLabel", { name: entity.name })}
            </div>
          </div>

          <div className="mt-4 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("executiveReport.table.project")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("executiveReport.table.projectStatus")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("executiveReport.table.risk")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("executiveReport.table.priority")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("executiveReport.table.trust")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("executiveReport.table.owner")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("executiveReport.table.sponsor")}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">
                    {t("executiveReport.table.alerts")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {projectSummaries.map((p) => {
                  const risk = p.risk_level ?? "—";
                  const priority = p.priority ?? p.risk_level ?? "—";
                  const status = p.status ?? "—";
                  const trustText =
                    typeof p.trustPct === "number"
                      ? `${p.trustPct}% · ${p.trustLabel}`
                      : t("projectCard.na");
                  const alertsText =
                    typeof p.alertsCount === "number"
                      ? p.alertsCount > 0
                        ? t("executiveReport.alertsActive", { count: p.alertsCount })
                        : t("executiveReport.alertsNone")
                      : t("projectCard.na");
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        <Link
                          href={`/scorecard/${encodeURIComponent(p.slug)}/vipdashboard`}
                          className="text-indigo-600 hover:underline dark:text-indigo-300"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {status}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {risk}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {priority}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                        {trustText}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {p.owner || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {p.sponsor || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                        {alertsText}
                      </td>
                    </tr>
                  );
                })}
                {projectSummaries.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-slate-500"
                    >
                      {t("executiveReport.empty")}
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
