"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/app/(components)/Header";
import { coreApiBase } from "@/lib/coreApiBase";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Save,
  X,
} from "lucide-react";

export default function ModelProvidersPage() {
  const t = useTranslations("ModelProvidersPage");
  const [values, setValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [entities, setEntities] = useState<
    Array<{ entity_id: string; name?: string; slug?: string }>
  >([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [artifacts, setArtifacts] = useState<
    Array<{
      id: string;
      entity_id: string;
      provider_key: string;
      name: string;
      uri: string;
      sha256?: string | null;
      type?: string | null;
      status?: string | null;
      valid_from?: string | null;
      valid_to?: string | null;
      updated_at?: string | null;
    }>
  >([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactsError, setArtifactsError] = useState<string | null>(null);
  const [artifactSaving, setArtifactSaving] = useState(false);
  const [artifactEditingId, setArtifactEditingId] = useState<string | null>(null);
  const [artifactDeleteConfirm, setArtifactDeleteConfirm] = useState<string | null>(
    null
  );
  const [artifactDraft, setArtifactDraft] = useState({
    provider_key: "openai",
    name: "",
    uri: "",
    sha256: "",
    type: "",
    status: "",
    valid_from: "",
    valid_to: "",
  });
  const [artifactEditDraft, setArtifactEditDraft] = useState({
    provider_key: "openai",
    name: "",
    uri: "",
    sha256: "",
    type: "",
    status: "",
    valid_from: "",
    valid_to: "",
  });

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${coreApiBase()}/admin/ai-systems/helper/model-providers`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Failed to load model providers.";
        try {
          const body = JSON.parse(text) as { detail?: string };
          if (typeof body.detail === "string") msg = body.detail;
        } catch {
          if (text.trim()) msg = text.trim();
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as { values?: string[] };
      setValues(Array.isArray(data.values) ? data.values : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const loadEntities = useCallback(async () => {
    try {
      const res = await fetch("/api/core/user/entities", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.entities)
          ? data.entities
          : data?.items ?? [];
      setEntities(list);
      if (list.length && !selectedEntityId) {
        setSelectedEntityId(list[0].entity_id);
      }
    } catch {
      // ignore
    }
  }, [selectedEntityId]);

  useEffect(() => {
    loadEntities();
  }, [loadEntities]);

  const providerOptions = useMemo(
    () => [
      { value: "openai", label: "OpenAI" },
      { value: "anthropic", label: "Anthropic" },
      { value: "google", label: "Google" },
      { value: "meta", label: "Meta" },
    ],
    []
  );

  const toIsoOrNull = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  };

  const fetchArtifacts = useCallback(async () => {
    if (!selectedEntityId) return;
    setArtifactsLoading(true);
    setArtifactsError(null);
    try {
      const params = new URLSearchParams({ entity_id: selectedEntityId, limit: "200" });
      const res = await fetch(
        `${coreApiBase()}/admin/entity-provider-artifacts?${params.toString()}`,
        { cache: "no-store", credentials: "include" }
      );
      if (!res.ok) {
        const text = await res.text();
        let msg = "Failed to load provider artifacts.";
        try {
          const body = JSON.parse(text) as { detail?: string };
          if (typeof body.detail === "string") msg = body.detail;
        } catch {
          if (text.trim()) msg = text.trim();
        }
        throw new Error(msg);
      }
      const data = await res.json();
      setArtifacts(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setArtifactsError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setArtifactsLoading(false);
    }
  }, [selectedEntityId]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const createArtifact = async () => {
    if (!selectedEntityId) return;
    if (!artifactDraft.name.trim() || !artifactDraft.uri.trim()) {
      setArtifactsError("Name and URI are required.");
      return;
    }
    setArtifactSaving(true);
    setArtifactsError(null);
    try {
      const res = await fetch(
        `${coreApiBase()}/admin/entity-provider-artifacts?entity_id=${encodeURIComponent(
          selectedEntityId
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            provider_key: artifactDraft.provider_key,
            name: artifactDraft.name.trim(),
            uri: artifactDraft.uri.trim(),
            sha256: artifactDraft.sha256.trim() || null,
            type: artifactDraft.type.trim() || null,
            status: artifactDraft.status.trim() || null,
            valid_from: toIsoOrNull(artifactDraft.valid_from),
            valid_to: toIsoOrNull(artifactDraft.valid_to),
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        let msg = "Failed to create artifact.";
        try {
          const body = JSON.parse(text) as { detail?: string };
          if (typeof body.detail === "string") msg = body.detail;
        } catch {
          if (text.trim()) msg = text.trim();
        }
        throw new Error(msg);
      }
      setArtifactDraft({
        provider_key: "openai",
        name: "",
        uri: "",
        sha256: "",
        type: "",
        status: "",
        valid_from: "",
        valid_to: "",
      });
      await fetchArtifacts();
    } catch (e) {
      setArtifactsError(e instanceof Error ? e.message : "Failed to create.");
    } finally {
      setArtifactSaving(false);
    }
  };

  const startEditArtifact = (row: (typeof artifacts)[number]) => {
    setArtifactEditingId(row.id);
    setArtifactEditDraft({
      provider_key: row.provider_key,
      name: row.name ?? "",
      uri: row.uri ?? "",
      sha256: row.sha256 ?? "",
      type: row.type ?? "",
      status: row.status ?? "",
      valid_from: row.valid_from ?? "",
      valid_to: row.valid_to ?? "",
    });
  };

  const saveArtifactEdit = async () => {
    if (!selectedEntityId || !artifactEditingId) return;
    if (!artifactEditDraft.name.trim() || !artifactEditDraft.uri.trim()) {
      setArtifactsError("Name and URI are required.");
      return;
    }
    setArtifactSaving(true);
    setArtifactsError(null);
    try {
      const res = await fetch(
        `${coreApiBase()}/admin/entity-provider-artifacts/${encodeURIComponent(
          artifactEditingId
        )}?entity_id=${encodeURIComponent(selectedEntityId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            provider_key: artifactEditDraft.provider_key,
            name: artifactEditDraft.name.trim(),
            uri: artifactEditDraft.uri.trim(),
            sha256: artifactEditDraft.sha256.trim() || null,
            type: artifactEditDraft.type.trim() || null,
            status: artifactEditDraft.status.trim() || null,
            valid_from: toIsoOrNull(artifactEditDraft.valid_from),
            valid_to: toIsoOrNull(artifactEditDraft.valid_to),
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        let msg = "Failed to update artifact.";
        try {
          const body = JSON.parse(text) as { detail?: string };
          if (typeof body.detail === "string") msg = body.detail;
        } catch {
          if (text.trim()) msg = text.trim();
        }
        throw new Error(msg);
      }
      setArtifactEditingId(null);
      await fetchArtifacts();
    } catch (e) {
      setArtifactsError(e instanceof Error ? e.message : "Failed to update.");
    } finally {
      setArtifactSaving(false);
    }
  };

  const deleteArtifact = async (artifactId: string) => {
    if (!selectedEntityId) return;
    setArtifactSaving(true);
    setArtifactsError(null);
    setArtifactDeleteConfirm(null);
    try {
      const res = await fetch(
        `${coreApiBase()}/admin/entity-provider-artifacts/${encodeURIComponent(
          artifactId
        )}?entity_id=${encodeURIComponent(selectedEntityId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!res.ok) {
        const text = await res.text();
        let msg = "Failed to delete artifact.";
        try {
          const body = JSON.parse(text) as { detail?: string };
          if (typeof body.detail === "string") msg = body.detail;
        } catch {
          if (text.trim()) msg = text.trim();
        }
        throw new Error(msg);
      }
      await fetchArtifacts();
    } catch (e) {
      setArtifactsError(e instanceof Error ? e.message : "Failed to delete.");
    } finally {
      setArtifactSaving(false);
    }
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${coreApiBase()}/admin/ai-systems/helper/model-providers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: name }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Failed to add.";
        try {
          const body = JSON.parse(text) as { detail?: string };
          if (typeof body.detail === "string") msg = body.detail;
        } catch {
          if (text.trim()) msg = text.trim();
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as { values?: string[] };
      setValues(Array.isArray(data.values) ? data.values : []);
      setNewName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (editingIndex == null) return;
    const oldVal = values[editingIndex];
    const newVal = editDraft.trim();
    if (!newVal || newVal === oldVal) {
      setEditingIndex(null);
      setEditDraft("");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${coreApiBase()}/admin/ai-systems/helper/model-providers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ old_value: oldVal, new_value: newVal }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Failed to update.";
        try {
          const body = JSON.parse(text) as { detail?: string };
          if (typeof body.detail === "string") msg = body.detail;
        } catch {
          if (text.trim()) msg = text.trim();
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as { values?: string[] };
      setValues(Array.isArray(data.values) ? data.values : []);
      setEditingIndex(null);
      setEditDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (value: string) => {
    setSaving(true);
    setError(null);
    setDeleteConfirm(null);
    try {
      const res = await fetch(`${coreApiBase()}/admin/ai-systems/helper/model-providers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Failed to remove.";
        try {
          const body = JSON.parse(text) as { detail?: string };
          if (typeof body.detail === "string") msg = body.detail;
        } catch {
          if (text.trim()) msg = text.trim();
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as { values?: string[] };
      setValues(Array.isArray(data.values) ? data.values : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title={t("title")} subtitle={t("subtitle")} />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header title={t("title")} subtitle={t("subtitle")}>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={fetchProviders}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            {t("refresh")}
          </button>
        </div>
      </Header>

      {(error || artifactsError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error || artifactsError}</span>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={t("addPlaceholder")}
              className="min-w-[200px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              aria-label={t("addPlaceholder")}
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !newName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("add")}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t("providerName")}
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t("actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {values.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-slate-500">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                values.map((name, index) => (
                  <tr key={`${name}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      {editingIndex === index ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleUpdate();
                              if (e.key === "Escape") {
                                setEditingIndex(null);
                                setEditDraft("");
                              }
                            }}
                            className="min-w-[180px] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            autoFocus
                            aria-label={t("editLabel")}
                          />
                          <button
                            type="button"
                            onClick={handleUpdate}
                            disabled={saving || !editDraft.trim()}
                            className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
                            title={t("save")}
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIndex(null);
                              setEditDraft("");
                            }}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title={t("cancel")}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {name}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {editingIndex === index ? null : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIndex(index);
                              setEditDraft(name);
                            }}
                            className="rounded p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                            title={t("edit")}
                            aria-label={t("edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {deleteConfirm === name ? (
                            <>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {t("confirmRemove")}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemove(name)}
                                disabled={saving}
                                className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {t("yes")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirm(null)}
                                className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600"
                              >
                                {t("cancel")}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(name)}
                              className="rounded p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              title={t("remove")}
                              aria-label={t("remove")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Model Provider Artifacts
              </h3>
              <p className="text-xs text-slate-500">
                Artifacts are entity-level and apply to all projects.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {entities.map((entity) => (
                  <option key={entity.entity_id} value={entity.entity_id}>
                    {entity.name || entity.slug || entity.entity_id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={fetchArtifacts}
                disabled={artifactSaving || artifactsLoading}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-700">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-slate-500">
              Provider
              <select
                value={artifactDraft.provider_key}
                onChange={(e) =>
                  setArtifactDraft((prev) => ({
                    ...prev,
                    provider_key: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {providerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Name
              <input
                value={artifactDraft.name}
                onChange={(e) =>
                  setArtifactDraft((prev) => ({ ...prev, name: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="ISO 27001 Certificate"
              />
            </label>
            <label className="text-xs text-slate-500">
              URI
              <input
                value={artifactDraft.uri}
                onChange={(e) =>
                  setArtifactDraft((prev) => ({ ...prev, uri: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="s3://... or https://..."
              />
            </label>
            <label className="text-xs text-slate-500">
              Type
              <input
                value={artifactDraft.type}
                onChange={(e) =>
                  setArtifactDraft((prev) => ({ ...prev, type: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="cert, soc2, dpa"
              />
            </label>
            <label className="text-xs text-slate-500">
              SHA256
              <input
                value={artifactDraft.sha256}
                onChange={(e) =>
                  setArtifactDraft((prev) => ({ ...prev, sha256: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="optional"
              />
            </label>
            <label className="text-xs text-slate-500">
              Status
              <input
                value={artifactDraft.status}
                onChange={(e) =>
                  setArtifactDraft((prev) => ({ ...prev, status: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                placeholder="active, expired"
              />
            </label>
            <label className="text-xs text-slate-500">
              Valid From
              <input
                type="datetime-local"
                value={artifactDraft.valid_from}
                onChange={(e) =>
                  setArtifactDraft((prev) => ({ ...prev, valid_from: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="text-xs text-slate-500">
              Valid To
              <input
                type="datetime-local"
                value={artifactDraft.valid_to}
                onChange={(e) =>
                  setArtifactDraft((prev) => ({ ...prev, valid_to: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={createArtifact}
              disabled={artifactSaving || !artifactDraft.name.trim() || !artifactDraft.uri.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {artifactSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Artifact
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Provider
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Name
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
                  URI
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Type
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Status
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Validity
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {artifactsLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    Loading artifacts…
                  </td>
                </tr>
              ) : artifacts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No provider artifacts yet.
                  </td>
                </tr>
              ) : (
                artifacts.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    {artifactEditingId === row.id ? (
                      <>
                        <td className="px-4 py-3">
                          <select
                            value={artifactEditDraft.provider_key}
                            onChange={(e) =>
                              setArtifactEditDraft((prev) => ({
                                ...prev,
                                provider_key: e.target.value,
                              }))
                            }
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {providerOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={artifactEditDraft.name}
                            onChange={(e) =>
                              setArtifactEditDraft((prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={artifactEditDraft.uri}
                            onChange={(e) =>
                              setArtifactEditDraft((prev) => ({ ...prev, uri: e.target.value }))
                            }
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={artifactEditDraft.type}
                            onChange={(e) =>
                              setArtifactEditDraft((prev) => ({ ...prev, type: e.target.value }))
                            }
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={artifactEditDraft.status}
                            onChange={(e) =>
                              setArtifactEditDraft((prev) => ({ ...prev, status: e.target.value }))
                            }
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <input
                              type="datetime-local"
                              value={artifactEditDraft.valid_from}
                              onChange={(e) =>
                                setArtifactEditDraft((prev) => ({
                                  ...prev,
                                  valid_from: e.target.value,
                                }))
                              }
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                            <input
                              type="datetime-local"
                              value={artifactEditDraft.valid_to}
                              onChange={(e) =>
                                setArtifactEditDraft((prev) => ({
                                  ...prev,
                                  valid_to: e.target.value,
                                }))
                              }
                              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={saveArtifactEdit}
                              disabled={artifactSaving}
                              className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                            >
                              <Save className="h-3.5 w-3.5" />
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setArtifactEditingId(null)}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                          {row.provider_key}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                          {row.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                          <a
                            href={row.uri}
                            className="text-indigo-600 hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {row.uri}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                          {row.type || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                          {row.status || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                          {(row.valid_from || row.valid_to)
                            ? `${row.valid_from ?? "—"} → ${row.valid_to ?? "—"}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEditArtifact(row)}
                              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            {artifactDeleteConfirm === row.id ? (
                              <button
                                type="button"
                                onClick={() => deleteArtifact(row.id)}
                                className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Confirm
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setArtifactDeleteConfirm(row.id)}
                                className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
