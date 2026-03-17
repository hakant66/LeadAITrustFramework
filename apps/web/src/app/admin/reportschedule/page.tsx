"use client";

import { useEffect, useState } from "react";
import Header from "@/app/(components)/Header";
import { coreApiBase } from "@/lib/coreApiBase";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type BatchResult = {
  total_processed: number;
  success_count: number;
  error_count: number;
  results?: Array<{
    project_slug: string;
    success: boolean;
    cached?: boolean;
    error?: string;
  }>;
};

type ReportSchedule = {
  report_type: string;
  enabled: boolean;
  run_hour_utc: number;
  updated_at?: string | null;
  is_default?: boolean;
};

const REPORT_LABELS: Record<string, { title: string; description: string }> = {
  ai_summary_llm: {
    title: "Executive (AI Summary)",
    description: "Daily executive overview report for each project.",
  },
  governance_requirements_report: {
    title: "Governance Requirements",
    description: "Requirements analysis report with frameworks and KPIs.",
  },
  board_level_report: {
    title: "Board-Level Summary",
    description: "Entity-wide governance summary for board stakeholders.",
  },
  board_level_deck: {
    title: "Board-Level Governance Deck (LLM) - board-level-report-deck",
    description: "Entity-wide presentation deck generated from board-level governance data.",
  },
};

export default function ReportSchedulePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [updating, setUpdating] = useState<Record<string, boolean>>({});

  const loadSchedules = async () => {
    setScheduleLoading(true);
    setScheduleError(null);
    try {
      const res = await fetch(`${coreApiBase()}/admin/ai-reports/schedule`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to load schedules");
      }
      const data = (await res.json()) as { items?: ReportSchedule[] };
      setSchedules(data.items ?? []);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Failed to load schedules");
    } finally {
      setScheduleLoading(false);
    }
  };

  useEffect(() => {
    void loadSchedules();
  }, []);

  const updateSchedule = async (
    reportType: string,
    next: { enabled: boolean; run_hour_utc: number },
  ) => {
    setUpdating((prev) => ({ ...prev, [reportType]: true }));
    setScheduleError(null);
    try {
      const res = await fetch(`${coreApiBase()}/admin/ai-reports/schedule/${reportType}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to update schedule");
      }
      const updated = (await res.json()) as ReportSchedule;
      setSchedules((prev) =>
        prev.map((item) => (item.report_type === updated.report_type ? updated : item)),
      );
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Failed to update schedule");
    } finally {
      setUpdating((prev) => ({ ...prev, [reportType]: false }));
    }
  };

  const handleRunBatch = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${coreApiBase()}/admin/ai-reports/batch-generate`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Batch generation failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as BatchResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run batch generation");
    } finally {
      setIsRunning(false);
    }
  };

  const ttl = "24";

  return (
    <div className="space-y-6">
      <Header title="Report Setup" subtitle="AI Governance Execution" />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Scheduled Batch Generation
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Configure separate schedules for each report type. Reports are cached to avoid repeated LLM calls.
          You can also manually trigger batch generation to refresh reports immediately.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cache TTL (hours)
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {ttl}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Reports cached for {ttl} hours
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Per-report schedules</div>
          <button
            type="button"
            onClick={loadSchedules}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Refresh
          </button>
        </div>

        {scheduleError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {scheduleError}
          </div>
        )}

        {scheduleLoading ? (
          <div className="mt-4 text-sm text-slate-500">Loading schedules...</div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {schedules.map((schedule) => {
              const meta = REPORT_LABELS[schedule.report_type] ?? {
                title: schedule.report_type,
                description: "",
              };
              const isUpdating = Boolean(updating[schedule.report_type]);
              return (
                <div
                  key={schedule.report_type}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{meta.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{meta.description}</div>
                    </div>
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        updateSchedule(schedule.report_type, {
                          enabled: !schedule.enabled,
                          run_hour_utc: schedule.run_hour_utc,
                        })
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        schedule.enabled
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      } ${isUpdating ? "cursor-not-allowed opacity-60" : ""}`}
                    >
                      {schedule.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
                    <span>Daily Run Time (UTC)</span>
                    <select
                      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                      value={schedule.run_hour_utc}
                      disabled={isUpdating}
                      onChange={(event) =>
                        updateSchedule(schedule.report_type, {
                          enabled: schedule.enabled,
                          run_hour_utc: Number(event.target.value),
                        })
                      }
                    >
                      {Array.from({ length: 24 }, (_, idx) => idx).map((hour) => (
                        <option key={hour} value={hour}>
                          {hour.toString().padStart(2, "0")}:00
                        </option>
                      ))}
                    </select>
                  </div>

                  {schedule.is_default && (
                    <div className="mt-2 text-[11px] text-slate-400">
                      Using defaults from environment until you update.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Manual Batch Generation</h2>
        <p className="mt-1 text-sm text-slate-600">
          Manually trigger batch generation to refresh all LLM reports and cache them immediately.
          This is useful when you want to pre-generate reports before the scheduled run.
        </p>

        <div className="mt-4">
          <button
            onClick={handleRunBatch}
            disabled={isRunning}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating reports...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run Batch Generation Now
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <XCircle className="h-5 w-5 shrink-0 text-red-600" />
            <div>
              <div className="text-sm font-semibold text-red-900">Error</div>
              <div className="mt-1 text-sm text-red-700">{error}</div>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-green-900">Batch Generation Complete</div>
                <div className="mt-2 grid gap-2 text-sm text-green-800">
                  <div>
                    <span className="font-medium">Total Processed:</span> {result.total_processed} projects
                  </div>
                  <div>
                    <span className="font-medium">Successful:</span>{" "}
                    <span className="text-green-700">{result.success_count}</span>
                  </div>
                  {result.error_count > 0 && (
                    <div>
                      <span className="font-medium">Failed:</span>{" "}
                      <span className="text-red-600">{result.error_count}</span>
                    </div>
                  )}
                </div>
                {result.results && result.results.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-green-700 hover:text-green-900">
                      View detailed results ({result.results.length} projects)
                    </summary>
                    <div className="mt-2 max-h-60 overflow-auto rounded-lg border border-green-200 bg-white p-3">
                      <div className="space-y-1 text-xs">
                        {result.results.map((r, idx) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between rounded px-2 py-1 ${
                              r.success ? "bg-green-50" : "bg-red-50"
                            }`}
                          >
                            <span className="font-mono text-slate-700">{r.project_slug}</span>
                            <span className="flex items-center gap-1">
                              {r.success ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                  {r.cached && (
                                    <span className="text-xs text-slate-500">(cached)</span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3 text-red-600" />
                                  <span className="text-xs text-red-600">{r.error}</span>
                                </>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
