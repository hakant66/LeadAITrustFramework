"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/app/(components)/Header";
import CloseWindowButton from "@/app/(components)/CloseWindowButton";

export const dynamic = "force-dynamic";

type KpiKnowledgeRow = {
  kpi_key: string;
  kpi_name: string;
  description?: string | null;
  definition?: string | null;
  example?: string | null;
};

async function fetchJsonOk<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

export default function GlobalKpiDetailPage() {
  const params = useParams();
  const kpiKey = useMemo(() => {
    const value = params?.kpiKey;
    return Array.isArray(value) ? value[0] : value;
  }, [params]);

  const [data, setData] = useState<KpiKnowledgeRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!kpiKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchJsonOk<KpiKnowledgeRow>(
      `/api/core/admin/knowledgebase/kpis/${encodeURIComponent(kpiKey)}`,
      { cache: "no-store" }
    )
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message ?? String(err));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [kpiKey]);

  if (!kpiKey) {
    return (
      <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <div className="px-6 py-6 max-w-6xl mx-auto">Loading…</div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <div className="px-6 py-6 max-w-6xl mx-auto">Loading KPI…</div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <div className="px-6 py-6 max-w-6xl mx-auto space-y-2">
          <div className="text-lg font-semibold">Unable to load KPI</div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {error ?? "No data returned."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="px-6 py-6 max-w-6xl mx-auto">
        <Header
          title={data.kpi_name}
          subtitle={`KPI Detail · ${data.kpi_key.toUpperCase()}`}
        >
          <CloseWindowButton
            className="
              inline-flex items-center justify-center h-9 px-3 rounded-xl border
              border-gray-200 bg-white/60 text-indigo-700 hover:bg-white
              dark:border-slate-600 dark:bg-slate-900/60 dark:text-indigo-200 dark:hover:bg-slate-900
            "
          />
        </Header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Description
            </div>
            <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
              {data.description || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Definition
            </div>
            <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
              {data.definition || "—"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Example
            </div>
            <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">
              {data.example || "—"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
