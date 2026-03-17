import Header from "@/app/(components)/Header";
import GovernanceJourneyCard from "@/app/(components)/GovernanceJourneyCard";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

export default function GovernanceSetupLandingPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops");
  }
  return (
    <div className="space-y-6">
      <Header title="AI Governance Setup" subtitle="LeadAI · Governance Setup">
        <div className="flex gap-3">
          <Link
            href="/"
            className="mt-2 inline-flex items-center px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-600 text-sm font-medium shadow-sm transition hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Sign Out
          </Link>
        </div>
      </Header>
      <section>
        <GovernanceJourneyCard />
      </section>
    </div>
  );
}
