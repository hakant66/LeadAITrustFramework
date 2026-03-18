import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

type UserEntity = {
  entity_id: string;
  role: string;
  name: string;
  slug: string;
  status: string | null;
};

type Project = {
  slug: string;
};

type Step = {
  key: string;
  label: string;
  href: string;
  complete: boolean;
  enabled: boolean;
};

const appBase =
  process.env.INTERNAL_APP_URL ??
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";

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

async function getRequirementsCoverage(
  projectSlugs: string[],
  entityId: string,
  cookieHeader: string
): Promise<{ covered: number; total: number }> {
  if (projectSlugs.length === 0) return { covered: 0, total: 0 };
  let covered = 0;
  for (const slug of projectSlugs) {
    const res = await fetchJson<{ total?: number }>(
      `${appBase.replace(
        /\/+$/,
        ""
      )}/api/core/admin/requirements?limit=1&project_slug=${encodeURIComponent(
        slug
      )}&entity_id=${encodeURIComponent(entityId)}`,
      cookieHeader
    );
    if (res.ok && typeof res.data?.total === "number" && res.data.total > 0) {
      covered += 1;
    }
  }
  return { covered, total: projectSlugs.length };
}

async function getSystemsCoverage(
  projectSlugs: string[],
  entityId: string,
  cookieHeader: string
): Promise<{ covered: number; total: number }> {
  if (projectSlugs.length === 0) return { covered: 0, total: 0 };
  let covered = 0;
  for (const slug of projectSlugs) {
    const res = await fetchJson<{ total?: number; items?: unknown[] }>(
      `${appBase.replace(
        /\/+$/,
        ""
      )}/api/core/admin/ai-systems?limit=1&project_slug=${encodeURIComponent(
        slug
      )}&entity_id=${encodeURIComponent(entityId)}`,
      cookieHeader
    );
    if (
      res.ok &&
      ((Array.isArray(res.data?.items) && res.data.items.length > 0) ||
        Number(res.data?.total ?? 0) > 0)
    ) {
      covered += 1;
    }
  }
  return { covered, total: projectSlugs.length };
}

async function getControlsCoverage(
  projectSlugs: string[],
  entityId: string,
  cookieHeader: string
): Promise<{ covered: number; total: number }> {
  if (projectSlugs.length === 0) return { covered: 0, total: 0 };
  let covered = 0;
  for (const slug of projectSlugs) {
    const res = await fetchJson<{ items?: unknown[] }>(
      `${appBase.replace(/\/+$/, "")}/api/core/admin/projects/${encodeURIComponent(
        slug
      )}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`,
      cookieHeader
    );
    if (res.ok && Array.isArray(res.data?.items) && res.data?.items?.length) {
      covered += 1;
    }
  }
  return { covered, total: projectSlugs.length };
}

