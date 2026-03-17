// apps/web/src/app/api/core/[...slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const CORE_BASE = process.env.CORE_SVC_URL ?? "http://localhost:8001";
const MAX_UPSTREAM_RETRIES = 2;
const RETRY_DELAY_MS = 250;

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

function buildUrl(slug: string[], search: string): string {
  const base = CORE_BASE.replace(/\/+$/, "");
  const path = slug.map(encodeURIComponent).join("/");
  return `${base}/${path}${search}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryUpstream(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = (error as Error & { cause?: unknown }).cause;
  if (!(cause instanceof Error)) return false;
  const code = (cause as Error & { code?: string }).code;
  return code === "ECONNREFUSED" || code === "ECONNRESET" || code === "EHOSTUNREACH";
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await ctx.params;
  const url = buildUrl(slug, req.nextUrl.search);

  const headers = new Headers(req.headers);
  HOP_BY_HOP_HEADERS.forEach((h) => headers.delete(h));

  // Extract NextAuth session and get user ID
  const session = await auth();
  if (session?.user?.id) {
    // Pass NextAuth user ID to backend for mapping
    headers.set("X-NextAuth-User-ID", session.user.id);
  }

  // Extract entity_id from query params or headers and forward to backend
  const entityId = req.nextUrl.searchParams.get("entity_id") || req.headers.get("X-Entity-ID");
  if (entityId) {
    headers.set("X-Entity-ID", entityId);
  }

  const method = req.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  let upstream: Response | null = null;
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_UPSTREAM_RETRIES; attempt++) {
      try {
        upstream = await fetch(url, { method, headers, body });
        break;
      } catch (error) {
        lastError = error;
        if (attempt >= MAX_UPSTREAM_RETRIES || !shouldRetryUpstream(error)) {
          throw error;
        }
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  } catch (error) {
    console.error("Upstream core proxy request failed", {
      url,
      method,
      error,
    });
    return NextResponse.json(
      { detail: "Core service temporarily unavailable. Please retry." },
      { status: 502 }
    );
  }
  if (!upstream) {
    return NextResponse.json(
      { detail: "Core service temporarily unavailable. Please retry." },
      { status: 502 }
    );
  }
  const respHeaders = new Headers(upstream.headers);
  HOP_BY_HOP_HEADERS.forEach((h) => respHeaders.delete(h));

  const hasNoBodyStatus =
    upstream.status === 204 || upstream.status === 205 || upstream.status === 304;
  if (method === "HEAD" || hasNoBodyStatus) {
    return new NextResponse(null, {
      status: upstream.status,
      headers: respHeaders,
    });
  }

  const respBody = await upstream.arrayBuffer();

  return new NextResponse(respBody, {
    status: upstream.status,
    headers: respHeaders,
  });
}

export function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  return proxy(req, ctx);
}

export function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  return proxy(req, ctx);
}

export function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  return proxy(req, ctx);
}

export function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  return proxy(req, ctx);
}

export function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  return proxy(req, ctx);
}
