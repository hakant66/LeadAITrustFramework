// apps/web/app/health/page.tsx
// Simple UI page: /health (✅/❌ at a glance) + Qdrant support
"use client";

import { useEffect, useState } from "react";

type Svc = { ok: boolean; ms: number; error?: string };
type Health = {
  status: "ok" | "degraded";
  services: {
    postgres: Svc;
    redis: Svc;
    minio: Svc;
    qdrant?: Svc; // optional for backward-compat with older /api/health
  };
  at: string;
};

function Pill({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-xl text-sm ${
        ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
      }`}
    >
      {ok ? "✅ OK" : "❌ FAIL"}
    </span>
  );
}

function ServiceRow({
  label,
  svc,
}: {
  label: string;
  svc?: Svc;
}) {
  if (!svc) return null; // hide if the API doesn't report this service
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 font-medium">{label}</span>
      <Pill ok={svc.ok} />
      <span className="text-sm text-gray-500 ml-2">
        {svc.ms} ms {svc.error ? `— ${svc.error}` : ""}
      </span>
    </div>
  );
}

export default function HealthPage() {
  const [data, setData] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Infra Health</h1>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded bg-black text-white"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="mt-6">Checking services…</p>}

      {!loading && data && (
        <div className="mt-6 space-y-3">
          <ServiceRow label="Postgres" svc={data.services.postgres} />
          <ServiceRow label="Redis" svc={data.services.redis} />
          <ServiceRow label="MinIO" svc={data.services.minio} />
          <ServiceRow label="Qdrant" svc={data.services.qdrant} />

          <div className="pt-2 text-sm text-gray-600">
            Overall:{" "}
            <strong
              className={
                data.status === "ok" ? "text-green-700" : "text-amber-700"
              }
            >
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
