import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

function baseUrl() {
  return (process.env.CORE_SVC_URL ?? process.env.NEXT_PUBLIC_CORE_SVC_URL ?? "http://localhost:8001").replace(/\/+$/,"");
}

export async function GET(req: Request, ctx: { params: { projectId: string } }) {
  const slug = ctx.params.projectId;
  const inUrl = new URL(req.url);
  const qs = inUrl.search ? inUrl.search : ""; // preserve ?window=...&grain=...
  const core = `${baseUrl()}/scorecard/${encodeURIComponent(slug)}/trends${qs}`;

  try {
    const res = await fetch(core, { cache: "no-store" });
    const status = res.status;

    if (res.headers.get("content-type")?.includes("application/json")) {
      const raw = await res.json();
      const overall = Array.isArray(raw) ? raw
        : Array.isArray(raw?.overall) ? raw.overall
        : Array.isArray(raw?.data) ? raw.data
        : [];
      return NextResponse.json({ overall }, { status });
    }

    return NextResponse.json({ overall: [] }, { status });
  } catch (e: any) {
    return NextResponse.json({ overall: [], error: String(e?.message ?? e) }, { status: 502 });
  }
}
