import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import EvidenceVaultPage from "@/app/scorecard/admin/trustops/evidence/page";

export default function ControlAuditEvidencePage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/evidence");
  }
  return <EvidenceVaultPage />;
}
