// src/app/api/health/route.ts
// server-side pings (+ Qdrant) — simplified to avoid SWC parsing quirks

import { NextResponse } from "next/server";
import { Client as PgClient } from "pg";
import Redis from "ioredis";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs"; // ensure Node runtime (pg/redis/aws-sdk need Node)

// ---- Types (erased at build) ----
type Svc = { ok: boolean; ms: number; error?: string };
type HealthBody = {
  status: "ok" | "degraded";
  services: { postgres: Svc; redis: Svc; minio: Svc; qdrant: Svc };
  at: string;
};

// ---- Helpers ----
function svcError(ms: number, e: unknown): Svc {
  const msg =
    (e as any)?.message ??
    (typeof e === "string" ? e : "error");
  return { ok: false, ms, error: msg };
}

async function pingPostgres(): Promise<Svc> {
  const client = new PgClient({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    connectionTimeoutMillis: 3000,
  });
  const start = Date.now();
  try {
    await client.connect();
    const r = await client.query("SELECT 1 as up");
    return { ok: r.rows?.[0]?.up === 1, ms: Date.now() - start };
  } catch (e) {
    return svcError(Date.now() - start, e);
  } finally {
    try { await client.end(); } catch {}
  }
}

async function pingRedis(): Promise<Svc> {
  const start = Date.now();
  const redis = new Redis(process.env.REDIS_URL as string, {
    lazyConnect: true,
    connectTimeout: 3000,
  });
  try {
    await redis.connect();
    const res = await redis.ping();
    return { ok: res === "PONG", ms: Date.now() - start };
  } catch (e) {
    return svcError(Date.now() - start, e);
  } finally {
    try { await redis.quit(); } catch {}
  }
}

function s3() {
  return new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
  });
}

async function pingMinio(): Promise<Svc> {
  const start = Date.now();
  try {
    await s3().send(new ListBucketsCommand({}));
    return { ok: true, ms: Date.now() - start };
  } catch (e) {
    return svcError(Date.now() - start, e);
  }
}

// Prefer /readyz; fall back to /healthz
async function pingQdrant(): Promise<Svc> {
  const start = Date.now();
  const base = process.env.QDRANT_URL; // e.g. http://qdrant:6333
  if (!base) return { ok: false, ms: 0, error: "QDRANT_URL not set" };

  const headers: Record<string, string> = {};
  if (process.env.QDRANT_API_KEY) headers["api-key"] = process.env.QDRANT_API_KEY as string;

  try {
    const tryOne = async (path: string) => {
      const res = await fetch(`${base}${path}`, { headers, cache: "no-store" });
      if (!res.ok) throw new Error(`${path} ${res.status}`);
    };

    try {
      await tryOne("/readyz");
    } catch {
      await tryOne("/healthz");
    }

    return { ok: true, ms: Date.now() - start };
  } catch (e) {
    return svcError(Date.now() - start, e);
  }
}

// Timeout cap without generics/casts (keeps bundler happy)
function cap(p: Promise<Svc>, ms = 5000): Promise<Svc> {
  const to = new Promise<Svc>((_, rej) =>
    setTimeout(() => rej(new Error("timeout")), ms)
  );
  return Promise.race([p, to]).catch((e) => ({ ok: false, ms, error: (e as any)?.message ?? "timeout" }));
}

export async function GET() {
  const [pg, redis, minio, qdrant] = await Promise.all([
    cap(pingPostgres()),
    cap(pingRedis()),
    cap(pingMinio()),
    cap(pingQdrant()),
  ]);

  const allOk = pg.ok && redis.ok && minio.ok && qdrant.ok;

  const body: HealthBody = {
    status: allOk ? "ok" : "degraded",
    services: { postgres: pg, redis, minio, qdrant },
    at: new Date().toISOString(),
  };

  return NextResponse.json(body, { status: allOk ? 200 : 503 });
}
