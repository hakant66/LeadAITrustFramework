"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Header from "@/app/(components)/Header";
import { coreApiBase } from "@/lib/coreApiBase";

type ModelCard = {
  id?: string | null;
  version?: number | null;
  status?: string | null;
  summary_md?: string | null;
  limitations?: string | null;
  out_of_scope?: string | null;
  review_cadence?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type EvidenceItem = {
  source?: string | null;
  metric_key: string;
  metric_value: unknown;
  last_seen_at?: string | null;
};

type PromptVersionItem = {
  version?: number | null;
  labels?: string[] | null;
  commit_message?: string | null;
  type?: string | null;
  prompt?: string | null;
};

type PromptVersionData = {
  name?: string | null;
  type?: string | null;
  labels?: string[] | null;
  tags?: string[] | null;
  last_updated_at?: string | null;
  versions?: PromptVersionItem[];
};

type LangfuseStatus = {
  ok?: boolean;
  configured?: boolean;
  reachable?: boolean;
  message?: string;
};

type SystemItem = {
  id: string;
  name: string;
  project_slug?: string | null;
  model_provider?: string | null;
  model_type?: string | null;
  model_version?: string | null;
  owner?: string | null;
  system_owner_email?: string | null;
  risk_tier?: string | null;
  status?: string | null;
  intended_use?: string | null;
  intended_users?: string | null;
  system_boundary?: string | null;
  training_data_sources?: string | null;
  personal_data_flag?: boolean | null;
  sensitive_attributes_flag?: boolean | null;
  lifecycle_stage?: string | null;
  deployment_environment?: string | null;
  langfuse_project_id?: string | null;
  langfuse_base_url?: string | null;
};

type ModelCardItem = {
  system: SystemItem;
  model_card: ModelCard | null;
  evidence: EvidenceItem[];
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const parseNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const extractMetric = (evidence: EvidenceItem[], key: string) => {
  const item = evidence.find((ev) => ev.metric_key === key);
  return item ? item.metric_value : null;
};

const hasLangfuseMetadata = (evidence: EvidenceItem[]) =>
  evidence.some(
    (ev) =>
      ev.source === "langfuse_metadata" &&
      (ev.metric_key === "model_provider" || ev.metric_key === "model_version")
  );

export default function ModelCardsClient({
  entityId,
}: {
  entityId: string;
}) {
  const t = useTranslations("ModelCardsPage");
  const CORE = coreApiBase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ModelCardItem[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [promptVersions, setPromptVersions] = useState<PromptVersionData | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [langfuseStatus, setLangfuseStatus] = useState<LangfuseStatus | null>(null);

  const promptLink = useMemo(() => {
    const systemWithLangfuse = items.find(
      (item) => item.system.langfuse_base_url && item.system.langfuse_project_id
    );
    if (!systemWithLangfuse) return null;
    const base = String(systemWithLangfuse.system.langfuse_base_url).replace(/\/+$/, "");
    const projectId = String(systemWithLangfuse.system.langfuse_project_id);
    return `${base}/project/${projectId}/prompts`;
  }, [items]);
  const promptKeyMissing =
    promptError?.toLowerCase().includes("prompt key not configured") ?? false;
  const promptKeyStatus = promptKeyMissing
    ? "missing"
    : promptError
      ? "error"
      : promptVersions
        ? "configured"
        : "unknown";

  const load = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `${CORE}/admin/model-cards?entity_id=${encodeURIComponent(entityId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [entityId]);

  useEffect(() => {
    const loadPromptVersions = async () => {
      setPromptError(null);
      try {
        const res = await fetch(
          `${CORE}/admin/langfuse/prompts/ai_summary_llm/versions?limit=5`,
          { cache: "no-store" }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.ok === false) {
          throw new Error(data?.message || `Failed (${res.status})`);
        }
        setPromptVersions(data?.prompt ?? null);
      } catch (err) {
        setPromptError(err instanceof Error ? err.message : t("promptLoadError"));
        setPromptVersions(null);
      }
    };
    void loadPromptVersions();
  }, [CORE, t]);

  useEffect(() => {
    const loadLangfuseStatus = async () => {
      try {
        const res = await fetch(`${CORE}/admin/langfuse/status`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        setLangfuseStatus(data);
      } catch {
        setLangfuseStatus({
          ok: false,
          configured: false,
          reachable: false,
          message: t("langfuseStatus.unreachable"),
        });
      }
    };
    void loadLangfuseStatus();
  }, [CORE, t]);

  const handleCreateDraft = async (systemId: string) => {
    setSyncing(systemId);
    setMessage(null);
    try {
      const res = await fetch(`${CORE}/admin/model-cards/${encodeURIComponent(systemId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (!res.ok) throw new Error(`Failed to create draft (${res.status})`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("actionFailed"));
    } finally {
      setSyncing(null);
    }
  };

  const handleSync = async (systemId: string) => {
    setSyncing(systemId);
    setMessage(null);
    try {
      const res = await fetch(
        `${CORE}/admin/model-cards/${encodeURIComponent(systemId)}/sync-langfuse`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.message || `Sync failed (${res.status})`);
      }
      setMessage(t("syncSuccess"));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("syncFailed"));
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-6">
      <Header title={t("title")} subtitle={t("subtitle")} />

      {message && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("loading")}</p>
      ) : error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
          {error}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("empty")}</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t("promptChecklist.title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("promptChecklist.subtitle")}
                </p>
              </div>
              {langfuseStatus ? (
                <div
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                    langfuseStatus.reachable
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200"
                  }`}
                  title={langfuseStatus.message || ""}
                >
                  {langfuseStatus.reachable
                    ? t("langfuseStatus.reachable")
                    : langfuseStatus.configured
                      ? t("langfuseStatus.unreachable")
                      : t("langfuseStatus.notConfigured")}
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                LANGFUSE_PROMPT_AI_SUMMARY_LLM
              </div>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                  promptKeyStatus === "configured"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-200"
                    : promptKeyStatus === "missing"
                      ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200"
                      : promptKeyStatus === "error"
                        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-200"
                        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {promptKeyStatus === "configured"
                  ? t("promptChecklist.configured")
                  : promptKeyStatus === "missing"
                    ? t("promptChecklist.missing")
                    : promptKeyStatus === "error"
                      ? t("promptChecklist.error")
                      : t("promptChecklist.unknown")}
              </span>
            </div>
            {promptError && !promptKeyMissing ? (
              <p className="mt-3 text-xs text-rose-600 dark:text-rose-300">
                {promptError}
              </p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t("promptVersions.title")}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t("promptVersions.subtitle")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {promptLink ? (
                  <a
                    href={promptLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {t("promptVersions.viewPrompt")}
                  </a>
                ) : null}
                {promptError?.toLowerCase().includes("prompt key not configured") ? (
                  <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
                    {t("promptVersions.envHint", { envVar: "LANGFUSE_PROMPT_AI_SUMMARY_LLM" })}
                  </div>
                ) : null}
              </div>
            </div>
            {promptError ? (
              <div className="mt-3 space-y-2 text-xs">
                <p className="text-amber-600 dark:text-amber-300">{promptError}</p>
                {promptKeyStatus !== "configured" ? (
                  <p className="text-slate-600 dark:text-slate-300">
                    {t("promptVersions.helperNote", {
                      envVar: "LANGFUSE_PROMPT_AI_SUMMARY_LLM",
                      label: "production",
                    })}
                  </p>
                ) : null}
              </div>
            ) : !promptVersions ? (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                {t("promptVersions.empty")}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {promptVersions.name} · {promptVersions.type || "text"}
                </div>
                {(promptVersions.versions ?? []).length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("promptVersions.empty")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(promptVersions.versions ?? []).map((version) => (
                      <div
                        key={`prompt-${version.version}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            v{version.version ?? "—"}
                          </span>
                          {version.labels?.length ? (
                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                              {version.labels.join(", ")}
                            </span>
                          ) : null}
                          {version.commit_message ? (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {version.commit_message}
                            </span>
                          ) : null}
                        </div>
                        {version.prompt ? (
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            {version.prompt}
                          </pre>
                        ) : (
                          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                            {t("promptVersions.noPrompt")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          {items.map((item) => {
            const system = item.system;
            const card = item.model_card;
            const evidence = item.evidence ?? [];
            const metrics = {
              latencyAvg: extractMetric(evidence, "latency_avg_ms"),
              latencyP95: extractMetric(evidence, "latency_p95_ms"),
              tokensTotal: extractMetric(evidence, "tokens_total"),
              tokensInput: extractMetric(evidence, "tokens_input"),
              tokensOutput: extractMetric(evidence, "tokens_output"),
              requestsCount: extractMetric(evidence, "requests_count"),
            };
            const noMetrics = evidence.length === 0;
            return (
              <div
                key={system.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {system.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {system.project_slug || "general"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {noMetrics && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
                        {t("metrics.noMetrics")}
                      </span>
                    )}
                    {system.langfuse_project_id && (
                      <button
                        type="button"
                        onClick={() => handleSync(system.id)}
                        disabled={syncing === system.id}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {syncing === system.id ? t("syncing") : t("syncLangfuse")}
                      </button>
                    )}
                    {!card && (
                      <button
                        type="button"
                        onClick={() => handleCreateDraft(system.id)}
                        disabled={syncing === system.id}
                        className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {t("createDraft")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                          {t("fields.modelProvider")}
                        </p>
                        <p>{formatValue(system.model_provider)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                          {t("fields.modelType")}
                        </p>
                        <p>{formatValue(system.model_type)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                          {t("fields.modelVersion")}
                        </p>
                        <p>{formatValue(system.model_version)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                          {t("fields.lifecycle")}
                        </p>
                        <p>{formatValue(system.lifecycle_stage)}</p>
                      </div>
                    </div>
                    {hasLangfuseMetadata(item.evidence) ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t("modelMetaNote")}
                      </p>
                    ) : null}

                    <div>
                      <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                        {t("fields.intendedUse")}
                      </p>
                      <p>{formatValue(system.intended_use)}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                        {t("fields.intendedUsers")}
                      </p>
                      <p>{formatValue(system.intended_users)}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                          {t("fields.riskTier")}
                        </p>
                        <p>{formatValue(system.risk_tier)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
                          {t("fields.systemStatus")}
                        </p>
                        <p>{formatValue(system.status)}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                        {t("fields.modelCard")}
                      </p>
                      {card ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t("fields.cardStatus")}: {formatValue(card.status)} · v{card.version ?? "—"}
                          </p>
                          <p>{formatValue(card.summary_md)}</p>
                          {card.limitations && <p>{card.limitations}</p>}
                          {card.out_of_scope && <p>{card.out_of_scope}</p>}
                          {card.review_cadence && (
                            <p>
                              {t("fields.reviewCadence")}: {card.review_cadence}
                            </p>
                          )}
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t("fields.lastUpdated")}: {formatDate(card.updated_at)}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          {t("noCard")}
                        </p>
                      )}
                    </div>
                  </div>

                  <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                          {t("metrics.title")}
                        </p>
                        <div className="mt-2 grid gap-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span>{t("metrics.avgLatency")}</span>
                            <span>
                              {parseNumber(metrics.latencyAvg) !== null
                                ? `${metrics.latencyAvg} ms`
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{t("metrics.p95Latency")}</span>
                            <span>
                              {parseNumber(metrics.latencyP95) !== null
                                ? `${metrics.latencyP95} ms`
                                : "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{t("metrics.totalTokens")}</span>
                            <span>{formatValue(metrics.tokensTotal)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{t("metrics.inputTokens")}</span>
                            <span>{formatValue(metrics.tokensInput)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{t("metrics.outputTokens")}</span>
                            <span>{formatValue(metrics.tokensOutput)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{t("metrics.requests")}</span>
                            <span>{formatValue(metrics.requestsCount)}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                          {t("fields.evidence")}
                        </p>
                        {evidence.length === 0 ? (
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {t("noEvidence")}
                          </p>
                        ) : (
                          <div className="mt-3 space-y-3">
                            {evidence.map((ev) => (
                              <div key={`${ev.metric_key}-${ev.source}`} className="text-xs">
                                <p className="font-semibold text-slate-800 dark:text-slate-100">
                                  {ev.metric_key}
                                </p>
                                <pre className="whitespace-pre-wrap text-[11px] text-slate-600 dark:text-slate-300">
                                  {formatValue(ev.metric_value)}
                                </pre>
                                <p className="text-[11px] text-slate-400">
                                  {formatDate(ev.last_seen_at)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
