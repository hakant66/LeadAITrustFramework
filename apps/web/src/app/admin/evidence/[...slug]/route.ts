import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CORE_BASE = process.env.CORE_SVC_URL ?? "http://localhost:8001";

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
  return `${base}/admin/evidence/${path}${search}`;
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await ctx.params;
  const url = buildUrl(slug, req.nextUrl.search);

  const headers = new Headers(req.headers);
  HOP_BY_HOP_HEADERS.forEach((h) => headers.delete(h));

  const method = req.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  const upstream = await fetch(url, { method, headers, body });
  const respBody = await upstream.arrayBuffer();
  const respHeaders = new Headers(upstream.headers);
  HOP_BY_HOP_HEADERS.forEach((h) => respHeaders.delete(h));

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
