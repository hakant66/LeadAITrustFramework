// src/app/aireadinesscheck/r/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const { slug } = await context.params;

  try {
    const result = await pool.query(
      "SELECT pdf_url FROM ai_readiness_results WHERE slug = $1",
      [slug]
    );

    if (result.rowCount === 0) {
      const fallback = new URL("/aireadinesscheck", req.url);
      return NextResponse.redirect(fallback.toString(), 302);
    }

    const pdfUrl = result.rows[0]?.pdf_url as string | null;

    if (!pdfUrl) {
      const fallback = new URL("/aireadinesscheck", req.url);
      return NextResponse.redirect(fallback.toString(), 302);
    }

    // Ensure pdfUrl is a valid absolute URL (it should be a pre-signed MinIO URL)
    let absolute: string;
    try {
      absolute = new URL(pdfUrl).toString();
    } catch {
      // If somehow it's not a valid URL, fail safe
      const fallback = new URL("/aireadinesscheck", req.url);
      return NextResponse.redirect(fallback.toString(), 302);
    }

    // Redirect to the pre-signed URL
    return NextResponse.redirect(absolute, 302);
  } catch (error) {
    console.error("Error in /aireadinesscheck/r/[slug] redirect", error);
    const fallback = new URL("/aireadinesscheck", req.url);
    return NextResponse.redirect(fallback.toString(), 302);
  }
}
