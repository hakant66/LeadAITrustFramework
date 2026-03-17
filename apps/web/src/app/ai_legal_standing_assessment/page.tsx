"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ThemeProvider } from "../theme-provider";

type AssessmentResult = {
  primary_role: string;
  roles: string[];
  risk_classification: string;
  obligations: string[];
  warnings: string[];
  responsibilities_by_role: Record<string, string[]>;
  responsibilities_summary: {
    role: string;
    key_focus: string;
    responsibility_level: string;
  }[];
  decision_trace: { decision: string; citation: string }[];
};

const ASSESSMENT_RESULT_STORAGE_KEY = "ai_legal_standing_assessment_result";

function normalizeResult(result: AssessmentResult | null): AssessmentResult | null {
  if (!result) return null;
  return {
    ...result,
    roles: Array.isArray(result.roles) ? result.roles : [],
    obligations: Array.isArray(result.obligations) ? result.obligations : [],
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    responsibilities_by_role: result.responsibilities_by_role ?? {},
    responsibilities_summary: Array.isArray(result.responsibilities_summary)
      ? result.responsibilities_summary
      : [],
    decision_trace: Array.isArray(result.decision_trace) ? result.decision_trace : [],
  };
}

export default function AiLegalStandingAssessmentPage() {
  const t = useTranslations("AiLegalStanding");
  const [result, setResult] = useState<AssessmentResult | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem(ASSESSMENT_RESULT_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as AssessmentResult;
      setResult(normalizeResult(parsed));
    } catch {
      setResult(null);
    }
  }, []);

  const formatDecisionLabel = (item: { decision: string; citation?: string }) =>
    item.citation ? `${item.decision} (${item.citation})` : item.decision;

  return (
    <ThemeProvider>
      <main className="min-h-screen bg-[var(--background)] px-6 py-12 text-slate-900 transition dark:text-slate-100">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {t("summary.title")}
              </h2>
              <Link
                href="https://dev.theleadai.co.uk/"
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Exit
              </Link>
            </div>

            {!result ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {t("summary.empty")}
                </p>
                <Link
                  href="/ai_legal_standing"
                  className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  {t("form.redo")}
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-4 text-sm text-slate-700 dark:text-slate-200">
                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    {t("summary.primaryRole")}
                  </p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {result.primary_role}
                  </p>
                  {result.roles?.length ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t("summary.roles", { roles: result.roles.join(", ") })}
                    </p>
                  ) : null}
                </div>

                <div>
                  <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                    {t("summary.riskClassification")}
                  </p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {result.risk_classification}
                  </p>
                </div>

                {Object.keys(result.responsibilities_by_role ?? {}).length > 0 && (
                  <div>
                    <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                      {t("summary.keyResponsibilities")}
                    </p>
                    <div className="mt-2 space-y-3 text-xs text-slate-600 dark:text-slate-300">
                      {Object.entries(result.responsibilities_by_role).map(([role, items]) => (
                        <div key={role}>
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {role}
                          </p>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {(items ?? []).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.obligations.length > 0 && (
                  <div>
                    <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                      {t("summary.obligations")}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {result.obligations.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.responsibilities_summary.length > 0 && (
                  <div>
                    <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                      {t("summary.responsibilitySummary")}
                    </p>
                    <div className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      {result.responsibilities_summary.map((row) => (
                        <div
                          key={row.role}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {row.role}: {row.key_focus}
                          </p>
                          <p>{row.responsibility_level}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.decision_trace.length > 0 && (
                  <div>
                    <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                      {t("summary.decisionTrace")}
                    </p>
                    <ul className="mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      {result.decision_trace.map((item, idx) => (
                        <li key={`${item.decision}-${idx}`}>
                          {formatDecisionLabel(item)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <Link
                    href="/entitycapture"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
                  >
                    Capture your entity profile information for compliance assessment
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </ThemeProvider>
  );
}
