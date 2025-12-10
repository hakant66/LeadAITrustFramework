// apps/web/src/app/scorecard/admin/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/app/(components)/Header";
import Link from "next/link";

type ProjectCreate = {
  slug: string;
  name: string;
  risk_level: string;
  target_threshold: number; // 0..1
  priority: string;
  sponsor: string;
  owner: string;
  creation_date: string;
  update_date: string;
};

type ProjectSummary = {
  id: string;
  slug: string;
  name: string;
  risk_level: string | null;
  target_threshold: number | null;
  priority: string | null;
  sponsor: string | null;
  owner: string | null;
  creation_date: string | null;
  update_date: string | null;
};

type PillarPayload = {
  pillar: string;
  score_pct: number;
  maturity?: number;
};

type ScorePayload = {
  control_id: string;
  score: number;
};

const base =
  process.env.NEXT_PUBLIC_CORE_SVC_URL ??
  process.env.CORE_SVC_URL ??
  "http://localhost:8001";

const emptyProject: ProjectCreate = {
  slug: "",
  name: "",
  risk_level: "low",
  target_threshold: 0.75,
  priority: "low",
  sponsor: "",
  owner: "",
  creation_date: "",
  update_date: "",
};

const toDateInput = (value?: string | null): string =>
  value && value.length >= 10 ? value.slice(0, 10) : "";

const toDateTimeLocalInput = (value?: string | null): string => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const offsetMs = parsed.getTimezoneOffset() * 60 * 1000;
  const local = new Date(parsed.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
};

