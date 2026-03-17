"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/app/(components)/Header";
import { coreApiBase } from "@/lib/coreApiBase";
import { useTranslations } from "next-intl";
import {
  Loader2,
  Pencil,
  Archive,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

/** Map API error response to a user-friendly message. */
async function getApiErrorMessage(
  res: Response,
  fallback: string,
  accessDeniedMessage: string
): Promise<string> {
  const text = await res.text();
  if (res.status === 403) {
    try {
      const body = JSON.parse(text) as { detail?: string };
      const d = typeof body.detail === "string" ? body.detail : "";
      if (
        /master\s*admin\s*access\s*required/i.test(d) ||
        /master\s*admin\s*only/i.test(d)
      ) {
        return accessDeniedMessage;
      }
    } catch {
      // not JSON
    }
  }
  try {
    const body = JSON.parse(text) as { detail?: string };
    if (typeof body.detail === "string" && body.detail.trim())
      return body.detail.trim();
  } catch {
    // use raw text or fallback
  }
  return text.trim() || fallback;
}

type EntityRow = {
  id: string;
  full_legal_name: string;
  slug: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type UserEntity = {
  name: string;
  slug: string;
};

export default function MasterAdminEntitiesPage() {
  const t = useTranslations("MasterAdminPage");
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<EntityRow | null>(null);
  const [confirmSwitch, setConfirmSwitch] = useState<EntityRow | null>(null);
  const [currentEntitySlug, setCurrentEntitySlug] = useState<string | null>(null);
  const [currentEntityName, setCurrentEntityName] = useState<string | null>(null);
  const [userLabel, setUserLabel] = useState<string>("");
  const router = useRouter();

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsAccessDenied(false);
    try {
      const res = await fetch(`${coreApiBase()}/admin/master/entities`, {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) {
        const message = await getApiErrorMessage(
          res,
          t("errors.loadFailed"),
          t("errors.accessDenied")
        );
        setError(message);
        setIsAccessDenied(res.status === 403);
        setEntities([]);
        return;
      }
      const data = (await res.json()) as EntityRow[];
      setEntities(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errors.loadFailed")
      );
      setEntities([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  useEffect(() => {
    let cancelled = false;

    const loadHeaderContext = async () => {
      let slug = "";
      if (typeof window !== "undefined") {
        slug = (window.localStorage.getItem("leadai.nav.entity") || "").trim();
      }

      try {
        const userEntitiesRes = await fetch(`${coreApiBase()}/user/entities`, {
          cache: "no-store",
          credentials: "include",
        });
        if (userEntitiesRes.ok) {
          const userEntities = (await userEntitiesRes.json()) as UserEntity[];
          const selected =
            (slug && userEntities.find((entity) => entity.slug === slug)) ||
            userEntities[0] ||
            null;
          if (!cancelled && selected) {
            setCurrentEntitySlug(selected.slug);
            setCurrentEntityName(selected.name);
            if (typeof window !== "undefined") {
              window.localStorage.setItem("leadai.nav.entity", selected.slug);
            }
          }
        }
      } catch {
        // Ignore entity context errors in header.
      }

      try {
        const sessionRes = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "include",
        });
        if (!sessionRes.ok) return;
        const session = (await sessionRes.json()) as {
          user?: { name?: string | null; email?: string | null };
        };
        if (!cancelled) {
          setUserLabel(session?.user?.name || session?.user?.email || "");
        }
      } catch {
        // Ignore user label errors in header.
      }
    };

    void loadHeaderContext();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleArchive = async () => {
    if (!confirmArchive) return;
    setArchivingId(confirmArchive.id);
    setError(null);
    setIsAccessDenied(false);
    try {
      const res = await fetch(
        `${coreApiBase()}/admin/master/entities/${confirmArchive.id}/archive`,
        { method: "POST", credentials: "include" }
      );
      if (!res.ok) {
        const message = await getApiErrorMessage(
          res,
          t("errors.archiveFailed"),
          t("errors.accessDenied")
        );
        setError(message);
        setIsAccessDenied(res.status === 403);
        return;
      }
      setConfirmArchive(null);
      await fetchEntities();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("errors.archiveFailed")
      );
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Header
        title={t("title")}
        subtitle={t("subtitle")}
        entityName={currentEntityName}
      >
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() =>
              router.push(
                currentEntitySlug
                  ? `/${encodeURIComponent(currentEntitySlug)}/scorecard`
                  : "/scorecard"
              )
            }
            className="inline-flex items-center justify-center h-9 px-4 rounded-xl border border-white/50 bg-white/15 text-sm font-semibold text-white transition hover:bg-white/25"
          >
            Back
          </button>
          {userLabel ? (
            <div className="text-sm font-medium text-white/80">{userLabel}</div>
          ) : null}
        </div>
      </Header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t("allEntities")}
          </h2>
          <button
            type="button"
            onClick={() => fetchEntities()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            {t("refresh")}
          </button>
        </div>

        {error && (
          <div
            className={`mt-4 flex items-start gap-3 rounded-xl border p-4 ${
              isAccessDenied
                ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
                : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/50"
            }`}
          >
            {isAccessDenied ? (
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <div className="min-w-0 flex-1">
              <div
                className={`text-sm font-semibold ${
                  isAccessDenied
                    ? "text-amber-900 dark:text-amber-200"
                    : "text-red-900 dark:text-red-200"
                }`}
              >
                {isAccessDenied ? t("errors.accessRestrictedTitle") : t("errors.errorTitle")}
              </div>
              <div
                className={`mt-1 text-sm ${
                  isAccessDenied
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {error}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="mt-6 flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : error ? null : entities.length === 0 ? (
          <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
            {t("noEntities")}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {t("name")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {t("slug")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {t("status")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {t("updated")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    {t("actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                {entities.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {e.slug ? (
                        <button
                          type="button"
                          onClick={() => setConfirmSwitch(e)}
                          className="text-left text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          {e.full_legal_name}
                        </button>
                      ) : (
                        e.full_legal_name
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {e.slug ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {e.status ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {e.updated_at
                        ? new Date(e.updated_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {e.slug ? (
                          <Link
                            href={`/${e.slug}/scorecard/admin/governance-setup/entity-setup`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t("edit")}
                          </Link>
                        ) : (
                          <Link
                            href="/entitycapture"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {t("edit")}
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmArchive(e)}
                          disabled={!!archivingId}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/50"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          {t("archive")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmArchive && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h3
              id="archive-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {t("archiveConfirmTitle")}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {t("archiveConfirmMessage", {
                name: confirmArchive.full_legal_name,
              })}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmArchive(null)}
                disabled={!!archivingId}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={!!archivingId}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {archivingId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("archiving")}
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" />
                    {t("archive")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmSwitch && confirmSwitch.slug && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <h3
              id="switch-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {t("switchConfirmTitle")}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {t("switchConfirmMessage", { name: confirmSwitch.full_legal_name })}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmSwitch(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t("no")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("leadai.nav.entity", confirmSwitch.slug || "");
                  }
                  router.push(`/${encodeURIComponent(confirmSwitch.slug ?? "")}/scorecard/admin/governance-setup`);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                {t("yes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
