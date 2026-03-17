import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

export default async function BoardLevelReportRedirectPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard");
  }

  redirect("/scorecard/admin/governance-dashboard-reporting/high-level-report");
}
