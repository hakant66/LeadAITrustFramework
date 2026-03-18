import { NextResponse, type NextRequest } from "next/server";
import { SINGLE_TENANT_SLUG } from "@/lib/singleTenant";

const singleTenantUi =
  (process.env.LEADAI_SINGLE_TENANT_UI ??
    process.env.NEXT_PUBLIC_LEADAI_SINGLE_TENANT_UI ??
    "true") !== "false";

const ENTITY_SCOPED_PREFIXES = new Set(["scorecard", "admin", "projects"]);

export async function middleware(request: NextRequest) {
  if (!singleTenantUi) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length < 1) return NextResponse.next();

  const canonicalSlug = SINGLE_TENANT_SLUG?.trim() || null;
  if (!canonicalSlug) {
    return NextResponse.next();
  }

  const firstSegment = parts[0];
  if (ENTITY_SCOPED_PREFIXES.has(firstSegment)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${[canonicalSlug, ...parts].map(encodeURIComponent).join("/")}`;
    return NextResponse.redirect(url);
  }

  if (parts.length < 2) return NextResponse.next();

  const [entitySlug, scopedPrefix] = parts;
  if (!ENTITY_SCOPED_PREFIXES.has(scopedPrefix)) {
    return NextResponse.next();
  }

  if (canonicalSlug === entitySlug) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${[canonicalSlug, ...parts.slice(1)].map(encodeURIComponent).join("/")}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"],
};
