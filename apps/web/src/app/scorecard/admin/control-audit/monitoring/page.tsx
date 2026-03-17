import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import TrustMonitoringPage from "@/app/scorecard/admin/trustops/monitoring/page";

export default function ControlAuditMonitoringPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/monitoring");
  }
  return <TrustMonitoringPage />;
}
