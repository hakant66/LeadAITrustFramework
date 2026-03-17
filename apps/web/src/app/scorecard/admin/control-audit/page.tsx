import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import TrustOpsOverviewPage from "@/app/scorecard/admin/trustops/page";

export default function ControlAuditOverviewPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops");
  }
  return <TrustOpsOverviewPage />;
}
