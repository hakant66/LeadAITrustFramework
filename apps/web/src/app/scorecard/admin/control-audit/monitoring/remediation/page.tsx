import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

export default function ControlAuditRemediationRedirect() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/monitoring/remediation");
  }
  redirect("/scorecard/admin/control-audit/monitoring");
}
