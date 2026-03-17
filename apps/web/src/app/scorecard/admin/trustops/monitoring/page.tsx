import Header from "@/app/(components)/Header";
import DataManagerModal from "@/app/(components)/DataManagerModal";
import { resolveNavMode } from "@/lib/navMode";

export default function TrustMonitoringPage() {
  const navMode = resolveNavMode();
  const subtitle =
    navMode === "legacy" ? "LeadAI · TrustOps" : "LeadAI · Control & Audit";
  return (
    <div className="space-y-6">
      <Header title="Trust Monitoring" subtitle={subtitle} />
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <DataManagerModal
          open={true}
          embedded={true}
          showHeader={false}
          showTabs={false}
          initialTab="trust-monitoring"
          allowedTabs={["trust-monitoring"]}
        />
      </div>
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        Remediation queue is coming next. Signals resolved here will automatically restore scores.
      </section>
    </div>
  );
}
