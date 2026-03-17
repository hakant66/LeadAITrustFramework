import { validateEntityAccess } from "@/lib/entityScopedPage";
import EvidenceVaultPage from "@/app/scorecard/admin/trustops/evidence/page";

export default async function EntityControlAuditEvidencePage(
  props: { params: Promise<{ entitySlug: string }> }
) {
  const { entitySlug } = await props.params;
  const entity = await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/evidence",
    fallbackRedirect: "/scorecard/admin/control-audit/evidence",
    callbackPath: "/scorecard/admin/control-audit/evidence",
    redirectToFirstPath: "/scorecard/admin/control-audit/evidence",
  });
  return <EvidenceVaultPage entityId={entity.entity_id} />;
}
