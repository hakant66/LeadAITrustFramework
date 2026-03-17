"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { coreApiBase } from "@/lib/coreApiBase";
import Header from "@/app/(components)/Header";

type PolicyItem = {
  id: string;
  title: string;
  owner_role?: string | null;
  status?: string | null;
  iso42001_requirement?: string | null;
  iso42001_status?: string | null;
  updated_at?: string | null;
  kpi_keys?: string[] | null;
};

type ControlMapItem = {
  policy_id: string;
  project_slug: string;
  control_id: string;
};

type ReviewTask = {
  id: string;
  policy_id: string;
  policy_title: string;
  status: string;
  due_at?: string | null;
  updated_at?: string | null;
};

type Project = {
  slug: string;
  name?: string | null;
};

type ControlExecRow = {
  project_slug: string;
  control_id: string;
  kpi_key?: string | null;
  kpi_name?: string | null;
  control_name?: string | null;
  evidence_source?: string | null;
  provide_url?: string | null;
  forward_request?: boolean | null;
  comment_text?: string | null;
};

type FetchResult<T> = { ok: boolean; data?: T };

const badgeStyles = {
  success: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  danger: "bg-rose-100 text-rose-800 border-rose-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const getEvidenceStatus = (row?: ControlExecRow | null) => {
  if (!row) return false;
  return Boolean(
    (row.provide_url && row.provide_url.trim()) ||
      row.forward_request ||
      (row.comment_text && row.comment_text.trim())
  );
};

