"use client";

import { useRouter } from "next/navigation";

export default function HistoryBackButton({
  label = "Back",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={`inline-flex items-center justify-center h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 ${className}`}
    >
      {label}
    </button>
  );
}
