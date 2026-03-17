import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import TrustSnapshotsPage from "@/app/scorecard/admin/trustops/snapshots/page";

export default function ControlAuditSnapshotsPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/snapshots");
  }
  return <TrustSnapshotsPage />;
}
