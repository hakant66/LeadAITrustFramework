// app/aireadinesscheck/ui/Header.tsx 
"use client";

import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <header
      className="
        rounded-3xl border border-slate-200/80
        bg-gradient-to-r from-indigo-600 to-blue-500
        p-4 text-white shadow-lg sm:p-6
        dark:border-slate-700/70
        dark:from-slate-900 dark:via-slate-900 dark:to-slate-950
      "
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Logo + title */}
        <Link
          href="https://www.theleadai.co.uk/"
          className="flex items-center gap-3"
          aria-label="Go to LeadAI website"
        >
          <Image
            src="/LeadAI.webp"
            alt="LeadAI"
            width={60}
            height={60}
            className="rounded-lg ring-1 ring-white/40 dark:ring-slate-700"
          />
          <div>
            <div className="text-[11px] uppercase tracking-wider text-white/80 dark:text-slate-300">
              LEADAI | TRUST SCORECARD
            </div>
            <div className="text-xl font-semibold sm:text-2xl text-white dark:text-slate-50">
              AI Readiness Check
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {/* Only Return Home button now */}
          <Link
            href="https://www.theleadai.co.uk/"
            className="rounded-xl bg-white/90 px-3 py-1.5 text-sm font-semibold text-slate-900 transition hover:bg-white dark:bg-slate-800/90 dark:text-slate-100 dark:hover:bg-slate-700 dark:border dark:border-slate-600/70"
            title="Return to LeadAI website"
          >
            Return Home
          </Link>
        </div>
      </div>
    </header>
  );
}
