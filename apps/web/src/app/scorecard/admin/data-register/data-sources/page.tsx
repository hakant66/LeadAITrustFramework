import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import DataSourcesPage from "@/app/scorecard/admin/data-manager/data-sources/page";

export default function DataRegisterSourcesPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/data-manager/data-sources");
  }
  return <DataSourcesPage />;
}
