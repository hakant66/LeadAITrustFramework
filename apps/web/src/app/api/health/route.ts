// src/app/api/health/route.ts
// server-side pings (HTTP + TCP) – simplified to avoid SWC parsing quirks

import { NextResponse } from "next/server";
import net from "node:net";
import { Client } from "pg";

export const runtime = "nodejs"; // ensure Node runtime (pg/redis/aws-sdk need Node)

// ---- Types (erased at build) ----
type Svc = { ok: boolean; ms: number; error?: string; status?: number };
type HealthBody = {
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
  tcp: { redis: Svc; postgres: Svc };
  db: { pgvector: Svc };
  at: string;
};

// ---- Helpers ----
function svcError(ms: number, e: unknown): Svc {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : "error";
  return { ok: false, ms, error: msg };
}

async function pingHttp(url: string): Promise<Svc> {
  const start = Date.now();
  if (!url) return { ok: false, ms: 0, error: "url not set" };
  try {
    const res = await fetch(url, { cache: "no-store" });
    const ok = res.status >= 200 && res.status < 400;
    return { ok, ms: Date.now() - start, status: res.status };
  } catch (e) {
    return svcError(Date.now() - start, e);
  }
}

async function pingFirstHealthy(urls: string[]): Promise<Svc> {
  let last: Svc = { ok: false, ms: 0, error: "no urls configured" };
  for (const raw of urls) {
    const url = (raw ?? "").trim();
    if (!url) continue;
    const svc = await pingHttp(url);
    if (svc.ok) return svc;
    last = svc;
  }
  return last;
}

// Prefer /readyz; fall back to /healthz
async function pingQdrant(): Promise<Svc> {
  const base = process.env.QDRANT_URL ?? "http://localhost:6333";
  const headers: Record<string, string> = {};
  if (process.env.QDRANT_API_KEY) headers["api-key"] = process.env.QDRANT_API_KEY as string;

  const start = Date.now();
  try {
    const tryOne = async (path: string) => {
      const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
      if (!res.ok) throw new Error(`${path} ${res.status}`);
      return res.status;
    };

    let status = 0;
    try {
      status = await tryOne("/readyz");
    } catch {
      status = await tryOne("/healthz");
    }

    return { ok: true, ms: Date.now() - start, status };
  } catch (e) {
    return svcError(Date.now() - start, e);
  }
}

function pingTcp(host: string, port: number, timeoutMs = 3000): Promise<Svc> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok: boolean, error?: string) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({ ok, ms: Date.now() - start, error });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.once("error", (err) => finish(false, err.message));
    socket.connect(port, host);
  });
}

