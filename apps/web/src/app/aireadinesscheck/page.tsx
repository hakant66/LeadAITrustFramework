// app/aireadinesscheck/page.tsx
"use client";

import {
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { enablers } from "./seed/enablers";
import Results from "./ui/Results";
import Enabler, { type StageScore } from "./ui/Enabler";
import Header from "./ui/Header";
import { ThemeProvider } from "../theme-provider";

type TotalsRow = { name: string; sum: number; readiness: number; status: string };

type UserInfo = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
};

type AnswerSummary = {
  enablerName: string;
  questions: {
    title: string;
    left: string;
    right: string;
    selectionLabel: string;
    selectionText: string;
  }[];
};

function createInitialScores(): Record<string, StageScore[]> {
  return Object.fromEntries(
    enablers.map((e) => [e.name, e.themes.map<StageScore>(() => 2)])
  ) as Record<string, StageScore[]>;
}

// Map numeric score to an intensity label such as "Always true" / "Sometimes true"
function intensityLabelForScore(score: StageScore): string {
  switch (score) {
    case 0:
    case 4:
      return "Always true";
    case 1:
    case 3:
      return "Sometimes true";
    case 2:
    default:
      return "Neutral / Don’t know";
  }
}

// Build a text summary of all answers (used by PDFs and for server storage)
function buildAnswerSummary(
  scores: Record<string, StageScore[]>
): AnswerSummary[] {
  return enablers.map((enabler) => {
    const themeScores = scores[enabler.name] ?? [];
    const questions = enabler.themes.map((theme, idx) => {
      const rawScore = themeScores[idx];
      const score = (typeof rawScore === "number" ? rawScore : 2) as StageScore;

      let alignment: "left" | "right" | "neutral" = "neutral";
      if (score <= 1) alignment = "left";
      else if (score >= 3) alignment = "right";

      const intensity = intensityLabelForScore(score);

      let selectionLabel: string;
      let selectionText: string;

      if (alignment === "left") {
        selectionLabel = `Closer to the left-hand statement — ${intensity}`;
        selectionText = theme.blue;
      } else if (alignment === "right") {
        selectionLabel = `Closer to the right-hand statement — ${intensity}`;
        selectionText = theme.orange;
      } else {
        selectionLabel = `Neutral between the two statements — ${intensity}`;
        selectionText =
          "You indicated a neutral position between the two statements.";
      }

      return {
        title: theme.title,
        left: theme.blue,
        right: theme.orange,
        selectionLabel,
        selectionText,
      };
    });

    return {
      enablerName: enabler.name,
      questions,
    };
  });
}

