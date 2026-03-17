"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

// Demo trend: last 8 checkpoints ending at current
export default function TrustTrend({ current }: { current: number }) {
  const base = Math.max(40, Math.min(95, Math.round(current)));
  const data = Array.from({length:8}).map((_,i)=>({
    t: `T-${7-i}`, v: Math.max(30, Math.min(100, base - 8 + i*2 + (i%2?3:-2)))
  })).concat([{t:"Now", v: base}]);

  return (
    <div style={{ width:"100%", height: 260 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" />
          <YAxis domain={[0,100]} />
          <Tooltip />
          <Line type="monotone" dataKey="v" dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
