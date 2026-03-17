// Server Component
import DeleteProjectButton from "@/app/(components)/DeleteProjectButton";

type Props = {
  projectId: string;        // slug, e.g. "hr-ai-project-1"
  projectName: string;      // e.g. "Financial Sentiment Analysis"
  targetPct: number;        // 0..100
  overallPct: number;       // 0..100
  pass: boolean;            // overall >= threshold
};

export default function DashboardHeader({
  projectId,
  projectName,
  targetPct,
  overallPct,
  pass,
}: Props) {
  const adminUrl = `/scorecard/${encodeURIComponent(projectId)}/dashboard/admin`;
  const editUrl  = `/scorecard/${encodeURIComponent(projectId)}/dashboard/edit`;

  // status chip — taller, narrower, with vibrant background
  const statusClass = pass
    ? "bg-green-50 text-green-700 border-green-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-500/60"
    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-500/60";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/40 dark:border-slate-700/60 shadow-sm bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-500 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_50%)]" />
      <div className="relative p-6 md:p-8">
        <div className="flex items-start justify-between gap-6">
          {/* LEFT */}
          <div className="min-w-0">
            {/* Small subtitle where the small project-name used to sit */}
            <div className="text-xs uppercase tracking-wider/loose opacity-80">
              LeadAI · Trust Scorecard
            </div>

            {/* Big project name (restored size/placement) */}
            <h1 className="mt-1 text-3xl md:text-5xl font-semibold leading-tight">
              {projectName}
            </h1>

            {/* Status row */}
            <div className="mt-3 flex items-center gap-3">
              <span
                className={`inline-flex items-center justify-center border rounded-2xl px-4 py-2 text-sm font-medium ${statusClass}`}
                style={{ minHeight: 38 }}
                title={pass ? "At or above threshold" : "Below threshold"}
              >
                {pass ? "At Threshold" : "Below Threshold"} ·{" "}
                {Math.round(overallPct)}% / {Math.round(targetPct)}%
              </span>
            </div>
          </div>

          {/* RIGHT: stacked action buttons */}
          <div className="flex flex-col gap-2 items-end">
            {/* Performance Metrics -> /dashboard/edit */}
            <a
              href={editUrl}
              className="inline-flex items-center justify-center rounded-xl bg-white text-indigo-700 border border-white/70 px-4 py-2 hover:bg-indigo-50 transition"
            >
              Performance Metrics
            </a>

            {/* Admin -> /dashboard/admin */}
            <a
              href={adminUrl}
              className="inline-flex items-center justify-center rounded-xl border border-white/70 bg-white/10 backdrop-blur px-4 py-2 text-white hover:bg-white/20 transition"
            >
              Admin
            </a>

            {/* Delete (client component with confirm + API call) */}
            {/* @ts-expect-error Server → Client boundary */}
            <DeleteProjectButton projectId={projectId} />
          </div>
        </div>
      </div>
    </div>
  );
}
