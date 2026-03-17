import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import { findEntityBySlug } from "@/lib/entityValidation";

export default async function EntityGovernanceProjectRegisterPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin");
  }

  const entity = await findEntityBySlug(entitySlug);
  if (!entity) {
    redirect("/projects/register");
  }

  redirect(`/${encodeURIComponent(entitySlug)}/projects/register`);
}
