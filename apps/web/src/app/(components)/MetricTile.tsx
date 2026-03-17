// src/app/(components)/MetricTile.tsx
"use client";
import clsx from "clsx";

export default function MetricTile(
  { label, value, hint, tone }:
  { label:string; value:string; hint?:string; tone?:"ok"|"warn"|"bad"|"info" }
){
  const map = {
    ok:   "bg-emerald-50 text-emerald-900 ring-emerald-100",
    warn: "bg-amber-50 text-amber-900 ring-amber-100",
    bad:  "bg-rose-50 text-rose-900 ring-rose-100",
    info: "bg-indigo-50 text-indigo-900 ring-indigo-100",
  } as const;
  const cls = map[tone ?? "info"];
  return (
    <div className={clsx("rounded-2xl p-4 ring-1", cls)}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {hint && <div className="text-xs opacity-70 mt-1">{hint}</div>}
    </div>
  );
}
