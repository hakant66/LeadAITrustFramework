import { validateEntityAccess } from "@/lib/entityScopedPage";
import SafetyAxisPage from "@/app/scorecard/admin/trustops/axes/safety/page";

export default async function EntityControlAuditAxesSafetyPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/axes/safety",
    fallbackRedirect: "/scorecard/admin/control-audit/axes/safety",
    callbackPath: "/scorecard/admin/control-audit/axes/safety",
    redirectToFirstPath: "/scorecard/admin/control-audit/axes/safety",
  });
  return <SafetyAxisPage />;
}
