// apps/web/src/app/api/reg/[...slug]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REG_BASE = process.env.REG_SVC_URL ?? "http://localhost:8002";

function buildUrl(slug: string[], search: string): string {
  const base = REG_BASE.replace(/\/+$/, "");
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
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const method = req.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  const upstream = await fetch(url, { method, headers, body });
  const respBody = await upstream.arrayBuffer();
  const respHeaders = new Headers(upstream.headers);

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
