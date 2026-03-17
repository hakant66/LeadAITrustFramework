// src/app/scorecard/scorecard-legacy.tsx (Server Component)
import Link from "next/link";
import { cookies } from "next/headers";
import MiniTrustDonut from "@/app/(components)/MiniTrustDonut";
import Header from "@/app/(components)/Header";
import { getLocale } from "next-intl/server";

type Project = {
  id: string;
  slug: string;
  name: string;
  risk_level: string | null;
  priority: string | null;
  sponsor: string | null;
  owner: string | null;
  target_threshold: number;
};

export default async function ScorecardHomeLegacy() {
  const locale = await getLocale();
  const adminHref = "/scorecard/admin/governance-dashboard-reporting";
  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const res = await fetch(
    `${appUrl.replace(/\/+$/, "")}/api/core/projects?locale=${encodeURIComponent(locale)}`,
    { cache: "no-store", headers: { Cookie: cookieStore.toString() } }
  );
  if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
  const projects = (await res.json()) as Project[];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="px-6 py-6 max-w-7xl mx-auto">
        <Header title="AI Projects" subtitle="LeadAI · Trust Scorecard">
          <div className="flex gap-4">
            <Link
              href={adminHref}
              className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 bg-white text-indigo-700 hover:bg-indigo-50 transition dark:border-slate-600 dark:bg-slate-900/80 dark:text-emerald-200 dark:hover:bg-slate-800"
            >
              Main menu
            </Link>
            <Link
              href="/"
              className="mt-2 inline-flex items-center px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-600 text-sm font-medium shadow-sm transition hover:border-slate-300 hover:text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Sign Out
            </Link>
          </div>
        </Header>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const riskLabel = p.risk_level ?? "n/a";
            const priorityLabel = p.priority ?? p.risk_level ?? "n/a";
            const sponsorLabel = p.sponsor ?? null;
            const ownerLabel = p.owner ?? null;
            const rawTarget =
              typeof p.target_threshold === "number"
                ? p.target_threshold
                : Number(p.target_threshold ?? 0.75);
            const target =
              Number.isFinite(rawTarget) && !Number.isNaN(rawTarget)
                ? Math.max(0, Math.min(1, rawTarget))
                : 0.75;

            return (
              <a
                key={p.id}
                className="group block border rounded-2xl bg-white shadow-sm p-4 hover:shadow-md transition-shadow border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                href={`/scorecard/${p.slug}/vipdashboard`}
                title={`Open ${p.name} dashboard`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-lg font-medium truncate text-slate-900 dark:text-slate-50">
                      {p.name}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-700 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1 rounded-full border bg-gray-100 px-2 py-0.5 border-slate-200 dark:border-slate-600 dark:bg-slate-800">
                        <span className="font-semibold">Risk</span>
                        <span className="truncate">{riskLabel}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border bg-gray-100 px-2 py-0.5 border-slate-200 dark:border-slate-600 dark:bg-slate-800">
                        <span className="font-semibold">Priority</span>
                        <span className="truncate">{priorityLabel}</span>
                      </span>
                    </div>
                    {(sponsorLabel || ownerLabel) && (
                      <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-slate-400">
                        {sponsorLabel ? (
                          <div
                            className="truncate"
                            title={`Sponsor: ${sponsorLabel}`}
                          >
                            Sponsor: {sponsorLabel}
                          </div>
                        ) : null}
                        {ownerLabel ? (
                          <div
                            className="truncate"
                            title={`Owner: ${ownerLabel}`}
                          >
                            Owner: {ownerLabel}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <MiniTrustDonut slug={p.slug} size={56} />
                </div>

                <div className="mt-4">
                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    Target Threshold
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {(target * 100).toFixed(0)}%
                  </div>
                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden dark:bg-slate-800">
                    <div
                      className="h-2 bg-indigo-500"
                      style={{ width: `${target * 100}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 text-indigo-600 dark:text-indigo-300 text-sm group-hover:underline">
                  Open dashboard →
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </main>
  );
}
