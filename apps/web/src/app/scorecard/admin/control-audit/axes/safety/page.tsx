import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import SafetyAxisPage from "@/app/scorecard/admin/trustops/axes/safety/page";

export default function ControlAuditSafetyAxisPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/axes/safety");
  }
  return <SafetyAxisPage />;
}
