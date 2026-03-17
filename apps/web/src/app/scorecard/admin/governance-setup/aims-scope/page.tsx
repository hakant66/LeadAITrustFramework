import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import AimsScopePage from "@/app/scorecard/admin/trustops/aims-scope/page";

export default function GovernanceAimsScopePage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/aims-scope");
  }
  return <AimsScopePage />;
}
