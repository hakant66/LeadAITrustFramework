// apps/web/src/app/api/resources/[...slug]/route.ts
import { NextRequest, NextResponse } from "next/server";

const MCP_BASE = process.env.MCP_SERVER_URL ?? "http://localhost:8787";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await ctx.params;
    const url = `${MCP_BASE}/resources/${slug.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
    const upstream = await fetch(url);
    const body = await upstream.text(); // ok for json/text; adjust if you need binary
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "text/plain",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
