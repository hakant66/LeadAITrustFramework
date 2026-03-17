"use client";

import { useEffect, useState } from "react";
import Header from "@/app/(components)/Header";
import { coreApiBase } from "@/lib/coreApiBase";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type BuildResult = {
  scope: string;
  total_processed: number;
  success_count: number;
  error_count: number;
  errors?: { project_slug: string; error: string }[];
};

type ManifestRow = {
  project_slug: string;
  project_name?: string | null;
  manifest_json?: Record<string, any> | null;
  manifest_hash?: string | null;
  updated_at?: string | null;
  overall_score_pct?: number | null;
  overall_level?: string | null;
  evaluated_at?: string | null;
};

export default function ProvenanceSchedulePage({
  entityId,
}: {
  entityId?: string | null;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manifests, setManifests] = useState<ManifestRow[]>([]);
  const [loadingManifests, setLoadingManifests] = useState(false);

  const loadManifests = async () => {
    setLoadingManifests(true);
    try {
      const query = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : "";
      const res = await fetch(`${coreApiBase()}/admin/provenance-manifests${query}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to load manifests (${res.status})`);
      }
      const data = (await res.json()) as ManifestRow[];
      setManifests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load manifests");
    } finally {
      setLoadingManifests(false);
    }
  };

  useEffect(() => {
    loadManifests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunBuild = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      const query = entityId ? `?entity_id=${encodeURIComponent(entityId)}` : "";
      const res = await fetch(`${coreApiBase()}/admin/provenance-manifests/build${query}`, {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Provenance build failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as BuildResult;
      setResult(data);
      await loadManifests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run provenance build");
    } finally {
      setIsRunning(false);
    }
  };

  const scheduler = "on";
  const hour = "3";

  return (
    <div className="space-y-6">
      <Header title="Provenance Schedule" subtitle="AI Governance Execution" />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Scheduled Batch Run</h2>
        <p className="mt-1 text-sm text-slate-600">
          Provenance manifests are derived daily at a set time. You can also trigger a run manually below.
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
              Provenance build runs daily at {hour}:00 UTC
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Manual Build</h2>
        <p className="mt-1 text-sm text-slate-600">
          Trigger a provenance manifest build now. Use this after updating evidence or project metadata.
        </p>

        <div className="mt-4">
          <button
            onClick={handleRunBuild}
            disabled={isRunning}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Building...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Run Provenance Build Now
              </>
            )}
          </button>
          <div className="mt-2 text-xs text-slate-500">
            Updates: provenance_manifest_facts, provenance_evaluations
          </div>
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
                <div className="text-sm font-semibold text-green-900">
                  Provenance Build Complete
                </div>
                <div className="mt-2 grid gap-2 text-sm text-green-800">
                  <div>
                    <span className="font-medium">Scope:</span> {result.scope}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>{" "}
                    {result.error_count > 0 ? "Completed with errors" : "Success"}
                  </div>
                  <div>
                    <span className="font-medium">Projects:</span>{" "}
                    {result.success_count} succeeded, {result.error_count} failed
                  </div>
                </div>
                {result.errors?.length ? (
                  <div className="mt-2 text-xs text-green-700">
                    {result.errors.length} error(s) reported. See logs for details.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Derived Manifests
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Derived provenance manifest JSON per project.
            </p>
          </div>
          <button
            onClick={loadManifests}
            disabled={loadingManifests}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingManifests ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </>
            )}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {manifests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              No manifests found yet. Run the build above to generate them.
            </div>
          ) : (
            manifests.map((row) => (
              <details
                key={row.project_slug}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-slate-900">
                      {row.project_name || row.project_slug}
                    </div>
                    <div className="text-xs text-slate-600">
                      {row.overall_score_pct != null
                        ? `Provenance: ${Math.round(row.overall_score_pct)}% (${row.overall_level ?? "—"})`
                        : "No evaluation"}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {row.updated_at ? `Updated ${new Date(row.updated_at).toLocaleString()}` : "Not built yet"}
                  </div>
                </summary>
                <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-white p-3 text-xs text-slate-800">
                  {JSON.stringify(row.manifest_json ?? {}, null, 2)}
                </pre>
                {row.manifest_hash ? (
                  <div className="mt-2 text-xs text-slate-500">
                    Manifest hash: {row.manifest_hash}
                  </div>
                ) : null}
              </details>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
