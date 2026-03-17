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

export default async function GovernanceControlRegisterPage() {
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

  const res = await fetch(`${appUrl.replace(/\/+$/, "")}/api/core/user/entities`, headers);
  if (!res.ok) {
    if (res.status === 401) {
      redirect("/register?callbackUrl=" + encodeURIComponent("/scorecard/admin/governance-setup/control-register"));
    }
    const DataQualityPage = (await import("@/app/scorecard/admin/data-manager/data-quality/page")).default;
    return <DataQualityPage />;
  }

  const entities = (await res.json()) as UserEntity[];
  const first = entities.length > 0 ? entities[0] : null;
  if (!first) {
    const DataQualityPage = (await import("@/app/scorecard/admin/data-manager/data-quality/page")).default;
    return <DataQualityPage />;
  }

  redirect(`/${encodeURIComponent(first.slug)}/scorecard/admin/governance-setup/control-register`);
}
