// apps/web/src/app/(components)/Action.tsx
"use client";

import { RefreshCw } from "lucide-react";

export default function Actions({ projectId }: { projectId: string }) {
  async function refresh() {
    try {
      // Optional: only if you added /api/revalidate
      // await fetch("/api/revalidate", {
      //   method: "POST",
      //   headers: { "content-type": "application/json" },
      //   body: JSON.stringify({ path: `/scorecard/${projectId}/dashboard` }),
      // });
      window.location.reload();
    } catch {
      window.location.reload();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <a
        href={`/scorecard/${encodeURIComponent(projectId)}/dashboard/edit`}
        className="px-3 py-2 rounded-xl text-sm text-center
                   bg-indigo-600 text-white hover:bg-indigo-500 transition
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80
                   focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50
                   dark:focus-visible:ring-offset-slate-950"
      >
        Edit KPI values
      </a>

      <button
        type="button"
        onClick={refresh}
        className="px-3 py-2 rounded-xl text-sm inline-flex items-center justify-center gap-2
                   border border-slate-300 bg-white text-slate-900 hover:bg-gray-50
                   dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/80
                   focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50
                   dark:focus-visible:ring-offset-slate-950"
      >
        <RefreshCw className="size-4" />
        Refresh
      </button>
    </div>
  );
}
