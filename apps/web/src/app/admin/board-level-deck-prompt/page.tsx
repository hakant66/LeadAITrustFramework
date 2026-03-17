"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/app/(components)/Header";
import { coreApiBase } from "@/lib/coreApiBase";

const PROMPT_KEY = "board-level-report-deck";

type PromptTemplate = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  active_version_id?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PromptVersion = {
  id: string;
  template_id: string;
  version: number;
  language: string;
  prompt_text: string;
  variables?: unknown;
  created_at?: string | null;
  created_by?: string | null;
};

export default function BoardLevelDeckPromptPage() {
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [active, setActive] = useState<PromptVersion | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [draftText, setDraftText] = useState("");
  const [draftLanguage, setDraftLanguage] = useState("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coreBase = coreApiBase();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const promptRes = await fetch(
        `${coreBase}/admin/llm-prompts/${encodeURIComponent(PROMPT_KEY)}`,
        { cache: "no-store", credentials: "include" }
      );
      if (!promptRes.ok) {
        throw new Error(`Failed to load prompt (${promptRes.status})`);
      }
      const promptData = await promptRes.json();
      const templateData = promptData?.template ?? null;
      const activeVersion = promptData?.active_version ?? null;
      setTemplate(templateData);
      setActive(activeVersion);
      setDraftText(activeVersion?.prompt_text ?? "");
      setDraftLanguage(activeVersion?.language ?? "en");

      const versionsRes = await fetch(
        `${coreBase}/admin/llm-prompts/${encodeURIComponent(PROMPT_KEY)}/versions`,
        { cache: "no-store", credentials: "include" }
      );
      if (!versionsRes.ok) {
        throw new Error(`Failed to load versions (${versionsRes.status})`);
      }
      const versionsData = await versionsRes.json();
      setVersions(Array.isArray(versionsData?.items) ? versionsData.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load prompt");
    } finally {
      setLoading(false);
    }
  }, [coreBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeVersionId = useMemo(() => template?.active_version_id, [template]);

  const saveVersion = async (setActiveFlag: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${coreBase}/admin/llm-prompts/${encodeURIComponent(PROMPT_KEY)}/versions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt_text: draftText,
            language: draftLanguage || "en",
            set_active: setActiveFlag,
            created_by: "admin-ui",
          }),
          credentials: "include",
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to save (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const activateVersion = async (versionId: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${coreBase}/admin/llm-prompts/${encodeURIComponent(PROMPT_KEY)}/active/${encodeURIComponent(versionId)}`,
        { method: "PUT", credentials: "include" }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to activate (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <Header title="Board-Level Deck Prompt" subtitle="System Admin" />

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-slate-500">Loading prompt…</div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {template?.name ?? "Board-Level Deck (LLM)"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {template?.description ?? ""}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Variables: $Entity Name, $Entity Slug, $Primary Role, $Risk Classification
                  </div>
                </div>
                {active ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Active v{active.version} · {active.language}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[auto_1fr]">
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Language
                </label>
                <input
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={draftLanguage}
                  onChange={(e) => setDraftLanguage(e.target.value)}
                  placeholder="en"
                />
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold uppercase text-slate-500">
                  Prompt Text
                </label>
                <textarea
                  className="mt-2 h-72 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  onClick={() => saveVersion(false)}
                  disabled={saving || !draftText.trim()}
                >
                  Save New Version
                </button>
                <button
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                  onClick={() => saveVersion(true)}
                  disabled={saving || !draftText.trim()}
                >
                  Save & Activate
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Prompt Versions
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="p-2 text-left">Version</th>
                      <th className="p-2 text-left">Language</th>
                      <th className="p-2 text-left">Created</th>
                      <th className="p-2 text-left">By</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((version) => {
                      const isActive = version.id === activeVersionId;
                      return (
                        <tr
                          key={version.id}
                          className="border-b border-slate-200/60 text-slate-700 dark:border-slate-700/70 dark:text-slate-200"
                        >
                          <td className="p-2">v{version.version}</td>
                          <td className="p-2">{version.language}</td>
                          <td className="p-2 text-xs text-slate-500">
                            {version.created_at ? new Date(version.created_at).toLocaleString() : "—"}
                          </td>
                          <td className="p-2 text-xs text-slate-500">
                            {version.created_by ?? "—"}
                          </td>
                          <td className="p-2 text-xs">
                            {isActive ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                                Active
                              </span>
                            ) : (
                              <span className="text-slate-500">Inactive</span>
                            )}
                          </td>
                          <td className="p-2">
                            <button
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                              onClick={() => activateVersion(version.id)}
                              disabled={saving || isActive}
                            >
                              Set Active
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {versions.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-2 text-sm text-slate-500">
                          No versions found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
