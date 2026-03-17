// src/app/scorecard/[projectId]/dashboard/edit/page.tsx
import { cookies } from "next/headers";
import EditKpis from "@/app/(components)/EditKpis";
import EditPillars from "@/app/(components)/EditPillars";
import DashboardHeader from "@/app/(components)/DashboardHeader";
import ArchivedProjectNotice from "@/app/(components)/ArchivedProjectNotice";

// browser tab wording
export const metadata = {
  title: "LeadAI · Performance metrics",
};

type ScorecardPayload = {
  project: { slug: string; name: string; target_threshold: number };
  pillars: {
    pillar: string;
    score_pct: number;
    weight: number;
    maturity: number;
  }[];
  kpis: {
    pillar?: string | null;
    key: string;
    name: string;
    unit?: string | null;
    raw_value?: number | null;
    normalized_pct: number;
  }[];
  overall_pct: number;
};

export const dynamic = "force-dynamic";

export default async function EditScorecardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const res = await fetch(
    `${appUrl.replace(/\/+$/, "")}/api/core/scorecard/${encodeURIComponent(projectId)}`,
    { cache: "no-store", headers: { Cookie: cookieStore.toString() } }
  );
  if (res.status === 410) {
    return (
      <ArchivedProjectNotice
        projectId={projectId}
        subtitle="LeadAI · Performance Metrics"
      />
    );
  }
  if (!res.ok) {
    throw new Error(
      `Failed to load scorecard for ${projectId}: ${res.status}`,
    );
  }

  const data = (await res.json()) as ScorecardPayload;
  const pillarsForEdit = (data.pillars ?? []).map((p) => ({
    ...p,
    // if your API already returns 0–100, remove the Math.round only if you want decimals
    score: Math.round(p.score_pct ?? 0),
  }));

  const projectSlug = data.project?.slug ?? projectId;
  const projectName = data.project?.name ?? projectSlug;
  const targetThreshold =
    typeof data.project?.target_threshold === "number"
      ? data.project.target_threshold
      : 0.75;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* Header reused; you can keep it or replace with a simpler one */}
        <DashboardHeader
          title={`Performance metrics — ${projectName}`}
          projectId={projectSlug}
          targetPct={Math.round(targetThreshold * 100)}
          overallPct={Math.round(data.overall_pct ?? 0)}
          pass={(data.overall_pct ?? 0) / 100 >= targetThreshold}
        />

        {/* Small tab bar right below the header */}
        <nav className="mt-4 flex items-center gap-2 text-sm">
          <a
            href={`/scorecard/${projectSlug}/dashboard`}
            className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 bg-white dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800"
            title="Back to dashboard"
          >
            ← Dashboard
          </a>
          <span className="inline-flex items-center rounded-lg px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-100 dark:border-indigo-500/60">
            Performance metrics
          </span>
        </nav>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
            <div className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-2">
              Edit Pillars · Overview
            </div>
            <EditPillars projectId={projectSlug} initial={pillarsForEdit} />
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
            <div className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-2">
              AI Project Performance Management
            </div>
            <EditKpis projectId={projectSlug} kpis={data.kpis} />
          </div>
        </div>
      </div>
    </main>
  );
}
