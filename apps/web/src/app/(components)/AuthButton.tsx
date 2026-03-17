"use client";

import { useRouter } from "next/navigation";

export function AuthButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/scorecard")}
      className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition
                 hover:bg-emerald-400
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/80
                 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950
                 dark:focus-visible:ring-offset-slate-900"
    >
      Open Scorecard
    </button>
  );
}
