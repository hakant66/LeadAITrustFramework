import { validateEntityAccess } from "@/lib/entityScopedPage";
import TrustMonitoringPage from "@/app/scorecard/admin/trustops/monitoring/page";

export default async function EntityControlAuditMonitoringPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/monitoring",
    fallbackRedirect: "/scorecard/admin/control-audit/monitoring",
    callbackPath: "/scorecard/admin/control-audit/monitoring",
    redirectToFirstPath: "/scorecard/admin/control-audit/monitoring",
  });
  return <TrustMonitoringPage />;
}
