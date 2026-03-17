"use client";
import { clsx } from "clsx";

export default function StatCard({
  label,
  value,
  hint,
  badge,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: string;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const toneClass = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    danger: "bg-red-100 text-red-800",
    warning: "bg-amber-100 text-amber-900",
  }[tone];

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 flex items-baseline gap-3">
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        {badge && (
          <span className={clsx("inline-flex rounded-full px-2 py-0.5 text-xs", toneClass)}>
            {badge}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}
