"use client";

import { useEffect, useState } from "react";
import Header from "@/app/(components)/Header";
import { coreApiBase } from "@/lib/coreApiBase";

type SourceRow = {
  id: string;
  entity_id: string;
  project_slug?: string | null;
  title: string;
  source_type: string;
  content?: string | null;
  object_key?: string | null;
  file_name?: string | null;
  file_mime?: string | null;
  file_size?: number | null;
  metadata?: any;
  created_at?: string | null;
  updated_at?: string | null;
};
type KnowledgeTableRow = {
  table_key: string;
  label: string;
  description?: string | null;
  is_active: boolean;
  enabled: boolean;
};

export default function KnowledgeVaultClient({
  entityId,
  entitySlug,
}: {
  entityId: string;
  entitySlug: string;
}) {
  const CORE = coreApiBase();
  const coreFetch = async (path: string, init?: RequestInit) => {
    const url = `${CORE}${path}`;
    const requestInit: RequestInit = {
      credentials: "include",
      ...init,
    };
    try {
      return await fetch(url, requestInit);
    } catch (err) {
      // Retry once for transient browser/network edge failures.
      if (err instanceof TypeError) {
        return fetch(url, requestInit);
      }
      throw err;
    }
  };
  const [entityScope, setEntityScope] = useState<"entity" | "all">("entity");
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [knowledgeTables, setKnowledgeTables] = useState<KnowledgeTableRow[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tableOpen, setTableOpen] = useState<Record<string, boolean>>({});
  const [tableRows, setTableRows] = useState<
    Record<string, { columns: string[]; rows: Record<string, any>[] }>
  >({});
  const [tableBusy, setTableBusy] = useState<Record<string, boolean>>({});
  const [tableErrors, setTableErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("text");
  const [content, setContent] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);

  const loadEntityNames = async () => {
    try {
      const res = await coreFetch("/user/entities", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) {
        const map: Record<string, string> = {};
        for (const item of data) {
          if (item?.entity_id && item?.name) {
            map[item.entity_id] = item.name;
          }
        }
        setEntityNames(map);
      }
    } catch {
      // ignore
    }
  };

  const loadKnowledgeTables = async () => {
    setTablesLoading(true);
    try {
      const res = await coreFetch(
        `/admin/knowledge-vault/tables?entity_id=${encodeURIComponent(entityId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setKnowledgeTables(Array.isArray(data?.items) ? data.items : []);
    } catch {
      // ignore
    } finally {
      setTablesLoading(false);
    }
  };

  const loadSources = async () => {
    setLoading(true);
    setError(null);
    try {
      const params =
        entityScope === "entity"
          ? new URLSearchParams({ entity_id: entityId })
          : new URLSearchParams();
      const suffix = params.toString();
      const res = await coreFetch(
        `/admin/knowledge-vault/sources${suffix ? `?${suffix}` : ""}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        throw new Error(`Failed to load sources (${res.status})`);
      }
      const data = await res.json();
      setSources(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const createSource = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await coreFetch("/admin/knowledge-vault/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          source_type: sourceType,
          content: content.trim() || null,
          entity_id: entityId,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create source (${res.status})`);
      }
      const created = await res.json().catch(() => null);
      const createdId = created?.id as string | undefined;
      if (createdId) {
        await coreFetch(
          `/admin/knowledge-vault/sources/${encodeURIComponent(
            createdId
          )}/ingest?entity_id=${encodeURIComponent(entityId)}`,
          { method: "POST" }
        ).catch(() => null);
      }
      setTitle("");
      setContent("");
      await loadSources();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const uploadSourceFile = async () => {
    if (!uploadFile) {
      setError("Choose a file to upload.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const presignRes = await coreFetch("/admin/knowledge-vault/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: uploadFile.name,
          content_type: uploadFile.type || "application/octet-stream",
          entity_id: entityId,
        }),
      });
      if (!presignRes.ok) {
        const text = await presignRes.text().catch(() => "");
        throw new Error(text || `Failed to presign (${presignRes.status})`);
      }
      const presignData = await presignRes.json();
      const uploadUrl = presignData?.upload_url;
      const headers = presignData?.headers ?? {};
      const objectKey = presignData?.object_key;
      if (!uploadUrl || !objectKey) {
        throw new Error("Invalid presign response");
      }

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers,
        body: uploadFile,
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`);
      }

      const finalTitle = title.trim() || uploadFile.name;
      const metaRes = await coreFetch("/admin/knowledge-vault/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: finalTitle,
          source_type: "file",
          entity_id: entityId,
          object_key: objectKey,
          file_name: uploadFile.name,
          file_mime: uploadFile.type || null,
          file_size: uploadFile.size,
        }),
      });
      if (!metaRes.ok) {
        const text = await metaRes.text().catch(() => "");
        throw new Error(text || `Failed to save file metadata (${metaRes.status})`);
      }
      const created = await metaRes.json().catch(() => null);
      const createdId = created?.id as string | undefined;
      if (createdId) {
        await coreFetch(
          `/admin/knowledge-vault/sources/${encodeURIComponent(
            createdId
          )}/ingest?entity_id=${encodeURIComponent(entityId)}`,
          { method: "POST" }
        ).catch(() => null);
      }

      setUploadFile(null);
      setTitle("");
      await loadSources();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const deleteSource = async (id: string) => {
    if (!confirm("Delete this knowledge source?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await coreFetch(
        `/admin/knowledge-vault/sources/${encodeURIComponent(id)}?entity_id=${encodeURIComponent(entityId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to delete source (${res.status})`);
      }
      await loadSources();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const viewFile = async (src: SourceRow) => {
    if (!src.object_key) return;
    setLoading(true);
    setError(null);
    try {
      const res = await coreFetch(
        `/admin/knowledge-vault/sources/${encodeURIComponent(
          src.id
        )}/download?entity_id=${encodeURIComponent(entityId)}`
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to fetch download link (${res.status})`);
      }
      const data = await res.json();
      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const ingestSource = async (src: SourceRow) => {
    if (!src.object_key) return;
    setLoading(true);
    setError(null);
    try {
      const res = await coreFetch(
        `/admin/knowledge-vault/sources/${encodeURIComponent(
          src.id
        )}/ingest?entity_id=${encodeURIComponent(entityId)}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to index source (${res.status})`);
      }
      await loadSources();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        query: searchQuery.trim(),
        ...(entityScope === "entity" ? { entity_id: entityId } : {}),
      });
      const res = await coreFetch(`/admin/knowledge-vault/search?${params.toString()}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Search failed (${res.status})`);
      }
      const data = await res.json();
      setSearchResults(Array.isArray(data?.results) ? data.results : []);
      setPreviewText(null);
      setPreviewTitle(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSearching(false);
    }
  };

  const toggleKnowledgeTable = async (table: KnowledgeTableRow) => {
    setTablesLoading(true);
    try {
      await coreFetch(
        `/admin/knowledge-vault/tables/${encodeURIComponent(
          table.table_key
        )}?entity_id=${encodeURIComponent(entityId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !table.enabled }),
        }
      );
      await loadKnowledgeTables();
    } finally {
      setTablesLoading(false);
    }
  };

  const loadTableRows = async (tableKey: string) => {
    setTableBusy((prev) => ({ ...prev, [tableKey]: true }));
    setTableErrors((prev) => ({ ...prev, [tableKey]: "" }));
    try {
      const res = await coreFetch(
        `/admin/knowledge-vault/tables/${encodeURIComponent(
          tableKey
        )}/rows?entity_id=${encodeURIComponent(entityId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to load ${tableKey} (${res.status})`);
      }
      const data = await res.json();
      setTableRows((prev) => ({
        ...prev,
        [tableKey]: {
          columns: Array.isArray(data?.columns) ? data.columns : [],
          rows: Array.isArray(data?.rows) ? data.rows : [],
        },
      }));
    } catch (err: any) {
      setTableErrors((prev) => ({
        ...prev,
        [tableKey]: err?.message ?? String(err),
      }));
    } finally {
      setTableBusy((prev) => ({ ...prev, [tableKey]: false }));
    }
  };

  const toggleTableView = (tableKey: string) => {
    setTableOpen((prev) => {
      const next = !prev[tableKey];
      if (next && !tableRows[tableKey]) {
        void loadTableRows(tableKey);
      }
      return { ...prev, [tableKey]: next };
    });
  };

  const viewSearchSource = async (hit: any) => {
    setPreviewText(null);
    setPreviewTitle(null);
    if (hit?.file_name && hit?.source_id) {
      setLoading(true);
      setError(null);
      try {
        const res = await coreFetch(
          `/admin/knowledge-vault/sources/${encodeURIComponent(
            hit.source_id
          )}/download?entity_id=${encodeURIComponent(entityId)}`
        );
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Failed to fetch download link (${res.status})`);
        }
        const data = await res.json();
        if (data?.url) {
          window.open(data.url, "_blank", "noopener,noreferrer");
          return;
        }
      } catch (e: any) {
        setError(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }
    if (hit?.text) {
      setPreviewTitle(hit?.title ?? "Knowledge Source");
      setPreviewText(hit.text);
    }
  };

  useEffect(() => {
    void loadEntityNames();
    void loadKnowledgeTables();
  }, [entityId]);

  useEffect(() => {
    void loadSources();
  }, [entityId, entityScope]);

  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <Header
          title="Knowledge Vault"
          subtitle={`LeadAI · ${entitySlug}`}
        />

        {error && (
          <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4">
          <div className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
            Add Knowledge Source to LLM
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-600 dark:text-slate-400">
              Title
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. EU AI Act Summary"
              />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-400">
              Source Type
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
              >
                <option value="text">Text</option>
                <option value="url">URL</option>
                <option value="file">File</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block text-xs text-slate-600 dark:text-slate-400">
            Content
            <textarea
              className="mt-1 h-40 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste text or a short summary..."
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-xs text-slate-600 dark:text-slate-400">
              Upload File
              <input
                type="file"
                className="mt-1 block text-xs text-slate-600 dark:text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-200 dark:file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 dark:file:text-slate-100 hover:file:bg-slate-300 dark:hover:file:bg-slate-700"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
              {uploadFile && (
                <span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-500">
                  {uploadFile.name}
                </span>
              )}
            </label>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50"
                onClick={uploadSourceFile}
                disabled={loading || !uploadFile}
              >
                Upload File
              </button>
            <button
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              onClick={createSource}
              disabled={loading}
            >
              Save Source
            </button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
              Knowledge Sources
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-1 text-xs">
                <button
                  className={`px-3 py-1 rounded-md ${
                    entityScope === "entity"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                  onClick={() => setEntityScope("entity")}
                >
                  My Entity
                </button>
                <button
                  className={`px-3 py-1 rounded-md ${
                    entityScope === "all"
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                  onClick={() => setEntityScope("all")}
                >
                  All Entities
                </button>
              </div>
              <button
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50"
                onClick={loadSources}
                disabled={loading}
              >
                Refresh
              </button>
            </div>
          </div>
          {loading ? (
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">Loading…</div>
          ) : sources.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="p-2 text-left">Title</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Entity</th>
                    <th className="p-2 text-left">Updated</th>
                    <th className="p-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((src) => (
                    <tr
                      key={src.id}
                      className="border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <td className="p-2">{src.title}</td>
                      <td className="p-2 text-xs text-slate-600 dark:text-slate-400">
                        {src.source_type}
                        {src.file_name ? (
                          <div className="text-[11px] text-slate-500 dark:text-slate-500">
                            {src.file_name}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-2 text-xs text-slate-600 dark:text-slate-400">
                        {entityNames[src.entity_id] ??
                          `${src.entity_id.slice(0, 8)}…`}
                      </td>
                      <td className="p-2 text-xs text-slate-500 dark:text-slate-500">
                        {src.updated_at
                          ? new Date(src.updated_at).toLocaleString()
                          : "—"}
                        {src.metadata?.ingest?.status ? (
                          <div
                            className={`mt-1 text-[11px] ${
                              src.metadata.ingest.status === "ok"
                                ? "text-emerald-400"
                                : "text-rose-400"
                            }`}
                          >
                            Indexed: {src.metadata.ingest.status}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-2">
                          {src.object_key ? (
                            <>
                              <button
                                className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-800"
                                onClick={() => viewFile(src)}
                              >
                                View
                              </button>
                              <button
                                className="rounded-md border border-indigo-400/40 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-500/10"
                                onClick={() => ingestSource(src)}
                              >
                                Index
                              </button>
                            </>
                          ) : null}
                          <button
                            className="rounded-md border border-rose-400/40 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                            onClick={() => deleteSource(src.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              No knowledge sources yet.
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
              Knowledge Tables (Read-only)
            </div>
              <button
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50"
                onClick={loadKnowledgeTables}
                disabled={tablesLoading}
              >
              Refresh
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
            Toggle which structured tables are visible in Knowledge Vault for{" "}
            {entitySlug}.
          </p>
          {tablesLoading ? (
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">Loading…</div>
          ) : knowledgeTables.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="p-2 text-left">Table</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-left">Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {knowledgeTables.map((table) => (
                    <tr
                      key={table.table_key}
                      className="border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <td className="p-2">
                        <div className="text-sm font-medium">
                          {table.label}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-500">
                          {table.table_key}
                        </div>
                      </td>
                      <td className="p-2 text-xs text-slate-600 dark:text-slate-400">
                        {table.description ?? "—"}
                      </td>
                      <td className="p-2">
                        <button
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            table.enabled
                              ? "bg-emerald-500/20 text-emerald-200"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                          onClick={() => toggleKnowledgeTable(table)}
                          disabled={!table.is_active || tablesLoading}
                        >
                          {table.enabled ? "Enabled" : "Disabled"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              No tables registered.
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
              Knowledge Tables View
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-500">
              Read-only data preview (first 50 rows).
            </span>
          </div>
          {knowledgeTables.filter((t) => t.enabled && t.is_active).length === 0 ? (
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              No tables enabled for this entity.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {knowledgeTables
                .filter((table) => table.enabled && table.is_active)
                .map((table) => {
                  const tableKey = table.table_key;
                  const data = tableRows[tableKey];
                  return (
                    <div
                      key={tableKey}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/40 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {table.label}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-500">
                            {table.description ?? "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-800"
                            onClick={() => toggleTableView(tableKey)}
                          >
                            {tableOpen[tableKey] ? "Hide" : "View"}
                          </button>
                          <button
                            className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:bg-slate-800"
                            onClick={() => loadTableRows(tableKey)}
                            disabled={tableBusy[tableKey]}
                          >
                            Refresh
                          </button>
                        </div>
                      </div>
                      {tableOpen[tableKey] ? (
                        <div className="mt-3">
                          {tableErrors[tableKey] ? (
                            <div className="text-xs text-rose-300">
                              {tableErrors[tableKey]}
                            </div>
                          ) : tableBusy[tableKey] && !data ? (
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              Loading…
                            </div>
                          ) : data && data.rows.length ? (
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-xs text-slate-800 dark:text-slate-200">
                                <thead className="bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                                  <tr>
                                    {data.columns.map((col) => (
                                      <th
                                        key={col}
                                        className="p-2 text-left font-semibold"
                                      >
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.rows.map((row, idx) => (
                                    <tr
                                      key={`${tableKey}-${idx}`}
                                      className="border-b border-slate-200 dark:border-slate-800"
                                    >
                                      {data.columns.map((col) => {
                                        const value = row[col];
                                        const display =
                                          value === null || value === undefined
                                            ? "—"
                                            : typeof value === "string"
                                            ? value
                                            : JSON.stringify(value);
                                        return (
                                          <td
                                            key={`${tableKey}-${idx}-${col}`}
                                            className="p-2 text-slate-800 dark:text-slate-200"
                                          >
                                            {display}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              No rows returned.
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
              Search Knowledge Vault
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              <input
                className="w-full max-w-md rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                placeholder="Search your knowledge vault..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 disabled:opacity-50"
                onClick={runSearch}
                disabled={searching}
              >
                Search
              </button>
            </div>
          </div>
          {searching ? (
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">Searching…</div>
          ) : searchResults.length ? (
            <div className="mt-3 space-y-3">
              {searchResults.map((hit, idx) => (
                <div
                  key={`${hit?.source_id ?? "hit"}-${idx}`}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/40 p-3 text-sm text-slate-800 dark:text-slate-200"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span>{hit?.title ?? "Untitled"}</span>
                    {hit?.file_name ? (
                      <span className="text-[11px] text-slate-500 dark:text-slate-500">
                        {hit.file_name}
                      </span>
                    ) : null}
                    {typeof hit?.score === "number" ? (
                      <span className="text-[11px] text-slate-500 dark:text-slate-500">
                        Score: {hit.score.toFixed(3)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                    {hit?.text || "—"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-800"
                      onClick={() => viewSearchSource(hit)}
                    >
                      View Source
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              {searchQuery.trim()
                ? "No matches found."
                : "Enter a query to search your knowledge vault."}
            </div>
          )}
          {previewText ? (
            <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/40 p-3 text-sm text-slate-800 dark:text-slate-200">
              <div className="text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                {previewTitle ?? "Source Preview"}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
                {previewText}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
