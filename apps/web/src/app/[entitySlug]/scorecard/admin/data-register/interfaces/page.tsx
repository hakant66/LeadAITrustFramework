import { validateEntityAccess } from "@/lib/entityScopedPage";
import InterfacesPage from "@/app/scorecard/admin/data-register/interfaces/page";

export default async function EntityDataRegisterInterfacesPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    fallbackRedirect: "/scorecard/admin/data-register/interfaces",
    callbackPath: "/scorecard/admin/data-register/interfaces",
    redirectToFirstPath: "/scorecard/admin/data-register/interfaces",
  });
  return <InterfacesPage />;
}
