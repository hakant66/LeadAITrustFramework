import Header from "@/app/(components)/Header";
import Link from "next/link";
import { cookies } from "next/headers";
import { validateEntityAccess } from "@/lib/entityScopedPage";
import { getTranslations } from "next-intl/server";
import ActionAssignmentTableClient, {
  type ActionAssignmentRow,
} from "@/app/(components)/ActionAssignmentTableClient";

type ControlExecRow = ActionAssignmentRow;

type Project = {
  slug: string;
  name?: string | null;
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

export default async function ActionAssignmentProjectPage({
  params,
}: {
  params: Promise<{ entitySlug: string; projectSlug: string }>;
}) {
  const { entitySlug, projectSlug } = await params;
  const t = await getTranslations("ActionAssignmentPage");
  const entity = await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin",
    fallbackRedirect: "/scorecard/admin/governance-execution",
    callbackPath: `/scorecard/admin/governance-execution/action-assignment/${encodeURIComponent(
      projectSlug
    )}`,
    redirectToFirstPath: "/scorecard/admin/governance-execution/action-assignment",
  });

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const entityId = entity.entity_id;
  const prefix = `/${encodeURIComponent(entitySlug)}`;

  const [policyStatusRes, projectsRes, systemRes, requirementsRes, controlsRes] =
    await Promise.all([
      fetchJson<{ status?: string }>(
        `${appBase.replace(/\/+$/, "")}/api/core/admin/policies/finalize-status?entity_id=${encodeURIComponent(
          entityId
        )}`,
        cookieHeader
      ),
      fetchJson<Project[]>(
        `${appBase.replace(/\/+$/, "")}/api/core/projects?entity_id=${encodeURIComponent(
          entityId
        )}`,
        cookieHeader
      ),
      fetchJson<{ total?: number; items?: unknown[] }>(
        `${appBase.replace(
          /\/+$/,
          ""
        )}/api/core/admin/ai-systems?limit=1&project_slug=${encodeURIComponent(
          projectSlug
        )}&entity_id=${encodeURIComponent(entityId)}`,
        cookieHeader
      ),
      fetchJson<{ total?: number }>(
        `${appBase.replace(
          /\/+$/,
          ""
        )}/api/core/admin/requirements?limit=1&project_slug=${encodeURIComponent(
          projectSlug
        )}&entity_id=${encodeURIComponent(entityId)}`,
        cookieHeader
      ),
      fetchJson<{ items?: ControlExecRow[] }>(
        `${appBase.replace(/\/+$/, "")}/api/core/admin/projects/${encodeURIComponent(
          projectSlug
        )}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`,
        cookieHeader
      ),
    ]);

  const policyFinalised = policyStatusRes.ok && policyStatusRes.data?.status === "finalised";
  const projects = projectsRes.ok && Array.isArray(projectsRes.data) ? projectsRes.data : [];
  const project = projects.find((p) => p.slug === projectSlug);
  const projectName = project?.name ?? projectSlug;

  const hasSystem = Boolean(
    systemRes.ok &&
      ((Array.isArray(systemRes.data?.items) && systemRes.data.items.length > 0) ||
        Number(systemRes.data?.total ?? 0) > 0)
  );
  const hasRequirements = Boolean(requirementsRes.ok && Number(requirementsRes.data?.total ?? 0) > 0);
  const controlRows = controlsRes.ok && Array.isArray(controlsRes.data?.items) ? controlsRes.data?.items ?? [] : [];
  const hasControls = controlRows.length > 0;

  const isFinalised = policyFinalised && hasSystem && hasRequirements && hasControls;

  const summary = controlRows.reduce(
    (acc, row) => {
      const ownerAssigned = Boolean(row.designated_owner_name || row.owner_role);
      const targetDefined = Boolean(row.target_text);
      const mechanismActivated = Boolean(row.evidence_source);
      const evidenceField = Boolean(row.evidence_status);
      acc.total += 1;
      if (ownerAssigned) acc.owner += 1;
      if (targetDefined) acc.target += 1;
      if (mechanismActivated) acc.mechanism += 1;
      if (evidenceField) acc.evidence += 1;
      return acc;
    },
    { total: 0, owner: 0, target: 0, mechanism: 0, evidence: 0 }
  );

  return (
    <div className="space-y-6">
      <Header title={t("title")} subtitle={t("subtitle")} titleNote={`${t("projectLabel")}: ${projectName}`} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-500 dark:text-slate-300">
          Project: <span className="font-semibold text-slate-900 dark:text-slate-100">{projectName}</span>
        </div>
        <Link
          href={`${prefix}/scorecard/admin/governance-execution/action-assignment`}
          className="text-xs font-semibold uppercase tracking-wide text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
        >
          {t("backToList")}
        </Link>
      </div>

      {!isFinalised && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-100">
          <div className="font-semibold">{t("projectNotReadyTitle")}</div>
          <div className="mt-1">{t("projectNotReadyBody")}</div>
          <div className="mt-3 text-xs">
            Checks:
            {" "}
            policy finalised={policyFinalised ? "yes" : "no"}; system={hasSystem ? "yes" : "no"}; requirements=
            {hasRequirements ? "yes" : "no"}; controls={hasControls ? "yes" : "no"}
          </div>
        </div>
      )}

      {isFinalised && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: t("summary.total"), value: summary.total },
              { label: t("summary.ownerAssigned"), value: summary.owner },
              { label: t("summary.targetDefined"), value: summary.target },
              { label: t("summary.measurementActivated"), value: summary.mechanism },
              { label: t("summary.evidenceField"), value: summary.evidence },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <div className="text-xs uppercase tracking-wide text-slate-500">{card.label}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("tableTitle")}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t("tableSubtitle")}
              </div>
            </div>
            <ActionAssignmentTableClient
              rows={controlRows}
              entityId={entityId}
              projectSlug={projectSlug}
              entitySlug={entitySlug}
            />
          </div>
        </>
      )}
    </div>
  );
}
