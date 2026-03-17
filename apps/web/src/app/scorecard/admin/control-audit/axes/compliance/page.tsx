import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import ComplianceAxisPage from "@/app/scorecard/admin/trustops/axes/compliance/page";

export default function ControlAuditComplianceAxisPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/axes/compliance");
  }
  return <ComplianceAxisPage />;
}
