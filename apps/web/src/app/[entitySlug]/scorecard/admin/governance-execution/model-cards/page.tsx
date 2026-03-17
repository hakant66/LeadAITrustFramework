import ModelCardsClient from "@/app/(components)/ModelCardsClient";
import { validateEntityAccess } from "@/lib/entityScopedPage";

export default async function ModelCardsPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const entity = await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin",
    fallbackRedirect: "/scorecard/admin/governance-execution",
    callbackPath: "/scorecard/admin/governance-execution/model-cards",
    redirectToFirstPath: "/scorecard/admin/governance-execution/model-cards",
  });

  return <ModelCardsClient entityId={entity.entity_id} />;
}
