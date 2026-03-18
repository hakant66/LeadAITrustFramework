import { cookies } from "next/headers";
import { SINGLE_TENANT_UI } from "@/lib/singleTenant";

export type SingleTenantEntity = {
  entity_id: string;
  role: string;
  name: string;
  slug: string;
  status: string | null;
};

const appUrl = () =>
  process.env.INTERNAL_APP_URL ??
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";

export async function getSingleTenantEntity(): Promise<SingleTenantEntity | null> {
  if (!SINGLE_TENANT_UI) return null;

  const cookieStore = await cookies();
  const res = await fetch(`${appUrl().replace(/\/+$/, "")}/api/core/user/entities`, {
    cache: "no-store",
    headers: { Cookie: cookieStore.toString() },
  });

  if (!res.ok) return null;

  const entities = (await res.json()) as SingleTenantEntity[];
  return entities[0] ?? null;
}
