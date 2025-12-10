// apps/web/src/app/(components)/KpiHeatmap.tsx
"use client";

type Row = {
  name: string;
  normalized?: number | null;
  pillar: string;
  kpi_id: string;
  key: string;

  // enrichment fields
  target_text?: string | null;
  target_numeric?: number | null;

  owner_role?: string | null;
  owner?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
};

export default function KpiHeatmap({ rows }: { rows: Row[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-slate-400">
        No data
      </div>
    );
  }

  const items = rows.map((r) => ({
    ...r,
    n: clampPct(r.normalized),
  }));

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {items.map((r) => {
        const targetLabel = getTargetLabel(r);
        const ownerLabel = getOwnerLabel(r);

        return (
          <div
            key={r.kpi_id || r.key}
            className="p-2 rounded-xl border border-slate-200 bg-white shadow-sm
                       text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
          >
            {/* Title */}
            <div className="text-[11px] font-medium line-clamp-2">
              {r.name}
            </div>

            {/* Bar */}
            <div
              className="mt-2 h-6 rounded-lg"
              title={`${r.name}: ${r.n ?? 0}%`}
              style={{ background: colorFor(r.n ?? 0) }}
            />

            {/* Percentage */}
            <div className="mt-1 text-[11px] text-gray-600 dark:text-slate-300">
              {r.n ?? 0}%
            </div>

            {/* Bottom row: Target (left) · Owner (right) */}
            <div className="mt-1 flex items-start justify-between gap-2">
              {/* Target */}
              <div className="min-w-0 text-[10px] text-gray-600 dark:text-slate-300">
                <div className="uppercase tracking-wide text-[9px] text-gray-400 dark:text-slate-500">
                  Target
                </div>
                <div
                  className="truncate leading-tight"
                  title={targetLabel ?? ""}
                >
                  {targetLabel ?? "—"}
                </div>
              </div>

              {/* Owner */}
              <div className="min-w-0 text-[10px] text-gray-600 dark:text-slate-300 text-right">
                <div className="uppercase tracking-wide text-[9px] text-gray-400 dark:text-slate-500">
                  Owner
                </div>
                <div
                  className="truncate leading-tight"
                  title={ownerLabel ?? ""}
                >
                  {ownerLabel ?? "—"}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --- helpers --- */

function clampPct(v?: number | null): number {
  if (v === null || v === undefined || Number.isNaN(v)) return 0;
  let n = v;
  // support 0–1 range as well
  if (n >= 0 && n <= 1) n = n * 100;
  n = Math.round(n);
  if (n < 0) n = 0;
  if (n > 100) n = 100;
  return n;
}

function getTargetLabel(r: Row): string | null {
  if (r.target_text && r.target_text.trim().length > 0) {
    return r.target_text.trim();
  }
  if (typeof r.target_numeric === "number") {
    let n = r.target_numeric;
    if (n >= 0 && n <= 1) n = n * 100;
    return `${Math.round(n)}%`;
  }
  return null;
}

function getOwnerLabel(r: Row): string | null {
  if (r.owner_role && r.owner_role.trim().length > 0) return r.owner_role.trim();
  if (r.owner && r.owner.trim().length > 0) return r.owner.trim();
  if (r.owner_name && r.owner_name.trim().length > 0) return r.owner_name.trim();
  if (r.owner_email && r.owner_email.trim().length > 0) return r.owner_email.trim();
  return null;
}

function colorFor(n: number) {
  // green→amber→red (same look as before)
  const g = `linear-gradient(90deg, rgba(16,185,129,0.2), rgba(16,185,129,0.35))`;
  const a = `linear-gradient(90deg, rgba(245,158,11,0.2), rgba(245,158,11,0.35))`;
  const r = `linear-gradient(90deg, rgba(239,68,68,0.2), rgba(239,68,68,0.35))`;
  if (n >= 80) return g;
  if (n >= 60)
    return `linear-gradient(90deg, rgba(34,197,94,0.2), rgba(245,158,11,0.35))`;
  if (n >= 40) return a;
  if (n >= 20)
    return `linear-gradient(90deg, rgba(245,158,11,0.2), rgba(239,68,68,0.35))`;
  return r;
}
