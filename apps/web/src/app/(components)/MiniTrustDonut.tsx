// src/app/(components)/MiniTrustDonut.tsx
"use client";

import { useEffect, useState } from "react";

export default function MiniTrustDonut({ slug, size = 56 }: { slug: string; size?: number }) {
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // go through Next API to avoid CORS/env issues
        const res = await fetch(`/api/scorecard/${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (alive) setPct(typeof data.overall_pct === "number" ? data.overall_pct : 0);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "err");
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  // SVG donut drawing
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, pct ?? 0));
  const dash = (value / 100) * c;

  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-gray-200"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-amber-500"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-semibold">{pct === null ? "…" : `${value.toFixed(0)}%`}</div>
        <div className="text-[11px] text-gray-500">Overall Trust</div>
        {err ? <div className="text-[10px] text-rose-500">load error</div> : null}
      </div>
    </div>
  );
}
