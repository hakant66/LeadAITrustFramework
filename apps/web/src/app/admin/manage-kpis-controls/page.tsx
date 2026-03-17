import Header from "@/app/(components)/Header";
import DataManagerModal from "@/app/(components)/DataManagerModal";
import { resolveNavMode } from "@/lib/navMode";

export default function ManageKpisControlsPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    return null;
  }
  return (
    <div className="space-y-6">
      <Header title="Manage KPIs and Controls" subtitle="LeadAI · System Admin" />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <DataManagerModal
          open={true}
          embedded={true}
          showHeader={false}
          initialTab="kpis"
          allowedTabs={["kpis", "controls"]}
        />
      </div>
    </div>
  );
}
