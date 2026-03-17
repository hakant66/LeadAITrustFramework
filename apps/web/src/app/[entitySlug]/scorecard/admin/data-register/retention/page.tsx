import { validateEntityAccess } from "@/lib/entityScopedPage";
import RetentionDeletionPage from "@/app/scorecard/admin/data-manager/retention/page";

export default async function EntityDataRegisterRetentionPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/data-manager/retention",
    fallbackRedirect: "/scorecard/admin/data-register/retention",
    callbackPath: "/scorecard/admin/data-register/retention",
    redirectToFirstPath: "/scorecard/admin/data-register/retention",
  });
  return <RetentionDeletionPage />;
}