async function pingPgvector(
  pgHost: string,
  pgPort: number,
  pgUser: string,
  pgPassword: string,
  pgDatabase: string,
  schemaName = process.env.PGVECTOR_SCHEMA ?? "rag"
): Promise<Svc> {
  const start = Date.now();
  const client = new Client({
    host: pgHost,
    port: pgPort,
    user: pgUser,
    password: pgPassword,
    database: pgDatabase,
  });

  try {
    await client.connect();

    const extRes = await client.query<{ has_vector: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS has_vector"
    );
    const schemaRes = await client.query<{ has_schema: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS has_schema",
      [schemaName]
    );
    const tableRes = await client.query<{ has_table: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1) AS has_table",
      [schemaName]
    );
    const vectorColRes = await client.query<{ has_vector_column: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        JOIN pg_catalog.pg_namespace n ON n.nspname = c.table_schema
        JOIN pg_catalog.pg_class cl ON cl.relname = c.table_name AND cl.relnamespace = n.oid
        JOIN pg_catalog.pg_attribute a ON a.attrelid = cl.oid AND a.attname = c.column_name
        JOIN pg_catalog.pg_type t ON t.oid = a.atttypid
        WHERE c.table_schema = $1 AND t.typname = 'vector'
      ) AS has_vector_column
      `,
      [schemaName]
    );

    const hasVector = Boolean(extRes.rows[0]?.has_vector);
    const hasSchema = Boolean(schemaRes.rows[0]?.has_schema);
    const hasTable = Boolean(tableRes.rows[0]?.has_table);
    const hasVectorColumn = Boolean(vectorColRes.rows[0]?.has_vector_column);

    const ok = hasVector && hasSchema && hasTable && hasVectorColumn;
    const missing: string[] = [];
    if (!hasVector) missing.push("extension(vector)");
    if (!hasSchema) missing.push(`schema(${schemaName})`);
    if (!hasTable) missing.push(`table-in-schema(${schemaName})`);
    if (!hasVectorColumn) missing.push(`vector-column-in-schema(${schemaName})`);

    return {
      ok,
      ms: Date.now() - start,
      status: ok ? 200 : 503,
      error: ok ? undefined : `Missing: ${missing.join(", ")}`,
    };
  } catch (e) {
    return svcError(Date.now() - start, e);
  } finally {
    await client.end().catch(() => undefined);
  }
}

// Timeout cap without generics/casts (keeps bundler happy)
function cap(p: Promise<Svc>, ms = 5000): Promise<Svc> {
  const to = new Promise<Svc>((_, rej) =>
    setTimeout(() => rej(new Error("timeout")), ms)
  );
  return Promise.race([p, to]).catch((e: unknown) => ({
    ok: false,
    ms,
    error: e instanceof Error ? e.message : "timeout",
  }));
}

export async function GET() {
  const webUrl = process.env.WEB_HEALTH_URL ?? "http://localhost:3000/health";
  const coreBase = (process.env.CORE_SVC_URL ?? "http://localhost:8001").replace(/\/+$/, "");
  const mcpBase = (process.env.MCP_SERVER_URL ?? "http://localhost:8787").replace(/\/+$/, "");
  const ollamaBase = (process.env.OLLAMA_URL ?? "http://localhost:11434").replace(/\/+$/, "");
  const minioBase =
    (process.env.MINIO_ENDPOINT ?? process.env.S3_ENDPOINT ?? "http://localhost:9000")
      .replace(/\/+$/, "");
  const difyBase = (process.env.DIFY_WEBAPP_ORIGIN ?? "http://host.docker.internal:8080").replace(/\/+$/, "");
  const difyHealthUrl = (process.env.DIFY_HEALTH_URL ?? "").trim();
  const chatbotBase =
    (process.env.LEADAI_CHATBOT_ADAPTER_URL ?? "http://leadai-chatbot:8000").replace(/\/+$/, "");
  const langfuseBase = (process.env.LANGFUSE_BASE_URL ?? "http://langfuse-web:3000").replace(/\/+$/, "");

  const redisUrl = process.env.REDIS_URL ?? "redis://redis:6379/0";
  let redisHost = "redis";
  let redisPort = 6379;
  try {
    const parsed = new URL(redisUrl);
    redisHost = parsed.hostname;
    redisPort = Number(parsed.port || 6379);
  } catch {}

  const pgHost = process.env.PGHOST ?? "postgres";
  const pgPort = Number(process.env.PGPORT ?? 5432);
  const pgUser = process.env.PGUSER ?? "leadai";
  const pgPassword = process.env.PGPASSWORD ?? "leadai";
  const pgDatabase = process.env.PGDATABASE ?? "leadai";

  const [web, coreSvc, mcp, qdrant, ollama, minio, dify, leadaiChatbot, langfuse, redis, postgres, pgvector] = await Promise.all([
    cap(pingHttp(webUrl)),
    cap(pingHttp(`${coreBase}/healthz`)),
    cap(pingHttp(`${mcpBase}/health`)),
    cap(pingQdrant()),
    cap(pingHttp(`${ollamaBase}/api/version`)),
    cap(pingHttp(`${minioBase}/minio/health/ready`)),
    cap(
      pingFirstHealthy([
        difyHealthUrl,
        difyBase,
        `${difyBase}/apps`,
        "http://host.docker.internal:8080",
        "http://host.docker.internal:8080/apps",
        "https://dev.theleadai.co.uk",
      ])
    ),
    cap(pingHttp(`${chatbotBase}/docs`)),
    cap(pingHttp(langfuseBase)),
    cap(pingTcp(redisHost, redisPort)),
    cap(pingTcp(pgHost, pgPort)),
    cap(pingPgvector(pgHost, pgPort, pgUser, pgPassword, pgDatabase)),
  ]);

  const allOk =
    web.ok &&
    coreSvc.ok &&
    mcp.ok &&
    qdrant.ok &&
    ollama.ok &&
    minio.ok &&
    redis.ok &&
    postgres.ok;

  const body: HealthBody = {
    status: allOk ? "ok" : "degraded",
    http: { web, coreSvc, mcp, qdrant, ollama, minio, dify, leadaiChatbot, langfuse },
    tcp: { redis, postgres },
    db: { pgvector },
    at: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: allOk ? 200 : 503 });
}
