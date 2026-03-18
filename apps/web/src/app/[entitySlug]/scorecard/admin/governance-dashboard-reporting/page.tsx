import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import { SINGLE_TENANT_UI } from "@/lib/singleTenant";
import GovernanceDashboardLanding from "@/app/scorecard/admin/governance-dashboard-reporting/GovernanceDashboardLanding";

type UserEntity = { entity_id: string; role: string; name: string; slug: string; status: string | null };

/**
 * Entity-scoped governance dashboard: /{entitySlug}/scorecard/admin/governance-dashboard-reporting
 * Validates user has access to the entity and renders the dashboard with entity_id in API calls.
 */
export default async function EntityGovernanceDashboardReportingPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
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

  // Check if user is master admin
  const masterAdminRes = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/is-master-admin`, headers);
  const isMasterAdmin = masterAdminRes.ok && (await masterAdminRes.json()) === true;

  const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
  if (!res.ok) {
    if (res.status === 401) {
      redirect(
        "/register?callbackUrl=" + encodeURIComponent(`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-dashboard-reporting`)
      );
    }
    redirect("/scorecard/admin/governance-dashboard-reporting");
  }

  const entities = (await res.json()) as UserEntity[];
  let entity = entities.find((e) => e.slug === entitySlug);

  // In single-tenant mode, trust the URL slug even if user_entity_access is stale or filtered.
  if (!entity && (isMasterAdmin || SINGLE_TENANT_UI)) {
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
    if (SINGLE_TENANT_UI) {
      redirect(`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/entity-setup`);
    }
    const first = entities[0];
    if (first) {
      redirect(`/${encodeURIComponent(first.slug)}/scorecard/admin/governance-dashboard-reporting`);
    }
    redirect("/scorecard/admin/governance-dashboard-reporting");
  }

  return (
    <GovernanceDashboardLanding
      dashboardPath="vipdashboard"
      entitySlug={entitySlug}
      entityId={entity.entity_id}
      entities={entities}
      showExecutiveMenu
      subtitleOverride="Executive Reporting"
    />
  );
}
