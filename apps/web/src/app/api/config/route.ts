// src/app/api/config/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }
  return NextResponse.json({
    coreSvcBaseUrl: process.env.CORE_SVC_URL ?? "http://localhost:8001",
    postgres: { host: process.env.PGHOST ?? "localhost", port: Number(process.env.PGPORT ?? 5432) },
    redis: { url: process.env.REDIS_URL ?? "redis://localhost:6379/0" },
    minio: { endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000", bucket: process.env.S3_BUCKET ?? "evidence" },
  });
}