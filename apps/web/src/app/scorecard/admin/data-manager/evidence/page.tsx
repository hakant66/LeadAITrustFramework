import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

export default function EvidenceAdminRedirect() {
  const navMode = resolveNavMode();
  const base =
    navMode === "legacy"
      ? "/scorecard/admin/trustops"
      : "/scorecard/admin/control-audit";
  redirect(`${base}/evidence`);
}
