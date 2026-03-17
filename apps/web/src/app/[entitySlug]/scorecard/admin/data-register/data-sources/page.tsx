import { validateEntityAccess } from "@/lib/entityScopedPage";
import DataSourcesPage from "@/app/scorecard/admin/data-manager/data-sources/page";

export default async function EntityDataRegisterDataSourcesPage(
  props: { params: Promise<{ entitySlug: string }> }
) {
  const { entitySlug } = await props.params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/data-manager/data-sources",
    fallbackRedirect: "/scorecard/admin/data-register/data-sources",
    callbackPath: "/scorecard/admin/data-register/data-sources",
    redirectToFirstPath: "/scorecard/admin/data-register/data-sources",
  });
  return <DataSourcesPage />;
}
