import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import TrustAxesIndex from "@/app/scorecard/admin/trustops/axes/page";

export default function ControlAuditAxesIndexPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/axes");
  }
  return <TrustAxesIndex />;
}
