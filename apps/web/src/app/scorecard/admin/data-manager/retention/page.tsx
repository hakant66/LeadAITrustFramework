import Header from "@/app/(components)/Header";
import { resolveNavMode } from "@/lib/navMode";
import DataRetentionClient from "@/app/(components)/DataRetentionClient";

export default function RetentionDeletionPage() {
  const navMode = resolveNavMode();
  const subtitle =
    navMode === "legacy" ? "LeadAI · Data Manager" : "LeadAI · AI Data Register";
  return (
    <div className="space-y-6">
      <Header title="Retention & Deletion" subtitle={subtitle} />
      <DataRetentionClient />
    </div>
  );
}
