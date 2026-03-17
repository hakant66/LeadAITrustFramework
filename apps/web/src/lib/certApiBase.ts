// apps/web/src/lib/certApiBase.ts
export function certApiBase(): string {
  if (typeof window !== "undefined") {
    return "/api/cert";
  }

  const base =
    process.env.CERT_SVC_URL ??
    process.env.NEXT_PUBLIC_CERT_SVC_URL ??
    "http://localhost:8003";

  return base.replace(/\/+$/, "");
}
