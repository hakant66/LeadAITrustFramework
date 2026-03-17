// src/app/(components)/PillarSummary.tsx
"use client";
import clsx from "clsx";

type Pillar = { pillar:string; score:number; maturity:number; weight:number };

export default function PillarSummary({ pillars }:{ pillars:Pillar[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {pillars.map(p => <PillarCard key={p.pillar} p={p} />)}
    </div>
  );
}

function PillarCard({ p }:{ p:Pillar }) {
  const pct = Math.round(p.score);
  const tone = pct >= 80 ? "good" : pct >= 60 ? "warn" : pct >= 40 ? "meh" : "bad";
  return (
    <div className="border rounded-2xl p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-medium">{pretty(p.pillar)}</div>
        <Maturity lvl={p.maturity} />
      </div>
      <div className="mt-2 text-sm text-gray-500">Weight {(p.weight*100).toFixed(0)}%</div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Score</span>
          <span className="font-semibold">{pct}%</span>
        </div>
        <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className={clsx("h-2", barTone(tone))} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function Maturity({ lvl }:{ lvl:number }) {
  const map = {
    1: "bg-rose-100 text-rose-800",
    2: "bg-amber-100 text-amber-800",
    3: "bg-yellow-100 text-yellow-800",
    4: "bg-blue-100 text-blue-800",
    5: "bg-emerald-100 text-emerald-800",
  } as const;
  return <span className={`px-2 py-0.5 rounded-full text-xs ${map[lvl as 1|2|3|4|5]}`}>L{lvl}</span>;
}

function barTone(t:"good"|"warn"|"meh"|"bad"){
  return {
    good:"bg-emerald-500",
    warn:"bg-amber-500",
    meh:"bg-yellow-500",
    bad:"bg-rose-500",
  }[t];
}

function pretty(k:string){
  return ({
    governance: "Governance",
    pre_gtm: "Pre-GTM",
    data: "Data",
    transparency: "Transparency / XAI",
    human: "Human Control",
    cra_drift: "CRA & Drift",
  } as Record<string,string>)[k] ?? k;
}
