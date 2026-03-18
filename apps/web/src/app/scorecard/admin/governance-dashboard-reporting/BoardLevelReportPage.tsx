import Header from "@/app/(components)/Header";
import EntitySwitcher from "@/app/scorecard/admin/governance-dashboard-reporting/EntitySwitcher";
import BackButton from "@/app/scorecard/admin/governance-dashboard-reporting/BackButton";
import BoardLevelNextStepsPanel from "@/app/scorecard/admin/governance-dashboard-reporting/BoardLevelNextStepsPanel";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { cookies } from "next/headers";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

const reportMarkdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="border-b border-slate-200 pb-3 text-2xl font-bold text-slate-900 dark:border-slate-700 dark:text-slate-100">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-4 mb-2 text-base font-semibold text-slate-800 dark:text-slate-200">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-3 leading-relaxed text-slate-700 dark:text-slate-300">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-4 ml-5 list-disc space-y-1 text-slate-700 dark:text-slate-300">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-4 ml-5 list-decimal space-y-1 text-slate-700 dark:text-slate-300">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-6 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-slate-100 dark:bg-slate-800">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="border-b border-slate-200 last:border-b-0 dark:border-slate-700">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{children}</td>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>
  ),
};

type BoardLevelNextStepItem = {
  priority: string;
  action: string;
  owner: string;
  due_date: string;
  rationale: string;
};

type BoardLevelReportResp = {
  entity_id: string;
  entity_name: string;
  report_md: string;
  provider?: string;
  model?: string;
  latency_ms?: number;
  generated_at?: string;
  cache_hit?: boolean;
  /** Structured next steps from API (enables Jira/automation). */
  next_steps?: BoardLevelNextStepItem[];
};

type UserEntity = { entity_id: string; role: string; name: string; slug: string; status: string | null };

type NextStepRow = {
  priority: string;
  action: string;
  owner: string;
  dueDate: string;
  rationale: string;
};

function parseNextStepsTable(reportMd: string): {
  mdWithoutNextSteps: string;
  nextStepsRows: NextStepRow[];
} {
  const headingMatch = reportMd.match(/\n?##\s*Next Steps\s*(?:\(90 Days\))?\s*\n/i);
  if (!headingMatch) return { mdWithoutNextSteps: reportMd, nextStepsRows: [] };

  const headingEnd = headingMatch.index! + headingMatch[0].length;
  const rest = reportMd.slice(headingEnd);
  const nextSectionMatch = rest.match(/\n##\s+/);
  const sectionContent = nextSectionMatch ? rest.slice(0, nextSectionMatch.index) : rest;

  const rows: string[][] = [];
  const lines = sectionContent.split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes("|")) continue;
    if (/^[-:\s|]+$/.test(trimmed)) continue;
    const cells = trimmed.split("|").map((c) => c.trim()).filter((_, i, a) => i > 0 || i < a.length - 1);
    if (cells.length >= 2) rows.push(cells);
  }

  if (rows.length === 0) {
    const asOneLine = sectionContent.replace(/\s*\n\s*/g, " ").trim();
    const parts = asOneLine.split(/\s*\|\s*\|\s*/);
    for (const part of parts) {
      const raw = part.replace(/^\|\s*|\s*\|$/g, "").trim();
      if (!raw || /^[-:\s]+$/.test(raw)) continue;
      const cells = raw.split("|").map((c) => c.trim());
      if (cells.length >= 2) rows.push(cells);
    }
  }

  const headerRow = rows[0] ?? [];
  const priorityIdx = headerRow.findIndex((h) => /priority/i.test(h));
  const actionIdx = headerRow.findIndex((h) => /action/i.test(h));
  const ownerIdx = headerRow.findIndex((h) => /owner/i.test(h));
  const dueIdx = headerRow.findIndex((h) => /due/i.test(h));
  const rationaleIdx = headerRow.findIndex((h) => /rationale/i.test(h));
  const fallback = (r: string[], i: number) => (i >= 0 && i < r.length ? r[i] : "");

  const dataRows = rows
    .slice(1)
    .filter((r) => r.some((c) => c && !/^[-—\s]+$/.test(c)) && !r.every((c) => /^[-:\s]+$/.test(c)));
  const nextStepsRows: NextStepRow[] = dataRows.map((r) => ({
    priority: fallback(r, priorityIdx !== -1 ? priorityIdx : 0),
    action: fallback(r, actionIdx !== -1 ? actionIdx : 1),
    owner: fallback(r, ownerIdx !== -1 ? ownerIdx : 2),
    dueDate: fallback(r, dueIdx !== -1 ? dueIdx : 3),
    rationale: fallback(r, rationaleIdx !== -1 ? rationaleIdx : 4),
  }));

  const before = reportMd.slice(0, headingEnd);
  const after = nextSectionMatch ? rest.slice(nextSectionMatch.index) : "";
  const mdWithoutNextSteps = before + "\n\n*Next steps are shown in the action plan below.*\n\n" + after;

  return { mdWithoutNextSteps, nextStepsRows };
}

