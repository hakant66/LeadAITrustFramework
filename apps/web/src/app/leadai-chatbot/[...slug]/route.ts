// apps/web/src/app/leadai-chatbot/[...slug]/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function redirectToBase(req: NextRequest) {
  const url = new URL("/leadai-chatbot", req.url);
  url.search = req.nextUrl.search;
  return NextResponse.redirect(url, 307);
}

export function GET(req: NextRequest) {
  return redirectToBase(req);
}

export function POST(req: NextRequest) {
  return redirectToBase(req);
}

export function PUT(req: NextRequest) {
  return redirectToBase(req);
}

export function PATCH(req: NextRequest) {
  return redirectToBase(req);
}

export function DELETE(req: NextRequest) {
  return redirectToBase(req);
}

export function OPTIONS(req: NextRequest) {
  return redirectToBase(req);
}
