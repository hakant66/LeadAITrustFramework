import { validateEntityAccess } from "@/lib/entityScopedPage";
import DecayEventsPage from "@/app/scorecard/admin/trustops/monitoring/decay-events/page";

export default async function EntityControlAuditMonitoringDecayEventsPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  await validateEntityAccess(entitySlug, {
    legacyRedirect: "/scorecard/admin/trustops/monitoring/decay-events",
    fallbackRedirect: "/scorecard/admin/control-audit/monitoring",
    callbackPath: "/scorecard/admin/control-audit/monitoring/decay-events",
    redirectToFirstPath: "/scorecard/admin/control-audit/monitoring/decay-events",
  });
  return <DecayEventsPage />;
}
