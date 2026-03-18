import Header from "@/app/(components)/Header";
import DataManagerModal from "@/app/(components)/DataManagerModal";
import { resolveNavMode } from "@/lib/navMode";

export default function EvidenceVaultPage({ entityId }: { entityId?: string } = {}) {
  const navMode = resolveNavMode();
  const subtitle = navMode === "legacy" ? "LeadAI · TrustOps" : "Control & Audit";
  return (
    <div className="space-y-6">
      <Header title="Evidence Vault" subtitle={subtitle} />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <DataManagerModal
          open={true}
          embedded={true}
          showHeader={false}
          showTabs={false}
          initialTab="evidences"
          allowedTabs={["evidences"]}
          entityId={entityId}
        />
      </div>
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Evidence detail drawer and audit history will appear here once selection
        state is wired to the table.
      </section>
    </div>
  );
}
