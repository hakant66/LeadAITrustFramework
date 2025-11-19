// src/app/api/scorecard/[projectId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth"; // NextAuth v5 helper

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> } // Next 15: params is awaited
) {
  const { projectId } = await ctx.params;
  const base = process.env.CORE_SVC_URL ?? "http://localhost:8001";

  const res = await fetch(`${base}/scorecard/${encodeURIComponent(projectId)}`, {
    cache: "no-store",
  });

  const text = await res.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    // Forward non-JSON (e.g., HTML error) as text
    return new NextResponse(text, { status: res.status });
  }
}

// Write endpoint: forward audit headers so FastAPI can set GUCs for historization
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const base = process.env.CORE_SVC_URL ?? "http://localhost:8001";
  const body = await req.json().catch(() => ({}));

  const session = await auth(); // may be null if not signed in

  const res = await fetch(`${base}/scorecard/${encodeURIComponent(projectId)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // --- audit headers consumed by core-svc to set app.user/app.reason/app.source ---
      "X-User-Email": session?.user?.email ?? "anonymous@local",
      "X-Reason": "upsert scores",
      "X-Source": "web-ui",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return new NextResponse(text, { status: res.status });
  }
}
