// apps/web/src/app/scorecard/[projectId]/dashboard/page.tsx
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
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
import ProjectSlugTracker from "@/app/(components)/ProjectSlugTracker";
import ArchivedProjectNotice from "@/app/(components)/ArchivedProjectNotice";
import BackButton from "@/app/(components)/BackButton";

export const metadata = { title: "Scorecard" };
export const dynamic = "force-dynamic";

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

type TrustEvaluation = {
  tol: string;
  axis_scores: Record<string, number | null>;
  allowed_environments: string[];
};

type TrustmarkLatest = {
  id: string;
  project_slug: string;
  tol_level: string;
  axis_levels?: Record<string, string>;
  issued_at?: string | null;
  expires_at?: string | null;
  status: string;
};

type PolicyAlert = {
  id: string;
  policy_id: string;
  policy_title: string;
  project_slug?: string | null;
  alert_type: string;
  severity: string;
  message: string;
  status: string;
  created_at?: string | null;
};


export default async function ScorecardDashboard(
  props: {
    params: Promise<{ projectId: string }>;
    searchParams?: { tab?: string };
  }
) {
  const { projectId } = await props.params;

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();

  // 1) Load scorecard via app API so session is forwarded
  const scorecardUrl = `${appUrl.replace(/\/+$/, "")}/api/core/scorecard/${encodeURIComponent(projectId)}`;
  let entityId: string | undefined;
  let res = await fetch(scorecardUrl, {
    cache: "no-store",
    headers: { Cookie: cookieStore.toString() },
  });
  if (res.status === 410) {
    return (
      <ArchivedProjectNotice
        projectId={projectId}
        subtitle="LeadAI · Scorecard Dashboard"
      />
    );
  }
  const resolveEntityScorecard = async () => {
    const entitiesRes = await fetch(
      `${appUrl.replace(/\/+$/, "")}/api/core/user/entities`,
      { cache: "no-store", headers: { Cookie: cookieStore.toString() } }
    );
    if (!entitiesRes.ok) return null;
    const entities = (await entitiesRes.json()) as Array<{
      entity_id: string;
      slug: string;
    }>;
    for (const entity of entities) {
      const candidate = await fetch(
        `${scorecardUrl}?entity_id=${encodeURIComponent(entity.entity_id)}`,
        { cache: "no-store", headers: { Cookie: cookieStore.toString() } }
      );
      if (candidate.status === 410) {
        return { archived: true as const };
      }
      if (candidate.ok) {
        return { archived: false as const, entity_id: entity.entity_id, res: candidate };
      }
    }
    return null;
  };

  if (!res.ok || !entityId) {
    const resolved = await resolveEntityScorecard();
    if (resolved?.archived) {
      return (
        <ArchivedProjectNotice
          projectId={projectId}
          subtitle="LeadAI · Scorecard Dashboard"
        />
      );
    }
    if (resolved?.res) {
      entityId = resolved.entity_id;
      res = resolved.res;
    }
  }
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

  let policyAlerts: PolicyAlert[] = [];
  try {
    const alertRes = await fetch(
      `${appUrl.replace(/\/+$/, "")}/api/core/admin/policy-alerts?project_slug=${encodeURIComponent(
        projectSlug
      )}&status=open&include_global=true&limit=25`,
      { cache: "no-store", headers: { Cookie: cookieStore.toString() } }
    );
    if (alertRes.ok) {
      const data = await alertRes.json();
      policyAlerts = Array.isArray(data?.items) ? data.items : data ?? [];
    }
  } catch {
    policyAlerts = [];
  }

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
    `${appUrl.replace(/\/+$/, "")}/api/core/scorecard/${encodeURIComponent(
      projectSlug
    )}/pillars${entityId ? `?entity_id=${encodeURIComponent(entityId)}` : ""}`,
    { cache: "no-store", headers: { Cookie: cookieStore.toString() } }
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

  const tabParam = props.searchParams?.tab ?? "overview";
  const allowedTabs = new Set(["overview", "kpis", "trends", "heatmap"]);
  const defaultTab = allowedTabs.has(tabParam) ? tabParam : "overview";

  // thresholds & computed bits
  const thresholdPct = Math.round(
    (typeof targetThreshold === "number" ? targetThreshold : 0.75) * 100
  );
  const overallPctRounded = Math.round(overallPct);
  const onTrack = overallPctRounded >= thresholdPct;

  const pillarThreshold = 75; // as requested for this project
  const pillarsAtOrAbove = pillars.filter((p) => p.score >= pillarThreshold)
    .length;

  const openPolicyAlerts = policyAlerts.filter(
    (alert) => (alert.status ?? "open") === "open"
  );

  // 5) Trust verdict (best-effort; do not block page)
  let trustEval: TrustEvaluation | null = null;
  if (entityId) {
    try {
      const trustRes = await fetch(
        `${appUrl.replace(/\/+$/, "")}/api/core/trust/evaluate/${encodeURIComponent(
          projectSlug
        )}?entity_id=${encodeURIComponent(entityId)}`,
        { cache: "no-store", headers: { Cookie: cookieStore.toString() } }
      );
      if (trustRes.ok) {
        trustEval = (await trustRes.json()) as TrustEvaluation;
      }
    } catch {
      trustEval = null;
    }
  }

  // 6) TrustMark latest (best-effort; do not block page)
  let trustmarkLatest: TrustmarkLatest | null = null;
  try {
    const certBase =
      process.env.NEXT_PUBLIC_CERT_SVC_URL ??
      process.env.CERT_SVC_URL ??
      "http://localhost:8003";
    const trustmarkRes = await fetch(
      `${certBase.replace(/\/+$/, "")}/trustmark/latest/${encodeURIComponent(
        projectSlug
      )}`,
      { cache: "no-store" }
    );
    if (trustmarkRes.ok) {
      const tm = await trustmarkRes.json();
      if (tm?.ok && tm?.item?.id) {
        trustmarkLatest = tm.item as TrustmarkLatest;
      }
    }
  } catch {
    trustmarkLatest = null;
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <div className="px-6 py-6 max-w-7xl mx-auto">
        {/* Shared header to match other pages */}
        <Header title={projectName} subtitle={`Projects / ${projectName}`}>
          <div className="flex items-center gap-2">
            {/* Back to Scorecard Index */}
            <BackButton
              fallbackHref="/scorecard"
              className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800"
            />
          </div>
        </Header>

        {openPolicyAlerts.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">
                Policy alerts detected
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5">
                  {openPolicyAlerts.length} open
                </span>
                <Link
                  href="#policy-alerts"
                  className="text-amber-700 underline decoration-amber-300 underline-offset-2"
                >
                  View alerts
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-3">
          <Tabs defaultValue={defaultTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="executive" asChild>
                <Link
                  href={`/scorecard/${encodeURIComponent(
                    projectSlug
                  )}/report`}
                  className="transition-colors hover:text-slate-900 dark:hover:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Executive Reporting
                </Link>
              </TabsTrigger>
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
              <section className="mt-3" id="policy-alerts">
                <Card title="Policy Alerts">
                  {openPolicyAlerts.length > 0 ? (
                    <div className="space-y-3">
                      {openPolicyAlerts.slice(0, 6).map((alert) => (
                        <div
                          key={alert.id}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-slate-900">
                              {alert.policy_title}
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${alertSeverityClass(
                                alert.severity
                              )}`}
                            >
                              {alert.severity}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {alert.alert_type}
                          </div>
                          <div className="text-sm text-slate-700">
                            {alert.message}
                          </div>
                          <div className="text-xs text-slate-400">
                            {formatTimestamp(alert.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">
                      No active policy alerts.
                    </div>
                  )}
                </Card>
              </section>

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
                        <TrustMarkBadge
                          size={200}
                          reportUrl={`/scorecard/${encodeURIComponent(
                            projectSlug
                          )}/report`}
                          trustmark={trustmarkLatest}
                        />
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

              {/* Trust Verdict panel */}
              <section className="mt-3">
                <Card title="Trust Verdict">
                  {trustEval ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-semibold">
                          Trust Operating Level : Level -{" "}
                          {trustEval.tol.replace("TOL-", "")}
                        </span>
                        <span className="text-xs rounded-full border border-slate-300 dark:border-slate-600 px-2 py-0.5">
                          Allowed: {trustEval.allowed_environments.join(", ")}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {Object.entries(trustEval.axis_scores).map(
                          ([axis, score]) => (
                            <div
                              key={axis}
                              className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-900"
                            >
                              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {axis === "provenance"
                                  ? "Provenance Controls Score"
                                  : axis}
                              </div>
                              <div className="text-lg font-semibold">
                                {typeof score === "number"
                                  ? `${Math.round(score)}%`
                                  : "N/A"}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Controls-based: are we executing the governance
                        controls that should produce that evidence?
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Trust verdict unavailable.
                    </div>
                  )}
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
                      apiBase="/api/core"
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
                <TrendsChart projectSlug={projectSlug} entityId={entityId} />
              </div>
            </TabsContent>

            {/* KPI HEATMAP TAB */}
            <TabsContent value="heatmap">
              <section className="mt-3 grid grid-cols-1 lg:grid-cols-1 gap-4">
                <Card title="KPI Heatmap">
                  <KpiHeatmap
                    rows={kpis.slice(0, 45)}
                    projectSlug={projectSlug}
                  />
                </Card>
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      <ProjectSlugTracker slug={projectSlug} />
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

function formatTimestamp(value?: string | null) {
  if (!value) return "Not evaluated";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function alertSeverityClass(severity: string) {
  const level = (severity || "").toLowerCase();
  if (level === "high") {
    return "border border-rose-200 bg-rose-50 text-rose-700";
  }
  if (level === "medium") {
    return "border border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border border-emerald-200 bg-emerald-50 text-emerald-700";
}

function TrustMarkBadge({
  size = 220,
  reportUrl,
  trustmark,
}: {
  size?: number;
  reportUrl: string;
  trustmark?: TrustmarkLatest | null;
}) {
  const src = "/leadai-trustmark-cert.transparent2.png";
  const link = trustmark?.id ? `/trustmark/${trustmark.id}` : reportUrl;
  const statusLabel =
    trustmark?.status === "active" ? "Verified" : trustmark?.status;
  return (
    <Link href={link} className="inline-block">
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
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            {trustmark?.id ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/60 px-2 py-0.5 text-xs text-emerald-50 border border-emerald-500/70">
                {statusLabel || "Verified"}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-200 border border-slate-500/40">
                Not issued
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
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
