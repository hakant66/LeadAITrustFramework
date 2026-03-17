import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import ControlRegisterClient from "@/app/(components)/ControlRegisterClient";
import { findEntityBySlug } from "@/lib/entityValidation";

export default async function EntityGovernanceControlRegisterPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/data-manager/data-quality");
  }

  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };

  const entity = await findEntityBySlug(entitySlug);
  if (!entity) {
    const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
    if (res.ok) {
      const entities = (await res.json()) as Array<{ slug: string }>;
      const first = entities[0];
      if (first) {
        redirect(`/${encodeURIComponent(first.slug)}/scorecard/admin/governance-setup/control-register`);
      }
    }
    if (!res.ok && res.status === 401) {
      redirect(
        "/register?callbackUrl=" +
          encodeURIComponent(`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/control-register`)
      );
    }
    redirect("/scorecard/admin/governance-setup/control-register");
  }

  return <ControlRegisterClient entitySlug={entitySlug} />;
}
