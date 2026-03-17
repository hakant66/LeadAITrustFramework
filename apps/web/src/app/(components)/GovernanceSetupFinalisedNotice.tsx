"use client";

import { useEffect, useState } from "react";

export default function GovernanceSetupFinalisedNotice({
  entitySlug,
}: {
  entitySlug: string;
}) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!entitySlug) return;
    const stored = window.localStorage.getItem(`governance-setup-finalised:${entitySlug}`);
    if (stored) {
      setMessage(stored);
    }
  }, [entitySlug]);

  if (!message) return null;

  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1) {
    return <div className="text-sm font-medium text-emerald-600">{message}</div>;
  }

  const timestamp = lines[lines.length - 1];
  const bodyLines = lines.slice(0, -1);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900 shadow-sm dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-100">
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
        Governance Finalisation Summary
      </div>
      <div className="mt-2 space-y-2">
        {bodyLines.map((line, idx) => (
          <div key={`${idx}-${line}`} className="flex items-start gap-2">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>{line}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-emerald-200/80 pt-2 text-xs text-emerald-700 dark:border-emerald-700/50 dark:text-emerald-300">
        {timestamp}
      </div>
    </div>
  );
}
