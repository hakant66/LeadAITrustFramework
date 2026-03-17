import { validateEntityAccess } from "@/lib/entityScopedPage";
import ProvenanceLineagePage from "@/app/scorecard/admin/trustops/provenance/page";

export default async function EntityControlAuditProvenancePage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/provenance",
    fallbackRedirect: "/scorecard/admin/control-audit/provenance",
    callbackPath: "/scorecard/admin/control-audit/provenance",
    redirectToFirstPath: "/scorecard/admin/control-audit/provenance",
  });
  return <ProvenanceLineagePage />;
}
