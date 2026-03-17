// apps/web/src/lib/coreApiBase.ts
export function coreApiBase(): string {
  if (typeof window !== "undefined") {
    return "/api/core";
  }

  const base =
    process.env.CORE_SVC_URL ??
    process.env.NEXT_PUBLIC_CORE_SVC_URL ??
    "http://localhost:8001";

  return base.replace(/\/+$/, "");
}
