// apps/web/src/app/(components)/ProjectRegisterPage.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/app/(components)/Header";
import Link from "next/link";
import { coreApiBase } from "@/lib/coreApiBase";
import { useTranslations } from "next-intl";
import type { NavMode } from "@/lib/navMode";

type ProjectCreate = {
  slug: string;
  name: string;
  risk_level: string;
  target_threshold: number; // 0..1
  priority: string;
  sponsor: string;
  owner: string;
  status: string;
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
  status: string | null;
  is_archived?: boolean;
  creation_date: string | null;
  update_date: string | null;
};

type ProjectTranslationForm = {
  name: string;
  risk_level: string;
  priority: string;
  sponsor: string;
  owner: string;
  status: string;
  company_registration_number: string;
  headquarters_country: string;
  regions_of_operation: string;
  sectors: string;
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

const base = coreApiBase();

const emptyProject: ProjectCreate = {
  slug: "",
  name: "",
  risk_level: "low",
  target_threshold: 0.75,
  priority: "low",
  sponsor: "",
  owner: "",
  status: "Planned",
  creation_date: "",
  update_date: "",
};

const emptyTranslationForm: ProjectTranslationForm = {
  name: "",
  risk_level: "",
  priority: "",
  sponsor: "",
  owner: "",
  status: "",
  company_registration_number: "",
  headquarters_country: "",
  regions_of_operation: "",
  sectors: "",
};

const PROJECT_STATUSES = [
  "Experimental",
  "Planned",
  "In-review",
  "Active",
  "Retired",
] as const;

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

const normalizeSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Create a URL-safe slug from a name: lowercase, hyphens, no leading/trailing hyphens. */
function slugify(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  return trimmed
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Derive project slug from project name and optional entity slug (for uniqueness per entity). */
function deriveProjectSlug(projectName: string, entitySlug?: string | null): string {
  const base = slugify(projectName);
  if (!base) return "";
  if (entitySlug?.trim()) {
    const entityPart = slugify(entitySlug.trim());
    return entityPart ? `${entityPart}-${base}` : base;
  }
  return base;
}

const normalizeStatus = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (lowered === "experimenta") return "Experimental";
  if (lowered === "experimental") return "Experimental";
  if (lowered === "planned") return "Planned";
  if (lowered === "in_review" || lowered === "in review" || lowered === "in-review") {
    return "In-review";
  }
  if (lowered === "active") return "Active";
  if (lowered === "retired") return "Retired";
  return normalized;
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

export default function ProjectRegisterPage({
  navMode,
  showProjectList,
  hideCaptureCard = false,
  listCaptureTop = false,
  title,
  subtitle,
  titleNote,
  showHeaderNextStep = true,
  showBottomNextStep = false,
  entityId,
  entitySlug,
  hideProjectAdminLinks = false,
  nextStepHref,
}: {
  navMode?: NavMode;
  showProjectList?: boolean;
  hideCaptureCard?: boolean;
  listCaptureTop?: boolean;
  title?: string;
  subtitle?: string;
  titleNote?: string;
  showHeaderNextStep?: boolean;
  showBottomNextStep?: boolean;
  entityId?: string;
  entitySlug?: string;
  hideProjectAdminLinks?: boolean;
  nextStepHref?: string;
}) {
  const t = useTranslations("ProjectRegisterPage");
  const isLegacy = navMode === "legacy";
  const shouldShowProjectList = Boolean(showProjectList);
  const showListCaptureTop = Boolean(listCaptureTop);
  const entityParam = entityId ? `entity_id=${encodeURIComponent(entityId)}` : "";
  const entityHeaderKey = "X-Entity-ID";
  const withEntityHeaders = useCallback(
    (headers?: HeadersInit): HeadersInit | undefined => {
      if (!entityId) return headers;
      if (!headers) return { [entityHeaderKey]: entityId };
      if (headers instanceof Headers) {
        const next = new Headers(headers);
        next.set(entityHeaderKey, entityId);
        return next;
      }
      if (Array.isArray(headers)) {
        return [...headers, [entityHeaderKey, entityId]];
      }
      return { ...headers, [entityHeaderKey]: entityId };
    },
    [entityId]
  );
  const withEntity = useCallback(
    (url: string) => {
      if (!entityParam) return url;
      return url.includes("?") ? `${url}&${entityParam}` : `${url}?${entityParam}`;
    },
    [entityParam]
  );
  const [proj, setProj] = useState<ProjectCreate>({ ...emptyProject });
  const [createBusy, setCreateBusy] = useState(false);
  const [cloneBusy, setCloneBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [cloneTarget, setCloneTarget] = useState("");
  const [cloneSlug, setCloneSlug] = useState("");
  const [cloneSlugTouched, setCloneSlugTouched] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editForm, setEditForm] = useState<ProjectCreate>({ ...emptyProject });
  const [translationLocale, setTranslationLocale] = useState("tr");
  const [translationForm, setTranslationForm] = useState<ProjectTranslationForm>({
    ...emptyTranslationForm,
  });
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationBusy, setTranslationBusy] = useState(false);
  const [translationMsg, setTranslationMsg] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [nextStepReady, setNextStepReady] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const headerSaveDisabled =
    !editTarget ||
    updateBusy ||
    projectsLoading ||
    !editForm.slug.trim() ||
    !editForm.name.trim();

const buildProjectPayload = (form: ProjectCreate, entitySlugOverride?: string | null) => {
    const nameTrimmed = form.name.trim();
    const explicitSlug = normalizeSlug(form.slug ?? "");
    const derivedSlug = deriveProjectSlug(nameTrimmed, entitySlugOverride ?? entitySlug);
    const slug = explicitSlug || derivedSlug;
    const risk = form.risk_level.trim();
    const priority = form.priority.trim();
    const thresholdValue = Number(form.target_threshold);
    return {
      slug: slug || "project",
      name: nameTrimmed || slug || "Project",
      risk_level: risk || undefined,
      target_threshold: Number.isFinite(thresholdValue)
        ? thresholdValue
        : 0.75,
      priority: priority || (risk || undefined),
      sponsor: emptyToNull(form.sponsor),
      owner: emptyToNull(form.owner),
      status: emptyToNull(form.status),
      creation_date: emptyToNull(form.creation_date),
      update_date: fromDateTimeLocal(form.update_date),
    };
  };

  const saveTranslation = async () => {
    if (!editTarget || !translationLocale.trim()) {
      setTranslationError("Select a project and locale.");
      return;
    }
    setTranslationBusy(true);
    setTranslationError(null);
    setTranslationMsg(null);
    try {
      const payload = {
        name: emptyToNull(translationForm.name),
        risk_level: emptyToNull(translationForm.risk_level),
        priority: emptyToNull(translationForm.priority),
        sponsor: emptyToNull(translationForm.sponsor),
        owner: emptyToNull(translationForm.owner),
        status: emptyToNull(translationForm.status),
        company_registration_number: emptyToNull(
          translationForm.company_registration_number
        ),
        headquarters_country: emptyToNull(translationForm.headquarters_country),
        regions_of_operation: emptyToNull(translationForm.regions_of_operation),
        sectors: emptyToNull(translationForm.sectors),
      };
      const res = await fetch(
        withEntity(
          `${base}/projects/${encodeURIComponent(
            editTarget
          )}/translations/${encodeURIComponent(translationLocale.trim())}`
        ),
        {
          method: "PUT",
          headers: withEntityHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to save translation (${res.status})`);
      }
      setTranslationMsg("Translation saved.");
    } catch (e: any) {
      setTranslationError(e?.message ?? String(e));
    } finally {
      setTranslationBusy(false);
    }
  };

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const res = await fetch(withEntity(`${base}/projects`), {
        cache: "no-store",
        headers: withEntityHeaders(),
      });
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
              status: normalizeStatus(
                typeof p.status === "string" ? p.status : null
              ),
              is_archived: Boolean(p.is_archived),
              creation_date:
                typeof p.creation_date === "string" && p.creation_date
                  ? p.creation_date
                  : null,
              update_date:
                typeof p.update_date === "string" && p.update_date
                  ? p.update_date
                  : null,
            };
          }).filter((p) => !p.is_archived && normalizeStatus(p.status) !== "Archived")
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
  }, [withEntity, withEntityHeaders]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    if (!cloneTarget) {
      if (!cloneSlugTouched) setCloneSlug("");
      return;
    }
    if (cloneSlugTouched) return;
    const currentSlugs = new Set(projects.map((p) => p.slug));
    setCloneSlug(ensureCloneSlug(cloneTarget, currentSlugs));
  }, [cloneTarget, cloneSlugTouched, projects]);

  useEffect(() => {
    if (!editTarget) {
      setEditForm({ ...emptyProject });
      setNextStepReady(false);
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
        status: normalizeStatus(selected.status) ?? "Planned",
        creation_date: toDateInput(selected.creation_date),
        update_date: toDateTimeLocalInput(selected.update_date),
      });
    } else {
      setEditForm({ ...emptyProject });
    }
    setNextStepReady(false);
  }, [editTarget, projects]);

  useEffect(() => {
    if (!editTarget || !translationLocale.trim()) {
      setTranslationForm({ ...emptyTranslationForm });
      return;
    }
    let cancelled = false;
    const loadTranslation = async () => {
      setTranslationLoading(true);
      setTranslationError(null);
      setTranslationMsg(null);
      try {
        const res = await fetch(
          withEntity(
            `${base}/projects/${encodeURIComponent(
              editTarget
            )}/translations/${encodeURIComponent(translationLocale.trim())}`
          ),
          { cache: "no-store", headers: withEntityHeaders() }
        );
        if (res.status === 404) {
          if (!cancelled) {
            setTranslationForm({ ...emptyTranslationForm });
          }
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed to load translation (${res.status})`);
        }
        const data = await res.json();
        if (cancelled) return;
        setTranslationForm({
          name: data?.name ?? "",
          risk_level: data?.risk_level ?? "",
          priority: data?.priority ?? "",
          sponsor: data?.sponsor ?? "",
          owner: data?.owner ?? "",
          status: data?.status ?? "",
          company_registration_number: data?.company_registration_number ?? "",
          headquarters_country: data?.headquarters_country ?? "",
          regions_of_operation: data?.regions_of_operation ?? "",
          sectors: data?.sectors ?? "",
        });
      } catch (e: any) {
        if (!cancelled) {
          setTranslationError(e?.message ?? String(e));
        }
      } finally {
        if (!cancelled) setTranslationLoading(false);
      }
    };
    void loadTranslation();
    return () => {
      cancelled = true;
    };
  }, [editTarget, translationLocale, withEntity, withEntityHeaders]);

  const onCreateProject = async () => {
    setCreateBusy(true);
    setMsg(null);
    setError(null);
    try {
      const payload = buildProjectPayload(proj);
      const res = await fetch(withEntity(`${base}/admin/projects`), {
        method: "POST",
        headers: withEntityHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.detail || `Create project failed (${res.status})`);
      }
      setMsg(`Project '${payload.slug}' created.`);
      setProj({ ...emptyProject, slug: payload.slug, name: payload.name });
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
        withEntity(`${base}/scorecard/${encodeURIComponent(cloneTarget)}`),
        { cache: "no-store", headers: withEntityHeaders() }
      );
      if (!detailRes.ok) {
        throw new Error(`Failed to load project data (${detailRes.status})`);
      }
      const payload = await detailRes.json();
      const sourceProject = payload?.project ?? {};
      const currentSlugs = new Set(projects.map((p) => p.slug));

      const canonicalSlug =
        String(sourceProject.slug ?? source?.slug ?? cloneTarget) || cloneTarget;
      const desiredSlugRaw = cloneSlug.trim();
      let newSlug = "";
      if (desiredSlugRaw) {
        const normalized = desiredSlugRaw
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (!normalized) {
          throw new Error("New slug is invalid after normalization.");
        }
        if (normalized === canonicalSlug) {
          throw new Error("New slug must be different from the source project.");
        }
        if (currentSlugs.has(normalized)) {
          throw new Error(`Slug '${normalized}' already exists.`);
        }
        newSlug = normalized;
      } else {
        newSlug = ensureCloneSlug(canonicalSlug, currentSlugs);
      }
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
      const statusValue =
        normalizeStatus(
          typeof sourceProject.status === "string"
            ? sourceProject.status
            : source?.status ?? null
        ) ?? "Planned";
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

      const createRes = await fetch(withEntity(`${base}/admin/projects`), {
        method: "POST",
        headers: withEntityHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          slug: newSlug,
          name: newName,
          risk_level: riskLevel,
          target_threshold: targetThreshold,
          priority: priorityValue,
          sponsor: sponsorValue,
          owner: ownerValue,
          status: statusValue,
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
          withEntity(`${base}/scorecard/${encodeURIComponent(newSlug)}/pillars`),
          {
            method: "POST",
            headers: withEntityHeaders({ "Content-Type": "application/json" }),
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
          withEntity(`${base}/scorecard/${encodeURIComponent(newSlug)}`),
          {
            method: "POST",
            headers: withEntityHeaders({ "Content-Type": "application/json" }),
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
      setCloneSlugTouched(false);
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
        "Are you sure? Project will be archived."
      );
      if (!confirmed) return;
    }
    setDeleteBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(
        withEntity(`${base}/projects/${encodeURIComponent(deleteTarget)}`),
        { method: "DELETE", headers: withEntityHeaders() }
      );
      if (!res.ok && res.status !== 204) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text || `Archive failed (${res.status || "unknown status"})`
        );
      }
      setMsg(`Project '${project?.name ?? deleteTarget}' archived.`);
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
    setNextStepReady(false);
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

      const payload = {
        ...buildProjectPayload({ ...editForm, slug: desiredSlug }),
        target_threshold: Number.isFinite(targetThreshold)
          ? targetThreshold
          : 0.75,
      };

      if (desiredSlug === original.slug) {
        const res = await fetch(withEntity(`${base}/admin/projects`), {
          method: "POST",
          headers: withEntityHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Update failed (${res.status})`);
        }
      } else {
        const detailRes = await fetch(
          withEntity(`${base}/scorecard/${encodeURIComponent(original.slug)}`),
          { cache: "no-store", headers: withEntityHeaders() }
        );
        if (!detailRes.ok) {
          throw new Error(
            `Failed to load project data for rename (${detailRes.status})`
          );
        }
        const detail = await detailRes.json();

        const createRes = await fetch(withEntity(`${base}/admin/projects`), {
          method: "POST",
          headers: withEntityHeaders({ "Content-Type": "application/json" }),
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
            withEntity(`${base}/scorecard/${encodeURIComponent(desiredSlug)}/pillars`),
            {
              method: "POST",
              headers: withEntityHeaders({ "Content-Type": "application/json" }),
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
            withEntity(`${base}/scorecard/${encodeURIComponent(desiredSlug)}`),
            {
              method: "POST",
              headers: withEntityHeaders({ "Content-Type": "application/json" }),
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
          withEntity(`${base}/projects/${encodeURIComponent(original.slug)}`),
          { method: "DELETE", headers: withEntityHeaders() }
        );
        if (!deleteRes.ok && deleteRes.status !== 204) {
          const text = await deleteRes.text().catch(() => "");
          throw new Error(
            text || `Failed to delete old project (${deleteRes.status})`
          );
        }
      }

      setMsg(`Project '${payload.name}' updated.`);
      if (nextStepHref) {
        setNextStepReady(true);
      }
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

  const compactInputClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 " +
    "placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 " +
    "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

  const compactSelectClass =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 " +
    "focus:outline-none focus:ring-1 focus:ring-indigo-500 " +
    "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  const headerTitle = title || (isLegacy ? "AI Projects Admin" : "AI Projects Register");
  const headerSubtitle = subtitle || (isLegacy
    ? "LeadAI · Admin Tools"
    : "LeadAI · AI Governance Execution");
  const dataRegisterHref = isLegacy
    ? "/scorecard/admin/data-manager"
    : "/scorecard/admin/data-register";
  const dataRegisterLabel = isLegacy ? "Data Manager" : "AI Data Register";
  const selectedProject = projects.find((p) => p.slug === editTarget) || null;
  const showCaptureFirst = projects.length === 0;
  const projectListCard = shouldShowProjectList ? (
    <div className="border rounded-2xl bg-white shadow-sm p-4 md:col-span-2 border-slate-200 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-lg font-semibold">Registered AI Projects</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Projects currently registered for this entity.
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {projects.length} total
        </div>
      </div>

      <div className="mt-3">
        {projectsLoading ? (
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Loading projects…
          </div>
        ) : projects.length === 0 ? (
          <div className="text-sm text-slate-600 dark:text-slate-300">
            No projects registered yet for this entity.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {projects.map((project) => (
              <div
                key={project.slug}
                className="py-2 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {project.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {project.slug}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {project.status && (
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      {project.status}
                    </span>
                  )}
                  {project.risk_level && (
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      Risk: {project.risk_level}
                    </span>
                  )}
                  {project.priority && (
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      Priority: {project.priority}
                    </span>
                  )}
                  <Link
                    href={`/scorecard/${encodeURIComponent(
                      project.slug,
                    )}/dashboard`}
                    className="rounded-full border border-indigo-200 px-2 py-0.5 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-200 dark:hover:bg-indigo-500/10"
                  >
                    {t("viewProject")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;
  const captureProjectCard = (
    <div className="border rounded-2xl bg-white shadow-sm p-4 md:col-span-2 border-slate-200 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Capture AI Project</div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Add a new project with just the essentials first. You can refine details later.
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Required: name (slug is generated from entity + project name)
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-600 dark:text-slate-300">
          Name
          <input
            className={`${compactInputClass} mt-1`}
            placeholder="Contract Analysis"
            value={proj.name}
            onChange={(e) => setProj({ ...proj, name: e.target.value })}
          />
        </label>
        {proj.name.trim() && (
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-end pb-2">
            Slug will be: <span className="font-mono ml-1">{deriveProjectSlug(proj.name, entitySlug) || "—"}</span>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-xs text-slate-600 dark:text-slate-300">
          Risk level
          <select
            className={`${compactSelectClass} mt-1`}
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

        <label className="text-xs text-slate-600 dark:text-slate-300">
          Priority
          <select
            className={`${compactSelectClass} mt-1`}
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

        <label className="text-xs text-slate-600 dark:text-slate-300">
          Status
          <select
            className={`${compactSelectClass} mt-1`}
            value={proj.status}
            onChange={(e) =>
              setProj((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-600 dark:text-slate-300">
          Sponsor
          <input
            className={`${compactInputClass} mt-1`}
            placeholder="alex@lead.ai"
            value={proj.sponsor}
            onChange={(e) =>
              setProj((prev) => ({ ...prev, sponsor: e.target.value }))
            }
          />
        </label>

        <label className="text-xs text-slate-600 dark:text-slate-300">
          Owner
          <input
            className={`${compactInputClass} mt-1`}
            placeholder="Product Lead"
            value={proj.owner}
            onChange={(e) =>
              setProj((prev) => ({ ...prev, owner: e.target.value }))
            }
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-600 dark:text-slate-300">
          Creation date
          <input
            type="date"
            className={`${compactInputClass} mt-1`}
            value={proj.creation_date}
            onChange={(e) =>
              setProj((prev) => ({
                ...prev,
                creation_date: e.target.value,
              }))
            }
          />
        </label>

        <label className="text-xs text-slate-600 dark:text-slate-300">
          Last update
          <input
            type="datetime-local"
            className={`${compactInputClass} mt-1`}
            value={proj.update_date}
            onChange={(e) =>
              setProj((prev) => ({
                ...prev,
                update_date: e.target.value,
              }))
            }
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          disabled={
            createBusy ||
            !proj.name.trim()
          }
          onClick={onCreateProject}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500"
        >
          {createBusy ? "Creating..." : "Create Project"}
        </button>

        {proj.slug && !hideProjectAdminLinks && (
          <a
            className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 transition dark:border-slate-600 dark:hover:bg-slate-800"
            href={`/scorecard/${encodeURIComponent(
              proj.slug
            )}/dashboard/kpis_admin`}
          >
            Go to this project's admin
          </a>
        )}
      </div>
    </div>
  );
  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="w-full space-y-6">
        <Header title={headerTitle} subtitle={headerSubtitle} titleNote={titleNote}>
          {showHeaderNextStep && entitySlug ? (
            <Link
              href={`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/ai-system-register`}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next Step: AI System Register
            </Link>
          ) : null}
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

        {showListCaptureTop ? (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectListCard}
            {!hideCaptureCard && captureProjectCard}
          </section>
        ) : (
          <>
            {showCaptureFirst && !hideCaptureCard && (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectListCard}
                {captureProjectCard}
              </section>
            )}
            {showCaptureFirst && hideCaptureCard && projectListCard && (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectListCard}
              </section>
            )}
          </>
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

          <div className="grid grid-cols-1 gap-3 md:grid-cols-1">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Name
              <input
                className={`${compactInputClass} mt-1`}
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Contract Analysis"
                disabled={!editTarget || projectsLoading}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Risk level
              <select
                className={`${compactSelectClass} mt-1`}
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

            <label className="text-xs text-slate-600 dark:text-slate-300">
              Priority
              <select
                className={`${compactSelectClass} mt-1`}
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

            <label className="text-xs text-slate-600 dark:text-slate-300">
              Status
              <select
                className={`${compactSelectClass} mt-1`}
                value={editForm.status}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
                disabled={!editTarget || projectsLoading}
              >
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Sponsor
              <input
                className={`${compactInputClass} mt-1`}
                value={editForm.sponsor}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, sponsor: e.target.value }))
                }
                placeholder="alex@lead.ai"
                disabled={!editTarget || projectsLoading}
              />
            </label>

            <label className="text-xs text-slate-600 dark:text-slate-300">
              Owner
              <input
                className={`${compactInputClass} mt-1`}
                value={editForm.owner}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, owner: e.target.value }))
                }
                placeholder="Product Lead"
                disabled={!editTarget || projectsLoading}
              />
            </label>

            <label className="text-xs text-slate-600 dark:text-slate-300">
              Creation date
              <input
                type="date"
                className={`${compactInputClass} mt-1`}
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
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Last update
              <input
                type="datetime-local"
                className={`${compactInputClass} mt-1`}
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
            <div className="flex items-end gap-3 flex-wrap">
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
              {nextStepHref && nextStepReady && (
                <a
                  className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-200"
                  href={nextStepHref}
                >
                  Next Step: Register AI Systems
                </a>
              )}
              {editForm.slug && !hideProjectAdminLinks && (
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
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Changing the slug will move all scorecard data to the new slug and
            delete the original project.
          </p>
        </section>

        {/* Project translations */}
        <section className="border rounded-2xl bg-white shadow-sm p-4 space-y-3 border-slate-200 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-lg font-semibold">Project Translations</div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Store localized project fields. Leave blank to fall back to the base
                project values.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400">
                Locale
                <input
                  className={`${compactInputClass} mt-1`}
                  value={translationLocale}
                  onChange={(e) => setTranslationLocale(e.target.value.toLowerCase())}
                  placeholder="tr"
                />
              </label>
            </div>
          </div>

          {translationLoading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Loading translation…
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Name (localized)
              <input
                className={`${compactInputClass} mt-1`}
                value={translationForm.name}
                onChange={(e) =>
                  setTranslationForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder={selectedProject?.name ?? "Project name"}
                disabled={!editTarget || translationBusy}
              />
            </label>

            <label className="text-xs text-slate-600 dark:text-slate-300">
              Risk level (localized)
              <input
                className={`${compactInputClass} mt-1`}
                value={translationForm.risk_level}
                onChange={(e) =>
                  setTranslationForm((prev) => ({
                    ...prev,
                    risk_level: e.target.value,
                  }))
                }
                placeholder={selectedProject?.risk_level ?? "low"}
                disabled={!editTarget || translationBusy}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Priority (localized)
              <input
                className={`${compactInputClass} mt-1`}
                value={translationForm.priority}
                onChange={(e) =>
                  setTranslationForm((prev) => ({
                    ...prev,
                    priority: e.target.value,
                  }))
                }
                placeholder={selectedProject?.priority ?? "high"}
                disabled={!editTarget || translationBusy}
              />
            </label>

            <label className="text-xs text-slate-600 dark:text-slate-300">
              Sponsor (localized)
              <input
                className={`${compactInputClass} mt-1`}
                value={translationForm.sponsor}
                onChange={(e) =>
                  setTranslationForm((prev) => ({
                    ...prev,
                    sponsor: e.target.value,
                  }))
                }
                placeholder={selectedProject?.sponsor ?? "COO"}
                disabled={!editTarget || translationBusy}
              />
            </label>

            <label className="text-xs text-slate-600 dark:text-slate-300">
              Owner (localized)
              <input
                className={`${compactInputClass} mt-1`}
                value={translationForm.owner}
                onChange={(e) =>
                  setTranslationForm((prev) => ({
                    ...prev,
                    owner: e.target.value,
                  }))
                }
                placeholder={selectedProject?.owner ?? "Legal Department Lead"}
                disabled={!editTarget || translationBusy}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Status (localized)
              <input
                className={`${compactInputClass} mt-1`}
                value={translationForm.status}
                onChange={(e) =>
                  setTranslationForm((prev) => ({
                    ...prev,
                    status: e.target.value,
                  }))
                }
                placeholder={selectedProject?.status ?? "Planned"}
                disabled={!editTarget || translationBusy}
              />
            </label>

            <label className="text-xs text-slate-600 dark:text-slate-300">
              Company Registration Number (localized)
              <input
                className={`${compactInputClass} mt-1`}
                value={translationForm.company_registration_number}
                onChange={(e) =>
                  setTranslationForm((prev) => ({
                    ...prev,
                    company_registration_number: e.target.value,
                  }))
                }
                placeholder="Registration number"
                disabled={!editTarget || translationBusy}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Headquarters Country (localized)
              <input
                className={`${compactInputClass} mt-1`}
                value={translationForm.headquarters_country}
                onChange={(e) =>
                  setTranslationForm((prev) => ({
                    ...prev,
                    headquarters_country: e.target.value,
                  }))
                }
                placeholder="Turkey"
                disabled={!editTarget || translationBusy}
              />
            </label>

            <label className="text-xs text-slate-600 dark:text-slate-300">
              Regions of Operation (localized)
              <input
                className={`${compactInputClass} mt-1`}
                value={translationForm.regions_of_operation}
                onChange={(e) =>
                  setTranslationForm((prev) => ({
                    ...prev,
                    regions_of_operation: e.target.value,
                  }))
                }
                placeholder="Europe, MENA"
                disabled={!editTarget || translationBusy}
              />
            </label>

            <label className="text-xs text-slate-600 dark:text-slate-300">
              Sectors (localized)
              <input
                className={`${compactInputClass} mt-1`}
                value={translationForm.sectors}
                onChange={(e) =>
                  setTranslationForm((prev) => ({
                    ...prev,
                    sectors: e.target.value,
                  }))
                }
                placeholder="Finance, Healthcare"
                disabled={!editTarget || translationBusy}
              />
            </label>
          </div>

          {translationError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm dark:border-red-500/60 dark:bg-red-950/40 dark:text-red-100">
              {translationError}
            </div>
          ) : null}
          {translationMsg ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm dark:border-emerald-500/60 dark:bg-emerald-950/40 dark:text-emerald-100">
              {translationMsg}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveTranslation}
              disabled={!editTarget || translationBusy}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500"
            >
              {translationBusy ? "Saving…" : "Save Translation"}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Project: {selectedProject?.name ?? "Select a project above"}
            </span>
          </div>
        </section>

        {shouldShowProjectList && !showCaptureFirst && !showListCaptureTop && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projectListCard}
          </section>
        )}

        {/* Create project & clone/delete panels */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {!showCaptureFirst && !hideCaptureCard && !showListCaptureTop && captureProjectCard}

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
            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">
                New project slug (optional)
              </div>
              <input
                className={inputClass}
                value={cloneSlug}
                onChange={(e) => {
                  setCloneSlugTouched(true);
                  setCloneSlug(e.target.value);
                }}
                placeholder="hr-ai-chat-project-2026"
                disabled={projectsLoading || cloneBusy || !cloneTarget}
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Leave blank to auto-generate <code>-clone</code> slug.
              </div>
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
              Archive AI Project
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Archive the project and all of its data from the system.
            </p>
            <label className="text-sm">
              <div className="mb-1 text-slate-600 dark:text-slate-300">
                Project to archive
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
              {deleteBusy ? "Archiving..." : "Archive Project"}
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

        {showBottomNextStep && entitySlug && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleUpdateProject}
              disabled={headerSaveDisabled}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateBusy ? "Saving..." : "Save Changes"}
            </button>
            <Link
              href={`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/ai-system-register`}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              Next Step: AI System Register
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