export default async function GovernanceJourneyCard({
  entitySlug,
}: {
  entitySlug?: string;
}) {
  const t = await getTranslations("GovernanceJourneyCard");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const callbackUrl = entitySlug
    ? `/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup`
    : "/scorecard/admin/governance-setup";
  const legalStandingHref = entitySlug
    ? `/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/entity-legal-standing`
    : "/ai_legal_standing";

  const entitiesRes = await fetchJson<UserEntity[]>(
    `${appBase.replace(/\/+$/, "")}/api/core/user/entities`,
    cookieHeader
  );
  if (!entitiesRes.ok) {
    if (entitiesRes.status === 401) {
      redirect("/register?callbackUrl=" + encodeURIComponent(callbackUrl));
    }
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {t("errors.loadEntities")}
      </div>
    );
  }

  const entities = entitiesRes.data ?? [];
  const currentEntity = entitySlug
    ? entities.find((e) => e.slug === entitySlug) ?? entities[0]
    : entities[0];

  if (!currentEntity) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        {t("errors.noEntityAccess")}
      </div>
    );
  }

  const prefix = `/${encodeURIComponent(currentEntity.slug)}`;
  const entityId = currentEntity.entity_id;

  const projectsRes = await fetchJson<Project[]>(
    `${appBase.replace(/\/+$/, "")}/api/core/projects?entity_id=${encodeURIComponent(entityId)}`,
    cookieHeader
  );
  if (!projectsRes.ok && projectsRes.status === 401) {
    redirect("/register?callbackUrl=" + encodeURIComponent(callbackUrl));
  }
  const projects = projectsRes.ok && projectsRes.data ? projectsRes.data : [];
  const projectSlugs = projects.map((p) => p.slug).filter(Boolean);

  const [systemsCoverage, requirementsCoverage, controlsCoverage, policiesRes] = await Promise.all([
    getSystemsCoverage(projectSlugs, entityId, cookieHeader),
    getRequirementsCoverage(projectSlugs, entityId, cookieHeader),
    projectSlugs.length && entityId
      ? getControlsCoverage(projectSlugs, entityId, cookieHeader)
      : Promise.resolve({ covered: 0, total: 0 }),
    fetchJson<{ total?: number }>(
      `${appBase.replace(/\/+$/, "")}/api/core/admin/policies?limit=1`,
      cookieHeader
    ),
  ]);

  const hasPolicies =
    policiesRes.ok && typeof policiesRes.data?.total === "number" && policiesRes.data.total > 0;
  const hasAnySystems = systemsCoverage.covered > 0;
  const hasAllSystems =
    systemsCoverage.total > 0 && systemsCoverage.covered === systemsCoverage.total;
  const systemCoverage = hasAllSystems ? "complete" : hasAnySystems ? "partial" : "none";
  const hasAnyRequirements = requirementsCoverage.covered > 0;
  const hasAllRequirements =
    requirementsCoverage.total > 0 &&
    requirementsCoverage.covered === requirementsCoverage.total;
  const requirementsStatus = hasAllRequirements
    ? "complete"
    : hasAnyRequirements
    ? "partial"
    : "none";
  const hasAnyControls = controlsCoverage.covered > 0;
  const hasAllControls =
    controlsCoverage.total > 0 && controlsCoverage.covered === controlsCoverage.total;
  const controlsStatus = hasAllControls
    ? "complete"
    : hasAnyControls
    ? "partial"
    : "none";

  const stepsBase = [
    {
      key: "entity",
      label: t("steps.entity"),
      href: `${prefix}/scorecard/admin/governance-setup/entity-setup`,
      complete: true,
    },
    {
      key: "legalStanding",
      label: t("steps.legalStanding"),
      href: legalStandingHref,
      complete: true,
    },
    {
      key: "project",
      label: t("steps.project"),
      href: `${prefix}/projects/register`,
      complete: projectSlugs.length > 0,
    },
    {
      key: "system",
      label: t("steps.system"),
      href: `${prefix}/scorecard/admin/governance-setup/ai-system-register`,
      complete: hasAllSystems,
    },
    {
      key: "kpi",
      label: t("steps.kpi"),
      href: `${prefix}/scorecard/admin/governance-setup/ai-requirements-register`,
      complete: hasAllRequirements,
    },
    {
      key: "control",
      label: t("steps.control"),
      href: `${prefix}/scorecard/admin/governance-setup/control-register`,
      complete: controlsStatus === "complete",
    },
  ];

  let unlock = true;
  const steps: Step[] = stepsBase.map((step) => {
    let enabled = unlock;
    if (step.key === "kpi" && hasAnySystems) {
      enabled = true;
    }
    const blocksNext =
      step.key === "system"
        ? systemCoverage === "none"
        : step.key === "kpi"
        ? requirementsStatus === "none"
        : !step.complete;
    if (blocksNext) {
      unlock = false;
    }
    return { ...step, enabled };
  });

  const allComplete = steps.every((step) => step.complete);

  const kicker = t("kicker");
  const heading = t("heading");
  const showHeading = kicker.trim().toLowerCase() !== heading.trim().toLowerCase();
  const subheading = t("subheading");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {kicker}
      </div>
      {showHeading && (
        <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {heading}
        </h2>
      )}
      {subheading.trim().length > 0 && (
        <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {subheading}
        </p>
      )}
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {t("description")}
      </p>
      <ol className="mt-5 space-y-3">
        {steps.map((step) => (
          <li
            key={step.key}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
              step.complete
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-100"
                : step.enabled
                ? "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                : "border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-500"
            }`}
          >
            <div className="flex items-center gap-3">
              {step.enabled ? (
                <Link
                  href={step.href}
                  className="font-medium underline decoration-transparent transition hover:decoration-current"
                >
                  {step.label}
                </Link>
              ) : (
                <span className="font-medium">{step.label}</span>
              )}
            </div>
            {step.key === "system" ? (
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  systemCoverage === "complete"
                    ? "text-emerald-600 dark:text-emerald-300"
                    : systemCoverage === "partial"
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-rose-600 dark:text-rose-300"
                }`}
              >
                {systemCoverage === "complete"
                  ? t("systemStatus.complete")
                  : systemCoverage === "partial"
                  ? t("systemStatus.partial")
                  : t("systemStatus.none")}
              </span>
            ) : step.key === "kpi" ? (
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  requirementsStatus === "complete"
                    ? "text-emerald-600 dark:text-emerald-300"
                    : requirementsStatus === "partial"
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-rose-600 dark:text-rose-300"
                }`}
              >
                {requirementsStatus === "complete"
                  ? t("requirementsStatus.complete")
                  : requirementsStatus === "partial"
                  ? t("requirementsStatus.partial")
                  : t("requirementsStatus.none")}
              </span>
            ) : step.key === "control" ? (
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${
                  controlsStatus === "complete"
                    ? "text-emerald-600 dark:text-emerald-300"
                    : controlsStatus === "partial"
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-rose-600 dark:text-rose-300"
                }`}
              >
                {controlsStatus === "complete"
                  ? t("status.done")
                  : controlsStatus === "partial"
                  ? t("controlStatus.partial")
                  : t("controlStatus.none")}
              </span>
            ) : step.complete ? (
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
                {t("status.done")}
              </span>
            ) : step.enabled ? (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t("status.inProgress")}
              </span>
            ) : step.key === "kpi" && systemCoverage === "none" ? (
              <span className="text-xs font-medium text-slate-400">
                {t("kpiLockedNoSystems")}
              </span>
            ) : step.key === "control" && requirementsStatus === "none" ? (
              <span className="text-xs font-medium text-slate-400">
                {t("controlLockedNoRequirements")}
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-400">
                {t("status.locked")}
              </span>
            )}
          </li>
        ))}
      </ol>
      {allComplete && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-100">
          <p className="text-sm font-semibold">{t("completeTitle")}</p>
          <p className="mt-1 text-sm">{t("completeBody")}</p>
          <div className="mt-3">
            <Link
              href={`${prefix}/scorecard/admin/governance-execution`}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              {t("completeCta")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
