// apps/web/src/app/(components)/FilterablePaginatedTable.tsx
"use client";
import { useMemo, useState } from "react";

export function FilterablePaginatedTable<T>({
  rows,
  columns,
  pageSize = 25,
}: {
  rows: T[];
  columns: { header: string; render: (row: T) => React.ReactNode; key: string }[];
  pageSize?: number;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r: any) =>
      Object.values(r).some((v) =>
        String(v ?? "").toLowerCase().includes(needle),
      ),
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  return (
    <div className="space-y-3 text-slate-900 dark:text-slate-50">
      <input
        className="w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        placeholder="Filter by control, KPI, owner…"
        value={q}
        onChange={(e) => {
          setPage(1);
          setQ(e.target.value);
        }}
      />

      <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-900/60">
            <tr className="text-left text-gray-600 dark:text-slate-300 [&>th]:px-3 [&>th]:py-2">
              {columns.map((c) => (
                <th key={c.key}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr
                key={i}
                className="[&>td]:px-3 [&>td]:py-2 border-t border-slate-200 dark:border-slate-700"
              >
                {columns.map((c) => (
                  <td key={c.key}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-slate-300">
        <span>{filtered.length} rows</span>
        <div className="flex items-center gap-2">
          <button
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Prev
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
