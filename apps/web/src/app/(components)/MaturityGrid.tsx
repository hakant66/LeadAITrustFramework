"use client";
// src/app/scorecard/(components)/MaturityGrid.tsx
export default function MaturityGrid({ pillars }: { pillars: { pillar: string; score: number; maturity: number }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {pillars.map((p, i) => (
        <div key={`${p.pillar || "unknown"}-${i}`} className="border rounded-xl px-3 py-2">
          <div className="text-sm font-medium">{pretty(p.pillar || `Unknown ${i + 1}`)}</div>
          <div className="mt-1 text-xs text-gray-500">Score: {Math.round(p.score)}%</div>
          <Badge lvl={p.maturity} />
        </div>
      ))}
    </div>
  );
}
function Badge({ lvl }: { lvl: number }) {
  const map = {
    1: "bg-red-100 text-red-800",
    2: "bg-amber-100 text-amber-800",
    3: "bg-yellow-100 text-yellow-800",
    4: "bg-blue-100 text-blue-800",
    5: "bg-green-100 text-green-800",
  } as const;
  return <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs ${map[lvl as 1|2|3|4|5]}`}>Level {lvl}</span>;
}
function pretty(k: string) {
  return ({
    governance: "Governance",
    pre_gtm: "Pre-GTM",
    data: "Data",
    transparency: "Transparency",
    human: "Human",
    cra_drift: "CRA & Drift",
  } as Record<string,string>)[k] ?? k;
}
