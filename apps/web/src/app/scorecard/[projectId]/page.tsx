// apps/web/src/app/scorecard/[projectId]/page.tsx
export const revalidate = 30;

type PillarCard = { pillar: string; score: number; weight: number; maturity: number };
type KPI = {
  pillar: string;
  kpi_id: string;
  key: string;
  name: string;
  unit: string;
  raw_value: number | null;
  normalized: number;
  notes?: string | null;
};
type Payload = {
  project: { slug: string; name: string; target_threshold: number };
  pillars: PillarCard[];
  overall_pct: number;
  kpis: KPI[];
};

export default async function ScorecardDashboard(
  props: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await props.params;
  const base = process.env.CORE_SVC_URL ?? "http://localhost:8001";
  const r = await fetch(`${base}/scorecard/${projectId}`, { next: { revalidate: 30 } });
  if (!r.ok) throw new Error(`Failed to load scorecard ${projectId}`);
  const data = (await r.json()) as Payload;

  const name = data.project?.name ?? projectId;
  const target = (data.project?.target_threshold ?? 0.8) * 100;
  const pass = (data.overall_pct ?? 0) >= target;
  const radar = (data.pillars ?? []).map((p) => ({
    pillar: p.pillar,
    score_pct: Math.round(p.score),
  }));
  const bars = radar;

  return (
    <DashboardShell
      title={`${name} — Scorecard Dashboard`}
      subtitle={`Project: ${projectId}`}
      actions={
        <a
          href={`/scorecard/${projectId}/dashboard/edit`}
          className="
            inline-flex items-center rounded-xl border px-3 py-2 text-sm font-semibold
            border-emerald-400/70 bg-emerald-500 text-slate-950
            hover:bg-emerald-400
            dark:border-emerald-400/60 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950
          "
        >
          Edit
        </a>
      }
    >
      {/* Top row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <StatCard
          label="Overall Trust"
          value={`${Math.round(data.overall_pct ?? 0)}%`}
          badge={pass ? "PASS" : "BELOW"}
          tone={pass ? "success" : "danger"}
          hint="Weighted by pillar weights"
        />
        <StatCard
          label="Target Threshold"
          value={`${Math.round(target)}%`}
          hint="Pre-GTM gate"
        />
        <StatCard
          label="Pillars"
          value={`${data.pillars?.length ?? 0}`}
          hint="Governance, Pre-GTM, Data, Transparency, Human, CRA/Drift"
        />
        <StatCard
          label="KPIs"
          value={`${data.kpis?.length ?? 0}`}
          hint="All normalized to 0–100"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <TrustGauge valuePct={data.overall_pct ?? 0} />
        <PillarRadar data={radar} />
        <PillarBars data={bars} />
      </div>

      {/* Table */}
      <KpiTable
        projectId={projectId}
        kpis={data.kpis ?? []}
        targetThreshold={data.project?.target_threshold ?? 0.8}
      />
    </DashboardShell>
  );
}

// Imports at bottom so TS sees them
// shared (at app root)
import DashboardHeader from "@/app/(components)/DashboardHeader";
import StatCard from "@/app/(components)/StatCard";
// scorecard-scoped
import MetricTile from "@/app/(components)/MetricTile";
import PillarRadar from "@/app/(components)/PillarRadar";
import PillarBar from "@/app/(components)/PillarBar";
import PillarSummary from "@/app/(components)/PillarSummary";
import MaturityGrid from "@/app/(components)/MaturityGrid";
import TrustTrend from "@/app/(components)/TrustTrend";
import KpiHeatmap from "@/app/(components)/KpiHeatmap";
import KpiTable from "@/app/(components)/KpiTable";
import EditKpis from "@/app/(components)/EditKpis";
import EditPillars from "@/app/(components)/EditPillars";

