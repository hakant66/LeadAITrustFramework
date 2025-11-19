// src/app/api/projects/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }   // <- params is not a Promise in App Router
) {
  try {
    const { slug } = params;

    // Get the logged-in user (NextAuth v5)
    const session = await auth();
    // Optional hard block (uncomment if you want to require auth)
    // if (!session) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const base = process.env.CORE_SVC_URL ?? "http://localhost:8001";

    const res = await fetch(`${base}/projects/${encodeURIComponent(slug)}`, {
      method: "DELETE",
      headers: {
        // not strictly needed for DELETE, but harmless
        "content-type": "application/json",

        // --- AUDIT HEADERS forwarded to core-svc ---
        "X-User-Email": session?.user?.email ?? "anonymous@local",
        "X-Reason": "delete project",
        "X-Source": "web-ui",
      },
      cache: "no-store",
    });

    if (res.status === 204) return new NextResponse(null, { status: 204 });
    if (res.ok) return new NextResponse(await res.text().catch(() => ""), { status: 200 });

    const errText = await res.text().catch(() => "");
    return new NextResponse(errText || "Delete failed", { status: res.status || 500 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Could not reach core service", detail: String(err?.message ?? err) },
      { status: 502 }
    );
  }
}
