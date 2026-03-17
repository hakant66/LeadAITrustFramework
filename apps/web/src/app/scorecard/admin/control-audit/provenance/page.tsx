import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import ProvenanceLineagePage from "@/app/scorecard/admin/trustops/provenance/page";

export default function ControlAuditProvenancePage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/provenance");
  }
  return <ProvenanceLineagePage />;
}
