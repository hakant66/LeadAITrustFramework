import Header from "@/app/(components)/Header";
import DataManagerModal from "@/app/(components)/DataManagerModal";
import { resolveNavMode } from "@/lib/navMode";

export default function TrustRegistryPage() {
  const navMode = resolveNavMode();
  const subtitle =
    navMode === "legacy" ? "LeadAI · TrustOps" : "LeadAI · Governance Setup";
  const title = navMode === "legacy" ? "AI System Registry" : "AI System Register";
  return (
    <div className="space-y-6">
      <Header title={title} subtitle={subtitle} />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <DataManagerModal
          open={true}
          embedded={true}
          showHeader={false}
          showTabs={false}
          initialTab="registry"
          allowedTabs={["registry"]}
        />
      </div>
    </div>
  );
}
