import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

const appUrl =
  process.env.INTERNAL_APP_URL ??
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "http://localhost:3000";

/**
 * Global Action Assignment: redirect to the first entity-scoped page.
 */
export default async function ActionAssignmentRedirectPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin");
  }

  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };
  const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
  if (!res.ok) {
    if (res.status === 401) {
      redirect(
        "/register?callbackUrl=" +
          encodeURIComponent("/scorecard/admin/governance-execution/action-assignment")
      );
    }
    redirect("/scorecard/admin/governance-execution");
  }
  const entities = (await res.json()) as Array<{ slug: string }>;
  const first = entities[0];
  if (!first) {
    redirect("/scorecard/admin/governance-execution");
  }
  redirect(`/${encodeURIComponent(first.slug)}/scorecard/admin/governance-execution/action-assignment`);
}
