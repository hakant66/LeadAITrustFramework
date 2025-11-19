//src/app/(components)/PillarRadar.tsx
"use client";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

type PillarCard = { pillar: string; score: number; weight: number; maturity: number };

export default function PillarRadar({ pillars }: { pillars: PillarCard[] }) {
  const data = pillars.map(p => ({ pillar: pretty(p.pillar), score: Math.round(p.score) }));
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="pillar" />
          <Radar name="Score" dataKey="score" />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
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
