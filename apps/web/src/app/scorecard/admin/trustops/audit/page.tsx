import AuditLogPageClient from "@/app/(components)/AuditLogPageClient";
import { resolveNavMode } from "@/lib/navMode";

export default function AuditLogPage() {
  const navMode = resolveNavMode();
  return <AuditLogPageClient navMode={navMode} />;
}
