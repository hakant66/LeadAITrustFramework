"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import Header from "@/app/(components)/Header";
import { coreApiBase } from "@/lib/coreApiBase";

type ProjectOption = {
  slug: string;
  name: string;
};

type ControlValuesExecResp = {
  items?: Array<{
    kpi_key?: string | null;
    control_id?: string | null;
  }>;
};
type RequirementListResp = {
  total?: number;
};

type ControlExecRow = {
  project_slug: string;
  control_id: string;
  kpi_key: string;
  kpi_name?: string | null;
  kpi_description?: string | null;
  control_name?: string | null;
  target_text?: string | null;
  target_numeric?: number | null;
  evidence_source?: string | null;
  notes?: string | null;
  owner_role?: string | null;
  designated_owner_name?: string | null;
  designated_owner_email?: string | null;
  due_date?: string | null;
  frequency?: number | null;
  reminder_day?: number | null;
  reminder_count?: number | null;
  designated_owner_manager?: string | null;
  designated_owner_manager_email?: string | null;
  provide_url?: string | null;
  comment_text?: string | null;
};

type ColumnDef = {
  key: keyof ControlExecRow | "control_name";
  label: string;
  tooltip?: string;
  editable?: boolean;
  type?: "text" | "email" | "date" | "number" | "url";
};

type KpiKnowledgeRow = {
  kpi_key: string;
  kpi_name: string;
  description?: string | null;
  definition?: string | null;
  example?: string | null;
};

type ControlMeta = {
  kpi_key?: string | null;
  frequency?: number | null;
};

const COLUMN_DEFS: ColumnDef[] = [
  { key: "kpi_name", label: "KPI Name" },
  { key: "control_name", label: "Control Name" },
  { key: "evidence_source", label: "Evidence Source" },
  { key: "target_text", label: "Target Text" },
  { key: "owner_role", label: "Owner Role" },
  { key: "designated_owner_name", label: "Designated Owner", editable: true, type: "text" },
  {
    key: "designated_owner_email",
    label: "Designated Owner Email",
    editable: true,
    type: "email",
  },
  { key: "due_date", label: "Due Date", editable: true, type: "date" },
  {
    key: "frequency",
    label: "Frequency (days)",
    tooltip:
      "Control cycle length in days. The control is due every this many days (e.g. 90 = quarterly). When evidence is submitted, the next due date is set to current due + this value.",
    editable: true,
    type: "number",
  },
  {
    key: "reminder_day",
    label: "Reminder (days before deadline)",
    tooltip:
      "Number of days before the due date for each reminder. With Reminder count = 3, the 1st reminder goes at due_date − 3×this, 2nd at due_date − 2×this, 3rd at due_date − 1×this (e.g. 9 gives reminders at 27, 18, and 9 days before due).",
    editable: true,
    type: "number",
  },
  {
    key: "reminder_count",
    label: "Reminder count (number of times)",
    tooltip:
      "How many reminder emails to send per cycle before the due date. Reminders stop automatically when evidence is submitted for this control.",
    editable: true,
    type: "number",
  },
  { key: "designated_owner_manager", label: "Manager", editable: true, type: "text" },
  {
    key: "designated_owner_manager_email",
    label: "Manager Email",
    editable: true,
    type: "email",
  },
];

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const ColumnHeader = ({ col }: { col: ColumnDef }) => (
  <span className="inline-flex items-center gap-1">
    {col.label}
    {col.tooltip && (
      <span
        className="text-slate-400 dark:text-slate-500"
        title={col.tooltip}
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </span>
    )}
  </span>
);

