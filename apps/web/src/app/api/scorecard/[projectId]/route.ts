// src/app/api/scorecard/[projectId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth"; // NextAuth v5 helper

const CORE_BASE =
  process.env.CORE_SVC_URL ??
  process.env.NEXT_PUBLIC_CORE_SVC_URL ??
  "http://localhost:8001";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> } // Next 15: params is awaited
) {
  const { projectId } = await ctx.params;

  const session = await auth();
  const headers: Record<string, string> = {};
  if (session?.user?.id) headers["X-NextAuth-User-ID"] = session.user.id;

  try {
    const res = await fetch(
      `${CORE_BASE}/scorecard/${encodeURIComponent(projectId)}`,
      { cache: "no-store", headers },
    );

    const text = await res.text();

    try {
      return NextResponse.json(JSON.parse(text), { status: res.status });
    } catch {
      // Forward non-JSON (e.g., HTML error) as text
      return new NextResponse(text, { status: res.status });
    }
  } catch (err) {
    console.error("Error fetching scorecard from core-svc", {
      projectId,
      CORE_BASE,
      error: String(err),
    });

    return NextResponse.json(
      {
        error: "Failed to reach core-svc",
        projectId,
      },
      { status: 502 },
    );
  }
}

// Write endpoint: forward audit headers so FastAPI can set GUCs for historization
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const session = await auth(); // may be null if not signed in

  const postHeaders: Record<string, string> = {
    "content-type": "application/json",
    "X-User-Email": session?.user?.email ?? "anonymous@local",
    "X-Reason": "upsert scores",
    "X-Source": "web-ui",
  };
  if (session?.user?.id) postHeaders["X-NextAuth-User-ID"] = session.user.id;

  try {
    const res = await fetch(
      `${CORE_BASE}/scorecard/${encodeURIComponent(projectId)}`,
      { method: "POST", headers: postHeaders, body: JSON.stringify(body) },
    );

    const text = await res.text();
    try {
      return NextResponse.json(JSON.parse(text), { status: res.status });
    } catch {
      return new NextResponse(text, { status: res.status });
    }
  } catch (err) {
    console.error("Error posting scorecard to core-svc", {
      projectId,
      CORE_BASE,
      error: String(err),
    });

    return NextResponse.json(
      {
        error: "Failed to reach core-svc on POST",
        projectId,
      },
      { status: 502 },
    );
  }
}
