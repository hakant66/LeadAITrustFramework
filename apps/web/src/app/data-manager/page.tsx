import { redirect } from "next/navigation";
import { resolveNavMode } from "@/lib/navMode";

export default function DataManagerRootRedirect() {
  const navMode = resolveNavMode();
  const target =
    navMode === "legacy"
      ? "/scorecard/admin/data-manager"
      : "/scorecard/admin/data-register";
  redirect(target);
}
