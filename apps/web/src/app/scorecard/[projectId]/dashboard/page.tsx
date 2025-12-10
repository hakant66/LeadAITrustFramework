// apps/web/src/app/scorecard/[projectId]/dashboard/page.tsx
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/(components)/tabs";
import DonutGauge from "@/app/(components)/DonutGauge";
import PillarRadar from "@/app/(components)/PillarRadar";
import PillarBar from "@/app/(components)/PillarBar"; // updated to color by threshold
import PillarBarLink from "@/app/(components)/PillarBarLink";
import MaturityGrid from "@/app/(components)/MaturityGrid";
import TrustTrend from "@/app/(components)/TrustTrend";
import KpiHeatmap from "@/app/(components)/KpiHeatmap";
import KpiTable from "@/app/(components)/KpiTable";
import { TrendsChart } from "@/app/(components)/TrendsChart";
import Header from "@/app/(components)/Header";

export const metadata = { title: "Scorecard" };
export const revalidate = 30;

type PillarRow = {
  pillar_id: string;
  key: string;
  name: string;
  weight: number | null;
  score_pct: number | null;
  maturity: number | null;
  updated_at: string | null;
};

type PillarCard = {
  key: string;
  pillar: string;
  score: number;
  weight: number;
  maturity: number;
};

// Extended to include enrichment fields used by KpiTable
type KpiRow = {
  pillar: string;
  kpi_id: string;
  key: string;
  name: string;
  unit?: string;
  raw_value?: number | string | null;
  normalized?: number | null;
  notes?: string | null;

  // enrichment
  owner_role?: string | null;
  owner?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;

  target_text?: string | null;
  target_numeric?: number | null;
  current_value?: number | string | null;
  kpi_score?: number | null;
  evidence_source?: string | null;
  as_of?: string | null;
  updated_at?: string | null;
};

