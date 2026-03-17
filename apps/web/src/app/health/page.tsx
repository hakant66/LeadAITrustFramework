// apps/web/app/health/page.tsx
// Simple UI page: /health (✅/❌ at a glance) + Qdrant support
"use client";

import { useEffect, useState } from "react";

type Svc = { ok: boolean; ms: number; error?: string; status?: number };
type Health = {
  status: "ok" | "degraded";
  http: {
    web: Svc;
    coreSvc: Svc;
    mcp: Svc;
    qdrant: Svc;
    ollama: Svc;
    minio: Svc;
    dify: Svc;
    leadaiChatbot: Svc;
    langfuse: Svc;
  };
  tcp: {
    redis: Svc;
    postgres: Svc;
  };
  db: {
    pgvector: Svc;
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
  detail,
  svc,
}: {
  label: string;
  detail?: string;
  svc?: Svc;
}) {
  if (!svc) return null; // hide if the API doesn't report this service
  const statusLabel = svc.status
    ? `${svc.status} ${svc.ok ? "OK" : "FAIL"}`
    : svc.ok
    ? "OK"
    : "FAIL";
  return (
    <div className="flex items-center gap-3">
      <span className="w-56 font-medium">
        {label}
        {detail ? <span className="text-gray-500"> {detail}</span> : null}
      </span>
      <Pill ok={svc.ok} />
      <span className="text-sm text-gray-500 ml-2">
        {statusLabel}
        {typeof svc.ms === "number" ? ` · ${svc.ms} ms` : ""}
        {svc.error ? ` · ${svc.error}` : ""}
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
        <div className="mt-6 space-y-4">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">HTTP services</div>
            <ServiceRow label="web" detail="/health" svc={data.http.web} />
            <ServiceRow label="core-svc" detail="/healthz" svc={data.http.coreSvc} />
            <ServiceRow label="mcp" detail="/health" svc={data.http.mcp} />
            <ServiceRow label="qdrant" detail="/healthz" svc={data.http.qdrant} />
            <ServiceRow label="ollama" detail="/api/version" svc={data.http.ollama} />
            <ServiceRow label="minio" detail="/minio/health/ready" svc={data.http.minio} />
            <ServiceRow label="langfuse" detail="/" svc={data.http.langfuse} />
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">TCP ports</div>
            <ServiceRow label="redis" detail="tcp:6379" svc={data.tcp.redis} />
            <ServiceRow label="postgres" detail="tcp:5432" svc={data.tcp.postgres} />
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">
              Chatbot health
              <span className="ml-2 text-xs font-normal text-gray-500">(non-blocking)</span>
            </div>
            <ServiceRow label="dify" detail="/" svc={data.http.dify} />
            <ServiceRow label="leadai-chatbot" detail="/docs" svc={data.http.leadaiChatbot} />
            <ServiceRow label="pgvector" detail="extension + rag schema/tables" svc={data.db.pgvector} />
          </div>

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