export default function AIReadinessCheckPage() {
  // page:
  //   0..enablers.length-1   => question pages
  //   enablers.length        => review answers
  //   enablers.length + 1    => results
  const [page, setPage] = useState(0);

  const [hasStarted, setHasStarted] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo>({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
  });

  const [scores, setScores] = useState<Record<string, StageScore[]>>(
    () => createInitialScores()
  );

  const [shared, setShared] = useState<null | { totals: TotalsRow[]; avg: number }>(
    null
  );

  // Time when user goes from "Review answers" -> "Results"
  const [completedAt, setCompletedAt] = useState<Date | null>(null);

  // Slug returned from the API, used to build short URL (/aireadinesscheck/r/[slug])
  const [shareSlug, setShareSlug] = useState<string | null>(null);

  // For "Share the survey" on intro card
  const [introCopied, setIntroCopied] = useState(false);

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("results");
    if (!encoded) return;
    try {
      const parsed = JSON.parse(atob(encoded));
      if (parsed?.totals && typeof parsed?.avg === "number") {
        const timer = window.setTimeout(() => setShared(parsed), 0);
        return () => window.clearTimeout(timer);
      }
    } catch {
      // ignore malformed query param
    }
  }, []);

  // REVERSED SCORING
  // 0,1,2,3,4 -> 4,3,2,1,0 for scoring
  // Not answered defaults to 2 (neutral)
  const totalsFromState = (): TotalsRow[] =>
    enablers.map((e) => {
      // Ensure every theme has a score, defaulting to 2 (neutral)
      const themeScores: StageScore[] = e.themes.map((_, idx) => {
        const s = scores[e.name]?.[idx];
        return (typeof s === "number" ? s : 2) as StageScore;
      });

      const rawSum = themeScores.reduce<number>((acc, stage) => {
        // flip: flipped = 4 - stage, then centre around 0:
        // normalized = flipped - 2 = 2 - stage
        const normalized = 2 - stage;
        return acc + normalized;
      }, 0);

      // Max absolute value for this enabler (2 points either side per theme)
      const maxAbs = Math.max(1, themeScores.length * 2);

      // Normalize -maxAbs..+maxAbs to 0..100
      const readiness = Math.round(((rawSum + maxAbs) / (2 * maxAbs)) * 100);

      const status =
        readiness < 25
          ? "Critical"
          : readiness < 50
          ? "At Risk"
          : readiness < 75
          ? "Established"
          : "Leading";

      return { name: e.name, sum: rawSum, readiness, status };
    });

  const computeAvg = (totals: TotalsRow[]) =>
    Math.round(
      totals.reduce((a, t) => a + t.readiness, 0) / Math.max(1, totals.length)
    );

  const pageShell = (content: ReactNode) => (
    <ThemeProvider>
      <div className="min-h-screen bg-[var(--background)] px-4 py-8 text-slate-900 transition dark:text-slate-100">
        <div className="mx-auto max-w-5xl space-y-6">{content}</div>
      </div>
    </ThemeProvider>
  );

  // Shared-link (read-only) mode (legacy ?results= link)
  if (shared) {
    return pageShell(
      <>
        <Header />
        <Results
          enablers={enablers}
          getTotals={() => shared.totals}
          getAvg={() => shared.avg}
          mode="shared"
          onRestart={() => (window.location.href = "/aireadinesscheck")}
        />
      </>
    );
  }

  // Persist results + server PDF on backend
  async function persistResultsOnServer() {
    const totals = totalsFromState();
    const avg = computeAvg(totals);
    const answers = buildAnswerSummary(scores);

    // We use the same completion time both client & server side
    const completed = new Date();
    setCompletedAt(completed);

    try {
      const res = await fetch("/api/ai-readiness-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totals,
          avg,
          userInfo,
          answers,
          createdAt: completed.toISOString(), // send same timestamp we use on client
        }),
      });

      if (!res.ok) {
        console.error(
          "Failed to persist AI readiness results",
          await res.text()
        );
        return;
      }

      const data = await res.json();
      if (data?.slug) {
        setShareSlug(data.slug);
      }
    } catch (err) {
      console.error("Error calling /api/ai-readiness-results", err);
    }
  }

  // INTRO FORM (Name, Surname, Email, Company)
  const handleStart = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHasStarted(true);
    setPage(0);
  };

  // Share the survey (intro card) – share/copy current /aireadinesscheck URL
  const handleIntroShare = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/aireadinesscheck`;

    try {
      if (navigator.share) {
        await navigator.share({
          url,
          title: "LeadAI – AI Readiness Check",
          text: "Take the LeadAI – AI Readiness Check survey.",
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setIntroCopied(true);
        setTimeout(() => setIntroCopied(false), 2500);
      } else {
        // Fallback: open mail client
        const subject = encodeURIComponent("LeadAI – AI Readiness Check");
        const body = encodeURIComponent(
          `You can take the AI Readiness Check here:\n\n${url}`
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      }
    } catch {
      // ignore errors
    }
  };

  const isIntroValid =
    userInfo.firstName.trim() &&
    userInfo.lastName.trim() &&
    userInfo.email.trim();

  if (!hasStarted) {
    return pageShell(
      <>
        <Header />
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900/80">
          {/* Header row with title/description on left and "Share the survey" on right */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                Before we start your AI Readiness Check
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Please share a few details so we can personalise your results and, if
                needed, follow up with a summary.
              </p>
            </div>

            <button
              type="button"
              onClick={handleIntroShare}
              className="mt-1 inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {introCopied ? "Link copied" : "Share the survey"}
            </button>
          </div>

          <form onSubmit={handleStart} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Name
                </label>
                <input
                  type="text"
                  autoComplete="given-name"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={userInfo.firstName}
                  onChange={(e) =>
                    setUserInfo((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Surname
                </label>
                <input
                  type="text"
                  autoComplete="family-name"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={userInfo.lastName}
                  onChange={(e) =>
                    setUserInfo((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={userInfo.email}
                  onChange={(e) =>
                    setUserInfo((prev) => ({ ...prev, email: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Company
                </label>
                <input
                  type="text"
                  autoComplete="organization"
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  value={userInfo.company}
                  onChange={(e) =>
                    setUserInfo((prev) => ({ ...prev, company: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                We&apos;ll only use this information in connection with this
                assessment.
              </p>
              <button
                type="submit"
                disabled={!isIntroValid}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Start questionnaire
              </button>
            </div>
          </form>
        </div>
      </>
    );
  }

  // REVIEW ANSWERS PAGE (after last category, before results)
  if (page === enablers.length) {
    return pageShell(
      <>
        <Header />

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Review your answers
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Here&apos;s a summary of the selections you made for each question.
            You can go back to adjust any category, or continue to view your AI
            Readiness scores.
          </p>

          <div className="mt-5 space-y-4">
            {enablers.map((enabler) => {
              const themeScores = scores[enabler.name] ?? [];
              return (
                <div
                  key={enabler.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm dark:border-slate-700 dark:bg-slate-900/70"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {enabler.name}
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {enabler.themes.map((theme, idx) => {
                      const rawScore = themeScores[idx];
                      const score = (typeof rawScore === "number"
                        ? rawScore
                        : 2) as StageScore;

                      let alignment: "left" | "right" | "neutral" = "neutral";
                      if (score <= 1) alignment = "left";
                      else if (score >= 3) alignment = "right";

                      const intensity = intensityLabelForScore(score);

                      let selectionLabel: string;
                      let selectionText: string;

                      if (alignment === "left") {
                        selectionLabel = "Closer to the left-hand statement";
                        selectionText = theme.blue;
                      } else if (alignment === "right") {
                        selectionLabel = "Closer to the right-hand statement";
                        selectionText = theme.orange;
                      } else {
                        selectionLabel =
                          "Neutral between the two statements";
                        selectionText =
                          "You indicated a neutral position between the two statements.";
                      }

                      return (
                        <div
                          key={theme.title}
                          className="rounded-xl bg-white/80 p-3 dark:bg-slate-950/60"
                        >
                          {/* QUESTION TITLE CENTERED */}
                          <div className="mt-1 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {theme.title}
                          </div>

                          <div className="mt-3 grid gap-3 text-[11px] text-slate-600 dark:text-slate-300 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.1fr)]">
                            <div>
                              <span className="block font-semibold text-sky-700 dark:text-sky-300">
                                Left statement
                              </span>
                              <span>{theme.blue}</span>
                            </div>

                            <div className="rounded-lg bg-indigo-50/80 p-3 text-[11px] shadow-sm dark:bg-indigo-950/40">
                              <span className="block text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                                Your selection
                              </span>
                              <span className="mt-1 block font-semibold text-slate-900 dark:text-slate-100">
                                {selectionLabel} — {intensity}
                              </span>
                              <span className="mt-1 block text-slate-700 dark:text-slate-200">
                                {selectionText}
                              </span>
                            </div>

                            <div className="sm:text-right">
                              <span className="block font-semibold text-orange-700 dark:text-orange-300">
                                Right statement
                              </span>
                              <span>{theme.orange}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPage(enablers.length - 1)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Back to last category
            </button>

            <button
              type="button"
              onClick={async () => {
                await persistResultsOnServer(); // store in DB + MinIO
                setPage(enablers.length + 1);
              }}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-500"
            >
              Continue to results
            </button>
          </div>
        </div>
      </>
    );
  }

  // RESULTS PAGE (show user info + date/time + scores)
  if (page === enablers.length + 1) {
    const totals = totalsFromState();
    const answers = buildAnswerSummary(scores);

    return pageShell(
      <>
        <Header />

        {/* AI Readiness Check banner with company first */}
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-md dark:border-slate-700 dark:bg-slate-900/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                AI Readiness Check for
              </div>

              {userInfo.company ? (
                <>
                  {/* Company bigger */}
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    {userInfo.company}
                  </div>
                  {/* Name slightly smaller */}
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {userInfo.firstName} {userInfo.lastName}
                  </div>
                </>
              ) : (
                // Fallback if no company entered
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  {userInfo.firstName} {userInfo.lastName}
                </div>
              )}
            </div>

            <div className="space-y-1 text-right text-xs text-slate-500 dark:text-slate-400">
              {completedAt && (
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {completedAt.toLocaleDateString()}{" "}
                    {completedAt.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              <div>
                Email:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {userInfo.email}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Results
          enablers={enablers}
          getTotals={() => totals}
          getAvg={() => computeAvg(totals)}
          onRestart={() => {
            setPage(0);
            setHasStarted(false);
            setScores(createInitialScores());
            setUserInfo({
              firstName: "",
              lastName: "",
              email: "",
              company: "",
            });
            setCompletedAt(null);
            setShareSlug(null);
          }}
          userInfo={userInfo}
          completedAt={completedAt ?? undefined}
          answers={answers}
          shareSlug={shareSlug ?? undefined}
        />
      </>
    );
  }

  // QUESTION PAGES
  const enabler = enablers[page];

  return pageShell(
    <>
      <Header />
      <div className="text-sm text-slate-600 dark:text-slate-300">
        Category {page + 1} of {enablers.length} | {enabler.name}
      </div>

      <Enabler
        enabler={enabler}
        values={scores[enabler.name]}
        onChange={(i, value) =>
          setScores((prev) => {
            const current =
              prev[enabler.name] ?? enabler.themes.map<StageScore>(() => 2);
            const next = current.map((x, idx) =>
              idx === i ? value : x
            ) as StageScore[];
            return { ...prev, [enabler.name]: next };
          })
        }
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)} // last page -> review screen
        isFirst={page === 0}
        isLast={page === enablers.length - 1}
      />
    </>
  );
}