export default function ControlRegisterClient({ entitySlug }: { entitySlug: string }) {
  const CORE = coreApiBase();
  const router = useRouter();
  const [entityId, setEntityId] = useState<string>("");
  const [entityName, setEntityName] = useState<string>("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectSlug, setProjectSlug] = useState<string>("");
  const [rows, setRows] = useState<ControlExecRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalising, setFinalising] = useState(false);
  const [canFinalise, setCanFinalise] = useState(false);
  const [finalisedMessage, setFinalisedMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    COLUMN_DEFS.forEach((col) => {
      initial[col.key] = true;
    });
    return initial;
  });
  const [controlDetail, setControlDetail] = useState<ControlExecRow | null>(null);
  const [controlDefaultsByKpi, setControlDefaultsByKpi] = useState<
    Record<string, ControlMeta>
  >({});
  const [controlDetailSaving, setControlDetailSaving] = useState(false);
  const [controlDetailResending, setControlDetailResending] = useState(false);
  const [controlDetailError, setControlDetailError] = useState<string | null>(null);
  const [controlDetailKpi, setControlDetailKpi] = useState<KpiKnowledgeRow | null>(null);
  const [controlDetailKpiLoading, setControlDetailKpiLoading] = useState(false);
  const [controlDetailKpiError, setControlDetailKpiError] = useState<string | null>(null);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);

  useEffect(() => {
    const loadEntity = async () => {
      try {
        const res = await fetch(`${CORE}/entity/by-slug/${encodeURIComponent(entitySlug)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load entity.");
        const data = await res.json();
        setEntityId(data?.id || "");
        setEntityName(data?.fullLegalName || data?.slug || entitySlug);
      } catch (err: any) {
        console.error(err);
        setError("Something went wrong. Please try again.");
      }
    };
    loadEntity();
  }, [CORE, entitySlug]);

  useEffect(() => {
    if (!entityId) return;
    const loadProjects = async () => {
      try {
        const res = await fetch(`${CORE}/projects?entity_id=${encodeURIComponent(entityId)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load projects.");
        const data = await res.json();
        const items = Array.isArray(data) ? data : [];
        const mapped: ProjectOption[] = items.map((p: any) => ({
          slug: p.slug,
          name: p.name || p.slug,
        }));
        setProjects(mapped);
        if (!projectSlug && mapped.length > 0) {
          setProjectSlug(mapped[0].slug);
        }
      } catch (err: any) {
        console.error(err);
        setError("Something went wrong. Please try again.");
      }
    };
    loadProjects();
  }, [CORE, entityId, projectSlug]);

  useEffect(() => {
    let cancelled = false;
    const loadControlDefaults = async () => {
      try {
        const res = await fetch(`${CORE}/admin/controls`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load controls.");
        const data = await res.json();
        const items = Array.isArray(data) ? data : [];
        const mapped: Record<string, ControlMeta> = {};
        items.forEach((item: ControlMeta) => {
          const key = (item.kpi_key || "").toString().toLowerCase();
          if (!key) return;
          mapped[key] = { kpi_key: item.kpi_key, frequency: item.frequency ?? null };
        });
        if (!cancelled) {
          setControlDefaultsByKpi(mapped);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadControlDefaults();
    return () => {
      cancelled = true;
    };
  }, [CORE]);

  const loadControlRows = async (slug: string) => {
    if (!slug || !entityId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${CORE}/admin/projects/${encodeURIComponent(slug)}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load controls.");
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const normalized: ControlExecRow[] = items.map((row: any) => ({
        ...row,
        due_date: row?.due_date ? String(row.due_date).slice(0, 10) : null,
      }));
      setRows(normalized);
    } catch (err: any) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectSlug) return;
    setCanFinalise(false);
    setFinalisedMessage(null);
    void loadControlRows(projectSlug);
  }, [projectSlug, entityId]);

  const visibleColumns = useMemo(
    () => COLUMN_DEFS.filter((col) => columnVisibility[col.key]),
    [columnVisibility]
  );
  const [firstLineColumns, secondLineColumns] = useMemo(() => {
    const dueIndex = visibleColumns.findIndex((col) => col.key === "due_date");
    if (dueIndex === -1) {
      return [visibleColumns, [] as ColumnDef[]];
    }
    return [
      visibleColumns.slice(0, dueIndex + 1),
      visibleColumns.slice(dueIndex + 1),
    ];
  }, [visibleColumns]);

  const renderCellContent = (row: ControlExecRow, col: ColumnDef) => {
    const value = row[col.key as keyof ControlExecRow];
    if (col.editable) {
      const inputType = col.type ?? "text";
      const sizeClass =
        col.key === "frequency" || col.key === "reminder_day" || col.key === "reminder_count"
          ? "max-w-[90px]"
          : col.key === "designated_owner_manager"
          ? "max-w-[200px]"
          : "";
      return (
        <input
          type={inputType}
          className={`w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${sizeClass} ${
            col.key === "designated_owner_email" || col.key === "designated_owner_manager_email"
              ? "min-w-[260px]"
              : ""
          }`}
          value={value ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            if (inputType === "number") {
              updateRow(
                row.control_id,
                col.key as keyof ControlExecRow,
                raw === "" ? null : Number(raw)
              );
            } else {
              updateRow(row.control_id, col.key as keyof ControlExecRow, raw);
            }
          }}
        />
      );
    }
    if (col.key === "kpi_name") {
      const display = value || "—";
      return (
        <button
          type="button"
          className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          onClick={() => openControlDetail(row)}
        >
          {display}
        </button>
      );
    }
    let display: any = value;
    if (col.key === "due_date") {
      display = value || "—";
    } else if (display === null || display === undefined || display === "") {
      display = "—";
    }
    return <span>{display}</span>;
  };

  const tableColCount = Math.max(firstLineColumns.length, 1);

  const saveRow = async (row: ControlExecRow) => {
    if (!projectSlug) {
      setNotice("Select a project first.");
      return;
    }
    setRowSavingId(row.control_id);
    setNotice(null);
    setError(null);
    try {
      const payload = {
        items: [
          {
            control_id: row.control_id,
            kpi_key: row.kpi_key,
            designated_owner_name: row.designated_owner_name || null,
            designated_owner_email: row.designated_owner_email || null,
            due_date: row.due_date || null,
            frequency: row.frequency ?? null,
            reminder_day: row.reminder_day ?? null,
            reminder_count: row.reminder_count ?? null,
            designated_owner_manager: row.designated_owner_manager || null,
            designated_owner_manager_email: row.designated_owner_manager_email || null,
            provide_url: row.provide_url || null,
          },
        ],
      };
      const res = await fetch(
        `${CORE}/admin/projects/${encodeURIComponent(projectSlug)}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        throw new Error("Save failed.");
      }
      const data = await res.json().catch(() => ({}));
      if (typeof data?.emails_queued === "number") {
        setNotice(`Saved. Emails queued: ${data.emails_queued}.`);
      } else {
        setNotice("Saved successfully.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setRowSavingId(null);
    }
  };

  const updateRow = (controlId: string, field: keyof ControlExecRow, value: any) => {
    setRows((prev) =>
      prev.map((row) =>
        row.control_id === controlId ? { ...row, [field]: value } : row
      )
    );
  };

  const saveChanges = async () => {
    if (!projectSlug) {
      setNotice("Select a project first.");
      return;
    }
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const payload = {
        items: rows.map((row) => ({
          control_id: row.control_id,
          kpi_key: row.kpi_key,
          designated_owner_name: row.designated_owner_name || null,
          designated_owner_email: row.designated_owner_email || null,
          due_date: row.due_date || null,
          frequency: row.frequency ?? null,
          reminder_day: row.reminder_day ?? null,
          reminder_count: row.reminder_count ?? null,
          designated_owner_manager: row.designated_owner_manager || null,
          designated_owner_manager_email: row.designated_owner_manager_email || null,
          provide_url: row.provide_url || null,
        })),
      };
      const res = await fetch(
        `${CORE}/admin/projects/${encodeURIComponent(projectSlug)}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        throw new Error("Save failed.");
      }
      const data = await res.json().catch(() => ({}));
      if (typeof data?.emails_queued === "number") {
        setNotice(`Saved. Emails queued: ${data.emails_queued}.`);
      } else {
        setNotice("Saved successfully.");
      }
      setCanFinalise(true);
      setFinalisedMessage(null);
    } catch (err: any) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleFinaliseSetup = async () => {
    if (!canFinalise) return;
    setFinalising(true);
    setError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const readinessChecks = await Promise.all(
        projects.map(async (project) => {
          const [systemRes, requirementRes, controlRes] = await Promise.all([
            fetch(
              `${CORE}/admin/ai-systems?limit=1&project_slug=${encodeURIComponent(
                project.slug
              )}&entity_id=${encodeURIComponent(entityId)}`,
              { cache: "no-store" }
            ),
            fetch(
              `${CORE}/admin/requirements?limit=1&project_slug=${encodeURIComponent(
                project.slug
              )}&entity_id=${encodeURIComponent(entityId)}`,
              { cache: "no-store" }
            ),
            fetch(
              `${CORE}/admin/projects/${encodeURIComponent(
                project.slug
              )}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`,
              { cache: "no-store" }
            ),
          ]);

          const systemData = (await systemRes
            .json()
            .catch(() => ({}))) as { total?: number; items?: unknown[] };
          const hasSystem = Boolean(
            systemRes.ok &&
              ((Array.isArray(systemData.items) && systemData.items.length > 0) ||
                Number(systemData.total ?? 0) > 0)
          );

          const requirementData = (await requirementRes
            .json()
            .catch(() => ({}))) as RequirementListResp;
          const hasRequirements = Boolean(
            requirementRes.ok && Number(requirementData.total ?? 0) > 0
          );

          const controlData = (await controlRes
            .json()
            .catch(() => ({}))) as ControlValuesExecResp;
          const items = Array.isArray(controlData.items) ? controlData.items : [];
          const hasKpis = items.some(
            (item) =>
              Boolean(String(item.kpi_key ?? "").trim()) &&
              Boolean(String(item.control_id ?? "").trim())
          );

          return {
            name: project.name,
            hasSystem,
            hasRequirements,
            hasKpis,
            isReady: hasSystem && hasRequirements && hasKpis,
          };
        })
      );

      const readyProjectNames = readinessChecks
        .filter((item) => item.isReady)
        .map((item) => item.name);
      const missingSystemNames = readinessChecks
        .filter((item) => !item.hasSystem)
        .map((item) => item.name);
      const missingKpiNames = readinessChecks
        .filter((item) => item.hasSystem && !item.hasKpis)
        .map((item) => item.name);
      const missingRequirementNames = readinessChecks
        .filter((item) => item.hasSystem && item.hasKpis && !item.hasRequirements)
        .map((item) => item.name);
      const lineValue = (names: string[]) => (names.length > 0 ? names.join(", ") : "None");

      const now = new Date();
      const date = now.toLocaleDateString();
      const time = now.toLocaleTimeString();
      const lines = [
        `AI Governance setup finalised, projects ready to execute are: ${lineValue(readyProjectNames)}`,
        `AI Governance setup NOT finalised due to AI systems NOT registered are: ${lineValue(
          missingSystemNames
        )}`,
        `AI Governance setup NOT finalised due to KPIs NOT registered are: ${lineValue(
          missingKpiNames
        )}`,
      ];
      if (missingRequirementNames.length > 0) {
        lines.push(
          `AI Governance setup NOT finalised due to Requirements NOT registered are: ${lineValue(
            missingRequirementNames
          )}`
        );
      }
      lines.push(`· ${date} - ${time}`);
      const message = lines.join("\n");
      setFinalisedMessage(message);
      if (typeof window !== "undefined" && entitySlug) {
        window.localStorage.setItem(`governance-setup-finalised:${entitySlug}`, message);
      }
      if (entitySlug) {
        setTimeout(() => {
          router.push(`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup`);
        }, 600);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to finalise setup. Please try again.");
    } finally {
      setFinalising(false);
    }
  };

  const openControlDetail = (row: ControlExecRow) => {
    setControlDetail({ ...row });
    setControlDetailError(null);
  };

  const closeControlDetail = () => {
    setControlDetail(null);
    setControlDetailError(null);
    setControlDetailKpi(null);
    setControlDetailKpiError(null);
  };

  useEffect(() => {
    if (!controlDetail?.kpi_key) {
      setControlDetailKpi(null);
      setControlDetailKpiError(null);
      return;
    }
    let cancelled = false;
    setControlDetailKpiLoading(true);
    setControlDetailKpiError(null);
    fetch(
      `${CORE}/admin/knowledgebase/kpis/${encodeURIComponent(controlDetail.kpi_key)}`,
      { cache: "no-store" }
    )
      .then((res) => {
        if (!res.ok) {
          throw new Error("Unable to load KPI details.");
        }
        return res.json();
      })
      .then((data: KpiKnowledgeRow) => {
        if (!cancelled) {
          setControlDetailKpi(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setControlDetailKpiError("Unable to load KPI details.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setControlDetailKpiLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [CORE, controlDetail?.kpi_key]);

  useEffect(() => {
    if (!controlDetail || controlDetail.frequency != null) return;
    const key = (controlDetail.kpi_key || "").toString().toLowerCase();
    if (!key) return;
    const defaultFreq = controlDefaultsByKpi[key]?.frequency;
    if (defaultFreq == null) return;
    setControlDetail((prev) =>
      prev && prev.frequency == null ? { ...prev, frequency: defaultFreq } : prev
    );
  }, [controlDetail, controlDefaultsByKpi]);

  const saveControlDetail = async () => {
    if (!controlDetail || !projectSlug) return;
    setControlDetailSaving(true);
    setControlDetailError(null);
    try {
      const payload = {
        items: [
          {
            control_id: controlDetail.control_id,
            kpi_key: controlDetail.kpi_key,
            designated_owner_name: controlDetail.designated_owner_name || null,
            designated_owner_email: controlDetail.designated_owner_email || null,
            due_date: controlDetail.due_date || null,
            frequency: controlDetail.frequency ?? null,
            reminder_day: controlDetail.reminder_day ?? null,
            reminder_count: controlDetail.reminder_count ?? null,
            designated_owner_manager: controlDetail.designated_owner_manager || null,
            designated_owner_manager_email: controlDetail.designated_owner_manager_email || null,
            provide_url: controlDetail.provide_url || null,
          },
        ],
      };
      const res = await fetch(
        `${CORE}/admin/projects/${encodeURIComponent(projectSlug)}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        throw new Error("Save failed.");
      }
      const data = await res.json().catch(() => ({}));
      setRows((prev) =>
        prev.map((row) =>
          row.control_id === controlDetail.control_id
            ? { ...row, ...controlDetail }
            : row
        )
      );
      if (typeof data?.emails_queued === "number") {
        setNotice(`Saved. Emails queued: ${data.emails_queued}.`);
      } else {
        setNotice("Saved successfully.");
      }
      closeControlDetail();
    } catch (err: any) {
      console.error(err);
      setControlDetailError("Something went wrong. Please try again.");
    } finally {
      setControlDetailSaving(false);
    }
  };

  const resendControlDetailNotification = async () => {
    if (!controlDetail || !projectSlug) return;
    setControlDetailResending(true);
    setControlDetailError(null);
    try {
      const payload = {
        items: [
          {
            control_id: controlDetail.control_id,
            kpi_key: controlDetail.kpi_key,
            designated_owner_name: controlDetail.designated_owner_name || null,
            designated_owner_email: controlDetail.designated_owner_email || null,
            due_date: controlDetail.due_date || null,
            frequency: controlDetail.frequency ?? null,
            reminder_day: controlDetail.reminder_day ?? null,
            reminder_count: controlDetail.reminder_count ?? null,
            designated_owner_manager: controlDetail.designated_owner_manager || null,
            designated_owner_manager_email: controlDetail.designated_owner_manager_email || null,
            provide_url: controlDetail.provide_url || null,
          },
        ],
      };
      const res = await fetch(
        `${CORE}/admin/projects/${encodeURIComponent(projectSlug)}/control-values-exec?entity_id=${encodeURIComponent(entityId)}&force_notify=1`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        throw new Error("Save failed.");
      }
      const data = await res.json().catch(() => ({}));
      setRows((prev) =>
        prev.map((row) =>
          row.control_id === controlDetail.control_id
            ? { ...row, ...controlDetail }
            : row
        )
      );
      if (typeof data?.emails_queued === "number") {
        setNotice(`Notification resent. Emails queued: ${data.emails_queued}.`);
      } else {
        setNotice("Notification resent.");
      }
    } catch (err: any) {
      console.error(err);
      setControlDetailError("Something went wrong. Please try again.");
    } finally {
      setControlDetailResending(false);
    }
  };

  useEffect(() => {
    if (!entitySlug || typeof window === "undefined") return;
    const stored = window.localStorage.getItem(`governance-setup-finalised:${entitySlug}`);
    if (stored) {
      setFinalisedMessage(stored);
    }
  }, [entitySlug]);

  const renderFinalisedMessage = (message: string) => {
    const lines = message
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length <= 1) {
      return <div className="text-sm font-medium text-emerald-600">{message}</div>;
    }

    const timestamp = lines[lines.length - 1];
    const bodyLines = lines.slice(0, -1);
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900 shadow-sm dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-100">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          Governance Finalisation Summary
        </div>
        <div className="mt-2 space-y-2">
          {bodyLines.map((line, idx) => (
            <div key={`${idx}-${line}`} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>{line}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-emerald-200/80 pt-2 text-xs text-emerald-700 dark:border-emerald-700/50 dark:text-emerald-300">
          {timestamp}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Header
        title="AI Control Register"
        subtitle="Governance Setup"
        titleNote="Step 6 of 6"
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Project</div>
          <select
            className="min-w-[240px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            value={projectSlug}
            onChange={(event) => setProjectSlug(event.target.value)}
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.slug} value={project.slug}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
            onClick={() => projectSlug && loadControlRows(projectSlug)}
            disabled={loading}
          >
            Refresh
          </button>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200">
              Columns
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-2 text-[11px] font-semibold uppercase text-slate-500">Toggle Columns</div>
              <div className="max-h-72 space-y-2 overflow-auto">
                {COLUMN_DEFS.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={columnVisibility[col.key]}
                      onChange={(event) =>
                        setColumnVisibility((prev) => ({
                          ...prev,
                          [col.key]: event.target.checked,
                        }))
                      }
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>
          </details>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              onClick={() =>
                router.push(`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/ai-requirements-register`)
              }
            >
              Back
            </button>
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
              onClick={saveChanges}
              disabled={saving || loading || rows.length === 0}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
        {notice && <div className="mt-3 text-sm text-emerald-600">{notice}</div>}
        {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                {firstLineColumns.map((col) => (
                  <th key={col.key} className="px-3 py-2 text-left font-semibold">
                    <ColumnHeader col={col} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={tableColCount}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    Loading controls…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={tableColCount}
                    className="px-3 py-6 text-center text-slate-500"
                  >
                    No control values found for this project.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row, idx) => (
                  <Fragment key={row.control_id}>
                    <tr
                      className={`align-top ${idx > 0 ? "border-t-2 border-slate-300 dark:border-slate-600" : ""}`}
                    >
                      {firstLineColumns.map((col) => (
                        <td
                          key={col.key}
                          className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200"
                        >
                          {col.key === "kpi_name" ? (
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-slate-500 dark:text-slate-400">
                                {idx + 1}.
                              </span>
                              {renderCellContent(row, col)}
                            </div>
                          ) : (
                            renderCellContent(row, col)
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-slate-50/60 dark:bg-slate-900/40">
                      <td colSpan={tableColCount} className="px-3 py-3">
                        <div className="flex flex-nowrap items-end gap-3 overflow-x-auto">
                          {secondLineColumns.map((col) => (
                            <div key={col.key} className="min-w-[140px]">
                              <div className="text-[10px] uppercase text-slate-400">
                                <ColumnHeader col={col} />
                              </div>
                              <div className="mt-1 text-xs text-slate-700 dark:text-slate-200">
                                {renderCellContent(row, col)}
                              </div>
                            </div>
                          ))}
                          <div className="min-w-[140px]">
                            <div className="text-[10px] uppercase text-slate-400">Actions</div>
                            <div className="mt-1">
                              <button
                                type="button"
                                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-200"
                                onClick={() => void saveRow(row)}
                                disabled={rowSavingId === row.control_id}
                              >
                                {rowSavingId === row.control_id ? "Saving…" : "Save"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          onClick={() =>
            router.push(`/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup/ai-requirements-register`)
          }
        >
          Back
        </button>
        <button
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
          onClick={saveChanges}
          disabled={saving || loading || rows.length === 0}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          className="rounded-full bg-gradient-to-r from-indigo-600 to-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-indigo-500 hover:to-blue-400 disabled:opacity-60"
          onClick={handleFinaliseSetup}
          disabled={!canFinalise || finalising}
        >
          {finalising
            ? "Finalising…"
            : "Next Step: Finalise AI Governance Setup"}
        </button>
      </div>
      {finalisedMessage && renderFinalisedMessage(finalisedMessage)}

      {controlDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div>
                <div className="text-xs uppercase text-slate-500">Control Details</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {controlDetail.kpi_name || "KPI"} · {controlDetail.control_name || controlDetail.control_id}
                </div>
              </div>
              <button
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                onClick={closeControlDetail}
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">KPI Name</div>
                  <div className="mt-1">
                    {controlDetail.kpi_key ? (
                      <a
                        className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                        href={`/scorecard/admin/knowledgebase/kpi/${encodeURIComponent(
                          controlDetail.kpi_key
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {controlDetail.kpi_name || controlDetail.kpi_key}
                      </a>
                    ) : (
                      controlDetail.kpi_name || "—"
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Control Name</div>
                  <div className="mt-1">{controlDetail.control_name || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Evidence Source</div>
                  <div className="mt-1">{controlDetail.evidence_source || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Target Text</div>
                  <div className="mt-1">{controlDetail.target_text || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">Owner Role</div>
                  <div className="mt-1">{controlDetail.owner_role || "—"}</div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-semibold uppercase text-slate-500">KPI Details</div>
                {controlDetailKpiLoading && (
                  <div className="mt-2 text-xs text-slate-500">Loading KPI details…</div>
                )}
                {!controlDetailKpiLoading && controlDetailKpiError && (
                  <div className="mt-2 text-xs text-rose-600">{controlDetailKpiError}</div>
                )}
                {!controlDetailKpiLoading && !controlDetailKpiError && (
                  <div className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    <div>
                      <span className="text-xs font-semibold uppercase text-slate-500">KPI Name</span>
                      <div className="mt-1">
                        {controlDetailKpi?.kpi_key ? (
                          <a
                            className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                            href={`/scorecard/admin/knowledgebase/kpi/${encodeURIComponent(
                              controlDetailKpi.kpi_key
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {controlDetailKpi.kpi_name || controlDetailKpi.kpi_key}
                          </a>
                        ) : (
                          controlDetailKpi?.kpi_name || "—"
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase text-slate-500">Description</span>
                      <div className="mt-1 whitespace-pre-line">
                        {controlDetailKpi?.description || "—"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Designated Owner
                  <input
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={controlDetail.designated_owner_name || ""}
                    onChange={(event) =>
                      setControlDetail({ ...controlDetail, designated_owner_name: event.target.value })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Designated Owner Email
                  <input
                    type="email"
                    className="mt-2 w-full min-w-[280px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={controlDetail.designated_owner_email || ""}
                    onChange={(event) =>
                      setControlDetail({ ...controlDetail, designated_owner_email: event.target.value })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Due Date
                  <input
                    type="date"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={controlDetail.due_date || ""}
                    onChange={(event) =>
                      setControlDetail({ ...controlDetail, due_date: event.target.value })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Frequency
                  <input
                    type="number"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={controlDetail.frequency ?? ""}
                    onChange={(event) =>
                      setControlDetail({
                        ...controlDetail,
                        frequency: event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Reminder Day
                  <input
                    type="number"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={controlDetail.reminder_day ?? ""}
                    onChange={(event) =>
                      setControlDetail({
                        ...controlDetail,
                        reminder_day: event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Reminder Count
                  <input
                    type="number"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={controlDetail.reminder_count ?? ""}
                    onChange={(event) =>
                      setControlDetail({
                        ...controlDetail,
                        reminder_count: event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Manager
                  <input
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={controlDetail.designated_owner_manager || ""}
                    onChange={(event) =>
                      setControlDetail({ ...controlDetail, designated_owner_manager: event.target.value })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Manager Email
                  <input
                    type="email"
                    className="mt-2 w-full min-w-[280px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={controlDetail.designated_owner_manager_email || ""}
                    onChange={(event) =>
                      setControlDetail({
                        ...controlDetail,
                        designated_owner_manager_email: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500 md:col-span-2">
                  Provide URL
                  <input
                    type="url"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={controlDetail.provide_url || ""}
                    onChange={(event) =>
                      setControlDetail({ ...controlDetail, provide_url: event.target.value })
                    }
                  />
                </label>
              </div>
              {controlDetailError && (
                <div className="mt-3 text-sm text-rose-600">{controlDetailError}</div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                onClick={closeControlDetail}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                onClick={saveControlDetail}
                disabled={controlDetailSaving || controlDetailResending}
              >
                {controlDetailSaving ? "Saving…" : "Save"}
              </button>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                onClick={resendControlDetailNotification}
                disabled={controlDetailSaving || controlDetailResending}
              >
                {controlDetailResending ? "Resending…" : "Resend Notification"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
