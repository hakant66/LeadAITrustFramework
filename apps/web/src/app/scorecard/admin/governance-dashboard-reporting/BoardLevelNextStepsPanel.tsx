"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BoardLevelNextStepsEditor, { type NextStep, type NextStepSeed } from "@/app/scorecard/admin/governance-dashboard-reporting/BoardLevelNextStepsEditor";
import BoardLevelNextStepsExport, { type NextStepExportItem } from "@/app/scorecard/admin/governance-dashboard-reporting/BoardLevelNextStepsExport";

export type AiNextStep = {
  priority: string;
  action: string;
  owner: string;
  dueDate: string;
  rationale: string;
};

export default function BoardLevelNextStepsPanel({
  entityId,
  entityName,
  aiSteps,
  exportItems,
}: {
  entityId: string;
  entityName: string;
  aiSteps: AiNextStep[];
  exportItems: NextStepExportItem[];
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [seed, setSeed] = useState<NextStepSeed | null>(null);
  const [aiStepsState, setAiStepsState] = useState<AiNextStep[]>(aiSteps);

  useEffect(() => {
    setAiStepsState(aiSteps);
  }, [aiSteps]);

  const hasAiSteps = aiStepsState.length > 0;

  const normalizedAiSteps = useMemo(() => {
    return aiStepsState.map((step) => ({
      ...step,
      priorityLabel: step.priority || "—",
      actionLabel: step.action || "—",
    }));
  }, [aiStepsState]);

  const exportItemsState = useMemo(() => {
    if (aiStepsState.length === 0) return exportItems;
    return aiStepsState.map((step) => ({
      priority: step.priority,
      action: step.action,
      owner: step.owner,
      due_date: step.dueDate,
      rationale: step.rationale,
    }));
  }, [aiStepsState, exportItems]);

  const handleSeed = (step: AiNextStep, idx: number) => {
    setSeed({
      id: Date.now(),
      priority: step.priority,
      title: step.action,
      detail: step.rationale,
      sourceIndex: idx,
    });
    if (editorRef.current) {
      editorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleItemSaved = (item: NextStep) => {
    if (typeof item.source_index !== "number") return;
    setAiStepsState((prev) => {
      if (!prev[item.source_index!]) return prev;
      const next = [...prev];
      const existing = next[item.source_index!];
      next[item.source_index!] = {
        ...existing,
        priority: item.priority ?? existing.priority,
        action: item.title ?? existing.action,
        owner: item.owner ?? existing.owner,
        dueDate: item.due_date ?? existing.dueDate,
        rationale: item.detail ?? existing.rationale,
      };
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {hasAiSteps && (
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Next Steps (90 Days) advised by AI
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Click a card to draft it into the manual action list below.
              </p>
            </div>
            <BoardLevelNextStepsExport items={exportItemsState} entityName={entityName} />
          </div>
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {normalizedAiSteps.map((row, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => handleSeed(row, idx)}
                className="flex w-full flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow dark:border-slate-600 dark:bg-slate-800/40 dark:hover:border-indigo-400/60"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                    {row.priorityLabel}
                  </span>
                </div>
                <p className="mb-3 font-medium text-slate-900 dark:text-slate-100">
                  {row.actionLabel}
                </p>
                <dl className="mt-auto grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="inline font-medium text-slate-500 dark:text-slate-400">Owner: </dt>
                    <dd className="inline text-slate-700 dark:text-slate-300">{row.owner || "TBD"}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium text-slate-500 dark:text-slate-400">Due: </dt>
                    <dd className="inline text-slate-700 dark:text-slate-300">{row.dueDate || "TBD"}</dd>
                  </div>
                </dl>
                {row.rationale && (
                  <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-400">
                    {row.rationale}
                  </p>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      <div ref={editorRef} className="sticky bottom-4 z-20">
        <BoardLevelNextStepsEditor
          entityId={entityId}
          seed={seed}
          onItemSaved={handleItemSaved}
        />
      </div>
    </div>
  );
}
