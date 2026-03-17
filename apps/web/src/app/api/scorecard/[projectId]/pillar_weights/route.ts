// apps/web/src/app/api/scorecard/[projectId]/pillar_weights/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CORE =
  process.env.CORE_SVC_URL ||
  process.env.NEXT_PUBLIC_CORE_SVC_URL ||
  "http://localhost:8001";

function coreUrl(projectId: string) {
  return `${CORE}/scorecard/${encodeURIComponent(projectId)}/pillar_weights`;
}

type UIItem = {
  id?: string | null;
  pillar_key: string;
  weight?: number;       // fraction 0..1 (preferred)
  weight_pct?: number;   // percent 0..100 (fallback from some UIs)
};

function clamp01(x: number) {
  if (Number.isNaN(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;

  // Core typically doesn’t expose a GET for pillar_weights,
  // so fall back to pillars and extract weights if you want.
  // If you DO have a GET at /pillar_weights on core, just proxy it:
  const res = await fetch(coreUrl(projectId), { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch pillar weights" },
      { status: res.status }
    );
  }
  const data = await res.json();
  return NextResponse.json(data);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;

  // Accept body as:
  // - { items: UIItem[] }
  // - UIItem[]
  // - UIItem
  const incoming = (await req.json()) as { items?: UIItem[] } | UIItem[] | UIItem;

  const items: UIItem[] = Array.isArray(incoming)
    ? incoming
    : (incoming as any)?.items
    ? (incoming as any).items
    : [incoming as UIItem];

  // Always forward as {items:[{id?, pillar_key, weight}]}, where weight is 0..1
  const toFraction = (it: UIItem) => {
    if (typeof it.weight === "number") return clamp01(Number(it.weight.toFixed(4)));
    if (typeof it.weight_pct === "number")
      return clamp01(Number((it.weight_pct / 100).toFixed(4)));
    return 0;
  };

  const payload = {
    items: items.map((it) => ({
      id: it.id ?? null,
      pillar_key: it.pillar_key,
      weight: toFraction(it), // <-- fraction 0..1 as core expects
    })),
  };

  // Optional debug: open devtools Network tab to verify outgoing body
  // console.log("Forwarding payload to core:", payload);

  const res = await fetch(coreUrl(projectId), {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...(req.headers.get("authorization")
        ? { authorization: req.headers.get("authorization") as string }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
