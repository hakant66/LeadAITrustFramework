import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

export default async function GovernanceKpiRegisterPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/data-manager/data-quality");
  }
  redirect("/scorecard/admin/governance-setup/control-register");
  return null;
}
