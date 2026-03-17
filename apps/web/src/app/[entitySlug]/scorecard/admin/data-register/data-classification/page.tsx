import { validateEntityAccess } from "@/lib/entityScopedPage";
import DataClassificationPage from "@/app/scorecard/admin/data-manager/data-classification/page";

export default async function EntityDataRegisterDataClassificationPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/data-manager/data-classification",
    fallbackRedirect: "/scorecard/admin/data-register/data-classification",
    callbackPath: "/scorecard/admin/data-register/data-classification",
    redirectToFirstPath: "/scorecard/admin/data-register/data-classification",
  });
  return <DataClassificationPage />;
}
