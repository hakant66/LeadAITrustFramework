import Header from "@/app/(components)/Header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/(components)/tabs";
import KnowledgeBaseKpiTable from "@/app/scorecard/admin/knowledgebase/KnowledgeBaseKpiTable";

export const dynamic = "force-dynamic";

type KpiDefinitionRow = {
  kpi_key: string;
  kpi_name: string;
  description?: string | null;
  iso_42001_clause?: string | null;
  euaiact_clause?: string | null;
};

type EuAiActRow = {
  chapter?: string | null;
  section?: string | null;
  article?: string | null;
  coverage?: string | null;
  primary_role?: string | null;
  risk_classification?: string | null;
  condition?: string | null;
};

type Iso42001Row = {
  chapter?: string | null;
  section?: string | null;
  article?: string | null;
  coverage?: string | null;
};

const apiBase =
  process.env.NEXT_PUBLIC_CORE_SVC_URL ??
  process.env.CORE_SVC_URL ??
  "http://localhost:8001";

async function fetchJson(path: string) {
  const base = apiBase.replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load ${path} (${res.status})`);
  }
  return res.json();
}

export default async function KnowledgeBasePage() {
  const [kpiData, euData, isoData] = await Promise.all([
    fetchJson("/admin/knowledgebase/kpis"),
    fetchJson("/admin/knowledgebase/euaiact"),
    fetchJson("/admin/knowledgebase/iso42001"),
  ]);

  const kpis: KpiDefinitionRow[] = Array.isArray(kpiData?.items)
    ? kpiData.items
    : [];
  const euai: EuAiActRow[] = Array.isArray(euData?.items) ? euData.items : [];
  const iso: Iso42001Row[] = Array.isArray(isoData?.items)
    ? isoData.items
    : [];

  return (
    <div className="space-y-6">
      <Header title="Knowledge Base" subtitle="LeadAI · Governance Setup" />

      <Tabs defaultValue="kpis">
        <TabsList>
          <TabsTrigger value="kpis">KPI List</TabsTrigger>
          <TabsTrigger value="euaiact">EU AI Act</TabsTrigger>
          <TabsTrigger value="iso42001">ISO 42001</TabsTrigger>
        </TabsList>

        <TabsContent value="kpis">
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
            {kpis.length === 0 ? (
              <div className="text-sm text-gray-700 dark:text-slate-300">
                No KPI definitions found.
              </div>
            ) : (
              <KnowledgeBaseKpiTable rows={kpis} />
            )}
          </div>
        </TabsContent>

        <TabsContent value="euaiact">
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  <tr>
                    <th className="p-2 text-left">chapter</th>
                    <th className="p-2 text-left">section</th>
                    <th className="p-2 text-left">article</th>
                    <th className="p-2 text-left">coverage</th>
                    <th className="p-2 text-left">role</th>
                    <th className="p-2 text-left">risk</th>
                    <th className="p-2 text-left">condition</th>
                  </tr>
                </thead>
                <tbody>
                  {euai.map((row, idx) => (
                    <tr
                      key={`${row.article ?? "row"}-${row.coverage ?? idx}`}
                      className="border-b border-slate-100 dark:border-slate-700/70"
                    >
                      <td className="p-2">{row.chapter ?? "—"}</td>
                      <td className="p-2">{row.section ?? "—"}</td>
                      <td className="p-2">{row.article ?? "—"}</td>
                      <td className="p-2">{row.coverage ?? "—"}</td>
                      <td className="p-2">{row.primary_role ?? "—"}</td>
                      <td className="p-2">{row.risk_classification ?? "—"}</td>
                      <td className="p-2">{row.condition ?? "—"}</td>
                    </tr>
                  ))}
                  {euai.length === 0 && (
                    <tr>
                      <td
                        className="p-2 text-sm text-gray-500 dark:text-slate-400"
                        colSpan={7}
                      >
                        No EU AI Act requirements found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="iso42001">
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
                  <tr>
                    <th className="p-2 text-left">chapter</th>
                    <th className="p-2 text-left">section</th>
                    <th className="p-2 text-left">article</th>
                    <th className="p-2 text-left">coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {iso.map((row, idx) => (
                    <tr
                      key={`${row.article ?? "row"}-${row.coverage ?? idx}`}
                      className="border-b border-slate-100 dark:border-slate-700/70"
                    >
                      <td className="p-2">{row.chapter ?? "—"}</td>
                      <td className="p-2">{row.section ?? "—"}</td>
                      <td className="p-2">{row.article ?? "—"}</td>
                      <td className="p-2">{row.coverage ?? "—"}</td>
                    </tr>
                  ))}
                  {iso.length === 0 && (
                    <tr>
                      <td
                        className="p-2 text-sm text-gray-500 dark:text-slate-400"
                        colSpan={4}
                      >
                        No ISO 42001 requirements found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
