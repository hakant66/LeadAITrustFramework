// apps/web/src/app/scorecard/[projectId]/report/page.tsx
import React from "react";
import Link from "next/link";
import Header from "@/app/(components)/Header";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { PdfReportButton } from "@/app/(components)/PdfReportButton";

export const revalidate = 15;

type ProjectReportResp = {
  project_slug: string;
  project_name: string;
  overall_score: number | null;
  pillar_scores: Record<string, number>;
  report_md: string;
};

async function fetchJsonOk<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

// Simple maturity mapping aligned with your dashboard:
//  < 40  -> Level 1
//  40-54 -> Level 2
//  55-69 -> Level 3
//  >=70  -> Level 4
function getMaturityLevel(score: number): { label: string; badgeClass: string } {
  if (score < 40) {
    return {
      label: "Level 1",
      badgeClass:
        "bg-red-100 text-red-800 border border-red-200 dark:bg-red-900/40 dark:text-red-100 dark:border-red-700",
    };
  }
  if (score < 55) {
    return {
      label: "Level 2",
      badgeClass:
        "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700",
    };
  }
  if (score < 70) {
    return {
      label: "Level 3",
      badgeClass:
        "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-700",
    };
  }
  return {
    label: "Level 4",
    badgeClass:
      "bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-700",
  };
}

export default async function ProjectReportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const base =
    process.env.NEXT_PUBLIC_CORE_SVC_URL ??
    process.env.CORE_SVC_URL ??
    "http://localhost:8001";

  const report = await fetchJsonOk<ProjectReportResp>(
    `${base}/admin/ai-reports/projects/${encodeURIComponent(
      projectId,
    )}/ai-summary`,
  );

  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <Header
          title="AI Project Report"
          subtitle={`Project: ${report.project_name}`}
        >
          <Link
            href={`/scorecard/${encodeURIComponent(projectId)}/dashboard`}
            className="
              inline-flex items-center h-9 px-3 rounded-xl border border-gray-200
              bg-white/60 text-indigo-700 hover:bg-white
              dark:border-slate-600 dark:bg-slate-900/60 dark:text-indigo-200 dark:hover:bg-slate-900
            "
          >
            Back to dashboard
          </Link>
        </Header>

        {/* High-level summary card */}
        <div
          className="
            mt-3 mb-4 border rounded-2xl bg-white shadow-sm border-slate-200
            dark:bg-slate-900 dark:border-slate-700
            p-4 text-sm
          "
        >
          {report.overall_score != null && (
            <p className="mb-4 flex justify-center text-base">
              <span className="font-semibold">Overall score:&nbsp;</span>
              <span className="font-semibold">
                {report.overall_score.toFixed(0)}%
              </span>
            </p>
          )}

          {/* Maturity by Pillar cards (copied behaviour from dashboard) */}
          <div>
            <p className="font-semibold mb-2">Maturity by Pillar</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(report.pillar_scores).map(([pillar, score]) => {
                const { label, badgeClass } = getMaturityLevel(score);
                return (
                  <div
                    key={pillar}
                    className="
                      border rounded-2xl px-3 py-3 bg-white
                      dark:bg-slate-950 border-slate-200 dark:border-slate-700
                      flex flex-col justify-between
                    "
                  >
                    <div>
                      <p className="font-semibold text-sm mb-1">{pillar}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Score: {score.toFixed(0)}%
                      </p>
                    </div>
                    <div className="mt-2">
                      <span
                        className={
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium " +
                          badgeClass
                        }
                      >
                        {label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Markdown report + PDF button */}
        <div
          className="
            border rounded-2xl bg-white shadow-sm border-slate-200 p-6
            dark:bg-slate-900 dark:border-slate-700
            prose prose-sm max-w-none dark:prose-invert
          "
        >
          {/* Right-aligned PDF button above the report content */}
          <div className="flex justify-end mb-3 print:hidden">
            <PdfReportButton />
          </div>

          {/* Allow HTML in the markdown so styled title / colored headings render */}
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
            {report.report_md}
          </ReactMarkdown>
        </div>
      </div>
    </main>
  );
}
