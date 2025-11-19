// web/src/app/api/scorecard/[projectId]/pillars/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";

type Ctx = { params: Promise<{ projectId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { projectId } = await ctx.params; // Next 15: params is a Promise
  const body = (await req.json().catch(() => ({}))) as any;

  // Expect { project_id, pillars: [{ pillar, score_pct, maturity? }] }
  const pillars = Array.isArray(body.pillars) ? body.pillars : [];
  const cleaned = pillars
    .map((p: any) => ({
      pillar: String(p.pillar ?? "").trim(),
      score_pct: Math.max(0, Math.min(100, Math.trunc(Number(p.score_pct)) || 0)),
      maturity: Number.isFinite(p.maturity) ? Math.trunc(p.maturity) : undefined,
    }))
    .filter((p) => p.pillar.length);

  if (!cleaned.length) {
    return NextResponse.json({ error: "No pillars to save." }, { status: 400 });
  }

  const payload = {
    project_id: String(body.project_id ?? projectId),
    pillars: cleaned,
  };

  const base = process.env.CORE_SVC_URL ?? "http://localhost:8001";

  // Get session and forward audit headers to core-svc
  const session = await auth();

  const res = await fetch(`${base}/scorecard/${encodeURIComponent(projectId)}/pillars`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // --- audit headers consumed by FastAPI to set app.user/app.reason/app.source ---
      "X-User-Email": session?.user?.email ?? "anonymous@local",
      "X-Reason": "upsert pillar overrides",
      "X-Source": "web-ui",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: res.status });
  } catch {
    return new NextResponse(text, { status: res.status });
  }
}
