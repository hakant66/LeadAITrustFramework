// apps/web/src/lib/regApiBase.ts
export function regApiBase(): string {
  if (typeof window !== "undefined") {
    return "/api/reg";
  }

  const base =
    process.env.REG_SVC_URL ??
    process.env.NEXT_PUBLIC_REG_SVC_URL ??
    "http://localhost:8002";

  return base.replace(/\/+$/, "");
}
