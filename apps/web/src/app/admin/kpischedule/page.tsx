"use client";

import { useState } from "react";
import Header from "@/app/(components)/Header";
import { coreApiBase } from "@/lib/coreApiBase";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type KpiRecomputeResult = {
  scope: string;
  status: string;
  kpis?: { scope?: string; updated?: number; skipped?: number; status?: string };
  pillars?: { scope?: string; updated?: number; skipped?: number; status?: string };
  reason?: string;
};

export default function KPISchedulePage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<KpiRecomputeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunRecompute = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${coreApiBase()}/admin/kpi-recompute`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `KPI recompute failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as KpiRecomputeResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run KPI recompute");
    } finally {
      setIsRunning(false);
    }
  };

  // Display configuration (matches env: KPI_RECOMPUTE_BATCH_SCHEDULER, KPI_RECOMPUTE_DAILY_HOUR)
  const scheduler = "on";
  const hour = "3";

  return (
    <div className="space-y-6">
      <Header title="KPI Schedule" subtitle="AI Governance Execution" />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Scheduled Batch Run
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          KPI scores (and pillar scores) are recomputed daily at a set time. You can also trigger a run manually below.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Scheduler Status
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {scheduler === "on" ? "Enabled" : "Disabled"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Daily batch job {scheduler === "on" ? "active" : "inactive"}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Daily Run Time (UTC)
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {hour}:00
            </div>
            <div className="mt-1 text-xs text-slate-500">
              KPI recompute runs daily at {hour}:00 UTC
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Manual Recompute</h2>
        <p className="mt-1 text-sm text-slate-600">
          Trigger KPI and pillar recompute now. Use this after bulk data updates or when
          you want project trust scores to reflect the latest evidence.
        </p>

        <div className="mt-4">
          <button
            onClick={handleRunRecompute}
            disabled={isRunning}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Recomputing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run KPI Recompute Now
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
                <div className="text-sm font-semibold text-green-900">KPI Recompute Complete</div>
                <div className="mt-2 grid gap-2 text-sm text-green-800">
                  <div>
                    <span className="font-medium">Scope:</span> {result.scope}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> {result.status}
                  </div>
                  {result.kpis && (
                    <div>
                      <span className="font-medium">KPIs:</span>{" "}
                      updated={result.kpis.updated ?? "—"}, skipped={result.kpis.skipped ?? "—"}
                    </div>
                  )}
                  {result.pillars && (
                    <div>
                      <span className="font-medium">Pillars:</span>{" "}
                      updated={result.pillars.updated ?? "—"}, skipped={result.pillars.skipped ?? "—"}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-green-700">
                  This action has been recorded in the audit log.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