export default async function ScorecardDashboard(
  props: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await props.params;

  const base =
    process.env.NEXT_PUBLIC_CORE_SVC_URL ??
    process.env.CORE_SVC_URL ??
    "http://localhost:8001";

  // 1) Load scorecard (for header + KPIs + project slug)
  const res = await fetch(`${base}/scorecard/${projectId}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`Failed to load scorecard (${res.status})`);
  const api: any = await res.json();

  const projectSlug = api.project?.slug ?? api.project_slug ?? projectId;
  const projectName = api.project?.name ?? api.project_name ?? projectSlug;
  const targetThreshold =
    typeof api.project?.target_threshold === "number"
      ? api.project.target_threshold
      : typeof api.target_threshold === "number"
      ? api.target_threshold
      : 0.75;

  // 2) Build KPI rows
  const kpis: KpiRow[] = Array.isArray(api.kpis)
    ? api.kpis.map((k: any) => ({
        pillar: (k.pillar ?? "").toString(),
        kpi_id: (k.kpi_id ?? k.id ?? k.key ?? "").toString(),
        key: (k.key ?? k.kpi_key ?? k.id ?? "").toString(),
        name: (k.name ?? k.key ?? "").toString(),

        unit: k.unit ?? k.units ?? "",
        raw_value:
          typeof k.raw_value === "number" || typeof k.raw_value === "string"
            ? k.raw_value
            : typeof k.raw === "number" || typeof k.raw === "string"
            ? k.raw
            : null,
        normalized:
          typeof k.normalized === "number"
            ? k.normalized
            : typeof k.normalized_pct === "number"
            ? k.normalized_pct
            : null,
        notes: k.notes ?? null,

        // enrichment passthrough
		owner_role: k.owner_role ?? null,
		owner: k.owner ?? null,
		owner_name: k.owner_name ?? null,
		owner_email: k.owner_email ?? null,
		target_text: k.target_text ?? null,
		target_numeric:
		  typeof k.target_numeric === "number" ? k.target_numeric : null,
		current_value:
		  typeof k.current_value === "number" ||
		  typeof k.current_value === "string"
			? k.current_value
			: null,
		kpi_score: typeof k.kpi_score === "number" ? k.kpi_score : null,
		evidence_source: k.evidence_source ?? null,
		as_of: k.as_of ?? null,
		updated_at: k.updated_at ?? null,
      }))
    : [];

  // 3) Fetch canonical pillars
  const pillarsRes = await fetch(
    `${base}/scorecard/${encodeURIComponent(projectSlug)}/pillars`,
    { cache: "no-store" }
  );
  if (!pillarsRes.ok) {
    throw new Error(`Failed to load pillars (${pillarsRes.status})`);
  }
  const pillarsJson: PillarRow[] = await pillarsRes.json();

  const pillars: PillarCard[] = pillarsJson.map((p) => ({
    key: p.key,
    pillar: p.name,
    score: typeof p.score_pct === "number" ? p.score_pct : 0,
    weight: typeof p.weight === "number" ? p.weight : 1,
    maturity: typeof p.maturity === "number" ? p.maturity : 1,
  }));

  // 4) Overall % — prefer API, else average
  const overallPct =
    typeof api.overall_pct === "number"
      ? api.overall_pct
      : typeof api.overall === "number"
      ? api.overall * 100
      : pillars.length
      ? Math.round(
          (pillars.reduce((a, b) => a + (b.score ?? 0), 0) / pillars.length) *
            10
        ) / 10
      : 0;

  // Separate admin URLs
  const kpisAdminUrl = `/scorecard/${encodeURIComponent(
    projectSlug
  )}/dashboard/kpis_admin`;
  const pillarsAdminUrl = `/scorecard/${encodeURIComponent(
    projectSlug
  )}/dashboard/pillars_admin`;

  // thresholds & computed bits
  const thresholdPct = Math.round(
    (typeof targetThreshold === "number" ? targetThreshold : 0.75) * 100
  );
  const overallPctRounded = Math.round(overallPct);
  const onTrack = overallPctRounded >= thresholdPct;

  const pillarThreshold = 75; // as requested for this project
  const pillarsAtOrAbove = pillars.filter((p) => p.score >= pillarThreshold)
    .length;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* Shared header to match other pages */}
        <Header title={projectName} subtitle={`Projects / ${projectName}`}>
          <div className="flex items-center gap-2">
            {/* KPIs Admin */}
            <Link
              href={kpisAdminUrl}
              className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800"
            >
              KPIs Admin
            </Link>
            {/* Pillars Admin */}
            <Link
              href={pillarsAdminUrl}
              className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800"
            >
              Pillars Admin
            </Link>
            {/* Back to Scorecard Index */}
            <Link
              href="/scorecard"
              className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800"
            >
              Back
            </Link>
          </div>
        </Header>

        {/* Tabs */}
        <div className="mt-3">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="kpis">KPI List</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="heatmap">KPI Heatmap</TabsTrigger>
              {/* Hidden tab keeps layout parity if needed */}
              <TabsTrigger value="admin" asChild>
                {/* placeholder */}
              </TabsTrigger>
            </TabsList>

            {/* OVERVIEW TAB */}
            <TabsContent value="overview">
              {/* Top row: Project Trust Score + Pillar Bars */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Project Trust Score */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-3xl p-4 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="grid grid-cols-2 md:grid-cols-[auto,1fr] items-start gap-0">
                    <div className="flex flex-col">
                      <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                        Project Trust Score
                      </div>
                      <div className="mt-5">
                        <TrustMarkBadge size={200} />
                      </div>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-1">
                      <StatusBadge
                        onTrack={onTrack}
                        overallPct={overallPctRounded}
                        thresholdPct={thresholdPct}
                      />
                      <PillarsBadge
                        threshold={pillarThreshold}
                        count={pillarsAtOrAbove}
                        total={pillars.length}
                      />

                      <div className="w-[220px] h-[220px]">
                        <DonutGauge value={overallPct} />
                      </div>

                      {/* Report button for ALL projects, using projectSlug */}
                      <Link
                        href={`/scorecard/${encodeURIComponent(
                          projectSlug
                        )}/report`}
                        className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-900 text-slate-50 hover:bg-slate-800 text-sm whitespace-nowrap self-end"
                      >
                        Report for AI Project : {projectSlug}
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Pillar Bars (colored by threshold) */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-3xl p-5 bg-white dark:bg-slate-900 shadow-sm">
                  <div className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-2">
                    Pillar Bars
                  </div>
                  <PillarBarLink
                    projectSlug={projectSlug}
                    pillars={pillars}
                    threshold={pillarThreshold}
                    labelField="key"
                  />
                </div>
              </div>

              {/* Secondary visuals */}
              <section className="mt-3 grid grid-cols-2 lg:grid-cols-2 gap-2">
                <Card title="Pillar Radar">
                  <PillarRadar pillars={pillars} />
                </Card>
                <Card title="Maturity by Pillar">
                  <MaturityGrid pillars={pillars} />
                </Card>
              </section>
            </TabsContent>

            {/* KPI LIST TAB */}
            <TabsContent value="kpis">
              <section className="mt-3 grid grid-cols-1 lg:grid-cols-1 gap-4">
                <div className="lg:col-span-2">
                  <Card title="KPI List">
                    <KpiTable
                      rows={kpis.slice(0, 60)}
                      limit={60}
                      slug={projectSlug}
                      apiBase={base}
                    />
                  </Card>
                </div>
              </section>
            </TabsContent>

            {/* TRENDS TAB */}
            <TabsContent value="trends">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <div className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-2">
                  Overall score (time series)
                </div>
                <TrendsChart projectSlug={projectSlug} />
              </div>
            </TabsContent>

            {/* KPI HEATMAP TAB */}
            <TabsContent value="heatmap">
              <section className="mt-3 grid grid-cols-1 lg:grid-cols-1 gap-4">
                <Card title="KPI Heatmap">
                  <KpiHeatmap rows={kpis.slice(0, 45)} />
                </Card>
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
      <div className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}

function TrustMarkBadge({ size = 220 }: { size?: number }) {
  const src = "/leadai-trustmark-cert.transparent2.png";
  return (
    <div
      className="rounded-2xl p-2 bg-white dark:bg-slate-900"
      style={{ width: size + 16 }}
    >
      <div
        className="relative overflow-hidden rounded-xl ring-1 ring-gray-200 dark:ring-slate-700 bg-white dark:bg-slate-950"
        style={{ width: size, height: size }}
      >
        <Image
          src={src}
          alt="LeadAI TrustMark Certification"
          fill
          sizes={`${size}px`}
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}

function StatusBadge({
  onTrack,
  overallPct,
  thresholdPct,
}: {
  onTrack: boolean;
  overallPct: number;
  thresholdPct: number;
}) {
  const cls = onTrack
    ? "bg-green-50 text-green-700 border-green-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-500/60"
    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-500/60";
  const label = onTrack ? "Above target" : "Below target";
  return (
    <span
      className={`inline-flex items-center gap-11 px-3 py-0 rounded-full text-sm border ${cls}`}
    >
      <span>{label}</span>
      <span>
        {overallPct}% / {thresholdPct}%
      </span>
    </span>
  );
}

function PillarsBadge({
  threshold,
  count,
  total,
}: {
  threshold: number;
  count: number;
  total: number;
}) {
  const solid = count >= Math.ceil(total / 2);
  const cls = solid
    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-500/60"
    : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-500/60";
  const hint = solid ? "Solid spread" : "Needs focus";

  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-0 rounded-full text-sm border ${cls}`}
    >
      <span>{`Pillars ≥ ${threshold}%`}</span>
      <span>{`${count}/${total}`}</span>
      <span>{hint}</span>
    </span>
  );
}
