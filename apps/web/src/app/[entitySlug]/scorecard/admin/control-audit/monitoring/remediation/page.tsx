import { validateEntityAccess } from "@/lib/entityScopedPage";
import RemediationPage from "@/app/scorecard/admin/trustops/monitoring/remediation/page";

export default async function EntityControlAuditMonitoringRemediationPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/monitoring/remediation",
    fallbackRedirect: "/scorecard/admin/control-audit/monitoring",
    callbackPath: "/scorecard/admin/control-audit/monitoring/remediation",
    redirectToFirstPath: "/scorecard/admin/control-audit/monitoring/remediation",
  });
  return <RemediationPage />;
}
