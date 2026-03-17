import Header from "@/app/(components)/Header";
import DataManagerModal from "@/app/(components)/DataManagerModal";
import { resolveNavMode } from "@/lib/navMode";

export default function DataQualityPage() {
  const navMode = resolveNavMode();
  const title = navMode === "legacy" ? "Data Quality" : "AI Control Register";
  const subtitle =
    navMode === "legacy"
      ? "LeadAI · Data Manager"
      : "LeadAI · Governance Setup";
  const allowedTabs = navMode === "legacy" ? ["kpis", "controls"] : ["controls"];
  const initialTab = navMode === "legacy" ? "kpis" : "controls";
  return (
    <div className="space-y-6">
      <Header title={title} subtitle={subtitle} />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <DataManagerModal
          open={true}
          embedded={true}
          showHeader={false}
          initialTab={initialTab}
          allowedTabs={allowedTabs}
        />
      </div>
    </div>
  );
}
