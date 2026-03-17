import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";
import ProvenanceAxisPage from "@/app/scorecard/admin/trustops/axes/provenance/page";

export default function ControlAuditProvenanceAxisPage() {
  const navMode = resolveNavMode();
  if (navMode === "legacy") {
    redirect("/scorecard/admin/trustops/axes/provenance");
  }
  return <ProvenanceAxisPage />;
}
