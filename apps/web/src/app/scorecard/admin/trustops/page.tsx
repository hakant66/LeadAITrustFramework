import Header from "@/app/(components)/Header";
import Link from "next/link";
import { cookies } from "next/headers";
import { resolveNavMode } from "@/lib/navMode";

type ProjectRow = {
  id: string;
  slug: string;
  name?: string | null;
};

type TrustAxesResp = {
  axes: Array<{ axis_key: string; score_pct: number | null }>;
};

const toBase = (value: string) => value.replace(/\/+$/, "");

const computeTol = (scores: Array<number | null | undefined>): string => {
  const valid = scores.filter((score): score is number => typeof score === "number");
  if (!valid.length) return "TOL-0";
  const min = Math.min(...valid);
  if (min >= 80) return "TOL-3";
  if (min >= 60) return "TOL-2";
  if (min >= 40) return "TOL-1";
  return "TOL-0";
};

export default async function TrustOpsOverviewPage() {
  const navMode = resolveNavMode();
  const isLegacy = navMode === "legacy";
  const controlBase = isLegacy
    ? "/scorecard/admin/trustops"
    : "/scorecard/admin/control-audit";
  const subtitle = isLegacy ? "LeadAI · TrustOps" : "LeadAI · Control & Audit";
  const appUrl = toBase(
    process.env.INTERNAL_APP_URL ??
      process.env.AUTH_URL ??
      process.env.NEXTAUTH_URL ??
      "http://localhost:3000"
  );
  const cookieStore = await cookies();

  const loadProjects = async (): Promise<ProjectRow[]> => {
    const res = await fetch(`${appUrl}/api/core/projects`, {
      cache: "no-store",
      headers: { Cookie: cookieStore.toString() },
    });
    if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };

  const loadTrustAxes = async (slug: string): Promise<TrustAxesResp | null> => {
    const res = await fetch(
      `${appUrl}/api/core/trust/axes/${encodeURIComponent(slug)}`,
      { cache: "no-store", headers: { Cookie: cookieStore.toString() } }
    );
    if (!res.ok) return null;
    return (await res.json()) as TrustAxesResp;
  };

  const loadPendingSignals = async (): Promise<number> => {
    const res = await fetch(`${appUrl}/api/reg/trust/signals?status=pending`, {
      cache: "no-store",
      headers: { Cookie: cookieStore.toString() },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return Array.isArray(data) ? data.length : 0;
  };

  const projects = await loadProjects().catch(() => [] as ProjectRow[]);
  let trustAxesList: Array<TrustAxesResp | null> = [];
  if (projects.length) {
    try {
      trustAxesList = await Promise.all(
        projects.map((project) => loadTrustAxes(project.slug))
      );
    } catch {
      trustAxesList = [];
    }
  }
  const pendingSignals = await loadPendingSignals().catch(() => 0);

  const tolCounts = { "TOL-0": 0, "TOL-1": 0, "TOL-2": 0, "TOL-3": 0 };
  trustAxesList.forEach((axes) => {
    if (!axes?.axes?.length) return;
    const tol = computeTol(axes.axes.map((axis) => axis.score_pct));
    tolCounts[tol as keyof typeof tolCounts] += 1;
  });

  const hasTolData = trustAxesList.some((axes) => axes?.axes?.length);
  const projectCount = projects.length;

  return (
    <div className="space-y-6">
      <Header title="Trust Overview" subtitle={subtitle}>
        <div />
      </Header>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          {
            label: "AI systems tracked",
            value: projectCount ? String(projectCount) : "N/A",
          },
          {
            label: "TOL-0",
            description: "Trust‑of‑Life: Baseline",
            value: hasTolData ? String(tolCounts["TOL-0"]) : "N/A",
          },
          {
            label: "TOL-1",
            description: "Trust‑of‑Life: Controlled",
            value: hasTolData ? String(tolCounts["TOL-1"]) : "N/A",
          },
          {
            label: "TOL-2",
            description: "Trust‑of‑Life: Assured",
            value: hasTolData ? String(tolCounts["TOL-2"]) : "N/A",
          },
          {
            label: "TOL-3",
            description: "Trust‑of‑Life: Advanced",
            value: hasTolData ? String(tolCounts["TOL-3"]) : "N/A",
          },
          {
            label: "Active trust alerts",
            description: "Open monitoring signals",
            value: String(pendingSignals),
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {card.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {card.value}
            </div>
            {"description" in card && card.description ? (
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {card.description}
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Trust Axes Snapshot</div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Current axis level and the leading blocker for progression.
            </p>
          </div>
          <Link
            href={`${controlBase}/axes`}
            className="text-sm text-indigo-600 hover:underline dark:text-indigo-300"
          >
            View axes
          </Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Safety",
              level: "S2",
              levelLabel: "Safety Level 2 (Assured)",
              trend: "Stable",
              blocker: "Review cadence",
            },
            {
              title: "Compliance",
              level: "C2",
              levelLabel: "Compliance Level 2 (Assured)",
              trend: "Stable",
              blocker: "Regulatory refresh",
            },
            {
              title: "Provenance",
              level: "P2",
              levelLabel: "Provenance Level 2 (Assured)",
              trend: "Decaying",
              blocker: "Evidence linkage",
            },
          ].map((axis) => (
            <div
              key={axis.title}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="text-sm font-semibold">{axis.title}</div>
              <div className="mt-2 text-2xl font-semibold">{axis.level}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {axis.levelLabel}
              </div>
              <div className="mt-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Trend
              </div>
              <div className="text-sm">{axis.trend}</div>
              <div className="mt-2 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Top blocker
              </div>
              <div className="text-sm">{axis.blocker}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        No actionable alerts yet. Monitoring signals and evidence expiry alerts will appear
        here.
      </section>
    </div>
  );
}
