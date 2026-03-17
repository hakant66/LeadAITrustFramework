"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/app/(components)/Header";
import { useTranslations } from "next-intl";
import enMessages from "@/messages/en.json";
import trMessages from "@/messages/tr.json";
import { coreApiBase } from "@/lib/coreApiBase";

type FlatEntry = {
  key: string;
  value: string;
};

type TranslationRow = {
  english: string;
  turkish: string;
  keys: string[];
};

type OverrideRow = {
  english_text: string;
  locale: string;
  translated_text: string;
};

const TARGET_LOCALE = "tr";

function flattenMessages(source: Record<string, unknown>, prefix = ""): FlatEntry[] {
  const entries: FlatEntry[] = [];
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      entries.push({ key: path, value });
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    entries.push(...flattenMessages(value as Record<string, unknown>, path));
  }
  return entries;
}

function buildRows(): TranslationRow[] {
  const enEntries = flattenMessages(enMessages as Record<string, unknown>);
  const trEntries = flattenMessages(trMessages as Record<string, unknown>);
  const trMap = new Map(trEntries.map((entry) => [entry.key, entry.value]));
  const rowsByEnglish = new Map<string, TranslationRow>();

  for (const entry of enEntries) {
    const english = entry.value.trim();
    if (!english) continue;
    const turkish = trMap.get(entry.key) ?? "";
    const existing = rowsByEnglish.get(english);
    if (existing) {
      existing.keys.push(entry.key);
      if (!existing.turkish && turkish) {
        existing.turkish = turkish;
      }
      continue;
    }
    rowsByEnglish.set(english, {
      english,
      turkish,
      keys: [entry.key],
    });
  }

  return Array.from(rowsByEnglish.values()).sort((a, b) =>
    a.english.localeCompare(b.english, "en", { sensitivity: "base" })
  );
}

export default function MasterTranslationPage() {
  const t = useTranslations("MasterTranslationPage");
  const rows = useMemo(() => buildRows(), []);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const loadOverrides = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${coreApiBase()}/admin/master/ui-translations?locale=${encodeURIComponent(
            TARGET_LOCALE
          )}`,
          { cache: "no-store", credentials: "include" }
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || t("errors.loadFailed"));
        }
        const data = (await res.json()) as OverrideRow[];
        if (!mounted) return;
        const next: Record<string, string> = {};
        for (const row of data) {
          if (row && typeof row.english_text === "string") {
            next[row.english_text] = row.translated_text ?? "";
          }
        }
        setOverrides(next);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : t("errors.loadFailed"));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void loadOverrides();
    return () => {
      mounted = false;
    };
  }, [t]);

  useEffect(() => {
    if (Object.keys(values).length > 0) return;
    const next: Record<string, string> = {};
    for (const row of rows) {
      next[row.english] = overrides[row.english] ?? row.turkish ?? "";
    }
    setValues(next);
  }, [overrides, rows, values]);

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const current = values[row.english] ?? row.turkish ?? "";
      return (
        row.english.toLowerCase().includes(q) ||
        current.toLowerCase().includes(q)
      );
    });
  }, [filter, rows, values]);

  const handleSave = async (row: TranslationRow) => {
    const english = row.english;
    const current = (values[english] ?? "").trim();
    const base = (row.turkish ?? "").trim();
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, english);

    setSaving((prev) => ({ ...prev, [english]: true }));
    setError(null);
    try {
      if (!current || current === base) {
        if (hasOverride) {
          const res = await fetch(
            `${coreApiBase()}/admin/master/ui-translations?locale=${encodeURIComponent(
              TARGET_LOCALE
            )}&english_text=${encodeURIComponent(english)}`,
            { method: "DELETE", credentials: "include" }
          );
          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || t("errors.resetFailed"));
          }
        }
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[english];
          return next;
        });
        setValues((prev) => ({ ...prev, [english]: base }));
      } else {
        const res = await fetch(`${coreApiBase()}/admin/master/ui-translations`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            english_text: english,
            locale: TARGET_LOCALE,
            translated_text: current,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || t("errors.saveFailed"));
        }
        const saved = (await res.json()) as OverrideRow;
        setOverrides((prev) => ({
          ...prev,
          [english]: saved.translated_text ?? current,
        }));
        setValues((prev) => ({ ...prev, [english]: current }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.saveFailed"));
    } finally {
      setSaving((prev) => ({ ...prev, [english]: false }));
    }
  };

  const handleReset = async (row: TranslationRow) => {
    const english = row.english;
    const base = row.turkish ?? "";
    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, english);

    setSaving((prev) => ({ ...prev, [english]: true }));
    setError(null);
    try {
      if (hasOverride) {
        const res = await fetch(
          `${coreApiBase()}/admin/master/ui-translations?locale=${encodeURIComponent(
            TARGET_LOCALE
          )}&english_text=${encodeURIComponent(english)}`,
          { method: "DELETE", credentials: "include" }
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || t("errors.resetFailed"));
        }
      }
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[english];
        return next;
      });
      setValues((prev) => ({ ...prev, [english]: base }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.resetFailed"));
    } finally {
      setSaving((prev) => ({ ...prev, [english]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <Header title={t("title")} subtitle={t("subtitle")} />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {t("summary", { count: rows.length })}
          </div>
          <div className="w-full max-w-xs">
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mt-4 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">
                  {t("columns.english")}
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  {t("columns.turkish")}
                </th>
                <th className="px-3 py-2 text-left font-semibold">
                  {t("columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                    {t("loading")}
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const english = row.english;
                  const persisted = overrides[english] ?? row.turkish ?? "";
                  const current = values[english] ?? persisted;
                  const dirty = current.trim() !== (persisted ?? "").trim();
                  const busy = saving[english] === true;
                  const canReset =
                    Object.prototype.hasOwnProperty.call(overrides, english) ||
                    current.trim() !== (row.turkish ?? "").trim();

                  return (
                    <tr key={english}>
                      <td className="px-3 py-3 align-top text-slate-700 dark:text-slate-200">
                        <div className="font-medium">{english}</div>
                      </td>
                      <td className="px-3 py-3">
                        <textarea
                          rows={2}
                          value={current}
                          onChange={(event) =>
                            setValues((prev) => ({
                              ...prev,
                              [english]: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                        />
                        {row.turkish ? (
                          <div className="mt-1 text-xs text-slate-400">
                            {t("baseLabel")}: {row.turkish}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleSave(row)}
                            disabled={busy || !dirty}
                            className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
                          >
                            {busy ? t("actions.saving") : t("actions.save")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReset(row)}
                            disabled={busy || !canReset}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                          >
                            {t("actions.reset")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
