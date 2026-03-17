/**
 * Shared logic for entity-scoped admin pages.
 * Validates user has access to entitySlug and returns entity or redirects.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import { findEntityBySlug, UserEntity } from "@/lib/entityValidation";

const appUrl = () =>
  process.env.INTERNAL_APP_URL ??
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";

export type { UserEntity };

export async function validateEntityAccess(
  entitySlug: string,
  options: {
    legacyRedirect?: string;
    fallbackRedirect: string;
    callbackPath?: string;
    /** When entity not found, redirect to first entity with this path (e.g. "/scorecard/admin/control-audit") */
    redirectToFirstPath?: string;
  }
): Promise<UserEntity> {
  const navMode = resolveNavMode();
  if (navMode === "legacy" && options.legacyRedirect) {
    redirect(options.legacyRedirect);
  }

  const cookieStore = await cookies();
  const headers = {
    cache: "no-store" as const,
    headers: { Cookie: cookieStore.toString() },
  };

  const entity = await findEntityBySlug(entitySlug);

  if (!entity) {
    // Try to get first entity for redirect
    const res = await fetch(
      `${appUrl().replace(/\/+$/, "")}/api/core/user/entities`,
      headers
    );

    if (!res.ok) {
      if (res.status === 401 && options.callbackPath) {
        redirect(
          "/register?callbackUrl=" +
            encodeURIComponent(
              `/${encodeURIComponent(entitySlug)}${options.callbackPath}`
            )
        );
      }
      redirect(options.fallbackRedirect);
    }

    const entities = (await res.json()) as UserEntity[];
    const first = entities[0];
    if (first && options.redirectToFirstPath) {
      redirect(`/${encodeURIComponent(first.slug)}${options.redirectToFirstPath}`);
    }
    redirect(options.fallbackRedirect);
  }

  return entity;
}
