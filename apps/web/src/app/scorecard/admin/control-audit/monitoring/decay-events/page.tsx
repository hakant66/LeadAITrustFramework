import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

export default function ControlAuditDecayEventsRedirect() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/monitoring/decay-events");
  }
  redirect("/scorecard/admin/control-audit/monitoring");
}
