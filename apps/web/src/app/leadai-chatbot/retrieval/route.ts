// apps/web/src/app/leadai-chatbot/retrieval/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ADAPTER_BASE =
  process.env.LEADAI_CHATBOT_ADAPTER_URL ?? "http://leadai-chatbot:8000";

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

function buildUrl(search: string): string {
  const base = ADAPTER_BASE.replace(/\/+$/, "");
  return `${base}/retrieval${search}`;
}

async function proxy(req: NextRequest) {
  const url = buildUrl(req.nextUrl.search);

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

export function POST(req: NextRequest) {
  return proxy(req);
}

export function OPTIONS(req: NextRequest) {
  return proxy(req);
}
