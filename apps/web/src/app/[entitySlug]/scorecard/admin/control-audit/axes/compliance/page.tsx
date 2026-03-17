import { validateEntityAccess } from "@/lib/entityScopedPage";
import ComplianceAxisPage from "@/app/scorecard/admin/trustops/axes/compliance/page";

export default async function EntityControlAuditAxesCompliancePage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/axes/compliance",
    fallbackRedirect: "/scorecard/admin/control-audit/axes/compliance",
    callbackPath: "/scorecard/admin/control-audit/axes/compliance",
    redirectToFirstPath: "/scorecard/admin/control-audit/axes/compliance",
  });
  return <ComplianceAxisPage />;
}
