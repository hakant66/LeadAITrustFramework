// apps/web/src/app/scorecard/[projectId]/report/page.tsx
import React from "react";
import Link from "next/link";
import Header from "@/app/(components)/Header";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { PdfReportButton } from "@/app/(components)/PdfReportButton";
import ProjectSlugTracker from "@/app/(components)/ProjectSlugTracker";
import ArchivedProjectNotice from "@/app/(components)/ArchivedProjectNotice";
import { cookies } from "next/headers";
import HistoryBackButton from "@/app/(components)/HistoryBackButton";

export const dynamic = "force-dynamic";

type ProjectReportResp = {
  project_slug: string;
  project_name: string;
  overall_score: number | null;
  pillar_scores: Record<string, number>;
  report_md: string;
  provider?: string;
  model?: string;
  latency_ms?: number;
  generated_at?: string;
  cache_hit?: boolean;
};

async function fetchReport<T>(
  url: string,
  cookieHeader?: string,
): Promise<{
  archived: boolean;
  data?: T;
  error?: string;
}> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });
  if (res.status === 410) return { archived: true };
  if (!res.ok) {
    const text = await res.text();
    let message = text || `Request failed (${res.status})`;
    try {
      const body = JSON.parse(text) as { detail?: string; message?: string; error?: string };
      message = body.detail || body.message || body.error || message;
    } catch {
      // ignore parse errors
    }
    return { archived: false, error: message };
  }
  return { archived: false, data: await res.json() };
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