const fromDateTimeLocal = (value: string): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const emptyToNull = (value: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

function ensureCloneSlug(sourceSlug: string, existing: Set<string>): string {
  const normalized =
    sourceSlug.trim().toLowerCase().replace(/\s+/g, "-") || "project";
  const root = `${normalized}-clone`;
  if (!existing.has(root)) return root;
  let idx = 2;
  let candidate = `${root}-${idx}`;
  while (existing.has(candidate)) {
    idx += 1;
    candidate = `${root}-${idx}`;
  }
  return candidate;
}

function extractPillarPayload(detail: any): PillarPayload[] {
  if (!Array.isArray(detail?.pillars)) return [];
  const results: PillarPayload[] = [];
  for (const raw of detail.pillars) {
    const pillar = String(
      raw?.pillar ?? raw?.pillar_key ?? raw?.name ?? ""
    ).trim();
    if (!pillar) continue;
    const scoreValue = Number(raw?.score_pct ?? raw?.score ?? NaN);
    if (!Number.isFinite(scoreValue)) continue;
    const maturityValue = Number(raw?.maturity);
    results.push({
      pillar,
      score_pct: Math.max(0, Math.min(100, Math.round(scoreValue))),
      maturity: Number.isFinite(maturityValue) ? maturityValue : undefined,
    });
  }
  return results;
}

function extractScorePayload(detail: any): ScorePayload[] {
  if (!Array.isArray(detail?.kpis)) return [];
  const items: ScorePayload[] = [];
  for (const k of detail.kpis) {
    const controlId = String(
      k?.key ?? k?.control_id ?? k?.kpi_id ?? ""
    ).trim();
    if (!controlId) continue;
    const rawValue = Number(k?.raw_value);
    const normalized = Number(k?.normalized_pct);
    const value = Number.isFinite(rawValue)
      ? rawValue
      : Number.isFinite(normalized)
      ? normalized
      : null;
    if (value === null) continue;
    items.push({ control_id: controlId, score: value });
  }
  return items;
}

export default function AdminCaptureProjectPage() {
  const [proj, setProj] = useState<ProjectCreate>({ ...emptyProject });
  const [createBusy, setCreateBusy] = useState(false);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [cloneTarget, setCloneTarget] = useState("");
  const [deleteTarget, setDeleteTarget] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editForm, setEditForm] = useState<ProjectCreate>({ ...emptyProject });

  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildProjectPayload = (form: ProjectCreate) => {
    const slug = form.slug.trim();
    const risk = form.risk_level.trim();
    const priority = form.priority.trim();
    const thresholdValue = Number(form.target_threshold);
    return {
      slug,
      name: form.name.trim() || slug,
      risk_level: risk || undefined,
      target_threshold: Number.isFinite(thresholdValue)
        ? thresholdValue
        : 0.75,
      priority: priority || (risk || undefined),
      sponsor: emptyToNull(form.sponsor),
      owner: emptyToNull(form.owner),
      creation_date: emptyToNull(form.creation_date),
      update_date: fromDateTimeLocal(form.update_date),
    };
  };

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const res = await fetch(`${base}/projects`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load projects (${res.status})`);
      }
      const data = await res.json();
      const list: ProjectSummary[] = Array.isArray(data)
        ? data.map((p: any) => {
            const risk =
              typeof p.risk_level === "string" && p.risk_level.trim()
                ? p.risk_level
                : null;
            const priority =
              typeof p.priority === "string" && p.priority.trim()
                ? p.priority
                : risk;
            return {
              id: String(p.id ?? ""),
              slug: String(p.slug ?? ""),
              name: String(p.name ?? p.slug ?? ""),
              risk_level: risk,
              target_threshold:
                typeof p.target_threshold === "number"
                  ? p.target_threshold
                  : Number.isFinite(Number(p.target_threshold))
                  ? Number(p.target_threshold)
                  : null,
              priority,
              sponsor:
                typeof p.sponsor === "string" && p.sponsor.trim()
                  ? p.sponsor
                  : null,
              owner:
                typeof p.owner === "string" && p.owner.trim()
                  ? p.owner
                  : null,
              creation_date:
                typeof p.creation_date === "string" && p.creation_date
                  ? p.creation_date
                  : null,
              update_date:
                typeof p.update_date === "string" && p.update_date
                  ? p.update_date
                  : null,
            };
          })
        : [];
      setProjects(list);
      if (list.length) {
        const fallbackSlug = list[0].slug;
        setCloneTarget((prev) =>
          prev && list.some((p) => p.slug === prev) ? prev : fallbackSlug
        );
        setDeleteTarget((prev) =>
          prev && list.some((p) => p.slug === prev) ? prev : fallbackSlug
        );
        setEditTarget((prev) =>
          prev && list.some((p) => p.slug === prev) ? prev : fallbackSlug
        );
      } else {
        setCloneTarget("");
        setDeleteTarget("");
        setEditTarget("");
        setEditForm({ ...emptyProject });
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!editTarget) {
      setEditForm({ ...emptyProject });
      return;
    }
    const selected = projects.find((p) => p.slug === editTarget);
    if (selected) {
      const riskLevel = selected.risk_level ?? "low";
      setEditForm({
        slug: selected.slug,
        name: selected.name,
        risk_level: riskLevel,
        target_threshold:
          typeof selected.target_threshold === "number"
            ? selected.target_threshold
            : 0.75,
        priority: selected.priority ?? riskLevel,
        sponsor: selected.sponsor ?? "",
        owner: selected.owner ?? "",
        creation_date: toDateInput(selected.creation_date),
        update_date: toDateTimeLocalInput(selected.update_date),
      });
    } else {
      setEditForm({ ...emptyProject });
    }
  }, [editTarget, projects]);

  const onCreateProject = async () => {
    setCreateBusy(true);
    setMsg(null);
    setError(null);
    try {
      const payload = buildProjectPayload(proj);
      if (
        typeof payload.target_threshold === "number" &&
        (payload.target_threshold < 0 || payload.target_threshold > 1)
      ) {
        throw new Error("Target threshold must be between 0 and 1.");
      }
      const res = await fetch(`${base}/admin/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || `Create project failed (${res.status})`);
      }
      setMsg(`Project '${proj.slug}' created.`);
      setProj({ ...emptyProject });
      await loadProjects();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleCloneProject = async () => {
    if (!cloneTarget) return;
    setCloneBusy(true);
    setMsg(null);
    setError(null);
    try {
      const source = projects.find((p) => p.slug === cloneTarget);
      const detailRes = await fetch(
        `${base}/scorecard/${encodeURIComponent(cloneTarget)}`,
        { cache: "no-store" }
      );
      if (!detailRes.ok) {
        throw new Error(`Failed to load project data (${detailRes.status})`);
      }
      const payload = await detailRes.json();
      const sourceProject = payload?.project ?? {};
      const currentSlugs = new Set(projects.map((p) => p.slug));

      const canonicalSlug =
        String(sourceProject.slug ?? source?.slug ?? cloneTarget) || cloneTarget;
      const newSlug = ensureCloneSlug(canonicalSlug, currentSlugs);
      const newName = `${String(
        sourceProject.name ?? source?.name ?? cloneTarget
      )} clone`;
      const riskLevel =
        typeof sourceProject.risk_level === "string"
          ? sourceProject.risk_level
          : source?.risk_level ?? "low";
      const priorityValue =
        typeof sourceProject.priority === "string"
          ? sourceProject.priority
          : source?.priority ?? riskLevel;
      const sponsorValue =
        typeof sourceProject.sponsor === "string"
          ? sourceProject.sponsor
          : source?.sponsor ?? null;
      const ownerValue =
        typeof sourceProject.owner === "string"
          ? sourceProject.owner
          : source?.owner ?? null;
      const targetThreshold =
        typeof sourceProject.target_threshold === "number"
          ? sourceProject.target_threshold
          : typeof source?.target_threshold === "number"
          ? source?.target_threshold ?? 0.75
          : Number.isFinite(Number(source?.target_threshold))
          ? Number(source?.target_threshold)
          : 0.75;
      const creationDateValue =
        typeof sourceProject.creation_date === "string"
          ? sourceProject.creation_date
          : source?.creation_date ?? null;
      const updateDateValue =
        typeof sourceProject.update_date === "string"
          ? sourceProject.update_date
          : source?.update_date ?? null;

      const createRes = await fetch(`${base}/admin/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: newSlug,
          name: newName,
          risk_level: riskLevel,
          target_threshold: targetThreshold,
          priority: priorityValue,
          sponsor: sponsorValue,
          owner: ownerValue,
          creation_date: creationDateValue,
          update_date: updateDateValue,
        }),
      });
      if (!createRes.ok) {
        const j = await createRes.json().catch(() => ({}));
        throw new Error(
          j?.detail || `Clone failed during creation (${createRes.status})`
        );
      }

      const pillarPayload = extractPillarPayload(payload);
      if (pillarPayload.length) {
        const pillarsRes = await fetch(
          `${base}/scorecard/${encodeURIComponent(newSlug)}/pillars`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pillars: pillarPayload }),
          }
        );
        if (!pillarsRes.ok) {
          const text = await pillarsRes.text().catch(() => "");
          throw new Error(
            `Failed to copy pillars (${pillarsRes.status}): ${text}`
          );
        }
      }

      const scorePayload = extractScorePayload(payload);
      if (scorePayload.length) {
        const scoreRes = await fetch(
          `${base}/scorecard/${encodeURIComponent(newSlug)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scores: scorePayload }),
          }
        );
        if (!scoreRes.ok) {
          const text = await scoreRes.text().catch(() => "");
          throw new Error(
            `Failed to copy KPI scores (${scoreRes.status}): ${text}`
          );
        }
      }

      setMsg(
        `Project '${newName}' cloned from '${source?.name ?? cloneTarget}'.`
      );
      await loadProjects();
      setCloneTarget(newSlug);
      setDeleteTarget(newSlug);
      setEditTarget(newSlug);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setCloneBusy(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    const project = projects.find((p) => p.slug === deleteTarget);
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Are you sure? All data will be permanently deleted."
      );
      if (!confirmed) return;
    }
    setDeleteBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(
        `${base}/projects/${encodeURIComponent(deleteTarget)}`,
        { method: "DELETE" }
      );
      if (!res.ok && res.status !== 204) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text || `Delete failed (${res.status || "unknown status"})`
        );
      }
      setMsg(`Project '${project?.name ?? deleteTarget}' deleted.`);
      await loadProjects();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleUpdateProject = async () => {
    if (!editTarget) return;
    setUpdateBusy(true);
    setMsg(null);
    setError(null);
    try {
      const original = projects.find((p) => p.slug === editTarget);
      if (!original) {
        throw new Error("Selected project not found.");
      }

      const desiredSlug = editForm.slug.trim();
      if (!desiredSlug) {
        throw new Error("Slug cannot be empty.");
      }
      const targetThreshold = Number(editForm.target_threshold);
      if (
        !Number.isFinite(targetThreshold) ||
        targetThreshold < 0 ||
        targetThreshold > 1
      ) {
        throw new Error("Target threshold must be between 0 and 1.");
      }

      const payload = {
        ...buildProjectPayload({ ...editForm, slug: desiredSlug }),
        target_threshold: targetThreshold,
      };

      if (desiredSlug === original.slug) {
        const res = await fetch(`${base}/admin/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Update failed (${res.status})`);
        }
      } else {
        const detailRes = await fetch(
          `${base}/scorecard/${encodeURIComponent(original.slug)}`,
          { cache: "no-store" }
        );
        if (!detailRes.ok) {
          throw new Error(
            `Failed to load project data for rename (${detailRes.status})`
          );
        }
        const detail = await detailRes.json();

        const createRes = await fetch(`${base}/admin/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!createRes.ok) {
          const text = await createRes.text().catch(() => "");
          throw new Error(
            text || `Failed to create renamed project (${createRes.status})`
          );
        }

        const pillarPayload = extractPillarPayload(detail);
        if (pillarPayload.length) {
          const pillarsRes = await fetch(
            `${base}/scorecard/${encodeURIComponent(desiredSlug)}/pillars`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pillars: pillarPayload }),
            }
          );
          if (!pillarsRes.ok) {
            const text = await pillarsRes.text().catch(() => "");
            throw new Error(
              `Failed to migrate pillars (${pillarsRes.status}): ${text}`
            );
          }
        }

        const scorePayload = extractScorePayload(detail);
        if (scorePayload.length) {
          const scoreRes = await fetch(
            `${base}/scorecard/${encodeURIComponent(desiredSlug)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scores: scorePayload }),
            }
          );
          if (!scoreRes.ok) {
            const text = await scoreRes.text().catch(() => "");
            throw new Error(
              `Failed to migrate KPI scores (${scoreRes.status}): ${text}`
            );
          }
        }

        const deleteRes = await fetch(
          `${base}/projects/${encodeURIComponent(original.slug)}`,
          { method: "DELETE" }
        );
        if (!deleteRes.ok && deleteRes.status !== 204) {
          const text = await deleteRes.text().catch(() => "");
          throw new Error(
            text || `Failed to delete old project (${deleteRes.status})`
          );
        }
      }

      setMsg(`Project '${payload.name}' updated.`);
      await loadProjects();
      setEditTarget(payload.slug);
      setCloneTarget(payload.slug);
      setDeleteTarget(payload.slug);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setUpdateBusy(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
    "placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 " +
    "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

  const selectClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
    "focus:outline-none focus:ring-1 focus:ring-indigo-500 " +
    "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="px-6 py-6 max-w-4xl mx-auto space-y-6">
        <Header title="AI Projects Admin" subtitle="LeadAI · Admin Tools">
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/scorecard"
              className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-white text-indigo-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-slate-800"
            >
              Back to AI Projects
            </Link>
            <Link
              href="/scorecard/admin/data-manager"
              className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-slate-200 bg-white/80 backdrop-blur text-indigo-700 hover:bg-white transition dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-slate-800"
            >
              Data Manager
            </Link>
          </div>
        </Header>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </div>
        )}
        {msg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-emerald-100">
            {msg}
          </div>
        )}

        {/* Edit / rename project */}
        <section className="border rounded-2xl bg-white shadow-sm p-4 space-y-3 border-slate-200 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-lg font-semibold">Change AI Project</div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Update project properties or rename an existing scorecard.
              </p>
            </div>
            <select
              className={selectClass}
              value={editTarget}
              onChange={(e) => setEditTarget(e.target.value)}
              disabled={projectsLoading || projects.length === 0}
            >
              {projects.length === 0 ? (
                <option value="">No projects yet</option>
              ) : (
                projects.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name} ({p.slug})
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">Name</div>
              <input
                className={inputClass}
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Contract Analysis"
                disabled={!editTarget || projectsLoading}
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">Risk level</div>
              <select
                className={selectClass}
                value={editForm.risk_level}
                onChange={(e) =>
                  setEditForm((prev) => {
                    const nextRisk = e.target.value;
                    const shouldSync =
                      !prev.priority ||
                      prev.priority === prev.risk_level ||
                      prev.priority === "";
                    return {
                      ...prev,
                      risk_level: nextRisk,
                      priority: shouldSync ? nextRisk : prev.priority,
                    };
                  })
                }
                disabled={!editTarget || projectsLoading}
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">Priority</div>
              <select
                className={selectClass}
                value={editForm.priority}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    priority: e.target.value,
                  }))
                }
                disabled={!editTarget || projectsLoading}
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">
                Target threshold (0..1)
              </div>
              <input
                type="number"
                step="0.01"
                min={0}
                max={1}
                className={inputClass}
                value={editForm.target_threshold}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    target_threshold: Number(e.target.value),
                  }))
                }
                disabled={!editTarget || projectsLoading}
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">Sponsor</div>
              <input
                className={inputClass}
                value={editForm.sponsor}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, sponsor: e.target.value }))
                }
                placeholder="alex@lead.ai"
                disabled={!editTarget || projectsLoading}
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">Owner</div>
              <input
                className={inputClass}
                value={editForm.owner}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, owner: e.target.value }))
                }
                placeholder="Product Lead"
                disabled={!editTarget || projectsLoading}
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">
                Creation date
              </div>
              <input
                type="date"
                className={inputClass}
                value={editForm.creation_date}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    creation_date: e.target.value,
                  }))
                }
                disabled={!editTarget || projectsLoading}
              />
            </label>

            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">
                Last update
              </div>
              <input
                type="datetime-local"
                className={inputClass}
                value={editForm.update_date}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    update_date: e.target.value,
                  }))
                }
                disabled={!editTarget || projectsLoading}
              />
            </label>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            <button
              type="button"
              onClick={handleUpdateProject}
              disabled={
                !editTarget ||
                updateBusy ||
                projectsLoading ||
                !editForm.slug.trim() ||
                !editForm.name.trim()
              }
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500"
            >
              {updateBusy ? "Saving..." : "Save Changes"}
            </button>
            {editForm.slug && (
              <a
                className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 transition dark:border-slate-600 dark:hover:bg-slate-800"
                href={`/scorecard/${encodeURIComponent(
                  editForm.slug
                )}/dashboard/kpis_admin`}
              >
                Go to project admin
              </a>
            )}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Changing the slug will move all scorecard data to the new slug and
            delete the original project.
          </p>
        </section>

        {/* Create project & clone/delete panels */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-2xl bg-white shadow-sm p-4 md:col-span-2 border-slate-200 dark:border-slate-700 dark:bg-slate-900">
            <div className="text-lg font-semibold mb-3">Capture AI Project</div>

            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm">
                <div className="mb-1 text-slate-600 dark:text-slate-300">Slug</div>
                <input
                  className={inputClass}
                  placeholder="contract-analysis"
                  value={proj.slug}
                  onChange={(e) => setProj({ ...proj, slug: e.target.value })}
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-600 dark:text-slate-300">Name</div>
                <input
                  className={inputClass}
                  placeholder="Contract Analysis"
                  value={proj.name}
                  onChange={(e) => setProj({ ...proj, name: e.target.value })}
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-600 dark:text-slate-300">
                  Risk level
                </div>
                <select
                  className={selectClass}
                  value={proj.risk_level}
                  onChange={(e) => {
                    const nextRisk = e.target.value;
                    setProj((prev) => {
                      const shouldSync =
                        !prev.priority ||
                        prev.priority === prev.risk_level ||
                        prev.priority === "";
                      return {
                        ...prev,
                        risk_level: nextRisk,
                        priority: shouldSync ? nextRisk : prev.priority,
                      };
                    });
                  }}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-600 dark:text-slate-300">
                  Priority
                </div>
                <select
                  className={selectClass}
                  value={proj.priority}
                  onChange={(e) =>
                    setProj((prev) => ({ ...prev, priority: e.target.value }))
                  }
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-600 dark:text-slate-300">
                  Target threshold (0..1)
                </div>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  className={inputClass}
                  value={proj.target_threshold}
                  onChange={(e) =>
                    setProj({
                      ...proj,
                      target_threshold: Number(e.target.value),
                    })
                  }
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-600 dark:text-slate-300">
                  Sponsor
                </div>
                <input
                  className={inputClass}
                  placeholder="alex@lead.ai"
                  value={proj.sponsor}
                  onChange={(e) =>
                    setProj((prev) => ({ ...prev, sponsor: e.target.value }))
                  }
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-600 dark:text-slate-300">
                  Owner
                </div>
                <input
                  className={inputClass}
                  placeholder="Product Lead"
                  value={proj.owner}
                  onChange={(e) =>
                    setProj((prev) => ({ ...prev, owner: e.target.value }))
                  }
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-600 dark:text-slate-300">
                  Creation date
                </div>
                <input
                  type="date"
                  className={inputClass}
                  value={proj.creation_date}
                  onChange={(e) =>
                    setProj((prev) => ({
                      ...prev,
                      creation_date: e.target.value,
                    }))
                  }
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 text-slate-600 dark:text-slate-300">
                  Last update
                </div>
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={proj.update_date}
                  onChange={(e) =>
                    setProj((prev) => ({
                      ...prev,
                      update_date: e.target.value,
                    }))
                  }
                />

              </label>

              <div className="flex gap-2 items-center flex-wrap">
                <button
                  disabled={
                    createBusy ||
                    !proj.slug.trim() ||
                    !proj.name.trim() ||
                    Number.isNaN(proj.target_threshold)
                  }
                  onClick={onCreateProject}
                  className="mt-2 inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500"
                >
                  {createBusy ? "Creating..." : "Create Project"}
                </button>

                {proj.slug && (
                  <a
                    className="mt-2 inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 transition dark:border-slate-600 dark:hover:bg-slate-800"
                    href={`/scorecard/${encodeURIComponent(
                      proj.slug
                    )}/dashboard/kpis_admin`}
                  >
                    Go to this project's admin
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="border rounded-2xl bg-white shadow-sm p-4 space-y-3 border-slate-200 dark:border-slate-700 dark:bg-slate-900">
            <div className="text-lg font-semibold">Clone AI Project</div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Duplicate an existing project. The new project keeps KPI scores
              and pillar overrides, with the name suffixed by <code>clone</code>.
            </p>
            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">
                Project to clone
              </div>
              <select
                className={selectClass}
                value={cloneTarget}
                onChange={(e) => setCloneTarget(e.target.value)}
                disabled={projectsLoading || cloneBusy || projects.length === 0}
              >
                {projects.length === 0 ? (
                  <option value="">No projects yet</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name} ({p.slug})
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="button"
              onClick={handleCloneProject}
              disabled={!cloneTarget || cloneBusy || projectsLoading}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500"
            >
              {cloneBusy ? "Cloning..." : "Clone Project"}
            </button>
          </div>

          <div className="border rounded-2xl bg-white shadow-sm p-4 space-y-3 border-slate-200 dark:border-slate-700 dark:bg-slate-900">
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">
              Delete AI Project
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Remove a project and all of its scorecard data from the backend.
            </p>
            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">
                Project to delete
              </div>
              <select
                className={selectClass}
                value={deleteTarget}
                onChange={(e) => setDeleteTarget(e.target.value)}
                disabled={projectsLoading || deleteBusy || projects.length === 0}
              >
                {projects.length === 0 ? (
                  <option value="">No projects yet</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name} ({p.slug})
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="button"
              onClick={handleDeleteProject}
              disabled={!deleteTarget || deleteBusy || projectsLoading}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-500"
            >
              {deleteBusy ? "Deleting..." : "Delete Project"}
            </button>
          </div>
        </section>

        <div className="text-sm text-slate-600 dark:text-slate-400">
          Need to manage global controls? Go to{" "}
          <a
            className="underline text-indigo-600 dark:text-indigo-300"
            href="/scorecard/controls"
          >
            Controls manager
          </a>
          .
        </div>
      </div>
    </main>
  );
}
