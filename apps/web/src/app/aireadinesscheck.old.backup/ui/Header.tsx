// apps/web/src/app/aireadinesscheck/ui/Header.tsx
"use client";

import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-600 to-blue-500 p-4 sm:p-6 text-white shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image
            src="/LeadAI.webp"
            alt="LeadAI"
            width={60}
            height={60}
            className="rounded-lg ring-1 ring-white/40"
            priority
          />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/80">
              LEADAI · TRUST SCORECARD
            </div>
            <div className="text-xl sm:text-2xl font-semibold">
              AI Readiness Check
            </div>
          </div>
        </div>
        <Link
          href="/"
          className="rounded-xl bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-white transition"
          title="Return to home"
          aria-label="Return to home"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
