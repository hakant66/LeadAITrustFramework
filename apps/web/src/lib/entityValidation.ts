/**
 * Helper to validate entity access with master admin support.
 * Returns entity if found, null if not found (caller should redirect).
 */
import { cookies } from "next/headers";

export type UserEntity = {
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

export async function findEntityBySlug(
  entitySlug: string,
): Promise<UserEntity | null> {
  const cookieStore = await cookies();
  const headers = {
    cache: "no-store" as const,
    headers: { Cookie: cookieStore.toString() },
  };

  // Check if user is master admin
  const masterAdminRes = await fetch(
    `${appUrl().replace(/\/+$/, "")}/api/core/user/is-master-admin`,
    headers
  );
  const isMasterAdmin = masterAdminRes.ok && (await masterAdminRes.json()) === true;

  // Fetch user's entities
  const res = await fetch(
    `${appUrl().replace(/\/+$/, "")}/api/core/user/entities`,
    headers
  );

  if (!res.ok) {
    return null;
  }

  const entities = (await res.json()) as UserEntity[];
  let entity = entities.find((e) => e.slug === entitySlug);

  // If not found in user_entity_access but user is master admin, fetch entity by slug
  if (!entity && isMasterAdmin) {
    const entityBySlugRes = await fetch(
      `${appUrl().replace(/\/+$/, "")}/api/core/entity/by-slug/${encodeURIComponent(entitySlug)}`,
      headers
    );
    if (entityBySlugRes.ok) {
      const entityData = await entityBySlugRes.json();
      entity = {
        entity_id: entityData.id,
        role: "admin",
        name: entityData.fullLegalName,
        slug: entityData.slug ?? entitySlug,
        status: entityData.status,
      };
    }
  }

  return entity ?? null;
}
