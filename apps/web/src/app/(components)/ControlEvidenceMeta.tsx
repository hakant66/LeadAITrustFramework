// apps/web/src/app/(components)/ControlEvidenceMeta.tsx
"use client";

import { useEffect, useState } from "react";
import { coreApiBase } from "@/lib/coreApiBase";

type ControlExecRow = {
  control_id: string;
  kpi_key?: string | null;
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
  target_text?: string | null;
  unit?: string | null;
  evidence_source?: string | null;
  forward_request?: boolean | null;
  forward_email?: string | null;
  comment_text?: string | null;
};

type Props = {
  projectId: string;
  kpiKey: string;
  entityId: string;
};

function formatValue(value?: string | null): string {
  if (!value) return "—";
  return value;
}

export default function ControlEvidenceMeta({ projectId, kpiKey, entityId }: Props) {
  const CORE = coreApiBase();
  const [row, setRow] = useState<ControlExecRow | null>(null);
  const [forwardRequest, setForwardRequest] = useState(false);
  const [forwardEmail, setForwardEmail] = useState("");
  const [dueDateValue, setDueDateValue] = useState<string>("");
  const [commentText, setCommentText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  useEffect(() => {
    if (!projectId || !entityId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${CORE}/admin/projects/${encodeURIComponent(projectId)}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error("Failed to load control details.");
        }
        const data = await res.json();
        const items: ControlExecRow[] = Array.isArray(data?.items) ? data.items : [];
        const match = items.find((item) => (item.kpi_key ?? "") === kpiKey) ?? null;
        setRow(match);
        setForwardRequest(Boolean(match?.forward_request));
        setForwardEmail(match?.forward_email ?? "");
        setDueDateValue(match?.due_date ? String(match.due_date).slice(0, 10) : "");
        setCommentText(match?.comment_text ?? "");
      } catch (err) {
        console.error(err);
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [CORE, projectId, entityId, kpiKey]);

  const handleSave = async (): Promise<boolean> => {
    if (!row) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    if (forwardRequest && !forwardEmail.trim()) {
      setSaving(false);
      setError("Forward email is required when forwarding is enabled.");
      return false;
    }

    const dueDatePayload = dueDateValue || null;

    const payload = {
      items: [
        {
          control_id: row.control_id,
          kpi_key: row.kpi_key ?? kpiKey,
          owner_role: row.owner_role,
          designated_owner_name: row.designated_owner_name,
          designated_owner_email: row.designated_owner_email,
          due_date: dueDatePayload,
          frequency: row.frequency,
          reminder_day: row.reminder_day,
          reminder_count: row.reminder_count,
          designated_owner_manager: row.designated_owner_manager,
          designated_owner_manager_email: row.designated_owner_manager_email,
          provide_url: row.provide_url,
          forward_request: forwardRequest,
          forward_email: forwardEmail.trim() || null,
          comment_text: commentText.trim() || null,
        },
      ],
    };

    try {
      const res = await fetch(
        `${CORE}/admin/projects/${encodeURIComponent(projectId)}/control-values-exec?entity_id=${encodeURIComponent(entityId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Update failed.");
      }
      setNotice("Saved. Forward settings updated.");
      return true;
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const buildEmailContent = () => {
    const toEmail = forwardEmail.trim() || "—";
    const targetParts = [row?.target_text, row?.unit].filter((v) => v && String(v).trim().length);
    const targetDisplay = targetParts.length ? targetParts.join(" ") : "—";
    const lines = [
      "Hello,",
      "",
      "You have a new control task assigned in LeadAI.",
      "",
      `Project: ${projectId}`,
      `KPI: ${kpiKey}`,
      `Control ID: ${row?.control_id ?? "—"}`,
      `Evidence Source: ${row?.evidence_source ?? "—"}`,
      `Target: ${targetDisplay}`,
      `Due Date: ${dueDateValue || "—"}`,
    ];
    if (commentText.trim()) {
      lines.push("", `Comment: ${commentText.trim()}`);
    }
    lines.push("", `To: ${toEmail}`);
    return lines.join("\n");
  };

  const canSend = forwardRequest && Boolean(forwardEmail.trim());

  const handleSendEmail = async () => {
    if (!row || !canSend) return;
    setSending(true);
    setError(null);
    setNotice(null);
    const saved = await handleSave();
    if (!saved) {
      setSending(false);
      return;
    }
    try {
      const res = await fetch(
        `${CORE}/admin/projects/${encodeURIComponent(projectId)}/control-values-exec/forward-email?entity_id=${encodeURIComponent(entityId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ control_id: row.control_id }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to send email.");
      }
      setNotice("Email sent.");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-2xl p-4 bg-white dark:bg-slate-900 shadow-sm">
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Control Context
      </div>
      {loading ? (
        <div className="text-sm text-slate-500 dark:text-slate-300 mt-2">
          Loading control details...
        </div>
      ) : row ? (
        <div className="mt-3 space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Evidence Source
              </div>
              <div className="text-sm text-slate-900 dark:text-slate-100 mt-1">
                {formatValue(row.evidence_source)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Target
              </div>
              <div className="text-sm text-slate-900 dark:text-slate-100 mt-1">
                {(() => {
                  const parts = [row.target_text, row.unit].filter(
                    (v) => v && String(v).trim().length
                  );
                  return parts.length ? parts.join(" ") : "—";
                })()}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                Due Date
              </div>
              <input
                type="date"
                value={dueDateValue}
                onChange={(e) => setDueDateValue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500">
                Comment (max 400 chars)
              </label>
              <textarea
                value={commentText}
                maxLength={400}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
                placeholder="Add a short comment..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={forwardRequest}
                onChange={(e) => setForwardRequest(e.target.checked)}
              />
              Forward the Request
            </label>
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500">
                Forward to Email
              </label>
              <input
                type="email"
                value={forwardEmail}
                onChange={(e) => setForwardEmail(e.target.value)}
                placeholder="forward@example.com"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          {(notice || error) && (
            <div
              className={`text-sm ${error ? "text-red-600" : "text-emerald-600"}`}
            >
              {error ?? notice}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center h-9 px-4 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="inline-flex items-center h-9 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              Show Email Content
            </button>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={!canSend || sending}
              className="inline-flex items-center h-9 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
            >
              {sending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-500 dark:text-slate-300 mt-2">
          No control details found for this KPI.
        </div>
      )}

      {showEmail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                Email Preview
              </div>
              <button
                type="button"
                onClick={() => setShowEmail(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
              {buildEmailContent()}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
