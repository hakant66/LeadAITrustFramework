"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { coreApiBase } from "@/lib/coreApiBase";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";

export type NextStep = {
  id: string;
  entity_id: string;
  report_key: string;
  priority: string;
  title: string;
  owner: string | null;
  due_date: string | null;
  detail: string | null;
  sort_order: number;
  source_index?: number;
  isNew?: boolean;
  isSaving?: boolean;
  error?: string | null;
};

const PRIORITY_OPTIONS = ["high", "medium", "low"];

export type NextStepSeed = {
  id: number;
  priority?: string;
  title?: string;
  detail?: string;
  sourceIndex?: number;
};

export default function BoardLevelNextStepsEditor({
  entityId,
  seed,
  onItemSaved,
}: {
  entityId: string;
  seed?: NextStepSeed | null;
  onItemSaved?: (item: NextStep) => void;
}) {
  const [items, setItems] = useState<NextStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);

  const reportKey = "board-level-report";

  const fetchSteps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${coreApiBase()}/admin/ai-reports/next-steps?entity_id=${encodeURIComponent(entityId)}&report_key=${encodeURIComponent(
          reportKey
        )}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        throw new Error("Failed to load next steps.");
      }
      const data = (await res.json()) as NextStep[];
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load next steps.");
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  useEffect(() => {
    if (!seed) return;
    const normalizedPriority = (seed.priority ?? "").toLowerCase();
    const priority =
      normalizedPriority.includes("high")
        ? "high"
        : normalizedPriority.includes("low")
        ? "low"
        : "medium";

    setItems((prev) => {
      const maxOrder = prev.reduce((acc, item) => Math.max(acc, item.sort_order ?? 0), 0);
      return [
        ...prev,
        {
          id: `seed-${seed.id}`,
          entity_id: entityId,
          report_key: reportKey,
          priority,
          title: seed.title ?? "",
          owner: "",
          due_date: "",
          detail: seed.detail ?? "",
          sort_order: maxOrder + 1,
          source_index: seed.sourceIndex,
          isNew: true,
        },
      ];
    });
  }, [seed?.id, entityId, reportKey]);

  const addStep = () => {
    setItems((prev) => {
      const maxOrder = prev.reduce((acc, item) => Math.max(acc, item.sort_order ?? 0), 0);
      return [
        ...prev,
        {
          id: `new-${Date.now()}`,
          entity_id: entityId,
          report_key: reportKey,
          priority: "medium",
          title: "",
          owner: "",
          due_date: "",
          detail: "",
          sort_order: maxOrder + 1,
          isNew: true,
        },
      ];
    });
  };

  const updateItem = (id: string, patch: Partial<NextStep>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const saveItem = async (item: NextStep) => {
    updateItem(item.id, { isSaving: true, error: null });
    try {
      const payload = {
        report_key: reportKey,
        priority: item.priority,
        title: item.title,
        owner: item.owner || null,
        due_date: item.due_date || null,
        detail: item.detail || null,
        sort_order: item.sort_order ?? 0,
      };
      const urlBase = `${coreApiBase()}/admin/ai-reports/next-steps?entity_id=${encodeURIComponent(entityId)}`;
      const res = await fetch(
        item.isNew
          ? urlBase
          : `${coreApiBase()}/admin/ai-reports/next-steps/${encodeURIComponent(
              item.id
            )}?entity_id=${encodeURIComponent(entityId)}`,
        {
          method: item.isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save.");
      }
      const saved = (await res.json()) as NextStep;
      const nextRow = { ...item, ...saved, isSaving: false };
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? nextRow : row))
      );
      onItemSaved?.(nextRow);
    } catch (err) {
      updateItem(item.id, {
        isSaving: false,
        error: err instanceof Error ? err.message : "Failed to save.",
      });
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    setError(null);
    let failed = 0;
    for (const item of sortedItems) {
      if (!item.title.trim()) {
        updateItem(item.id, { error: "Title is required." });
        failed += 1;
        continue;
      }
      try {
        await saveItem(item);
      } catch {
        failed += 1;
      }
    }
    if (failed > 0) {
      setError(`Failed to save ${failed} item(s).`);
    }
    setSavingAll(false);
  };

  const deleteItem = async (item: NextStep) => {
    if (item.isNew) {
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      return;
    }
    updateItem(item.id, { isSaving: true, error: null });
    try {
      const res = await fetch(
        `${coreApiBase()}/admin/ai-reports/next-steps/${encodeURIComponent(item.id)}?entity_id=${encodeURIComponent(
          entityId
        )}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to delete.");
      }
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch (err) {
      updateItem(item.id, {
        isSaving: false,
        error: err instanceof Error ? err.message : "Failed to delete.",
      });
    }
  };

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [items]
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading next steps...
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Add Next Steps (90 Days)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Updates here override the “Next Steps (90 Days)” section in the High-Level Report.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSteps}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            onClick={saveAll}
            disabled={savingAll || items.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {savingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save all changes
          </button>
          <button
            onClick={addStep}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add step
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

      <div className="mt-4 space-y-3">
        {sortedItems.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
            No next steps yet. Add the first one above.
          </div>
        )}

        {sortedItems.map((item) => (
          <div
            key={item.id}
            className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-6"
          >
            <div className="sm:col-span-1">
              <label className="text-xs font-semibold text-slate-500">Priority</label>
              <select
                value={item.priority}
                onChange={(e) => updateItem(item.id, { priority: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                disabled={item.isSaving}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500">Title</label>
              <input
                value={item.title}
                onChange={(e) => updateItem(item.id, { title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                placeholder="Step title"
                disabled={item.isSaving}
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs font-semibold text-slate-500">Owner</label>
              <input
                value={item.owner ?? ""}
                onChange={(e) => updateItem(item.id, { owner: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                placeholder="Owner"
                disabled={item.isSaving}
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs font-semibold text-slate-500">Due Date</label>
              <input
                type="date"
                value={item.due_date ?? ""}
                onChange={(e) => updateItem(item.id, { due_date: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                disabled={item.isSaving}
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs font-semibold text-slate-500">Order</label>
              <input
                type="number"
                value={item.sort_order ?? 0}
                onChange={(e) => updateItem(item.id, { sort_order: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                disabled={item.isSaving}
              />
            </div>
            <div className="sm:col-span-5">
              <label className="text-xs font-semibold text-slate-500">Detail</label>
              <textarea
                value={item.detail ?? ""}
                onChange={(e) => updateItem(item.id, { detail: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                placeholder="Optional detail"
                rows={4}
                disabled={item.isSaving}
              />
            </div>
            <div className="flex items-end gap-2 sm:col-span-1">
              <button
                onClick={() => saveItem(item)}
                disabled={item.isSaving || !item.title.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {item.isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save
              </button>
              <button
                onClick={() => deleteItem(item)}
                disabled={item.isSaving}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            </div>
            {item.error && (
              <div className="sm:col-span-6 text-xs text-rose-600">{item.error}</div>
            )}
          </div>
        ))}
      </div>

    </section>
  );
}
