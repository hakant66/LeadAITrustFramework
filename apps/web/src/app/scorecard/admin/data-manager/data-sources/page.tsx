import Header from "@/app/(components)/Header";
import { resolveNavMode } from "@/lib/navMode";
import DataSourcesClient from "@/app/(components)/DataSourcesClient";

export default function DataSourcesPage() {
  const navMode = resolveNavMode();
  const subtitle =
    navMode === "legacy" ? "LeadAI · Data Manager" : "LeadAI · AI Data Register";
  return (
    <div className="space-y-6">
      <Header title="Data Sources" subtitle={subtitle} />
      <DataSourcesClient />
    </div>
  );
}
