// apps/web/src/app/(components)/PillarBar.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine} from "recharts";

type Pillar = { key?: string; pillar: string; score: number; weight?: number; maturity?: number };

export default function PillarBar({
  pillars,
  threshold = 75,
  height = 260,
  labelField = "key",
  onBarClick,
}: {
  pillars: Pillar[];
  threshold?: number;
  height?: number;
  labelField?: "pillar" | "key";
  onBarClick?: (info: { id: string; name: string; score: number; index: number }) => void; // <—
}) {
  const data = pillars.map((p, i) => {
    const name = (labelField === "key" ? p.key : p.pillar) ?? p.pillar;
    return {
      id: (p.key ?? p.pillar) as string, // used for routing
      name,
      score: typeof p.score === "number" ? Math.round(p.score) : 0,
      index: i,
    };
  });
  
  const shorten = (s: string, max = 25) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 6, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-45} textAnchor="end" height={42} tick={{ fontSize: 12 }} interval={0}  />
          <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: number) => [`${Math.round(v)}%`, "Score"]} />
          <ReferenceLine y={threshold} stroke="#9ca3af" strokeDasharray="4 4" ifOverflow="extendDomain" />
          <Bar dataKey="score" animationDuration={600}>
            {data.map((d, i) => {
              const color = d.score >= threshold ? "#60aa00" : "#ef9e1b";
              return (
                <Cell
                  key={i}
                  fill={color}
                  cursor={onBarClick ? "pointer" : "default"}
                  onClick={() => onBarClick?.(d)}  // <— route on click
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-0 text-xs text-gray-500">
        Bars in green meet or exceed {threshold}%; orange are below.
      </div>
    </div>
  );
}