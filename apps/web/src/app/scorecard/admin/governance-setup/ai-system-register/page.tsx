import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import TrustRegistryPage from "@/app/scorecard/admin/trustops/registry/page";

export default function GovernanceSystemRegisterPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/registry");
  }
  return <TrustRegistryPage />;
}
