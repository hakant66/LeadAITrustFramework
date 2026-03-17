import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import RetentionDeletionPage from "@/app/scorecard/admin/data-manager/retention/page";

export default function DataRegisterRetentionPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/data-manager/retention");
  }
  return <RetentionDeletionPage />;
}