export default function PolicyExecutionClient({
  entityId,
}: {
  entityId: string;
}) {
  const t = useTranslations("PolicyExecutionPage");
  const CORE = coreApiBase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [maps, setMaps] = useState<ControlMapItem[]>([]);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [controlsByProject, setControlsByProject] = useState<
    Record<string, ControlExecRow[]>
  >({});
  const [policyFinalised, setPolicyFinalised] = useState<boolean>(false);

  const [selectedPolicy, setSelectedPolicy] = useState<PolicyItem | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedControls, setSelectedControls] = useState<Set<string>>(new Set());
  const lastAutoMapKey = useRef<string>("");
  const [savingMap, setSavingMap] = useState(false);
  const [mapMessage, setMapMessage] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [taskMessage, setTaskMessage] = useState<string | null>(null);

  const fetchJson = async <T,>(url: string): Promise<FetchResult<T>> => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { ok: false };
    try {
      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch {
      return { ok: false };
    }
  };

  const loadControls = async (projectSlug: string) => {
    if (!projectSlug || controlsByProject[projectSlug]) return;
    const res = await fetchJson<{ items?: ControlExecRow[] }>(
      `${CORE}/admin/projects/${encodeURIComponent(
        projectSlug
      )}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`
    );
    if (!res.ok) return;
    const items = Array.isArray(res.data?.items) ? res.data?.items ?? [] : [];
    setControlsByProject((prev) => ({ ...prev, [projectSlug]: items }));
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setTaskMessage(null);
      try {
        const [
          policyStatusRes,
          policyRes,
          mapRes,
          taskRes,
          projectRes,
        ] = await Promise.all([
          fetchJson<{ status?: string }>(
            `${CORE}/admin/policies/finalize-status?entity_id=${encodeURIComponent(
              entityId
            )}`
          ),
          fetchJson<{ items?: PolicyItem[] }>(
            `${CORE}/admin/policies?entity_id=${encodeURIComponent(entityId)}`
          ),
          fetchJson<{ items?: ControlMapItem[] }>(
            `${CORE}/admin/policy-control-map?entity_id=${encodeURIComponent(entityId)}`
          ),
          fetchJson<{ items?: ReviewTask[] }>(
            `${CORE}/admin/policy-review-tasks?entity_id=${encodeURIComponent(entityId)}`
          ),
          fetchJson<Project[]>(
            `${CORE}/projects?entity_id=${encodeURIComponent(entityId)}`
          ),
        ]);

        if (!mounted) return;
        const finalised = policyStatusRes.ok && policyStatusRes.data?.status === "finalised";
        setPolicyFinalised(finalised);
        setPolicies(Array.isArray(policyRes.data?.items) ? policyRes.data?.items ?? [] : []);
        setMaps(Array.isArray(mapRes.data?.items) ? mapRes.data?.items ?? [] : []);
        setTasks(Array.isArray(taskRes.data?.items) ? taskRes.data?.items ?? [] : []);
        setProjects(Array.isArray(projectRes.data) ? projectRes.data ?? [] : []);

        const mappedProjects = new Set(
          (mapRes.data?.items ?? []).map((item) => item.project_slug)
        );
        await Promise.all(
          Array.from(mappedProjects).map(async (projectSlug) => {
            const res = await fetchJson<{ items?: ControlExecRow[] }>(
              `${CORE}/admin/projects/${encodeURIComponent(
                projectSlug
              )}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`
            );
            if (!res.ok || !mounted) return;
            const items = Array.isArray(res.data?.items) ? res.data?.items ?? [] : [];
            setControlsByProject((prev) => ({ ...prev, [projectSlug]: items }));
          })
        );
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : t("loadError"));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [CORE, entityId, t]);

  const mappingByPolicy = useMemo(() => {
    const grouped: Record<string, ControlMapItem[]> = {};
    maps.forEach((item) => {
      if (!grouped[item.policy_id]) grouped[item.policy_id] = [];
      grouped[item.policy_id].push(item);
    });
    return grouped;
  }, [maps]);

  const controlsIndex = useMemo(() => {
    const index: Record<string, Record<string, ControlExecRow>> = {};
    Object.entries(controlsByProject).forEach(([slug, rows]) => {
      const byId: Record<string, ControlExecRow> = {};
      rows.forEach((row) => {
        byId[row.control_id] = row;
      });
      index[slug] = byId;
    });
    return index;
  }, [controlsByProject]);

  const reviewTaskByPolicy = useMemo(() => {
    const map: Record<string, ReviewTask> = {};
    tasks.forEach((task) => {
      map[task.policy_id] = task;
    });
    return map;
  }, [tasks]);

  const executablePolicies = useMemo(() => {
    return policies.filter((policy) => {
      const status = (policy.status || "").toString().trim().toLowerCase();
      return status === "approved" || status === "active";
    });
  }, [policies]);

  const summary = useMemo(() => {
    const approvedIds = new Set(executablePolicies.map((policy) => policy.id));
    const openReviews = tasks.filter(
      (task) => approvedIds.has(task.policy_id) && task.status !== "completed"
    ).length;
    return {
      policies: executablePolicies.length,
      openReviews,
    };
  }, [executablePolicies, tasks]);

  const openManage = (policy: PolicyItem) => {
    setSelectedPolicy(policy);
    const defaultProject = projects[0]?.slug ?? "";
    setSelectedProject(defaultProject);
    setMapMessage(null);
    setMapError(null);
    if (defaultProject) {
      const existing = mappingByPolicy[policy.id]?.filter(
        (item) => item.project_slug === defaultProject
      );
      setSelectedControls(new Set(existing?.map((item) => item.control_id) ?? []));
      void loadControls(defaultProject);
    } else {
      setSelectedControls(new Set());
    }
  };

  const closeManage = () => {
    setSelectedPolicy(null);
    setSelectedProject("");
    setSelectedControls(new Set());
    setMapMessage(null);
    setMapError(null);
  };

  useEffect(() => {
    if (!selectedPolicy || !selectedProject) return;
    const existing = mappingByPolicy[selectedPolicy.id]?.filter(
      (item) => item.project_slug === selectedProject
    );
    setSelectedControls(new Set(existing?.map((item) => item.control_id) ?? []));
    void loadControls(selectedProject);
  }, [mappingByPolicy, selectedPolicy, selectedProject]);

  const toggleControl = (controlId: string) => {
    setSelectedControls((prev) => {
      const next = new Set(prev);
      if (next.has(controlId)) {
        next.delete(controlId);
      } else {
        next.add(controlId);
      }
      return next;
    });
  };

  const saveMappingWithControls = async (controlIds: string[]) => {
    if (!selectedPolicy || !selectedProject) return false;
    setSavingMap(true);
    setMapError(null);
    setMapMessage(null);
    try {
      const payload = {
        policy_id: selectedPolicy.id,
        project_slug: selectedProject,
        control_ids: controlIds,
      };
      const res = await fetch(
        `${CORE}/admin/policy-control-map?entity_id=${encodeURIComponent(entityId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || t("manage.saveFailed"));
      }
      setMaps((prev) => {
        const filtered = prev.filter(
          (item) =>
            !(
              item.policy_id === selectedPolicy.id &&
              item.project_slug === selectedProject
            )
        );
        const added = controlIds.map((control_id) => ({
          policy_id: selectedPolicy.id,
          project_slug: selectedProject,
          control_id,
        }));
        return [...filtered, ...added];
      });
      setMapMessage(t("manage.saved"));
      return true;
    } catch (err) {
      setMapError(err instanceof Error ? err.message : t("manage.saveFailed"));
      return false;
    } finally {
      setSavingMap(false);
    }
  };

  const saveMapping = async () => {
    if (!selectedPolicy || !selectedProject) return;
    await saveMappingWithControls(Array.from(selectedControls));
  };

  const autoMapMatchingControls = async () => {
    if (!selectedPolicy || !selectedProject) return;
    const allowed = new Set(
      (selectedPolicy.kpi_keys ?? []).map((key) =>
        String(key).toLowerCase()
      )
    );
    if (allowed.size === 0) {
      setMapError(t("manage.noPolicyKpis"));
      return;
    }
    const allControls = controlsByProject[selectedProject] ?? [];
    const matching = allControls.filter((control) =>
      allowed.has(String(control.kpi_key ?? "").toLowerCase())
    );
    if (matching.length === 0) {
      setMapError(t("manage.noControls"));
      return;
    }
    const ids = matching.map((control) => control.control_id);
    setSelectedControls(new Set(ids));
    await saveMappingWithControls(ids);
  };

  useEffect(() => {
    if (!selectedPolicy || !selectedProject || savingMap) return;
    const key = `${selectedPolicy.id}::${selectedProject}`;
    if (lastAutoMapKey.current === key) return;
    const existing = mappingByPolicy[selectedPolicy.id]?.filter(
      (item) => item.project_slug === selectedProject
    );
    if (existing && existing.length > 0) {
      lastAutoMapKey.current = key;
      return;
    }
    const projectControls = controlsByProject[selectedProject];
    if (!projectControls) return;
    lastAutoMapKey.current = key;
    void autoMapMatchingControls();
  }, [
    selectedPolicy,
    selectedProject,
    controlsByProject,
    mappingByPolicy,
    savingMap,
  ]);

  const completeTask = async (task: ReviewTask) => {
    setTaskMessage(null);
    try {
      const res = await fetch(
        `${CORE}/admin/policy-review-tasks/${encodeURIComponent(
          task.id
        )}/complete?entity_id=${encodeURIComponent(entityId)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || t("tasks.completeFailed"));
      }
      setTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, status: "completed" } : item
        )
      );
      setTaskMessage(t("tasks.completed"));
    } catch (err) {
      setTaskMessage(err instanceof Error ? err.message : t("tasks.completeFailed"));
    }
  };

  const renderReviewBadge = (task?: ReviewTask) => {
    if (!task) {
      return (
        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badgeStyles.neutral}`}>
          {t("badges.notScheduled")}
        </span>
      );
    }
    if (task.status === "completed") {
      return (
        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badgeStyles.success}`}>
          {t("badges.completed")}
        </span>
      );
    }
    const dueDate = task.due_at ? new Date(task.due_at) : null;
    if (!dueDate || Number.isNaN(dueDate.valueOf())) {
      return (
        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badgeStyles.neutral}`}>
          {t("badges.scheduled")}
        </span>
      );
    }
    const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / 86400000);
    if (diffDays < 0) {
      return (
        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badgeStyles.danger}`}>
          {t("badges.overdue", { days: Math.abs(diffDays) })}
        </span>
      );
    }
    if (diffDays <= 14) {
      return (
        <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badgeStyles.warning}`}>
          {t("badges.dueSoon", { days: diffDays })}
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${badgeStyles.neutral}`}>
        {t("badges.dueLater", { days: diffDays })}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title={t("title")} subtitle={t("subtitle")} titleNote={t("titleNote")} />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {t("loading")}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header title={t("title")} subtitle={t("subtitle")} titleNote={t("titleNote")} />
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-700/50 dark:bg-rose-900/20 dark:text-rose-100">
          {error}
        </div>
      )}
      {!policyFinalised && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-100">
          <div className="font-semibold">{t("setupPendingTitle")}</div>
          <div className="mt-1">{t("setupPendingBody")}</div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
        {[
          { label: t("summary.policies"), value: summary.policies },
          { label: t("summary.openReviews"), value: summary.openReviews },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <div className="text-xs uppercase tracking-wide text-slate-500">{card.label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("tableTitle")}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t("tableSubtitle")}
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">{t("table.policy")}</th>
                <th className="px-4 py-3 text-left">{t("table.reviewDue")}</th>
                <th className="px-4 py-3 text-left">{t("table.reviewStatus")}</th>
                <th className="px-4 py-3 text-left">{t("table.manage")}</th>
              </tr>
            </thead>
            <tbody>
              {executablePolicies.map((policy) => {
                const task = reviewTaskByPolicy[policy.id];
                return (
                  <tr
                    key={policy.id}
                    className="border-t border-slate-100 text-slate-700 dark:border-slate-800 dark:text-slate-200"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {policy.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        {policy.owner_role || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{task?.due_at ? formatDate(task.due_at) : "—"}</td>
                    <td className="px-4 py-3">{renderReviewBadge(task)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openManage(policy)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:text-slate-200 dark:hover:border-indigo-500/60"
                      >
                        {t("table.manageButton")}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {executablePolicies.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    {t("tableEmpty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("tasks.title")}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t("tasks.subtitle")}
          </div>
        </div>
        <div className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
          {taskMessage && (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {taskMessage}
            </div>
          )}
          {tasks.filter((task) => executablePolicies.some((p) => p.id === task.policy_id))
            .length === 0 && (
            <div className="text-slate-500">{t("tasks.empty")}</div>
          )}
          {tasks.filter((task) => executablePolicies.some((p) => p.id === task.policy_id))
            .length > 0 && (
            <div className="space-y-3">
              {tasks
                .filter((task) => executablePolicies.some((p) => p.id === task.policy_id))
                .map((task) => (
                <div
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {task.policy_title}
                    </div>
                    <div className="text-xs text-slate-500">
                      {t("tasks.dueLabel")}: {task.due_at ? formatDate(task.due_at) : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {renderReviewBadge(task)}
                    <button
                      type="button"
                      onClick={() => completeTask(task)}
                      disabled={task.status === "completed"}
                      className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                        task.status === "completed"
                          ? "cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500"
                          : "border-indigo-200 text-indigo-700 hover:border-indigo-300 dark:border-indigo-500/50 dark:text-indigo-200"
                      }`}
                    >
                      {t("tasks.markReviewed")}
                    </button>
                  </div>
                  </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div>
                <div className="text-xs uppercase text-slate-500">
                  {t("manage.title")}
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selectedPolicy.title}
                </div>
              </div>
              <button
                type="button"
                onClick={closeManage}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
              >
                {t("manage.close")}
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    {t("manage.project")}
                  </div>
                  {projects.length === 0 ? (
                    <div className="mt-2 text-sm text-slate-500">
                      {t("manage.noProject")}
                    </div>
                  ) : (
                    <select
                      value={selectedProject}
                      onChange={(event) => setSelectedProject(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    >
                      {projects.map((project) => (
                        <option key={project.slug} value={project.slug}>
                          {project.name ?? project.slug}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    {t("manage.selected")}
                  </div>
                  <div className="mt-2 text-sm">
                    {selectedControls.size} {t("manage.selectedCount")}
                  </div>
                </div>
              </div>

              {mapError && (
                <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {mapError}
                </div>
              )}
              {mapMessage && (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  {mapMessage}
                </div>
              )}

              <div className="mt-5">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  {t("manage.controls")}
                </div>
                <div className="mt-3 space-y-2">
                  {(() => {
                    const allowed = new Set(
                      (selectedPolicy.kpi_keys ?? []).map((key) =>
                        String(key).toLowerCase()
                      )
                    );
                    const allControls = controlsByProject[selectedProject] ?? [];
                    const filteredControls =
                      allowed.size > 0
                        ? allControls.filter((control) =>
                            allowed.has(String(control.kpi_key ?? "").toLowerCase())
                          )
                        : [];
                    return filteredControls.map((control) => {
                    const ready = getEvidenceStatus(control);
                    return (
                      <label
                        key={control.control_id}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedControls.has(control.control_id)}
                            onChange={() => toggleControl(control.control_id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {control.control_name || control.control_id}
                            </div>
                            <div className="text-xs text-slate-500">
                              {control.kpi_name || control.kpi_key || "—"}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${
                            ready ? badgeStyles.success : badgeStyles.warning
                          }`}
                        >
                          {ready ? t("manage.evidenceReady") : t("manage.evidenceMissing")}
                        </span>
                      </label>
                    );
                  })})()}
                  {selectedProject &&
                    (controlsByProject[selectedProject] ?? []).length === 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                      {t("manage.noControls")}
                    </div>
                  )}
                  {selectedProject &&
                    (controlsByProject[selectedProject] ?? []).length > 0 &&
                    (!selectedPolicy.kpi_keys || selectedPolicy.kpi_keys.length === 0) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-100">
                      {t("manage.noPolicyKpis")}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <div className="text-xs text-slate-500">{t("manage.helper")}</div>
              <button
                type="button"
                onClick={saveMapping}
                disabled={savingMap || !selectedProject}
                className="rounded-lg border border-indigo-200 bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {savingMap ? t("manage.saving") : t("manage.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
