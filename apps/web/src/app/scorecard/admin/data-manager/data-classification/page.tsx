import Header from "@/app/(components)/Header";
import { resolveNavMode } from "@/lib/navMode";
import DataClassificationClient from "@/app/(components)/DataClassificationClient";

export default function DataClassificationPage() {
  const navMode = resolveNavMode();
  const subtitle =
    navMode === "legacy" ? "LeadAI · Data Manager" : "LeadAI · AI Data Register";
  return (
    <div className="space-y-6">
      <Header title="Data Classification" subtitle={subtitle} />
      <DataClassificationClient />
    </div>
  );
}