export default async function BoardLevelReportPage({
  entitySlug,
  entityId,
  entities,
}: {
  entitySlug: string;
  entityId: string;
  entities: UserEntity[];
}) {
  const session = await auth();
  const userLabel = session?.user?.name ?? session?.user?.email ?? "";
  const currentEntity = entities.find((e) => e.slug === entitySlug) ?? entities[0];
  const appUrl =
    process.env.INTERNAL_APP_URL ??
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000";
  const cookieStore = await cookies();
  const headers = { cache: "no-store" as const, headers: { Cookie: cookieStore.toString() } };

  const reportRes = await fetch(
    `${appUrl.replace(/\/+$/, "")}/api/core/admin/ai-reports/board-level-report?entity_id=${encodeURIComponent(entityId)}`,
    headers
  );
  if (!reportRes.ok) {
    const status = reportRes.status;
    const text = await reportRes.text();
    return (
      <div className="space-y-6">
        <Header title="High-Level Report" subtitle="Executive Reporting">
          <BackButton />
        </Header>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Unable to load high-level report ({status}).
          <div className="mt-2 text-xs text-amber-800">{text}</div>
        </div>
      </div>
    );
  }

  const report = (await reportRes.json()) as BoardLevelReportResp;
  const { mdWithoutNextSteps, nextStepsRows: parsedRows } = parseNextStepsTable(report.report_md);
  const nextStepsRows: NextStepRow[] =
    report.next_steps?.length
      ? report.next_steps.map((s) => ({
          priority: s.priority,
          action: s.action,
          owner: s.owner,
          dueDate: s.due_date,
          rationale: s.rationale,
        }))
      : parsedRows;

  return (
    <div className="min-h-screen flex flex-col gap-6">
      <Header title="High-Level Report" subtitle="Executive Reporting">
        <div className="flex w-full flex-wrap items-start gap-3">
          <BackButton />
          <div className="ml-auto flex flex-col items-end self-start">
            {entities.length > 1 ? (
              <EntitySwitcher
                entities={entities}
                currentSlug={entitySlug}
                basePath="/scorecard/admin/governance-dashboard-reporting/high-level-report"
              />
            ) : currentEntity ? (
              <span
                className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-medium text-white shadow-sm dark:border-white/20 dark:bg-white/5"
                title={currentEntity.slug}
              >
                {currentEntity.name}
              </span>
            ) : null}
            {userLabel ? (
              <span className="mt-1 text-xs text-white/80">{userLabel}</span>
            ) : null}
          </div>
        </div>
      </Header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Entity
            </div>
            <div className="text-lg font-semibold text-slate-900">
              {report.entity_name}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-3 text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-700">Provider:</span>{" "}
              {report.provider ?? "—"}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Model:</span>{" "}
              {report.model ?? "—"}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Generated:</span>{" "}
              {report.generated_at ?? "—"}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Cache:</span>{" "}
              {report.cache_hit ? "Hit" : "Fresh"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="report-content max-w-none">
          <ReactMarkdown rehypePlugins={[rehypeRaw]} components={reportMarkdownComponents}>
            {mdWithoutNextSteps}
          </ReactMarkdown>
        </div>
      </section>

      <BoardLevelNextStepsPanel
        entityId={entityId}
        entityName={report.entity_name}
        aiSteps={nextStepsRows}
        exportItems={
          report.next_steps ??
          nextStepsRows.map((r) => ({
            priority: r.priority,
            action: r.action,
            owner: r.owner,
            due_date: r.dueDate,
            rationale: r.rationale,
          }))
        }
      />
    </div>
  );
}
