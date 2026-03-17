import { validateEntityAccess } from "@/lib/entityScopedPage";
import TrustAxesIndex from "@/app/scorecard/admin/trustops/axes/page";

export default async function EntityControlAuditAxesPage(
  props: { params: Promise<{ entitySlug: string }> }
) {
  const { entitySlug } = await props.params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/axes",
    fallbackRedirect: "/scorecard/admin/control-audit/axes",
    callbackPath: "/scorecard/admin/control-audit/axes",
    redirectToFirstPath: "/scorecard/admin/control-audit/axes",
  });
  return <TrustAxesIndex />;
}
