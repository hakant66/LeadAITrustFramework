// apps/web/src/app/(components)/KpiHeatmap.tsx
"use client";

type Row = {
  name: string;
  normalized: number;
  pillar: string;
  kpi_id: string;
  key: string;
  // NEW (optional) fields:
  target_text?: string | null;
  owner_role?: string | null;
};

export default function KpiHeatmap({ rows }: { rows: Row[] }) {
  if (!rows.length) return <div className="text-sm text-gray-500">No data</div>;

  const items = rows.map((r) => ({ ...r, n: Math.round(r.normalized) }));

  return (
    <div className="grid grid-cols-6 gap-2">
      {items.map((r) => (
        <div key={r.kpi_id || r.key} className="p-2 border rounded-xl">
          {/* Title */}
          <div className="text-[11px] font-medium line-clamp-2">{r.name}</div>

          {/* Bar */}
          <div
            className="mt-2 h-6 rounded-lg"
            title={`${r.name}: ${r.n}%`}
            style={{ background: colorFor(r.n) }}
          />

          {/* Percentage */}
          <div className="mt-1 text-[11px] text-gray-600">{r.n}%</div>

			{/* Bottom row: Target (left) · Owner (right), values on the next line */}
			<div className="mt-1 flex items-start justify-between gap-2">
			  {/* Target */}
			  <div className="min-w-0 text-[10px] text-gray-600">
				<div className="uppercase tracking-wide text-[9px] text-gray-400">Target</div>
				<div className="truncate leading-tight" title={r.target_text ?? ""}>
				  {r.target_text ?? "—"}
				</div>
			  </div>

			  {/* Owner */}
			  <div className="min-w-0 text-[10px] text-gray-600 text-right">
				<div className="uppercase tracking-wide text-[9px] text-gray-400">Owner</div>
				<div className="truncate leading-tight" title={r.owner_role ?? ""}>
				  {r.owner_role ?? "—"}
				</div>
			  </div>
			</div>
		  
        </div>
      ))}
    </div>
  );
}

function colorFor(n: number) {
  // green→amber→red (same look as before)
  const g = `linear-gradient(90deg, rgba(16,185,129,0.2), rgba(16,185,129,0.35))`;
  const a = `linear-gradient(90deg, rgba(245,158,11,0.2), rgba(245,158,11,0.35))`;
  const r = `linear-gradient(90deg, rgba(239,68,68,0.2), rgba(239,68,68,0.35))`;
  if (n >= 80) return g;
  if (n >= 60) return `linear-gradient(90deg, rgba(34,197,94,0.2), rgba(245,158,11,0.35))`;
  if (n >= 40) return a;
  if (n >= 20) return `linear-gradient(90deg, rgba(245,158,11,0.2), rgba(239,68,68,0.35))`;
  return r;
}
