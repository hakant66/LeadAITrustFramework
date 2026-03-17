import { validateEntityAccess } from "@/lib/entityScopedPage";
import AlertsPage from "@/app/scorecard/admin/alerts/page";

/**
 * Entity-scoped Intelligent Alerts & Trends: /{entitySlug}/scorecard/admin/alerts
 * Validates user has access to the entity and renders the alerts page.
 */
export default async function EntityAlertsPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    fallbackRedirect: "/scorecard/admin/alerts",
    callbackPath: "/scorecard/admin/alerts",
    redirectToFirstPath: "/scorecard/admin/alerts",
  });
  return <AlertsPage />;
}
