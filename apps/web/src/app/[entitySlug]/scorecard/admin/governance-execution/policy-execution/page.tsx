import PolicyExecutionClient from "@/app/(components)/PolicyExecutionClient";
import { validateEntityAccess } from "@/lib/entityScopedPage";

export default async function PolicyExecutionPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const entity = await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin",
    fallbackRedirect: "/scorecard/admin/governance-execution",
    callbackPath: "/scorecard/admin/governance-execution/policy-execution",
    redirectToFirstPath: "/scorecard/admin/governance-execution/policy-execution",
  });

  return <PolicyExecutionClient entityId={entity.entity_id} />;
}
