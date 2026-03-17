import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

export default async function EntityGovernanceKpiRegisterPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/data-manager/data-quality");
  }
  redirect(`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/control-register`);
  return null;
}
