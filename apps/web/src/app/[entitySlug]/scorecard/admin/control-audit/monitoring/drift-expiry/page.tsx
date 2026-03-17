import { validateEntityAccess } from "@/lib/entityScopedPage";
import DriftExpiryPage from "@/app/scorecard/admin/trustops/monitoring/drift-expiry/page";

export default async function EntityControlAuditMonitoringDriftExpiryPage(
  props: { params: Promise<{ entitySlug: string }> }
) {
  const { entitySlug } = await props.params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/monitoring/drift-expiry",
    fallbackRedirect: "/scorecard/admin/control-audit/monitoring",
    callbackPath: "/scorecard/admin/control-audit/monitoring/drift-expiry",
    redirectToFirstPath: "/scorecard/admin/control-audit/monitoring/drift-expiry",
  });
  return <DriftExpiryPage />;
}
