import Header from "@/app/(components)/Header";
import DataManagerModal from "@/app/(components)/DataManagerModal";
import { resolveNavMode } from "@/lib/navMode";

export default function ProvenanceLineagePage() {
  const navMode = resolveNavMode();
  const subtitle =
    navMode === "legacy" ? "LeadAI · TrustOps" : "LeadAI · Control & Audit";
  return (
    <div className="space-y-6">
      <Header title="Provenance & Lineage" subtitle={subtitle} />
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          View:
        </span>
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200">
          Lineage Table
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800">
          Graph (coming soon)
        </span>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <DataManagerModal
          open={true}
          embedded={true}
          showHeader={false}
          showTabs={false}
          initialTab="provenance"
          allowedTabs={["provenance"]}
        />
      </div>
    </div>
  );
}
