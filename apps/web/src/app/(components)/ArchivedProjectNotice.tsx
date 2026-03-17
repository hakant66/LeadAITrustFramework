"use client";

import Link from "next/link";
import Header from "@/app/(components)/Header";

export default function ArchivedProjectNotice({
  projectId,
  subtitle = "LeadAI · Scorecard",
}: {
  projectId?: string;
  subtitle?: string;
}) {
  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Header title="Project Archived" subtitle={subtitle}>
          <Link
            href="/projects/register"
            className="
              inline-flex items-center h-9 px-3 rounded-xl border border-slate-200
              bg-white/60 text-slate-700 hover:bg-white
              dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900
            "
          >
            AI Projects Register
          </Link>
        </Header>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="text-lg font-semibold">This project is archived</div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {projectId
              ? `Project "${projectId}" has been archived and is no longer accessible in dashboards or reports.`
              : "This project has been archived and is no longer accessible in dashboards or reports."}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            If you need access, restore or recreate the project in the AI Projects Register.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/projects/register"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Go to AI Projects Register
            </Link>
            <Link
              href="/scorecard/admin/governance-dashboard-reporting"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Back to Governance Dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
