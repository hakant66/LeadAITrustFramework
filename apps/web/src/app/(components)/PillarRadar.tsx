// src/app/(components)/PillarRadar.tsx
"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

type PillarCard = {
  pillar: string;
  score: number;
  weight: number;
  maturity: number;
};

export default function PillarRadar({ pillars }: { pillars: PillarCard[] }) {
  const data = pillars.map((p) => ({
    pillar: pretty(p.pillar),
    score: Math.round(p.score ?? 0),
  }));

  // If no data, avoid rendering a broken chart
  if (!data.length) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
        No pillar data available
      </div>
    );
  }

  return (
    // text-* classes set CSS `color`, which becomes `currentColor` in SVG,
    // so all strokes/fills using "currentColor" automatically adapt to
    // light/dark mode.
    <div className="w-full h-64 text-slate-700 dark:text-slate-100">
      <ResponsiveContainer>
        <RadarChart
          data={data}
          outerRadius="70%"
          margin={{ top: 24, right: 32, bottom: 24, left: 32 }}
        >
          <PolarGrid stroke="currentColor" strokeOpacity={0.15} />
          <PolarAngleAxis
            dataKey="pillar"
            tick={{ fill: "currentColor", fontSize: 11 }}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="currentColor"
            strokeOpacity={0.85}
            fill="currentColor"
            fillOpacity={0.22}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function pretty(k: string) {
  return (
    {
      governance: "Governance",
      pre_gtm: "Pre-GTM",
      data: "Data",
      transparency: "Transparency",
      human: "Human",
      cra_drift: "CRA & Drift",
    } as Record<string, string>
  )[k] ?? k;
}
