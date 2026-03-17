import { validateEntityAccess } from "@/lib/entityScopedPage";
import ProvenanceAxisPage from "@/app/scorecard/admin/trustops/axes/provenance/page";

export default async function EntityControlAuditAxesProvenancePage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/axes/provenance",
    fallbackRedirect: "/scorecard/admin/control-audit/axes/provenance",
    callbackPath: "/scorecard/admin/control-audit/axes/provenance",
    redirectToFirstPath: "/scorecard/admin/control-audit/axes/provenance",
  });
  return <ProvenanceAxisPage />;
}
