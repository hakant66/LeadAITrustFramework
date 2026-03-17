"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { coreApiBase } from "@/lib/coreApiBase";

export type ActionAssignmentRow = {
  project_slug: string;
  control_id: string;
  kpi_key?: string | null;
  kpi_name?: string | null;
  control_name?: string | null;
  owner_role?: string | null;
  unit?: string | null;
  target_text?: string | null;
  evidence_source?: string | null;
  designated_owner_name?: string | null;
  designated_owner_email?: string | null;
  due_date?: string | null;
  frequency?: number | null;
  reminder_day?: number | null;
  reminder_count?: number | null;
  designated_owner_manager?: string | null;
  designated_owner_manager_email?: string | null;
  provide_url?: string | null;
  evidence_status?: string | null;
  evidence_url?: string | null;
};

type Props = {
  rows: ActionAssignmentRow[];
  entityId: string;
  projectSlug: string;
  entitySlug: string;
};

const toDateInputValue = (value?: string | null) =>
  value ? String(value).slice(0, 10) : "";

export default function ActionAssignmentTableClient({
  rows,
  entityId,
  projectSlug,
  entitySlug,
}: Props) {
  const t = useTranslations("ActionAssignmentPage");
  const CORE = coreApiBase();
  const [items, setItems] = useState<ActionAssignmentRow[]>(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      const kpiA = String(a.kpi_name || a.kpi_key || "");
      const kpiB = String(b.kpi_name || b.kpi_key || "");
      const kpiCmp = kpiA.localeCompare(kpiB);
      if (kpiCmp !== 0) return kpiCmp;
      const ctrlA = String(a.control_name || a.control_id || "");
      const ctrlB = String(b.control_name || b.control_id || "");
      return ctrlA.localeCompare(ctrlB);
    });
    return sorted;
  });
  const [selected, setSelected] = useState<ActionAssignmentRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDetail = (row: ActionAssignmentRow) => {
    setSelected({
      ...row,
      due_date: toDateInputValue(row.due_date),
      provide_url: row.provide_url || row.evidence_url || "",
    });
    setError(null);
  };

  const closeDetail = () => {
    setSelected(null);
    setError(null);
  };

  const saveDetail = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        items: [
          {
            control_id: selected.control_id,
            kpi_key: selected.kpi_key,
            designated_owner_name: selected.designated_owner_name || null,
            designated_owner_email: selected.designated_owner_email || null,
            due_date: selected.due_date || null,
            frequency: selected.frequency ?? null,
            reminder_day: selected.reminder_day ?? null,
            reminder_count: selected.reminder_count ?? null,
            designated_owner_manager: selected.designated_owner_manager || null,
            designated_owner_manager_email: selected.designated_owner_manager_email || null,
            provide_url: selected.provide_url || null,
          },
        ],
      };
      const res = await fetch(
        `${CORE}/admin/projects/${encodeURIComponent(
          projectSlug
        )}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || t("modal.saveFailed"));
      }
      setItems((prev) =>
        prev.map((row) =>
          row.control_id === selected.control_id &&
          (row.kpi_key ?? null) === (selected.kpi_key ?? null)
            ? { ...row, ...selected }
            : row
        )
      );
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("modal.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">{t("table.metric")}</th>
              <th className="px-4 py-3 text-left">{t("table.control")}</th>
              <th className="px-4 py-3 text-left">{t("table.owner")}</th>
              <th className="px-4 py-3 text-left">{t("table.target")}</th>
              <th className="px-4 py-3 text-left">{t("table.mechanism")}</th>
              <th className="px-4 py-3 text-left">{t("table.evidence")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const ownerValue =
                row.designated_owner_name || row.owner_role || t("table.missing");
              const ownerAssigned = Boolean(row.designated_owner_name || row.owner_role);
              const targetDefined = Boolean(row.target_text || row.unit);
              const mechanismActivated = Boolean(row.evidence_source);
              const evidenceField = Boolean(row.evidence_status);
              const evidenceLabel = row.evidence_status || t("table.missing");
              const evidenceTarget = row.kpi_key || row.control_id;
              const evidenceHref = `/${encodeURIComponent(
                entitySlug
              )}/scorecard/${encodeURIComponent(
                projectSlug
              )}/controls/${encodeURIComponent(evidenceTarget)}`;
              const targetValue = row.target_text
                ? row.unit
                  ? `${row.target_text} (${row.unit})`
                  : row.target_text
                : row.unit
                  ? row.unit
                  : t("table.missing");
              return (
                <tr
                  key={`${row.control_id}-${row.kpi_key ?? ""}`}
                  className="border-t border-slate-100 text-slate-700 dark:border-slate-800 dark:text-slate-200"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {row.kpi_name || row.kpi_key || t("table.missing")}
                    </div>
                    <div className="text-xs text-slate-500">{row.kpi_key || "—"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openDetail(row)}
                      className="font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-300"
                    >
                      {row.control_name || row.control_id}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className={ownerAssigned ? "text-slate-900 dark:text-slate-100" : "text-rose-600"}>
                      {ownerValue}
                    </div>
                    {row.designated_owner_email && (
                      <div className="text-xs text-slate-500">{row.designated_owner_email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={targetDefined ? "text-slate-900 dark:text-slate-100" : "text-rose-600"}>
                      {targetValue}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={mechanismActivated ? "text-emerald-700 dark:text-emerald-300" : "text-rose-600"}>
                      {mechanismActivated ? row.evidence_source : t("table.missing")}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={evidenceHref}
                      className={
                        evidenceField
                          ? "text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
                          : "text-rose-600 underline-offset-2 hover:underline"
                      }
                    >
                      {evidenceLabel}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  {t("tableEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div>
                <div className="text-xs uppercase text-slate-500">
                  {t("modal.title")}
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {selected.control_name || selected.control_id}
                </div>
              </div>
              <button
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                onClick={closeDetail}
              >
                {t("modal.close")}
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    {t("modal.controlName")}
                  </div>
                  <div className="mt-1">{selected.control_name || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    {t("modal.evidenceSource")}
                  </div>
                  <div className="mt-1">{selected.evidence_source || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    {t("modal.targetText")}
                  </div>
                  <div className="mt-1">{selected.target_text || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    {t("modal.ownerRole")}
                  </div>
                  <div className="mt-1">{selected.owner_role || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500">
                    {t("modal.evidenceStatus")}
                  </div>
                  <div className="mt-1">{selected.evidence_status || t("table.missing")}</div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase text-slate-500">
                  {t("modal.designatedOwner")}
                  <input
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={selected.designated_owner_name || ""}
                    onChange={(event) =>
                      setSelected({
                        ...selected,
                        designated_owner_name: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  {t("modal.ownerEmail")}
                  <input
                    type="email"
                    className="mt-2 w-full min-w-[280px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={selected.designated_owner_email || ""}
                    onChange={(event) =>
                      setSelected({
                        ...selected,
                        designated_owner_email: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  {t("modal.dueDate")}
                  <input
                    type="date"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={selected.due_date || ""}
                    onChange={(event) =>
                      setSelected({ ...selected, due_date: event.target.value })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  {t("modal.frequency")}
                  <input
                    type="number"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={selected.frequency ?? ""}
                    onChange={(event) =>
                      setSelected({
                        ...selected,
                        frequency:
                          event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  {t("modal.reminderDay")}
                  <input
                    type="number"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={selected.reminder_day ?? ""}
                    onChange={(event) =>
                      setSelected({
                        ...selected,
                        reminder_day:
                          event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  {t("modal.reminderCount")}
                  <input
                    type="number"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={selected.reminder_count ?? ""}
                    onChange={(event) =>
                      setSelected({
                        ...selected,
                        reminder_count:
                          event.target.value === "" ? null : Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  {t("modal.manager")}
                  <input
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={selected.designated_owner_manager || ""}
                    onChange={(event) =>
                      setSelected({
                        ...selected,
                        designated_owner_manager: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500">
                  {t("modal.managerEmail")}
                  <input
                    type="email"
                    className="mt-2 w-full min-w-[280px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={selected.designated_owner_manager_email || ""}
                    onChange={(event) =>
                      setSelected({
                        ...selected,
                        designated_owner_manager_email: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-slate-500 md:col-span-2">
                  {t("modal.provideUrl")}
                  <input
                    type="url"
                    className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    value={selected.provide_url || ""}
                    onChange={(event) =>
                      setSelected({ ...selected, provide_url: event.target.value })
                    }
                  />
                </label>
              </div>
              {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
                onClick={closeDetail}
              >
                {t("modal.cancel")}
              </button>
              <button
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                onClick={saveDetail}
                disabled={saving}
              >
                {saving ? t("modal.saving") : t("modal.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
