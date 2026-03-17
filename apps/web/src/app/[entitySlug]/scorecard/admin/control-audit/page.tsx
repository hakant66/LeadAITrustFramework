import { validateEntityAccess } from "@/lib/entityScopedPage";
import TrustOpsOverviewPage from "@/app/scorecard/admin/trustops/page";

export default async function EntityControlAuditPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops",
    fallbackRedirect: "/scorecard/admin/control-audit",
    callbackPath: "/scorecard/admin/control-audit",
    redirectToFirstPath: "/scorecard/admin/control-audit",
  });
  return <TrustOpsOverviewPage />;
}
