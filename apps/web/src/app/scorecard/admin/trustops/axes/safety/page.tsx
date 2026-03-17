import Header from "@/app/(components)/Header";
import TrustAxisView from "@/app/(components)/TrustAxisView";
import { resolveNavMode } from "@/lib/navMode";

export default function SafetyAxisPage() {
  const navMode = resolveNavMode();
  const subtitle = navMode === "legacy" ? "LeadAI · TrustOps" : "LeadAI · Control & Audit";
  const basePath =
    navMode === "legacy"
      ? "/scorecard/admin/trustops"
      : "/scorecard/admin/control-audit";
  return (
    <div className="space-y-6">
      <Header title="Trust Axes" subtitle={subtitle} />
      <TrustAxisView axisKey="safety" basePath={basePath} />
    </div>
  );
}
