import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import AuditLogPage from "@/app/scorecard/admin/trustops/audit/page";

export default function ControlAuditAuditPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/audit");
  }
  return <AuditLogPage />;
}
