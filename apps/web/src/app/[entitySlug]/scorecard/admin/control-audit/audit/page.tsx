import { validateEntityAccess } from "@/lib/entityScopedPage";
import AuditLogPage from "@/app/scorecard/admin/trustops/audit/page";

export default async function EntityControlAuditAuditPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/audit",
    fallbackRedirect: "/scorecard/admin/control-audit/audit",
    callbackPath: "/scorecard/admin/control-audit/audit",
    redirectToFirstPath: "/scorecard/admin/control-audit/audit",
  });
  return <AuditLogPage />;
}
