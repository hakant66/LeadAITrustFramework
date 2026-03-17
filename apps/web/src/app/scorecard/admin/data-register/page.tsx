import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import DataManagerLandingPage from "@/app/scorecard/admin/data-manager/page";

export default function DataRegisterLandingPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/data-manager");
  }
  return <DataManagerLandingPage />;
}
