// src/app/aireadinesscheck/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "../ui/Header";

type ResultRow = {
  id: string;
  slug: string;
  avg: number;
  user_name: string | null;
  user_email: string | null;
  company: string | null;
  created_at: string; // ISO string
};

type ApiResponse = {
  results: ResultRow[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export default function AiReadinessAdminPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages =
    data && data.totalCount > 0
      ? Math.ceil(data.totalCount / data.pageSize)
      : 1;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `/api/ai-readiness-results?page=${page}&pageSize=${pageSize}`
        );

        if (!res.ok) {
          const text = await res.text();
          console.error("Admin GET /api/ai-readiness-results failed:", text);
          setError("Failed to load results");
          return;
        }

        const json = (await res.json()) as ApiResponse;
        setData(json);
      } catch (err) {
        console.error("Error fetching admin results", err);
        setError("Failed to load results");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [page, pageSize]);

  const handlePrev = () => {
    setPage((p) => Math.max(1, p - 1));
  };

  const handleNext = () => {
    if (!data) return;
    if (page < totalPages) setPage((p) => p + 1);
  };

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8 text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <Header />

        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              AI Readiness – Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Overview of all completed AI Readiness Checks stored in{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] dark:bg-slate-800">
                ai_readiness_results
              </code>
              .
            </p>
          </div>
          <Link
            href="/aireadinesscheck"
            className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Back to questionnaire
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          {loading && (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading results…
            </div>
          )}

          {error && !loading && (
            <div className="py-6 text-center text-sm text-rose-500">
              {error}
            </div>
          )}

          {!loading && !error && data && data.results.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No results found yet.
            </div>
          )}

          {!loading && !error && data && data.results.length > 0 && (
            <>
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Total results:{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {data.totalCount}
                  </span>
                </span>
                <span>
                  Page {data.page} of {totalPages}
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Date</th>
                      <th className="px-4 py-2 font-semibold">Name</th>
                      <th className="px-4 py-2 font-semibold">Email</th>
                      <th className="px-4 py-2 font-semibold">Company</th>
                      <th className="px-4 py-2 font-semibold">Avg %</th>
                      <th className="px-4 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.results.map((row) => {
                      const created = new Date(row.created_at);
                      const dateStr = created.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      });
                      const timeStr = created.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      return (
                        <tr
                          key={row.id}
                          className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
                        >
                          <td className="px-4 py-2 align-top text-[11px] text-slate-600 dark:text-slate-300">
                            <div>{dateStr}</div>
                            <div className="text-[10px] text-slate-400">
                              {timeStr}
                            </div>
                          </td>
                          <td className="px-4 py-2 align-top text-[11px]">
                            {row.user_name || "-"}
                          </td>
                          <td className="px-4 py-2 align-top text-[11px] text-slate-600 dark:text-slate-300">
                            {row.user_email || "-"}
                          </td>
                          <td className="px-4 py-2 align-top text-[11px] text-slate-600 dark:text-slate-300">
                            {row.company || "-"}
                          </td>
                          <td className="px-4 py-2 align-top text-[11px]">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                              {row.avg}%
                            </span>
                          </td>
                          <td className="px-4 py-2 align-top text-[11px]">
                            <div className="flex flex-wrap gap-2">
                              <Link
                                href={`/aireadinesscheck/r/${row.slug}`}
                                target="_blank"
                                className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-medium text-white transition hover:bg-indigo-500"
                              >
                                View PDF
                              </Link>
                              {/* if you ever want, you can add a "details" page here */}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={page <= 1}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Previous
                </button>
                <span>
                  Showing {(page - 1) * data.pageSize + 1}–
                  {Math.min(page * data.pageSize, data.totalCount)} of{" "}
                  {data.totalCount}
                </span>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={page >= totalPages}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
