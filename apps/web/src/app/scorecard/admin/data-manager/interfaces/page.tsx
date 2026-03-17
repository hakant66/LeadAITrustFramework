import Header from "@/app/(components)/Header";
import JiraInterfacesClient from "@/app/(components)/JiraInterfacesClient";
import { resolveNavMode } from "@/lib/navMode";

export default function InterfacesPage() {
  const navMode = resolveNavMode();
  const subtitle =
    navMode === "legacy" ? "LeadAI · Data Manager" : "LeadAI · AI Data Register";
  return (
    <div className="space-y-6">
      <Header title="Interfaces" subtitle={subtitle} />
      <JiraInterfacesClient />
    </div>
  );
}
