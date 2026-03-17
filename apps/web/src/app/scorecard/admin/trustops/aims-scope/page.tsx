import Header from "@/app/(components)/Header";
import DataManagerModal from "@/app/(components)/DataManagerModal";
import { resolveNavMode } from "@/lib/navMode";

export default function AimsScopePage() {
  const navMode = resolveNavMode();
  const subtitle =
    navMode === "legacy" ? "LeadAI · TrustOps" : "LeadAI · Governance Setup";
  return (
    <div className="space-y-6">
      <Header title="Scope" subtitle={subtitle} />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <DataManagerModal
          open={true}
          embedded={true}
          showHeader={false}
          showTabs={false}
          initialTab="aims-scope"
          allowedTabs={["aims-scope"]}
        />
      </div>
    </div>
  );
}
