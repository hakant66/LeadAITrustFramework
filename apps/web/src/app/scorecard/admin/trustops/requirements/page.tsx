import Header from "@/app/(components)/Header";
import DataManagerModal from "@/app/(components)/DataManagerModal";
import { resolveNavMode } from "@/lib/navMode";

type AssessmentSummary = {
  primaryRole?: string | null;
  riskClassification?: string | null;
  decisionTrace?: string | null;
};

const toTitleCase = (value?: string | null) => {
  if (!value) return "—";
  const words = value.replace(/[-_]+/g, " ").trim().split(/\s+/);
  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "ai") return "AI";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
};

export default function RequirementRegisterPage({
  assessment,
  entityId,
}: {
  assessment?: AssessmentSummary | null;
  entityId?: string | null;
}) {
  const navMode = resolveNavMode();
  const subtitle =
    navMode === "legacy" ? "LeadAI · TrustOps" : "Governance Setup";
  const title =
    navMode === "legacy"
      ? "Requirement Register"
      : "KPI Register";
  const decisionItems =
    assessment?.decisionTrace
      ?.split(/\r?\n+/)
      .map((item) => item.trim())
      .filter(Boolean) ?? [];
  return (
    <div className="space-y-6">
      <Header title={title} subtitle={subtitle} titleNote="Step 5 of 6" />
      {assessment && (
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Assessment Snapshot
              </p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                AI Legal Standing Result for EU AI ACT
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Primary Role, Risk Classification, and Decision Trace are set from
                the AI Legal Standing assessment and cannot be changed here.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              Read-only
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Primary Role
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {toTitleCase(assessment.primaryRole)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Risk Classification
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {toTitleCase(assessment.riskClassification)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Decision Trace
              </p>
              {decisionItems.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {decisionItems.map((item, idx) => (
                    <li key={`${item}-${idx}`} className="flex gap-2">
                      <span className="mt-[2px] h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  —
                </p>
              )}
            </div>
          </div>
        </section>
      )}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <DataManagerModal
          open={true}
          embedded={true}
          showHeader={false}
          showTabs={false}
          initialTab="requirements"
          allowedTabs={["requirements"]}
          requirementsAssessment={assessment}
          entityId={entityId ?? undefined}
        />
      </div>
    </div>
  );
}
