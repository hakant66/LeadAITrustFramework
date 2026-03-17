import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

export default function ControlAuditDriftExpiryRedirect() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/monitoring/drift-expiry");
  }
  redirect("/scorecard/admin/control-audit/monitoring");
}
