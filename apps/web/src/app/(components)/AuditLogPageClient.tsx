"use client";

import { useEffect, useState } from "react";

import Header from "@/app/(components)/Header";
import type { NavMode } from "@/lib/navMode";

type AuditEvent = {
  id: string;
  event_type: string;
  actor?: string | null;
  actor_type?: string | null;
  source_service?: string | null;
  object_type?: string | null;
  object_id?: string | null;
  project_slug?: string | null;
  details?: any;
  hash?: string | null;
  hash_prev?: string | null;
  created_at?: string | null;
};

export default function AuditLogPageClient({
  navMode,
}: {
  navMode?: NavMode;
}) {
  const subtitle = navMode === "legacy" ? "LeadAI · TrustOps" : "Control & Audit";
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [eventType, setEventType] = useState("");
  const [actor, setActor] = useState("");
  const [objectQuery, setObjectQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (eventType) params.set("event_type", eventType);
      if (actor) params.set("actor", actor);
      if (objectQuery) params.set("q", objectQuery);
      const res = await fetch(`/api/core/audit/events?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to load (${res.status})`);
      }
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number.isFinite(data?.total) ? data.total : 0);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, [limit, offset, eventType, actor, objectQuery]);

  const formatDate = (value?: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    if (isNaN(+d)) return value;
    return d.toLocaleString();
  };

  const shortHash = (value?: string | null) => {
    if (!value) return "—";
    return `${value.slice(0, 10)}…`;
  };

  const prettyJson = (value: any) => {
    if (!value) return "";
    try {
      if (typeof value === "string") {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
      }
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const toTitle = (value: string) =>
    value
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (m) => m.toUpperCase());

  const eventMessage = (row: AuditEvent) => {
    const detail = row.details ?? {};
    const name =
      detail?.name ??
      detail?.title ??
      detail?.policy_title ??
      detail?.uc_id ??
      row.object_id ??
      "item";
    const type = row.object_type ? toTitle(row.object_type) : "Item";
    const actor = row.actor ?? "system";
    const project = row.project_slug ? ` in ${row.project_slug}` : "";
    switch (row.event_type) {
      case "ai_system_created":
        return `AI system created: ${name}${project} by ${actor}`;
      case "ai_system_updated":
        return `AI system updated: ${name}${project} by ${actor}`;
      case "ai_system_retired":
        return `AI system retired: ${name}${project} by ${actor}`;
      case "policy_created":
        return `Policy created: ${name}${project} by ${actor}`;
      case "policy_status_updated":
        return `Policy status updated: ${name}${project} by ${actor}`;
      case "policy_version_created":
        return `Policy version created: ${name}${project} by ${actor}`;
      case "policy_version_status_updated":
        return `Policy version status updated: ${name}${project} by ${actor}`;
      case "aims_scope_saved":
        return `Scope updated${project} by ${actor}`;
      case "requirement_created":
        return `Requirement created: ${name}${project} by ${actor}`;
      case "requirement_updated":
        return `Requirement updated: ${name}${project} by ${actor}`;
      case "evidence_uploaded":
        return `Evidence uploaded: ${name}${project} by ${actor}`;
      case "evidence_status_updated":
        return `Evidence status updated: ${name}${project} by ${actor}`;
      case "trust_evaluated":
        return `Trust evaluated${project} by ${actor}`;
      default:
        return `${type} event: ${toTitle(row.event_type)}${project} by ${actor}`;
    }
  };

  const eventAction = (row: AuditEvent) => toTitle(row.event_type);

  const eventEntity = (row: AuditEvent) => {
    const detail = row.details ?? {};
    const name =
      detail?.name ??
      detail?.title ??
      detail?.policy_title ??
      detail?.uc_id ??
      row.object_id ??
      "—";
    const type = row.object_type ? toTitle(row.object_type) : "Entity";
    return `${type}: ${name}`;
  };

  const page = Math.floor(offset / limit) + 1;
  const pageCount = limit ? Math.ceil(total / limit) : 1;

  return (
    <div className="space-y-6">
      <Header title="Audit Log" subtitle={subtitle} />
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 dark:border-slate-700 dark:bg-slate-800">
          Immutable trust events
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 dark:border-slate-700 dark:bg-slate-800">
          Actor attribution
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 dark:border-slate-700 dark:bg-slate-800">
          Hash references
        </span>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            Immutable audit stream
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Events are hash-chained to provide tamper-evident history.
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Event type
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="trust_evaluated"
            />
          </label>
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Actor
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="system, user"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Search hash / object
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder="object id or hash"
              value={objectQuery}
              onChange={(e) => setObjectQuery(e.target.value)}
            />
          </label>
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Page size
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} rows
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/60 dark:bg-red-900/40 dark:text-red-100">
            {error}
          </div>
        )}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              <tr>
                <th className="p-2 text-left">Action</th>
                <th className="p-2 text-left">Entity</th>
                <th className="p-2 text-left">Actor</th>
                <th className="p-2 text-left">Project</th>
                <th className="p-2 text-left">Timestamp</th>
                <th className="p-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="p-3 text-sm text-slate-500 dark:text-slate-400" colSpan={6}>
                    Loading events…
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr className="border-b border-slate-100 dark:border-slate-700/70">
                  <td className="p-3 text-sm text-slate-500 dark:text-slate-400" colSpan={6}>
                    No audit events yet.
                  </td>
                </tr>
              )}
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 dark:border-slate-700/70"
                >
                  <td className="p-2">
                    <div className="text-sm font-semibold">
                      {eventAction(row)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {eventMessage(row)}
                    </div>
                  </td>
                  <td className="p-2">{eventEntity(row)}</td>
                  <td className="p-2">
                    {row.actor ?? "—"}
                    {row.source_service ? (
                      <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {row.source_service}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2">{row.project_slug ?? "—"}</td>
                  <td className="p-2">{formatDate(row.created_at)}</td>
                  <td className="p-2 text-xs">
                    <details className="group">
                      <summary className="cursor-pointer text-indigo-600 hover:underline dark:text-indigo-300">
                        View JSON
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                        {prettyJson(row.details)}
                      </pre>
                      <div className="mt-2 text-[10px] text-slate-500">
                        Hash: {row.hash ?? "—"} • Prev: {row.hash_prev ?? "—"}
                      </div>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Page {page} of {pageCount || 1} • {total} events
          </span>
          <div className="flex items-center gap-2">
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Prev
            </button>
            <button
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
