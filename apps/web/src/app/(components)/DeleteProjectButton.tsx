// src/app/(components)/DeleteProjectButton.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import clsx from "clsx";

type Props = {
  projectId: string;                 // the slug (e.g. "hr-ai-project-1")
  className?: string;                // optional styling from parent
  label?: string;                    // button label override (default: "Delete")
};


/**
 * Renders a red "Delete project" button.
 * On click, shows a confirmation modal. If confirmed, calls:
 *   DELETE /api/projects/[slug]
 * and on success navigates back to /scorecard.
 */
export default function DeleteProjectButton({ projectSlug, className }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    // Close on ESC
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open && !busy) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  async function onConfirm() {
    setBusy(true);
    setErr(null);
    const ac = new AbortController();

    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        signal: ac.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Delete failed (${res.status})`);
      }

      // Optional: tiny delay to let user see success state
      await new Promise((r) => setTimeout(r, 300));

      // Navigate back to the projects list
      router.push("/scorecard");
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        className={clsx(
          "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border",
          "bg-white/10 hover:bg-white/15 text-white border-white/25",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        title="Delete this project"
      >
        <Trash2 className="size-4" />
        Delete
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={() => !busy && setOpen(false)}
          />

          {/* Card */}
          <div className="relative z-[61] w-full max-w-md mx-4 rounded-2xl border bg-white shadow-2xl">
            <div className="p-5">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center justify-center rounded-lg bg-rose-100 p-2">
                  <Trash2 className="size-5 text-rose-600" />
                </div>
                <h2 className="text-lg font-semibold">Delete project?</h2>
              </div>

              <p className="mt-3 text-sm text-gray-600">
                You’re about to permanently delete <span className="font-medium">{projectSlug}</span> and all related
                records (pillars, KPI values, overrides). This action cannot be undone.
              </p>

              {err && (
                <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {err}
                </div>
              )}

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  ref={closeBtnRef}
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 rounded-lg border bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={busy}
                  className={clsx(
                    "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-white",
                    "bg-rose-600 hover:bg-rose-700",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {busy ? (
                    <>
                      <Spinner /> Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="size-4" />
                      Yes, delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Spinner() {
  return (
    <svg
      className="size-4 animate-spin"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
