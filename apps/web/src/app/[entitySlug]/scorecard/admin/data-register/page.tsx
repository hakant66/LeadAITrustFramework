import { validateEntityAccess } from "@/lib/entityScopedPage";
import DataManagerLandingPage from "@/app/scorecard/admin/data-manager/page";

export default async function EntityDataRegisterPage(
  props: { params: Promise<{ entitySlug: string }> }
) {
  const { entitySlug } = await props.params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/data-manager",
    fallbackRedirect: "/scorecard/admin/data-register",
    callbackPath: "/scorecard/admin/data-register",
    redirectToFirstPath: "/scorecard/admin/data-register",
  });
  return <DataManagerLandingPage />;
}
