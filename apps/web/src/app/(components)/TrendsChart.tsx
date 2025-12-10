// src/app/(components)/TrendsChart.tsx
"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type Point = { as_of: string; score: number };

export function TrendsChart({ projectSlug }: { projectSlug: string }) {
  const [data, setData] = useState<Point[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Detect system / Tailwind dark mode (media strategy)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (matches: boolean) => setIsDark(matches);

    apply(mq.matches);
    const handler = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_CORE_SVC_URL ?? "/api";
    const sp = new URLSearchParams({ window: "90d", grain: "week" });
    const url = `${base.replace(/\/+$/, "")}/scorecard/${encodeURIComponent(
      projectSlug,
    )}/trends?${sp.toString()}`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => {
        // accept {overall: [...]}, {data:[...]}, or just [...]
        const raw: any[] = Array.isArray(j)
          ? j
          : Array.isArray(j?.overall)
          ? j.overall
          : Array.isArray(j?.data)
          ? j.data
          : [];

        // 🔧 Map backend shape ({t, v}) -> chart shape ({as_of, score})
        const arr: Point[] = raw.map((p: any) => ({
          as_of: String(p.as_of ?? p.t ?? ""),
          score:
            typeof p.score === "number"
              ? p.score
              : typeof p.v === "number"
              ? p.v
              : 0,
        }));

        setData(arr);
      })
      .catch((e) => {
        setErr(String(e));
        setData([]);
      });
  }, [projectSlug]);

  if (data === null) {
    return (
      <div className="text-sm text-gray-600 dark:text-slate-300">
        Loading trends…
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="text-sm text-gray-600 dark:text-slate-300">
        No trend points yet.
      </div>
    );
  }

  // Theme-aware chart colors
  const axisColor = isDark ? "#CBD5F5" : "#475569";   // slate-300 / slate-600
  const gridColor = isDark ? "#1E293B" : "#E2E8F0";   // slate-800 / slate-200
  const lineColor = isDark ? "#4ADE80" : "#0F766E";   // emerald-400 / teal-700

  return (
    <div
      style={{ width: "100%", height: 280 }}
      className="text-slate-900 dark:text-slate-100"
    >
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
          <XAxis
            dataKey="as_of"
            tick={{ fill: axisColor, fontSize: 11 }}
            stroke={axisColor}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: axisColor, fontSize: 11 }}
            stroke={axisColor}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? "#020617" : "#FFFFFF", // slate-950 / white
              borderColor: isDark ? "#334155" : "#E2E8F0",     // slate-600 / slate-200
              borderRadius: 12,
              fontSize: 12,
            }}
            labelStyle={{ color: axisColor }}
          />
          <Line
            type="monotone"
            dataKey="score"
            dot={false}
            stroke={lineColor}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>

      {err && (
        <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Loaded with warning: {err}
        </div>
      )}
    </div>
  );
}
