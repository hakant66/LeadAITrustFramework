import Header from "@/app/(components)/Header";
import DataManagerModal from "@/app/(components)/DataManagerModal";
import FinalizePolicyRegisterButton from "@/app/(components)/FinalizePolicyRegisterButton";
import { resolveNavMode } from "@/lib/navMode";

export default function PolicyManagerPage({
  entityId,
  entitySlug,
}: {
  entityId?: string;
  entitySlug?: string;
}) {
  const navMode = resolveNavMode();
  const subtitle =
    navMode === "legacy" ? "LeadAI · TrustOps" : "LeadAI · Governance Setup";
  const title = navMode === "legacy" ? "Policy Manager" : "AI Policy Register";
  return (
    <div className="space-y-6">
      <Header title={title} subtitle={subtitle} />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <DataManagerModal
          open={true}
          embedded={true}
          showHeader={false}
          showTabs={false}
          initialTab="policies"
          allowedTabs={["policies"]}
          entityId={entityId}
          entitySlug={entitySlug}
        />
      </div>
      {entityId && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          <FinalizePolicyRegisterButton entityId={entityId} entitySlug={entitySlug} />
        </div>
      )}
    </div>
  );
}