export default async function ProjectReportPage(
  props: {
    params: Promise<{ projectId: string }>;
    searchParams?: { mode?: string; provider?: string; force?: string };
  }
) {
  const { projectId } = await props.params;
  const useLlm = props.searchParams?.mode === "llm";
  const providerParam = props.searchParams?.provider;
  const allowedProviders = ["ollama", "openai", "anthropic", "google"] as const;
  const llmProvider = allowedProviders.includes(providerParam as (typeof allowedProviders)[number])
    ? (providerParam as (typeof allowedProviders)[number])
    : undefined;
  const llmProviderEffective = llmProvider ?? "openai";

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const appBase = appUrl.replace(/\/+$/, "");
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const scorecardUrl = `${appBase}/api/core/scorecard/${encodeURIComponent(projectId)}`;
  let entityId: string | undefined;
  let res = await fetch(scorecardUrl, {
    cache: "no-store",
    headers: { Cookie: cookieHeader },
  });
  if (res.status === 410) {
    return (
      <ArchivedProjectNotice
        projectId={projectId}
        subtitle="LeadAI · Executive Report"
      />
    );
  }
  if (res.status === 404) {
    const entitiesRes = await fetch(`${appBase}/api/core/user/entities`, {
      cache: "no-store",
      headers: { Cookie: cookieHeader },
    });
    if (entitiesRes.ok) {
      const entities = (await entitiesRes.json()) as Array<{
        entity_id: string;
      }>;
      for (const entity of entities) {
        const candidate = await fetch(
          `${scorecardUrl}?entity_id=${encodeURIComponent(entity.entity_id)}`,
          { cache: "no-store", headers: { Cookie: cookieHeader } }
        );
        if (candidate.status === 410) {
          return (
            <ArchivedProjectNotice
              projectId={projectId}
              subtitle="LeadAI · Executive Report"
            />
          );
        }
        if (candidate.ok) {
          entityId = entity.entity_id;
          res = candidate;
          break;
        }
      }
    }
  }
  if (!entityId) {
    const entitiesRes = await fetch(`${appBase}/api/core/user/entities`, {
      cache: "no-store",
      headers: { Cookie: cookieHeader },
    });
    if (entitiesRes.ok) {
      const entities = (await entitiesRes.json()) as Array<{
        entity_id: string;
      }>;
      for (const entity of entities) {
        const candidate = await fetch(
          `${scorecardUrl}?entity_id=${encodeURIComponent(entity.entity_id)}`,
          { cache: "no-store", headers: { Cookie: cookieHeader } }
        );
        if (candidate.ok) {
          entityId = entity.entity_id;
          break;
        }
      }
    }
  }
  if (!res.ok) {
    throw new Error(`Failed to load scorecard (${res.status})`);
  }

  const forceRegen = props.searchParams?.force === "1";
  const entityParam = entityId ? `&entity_id=${encodeURIComponent(entityId)}` : "";
  const reportUrl = useLlm
    ? `${appBase}/api/core/admin/ai-reports/projects/${encodeURIComponent(
        projectId,
      )}/ai-summary-llm?provider=${encodeURIComponent(
        llmProviderEffective,
      )}${forceRegen ? "&force_regenerate=true" : ""}${entityParam}`
    : `${appBase}/api/core/admin/ai-reports/projects/${encodeURIComponent(
        projectId,
      )}/ai-summary${entityId ? `?entity_id=${encodeURIComponent(entityId)}` : ""}`;

  const reportResult = await fetchReport<ProjectReportResp>(
    reportUrl,
    cookieHeader,
  );
  if (reportResult.archived) {
    return (
      <ArchivedProjectNotice
        projectId={projectId}
        subtitle="LeadAI · Executive Report"
      />
    );
  }
  if (reportResult.error) {
    const rawMessage = reportResult.error;
    const lower = rawMessage.toLowerCase();
    const friendly =
      rawMessage.includes("ANTHROPIC_API_KEY") || lower.includes("anthropic key")
        ? "No ANTHROPIC KEY configured. Set ANTHROPIC_API_KEY for core-svc."
        : rawMessage.includes("OPENAI_API_KEY") || lower.includes("openai key")
        ? "No OPENAI KEY configured. Set OPENAI_API_KEY for core-svc."
        : rawMessage.includes("GEMINI_API_KEY") ||
          rawMessage.includes("GOOGLE_API_KEY") ||
          lower.includes("gemini key")
        ? "No GEMINI KEY configured. Set GEMINI_API_KEY or GOOGLE_API_KEY for core-svc."
        : rawMessage;

    return (
      <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Header title="AI Project Report" subtitle={`Project: ${projectId}`}>
            <div className="flex items-center gap-2">
              <HistoryBackButton label="Back" />
              <Link
                href={`/scorecard/${encodeURIComponent(projectId)}/report`}
                className="
                  inline-flex items-center h-9 px-3 rounded-xl border border-slate-200
                  bg-white/60 text-slate-700 hover:bg-white
                  dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900
                "
              >
                Use Standard Report
              </Link>
            </div>
          </Header>

          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            {friendly}
          </div>
        </div>
      </main>
    );
  }

  const report = reportResult.data as ProjectReportResp;

  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <Header
          title="AI Project Report"
          subtitle={`Project: ${report.project_name}`}
        >
          <div className="flex items-center gap-2">
            <HistoryBackButton label="Back" />
            <Link
              href={`/scorecard/${encodeURIComponent(projectId)}/report${
                useLlm
                  ? "?mode=standard"
                  : `?mode=llm&provider=${encodeURIComponent(
                      llmProviderEffective,
                    )}`
              }`}
              className="
                inline-flex items-center h-9 px-3 rounded-xl border border-slate-200
                bg-white/60 text-slate-700 hover:bg-white
                dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900
              "
            >
              {useLlm ? "Use Standard Report" : "Create AI Report"}
            </Link>
            {useLlm && (
              <Link
                href={`/scorecard/${encodeURIComponent(projectId)}/report?mode=llm&provider=${encodeURIComponent(
                  llmProviderEffective,
                )}&force=1`}
                className="
                  inline-flex items-center h-9 px-3 rounded-xl border border-amber-200
                  bg-amber-50 text-amber-800 hover:bg-amber-100
                  dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20
                "
              >
                Regenerate report
              </Link>
            )}
          </div>
        </Header>

        <div
          className="
            mt-3 border rounded-xl px-4 py-3 text-xs sm:text-sm
            border-slate-200 bg-white/70 text-slate-700
            dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200
          "
        >
          {useLlm ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium">LLM report</span>
              <span>
                Provider:{" "}
                <span className="font-semibold">
                  {report.provider ?? "unknown"}
                </span>
              </span>
              <span>
                Model:{" "}
                <span className="font-semibold">{report.model ?? "unknown"}</span>
              </span>
              <span className="flex items-center gap-2 flex-wrap">
                Switch to:
                {(["openai", "ollama", "anthropic", "google"] as const).map((p) => (
                  <Link
                    key={p}
                    href={`/scorecard/${encodeURIComponent(
                      projectId,
                    )}/report?mode=llm&provider=${p}`}
                    className={`inline-flex items-center h-7 px-2 rounded-lg border text-xs ${
                      llmProviderEffective === p
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/50 dark:bg-indigo-500/10 dark:text-indigo-200"
                        : "border-slate-200 bg-white/60 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                    }`}
                  >
                    {p === "openai"
                      ? "OpenAI"
                      : p === "ollama"
                        ? "Ollama"
                        : p === "anthropic"
                          ? "Anthropic"
                          : "Google"}
                  </Link>
                ))}
              </span>
              <span>
                Generated:{" "}
                <span className="font-semibold">
                  {report.generated_at ?? "unknown"}
                </span>
              </span>
              {typeof report.latency_ms === "number" && (
                <span>
                  Latency:{" "}
                  <span className="font-semibold">{report.latency_ms} ms</span>
                </span>
              )}
              {typeof report.cache_hit === "boolean" && (
                <span>
                  Cache:{" "}
                  <span className="font-semibold">
                    {report.cache_hit ? "HIT" : "MISS"}
                  </span>
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-medium">Standard report</span>
              <span>Deterministic template (no LLM)</span>
            </div>
          )}
        </div>

        {/* Markdown report + PDF button */}
        <div
          className="
            border rounded-2xl bg-white shadow-sm border-slate-200 p-8 md:p-10
            dark:bg-slate-900 dark:border-slate-700
            prose prose-lg max-w-none dark:prose-invert
            prose-headings:font-semibold prose-headings:text-slate-900 dark:prose-headings:text-slate-100
            prose-h1:text-3xl prose-h1:mb-4 prose-h1:mt-0 prose-h1:border-b prose-h1:border-slate-200 dark:prose-h1:border-slate-700 prose-h1:pb-3
            prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h2:text-slate-800 dark:prose-h2:text-slate-200
            prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-slate-700 dark:prose-h3:text-slate-300
            prose-p:text-slate-700 dark:prose-p:text-slate-300 prose-p:leading-relaxed
            prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-strong:font-semibold
            prose-ul:list-disc prose-ul:pl-6 prose-ul:my-4
            prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-4
            prose-li:text-slate-700 dark:prose-li:text-slate-300 prose-li:my-1.5
            prose-table:w-full prose-table:border-collapse prose-table:my-6
            prose-th:bg-slate-100 dark:prose-th:bg-slate-800 prose-th:border prose-th:border-slate-300 dark:prose-th:border-slate-600
            prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-semibold prose-th:text-slate-900 dark:prose-th:text-slate-100
            prose-td:border prose-td:border-slate-300 dark:prose-td:border-slate-600 prose-td:px-4 prose-td:py-2.5
            prose-td:text-slate-700 dark:prose-td:text-slate-300
            prose-blockquote:border-l-4 prose-blockquote:border-slate-400 dark:prose-blockquote:border-slate-500
            prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-600 dark:prose-blockquote:text-slate-400
          "
          data-print-report
          id="ai-project-report"
        >
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">AI Project Report</h1>
            <p className="text-sm text-slate-600">Project: {report.project_name}</p>
          </div>
          {/* Right-aligned PDF button above the report content */}
          <div className="flex justify-end mb-6 print:hidden">
            <PdfReportButton />
          </div>

          {/* Allow HTML in the markdown so styled title / colored headings render */}
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>
            {report.report_md}
          </ReactMarkdown>
        </div>

        {/* High-level summary card */}
        <div
          className="
            mt-4 border rounded-2xl bg-white shadow-sm border-slate-200
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
      </div>
      <ProjectSlugTracker slug={projectId} />
    </main>
  );
}
