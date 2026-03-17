// apps/web/src/app/api/cert/[...slug]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CERT_BASE = process.env.CERT_SVC_URL ?? "http://localhost:8003";

function buildUrl(slug: string[], search: string): string {
  const base = CERT_BASE.replace(/\/+$/, "");
  const path = slug.map(encodeURIComponent).join("/");
  return `${base}/${path}${search}`;
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await ctx.params;
  const url = buildUrl(slug, req.nextUrl.search);

  const headers = new Headers(req.headers);
  // Remove hop-by-hop headers that must not be forwarded.
  for (const h of [
    "host",
    "connection",
    "content-length",
    "transfer-encoding",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "upgrade",
  ]) {
    headers.delete(h);
  }

  const method = req.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  const upstream = await fetch(url, { method, headers, body });
  const respBody = await upstream.arrayBuffer();
  const respHeaders = new Headers(upstream.headers);
  // Remove hop-by-hop headers from upstream response.
  for (const h of [
    "connection",
    "content-length",
    "transfer-encoding",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "upgrade",
  ]) {
    respHeaders.delete(h);
  }

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
