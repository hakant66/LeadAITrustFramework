// src/app/(components)/DonutGauge.tsx
"use client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function DonutGauge({ value }:{ value:number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const data = [{ name:"score", value: v }, { name:"rest", value: 100 - v }];
  const colors = gaugeColors(v);
  return (
    <div className="flex items-center gap-4">
      <div style={{ width: 130, height: 130 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} innerRadius={48} outerRadius={60} paddingAngle={0} dataKey="value" stroke="none">
              <Cell fill={colors.fg} />
              <Cell fill={colors.bg} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className="text-4xl font-semibold tabular-nums">{v}%</div>
        <div className="text-gray-500 text-sm">Overall Trust</div>
      </div>
    </div>
  );
}

function gaugeColors(v:number){
  if (v >= 80) return { fg: "#10b981", bg: "#ecfdf5" };           // emerald
  if (v >= 60) return { fg: "#84cc16", bg: "#f7fee7" };           // lime
  if (v >= 40) return { fg: "#f59e0b", bg: "#fffbeb" };           // amber
  return { fg: "#ef4444", bg: "#fef2f2" };                        // red
}
