"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function FinalizePolicyRegisterButton({
  entityId,
  entitySlug,
}: {
  entityId: string;
  entitySlug?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const [finalisedAt, setFinalisedAt] = useState<string | null>(null);
  const [finalisedStatus, setFinalisedStatus] = useState<"pending" | "finalised">("pending");
  const redirectTarget = entitySlug
    ? `/${encodeURIComponent(entitySlug)}/scorecard/admin/governance-setup`
    : "/scorecard/admin/governance-setup";

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const res = await fetch(
          `/api/core/admin/policies/finalize-status?entity_id=${encodeURIComponent(entityId)}`
        );
        if (!res.ok) return;
        const body = (await res.json()) as { status?: string; finalized_at?: string | null };
        if (body.status === "finalised") {
          setFinalisedStatus("finalised");
          setFinalisedAt(body.finalized_at ?? null);
        }
      } catch {
        // ignore status load errors
      }
    };
    loadStatus();
  }, [entityId]);

  useEffect(() => {
    if (status !== "success") return;
    const timer = window.setTimeout(() => {
      router.push(redirectTarget);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [redirectTarget, router, status]);

  const handleFinalize = async () => {
    if (!entityId) return;
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch(
        `/api/core/admin/policies/finalize?entity_id=${encodeURIComponent(entityId)}`,
        {
          method: "POST",
        }
      );
      if (!res.ok) {
        const text = await res.text();
        let detail = text;
        try {
          const parsed = JSON.parse(text) as { detail?: string };
          detail = parsed.detail || text;
        } catch {
          // ignore
        }
        throw new Error(detail || "Finalize failed");
      }
      const body = (await res.json()) as { saved?: number };
      setStatus("success");
      setMessage(
        `Finalised governance setup for ${entitySlug ?? "this entity"}. Saved ${body.saved ?? 0} active policies.`
      );
      setFinalisedStatus("finalised");
      setFinalisedAt(new Date().toISOString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Finalize failed";
      setStatus("error");
      setMessage(msg);
    }
  };

  return (
    <div className="flex w-full flex-col items-end gap-2">
      {finalisedStatus === "finalised" && (
        <div className="self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/20 dark:text-emerald-200">
          AI Governance Setup Finalised{finalisedAt ? ` · ${finalisedAt.split("T")[0]}` : ""}
        </div>
      )}
      <button
        type="button"
        onClick={handleFinalize}
        disabled={status === "saving"}
        className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
      >
        {status === "saving"
          ? "Finalising..."
          : "Next Step: Save & Finalise AI Governance Setup"}
      </button>
      {message && (
        <p
          className={`text-xs ${
            status === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-emerald-600 dark:text-emerald-300"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
