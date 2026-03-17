import { validateEntityAccess } from "@/lib/entityScopedPage";
import TrustSnapshotsPage from "@/app/scorecard/admin/trustops/snapshots/page";

export default async function EntityControlAuditSnapshotsPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/snapshots",
    fallbackRedirect: "/scorecard/admin/control-audit/snapshots",
    callbackPath: "/scorecard/admin/control-audit/snapshots",
    redirectToFirstPath: "/scorecard/admin/control-audit/snapshots",
  });
  return <TrustSnapshotsPage />;
}
