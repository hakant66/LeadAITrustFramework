// apps/web/src/app/aireadinesscheck/page.tsx
"use client";

import { useEffect, useState } from "react";
import { enablers } from "./seed/enablers";
import Results from "./ui/Results";
import Enabler, { ThemePair } from "./ui/Enabler";
import Header from "./ui/Header";

type TotalsRow = { name: string; sum: number; readiness: number; status: string };

export default function AIReadinessCheckPage() {
  const [page, setPage] = useState(0);

  // one {blue,orange} per theme
  const initial = Object.fromEntries(
    enablers.map((e) => [
      e.name,
      e.themes.map<ThemePair>(() => ({ blue: 0, orange: 0 })),
    ])
  );
  const [scores, setScores] = useState<Record<string, ThemePair[]>>(initial);

  // shared links remain the same
  const [shared, setShared] = useState<null | { totals: TotalsRow[]; avg: number }>(
    null
  );

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("results");
    if (!encoded) return;
    try {
      const parsed = JSON.parse(atob(encoded));
      if (parsed?.totals && typeof parsed?.avg === "number") setShared(parsed);
    } catch {
      // ignore malformed links
    }
  }, []);

  const totalsFromState = (): TotalsRow[] =>
    enablers.map((e) => {
      const themePairs = scores[e.name] || [];
      const sum = themePairs.reduce(
        (acc, p) => acc + (p.blue + p.orange),
        0
      ); // net per theme
      const readiness = Math.round(((sum + 6) / 12) * 100); // –6..+6 → 0..100
      const status =
        readiness < 25
          ? "Critical"
          : readiness < 50
          ? "At Risk"
          : readiness < 75
          ? "Established"
          : "Leading";
      return { name: e.name, sum, readiness, status };
    });

  const computeAvg = (totals: TotalsRow[]) =>
    Math.round(
      totals.reduce((a, t) => a + t.readiness, 0) / Math.max(1, totals.length)
    );

  // --- Shared results view ---
  if (shared) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
        <div className="max-w-5xl mx-auto p-6 space-y-6 text-gray-900 dark:text-slate-100">
          <Header />
          <Results
            enablers={enablers}
            getTotals={() => shared.totals}
            getAvg={() => shared.avg}
            mode="shared"
            onRestart={() => {
              window.location.href = "/aireadinesscheck";
            }}
          />
        </div>
      </main>
    );
  }

  // --- Completed flow view ---
  if (page >= enablers.length) {
    const totals = totalsFromState();
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
        <div className="max-w-5xl mx-auto p-6 space-y-6 text-gray-900 dark:text-slate-100">
          <Header />
          <Results
            enablers={enablers}
            getTotals={() => totals}
            getAvg={() => computeAvg(totals)}
            onRestart={() => setPage(0)}
          />
        </div>
      </main>
    );
  }

  // --- Question pages ---
  const enabler = enablers[page];

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto p-6 space-y-6 text-gray-900 dark:text-slate-100">
        <Header />

        <div className="text-sm text-slate-500 dark:text-slate-400">
          Category {page + 1} of {enablers.length} • {enabler.name}
        </div>

        <Enabler
          enabler={enabler}
          values={scores[enabler.name]}
          onChange={(i, v) =>
            setScores((s) => ({
              ...s,
              [enabler.name]: s[enabler.name].map((x, idx) =>
                idx === i ? v : x
              ),
            }))
          }
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          isFirst={page === 0}
          isLast={page === enablers.length - 1}
        />
      </div>
    </main>
  );
}
