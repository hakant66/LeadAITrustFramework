// apps/web/app/health/page.tsx
// Simple UI page: /health (✅/❌ at a glance)
//  "use client";

import { useEffect, useState } from "react";

type HealthResp = {
  status: "ok" | "degraded";
  services: {
    postgres: { ok: boolean; ms: number; error?: string };
    redis: { ok: boolean; ms: number; error?: string };
    minio: { ok: boolean; ms: number; error?: string };
  };
  at: string;
};

export default function HealthPage() {
  const [data, setData] = useState<HealthResp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const json = (await res.json()) as HealthResp;
      setData(json);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pill = (ok: boolean) => (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-xl text-sm font-medium ${
        ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {ok ? "✅ OK" : "❌ FAIL"}
    </span>
  );

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Infra Health</h1>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white hover:opacity-90"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="mt-6">Checking services…</p>}

      {!loading && data && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="w-36 font-medium">Postgres</span>
            {pill(data.services.postgres.ok)}
            <span className="text-sm text-gray-500 ml-2">
              {data.services.postgres.ms} ms
              {data.services.postgres.error ? ` — ${data.services.postgres.error}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-36 font-medium">Redis</span>
            {pill(data.services.redis.ok)}
            <span className="text-sm text-gray-500 ml-2">
              {data.services.redis.ms} ms
              {data.services.redis.error ? ` — ${data.services.redis.error}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-36 font-medium">MinIO</span>
            {pill(data.services.minio.ok)}
            <span className="text-sm text-gray-500 ml-2">
              {data.services.minio.ms} ms
              {data.services.minio.error ? ` — ${data.services.minio.error}` : ""}
            </span>
          </div>

          <div className="pt-2 text-sm text-gray-600">
            Overall:{" "}
            <strong className={data.status === "ok" ? "text-green-700" : "text-amber-700"}>
              {data.status.toUpperCase()}
            </strong>{" "}
            • Updated: {new Date(data.at).toLocaleString()}
          </div>
        </div>
      )}

      {!loading && !data && (
        <p className="mt-6 text-red-700">
          Couldn’t reach <code>/api/health</code>. Is the dev server running?
        </p>
      )}
    </main>
  );
}
