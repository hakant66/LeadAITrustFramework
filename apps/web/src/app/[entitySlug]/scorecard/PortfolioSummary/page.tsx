import { cookies } from "next/headers";
import { validateEntityAccess, type UserEntity } from "@/lib/entityScopedPage";
import GovernanceDashboardLanding from "@/app/scorecard/admin/governance-dashboard-reporting/GovernanceDashboardLanding";

export default async function EntityPortfolioSummaryPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const entity = await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard",
    fallbackRedirect: "/scorecard/PortfolioSummary",
    callbackPath: "/scorecard/PortfolioSummary",
    redirectToFirstPath: "/scorecard/PortfolioSummary",
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

  return (
    <GovernanceDashboardLanding
      dashboardPath="vipdashboard"
      entitySlug={entitySlug}
      entityId={entity.entity_id}
      entities={entities}
      showAlerts
      headerVariant="back-entity"
      titleOverride="Portfolio of AI Projects"
      showProjectCards={false}
    />
  );
}
