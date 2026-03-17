"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Header from "@/app/(components)/Header";
import BackButton from "@/app/scorecard/admin/governance-dashboard-reporting/BackButton";

type AssessmentResult = {
  primary_role: string;
  roles: string[];
  risk_classification: string;
  obligations: string[];
  warnings: string[];
  responsibilities_by_role: Record<string, string[]>;
  responsibilities_summary: { role: string; key_focus: string; responsibility_level: string }[];
  decision_trace: { decision: string; citation: string }[];
};

type EntityAssessmentSnapshot = {
  id?: string;
  slug?: string | null;
  fullLegalName?: string | null;
  primaryRole?: string | null;
  riskClassification?: string | null;
  decisionTrace?: string | null;
  legalStandingResult?: AssessmentResult | null;
};

function parseDecisionTrace(
  text?: string | null
): AssessmentResult["decision_trace"] {
  if (!text) return [];
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*?)(?:\s*\(([^()]*)\))?$/);
      const decision = match?.[1]?.trim() || line;
      const citation = match?.[2]?.trim() || "";
      return { decision, citation };
    });
}

function buildResultFromEntity(entity: EntityAssessmentSnapshot): AssessmentResult | null {
  const primaryRole = entity.primaryRole?.trim();
  const riskClassification = entity.riskClassification?.trim();
  const decisionTrace = parseDecisionTrace(entity.decisionTrace);
  if (!primaryRole && !riskClassification && decisionTrace.length === 0) {
    return null;
  }
  return {
    primary_role: primaryRole || "Unknown",
    roles: primaryRole ? [primaryRole] : [],
    risk_classification: riskClassification || "Unknown",
    obligations: [],
    warnings: [],
    responsibilities_by_role: {},
    responsibilities_summary: [],
    decision_trace: decisionTrace,
  };
}

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
    decision_trace: Array.isArray(result.decision_trace)
      ? result.decision_trace
      : [],
  };
}

export default function EntityLegalStandingPage() {
  const t = useTranslations("AiLegalStanding");
  const params = useParams();
  const router = useRouter();
  const entitySlug = params?.entitySlug as string | undefined;
  const [entity, setEntity] = useState<EntityAssessmentSnapshot | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState<string>("");

  useEffect(() => {
    if (!entitySlug) return;
    let cancelled = false;
    const loadEntity = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/core/entity/by-slug/${encodeURIComponent(entitySlug)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(`Failed to load entity (${res.status})`);
        }
        const data = (await res.json()) as EntityAssessmentSnapshot;
        if (cancelled) return;
        setEntity(data);
        const normalized = normalizeResult(data.legalStandingResult ?? null);
        const fallback = normalized ?? buildResultFromEntity(data);
        setResult(fallback);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load entity");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadEntity();
    return () => {
      cancelled = true;
    };
  }, [entitySlug]);

  useEffect(() => {
    if (!entity?.id || !entitySlug || typeof window === "undefined") return;
    sessionStorage.setItem("entityId", entity.id);
    sessionStorage.setItem("entitySlug", entitySlug);
  }, [entity?.id, entitySlug]);

  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const session = (await res.json()) as {
          user?: { name?: string | null; email?: string | null };
        };
        if (!cancelled) {
          setUserLabel(session?.user?.name || session?.user?.email || "");
        }
      } catch {
        // Ignore session fetch errors for header display.
      }
    };
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDecisionLabel = (item: { decision: string; citation?: string }) =>
    item.citation ? `${item.decision} (${item.citation})` : item.decision;

  const renderRating = (value: string) => {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    if (trimmed.includes("⭐")) {
      return <span className="text-amber-500">{trimmed}</span>;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return <span className="text-amber-500">{"⭐".repeat(parsed)}</span>;
    }
    return <span className="text-slate-600 dark:text-slate-300">{trimmed}</span>;
  };

  const renderSummaryCard = () => {
    if (!result) {
      return (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {t("summary.empty")}
        </p>
      );
    }

    return (
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
              {Object.entries(result.responsibilities_by_role).map(
                ([role, items]) => (
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
                )
              )}
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
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {row.role}: {row.key_focus}
                  </p>
                  <div className="mt-1 text-[11px]">
                    {renderRating(row.responsibility_level)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-sm dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            {result.warnings.join(" ")}
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
      </div>
    );
  };

  const handleGoNext = async () => {
    if (!entity?.id || !result) return;
    setSaveError(null);
    setSaving(true);
    const decisionTraceText = result.decision_trace
      .map((item) => formatDecisionLabel(item))
      .join("\n");
    try {
      const res = await fetch(`/api/core/entity/${entity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryRole: result.primary_role,
          riskClassification: result.risk_classification,
          decisionTrace: decisionTraceText,
          legalStandingResult: result,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg = typeof errBody.detail === "string" ? errBody.detail : "Failed to update entity";
        throw new Error(msg);
      }
      router.push(`/${encodeURIComponent(entitySlug ?? "")}/scorecard/admin/governance-setup/entity-setup`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update entity");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Header
        title={entity?.fullLegalName ?? t("summary.title")}
        subtitle="LeadAI · Governance Setup"
      >
        <div className="flex flex-col items-end gap-2">
          <BackButton label="Back" />
          {userLabel ? (
            <div className="text-sm font-medium text-white/80">{userLabel}</div>
          ) : null}
        </div>
      </Header>

      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {entity?.legalStandingResult && (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200">
              {t("summary.completeIndicator")}
            </span>
          )}
          <a
            href={`/ai_legal_standing?entitySlug=${encodeURIComponent(
              entitySlug ?? ""
            )}`}
            className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {t("form.redo")}
          </a>
        </div>
        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading assessment summary...</p>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
            {error}
          </div>
          ) : !result ? (
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>{t("summary.empty")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("form.redo")}
              </p>
            </div>
          ) : (
          <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
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
                  {Object.entries(result.responsibilities_by_role).map(
                    ([role, items]) => (
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
                    )
                  )}
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
            {result.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
                {result.warnings.join(" ")}
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
              {saveError && (
                <p className="mb-3 text-xs text-red-600 dark:text-red-400">
                  {saveError}
                </p>
              )}
              <button
                type="button"
                onClick={handleGoNext}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? t("buttons.assessing") : t("buttons.generateAndGoNext")}
              </button>
            </div>
          </div>
        )}
        </section>
      </div>
    </div>
  );
}
