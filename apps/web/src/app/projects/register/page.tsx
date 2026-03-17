import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

type UserEntity = {
  entity_id: string;
  role: string;
  name: string;
  slug: string;
  status: string | null;
};

/**
 * Global /projects/register URL (no entity in path).
 * Fetches user's first entity and redirects to entity-scoped URL.
 */
export default async function ProjectsRegisterPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin");
  }

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };

  const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
  if (!res.ok) {
    if (res.status === 401) {
      redirect("/register?callbackUrl=" + encodeURIComponent("/projects/register"));
    }
    // If can't fetch entities, allow access without entity context (fallback)
    const ProjectRegisterPage = (await import("@/app/(components)/ProjectRegisterPage")).default;
    return <ProjectRegisterPage navMode={navMode} />;
  }

  const entities = (await res.json()) as UserEntity[];
  const first = entities.length > 0 ? entities[0] : null;
  if (!first) {
    // No entities: allow access without entity context (fallback)
    const ProjectRegisterPage = (await import("@/app/(components)/ProjectRegisterPage")).default;
    return <ProjectRegisterPage navMode={navMode} />;
  }

  redirect(`/${encodeURIComponent(first.slug)}/projects/register`);
}
