import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

export default async function EntityBoardLevelReportPage({
  params,
}: {
  params: Promise<{ entitySlug: string }>;
}) {
  const { entitySlug } = await params;
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard");
  }

  redirect(`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-dashboard-reporting/high-level-report`);
}
