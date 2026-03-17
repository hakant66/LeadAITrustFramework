// apps/web/src/app/api/tools/[...slug]/route.ts
import { NextRequest, NextResponse } from "next/server";

const MCP_BASE = process.env.MCP_SERVER_URL ?? "http://localhost:8787";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await ctx.params;
    const url = `${MCP_BASE}/tools/${slug.join("/")}${req.nextUrl.search}`;
    const upstream = await fetch(url, { method: "GET" });
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await ctx.params;
    const url = `${MCP_BASE}/tools/${slug.join("/")}`;
    const body = await req.text();
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
