import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import DataClassificationPage from "@/app/scorecard/admin/data-manager/data-classification/page";

export default function DataRegisterClassificationPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/data-manager/data-classification");
  }
  return <DataClassificationPage />;
}
