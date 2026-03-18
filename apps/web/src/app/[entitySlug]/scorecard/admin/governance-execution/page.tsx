import { cookies } from "next/headers";
import { validateEntityAccess, type UserEntity } from "@/lib/entityScopedPage";
import GovernanceDashboardLanding from "@/app/scorecard/admin/governance-dashboard-reporting/GovernanceDashboardLanding";

export default async function EntityGovernanceExecutionPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const entity = await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin",
    fallbackRedirect: "/scorecard/admin/governance-execution",
    callbackPath: "/scorecard/admin/governance-execution",
    redirectToFirstPath: "/scorecard/admin/governance-execution",
  });

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };
  const entitiesRes = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
  const entities: UserEntity[] = entitiesRes.ok ? await entitiesRes.json() : [entity];
  const basePath = `/${encodeURIComponent(entitySlug)}`;

  const executionMenuItems: Array<{ label: string; href: string }> = [];
  executionMenuItems.push({
    label: "Projects - The Work",
    href: `${basePath}/projects/view`,
  });
  executionMenuItems.push({
    label: "Assignment - The Action",
    href: `${basePath}/scorecard/admin/governance-execution/action-assignment`,
  });

  executionMenuItems.push({
    label: "Evidence - The Proof",
    href: `${basePath}/scorecard/admin/governance-execution/evidence-capture`,
  });

  return (
    <GovernanceDashboardLanding
      dashboardPath="dashboard"
      entitySlug={entitySlug}
      entityId={entity.entity_id}
      entities={entities}
      showAlerts={false}
      showProjectCards={false}
      titleOverride="AI Governance Operation"
      subtitleOverride="Governance Execution"
      hideEntityBadge
      hideSignOut
      executionMenuItems={executionMenuItems}
    />
  );
}
